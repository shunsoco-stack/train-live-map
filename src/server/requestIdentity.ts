import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createLogger } from "../lib/logger.ts";

export const FALLBACK_REPORTER_HASH_SALT = "train-live-map:v1:";

const log = createLogger("request-identity");

export function resolveReporterHashSalt(
  configuredValue: string | undefined,
  warn: () => void = () => undefined,
): string {
  const configured = configuredValue?.trim();
  if (configured) return configured;
  warn();
  return FALLBACK_REPORTER_HASH_SALT;
}

export const REPORTER_HASH_SALT = resolveReporterHashSalt(
  process.env.REPORTER_HASH_SALT,
  () => {
    log.warn(
      "REPORTER_HASH_SALTが未設定のため既定値を使用します。本番環境では必ず設定してください。",
    );
  },
);

/** Vercelが付与するX-Forwarded-Forの先頭にある有効なIPだけを採用する。 */
export function extractForwardedIp(
  forwardedFor: string | null,
): string | null {
  const first = forwardedFor?.split(",", 1)[0]?.trim() ?? "";
  return isIP(first) === 0 ? null : first.toLowerCase();
}

export function hashCommunityReporter(
  reporterId: string,
  salt = REPORTER_HASH_SALT,
): string {
  return createHash("sha256")
    .update(`${salt}${reporterId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * 生IPを保存せず、IPが取得できない場合も全リクエストで同じ共有枠に入れる。
 */
export function hashReporterIp(
  ip: string | null,
  salt = REPORTER_HASH_SALT,
): string {
  return createHash("sha256")
    .update(`${salt}ip:${ip ?? "missing-forwarded-ip"}`)
    .digest("hex");
}
