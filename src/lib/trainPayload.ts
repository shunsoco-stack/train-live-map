import { RAILWAY_CATALOG } from "../data/railwayCatalog.ts";
import type {
  RailwayFilterOption,
  RailwayMapLine,
} from "../types/railway.ts";
import type {
  TrainLocation,
  TrainLocationPayload,
} from "../types/train.ts";

const COORDINATE_SCALE = 1_000_000;
const UNKNOWN_LINE_COLOR = "#64748b";

/** 約0.1mの精度を保ちつつ、定期取得するJSONの桁数を抑える。 */
export function roundTrainCoordinate(value: number): number {
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE;
}

/**
 * Providerが返すドメインモデルをAPI転送用DTOへ変換する。
 * Provider内部の値は変更せず、JSON境界だけで座標を丸める。
 */
export function serializeTrainLocation(
  train: TrainLocation,
): TrainLocationPayload {
  return {
    id: train.id,
    lineId: train.lineId,
    trainNumber: train.trainNumber,
    directionKind: train.directionKind,
    directionLabel: train.directionLabel,
    destination: train.destination,
    trainType: train.trainType,
    latitude: roundTrainCoordinate(train.latitude),
    longitude: roundTrainCoordinate(train.longitude),
    delayMinutes: train.delayMinutes,
    speedKmh: train.speedKmh,
    status: train.status,
    lastUpdatedAt: train.lastUpdatedAt,
    stoppedSince: train.stoppedSince,
    dataAccuracy: train.dataAccuracy,
    routeSegment: train.routeSegment
      ? {
          fromFraction: train.routeSegment.fromFraction,
          toFraction: train.routeSegment.toFraction,
          coordinates: train.routeSegment.coordinates?.map(
            ([longitude, latitude]) => [
              roundTrainCoordinate(longitude),
              roundTrainCoordinate(latitude),
            ],
          ),
        }
      : null,
  };
}

/**
 * `/api/railways` の表示情報を転送用DTOへ戻し、既存UI向けのドメイン型を復元する。
 * ODPT由来の路線情報、APIの選択肢、固定カタログの順で優先する。
 */
export function restoreTrainLocations(
  trains: readonly TrainLocationPayload[],
  railwayLines: readonly RailwayMapLine[],
  railwayOptions: readonly RailwayFilterOption[],
): TrainLocation[] {
  const presentationByLineId = new Map<
    string,
    { name: string; color: string }
  >();

  for (const catalog of RAILWAY_CATALOG) {
    presentationByLineId.set(catalog.id, {
      name: catalog.name,
      color: catalog.color,
    });
  }
  for (const option of railwayOptions) {
    presentationByLineId.set(option.id, {
      name: option.name,
      color: option.color,
    });
  }
  for (const line of railwayLines) {
    presentationByLineId.set(line.id, {
      name: line.name,
      color: line.color,
    });
  }

  return trains.map((train) => {
    const presentation = presentationByLineId.get(train.lineId);
    return {
      ...train,
      lineName: presentation?.name ?? train.lineId,
      lineColor: presentation?.color ?? UNKNOWN_LINE_COLOR,
    };
  });
}
