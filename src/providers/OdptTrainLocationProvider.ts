import type { ServiceStatus, TrainLocation } from "@/types/train";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { getOdptConfig, isOdptConfigured, type OdptConfig } from "@/lib/odpt/config";
import {
  fetchOdptTrainInformationForOperator,
  fetchOdptTrainsForOperator,
} from "@/lib/odpt/api";
import {
  odptInformationToServiceStatus,
  odptTrainsToNetworkTrainLocations,
} from "@/lib/odpt/mapper";
import { getOdptNetworkContext } from "@/lib/odpt/network";
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
    const [{ data, durationMs }, network] = await Promise.all([
      fetchOdptTrainsForOperator(this.config.operator, this.config),
      getOdptNetworkContext(this.config),
    ]);
    const trains = odptTrainsToNetworkTrainLocations(data, network);
    this.log.info("列車位置を変換", {
      raw: data.length,
      mapped: trains.length,
      lines: new Set(trains.map((train) => train.lineId)).size,
      durationMs,
    });
    return trains;
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    const statuses = await this.getServiceStatuses();
    const status =
      statuses.find((item) => item.lineId === "tokaido") ?? statuses[0];
    if (!status) throw new Error("利用可能な路線の運行情報がありません");
    return status;
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    const [{ data, durationMs }, network] = await Promise.all([
      fetchOdptTrainInformationForOperator(
        this.config.operator,
        this.config,
      ),
      getOdptNetworkContext(this.config),
    ]);

    const statuses = network.response.lines.map((line) => {
      const information = data.filter(
        (item) => item["odpt:railway"] === line.odptId,
      );
      return odptInformationToServiceStatus(
        information,
        line.name,
        line.id,
      );
    });

    this.log.info("全路線の運行情報を変換", {
      raw: data.length,
      mapped: statuses.length,
      disrupted: statuses.filter((item) => item.severity !== "normal")
        .length,
      durationMs,
    });
    return statuses;
  }
}
