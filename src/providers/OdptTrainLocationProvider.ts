import type { ServiceStatus, TrainLocation } from "@/types/train";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { getOdptConfig, isOdptConfigured, type OdptConfig } from "@/lib/odpt/config";
import { fetchOdptTrainInformation, fetchOdptTrains } from "@/lib/odpt/api";
import {
  defaultRailwayLabel,
  odptInformationToServiceStatus,
  odptTrainsToTrainLocations,
} from "@/lib/odpt/mapper";
import { createLogger } from "@/lib/logger";

/**
 * ODPT(公共交通オープンデータセンター)から列車位置・運行情報を取得する実装。
 *
 * odpt:Train / odpt:TrainInformation を取得し、mapper で TrainLocation /
 * ServiceStatus へ変換する。緯度経度が無い場合は駅間から推定位置を算出する。
 * 取得失敗時は例外を投げ、サービス層がモックへフォールバックする。
 */
export class OdptTrainLocationProvider implements TrainLocationProvider {
  public readonly isMock = false;

  private readonly log = createLogger("odpt.provider");

  constructor(private readonly config: OdptConfig = getOdptConfig()) {}

  /** 利用可能か(トークン設定済みか)。 */
  isAvailable(): boolean {
    return isOdptConfigured(this.config);
  }

  async getTrainLocations(): Promise<TrainLocation[]> {
    const { data, durationMs } = await fetchOdptTrains(this.config.railway, this.config);
    const trains = odptTrainsToTrainLocations(data);
    this.log.info("列車位置を変換", {
      raw: data.length,
      mapped: trains.length,
      durationMs,
    });
    return trains;
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    const { data, durationMs } = await fetchOdptTrainInformation(
      this.config.railway,
      this.config,
    );
    const status = odptInformationToServiceStatus(data, defaultRailwayLabel());
    this.log.info("運行情報を変換", { raw: data.length, durationMs, severity: status.severity });
    return status;
  }
}
