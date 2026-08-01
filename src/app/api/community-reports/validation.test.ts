import assert from "node:assert/strict";
import test from "node:test";
import { validateCommunityReportSubmission } from "../../../lib/communityReportSubmission.ts";

test("利用可能な路線の正常な投票を受け付ける", () => {
  const result = validateCommunityReportSubmission({ lineId: "yamanote", status: "delayed", delayMinutes: 15 });
  assert.equal(result?.vote.lineId, "yamanote");
  assert.equal(result?.catalogLine.name, "山手線");
});

test("未知路線とODPT対象外路線を拒否する", () => {
  assert.equal(validateCommunityReportSubmission({ lineId: "not-found", status: "on-time" }), null);
  assert.equal(validateCommunityReportSubmission({ lineId: "sagami", status: "on-time" }), null);
});

test("遅延分数の境界外と不正な状態を拒否する", () => {
  for (const delayMinutes of [0, 121, 1.5, "15"]) {
    assert.equal(validateCommunityReportSubmission({ lineId: "yamanote", status: "delayed", delayMinutes }), null);
  }
  assert.equal(validateCommunityReportSubmission({ lineId: "yamanote", status: "cancelled" }), null);
});

test("不要な遅延値を平常・見合わせ票へ混入させない", () => {
  assert.deepEqual(
    validateCommunityReportSubmission({ lineId: "tokaido", status: "suspended", delayMinutes: 120 })?.vote,
    { lineId: "tokaido", status: "suspended", delayMinutes: null },
  );
});
