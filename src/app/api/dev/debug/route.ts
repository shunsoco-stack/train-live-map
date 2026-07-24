import { NextResponse } from "next/server";
import { getDebugSnapshot, trainLocationService } from "@/services/trainLocationService";

// 開発時のみアクセス可能。本番では 404 を返す。
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const start = Date.now();
  const snapshot = await getDebugSnapshot();

  // 実際にサービス層が返す(フォールバック込みの)結果も併せて返す
  const trainsResult = await trainLocationService.getTrains();
  const statusResult = await trainLocationService.getServiceStatus();

  return NextResponse.json({
    snapshot,
    service: {
      trains: {
        source: trainsResult.source,
        isMock: trainsResult.isMock,
        fallback: trainsResult.fallback,
        notice: trainsResult.notice,
        count: trainsResult.trains.length,
      },
      serviceStatus: {
        source: statusResult.source,
        isMock: statusResult.isMock,
        fallback: statusResult.fallback,
        severity: statusResult.serviceStatus.severity,
        message: statusResult.serviceStatus.message,
      },
    },
    totalDurationMs: Date.now() - start,
  });
}
