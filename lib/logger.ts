const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let level = LEVELS.INFO;

function ts(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const logger = {
    info: (msg: string) => { if (level <= LEVELS.INFO) console.log(`[${ts()}] [INFO] ${msg}`); },
    warn: (msg: string) => { if (level <= LEVELS.WARN) console.warn(`[${ts()}] [WARN] ${msg}`); },
    error: (msg: string) => { if (level <= LEVELS.ERROR) console.error(`[${ts()}] [ERROR] ${msg}`); },
    debug: (msg: string) => { if (level <= LEVELS.DEBUG) console.log(`[${ts()}] [DEBUG] ${msg}`); },
    setLevel: (l: keyof typeof LEVELS) => { level = LEVELS[l]; }
};
