import { NextResponse } from "next/server";
import {
  getFallbackRailwayNetwork,
  getOdptNetworkContext,
} from "@/lib/odpt/network";
import { createLogger } from "@/lib/logger";
import { cachedResponse, sharedCacheHeaders } from "@/server/responseCache";

export const dynamic = "force-dynamic";

const log = createLogger("api.railways");
const CACHE_HEADERS = sharedCacheHeaders(300, 900);

export async function GET() {
  try {
    const response = await cachedResponse("api:railways:v1", 300_000, async () => {
      const network = await getOdptNetworkContext();
      return network.response;
    });
    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (error) {
    log.warn("路線情報の取得に失敗、固定データへフォールバック", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(getFallbackRailwayNetwork(), {
      headers: sharedCacheHeaders(30, 60),
    });
  }
}
