import type { ServiceStatus, TrainLocation, TrainStatus } from "@/types/train";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { ROUTE_COORDINATES_RAW } from "@/data/routeLine";
import { buildPolylineIndex, positionAtFraction, type PolylineIndex } from "@/lib/geo";

/**
 * モック実装。
 *
 * 実際の API に接続できるまでの検証用に、東海道線 東京〜横浜間を走る
 * 複数の列車を擬似的に生成する。位置は路線 GeoJSON 上を移動し、
 * 線路から外れないよう [0,1] のフラクションで管理する。
 *
 * 動きは決定論的(サーバープロセス起動時刻を基準にした時間関数)なので、
 * ページを更新しても連続的で一貫した動きになる。
 */

// ルート上の各駅に対応する座標インデックス(routeLine.ts の配列順に対応)
const STATION_ROUTE_INDEX: Record<string, number> = {
  tokyo: 0,
  shimbashi: 2,
  shinagawa: 5,
  kawasaki: 9,
  yokohama: 13,
};

type MotionKind = "oscillate" | "fixed";

interface MockTrainSpec {
  id: string;
  trainNumber: string;
  direction: TrainLocation["direction"];
  destination: string;
  trainType: TrainLocation["trainType"];
  status: TrainStatus;
  delayMinutes: number;
  /** 区間の開始・終了フラクション(駅 id で指定) */
  from: string;
  to: string;
  motion: MotionKind;
  /** oscillate 用: 往復周期(秒) */
  periodSec?: number;
  /** oscillate 用: 位相オフセット(0〜1) */
  phase?: number;
  /** fixed 用: 区間内での固定位置(0=from, 1=to) */
  fixedAt?: number;
  /** 走行中の表示速度(km/h)。停止中は 0 に上書きされる。 */
  baseSpeedKmh: number;
  /** stopped/ suspended の場合の停止開始からの初期経過秒 */
  initialStopSec?: number;
}

/**
 * モック列車の定義。要件の例に沿った状況を再現する。
 * - 品川〜川崎間で 8 分停止中
 * - 新橋〜品川間を通常走行
 * - 川崎〜横浜間で 3 分遅延(走行中)
 * - 横浜駅付近で運転見合わせ
 * さらに走行中・停止直後の列車を加えて画面を賑やかにする。
 */
const TRAIN_SPECS: MockTrainSpec[] = [
  {
    id: "t-001",
    trainNumber: "731M",
    direction: "outbound",
    destination: "横浜",
    trainType: "local",
    status: "running",
    delayMinutes: 0,
    from: "shimbashi",
    to: "shinagawa",
    motion: "oscillate",
    periodSec: 220,
    phase: 0.1,
    baseSpeedKmh: 72,
  },
  {
    id: "t-002",
    trainNumber: "812M",
    direction: "inbound",
    destination: "東京",
    trainType: "rapid",
    status: "running",
    delayMinutes: 0,
    from: "tokyo",
    to: "shimbashi",
    motion: "oscillate",
    periodSec: 160,
    phase: 0.55,
    baseSpeedKmh: 64,
  },
  {
    id: "t-003",
    trainNumber: "945M",
    direction: "outbound",
    destination: "熱海",
    trainType: "local",
    status: "stopped",
    delayMinutes: 8,
    from: "shinagawa",
    to: "kawasaki",
    motion: "fixed",
    fixedAt: 0.45,
    baseSpeedKmh: 0,
    initialStopSec: 8 * 60, // 8 分停止中
  },
  {
    id: "t-004",
    trainNumber: "1002M",
    direction: "outbound",
    destination: "横浜",
    trainType: "special_rapid",
    status: "delayed",
    delayMinutes: 3,
    from: "kawasaki",
    to: "yokohama",
    motion: "oscillate",
    periodSec: 200,
    phase: 0.3,
    baseSpeedKmh: 58,
  },
  {
    id: "t-005",
    trainNumber: "1108M",
    direction: "inbound",
    destination: "東京",
    trainType: "local",
    status: "suspended",
    delayMinutes: 12,
    from: "yokohama",
    to: "kawasaki",
    motion: "fixed",
    fixedAt: 0.06, // 横浜駅付近
    baseSpeedKmh: 0,
    initialStopSec: 6 * 60,
  },
  {
    id: "t-006",
    trainNumber: "1215M",
    direction: "outbound",
    destination: "川崎",
    trainType: "local",
    status: "stopped",
    delayMinutes: 1,
    from: "shinagawa",
    to: "kawasaki",
    motion: "fixed",
    fixedAt: 0.8,
    baseSpeedKmh: 0,
    initialStopSec: 40, // 停止直後(1分未満 → 黄)
  },
];

/** 0〜1 を往復する三角波。区間内に必ず収まる。 */
function triangleWave(t: number, periodSec: number, phase: number): number {
  const p = (((t / periodSec) + phase) % 1 + 1) % 1;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

export class MockTrainLocationProvider implements TrainLocationProvider {
  public readonly isMock = true;

  private readonly index: PolylineIndex;
  private readonly startMs: number;

  constructor(startMs: number = Date.now()) {
    this.index = buildPolylineIndex(ROUTE_COORDINATES_RAW);
    this.startMs = startMs;
  }

  /** 駅 id をルート全体のフラクション(0〜1)に変換する。 */
  private stationFraction(stationId: string): number {
    const idx = STATION_ROUTE_INDEX[stationId];
    if (idx === undefined || this.index.totalLength === 0) return 0;
    return this.index.cumulative[idx] / this.index.totalLength;
  }

  async getTrainLocations(): Promise<TrainLocation[]> {
    const now = new Date();
    const elapsedSec = (now.getTime() - this.startMs) / 1000;

    return TRAIN_SPECS.map((spec) => {
      const fromF = this.stationFraction(spec.from);
      const toF = this.stationFraction(spec.to);

      let localT: number; // 区間内の位置 0〜1
      if (spec.motion === "fixed") {
        localT = spec.fixedAt ?? 0.5;
      } else {
        localT = triangleWave(elapsedSec, spec.periodSec ?? 200, spec.phase ?? 0);
      }

      const fraction = fromF + (toF - fromF) * localT;
      const [lng, lat] = positionAtFraction(this.index, fraction);

      const isStopped = spec.status === "stopped" || spec.status === "suspended";
      const speedKmh = isStopped ? 0 : Math.round(spec.baseSpeedKmh);

      // 停止開始時刻: プロセス起動時点で initialStopSec だけ過去に設定。
      // 以降は実時間で経過が増えるため、停止時間がリアルに伸びていく。
      const stoppedSince =
        isStopped && spec.initialStopSec !== undefined
          ? new Date(this.startMs - spec.initialStopSec * 1000).toISOString()
          : null;

      const train: TrainLocation = {
        id: spec.id,
        lineId: "tokaido",
        lineName: "東海道線",
        lineColor: "#f68b1e",
        trainNumber: spec.trainNumber,
        direction: spec.direction,
        destination: spec.destination,
        trainType: spec.trainType,
        latitude: lat,
        longitude: lng,
        delayMinutes: spec.delayMinutes,
        speedKmh,
        status: spec.status,
        lastUpdatedAt: now.toISOString(),
        stoppedSince,
        dataAccuracy: "mock",
        routeSegment: { fromFraction: fromF, toFraction: toF },
      };
      return train;
    });
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    return {
      lineId: "tokaido",
      lineName: "東海道線(東京〜横浜)",
      severity: "minor",
      message:
        "品川〜川崎間で安全確認のため一部列車が停止しています。横浜駅付近で運転を見合わせています。",
      updatedAt: new Date().toISOString(),
      dataAccuracy: "mock",
    };
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    return [await this.getServiceStatus()];
  }
}
