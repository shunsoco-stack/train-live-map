export interface MutationOriginInput {
  requestOrigin: string;
  originHeader: string | null;
  refererHeader: string | null;
  vercelUrl?: string;
}

function normalizedOrigin(value: string, defaultProtocol?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      defaultProtocol && !/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
        ? `${defaultProtocol}://${trimmed}`
        : trimmed,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * 状態を変更するAPIは、ブラウザが送るOrigin（無い場合はReferer）が
 * 自身またはVercelプレビューのオリジンと一致する場合だけ許可する。
 */
export function isAllowedMutationOrigin({
  requestOrigin,
  originHeader,
  refererHeader,
  vercelUrl,
}: MutationOriginInput): boolean {
  const ownOrigin = normalizedOrigin(requestOrigin);
  if (!ownOrigin) return false;

  const allowedOrigins = new Set([ownOrigin]);
  if (vercelUrl) {
    const previewOrigin = normalizedOrigin(vercelUrl, "https");
    if (previewOrigin) allowedOrigins.add(previewOrigin);
  }

  const presentedOrigin = originHeader?.trim()
    ? normalizedOrigin(originHeader)
    : refererHeader?.trim()
      ? normalizedOrigin(refererHeader)
      : null;

  return presentedOrigin !== null && allowedOrigins.has(presentedOrigin);
}
