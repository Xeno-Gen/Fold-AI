module.exports = function(context) {
    const express = require('express');
    const fs = require('fs');
    const path = require('path');
    const multer = require('multer');
    const router = express.Router();

    const DEFAULT_WORK_DIR = path.join(__dirname, '../../../cwd');
    const HISTORY_DIR = path.join(__dirname, '../../data/plugin_data/FileOperations/history');

    function ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    ensureDir(DEFAULT_WORK_DIR);
    ensureDir(HISTORY_DIR);

    function resolvePath(filename, workDir) {
        workDir = workDir || DEFAULT_WORK_DIR;
        ensureDir(workDir);
        var normalized = path.normalize(filename);
        var workDirNormalized = path.normalize(workDir);
        if (normalized.startsWith(workDirNormalized)) {
            normalized = normalized.substring(workDirNormalized.length).replace(/^[\/\\]+/, '');
        } else if (path.isAbsolute(normalized)) {
            normalized = path.basename(filename);
        }
        const safe = normalized.replace(/^(\.\.(\/|\\|$))+/, '');
        return path.join(workDir, safe);
    }

    // ── Local .bak backup ──
    // Backups are stored as <file>.bak in the same directory as the source file.
    function createBak(filePath) {
        if (!fs.existsSync(filePath)) return null;
        try {
            var content = fs.readFileSync(filePath, 'utf-8');
            var bakPath = filePath + '.bak';
            fs.writeFileSync(bakPath, content, 'utf-8');
            return bakPath;
        } catch (e) {
            context.logger.error('FileOperations createBak failed: ' + e.message);
            return null;
        }
    }

    function restoreFromBak(filePath) {
        var bakPath = filePath + '.bak';
        if (!fs.existsSync(bakPath)) return null;
        try {
            var content = fs.readFileSync(bakPath, 'utf-8');
            fs.writeFileSync(filePath, content, 'utf-8');
            return { size: Buffer.byteLength(content, 'utf-8') };
        } catch (e) {
            context.logger.error('FileOperations restoreFromBak failed: ' + e.message);
            return null;
        }
    }

    function removeBak(filePath) {
        var bakPath = filePath + '.bak';
        try { if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath); } catch (e) {}
    }

    // ── History ──
    function getHistoryFile(userToken) {
        return path.join(HISTORY_DIR, userToken + '.json');
    }

    function readHistory(userToken) {
        try {
            var f = getHistoryFile(userToken);
            if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
        } catch (e) {}
        return [];
    }

    function addHistory(userToken, entry) {
        var h = readHistory(userToken);
        h.push(Object.assign({}, entry, {
            time: new Date().toISOString(),
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        }));
        fs.writeFileSync(getHistoryFile(userToken), JSON.stringify(h, null, 2), 'utf-8');
        return h;
    }

    // ── List files ──
    router.get('/files', function(req, res) {
        try {
            var workDir = req.query.workingDirectory || DEFAULT_WORK_DIR;
            ensureDir(workDir);
            var files = fs.readdirSync(workDir).filter(function(f) {
                if (f.endsWith('.bak')) return false; // hide .bak files from listing
                return fs.statSync(path.join(workDir, f)).isFile();
            }).map(function(f) {
                var stat = fs.statSync(path.join(workDir, f));
                return { name: f, size: stat.size, mtime: stat.mtime.toISOString() };
            });
            res.json({ files: files });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Get file content ──
    router.get('/file', function(req, res) {
        try {
            var name = req.query.name;
            if (!name) return res.status(400).json({ error: '缺少文件名' });
            var workDir = req.query.workingDirectory || DEFAULT_WORK_DIR;
            var filePath = resolvePath(name, workDir);
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
            var content = fs.readFileSync(filePath, 'utf-8');
            res.json({ name: name, content: content, lines: content.split('\n').length, size: Buffer.byteLength(content, 'utf-8'), mtime: fs.statSync(filePath).mtime.toISOString() });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── List .bak backups in work dir ──
    router.get('/backups', function(req, res) {
        try {
            var workDir = req.query.workingDirectory || DEFAULT_WORK_DIR;
            ensureDir(workDir);
            var baks = fs.readdirSync(workDir).filter(function(f) { return f.endsWith('.bak'); }).map(function(f) {
                var stat = fs.statSync(path.join(workDir, f));
                var origName = f.slice(0, -4);
                return {
                    file: origName,
                    backupFile: f,
                    time: stat.mtime.toISOString(),
                    size: stat.size
                };
            }).sort(function(a, b) { return b.time.localeCompare(a.time); });
            res.json({ backups: baks });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Restore from .bak ──
    router.post('/backup/restore/:file', function(req, res) {
        try {
            var name = decodeURIComponent(req.params.file);
            var workDir = req.body.workingDirectory || DEFAULT_WORK_DIR;
            var filePath = resolvePath(name, workDir);
            var result = restoreFromBak(filePath);
            if (!result) return res.status(404).json({ error: '备份文件不存在 (' + name + '.bak)' });
            addHistory(req.userToken, { type: 'restore', file: name, from: 'bak' });
            res.json({ success: true, file: name, size: result.size });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Get history ──
    router.get('/history', function(req, res) {
        res.json({ history: readHistory(req.userToken) });
    });

    // ── Rollback ──
    router.post('/rollback/:id', function(req, res) {
        try {
            var h = readHistory(req.userToken);
            var entry = h.find(function(e) { return e.id === req.params.id; });
            if (!entry) return res.status(404).json({ error: '历史记录不存在' });

            var workDir = req.body.workingDirectory || DEFAULT_WORK_DIR;
            var filePath = resolvePath(entry.file, workDir);

            // Try .bak first
            if (entry.hasBak) {
                var result = restoreFromBak(filePath);
                if (result) return res.json({ success: true, file: entry.file, from: 'bak' });
            }

            // Fallback to previousContent
            if (entry.type === 'add' || entry.type === 'mod') {
                if (entry.previousContent === null) {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } else {
                    fs.writeFileSync(filePath, entry.previousContent, 'utf-8');
                }
                return res.json({ success: true, file: entry.file, from: 'history' });
            }

            return res.status(400).json({ error: '无法回滚此操作' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Execute: parse tag format and execute ──
    router.post('/execute', function(req, res) {
        try {
            var command = req.body.command;
            var workDir = req.body.workingDirectory || DEFAULT_WORK_DIR;
            if (!command) return res.status(400).json({ error: '缺少命令' });

            var results = [];
            // Support: add, mod, del, res (restore from .bak)
            var tagRegex = /<(add|mod|del|res)>([\s\S]*?)<\/\1>/gi;
            var match;

            while ((match = tagRegex.exec(command)) !== null) {
                var tagType = match[1].toLowerCase();
                var body = match[2];

                if (tagType === 'add') {
                    var nlIdx = body.indexOf('\n');
                    if (nlIdx === -1) { results.push({ type: 'add', error: '格式错误: 需要换行分隔文件名和内容' }); continue; }
                    var fname = body.substring(0, nlIdx).trim();
                    var content = body.substring(nlIdx + 1);
                    var filePath = resolvePath(fname, workDir);
                    var previousContent = null;
                    var hasBak = false;
                    if (fs.existsSync(filePath)) {
                        previousContent = fs.readFileSync(filePath, 'utf-8');
                        hasBak = !!createBak(filePath);
                    }
                    fs.writeFileSync(filePath, content, 'utf-8');
                    addHistory(req.userToken, { type: 'add', file: fname, previousContent: previousContent, hasBak: hasBak });
                    results.push({ type: 'add', file: fname, written: Buffer.byteLength(content, 'utf-8'), action: previousContent !== null ? 'updated' : 'created' });
                }
                else if (tagType === 'mod') {
                    var nlIdx = body.indexOf('\n');
                    if (nlIdx === -1) { results.push({ type: 'mod', error: '格式错误: 需要换行分隔文件名和内容' }); continue; }
                    var firstLine = body.substring(0, nlIdx).trim();
                    var rest = body.substring(nlIdx + 1);
                    // Format: (文件路径)|(行号,行号)
                    var headerMatch = firstLine.match(/^\(([^)]+)\)\s*\|\s*\((\d+)\s*,\s*(\d+)\)$/);
                    if (!headerMatch) { results.push({ type: 'mod', error: '格式错误: 需要 (文件路径)|(起始行,结束行) 格式' }); continue; }
                    var fname = headerMatch[1].trim();
                    var startLine = parseInt(headerMatch[2]);
                    var endLine = parseInt(headerMatch[3]);
                    var newContent = rest;

                    var filePath = resolvePath(fname, workDir);
                    if (!fs.existsSync(filePath)) { results.push({ type: 'mod', file: fname, error: '文件不存在' }); continue; }
                    var prevContent = fs.readFileSync(filePath, 'utf-8');
                    var hasBak = !!createBak(filePath);
                    var allLines = prevContent.split('\n');
                    var s = Math.max(1, startLine) - 1;
                    var e = Math.min(allLines.length, endLine);
                    var newLines = newContent.split('\n');
                    allLines.splice(s, e - s, newLines);
                    fs.writeFileSync(filePath, allLines.join('\n'), 'utf-8');
                    addHistory(req.userToken, { type: 'mod', file: fname, range: startLine + '~' + endLine, previousContent: prevContent, hasBak: hasBak });
                    results.push({ type: 'mod', file: fname, range: startLine + '~' + endLine, replaced: e - s, with: newLines.length });
                }
                else if (tagType === 'del') {
                    var fname = body.trim();
                    if (!fname) { results.push({ type: 'del', error: '格式错误: 需要文件名' }); continue; }
                    var filePath = resolvePath(fname, workDir);
                    if (!fs.existsSync(filePath)) { results.push({ type: 'del', file: fname, error: '文件不存在' }); continue; }
                    var hasBak = !!createBak(filePath);
                    var stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        fs.rmdirSync(filePath, { recursive: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    addHistory(req.userToken, { type: 'del', file: fname, previousContent: null, hasBak: hasBak });
                    results.push({ type: 'del', file: fname, action: 'deleted', bakCreated: hasBak });
                }
                else if (tagType === 'res') {
                    var fname = body.trim();
                    if (!fname) { results.push({ type: 'res', error: '格式错误: 需要文件名' }); continue; }
                    var filePath = resolvePath(fname, workDir);
                    var result = restoreFromBak(filePath);
                    if (!result) {
                        results.push({ type: 'res', file: fname, error: '备份文件不存在 (' + fname + '.bak)' });
                    } else {
                        addHistory(req.userToken, { type: 'res', file: fname, from: 'bak' });
                        results.push({ type: 'res', file: fname, action: 'restored', size: result.size });
                    }
                }
            }

            res.json({ results: results.length > 0 ? results : [{ error: '未识别到有效文件操作命令' }] });
        } catch (e) {
            context.logger.error('FileOperations execute: ' + e.message);
            res.status(500).json({ error: e.message });
        }
    });

    // ── Write file ──
    router.post('/write/:name', function(req, res) {
        try {
            var name = decodeURIComponent(req.params.name);
            var content = req.body.content;
            var workDir = req.body.workingDirectory || DEFAULT_WORK_DIR;
            if (content === undefined) return res.status(400).json({ error: '缺少内容' });
            var filePath = resolvePath(name, workDir);
            var previousContent = null;
            var hasBak = false;
            if (fs.existsSync(filePath)) {
                previousContent = fs.readFileSync(filePath, 'utf-8');
                hasBak = !!createBak(filePath);
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            addHistory(req.userToken, { type: 'add', file: name, previousContent: previousContent, hasBak: hasBak });
            res.json({ success: true, file: name, action: previousContent !== null ? 'updated' : 'created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Upload file ──
    var upload = multer({
        storage: multer.diskStorage({
            destination: function(req, file, cb) {
                var workDir = req.body.workingDirectory || DEFAULT_WORK_DIR;
                ensureDir(workDir);
                cb(null, workDir);
            },
            filename: function(req, file, cb) { cb(null, file.originalname); }
        }),
        limits: { fileSize: 50 * 1024 * 1024 }
    });

    router.post('/upload', upload.single('file'), function(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: '没有文件' });
            var name = req.file.originalname;
            var filePath = path.join(req.file.destination, name);
            var previousContent = null;
            var hasBak = false;
            if (fs.existsSync(filePath) && req.file.path !== filePath) {
                previousContent = fs.readFileSync(filePath, 'utf-8');
                hasBak = !!createBak(filePath);
            }
            addHistory(req.userToken, { type: 'upload', file: name, previousContent: previousContent, hasBak: hasBak });
            res.json({ success: true, fileName: name, size: req.file.size, path: req.file.path });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Delete file ──
    router.post('/delete', function(req, res) {
        try {
            var filename = req.body.filename;
            var workDir = req.body.workingDirectory || DEFAULT_WORK_DIR;
            if (!filename) return res.status(400).json({ error: '缺少文件名' });
            var filePath = resolvePath(filename, workDir);
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });

            var stat = fs.statSync(filePath);
            if (!stat.isDirectory()) {
                var hasBak = !!createBak(filePath);
                fs.unlinkSync(filePath);
                addHistory(req.userToken, { type: 'del', file: filename, previousContent: null, hasBak: hasBak });
            } else {
                fs.rmdirSync(filePath, { recursive: true });
                addHistory(req.userToken, { type: 'del', file: filename, previousContent: null, hasBak: false });
            }
            res.json({ success: true, file: filename });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    context.logger.info('FileOperations plugin routes registered (local .bak)');
    return { router: router };
};
