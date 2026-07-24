import { NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { ServiceStatusApiResponse } from "@/types/train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { serviceStatus, isMock } = await trainLocationService.getServiceStatus();
    const body: ServiceStatusApiResponse = { serviceStatus, isMock };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[/api/service-status] failed:", error);
    return NextResponse.json(
      { error: "運行情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
