/**
 * 列車位置・運行情報に関する型定義。
 * データ取得元(モック / GTFS-RT / JR東日本 API)に依存しない共通のドメイン型。
 */

import type { LngLat } from "@/types/geo";

/** 列車の走行方向 */
export type TrainDirection = "inbound" | "outbound";
// inbound = 上り(東京方面) / outbound = 下り(横浜・熱海方面)

/** 列車の状態 */
export type TrainStatus =
  | "running" // 通常走行中
  | "stopped" // 駅間などで停止中
  | "delayed" // 遅延あり(走行中)
  | "suspended" // 運転見合わせ
  | "unknown"; // データ不明・古い

/** 位置情報の精度 */
export type DataAccuracy =
  | "actual" // 実測(将来の実データ用)
  | "estimated" // 推定
  | "mock"; // モックデータ

/** 列車種別 */
export type TrainType = "local" | "rapid" | "special_rapid";
// local=普通 / rapid=快速 / special_rapid=特別快速

/** ODPT が示す現在の駅間を、路線全体の fraction(0〜1)で表した範囲。 */
export interface RouteSegmentEstimate {
  fromFraction: number;
  toFraction: number;
  /**
   * 路線全体の固定ジオメトリを使わない路線向けの駅間線形。
   * 未指定の場合は既存の東海道線ジオメトリを使用する。
   */
  coordinates?: LngLat[];
}

/** 1編成の列車位置情報 */
export interface TrainLocation {
  id: string;
  /** アプリ内で一意な路線ID */
  lineId: string;
  lineName: string;
  lineColor: string;
  trainNumber: string;
  direction: TrainDirection;
  destination: string;
  trainType: TrainType;
  latitude: number;
  longitude: number;
  delayMinutes: number;
  speedKmh: number;
  status: TrainStatus;
  /** ISO8601 文字列。最終更新時刻 */
  lastUpdatedAt: string;
  /** ISO8601 文字列。停止し始めた時刻。停止していない場合は null */
  stoppedSince: string | null;
  dataAccuracy: DataAccuracy;
  /** 推定アニメーションが越えてはいけない現在の駅間。 */
  routeSegment: RouteSegmentEstimate | null;
}

/** 路線全体の運行情報 */
export interface ServiceStatus {
  /** アプリ内で一意な路線ID */
  lineId: string;
  lineName: string;
  /** 運行状況の概況(平常運転 / 一部遅延 / 運転見合わせ など) */
  severity: "normal" | "minor" | "major";
  message: string;
  /** ISO8601 文字列 */
  updatedAt: string;
  dataAccuracy: DataAccuracy;
}

/** データ取得元の種別 */
export type ProviderSource = "odpt" | "mock";

/** API /api/trains のレスポンス形式 */
export interface TrainsApiResponse {
  trains: TrainLocation[];
  /** ISO8601 文字列。サーバー側での生成時刻 */
  generatedAt: string;
  /** ISO8601 文字列。表示中データの dc:date のうち最新の時刻。 */
  dataUpdatedAt: string;
  isMock: boolean;
  /** 実際に使われたデータ取得元 */
  source: ProviderSource;
  /** 実データ失敗によるモックフォールバックか */
  fallback: boolean;
  /** UI に表示する注意書き(モック表示中など)。不要なら null。 */
  notice: string | null;
}

/** API /api/service-status のレスポンス形式 */
export interface ServiceStatusApiResponse {
  serviceStatus: ServiceStatus;
  /** 利用可能な全路線の運行情報。旧クライアント向けにserviceStatusも残す。 */
  serviceStatuses?: ServiceStatus[];
  isMock: boolean;
  source: ProviderSource;
  fallback: boolean;
  notice: string | null;
}
