/**
 * 軽量な構造化ロガー。
 *
 * データ取得の開始・終了・所要時間・HTTP エラー・JSON 解析エラー・
 * プロバイダ切替などを一貫した形式で記録する。
 * サーバー(Route Handler / サービス層)での利用を想定。
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  const time = new Date().toISOString();
  const base = `[${time}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const payload = fields ? { ...fields } : undefined;

  // 開発時は見やすさ優先、本番でも stdout に残す
  switch (level) {
    case "error":
      console.error(base, payload ?? "");
      break;
    case "warn":
      console.warn(base, payload ?? "");
      break;
    default:
      console.log(base, payload ?? "");
      break;
  }
}

/** スコープ付きロガーを生成する。 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: LogFields) => emit("debug", scope, message, fields),
    info: (message: string, fields?: LogFields) => emit("info", scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit("warn", scope, message, fields),
    error: (message: string, fields?: LogFields) => emit("error", scope, message, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;
