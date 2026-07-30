/**
 * 時刻処理はすべてこのモジュールに集約する。
 * (要件: 時刻処理を関数化する)
 */

/** ISO8601 文字列を Date に変換。不正な場合は null。 */
export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 2 時刻の差分(秒)を求める。from が null の場合は null。
 * now を渡さなければ現在時刻を使う。
 */
export function elapsedSeconds(fromIso: string | null, now: Date = new Date()): number | null {
  const from = parseIso(fromIso);
  if (!from) return null;
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
}

/**
 * API応答を受信した端末時刻と、サーバーの生成時刻との差を求める。
 * 端末時計が進んでいる場合は正数、遅れている場合は負数になる。
 */
export function calculateServerClockOffsetMs(
  clientReceivedAtMs: number,
  generatedAt: string,
): number | null {
  const serverGeneratedAtMs = Date.parse(generatedAt);
  if (
    !Number.isFinite(clientReceivedAtMs) ||
    Number.isNaN(serverGeneratedAtMs)
  ) {
    return null;
  }
  return clientReceivedAtMs - serverGeneratedAtMs;
}

/** 端末時刻からサーバーとの差を引き、鮮度判定用の基準時刻へ補正する。 */
export function applyServerClockOffset(
  clientNow: Date,
  serverClockOffsetMs: number,
): Date {
  const offset = Number.isFinite(serverClockOffsetMs)
    ? serverClockOffsetMs
    : 0;
  return new Date(clientNow.getTime() - offset);
}

/**
 * 秒数を「12分05秒」「42秒」「1時間03分」形式の日本語文字列にする。
 * 停止時間表示に使用。
 */
export function formatDurationJa(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) {
    return `${hours}時間${String(minutes).padStart(2, "0")}分`;
  }
  if (minutes > 0) {
    return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
  }
  return `${seconds}秒`;
}

/** 時刻を「HH:MM:SS」表記(24時間・日本ロケール)にする。 */
export function formatTimeJa(iso: string | null, now?: Date): string {
  const d = iso ? parseIso(iso) : (now ?? new Date());
  if (!d) return "--:--:--";
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** 現在時刻の ISO8601 文字列を返す。 */
export function nowIso(): string {
  return new Date().toISOString();
}
