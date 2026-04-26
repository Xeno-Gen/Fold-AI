import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.SECRET_KEY || 'fold-ai-default-secret-key-change-in-production';
const IV = crypto.randomBytes(16);

export function encrypt(text: string): string {
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET.padEnd(32).slice(0,32)), IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${IV.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string | null {
    try {
        const [ivHex, encrypted] = encryptedText.split(':');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET.padEnd(32).slice(0,32)), Buffer.from(ivHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return null;
    }
}