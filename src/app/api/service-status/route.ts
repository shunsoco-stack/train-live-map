import { NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { ServiceStatusApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";
import { cachedResponse, sharedCacheHeaders } from "@/server/responseCache";

export const dynamic = "force-dynamic";

const log = createLogger("api.service-status");
const CACHE_HEADERS = sharedCacheHeaders(15, 45);

export async function GET() {
  try {
    const { serviceStatuses, isMock, source, fallback, notice } =
      await cachedResponse("api:service-status:v1", 15_000, () =>
        trainLocationService.getServiceStatuses(),
      );
    const serviceStatus =
      serviceStatuses.find((item) => item.lineId === "tokaido") ??
      serviceStatuses[0];
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
