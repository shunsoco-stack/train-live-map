import { randomUUID } from 'node:crypto';
import { registrationId, ownerHash, encryptRegistration } from '@/lib/nativePushCrypto';
export { decryptRegistration } from '@/lib/nativePushCrypto';
import { redisCommand, redisConfiguration } from './redis';
import type { NativeRegistration, OfficialState } from '@/lib/nativePush';
const PREFIX = 'train-live-map:apns:v1';
export const RETENTION_SECONDS = 180 * 86400;
export function nativeStoreConfiguration() {
  const redis = redisConfiguration();
  const key = process.env.APNS_STORAGE_KEY;
  const bundle = process.env.APNS_BUNDLE_ID;
  return redis && key && /^[a-f0-9]{64}$/.test(key) && bundle ? { redis, key: Buffer.from(key, 'hex'), bundle } : null;
}
export interface StoredNativeRegistration { id: string; owner: string; encrypted: string; }
export async function mutateRegistration(value: NativeRegistration, removing: boolean): Promise<boolean> {
  const config = nativeStoreConfiguration();
  if (!config) throw new Error('Native registration unavailable');
  const id = registrationId(value), owner = ownerHash(value);
  // Ownership, capacity and mutation are one atomic operation; tokens cannot be reassigned.
  const script = `
local old = redis.call('GET', KEYS[1])
if old and cjson.decode(old).owner ~= ARGV[1] then return 0 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[5])
if ARGV[2] == 'delete' then
  redis.call('DEL', KEYS[1], KEYS[3]); redis.call('ZREM', KEYS[2], ARGV[4]); return 1
end
if not old and redis.call('ZCARD', KEYS[2]) >= 500 then return -1 end
redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[6])
redis.call('ZADD', KEYS[2], ARGV[7], ARGV[4]); return 1`;
  const record: StoredNativeRegistration = { id, owner, encrypted: encryptRegistration(value, config.key) };
  const result = await redisCommand<number>(config.redis, ['EVAL',script,3,`${PREFIX}:device:${id}`,`${PREFIX}:index`,`${PREFIX}:state:${id}`,owner,removing ? 'delete' : 'upsert',JSON.stringify(record),id,Date.now()-RETENTION_SECONDS*1000,RETENTION_SECONDS,Date.now()]);
  if (result === -1) throw new Error('Native registration capacity');
  return result === 1;
}
export async function listNativeRegistrations(): Promise<StoredNativeRegistration[]> {
  const c = nativeStoreConfiguration(); if (!c) return [];
  await redisCommand(c.redis,['ZREMRANGEBYSCORE',`${PREFIX}:index`,'-inf',Date.now()-RETENTION_SECONDS*1000]);
  const ids = await redisCommand<string[]>(c.redis,['ZRANGE',`${PREFIX}:index`,0,499]);
  if (!ids.length) return [];
  const rows = await redisCommand<(string|null)[]>(c.redis,['MGET',...ids.map(id=>`${PREFIX}:device:${id}`)]);
  return rows.flatMap(row=> { try { return row ? [JSON.parse(row) as StoredNativeRegistration] : []; } catch { return []; } });
}
export async function removeExpiredDevice(id: string) {
  const c = nativeStoreConfiguration(); if (!c) return;
  await redisCommand(c.redis,['DEL',`${PREFIX}:device:${id}`,`${PREFIX}:state:${id}`]);
  await redisCommand(c.redis,['ZREM',`${PREFIX}:index`,id]);
}
export async function readStates(id: string): Promise<Record<string, OfficialState>> {
  const c = nativeStoreConfiguration(); if (!c) return {};
  const value = await redisCommand<string|null>(c.redis,['GET',`${PREFIX}:state:${id}`]);
  return value ? JSON.parse(value) : {};
}
export async function saveStates(id: string, states: Record<string, OfficialState>) {
  const c = nativeStoreConfiguration(); if (c) await redisCommand(c.redis,['SET',`${PREFIX}:state:${id}`,JSON.stringify(states),'EX',RETENTION_SECONDS]);
}
export async function claimNativeKey(key: string, ttl: number): Promise<boolean> {
  const c = nativeStoreConfiguration(); if (!c) return false;
  return await redisCommand(c.redis,['SET',`${PREFIX}:claim:${key}`,'1','NX','EX',ttl]) === 'OK';
}

export async function allowNativeMutation(source: string): Promise<boolean> {
  const c = nativeStoreConfiguration(); if (!c) return false;
  const script = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 600) end; return n`;
  return await redisCommand<number>(c.redis,['EVAL',script,1,`${PREFIX}:rate:${source}`]) <= 30;
}

export async function acquireDispatchLease(): Promise<string | null> {
  const c=nativeStoreConfiguration(); if (!c) return null;
  const lease=randomUUID();
  return await redisCommand(c.redis,['SET',`${PREFIX}:dispatch-lease`,lease,'NX','EX',330]) === 'OK' ? lease : null;
}
export async function releaseDispatchLease(lease: string) {
  const c=nativeStoreConfiguration(); if (!c) return;
  await redisCommand(c.redis,['EVAL',"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",1,`${PREFIX}:dispatch-lease`,lease]);
}
