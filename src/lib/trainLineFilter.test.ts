import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TRAIN_LINE_FILTER_COUNT,
  parseTrainLineFilter,
  trainsApiUrl,
} from "./trainLineFilter.ts";

const knownIds = new Set(["tokaido", "yamanote", "chuo-rapid"]);
const isKnown = (lineId: string) => knownIds.has(lineId);

test("lines未指定は全件、空指定は0件として区別する", () => {
  assert.deepEqual(parseTrainLineFilter(null, isKnown), {
    valid: true,
    lineIds: null,
  });
  assert.deepEqual(parseTrainLineFilter("", isKnown), {
    valid: true,
    lineIds: new Set(),
  });
});

test("複数路線と重複を安全に正規化する", () => {
  assert.deepEqual(
    parseTrainLineFilter("tokaido,yamanote,tokaido", isKnown),
    {
      valid: true,
      lineIds: new Set(["tokaido", "yamanote"]),
    },
  );
  assert.equal(
    trainsApiUrl(["yamanote", "tokaido", "yamanote"]),
    "/api/trains?lines=tokaido%2Cyamanote",
  );
});

test("不正文字・未知ID・過剰件数を拒否する", () => {
  for (const value of ["tokaido!", "unknown", "tokaido,,yamanote"]) {
    assert.deepEqual(parseTrainLineFilter(value, isKnown), {
      valid: false,
      lineIds: null,
    });
  }

  const tooMany = Array.from(
    { length: MAX_TRAIN_LINE_FILTER_COUNT + 1 },
    () => "tokaido",
  ).join(",");
  assert.deepEqual(parseTrainLineFilter(tooMany, isKnown), {
    valid: false,
    lineIds: null,
  });
});

test("クライアントURLは未指定・空指定を区別する", () => {
  assert.equal(trainsApiUrl(), "/api/trains");
  assert.equal(trainsApiUrl([]), "/api/trains?lines=");
});
