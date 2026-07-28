import type {
  DataAccuracy,
  ServiceStatus,
  TrainLocation,
  TrainType,
} from "@/types/train";
import type { OdptTrain, OdptTrainInformation } from "@/lib/odpt/types";
import type { OdptNetworkContext } from "@/lib/odpt/network";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { getStationById, STATIONS } from "@/data/stations";
import {
  coordinateBetweenStations,
  stationFractionById,
} from "@/lib/routeGeometry";
import { inferTokaidoDirection } from "@/lib/odpt/direction";

/**
 * ODPT のレスポンスを、UI が扱うドメイン型(TrainLocation / ServiceStatus)へ変換する。
 *
 * odpt:Train は多くの場合 緯度経度を持たないため、fromStation / toStation から
 * 路線 GeoJSON 上の推定位置を算出する。位置が推定である場合は dataAccuracy を
 * "estimated" とし、UI 側で「推定位置」であることを表示できるようにする。
 */

/** 駅間走行中の推定巡航速度(km/h)。ODPT は速度を提供しないため推定値。 */
const ESTIMATED_CRUISE_KMH = 60;

/** 駅間のどの位置に置くか(0=from, 1=to)。進捗情報がないため中間点を採用。 */
const BETWEEN_STATION_RATIO = 0.5;
const TOKAIDO_STATION_ORDER = STATIONS.map((station) => station.id);

/** odpt.Station:JR-East.Tokaido.Tokyo → "tokyo"(ローカル駅 id)。未知なら null。 */
function odptStationToLocalId(odptStationId: string | null | undefined): string | null {
  if (!odptStationId) return null;
  const suffix = odptStationId.split(".").pop();
  if (!suffix) return null;
  const localId = suffix.toLowerCase();
  return getStationById(localId) ? localId : null;
}

/** 駅の日本語名を返す。未知なら romaji のまま。 */
function stationLabel(odptStationId: string | null | undefined): string {
  const localId = odptStationToLocalId(odptStationId);
  if (localId) return getStationById(localId)?.name ?? localId;
  return odptStationId?.split(".").pop() ?? "";
}

function mapTrainType(odptType: string | undefined): TrainType {
  const suffix = odptType?.split(".").pop()?.toLowerCase() ?? "";
  if (suffix.includes("special")) return "special_rapid";
  if (suffix.includes("rapid")) return "rapid";
  return "local";
}

function mapDestination(destinations: string[] | undefined): string {
  if (!destinations || destinations.length === 0) return "—";
  return destinations.map((d) => stationLabel(d)).join("・");
}

/**
 * OdptTrain → TrainLocation。
 * 対象区間(東京〜横浜)外で位置を特定できない列車は null を返す。
 */
export function odptTrainToTrainLocation(train: OdptTrain): TrainLocation | null {
  const fromLocal = odptStationToLocalId(train["odpt:fromStation"]);
  const toLocal = odptStationToLocalId(train["odpt:toStation"]);
  const trainNumber = train["odpt:trainNumber"] ?? train["owl:sameAs"]?.split(".").pop() ?? "----";
  const fromFraction = fromLocal ? stationFractionById(fromLocal) : null;
  const toFraction = toLocal ? stationFractionById(toLocal) : null;
  const routeSegment =
    fromFraction !== null && toFraction !== null
      ? { fromFraction, toFraction }
      : null;

  let latitude: number;
  let longitude: number;
  let accuracy: DataAccuracy;

  const hasGeo =
    typeof train["geo:lat"] === "number" && typeof train["geo:long"] === "number";

  if (hasGeo) {
    latitude = train["geo:lat"] as number;
    longitude = train["geo:long"] as number;
    accuracy = "actual";
  } else {
    const estimated = coordinateBetweenStations(fromLocal, toLocal, BETWEEN_STATION_RATIO);
    if (!estimated) {
      // 対象区間外(東京〜横浜の駅に紐付かない)ため表示対象外
      return null;
    }
    [longitude, latitude] = estimated.position;
    accuracy = "estimated";
  }

  const delaySec = typeof train["odpt:delay"] === "number" ? train["odpt:delay"] : 0;
  const delayMinutes = Math.round(delaySec / 60);

  // 駅停車中(toStation なし)は速度 0、駅間走行中は推定巡航速度
  const atStation = !toLocal;
  const speedKmh = atStation ? 0 : ESTIMATED_CRUISE_KMH;

  // 単一スナップショットでは駅間停止を判定できないため、遅延の有無で状態を近似する
  const status = delayMinutes >= 1 ? "delayed" : "running";

  const id = train["owl:sameAs"] ?? train["@id"] ?? `odpt-${trainNumber}`;

  return {
    id,
    lineId: "tokaido",
    lineName: "東海道線",
    lineColor: "#f68b1e",
    trainNumber,
    direction: inferTokaidoDirection(
      {
        odptDirection: train["odpt:railDirection"],
        fromStationId: fromLocal,
        toStationId: toLocal,
        destinationStationIds: train["odpt:destinationStation"]?.map(odptStationToLocalId),
        trainNumber,
      },
      TOKAIDO_STATION_ORDER,
    ),
    destination: mapDestination(train["odpt:destinationStation"]),
    trainType: mapTrainType(train["odpt:trainType"]),
    latitude,
    longitude,
    delayMinutes,
    speedKmh,
    status,
    lastUpdatedAt: train["dc:date"] ?? new Date().toISOString(),
    // ODPT Train は駅間停止の開始時刻を持たないため停止時間は不明(null)
    stoppedSince: null,
    dataAccuracy: accuracy,
    routeSegment,
  };
}

function genericDirection(value: string | null | undefined): TrainLocation["direction"] {
  const suffix = value?.split(/[.:]/).pop()?.toLowerCase() ?? "";
  return suffix === "inbound" ? "inbound" : "outbound";
}

function networkStationLabel(
  stationId: string,
  network: OdptNetworkContext,
): string {
  return (
    network.stationByOdptId.get(stationId)?.name ??
    stationId.split(".").pop() ??
    stationId
  );
}

function networkDestination(
  destinations: string[] | undefined,
  network: OdptNetworkContext,
): string {
  if (!destinations || destinations.length === 0) return "—";
  return destinations.map((id) => networkStationLabel(id, network)).join("・");
}

/** ODPTの全対象路線の列車を、駅座標と路線カタログを使って変換する。 */
export function odptTrainsToNetworkTrainLocations(
  trains: OdptTrain[],
  network: OdptNetworkContext,
): TrainLocation[] {
  const result: TrainLocation[] = [];

  for (const train of trains) {
    const railwayId = train["odpt:railway"] ?? "";
    const lineId = network.catalogIdByOdptRailwayId.get(railwayId);
    if (!lineId) continue;

    const catalog = getRailwayCatalogLine(lineId);
    const mapLine = network.lineByCatalogId.get(lineId);
    if (!catalog) continue;

    const fromStationId = train["odpt:fromStation"] ?? null;
    const toStationId = train["odpt:toStation"] ?? null;
    const fromPosition = fromStationId
      ? network.stationByOdptId.get(fromStationId)?.position
      : undefined;
    const toPosition = toStationId
      ? network.stationByOdptId.get(toStationId)?.position
      : undefined;

    const hasGeo =
      typeof train["geo:lat"] === "number" &&
      typeof train["geo:long"] === "number";

    let longitude: number;
    let latitude: number;
    let dataAccuracy: DataAccuracy;

    if (hasGeo) {
      longitude = train["geo:long"] as number;
      latitude = train["geo:lat"] as number;
      dataAccuracy = "actual";
    } else if (fromPosition && toPosition) {
      longitude = (fromPosition[0] + toPosition[0]) / 2;
      latitude = (fromPosition[1] + toPosition[1]) / 2;
      dataAccuracy = "estimated";
    } else {
      const position = fromPosition ?? toPosition;
      if (!position) continue;
      [longitude, latitude] = position;
      dataAccuracy = "estimated";
    }

    const delaySeconds =
      typeof train["odpt:delay"] === "number" ? train["odpt:delay"] : 0;
    const delayMinutes = Math.round(delaySeconds / 60);
    const trainNumber =
      train["odpt:trainNumber"] ??
      train["owl:sameAs"]?.split(".").pop() ??
      "----";
    const id =
      train["owl:sameAs"] ??
      train["@id"] ??
      `${railwayId}-${trainNumber}`;

    result.push({
      id,
      lineId,
      lineName: catalog.name,
      lineColor: mapLine?.color ?? catalog.color,
      trainNumber,
      direction:
        lineId === "tokaido"
          ? inferTokaidoDirection(
              {
                odptDirection: train["odpt:railDirection"],
                fromStationId: fromStationId?.split(".").pop()?.toLowerCase() ?? null,
                toStationId: toStationId?.split(".").pop()?.toLowerCase() ?? null,
                destinationStationIds: train["odpt:destinationStation"]?.map(
                  (id) => id.split(".").pop()?.toLowerCase() ?? null,
                ),
                trainNumber,
              },
              TOKAIDO_STATION_ORDER,
            )
          : genericDirection(train["odpt:railDirection"]),
      destination: networkDestination(
        train["odpt:destinationStation"],
        network,
      ),
      trainType: mapTrainType(train["odpt:trainType"]),
      latitude,
      longitude,
      delayMinutes,
      speedKmh: toPosition ? ESTIMATED_CRUISE_KMH : 0,
      status: delayMinutes >= 1 ? "delayed" : "running",
      lastUpdatedAt: train["dc:date"] ?? new Date().toISOString(),
      stoppedSince: null,
      dataAccuracy,
      routeSegment:
        fromPosition && toPosition
          ? {
              fromFraction: 0,
              toFraction: 1,
              coordinates: [fromPosition, toPosition],
            }
          : null,
    });
  }

  return result;
}

/** 複数の OdptTrain を TrainLocation[] に変換(区間外は除外)。 */
export function odptTrainsToTrainLocations(trains: OdptTrain[]): TrainLocation[] {
  const result: TrainLocation[] = [];
  for (const t of trains) {
    const mapped = odptTrainToTrainLocation(t);
    if (mapped) result.push(mapped);
  }
  return result;
}

/** 多言語対応フィールド(文字列 or {ja,en})から日本語テキストを取り出す。 */
function pickJa(field: string | { ja?: string; en?: string } | undefined): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.ja ?? field.en ?? "";
}

/** OdptTrainInformation[] → ServiceStatus。空配列(異常なし)は平常運転として扱う。 */
export function odptInformationToServiceStatus(
  info: OdptTrainInformation[],
  railwayLabel: string,
): ServiceStatus {
  const now = new Date().toISOString();

  if (!info || info.length === 0) {
    return {
      lineName: railwayLabel,
      severity: "normal",
      message: "平常どおり運転しています。",
      updatedAt: now,
      dataAccuracy: "actual",
    };
  }

  // 最も新しい情報を採用
  const latest = [...info].sort((a, b) => (b["dc:date"] ?? "").localeCompare(a["dc:date"] ?? ""))[0];
  const text = pickJa(latest["odpt:trainInformationText"]).trim();
  const statusText = pickJa(latest["odpt:trainInformationStatus"]).trim();

  const combined = `${statusText} ${text}`;
  let severity: ServiceStatus["severity"] = "normal";
  if (/見合わせ|運転を見合|中止|抑止/.test(combined)) {
    severity = "major";
  } else if (/遅れ|遅延|見合|直通運転を中止|一部|運転再開/.test(combined)) {
    severity = "minor";
  } else if (statusText && !/平常|通常/.test(statusText)) {
    severity = "minor";
  }

  return {
    lineName: railwayLabel,
    severity,
    message: text || statusText || "運行情報を確認してください。",
    updatedAt: latest["dc:date"] ?? now,
    dataAccuracy: "actual",
  };
}

/** 対象路線の日本語ラベル(駅一覧の両端から生成)。 */
export function defaultRailwayLabel(): string {
  const first = STATIONS[0]?.name ?? "";
  const last = STATIONS[STATIONS.length - 1]?.name ?? "";
  return `東海道線(${first}〜${last})`;
}
