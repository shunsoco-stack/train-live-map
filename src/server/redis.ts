export interface RedisConfiguration {
  url: string;
  token: string;
}

interface RedisResponse<T> {
  result: T;
}

export const REDIS_COMMAND_TIMEOUT_MS = 4_000;

export class RedisCommandError extends Error {
  override name = "RedisCommandError";
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
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new RedisCommandError("Redisへのリクエストに失敗しました");
    }
    try {
      const data = (await response.json()) as RedisResponse<T>;
      return data.result;
    } catch (error) {
      throw new RedisCommandError(
        "Redisからの応答を読み取れませんでした",
        { cause: error },
      );
    }
  } catch (error) {
    if (error instanceof RedisCommandError) throw error;
    throw new RedisCommandError(
      timedOut
        ? "Redisへの接続がタイムアウトしました"
        : "Redisへ接続できませんでした",
    );
  } finally {
    clearTimeout(timeout);
  }
}
