import type { ServiceStatus, TrainLocation } from "@/types/train";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import {
  getOdptConfig,
  isOdptConfigured,
  JR_EAST_TRAIN_INFORMATION_OPERATOR,
  type OdptConfig,
} from "@/lib/odpt/config";
import {
  fetchOdptTrainInformationForOperator,
  fetchOdptTrainsForOperator,
} from "@/lib/odpt/api";
import { serviceStatusWithTrainDelayFallback } from "@/lib/serviceStatus";
import {
  odptInformationToServiceStatus,
  odptTrainsToNetworkTrainLocations,
} from "@/lib/odpt/mapper";
import { getOdptNetworkContext } from "@/lib/odpt/network";
import { createLogger } from "@/lib/logger";
import {
  applyFullSuspensionsToTrains,
  trainInformationRailwayIds,
  withJrEastStatusSource,
} from "@/lib/jrEast/serviceStatus";
import type { OdptTrainInformation } from "@/lib/odpt/types";
import type { OdptNetworkContext } from "@/lib/odpt/network";

function mapNetworkServiceStatuses(
  informationData: OdptTrainInformation[],
  trains: TrainLocation[],
  network: OdptNetworkContext,
  officialInformationAvailable: boolean,
): ServiceStatus[] {
  return network.response.lines.map((line) => {
    const information = informationData.filter((item) =>
      trainInformationRailwayIds(item).includes(line.odptId),
    );
    const status = serviceStatusWithTrainDelayFallback(
      odptInformationToServiceStatus(information, line.name, line.id),
      trains,
    );
    return officialInformationAvailable
      ? withJrEastStatusSource(status)
      : status;
  });
}

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
    const [{ data, durationMs }, network, informationResult] = await Promise.all([
      fetchOdptTrainsForOperator(this.config.operator, this.config),
      getOdptNetworkContext(this.config),
      this.getOfficialInformation(),
    ]);
    const mappedTrains = odptTrainsToNetworkTrainLocations(data, network);
    const statuses = mapNetworkServiceStatuses(
      informationResult.data,
      mappedTrains,
      network,
      informationResult.available,
    );
    const trains = applyFullSuspensionsToTrains(
      mappedTrains,
      statuses,
    );
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
    const [
      { data: trainData },
      network,
      informationResult,
    ] = await Promise.all([
      fetchOdptTrainsForOperator(this.config.operator, this.config),
      getOdptNetworkContext(this.config),
      this.getOfficialInformation(),
    ]);
    const trains = odptTrainsToNetworkTrainLocations(trainData, network);
    const statuses = mapNetworkServiceStatuses(
      informationResult.data,
      trains,
      network,
      informationResult.available,
    );

    this.log.info("全路線の運行情報を変換", {
      raw: informationResult.data.length,
      trainRaw: trainData.length,
      mapped: statuses.length,
      disrupted: statuses.filter((item) => item.severity !== "normal")
        .length,
      durationMs: informationResult.durationMs,
      officialInformationAvailable: informationResult.available,
    });
    return statuses;
  }

  private async getOfficialInformation(): Promise<{
    data: OdptTrainInformation[];
    durationMs: number;
    available: boolean;
  }> {
    try {
      const result = await fetchOdptTrainInformationForOperator(
        JR_EAST_TRAIN_INFORMATION_OPERATOR,
        this.config,
      );
      return { ...result, available: true };
    } catch (error) {
      this.log.warn("JR東日本アイステイションズ運行情報の取得に失敗", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { data: [], durationMs: 0, available: false };
    }
  }
}
