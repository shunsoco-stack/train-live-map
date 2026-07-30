import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  aggregateCommunityReports,
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
  validateCommunityReportVote,
} from "@/lib/communityReports";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { getCommunityReportStore } from "@/server/communityReportStore";
import { maybeSendSuspensionSpikeNotification } from "@/server/pushNotifier";
import type {
  CommunityReportsApiResponse,
  CommunityReportSubmitResponse,
} from "@/types/community";

export const dynamic = "force-dynamic";

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

function votingEnabled(request: NextRequest, persistent: boolean): boolean {
  return persistent || isLocalRequest(request);
}

async function responsePayload(
  request: NextRequest,
): Promise<CommunityReportsApiResponse> {
  const store = getCommunityReportStore();
  const reports = await store.listActive();
  return {
    summaries: aggregateCommunityReports(
      reports.map((item) => item.record),
    ),
    windowMinutes: COMMUNITY_REPORT_WINDOW_MS / 60_000,
    cooldownSeconds: COMMUNITY_REPORT_COOLDOWN_SECONDS,
    persistent: store.persistent,
    votingEnabled: votingEnabled(request, store.persistent),
  };
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await responsePayload(request));
  } catch {
    return NextResponse.json(
      { error: "みんなの運行情報を取得できませんでした。" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const reporterId = request.headers.get("x-community-reporter") ?? "";
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(reporterId)) {
      return NextResponse.json(
        { error: "投票端末を確認できませんでした。" },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "投票内容を確認してください。" },
        { status: 400 },
      );
    }
    const vote = validateCommunityReportVote(body);
    const catalogLine = vote
      ? getRailwayCatalogLine(vote.lineId)
      : undefined;
    if (!vote || !catalogLine || catalogLine.coverage === "unavailable") {
      return NextResponse.json(
        { error: "投票内容を確認してください。" },
        { status: 400 },
      );
    }

    const store = getCommunityReportStore();
    if (!votingEnabled(request, store.persistent)) {
      return NextResponse.json(
        { error: "共有投票の保存先を準備中です。" },
        { status: 503 },
      );
    }
    const reporterHash = createHash("sha256")
      .update(`train-live-map:v1:${reporterId}`)
      .digest("hex")
      .slice(0, 32);
    const allowed = await store.claimRateLimit(
      reporterHash,
      vote.lineId,
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: `同じ路線には${COMMUNITY_REPORT_COOLDOWN_SECONDS}秒後に再投票できます。`,
        },
        { status: 429 },
      );
    }

    const createdAt = new Date().toISOString();
    await store.save({ ...vote, reporterHash, createdAt });
    if (vote.status === "suspended") {
      try {
        const activeReports = await store.listActive();
        await maybeSendSuspensionSpikeNotification({
          reports: activeReports.map((item) => item.record),
          lineId: vote.lineId,
          lineName: catalogLine.name,
        });
      } catch {
        // 通知失敗で利用者の投票自体を失敗扱いにしない。
      }
    }
    const payload = await responsePayload(request);
    const summary = payload.summaries.find(
      (item) => item.lineId === vote.lineId,
    );
    if (!summary) throw new Error("投票結果を集計できませんでした");

    const response: CommunityReportSubmitResponse = {
      ...payload,
      summary,
    };
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "投票を保存できませんでした。" },
      { status: 500 },
    );
  }
}
