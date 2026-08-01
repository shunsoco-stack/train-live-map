import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const MAX_MUTATION_BODY_BYTES = 16 * 1024;

export type MutationRequestError = {
  ok: false;
  status: 400 | 403 | 413 | 415;
  message: string;
};

export type MutationRequestCheck = { ok: true } | MutationRequestError;

let warnedAboutReporterHashSalt = false;

function configuredOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    return new URL(
      candidate.includes("://") ? candidate : `https://${candidate}`,
    ).origin;
  } catch {
    return null;
  }
}

/** Deployment aliases accepted in addition to the host receiving the request. */
export function deploymentMutationOrigins(): string[] {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]
    .map(configuredOrigin)
    .filter((value): value is string => value !== null);
}

/**
 * Reject browser cross-site mutations and non-JSON bodies. Requests without
 * browser fetch metadata remain available to future native clients.
 */
export function validateMutationRequest(
  headers: Headers,
  requestUrl: URL,
  maxBytes = MAX_MUTATION_BODY_BYTES,
  additionalAllowedOrigins: readonly string[] = deploymentMutationOrigins(),
): MutationRequestCheck {
  const allowedOrigins = new Set([
    requestUrl.origin,
    ...additionalAllowedOrigins.map(configuredOrigin).filter(
      (value): value is string => value !== null,
    ),
  ]);
  const origin = headers.get("origin");
  if (origin) {
    try {
      if (!allowedOrigins.has(new URL(origin).origin)) {
        return {
          ok: false,
          status: 403,
          message: "別のサイトからの操作は受け付けられません。",
        };
      }
    } catch {
      return {
        ok: false,
        status: 403,
        message: "リクエスト元を確認できません。",
      };
    }
  } else {
    const referer = headers.get("referer");
    if (referer) {
      try {
        if (!allowedOrigins.has(new URL(referer).origin)) {
          return {
            ok: false,
            status: 403,
            message: "別のサイトからの操作は受け付けられません。",
          };
        }
      } catch {
        return {
          ok: false,
          status: 403,
          message: "リクエスト元を確認できません。",
        };
      }
    }
  }

  const fetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return {
      ok: false,
      status: 403,
      message: "別のサイトからの操作は受け付けられません。",
    };
  }

  const contentType = headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "application/json") {
    return {
      ok: false,
      status: 415,
      message: "JSON形式で送信してください。",
    };
  }

  const contentLength = headers.get("content-length");
  if (contentLength !== null) {
    const bytes = Number(contentLength);
    if (!Number.isInteger(bytes) || bytes < 0) {
      return {
        ok: false,
        status: 400,
        message: "本文サイズを確認できません。",
      };
    }
    if (bytes > maxBytes) {
      return {
        ok: false,
        status: 413,
        message: "送信内容が大きすぎます。",
      };
    }
  }

  return { ok: true };
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | MutationRequestError;

export async function readLimitedJsonBody(
  request: Request,
  maxBytes = MAX_MUTATION_BODY_BYTES,
): Promise<JsonBodyResult> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: "送信内容が大きすぎます。",
    };
  }
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return {
      ok: false,
      status: 400,
      message: "JSONの内容を確認してください。",
    };
  }
}

function normalizeIpCandidate(value: string): string | null {
  const candidate = value.trim();
  if (isIP(candidate)) return candidate;

  const bracketed = /^\[([^\]]+)](?::\d+)?$/.exec(candidate)?.[1];
  if (bracketed && isIP(bracketed)) return bracketed;

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(candidate)?.[1];
  return ipv4WithPort && isIP(ipv4WithPort) ? ipv4WithPort : null;
}

/** Prefer Vercel's platform-provided address, then the nearest proxy hop. */
export function clientAddress(headers: Headers): string | null {
  const vercelForwarded = headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const candidate = vercelForwarded.split(",", 1)[0];
    const normalized = normalizeIpCandidate(candidate);
    if (normalized) return normalized;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const normalized = normalizeIpCandidate(parts[parts.length - 1]);
    if (normalized) return normalized;
  }

  const realIp = headers.get("x-real-ip");
  return realIp ? normalizeIpCandidate(realIp) : null;
}

/**
 * A dedicated secret is preferred. Existing server-only credentials provide a
 * fail-safe key so deployments with persistent voting are protected immediately.
 */
export function abusePreventionSecret(): string {
  const preferred = process.env.REPORTER_HASH_SALT?.trim();
  if ((preferred?.length ?? 0) >= 32) return preferred!;

  if (!warnedAboutReporterHashSalt) {
    warnedAboutReporterHashSalt = true;
    console.warn(
      "[security] REPORTER_HASH_SALT is missing or shorter than 32 characters; using a server-only fallback.",
    );
  }

  const candidates = [
    process.env.COMMUNITY_REPORT_HMAC_SECRET,
    process.env.VAPID_PRIVATE_KEY,
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.KV_REST_API_TOKEN,
  ];
  const fallback = candidates
    .find((value) => (value?.trim().length ?? 0) >= 32)
    ?.trim();
  if (fallback) return fallback;

  // Last-resort compatibility fallback. It is never returned to clients or logs.
  // Production deployments should always configure REPORTER_HASH_SALT.
  return `train-live-map-pseudonym-fallback-v1:${process.env.VERCEL_PROJECT_ID ?? "local"}`;
}

export function pseudonymousHash(
  secret: string,
  namespace: string,
  value: string,
): string {
  return createHmac("sha256", secret)
    .update(`${namespace}\0${value}`)
    .digest("hex")
    .slice(0, 32);
}
