import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { MockTrainLocationProvider } from "@/providers/MockTrainLocationProvider";
import { OdptTrainLocationProvider } from "@/providers/OdptTrainLocationProvider";
import { getOdptConfig, isOdptConfigured } from "@/lib/odpt/config";
import {
  fetchOdptRailways,
  fetchOdptTrainInformation,
  fetchOdptTrains,
} from "@/lib/odpt/api";
import { createLogger } from "@/lib/logger";
import type { ProviderSource, ServiceStatus, TrainLocation } from "@/types/train";
import { resolveProviderResult } from "@/services/trainLocationPolicy";

/**
 * サービス層。
 *
 * どのプロバイダを使うかを一元管理する。UI・API 層はこのサービスを介して
 * データを取得し、プロバイダ実装を直接参照しない。
 *
 * 優先順位:
 *   1. ODPT アクセストークンが設定されていれば OdptTrainLocationProvider を使用
 *   2. 取得に失敗した場合は自動的に MockTrainLocationProvider へフォールバック
 *
 * 将来 GtfsRealtimeProvider / JrEastProvider を追加する場合は、
 * createRealProvider() の分岐を増やすだけでよい(UI 変更は不要)。
 */

const log = createLogger("service");

// サーバープロセス起動時刻を固定し、モックの動きを連続的にする。
const MODULE_START_MS = Date.now();

let mockSingleton: MockTrainLocationProvider | null = null;
let odptSingleton: OdptTrainLocationProvider | null = null;

function getMockProvider(): MockTrainLocationProvider {
  if (!mockSingleton) mockSingleton = new MockTrainLocationProvider(MODULE_START_MS);
  return mockSingleton;
}

/** 実データプロバイダ(現状は ODPT)。未設定なら null。 */
function getRealProvider(): OdptTrainLocationProvider | null {
  if (!isOdptConfigured()) return null;
  if (!odptSingleton) odptSingleton = new OdptTrainLocationProvider();
  return odptSingleton;
}

/** 取得結果に付随するメタ情報。 */
export interface TrainsResult {
  trains: TrainLocation[];
  source: ProviderSource;
  isMock: boolean;
  /** 実データ失敗によるフォールバックか */
  fallback: boolean;
  /** UI に表示する注意書き(モック表示中など)。不要なら null。 */
  notice: string | null;
}

export interface ServiceStatusResult {
  serviceStatus: ServiceStatus;
  source: ProviderSource;
  isMock: boolean;
  fallback: boolean;
  notice: string | null;
}

export interface ServiceStatusesResult {
  serviceStatuses: ServiceStatus[];
  source: ProviderSource;
  isMock: boolean;
  fallback: boolean;
  notice: string | null;
}

async function withProvider<T>(
  real: TrainLocationProvider | null,
  call: (p: TrainLocationProvider) => Promise<T>,
  isEmpty?: (value: T) => boolean,
) {
  return resolveProviderResult({
    realCall: real ? () => call(real) : null,
    mockCall: () => call(getMockProvider()),
    isEmpty,
    onFallback: (reason, error) => {
      if (reason === "empty") {
        log.warn("ODPTの対象列車が0件、開発用モックへフォールバック");
        return;
      }
      log.warn("実データ取得に失敗、開発用モックへフォールバック", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });
}

export const trainLocationService = {
  async getTrains(): Promise<TrainsResult> {
    const real = getRealProvider();
    const { value, source, isMock, fallback, notice } = await withProvider(
      real,
      (p) => p.getTrainLocations(),
      (trains) => trains.length === 0,
    );

    return { trains: value, source, isMock, fallback, notice };
  },

  async getServiceStatus(): Promise<ServiceStatusResult> {
    const result = await this.getServiceStatuses();
    const serviceStatus =
      result.serviceStatuses.find((item) => item.lineId === "tokaido") ??
      result.serviceStatuses[0];
    if (!serviceStatus) {
      throw new Error("運行情報を取得できる路線がありません");
    }
    return { ...result, serviceStatus };
  },

  async getServiceStatuses(): Promise<ServiceStatusesResult> {
    const real = getRealProvider();
    const { value, source, isMock, fallback, notice } = await withProvider(
      real,
      (p) => p.getServiceStatuses(),
    );
    return {
      serviceStatuses: value,
      source,
      isMock,
      fallback,
      notice,
    };
  },
};

/** 個別の診断結果。 */
export interface ProbeResult {
  label: string;
  success: boolean;
  count: number;
  error: string | null;
}

/** デバッグ画面用のスナップショット型。 */
export interface DebugSnapshot {
  odptConfigured: boolean;
  railway: string;
  baseUrl: string;
  activeSource: ProviderSource;
  success: boolean;
  count: number;
  durationMs: number | null;
  fetchedAt: string;
  error: string | null;
  /** ODPT の生レスポンス(成功時のみ、先頭数件) */
  rawSample: unknown;
  /** 接続診断(列車位置・運行情報・路線一覧) */
  probes: ProbeResult[];
  /** 事業者が公開している路線 ID の一覧(診断で取得できた場合) */
  availableRailways: string[];
}

/**
 * デバッグ用: ODPT を直接叩き、生レスポンス・件数・所要時間・エラーを返す。
 * トークンは含めない。開発画面(/dev/debug)からのみ利用する想定。
 */
export async function getDebugSnapshot(): Promise<DebugSnapshot> {
  const config = getOdptConfig();
  const configured = isOdptConfigured(config);
  const base = {
    odptConfigured: configured,
    railway: config.railway,
    baseUrl: config.baseUrl,
    fetchedAt: new Date().toISOString(),
  };

  if (!configured) {
    return {
      ...base,
      activeSource: "mock" as const,
      success: false,
      count: 0,
      durationMs: null,
      error: "ODPT_ACCESS_TOKEN が未設定です(モック動作中)。",
      rawSample: null,
      probes: [],
      availableRailways: [],
    };
  }

  const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // 1) 列車位置(本命)
  let success = false;
  let count = 0;
  let durationMs: number | null = null;
  let error: string | null = null;
  let rawSample: unknown = null;
  try {
    const res = await fetchOdptTrains(config.railway, config);
    success = true;
    count = res.data.length;
    durationMs = res.durationMs;
    rawSample = res.data.slice(0, 3);
  } catch (err) {
    error = errMsg(err);
  }

  const probes: ProbeResult[] = [
    {
      label: `列車位置 odpt:Train (${config.railway})`,
      success,
      count,
      error,
    },
  ];

  // 2) 運行情報(列車位置が未提供でも取得できることが多い)
  try {
    const res = await fetchOdptTrainInformation(config.railway, config);
    probes.push({
      label: `運行情報 odpt:TrainInformation (${config.railway})`,
      success: true,
      count: res.data.length,
      error: null,
    });
  } catch (err) {
    probes.push({
      label: `運行情報 odpt:TrainInformation (${config.railway})`,
      success: false,
      count: 0,
      error: errMsg(err),
    });
  }

  // 3) 事業者の路線一覧(路線 ID が正しいかの確認用)
  let availableRailways: string[] = [];
  try {
    const res = await fetchOdptRailways(config.operator, config);
    availableRailways = res.data
      .map((r) => r["owl:sameAs"] ?? r["@id"] ?? "")
      .filter((id): id is string => id.length > 0)
      .sort();
    probes.push({
      label: `路線一覧 odpt:Railway (${config.operator})`,
      success: true,
      count: res.data.length,
      error: null,
    });
  } catch (err) {
    probes.push({
      label: `路線一覧 odpt:Railway (${config.operator})`,
      success: false,
      count: 0,
      error: errMsg(err),
    });
  }

  return {
    ...base,
    activeSource: success ? ("odpt" as const) : ("mock" as const),
    success,
    count,
    durationMs,
    error,
    rawSample,
    probes,
    availableRailways,
  };
}
