// lib/crypto/transfer.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// 从环境变量读取传输加密密钥，未设置则使用默认值（生产务必设置）
const SECRET = process.env.TRANSFER_SECRET || 'fold-ai-transfer-default';
const KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32字节

/**
 * 加密字符串，返回 "iv:authTag:cipher" 十六进制字符串
 */
export function encryptPlain(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 解密，失败返回 null
 */
export function decryptPlain(encryptedText: string): string | null {
    try {
        const [ivHex, authTagHex, cipherHex] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return null;
    }
}