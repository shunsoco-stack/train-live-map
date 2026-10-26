import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { NativeRegistration } from './nativePush.ts';

export function registrationId(v: NativeRegistration) { return createHash('sha256').update(`${v.bundleId}:${v.environment}:${v.deviceToken}`).digest('hex'); }
export function ownerHash(v: NativeRegistration) { return createHash('sha256').update(v.installationSecret).digest('hex'); }
export function encryptRegistration(v: NativeRegistration, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const { installationSecret: _secret, ...record } = v;
  void _secret;
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptRegistration(encrypted: string, key: Buffer): Omit<NativeRegistration, 'installationSecret'> {
  const bytes = Buffer.from(encrypted, 'base64');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0,12));
  cipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
