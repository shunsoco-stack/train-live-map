import type { ServiceStatus, TrainLocation } from "@/types/train";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";

/**
 * GTFS-Realtime 接続用プロバイダの雛形(未実装)。
 *
 * 将来、公共交通オープンデータ等の GTFS-RT フィードに接続する際は、
 * ここで VehiclePositions / TripUpdates をパースして TrainLocation へ
 * 変換する。UI 側は TrainLocationProvider にのみ依存しているため、
 * services 層でこのクラスに差し替えるだけで実データに移行できる。
 */
export class GtfsRealtimeProvider implements TrainLocationProvider {
  public readonly isMock = false;

  constructor(private readonly feedUrl: string) {}

  async getTrainLocations(): Promise<TrainLocation[]> {
    // TODO: this.feedUrl から protobuf を取得し TrainLocation[] に変換する
    throw new Error(`GtfsRealtimeProvider は未実装です (feed: ${this.feedUrl})`);
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    throw new Error("GtfsRealtimeProvider は未実装です");
  }
}
