import { createHash, randomUUID } from "node:crypto";
import {
  redisCommand,
  redisConfiguration,
  type RedisConfiguration,
} from "./redis.ts";

const IP_RATE_LIMIT_PREFIX = "train-live-map:ip-rate:v1";
const RELEASE_IF_OWNED_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export interface IpRateLimitInput {
  scope: string;
  ipHash: string;
  discriminator?: string;
  limit: number;
  windowSeconds: number;
}

export interface IpRateLimitClaim {
  allowed: true;
  persistent: boolean;
  storageKey: string;
  token: string;
}

export interface IpRateLimitDenied {
  allowed: false;
}

export type IpRateLimitResult =
  | IpRateLimitClaim
  | IpRateLimitDenied;

interface MemorySlot {
  expiresAt: number;
  token: string;
}

export interface MemoryIpRateLimitState {
  slots: Map<string, MemorySlot>;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapIpRateLimits?: MemoryIpRateLimitState;
};

export function createMemoryIpRateLimitState(): MemoryIpRateLimitState {
  return { slots: new Map() };
}

function memoryState(): MemoryIpRateLimitState {
  if (!memoryGlobal.__trainLiveMapIpRateLimits) {
    memoryGlobal.__trainLiveMapIpRateLimits =
      createMemoryIpRateLimitState();
  }
  return memoryGlobal.__trainLiveMapIpRateLimits;
}

function validateInput(input: IpRateLimitInput): void {
  if (!/^[a-z0-9-]{1,64}$/.test(input.scope)) {
    throw new Error("IP rate-limit scope is invalid");
  }
  if (
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 100 ||
    !Number.isSafeInteger(input.windowSeconds) ||
    input.windowSeconds < 1
  ) {
    throw new Error("IP rate-limit configuration is invalid");
  }
}

export function ipRateLimitStorageKey(
  input: IpRateLimitInput,
): string {
  validateInput(input);
  const identity = createHash("sha256")
    .update(`${input.ipHash}\0${input.discriminator ?? ""}`)
    .digest("hex")
    .slice(0, 32);
  return `${IP_RATE_LIMIT_PREFIX}:${input.scope}:${identity}`;
}

export function claimMemoryIpRateLimit(
  state: MemoryIpRateLimitState,
  input: IpRateLimitInput,
  now: number,
  token: string,
): IpRateLimitResult {
  const baseKey = ipRateLimitStorageKey(input);

  for (let slot = 0; slot < input.limit; slot += 1) {
    const storageKey = `${baseKey}:${slot}`;
    const current = state.slots.get(storageKey);
    if (current && current.expiresAt > now) continue;

    state.slots.set(storageKey, {
      expiresAt: now + input.windowSeconds * 1000,
      token,
    });
    return {
      allowed: true,
      persistent: false,
      storageKey,
      token,
    };
  }

  return { allowed: false };
}

export function releaseMemoryIpRateLimit(
  state: MemoryIpRateLimitState,
  claim: IpRateLimitClaim,
): boolean {
  const current = state.slots.get(claim.storageKey);
  if (!current || current.token !== claim.token) return false;
  return state.slots.delete(claim.storageKey);
}

async function claimRedisIpRateLimit(
  config: RedisConfiguration,
  input: IpRateLimitInput,
  token: string,
): Promise<IpRateLimitResult> {
  const baseKey = ipRateLimitStorageKey(input);

  for (let slot = 0; slot < input.limit; slot += 1) {
    const storageKey = `${baseKey}:${slot}`;
    const result = await redisCommand<string | null>(config, [
      "SET",
      storageKey,
      token,
      "NX",
      "EX",
      input.windowSeconds,
    ]);
    if (result === "OK") {
      return {
        allowed: true,
        persistent: true,
        storageKey,
        token,
      };
    }
  }

  return { allowed: false };
}

export async function claimIpRateLimit(
  input: IpRateLimitInput,
): Promise<IpRateLimitResult> {
  const token = randomUUID();
  const config = redisConfiguration();
  return config
    ? claimRedisIpRateLimit(config, input, token)
    : claimMemoryIpRateLimit(
        memoryState(),
        input,
        Date.now(),
        token,
      );
}

export async function releaseIpRateLimit(
  claim: IpRateLimitClaim,
): Promise<void> {
  if (!claim.persistent) {
    releaseMemoryIpRateLimit(memoryState(), claim);
    return;
  }

  const config = redisConfiguration();
  if (!config) {
    throw new Error("Redis configuration is unavailable");
  }
  await redisCommand<number>(config, [
    "EVAL",
    RELEASE_IF_OWNED_SCRIPT,
    1,
    claim.storageKey,
    claim.token,
  ]);
}
