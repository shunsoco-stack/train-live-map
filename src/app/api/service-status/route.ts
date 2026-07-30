import { NextResponse } from "next/server";
import {
  NO_STORE_CACHE_HEADERS,
  SHORT_CDN_CACHE_HEADERS,
} from "@/lib/apiCache";
import { trainLocationService } from "@/services/trainLocationService";
import type { ServiceStatusApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api.service-status");

export async function GET() {
  try {
    const { serviceStatuses, isMock, source, fallback, notice } =
      await trainLocationService.getServiceStatuses();
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
    return NextResponse.json(body, {
      headers: SHORT_CDN_CACHE_HEADERS,
    });
  } catch (error) {
    log.error("失敗", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "運行情報の取得に失敗しました" },
      { status: 500, headers: NO_STORE_CACHE_HEADERS },
    );
  }
}
