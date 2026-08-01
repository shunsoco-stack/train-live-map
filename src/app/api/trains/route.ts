import { NextRequest, NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { TrainsApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";
import { cachedResponse, sharedCacheHeaders } from "@/server/responseCache";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import {
  parseRequestedLineIds,
  trainsForRequestedLines,
} from "@/lib/trainApiPayload";

// 常に最新の位置を返すためキャッシュしない
export const dynamic = "force-dynamic";

const log = createLogger("api.trains");
const CACHE_HEADERS = sharedCacheHeaders(5, 10);

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const requested = parseRequestedLineIds(request.nextUrl.searchParams.get("lines"));
    if (
      !requested.ok ||
      (requested.lineIds !== null &&
        [...requested.lineIds].some((lineId) => !getRailwayCatalogLine(lineId)))
    ) {
      return NextResponse.json(
        { error: "路線指定を確認してください" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await cachedResponse(
      "api:trains:v2",
      5_000,
      () => trainLocationService.getTrains(),
    );
    const { isMock, source, fallback, notice } = result;
    const trains = trainsForRequestedLines(result.trains, requested.lineIds);
    const generatedAt = new Date().toISOString();
    const latestTrainTimestamp = trains.reduce<string | null>((latest, train) => {
      const timestamp = Date.parse(train.lastUpdatedAt);
      if (Number.isNaN(timestamp)) return latest;
      if (!latest || timestamp > Date.parse(latest)) return train.lastUpdatedAt;
      return latest;
    }, null);

    log.info("応答", { count: trains.length, source, fallback, durationMs: Date.now() - start });
    const body: TrainsApiResponse = {
      trains,
      generatedAt,
      dataUpdatedAt: latestTrainTimestamp ?? generatedAt,
      isMock,
      source,
      fallback,
      notice,
    };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (error) {
    log.error("失敗", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "列車情報の取得に失敗しました" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
