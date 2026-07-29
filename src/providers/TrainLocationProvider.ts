import type { ServiceStatus, TrainLocation } from "@/types/train";

/**
 * 列車位置・運行情報の取得元を抽象化するインターフェース。
 *
 * UI 層はこのインターフェースにのみ依存し、具体的な実装
 * (モック / GTFS-RT / JR東日本 API)には依存しない。
 * これにより、将来のデータソース差し替えを UI の変更なしに行える。
 */
export interface TrainLocationProvider {
  /** 現在の全列車位置を返す。 */
  getTrainLocations(): Promise<TrainLocation[]>;
  /** 路線全体の運行情報を返す。 */
  getServiceStatus(): Promise<ServiceStatus>;
  /** 利用可能な全路線の運行情報を返す。 */
  getServiceStatuses(): Promise<ServiceStatus[]>;
  /** このプロバイダがモックデータかどうか。UI 表示に使用。 */
  readonly isMock: boolean;
}
