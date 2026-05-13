(function() {
    'use strict';

    class FileOperationsPlugin {
        constructor() {
            this.id = 'FileOperations';
            this.name = '文件操作';
            this.enabled = true;
        }

        async execute(command, workingDirectory) {
            var res = await fetch('/api/plugin/FileOperations/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: command, workingDirectory: workingDirectory })
            });
            return await res.json();
        }

        async listFiles(workingDirectory) {
            var url = '/api/plugin/FileOperations/files';
            if (workingDirectory) url += '?workingDirectory=' + encodeURIComponent(workingDirectory);
            var res = await fetch(url);
            return await res.json();
        }

        async writeFile(name, content, workingDirectory) {
            var res = await fetch('/api/plugin/FileOperations/write/' + encodeURIComponent(name), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content, workingDirectory: workingDirectory })
            });
            return await res.json();
        }

        async getHistory() {
            var res = await fetch('/api/plugin/FileOperations/history');
            return await res.json();
        }

        async rollback(id, workingDirectory) {
            var res = await fetch('/api/plugin/FileOperations/rollback/' + id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workingDirectory: workingDirectory })
            });
            return await res.json();
        }

        async uploadFile(file, workingDirectory) {
            var formData = new FormData();
            formData.append('file', file);
            if (workingDirectory) formData.append('workingDirectory', workingDirectory);
            var res = await fetch('/api/plugin/FileOperations/upload', {
                method: 'POST',
                body: formData
            });
            return await res.json();
        }

        async deleteFile(filename, workingDirectory) {
            var res = await fetch('/api/plugin/FileOperations/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filename, workingDirectory: workingDirectory })
            });
            return await res.json();
        }

        // ── Backup management ──
        async listBackups(workingDirectory) {
            var url = '/api/plugin/FileOperations/backups';
            if (workingDirectory) url += '?workingDirectory=' + encodeURIComponent(workingDirectory);
            var res = await fetch(url);
            return await res.json();
        }

        async restoreBackup(filename, workingDirectory) {
            var res = await fetch('/api/plugin/FileOperations/backup/restore/' + encodeURIComponent(filename), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workingDirectory: workingDirectory })
            });
            return await res.json();
        }
    }

    window.FileOperationsPlugin = new FileOperationsPlugin();
    console.log('[FileOperations] 插件已加载（带备份功能）');
})();
