import { NextResponse } from "next/server";
import { trainLocationService } from "@/services/trainLocationService";
import type { TrainsApiResponse } from "@/types/train";

// 常に最新のモック位置を返すためキャッシュしない
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { trains, isMock } = await trainLocationService.getTrains();
    const body: TrainsApiResponse = {
      trains,
      generatedAt: new Date().toISOString(),
      isMock,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[/api/trains] failed:", error);
    return NextResponse.json(
      { error: "列車情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
