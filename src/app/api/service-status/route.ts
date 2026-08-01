import { NextRequest, NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { ServiceStatusApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";
import { cachedResponse, sharedCacheHeaders } from "@/server/responseCache";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { parseRequestedLineIds } from "@/lib/trainApiPayload";

export const dynamic = "force-dynamic";

const log = createLogger("api.service-status");
const CACHE_HEADERS = sharedCacheHeaders(5, 10);

export async function GET(request: NextRequest) {
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

    const result = await cachedResponse("api:service-status:v2", 5_000, () =>
        trainLocationService.getServiceStatuses(),
      );
    const { isMock, source, fallback, notice } = result;
    const serviceStatuses = result.serviceStatuses.filter(
      (status) => requested.lineIds === null || requested.lineIds.has(status.lineId),
    );
    const serviceStatus =
      serviceStatuses.find((item) => item.lineId === "tokaido") ??
      serviceStatuses[0] ??
      result.serviceStatuses[0];
    if (!serviceStatus) throw new Error("運行情報がありません");
    const body: ServiceStatusApiResponse = {
      serviceStatus,
      serviceStatuses,
      isMock,
      source,
      fallback,
      notice,
    };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (error) {
    log.error("失敗", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "運行情報の取得に失敗しました" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
