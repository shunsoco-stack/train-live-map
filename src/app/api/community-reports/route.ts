import { NextRequest, NextResponse } from "next/server";
import {
  aggregateCommunityReports,
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
  validateCommunityReportVote,
} from "@/lib/communityReports";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import {
  COMMUNITY_SOURCE_RATE_WINDOW_SECONDS,
  getCommunityReportStore,
} from "@/server/communityReportStore";
import { maybeSendSuspensionSpikeNotification } from "@/server/pushNotifier";
import {
  abusePreventionSecret,
  clientAddress,
  pseudonymousHash,
  readLimitedJsonBody,
  validateMutationRequest,
} from "@/server/requestSecurity";
import type {
  CommunityReportsApiResponse,
  CommunityReportSubmitResponse,
} from "@/types/community";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function errorResponse(
  message: string,
  status: number,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...NO_STORE_HEADERS, ...headers } },
  );
}

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
    return NextResponse.json(await responsePayload(request), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return errorResponse("みんなの運行情報を取得できませんでした。", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestCheck = validateMutationRequest(request.headers, request.nextUrl);
    if (!requestCheck.ok) {
      return errorResponse(requestCheck.message, requestCheck.status);
    }

    const store = getCommunityReportStore();
    if (!votingEnabled(request, store.persistent)) {
      return errorResponse("共有投票の保存先を準備中です。", 503);
    }

    const reporterId = request.headers.get("x-community-reporter") ?? "";
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(reporterId)) {
      return errorResponse("投票端末を確認できませんでした。", 400);
    }

    const body = await readLimitedJsonBody(request);
    if (!body.ok) return errorResponse(body.message, body.status);

    const vote = validateCommunityReportVote(body.value);
    const catalogLine = vote
      ? getRailwayCatalogLine(vote.lineId)
      : undefined;
    if (!vote || !catalogLine || catalogLine.coverage === "unavailable") {
      return errorResponse("投票内容を確認してください。", 400);
    }

    const local = isLocalRequest(request);
    const secret =
      abusePreventionSecret() ??
      (local ? "train-live-map-local-development-key-only" : null);
    const address = clientAddress(request.headers) ?? (local ? "local" : null);
    if (!secret || !address) {
      return errorResponse("不正投票対策の設定を確認しています。", 503);
    }

    const sourceHash = pseudonymousHash(
      secret,
      "community-source-v1",
      address,
    );
    const sourceAllowed = await store.claimSourceRateLimit(sourceHash);
    if (!sourceAllowed) {
      return errorResponse(
        "短時間の投票上限に達しました。少し時間をおいてください。",
        429,
        { "Retry-After": String(COMMUNITY_SOURCE_RATE_WINDOW_SECONDS) },
      );
    }

    const reporterHash = pseudonymousHash(
      secret,
      "community-reporter-v2",
      reporterId,
    );
    const allowed = await store.claimRateLimit(
      reporterHash,
      vote.lineId,
    );
    if (!allowed) {
      return errorResponse(
        `同じ路線には${COMMUNITY_REPORT_COOLDOWN_SECONDS}秒後に再投票できます。`,
        429,
        { "Retry-After": String(COMMUNITY_REPORT_COOLDOWN_SECONDS) },
      );
    }

    const createdAt = new Date().toISOString();
    await store.save({ ...vote, reporterHash, sourceHash, createdAt });
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
    return NextResponse.json(response, {
      status: 201,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return errorResponse("投票を保存できませんでした。", 500);
  }
}
