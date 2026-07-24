import type { ServiceStatus, TrainLocation } from "@/types/train";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";

/**
 * JR東日本の列車位置 API 接続用プロバイダの雛形(未実装)。
 *
 * 正式な API 接続が可能になった際に、認証・エンドポイント呼び出し・
 * レスポンス変換をここに実装する。API キーはコードに埋め込まず、
 * 環境変数(例: process.env.JR_EAST_API_KEY)から読み込むこと。
 */
export class JrEastProvider implements TrainLocationProvider {
  public readonly isMock = false;

  constructor(private readonly apiKey: string) {}

  async getTrainLocations(): Promise<TrainLocation[]> {
    if (!this.apiKey) throw new Error("JrEastProvider: API キーが未設定です");
    throw new Error("JrEastProvider は未実装です");
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    throw new Error("JrEastProvider は未実装です");
  }
}
