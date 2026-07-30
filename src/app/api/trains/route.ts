import { NextRequest, NextResponse } from "next/server";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import {
  NO_STORE_CACHE_HEADERS,
  SHORT_CDN_CACHE_HEADERS,
} from "@/lib/apiCache";
import { trainLocationService } from "@/services/trainLocationService";
import type { TrainsApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";
import { serializeTrainLocation } from "@/lib/trainPayload";
import { parseTrainLineFilter } from "@/lib/trainLineFilter";

// Next.jsの静的化は避け、短い共有キャッシュはレスポンスヘッダーで制御する。
export const dynamic = "force-dynamic";

const log = createLogger("api.trains");

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const filter = parseTrainLineFilter(
      request.nextUrl.searchParams.get("lines"),
      (lineId) => Boolean(getRailwayCatalogLine(lineId)),
    );
    if (!filter.valid) {
      return NextResponse.json(
        { error: "表示路線の指定を確認してください" },
        { status: 400, headers: NO_STORE_CACHE_HEADERS },
      );
    }

    const { trains, isMock, source, fallback, notice } = await trainLocationService.getTrains();
    const selectedLineIds = filter.lineIds;
    const visibleTrains =
      selectedLineIds === null
        ? trains
        : trains.filter((train) => selectedLineIds.has(train.lineId));
    const trainPayloads = visibleTrains.map(serializeTrainLocation);
    const generatedAt = new Date().toISOString();
    const latestTrainTimestamp = visibleTrains.reduce<string | null>((latest, train) => {
      const timestamp = Date.parse(train.lastUpdatedAt);
      if (Number.isNaN(timestamp)) return latest;
      if (!latest || timestamp > Date.parse(latest)) return train.lastUpdatedAt;
      return latest;
    }, null);

    log.info("応答", {
      count: visibleTrains.length,
      source,
      fallback,
      durationMs: Date.now() - start,
    });
    const body: TrainsApiResponse = {
      trains: trainPayloads,
      generatedAt,
      dataUpdatedAt: latestTrainTimestamp ?? generatedAt,
      isMock,
      source,
      fallback,
      notice,
    };
    return NextResponse.json(body, {
      headers: SHORT_CDN_CACHE_HEADERS,
    });
  } catch (error) {
    log.error("失敗", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "列車情報の取得に失敗しました" },
      { status: 500, headers: NO_STORE_CACHE_HEADERS },
    );
  }
}
