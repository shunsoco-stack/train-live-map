import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { MockTrainLocationProvider } from "@/providers/MockTrainLocationProvider";
import type { ServiceStatus, TrainLocation } from "@/types/train";

/**
 * サービス層。
 *
 * どのプロバイダを使うかを一元管理する。UI・API 層はこのサービスを介して
 * データを取得し、MockTrainLocationProvider を直接参照しない。
 *
 * 実データへ移行する際は、ここで生成するプロバイダを
 * GtfsRealtimeProvider や JrEastProvider に差し替えるだけでよい。
 * (差し替え例)
 *   return new GtfsRealtimeProvider(process.env.GTFS_RT_FEED_URL ?? "");
 *   return new JrEastProvider(process.env.JR_EAST_API_KEY ?? "");
 */

// サーバープロセス起動時刻を固定し、モックの動きを連続的にする。
const MODULE_START_MS = Date.now();

let providerSingleton: TrainLocationProvider | null = null;

function createProvider(): TrainLocationProvider {
  // 現状はモックのみ。将来は環境変数でプロバイダを切り替える。
  return new MockTrainLocationProvider(MODULE_START_MS);
}

function getProvider(): TrainLocationProvider {
  if (!providerSingleton) {
    providerSingleton = createProvider();
  }
  return providerSingleton;
}

export const trainLocationService = {
  async getTrains(): Promise<{ trains: TrainLocation[]; isMock: boolean }> {
    const provider = getProvider();
    const trains = await provider.getTrainLocations();
    return { trains, isMock: provider.isMock };
  },

  async getServiceStatus(): Promise<{ serviceStatus: ServiceStatus; isMock: boolean }> {
    const provider = getProvider();
    const serviceStatus = await provider.getServiceStatus();
    return { serviceStatus, isMock: provider.isMock };
  },
};
