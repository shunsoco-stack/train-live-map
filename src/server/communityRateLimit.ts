export function communityRateLimitKey(
  reporterHash: string,
  lineId: string,
): string {
  return `${reporterHash}:${lineId}`;
}

export function claimMemoryRateLimit(
  rateLimits: Map<string, number>,
  reporterHash: string,
  lineId: string,
  cooldownMs: number,
  now = Date.now(),
): boolean {
  const key = communityRateLimitKey(reporterHash, lineId);
  const expiresAt = rateLimits.get(key) ?? 0;
  if (expiresAt > now) return false;
  rateLimits.set(key, now + cooldownMs);
  return true;
}

export function releaseMemoryRateLimit(
  rateLimits: Map<string, number>,
  reporterHash: string,
  lineId: string,
): boolean {
  return rateLimits.delete(communityRateLimitKey(reporterHash, lineId));
}
