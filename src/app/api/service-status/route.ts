import { NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { ServiceStatusApiResponse } from "@/types/train";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api.service-status");

export async function GET() {
  try {
    const { serviceStatus, isMock, source, fallback, notice } =
      await trainLocationService.getServiceStatus();
    const body: ServiceStatusApiResponse = { serviceStatus, isMock, source, fallback, notice };
    return NextResponse.json(body);
  } catch (error) {
    log.error("失敗", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "運行情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
