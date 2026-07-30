import {
  safeReadStorage,
  safeWriteStorage,
  type StorageLike,
} from "./browserGuidance.ts";

export const REPORTER_STORAGE_KEY =
  "train-live-map:community-reporter-v1";
export const REPORTER_ID_PATTERN = /^[A-Za-z0-9_-]{12,100}$/;
export const COMMUNITY_REPORT_SUCCESS_DURATION_MS = 5_000;

export interface ReporterIdentity {
  reporterId: string | null;
  persistent: boolean;
}

export function resolveReporterIdentity(
  storage: StorageLike | null | undefined,
  createId: () => string,
): ReporterIdentity {
  const stored = safeReadStorage(storage, REPORTER_STORAGE_KEY);
  if (stored && REPORTER_ID_PATTERN.test(stored)) {
    return { reporterId: stored, persistent: true };
  }

  let created: string;
  try {
    created = createId();
  } catch {
    return { reporterId: null, persistent: false };
  }
  if (!REPORTER_ID_PATTERN.test(created)) {
    return { reporterId: null, persistent: false };
  }
  if (
    !safeWriteStorage(storage, REPORTER_STORAGE_KEY, created) ||
    safeReadStorage(storage, REPORTER_STORAGE_KEY) !== created
  ) {
    return { reporterId: null, persistent: false };
  }
  return { reporterId: created, persistent: true };
}

export function remainingVoteCooldownSeconds(
  lastVotedAt: number | null | undefined,
  cooldownSeconds: number,
  now: number,
): number {
  if (
    lastVotedAt == null ||
    !Number.isFinite(lastVotedAt) ||
    !Number.isFinite(cooldownSeconds) ||
    cooldownSeconds <= 0
  ) {
    return 0;
  }
  const elapsedMs = Math.max(0, now - lastVotedAt);
  const remainingMs = cooldownSeconds * 1_000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1_000));
}
