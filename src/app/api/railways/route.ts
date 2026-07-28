import { NextResponse } from "next/server";
import {
  getFallbackRailwayNetwork,
  getOdptNetworkContext,
} from "@/lib/odpt/network";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api.railways");

export async function GET() {
  try {
    const network = await getOdptNetworkContext();
    return NextResponse.json(network.response);
  } catch (error) {
    log.warn("路線情報の取得に失敗、固定データへフォールバック", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(getFallbackRailwayNetwork());
  }
}

