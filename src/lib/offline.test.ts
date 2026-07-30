import assert from "node:assert/strict";
import test from "node:test";
import { parseLastTrainDataAt } from "./offline.ts";

test("最後の取得時刻は有効なISO時刻だけを復元する", () => {
  assert.equal(
    parseLastTrainDataAt("2026-07-31T00:00:00.000Z")?.toISOString(),
    "2026-07-31T00:00:00.000Z",
  );
  assert.equal(parseLastTrainDataAt("not-a-date"), null);
  assert.equal(parseLastTrainDataAt(null), null);
});
