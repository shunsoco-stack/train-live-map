import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { MockTrainLocationProvider } from "@/providers/MockTrainLocationProvider";
import { OdptTrainLocationProvider } from "@/providers/OdptTrainLocationProvider";
import { getOdptConfig, isOdptConfigured } from "@/lib/odpt/config";
import { fetchOdptTrains } from "@/lib/odpt/api";
import { createLogger } from "@/lib/logger";
import type { ProviderSource, ServiceStatus, TrainLocation } from "@/types/train";

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

const MOCK_NOTICE_NO_TOKEN = "現在モックデータを表示しています(ODPT 未設定)。";
const MOCK_NOTICE_FALLBACK = "現在モックデータを表示しています(実データの取得に失敗したため)。";

async function withProvider<T>(
  real: TrainLocationProvider | null,
  call: (p: TrainLocationProvider) => Promise<T>,
): Promise<{ value: T; source: ProviderSource; fallback: boolean; notice: string | null }> {
  const mock = getMockProvider();

  if (!real) {
    const value = await call(mock);
    return { value, source: "mock", fallback: false, notice: MOCK_NOTICE_NO_TOKEN };
  }

  try {
    const value = await call(real);
    return { value, source: "odpt", fallback: false, notice: null };
  } catch (err) {
    log.warn("実データ取得に失敗、モックへフォールバック", {
      message: err instanceof Error ? err.message : String(err),
    });
    const value = await call(mock);
    return { value, source: "mock", fallback: true, notice: MOCK_NOTICE_FALLBACK };
  }
}

export const trainLocationService = {
  async getTrains(): Promise<TrainsResult> {
    const real = getRealProvider();
    const { value, source, fallback, notice } = await withProvider(real, (p) =>
      p.getTrainLocations(),
    );
    return { trains: value, source, isMock: source === "mock", fallback, notice };
  },

  async getServiceStatus(): Promise<ServiceStatusResult> {
    const real = getRealProvider();
    const { value, source, fallback, notice } = await withProvider(real, (p) =>
      p.getServiceStatus(),
    );
    return { serviceStatus: value, source, isMock: source === "mock", fallback, notice };
  },
};

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
}

/**
 * デバッグ用: ODPT を直接叩き、生レスポンス・件数・所要時間・エラーを返す。
 * トークンは含めない。開発画面(/dev/debug)からのみ利用する想定。
 */
export async function getDebugSnapshot(): Promise<DebugSnapshot> {
  const config = getOdptConfig();
  const configured = isOdptConfigured(config);
  const base: Omit<DebugSnapshot, "success" | "count" | "durationMs" | "error" | "rawSample" | "activeSource"> = {
    odptConfigured: configured,
    railway: config.railway,
    baseUrl: config.baseUrl,
    fetchedAt: new Date().toISOString(),
  };

  if (!configured) {
    return {
      ...base,
      activeSource: "mock",
      success: false,
      count: 0,
      durationMs: null,
      error: "ODPT_ACCESS_TOKEN が未設定です(モック動作中)。",
      rawSample: null,
    };
  }

  try {
    const { data, durationMs } = await fetchOdptTrains(config.railway, config);
    return {
      ...base,
      activeSource: "odpt",
      success: true,
      count: data.length,
      durationMs,
      error: null,
      rawSample: data.slice(0, 3),
    };
  } catch (err) {
    return {
      ...base,
      activeSource: "mock",
      success: false,
      count: 0,
      durationMs: null,
      error: err instanceof Error ? err.message : String(err),
      rawSample: null,
    };
  }
}
