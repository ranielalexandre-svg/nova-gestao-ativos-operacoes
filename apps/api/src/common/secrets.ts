import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { getIntegrationSecretKey } from './env';

function getSecretKey() {
  return createHash('sha256').update(getIntegrationSecretKey()).digest();
}

export function encryptSecret(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const iv = randomBytes(12);
  const key = getSecretKey();

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptSecret(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const [version, ivB64, tagB64, encryptedB64] = normalized.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Formato de segredo inválido');
  }

  const key = getSecretKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
