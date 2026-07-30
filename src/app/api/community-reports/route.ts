import { NextRequest, NextResponse } from "next/server";
import {
  aggregateCommunityReports,
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
  validateCommunityReportVote,
} from "@/lib/communityReports";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { createLogger } from "@/lib/logger";
import { isAllowedMutationOrigin } from "@/lib/requestOrigin";
import {
  getCommunityReportStore,
  type CommunityReportStore,
} from "@/server/communityReportStore";
import {
  claimIpRateLimit,
  releaseIpRateLimit,
  type IpRateLimitClaim,
} from "@/server/ipRateLimiter";
import { maybeSendSuspensionSpikeNotification } from "@/server/pushNotifier";
import {
  extractForwardedIp,
  hashCommunityReporter,
  hashReporterIp,
} from "@/server/requestIdentity";
import type {
  CommunityReportsApiResponse,
  CommunityReportSubmitResponse,
} from "@/types/community";

export const dynamic = "force-dynamic";
const log = createLogger("api.community-reports");

const IP_LINE_RATE_LIMIT_SECONDS = 60;
const IP_GLOBAL_RATE_LIMIT_SECONDS = 5 * 60;
const IP_GLOBAL_RATE_LIMIT_COUNT = 10;

function trustedMutationOrigin(request: NextRequest): boolean {
  return isAllowedMutationOrigin({
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    refererHeader: request.headers.get("referer"),
    vercelUrl: process.env.VERCEL_URL,
  });
}

async function releaseIpClaims(
  claims: readonly IpRateLimitClaim[],
): Promise<void> {
  const results = await Promise.allSettled(
    claims.map((claim) => releaseIpRateLimit(claim)),
  );
  if (results.some((result) => result.status === "rejected")) {
    log.error("投票失敗後のIPレート制限解放に失敗");
  }
}

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

function votingEnabled(request: NextRequest, persistent: boolean): boolean {
  return persistent || isLocalRequest(request);
}

async function responsePayload(
  request: NextRequest,
  store: CommunityReportStore = getCommunityReportStore(),
): Promise<CommunityReportsApiResponse> {
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
    if (!trustedMutationOrigin(request)) {
      return NextResponse.json(
        { error: "この送信元からは投票できません。" },
        { status: 403 },
      );
    }

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
    const reporterHash = hashCommunityReporter(reporterId);
    const reporterIpHash = hashReporterIp(
      extractForwardedIp(request.headers.get("x-forwarded-for")),
    );
    const ipClaims: IpRateLimitClaim[] = [];
    const lineIpClaim = await claimIpRateLimit({
      scope: "community-report-line",
      ipHash: reporterIpHash,
      discriminator: vote.lineId,
      limit: 1,
      windowSeconds: IP_LINE_RATE_LIMIT_SECONDS,
    });
    if (!lineIpClaim.allowed) {
      return NextResponse.json(
        {
          error: `同じ接続元からこの路線には${IP_LINE_RATE_LIMIT_SECONDS}秒後に再投票できます。`,
        },
        { status: 429 },
      );
    }
    ipClaims.push(lineIpClaim);

    const globalIpClaim = await claimIpRateLimit({
      scope: "community-report-global",
      ipHash: reporterIpHash,
      limit: IP_GLOBAL_RATE_LIMIT_COUNT,
      windowSeconds: IP_GLOBAL_RATE_LIMIT_SECONDS,
    });
    if (!globalIpClaim.allowed) {
      await releaseIpClaims(ipClaims);
      return NextResponse.json(
        {
          error: "投票回数が多いため、しばらく待ってから再投票してください。",
        },
        { status: 429 },
      );
    }
    ipClaims.push(globalIpClaim);

    let reporterClaimed = false;
    try {
      const allowed = await store.claimRateLimit(
        reporterHash,
        vote.lineId,
      );
      if (!allowed) {
        await releaseIpClaims(ipClaims);
        return NextResponse.json(
          {
            error: `同じ路線には${COMMUNITY_REPORT_COOLDOWN_SECONDS}秒後に再投票できます。`,
          },
          { status: 429 },
        );
      }
      reporterClaimed = true;

      const createdAt = new Date().toISOString();
      await store.save({
        ...vote,
        reporterHash,
        reporterIpHash,
        createdAt,
      });
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
          log.warn("投票後のPush通知処理に失敗");
        }
      }
      const payload = await responsePayload(request, store);
      const summary = payload.summaries.find(
        (item) => item.lineId === vote.lineId,
      );
      if (!summary) throw new Error("投票結果を集計できませんでした");

      const response: CommunityReportSubmitResponse = {
        ...payload,
        summary,
      };
      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      if (reporterClaimed) {
        try {
          await store.releaseRateLimit(reporterHash, vote.lineId);
        } catch {
          log.error("投票失敗後のクールダウン解放にも失敗");
        }
      }
      await releaseIpClaims(ipClaims);
      throw error;
    }
  } catch {
    return NextResponse.json(
      { error: "投票を保存できませんでした。" },
      { status: 500 },
    );
  }
}
