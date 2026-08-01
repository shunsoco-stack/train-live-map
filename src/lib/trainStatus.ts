import type { DataAccuracy, TrainLocation, TrainStatus, TrainType } from "../types/train.ts";
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
 * 列車の状態と停止経過時間から表示レベルを決める。
 * - running / delayed: 緑(走行中)
 * - stopped 1分以上: 黄 / 5分以上: 赤
 * - suspended: 濃い赤・黒
 * - unknown またはデータが古い: グレー
 */
export function resolveStatusLevel(train: TrainLocation, now: Date = new Date()): StatusLevel {
  if (train.status === "suspended") return "suspended";
  if (train.status === "unknown") return "unknown";

  // データが古い(90秒以上更新なし)場合は不明扱い
  const sinceUpdate = elapsedSeconds(train.lastUpdatedAt, now);
  if (sinceUpdate !== null && sinceUpdate > 90) return "unknown";

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
  switch (filter) {
    case "running":
      return level === "running";
    case "stopped":
      return level === "warn" || level === "danger";
    case "delayed":
      return train.delayMinutes > 0 && train.status !== "suspended";
    case "suspended":
      return level === "suspended";
    default:
      return true;
  }
}

export type TrainFilterKey = "all" | "running" | "stopped" | "delayed" | "suspended";

export const TRAIN_FILTERS: { key: TrainFilterKey; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "running", label: "走行中" },
  { key: "stopped", label: "停止中" },
  { key: "delayed", label: "遅延" },
  { key: "suspended", label: "運転見合わせ" },
];

/** 1回の走査でフィルター別件数を集計する。遅延は走行中とも重複し得る。 */
export function countTrainsByFilter(
  trains: readonly TrainLocation[],
  now: Date = new Date(),
): Record<TrainFilterKey, number> {
  const counts: Record<TrainFilterKey, number> = {
    all: 0,
    running: 0,
    stopped: 0,
    delayed: 0,
    suspended: 0,
  };
  for (const train of trains) {
    counts.all += 1;
    const level = resolveStatusLevel(train, now);
    if (level === "running") counts.running += 1;
    if (level === "warn" || level === "danger") counts.stopped += 1;
    if (train.delayMinutes > 0 && train.status !== "suspended") {
      counts.delayed += 1;
    }
    if (level === "suspended") counts.suspended += 1;
  }
  return counts;
}

/** 凡例UIが状態定義を二重管理しないための表示用データ。 */
export const TRAIN_STATUS_LEGEND = (
  ["running", "warn", "danger", "suspended", "unknown"] as const
).map((level) => {
  const filterKey =
    level === "warn" || level === "danger" ? "stopped" : level;
  const filterLabel = TRAIN_FILTERS.find((filter) => filter.key === filterKey)?.label;
  const appearance = APPEARANCE[level];
  return {
    level,
    ...appearance,
    label:
      level === "warn"
        ? `${filterLabel ?? appearance.label}（注意）`
        : level === "danger"
          ? `${filterLabel ?? appearance.label}（長時間）`
          : filterLabel ?? appearance.label,
  };
});

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
