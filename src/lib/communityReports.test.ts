import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCommunityReports,
  COMMUNITY_REPORT_WINDOW_MS,
  validateCommunityReportVote,
} from "./communityReports.ts";
import type { CommunityReportRecord } from "../types/community.ts";

const NOW = Date.UTC(2026, 6, 29, 3, 0, 0);

function report(
  lineId: string,
  reporterHash: string,
  status: CommunityReportRecord["status"],
  delayMinutes: number | null = null,
  createdAt = new Date(NOW - 60_000).toISOString(),
  sourceHash = reporterHash,
): CommunityReportRecord {
  return {
    lineId,
    reporterHash,
    sourceHash,
    status,
    delayMinutes,
    createdAt,
  };
}

test("平常・遅延・見合わせの投票を検証する", () => {
  assert.deepEqual(
    validateCommunityReportVote({
      lineId: "yamanote",
      status: "on-time",
      delayMinutes: 20,
    }),
    { lineId: "yamanote", status: "on-time", delayMinutes: null },
  );
  assert.deepEqual(
    validateCommunityReportVote({
      lineId: "yamanote",
      status: "delayed",
      delayMinutes: 15,
    }),
    { lineId: "yamanote", status: "delayed", delayMinutes: 15 },
  );
  assert.equal(
    validateCommunityReportVote({
      lineId: "yamanote",
      status: "delayed",
      delayMinutes: 0,
    }),
    null,
  );
});

test("遅延投票は中央値の分数で集計する", () => {
  const summaries = aggregateCommunityReports(
    [
      report("yamanote", "a", "delayed", 5),
      report("yamanote", "b", "delayed", 15),
      report("yamanote", "c", "on-time"),
    ],
    NOW,
  );
  assert.equal(summaries[0].status, "delayed");
  assert.equal(summaries[0].delayMinutes, 10);
  assert.equal(summaries[0].voteCount, 3);
  assert.deepEqual(summaries[0].counts, {
    onTime: 1,
    delayed: 2,
    suspended: 0,
  });
});

test("同数なら重大度が高い見合わせ報告を優先する", () => {
  const summaries = aggregateCommunityReports(
    [
      report("tokaido", "a", "on-time"),
      report("tokaido", "b", "suspended"),
    ],
    NOW,
  );
  assert.equal(summaries[0].status, "suspended");
});

test("30分を過ぎた投稿と未来日時は集計しない", () => {
  const summaries = aggregateCommunityReports(
    [
      report(
        "yamanote",
        "expired",
        "delayed",
        10,
        new Date(NOW - COMMUNITY_REPORT_WINDOW_MS - 1).toISOString(),
      ),
      report(
        "yamanote",
        "future",
        "suspended",
        null,
        new Date(NOW + 1).toISOString(),
      ),
      report("tokaido", "active", "on-time"),
    ],
    NOW,
  );
  assert.deepEqual(
    summaries.map((summary) => summary.lineId),
    ["tokaido"],
  );
});

test("路線ごとに独立して集計する", () => {
  const summaries = aggregateCommunityReports(
    [
      report("yamanote", "a", "delayed", 3),
      report("tokaido", "b", "suspended"),
    ],
    NOW,
  );
  assert.deepEqual(
    summaries.map((summary) => [
      summary.lineId,
      summary.status,
    ]),
    [
      ["tokaido", "suspended"],
      ["yamanote", "delayed"],
    ],
  );
});

test("端末IDを変えても同じ接続元の投票は重複集計しない", () => {
  const summaries = aggregateCommunityReports(
    [
      report("tokaido", "device-a", "suspended", null, undefined, "source-a"),
      report("tokaido", "device-b", "suspended", null, undefined, "source-a"),
      report("tokaido", "device-c", "on-time", null, undefined, "source-b"),
    ],
    NOW,
  );
  assert.equal(summaries[0].voteCount, 2);
  assert.deepEqual(summaries[0].counts, {
    onTime: 1,
    delayed: 0,
    suspended: 1,
  });
});
