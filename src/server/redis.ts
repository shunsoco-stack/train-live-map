export interface RedisConfiguration {
  url: string;
  token: string;
}

interface RedisResponse<T> {
  result: T;
}

export function redisConfiguration(): RedisConfiguration | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export async function redisCommand<T>(
  config: RedisConfiguration,
  command: Array<string | number>,
): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Redis request failed (${response.status})`);
  }
  const data = (await response.json()) as RedisResponse<T>;
  return data.result;
}
