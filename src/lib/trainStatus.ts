import type { DataAccuracy, TrainLocation, TrainStatus, TrainType } from "@/types/train";
import { elapsedSeconds } from "./time.ts";

/**
 * 列車の見た目(色・ラベル・重要度)を決めるためのロジック。
 * 色だけに依存しないよう、ラベル・記号も併せて提供する。
 */

export type StatusLevel = "running" | "warn" | "danger" | "suspended" | "unknown";

export interface StatusAppearance {
  level: StatusLevel;
  /** マーカー背景色(HEX) */
  color: string;
  /** 縁取り色 */
  ring: string;
  /** 日本語ラベル */
  label: string;
  /** 記号(色覚に依存しない識別用) */
  symbol: string;
}

const APPEARANCE: Record<StatusLevel, Omit<StatusAppearance, "level">> = {
  running: { color: "#f68b1e", ring: "#7c2d12", label: "走行中", symbol: "▶" },
  warn: { color: "#eab308", ring: "#713f12", label: "停止(注意)", symbol: "‖" },
  danger: { color: "#ef4444", ring: "#7f1d1d", label: "停止(長時間)", symbol: "■" },
  suspended: { color: "#111827", ring: "#ef4444", label: "運転見合わせ", symbol: "✕" },
  unknown: { color: "#6b7280", ring: "#374151", label: "不明", symbol: "？" },
};

/**
 * ODPT実測では更新直後でも60〜80秒、末尾は5〜10分程度のばらつきがある。
 * 90秒で全列車が周期的に不明になる誤判定を避けるため、まず300秒とする。
 */
export const STALE_THRESHOLD_SECONDS = 300;

/**
 * 列車の状態と停止経過時間から表示レベルを決める。
 * - running / delayed: 緑(走行中)
 * - stopped 1分以上: 黄 / 5分以上: 赤
 * - suspended: 濃い赤・黒
 * - unknown またはデータが古い: グレー
 */
export function resolveStatusLevel(train: TrainLocation, now: Date = new Date()): StatusLevel {
  if (train.status === "suspended") return "suspended";
  if (train.status === "unknown") return "unknown";

  // 呼び出し側から、API生成時刻を基準に補正した now が渡される前提。
  const sinceUpdate = elapsedSeconds(train.lastUpdatedAt, now);
  if (
    sinceUpdate !== null &&
    sinceUpdate > STALE_THRESHOLD_SECONDS
  ) {
    return "unknown";
  }

  if (train.status === "stopped") {
    const stoppedFor = elapsedSeconds(train.stoppedSince, now) ?? 0;
    if (stoppedFor >= 5 * 60) return "danger";
    if (stoppedFor >= 60) return "warn";
    // 停止直後(1分未満)は注意色までは出さないが、走行中でもないので warn 手前として warn を使う
    return "warn";
  }

  // running / delayed は走行中扱い(緑)。遅延は詳細で示す。
  return "running";
}

export function getStatusAppearance(train: TrainLocation, now: Date = new Date()): StatusAppearance {
  const level = resolveStatusLevel(train, now);
  return { level, ...APPEARANCE[level] };
}

/** フィルターのカテゴリ判定に使う、状態の大分類。 */
export function matchesFilter(
  train: TrainLocation,
  filter: TrainFilterKey,
  now: Date = new Date(),
): boolean {
  if (filter === "all") return true;
  const level = resolveStatusLevel(train, now);
  const isStale = level === "unknown";
  if (filter === "stale") return isStale;
  if (isStale) return false;

  const hasDelay = train.delayMinutes >= 1;
  return filter === "delayed" ? hasDelay : !hasDelay;
}

export type TrainFilterKey = "all" | "on-time" | "delayed" | "stale";

export const TRAIN_FILTERS: { key: TrainFilterKey; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "on-time", label: "遅延なし" },
  { key: "delayed", label: "遅延あり" },
  { key: "stale", label: "情報が古い" },
];

/** 状態の日本語表記(詳細パネル用)。 */
export function statusLabelJa(status: TrainStatus): string {
  switch (status) {
    case "running":
      return "走行中";
    case "stopped":
      return "停止中";
    case "delayed":
      return "遅延";
    case "suspended":
      return "運転見合わせ";
    case "unknown":
    default:
      return "不明";
  }
}

/** 列車種別の日本語表記。 */
export function trainTypeLabelJa(type: TrainType): string {
  switch (type) {
    case "rapid":
      return "快速";
    case "special_rapid":
      return "特別快速";
    case "local":
    default:
      return "普通";
  }
}

/** データ精度の日本語表記。 */
export function dataAccuracyLabelJa(accuracy: DataAccuracy): string {
  switch (accuracy) {
    case "actual":
      return "実測";
    case "estimated":
      return "推定";
    case "mock":
    default:
      return "モック";
  }
}

/** 速度を、実測値と推定値を混同しない日本語表記へ変換する。 */
export function speedLabelJa(
  speedKmh: number,
  dataAccuracy: DataAccuracy,
): string {
  if (speedKmh === 0) return "停車中";
  return dataAccuracy === "actual"
    ? `${speedKmh} km/h`
    : `約${speedKmh} km/h（推定）`;
}
