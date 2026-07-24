import { NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { TrainsApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";

// 常に最新の位置を返すためキャッシュしない
export const dynamic = "force-dynamic";

const log = createLogger("api.trains");

export async function GET() {
  const start = Date.now();
  try {
    const { trains, isMock, source, fallback, notice } = await trainLocationService.getTrains();
    log.info("応答", { count: trains.length, source, fallback, durationMs: Date.now() - start });
    const body: TrainsApiResponse = {
      trains,
      generatedAt: new Date().toISOString(),
      isMock,
      source,
      fallback,
      notice,
    };
    return NextResponse.json(body);
  } catch (error) {
    log.error("失敗", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "列車情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
