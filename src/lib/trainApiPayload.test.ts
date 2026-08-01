import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRequestedLineIds,
  trainsForRequestedLines,
} from "./trainApiPayload.ts";
import type { TrainLocation } from "../types/train.ts";

const train: TrainLocation = {
  id: "train-a",
  lineId: "tokaido",
  lineName: "東海道線",
  lineColor: "#f68b1e",
  trainNumber: "1M",
  direction: "outbound",
  destination: "横浜",
  trainType: "local",
  latitude: 35.123456789,
  longitude: 139.987654321,
  delayMinutes: 0,
  speedKmh: 60,
  status: "running",
  lastUpdatedAt: "2026-08-01T00:00:00.000Z",
  stoppedSince: null,
  dataAccuracy: "estimated",
  routeSegment: {
    fromFraction: 0,
    toFraction: 1,
    coordinates: [[139.123456789, 35.987654321]],
  },
};

test("lines未指定は後方互換の全件、空指定は0件を表す", () => {
  assert.deepEqual(parseRequestedLineIds(null), { ok: true, lineIds: null });
  const empty = parseRequestedLineIds("");
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.lineIds?.size, 0);
});

test("linesは形式と最大件数を検証する", () => {
  const parsed = parseRequestedLineIds("tokaido,yamanote");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual([...parsed.lineIds!], ["tokaido", "yamanote"]);
  assert.deepEqual(parseRequestedLineIds("tokaido,<script>"), { ok: false });
  assert.deepEqual(parseRequestedLineIds(Array.from({ length: 45 }, (_, index) => `line-${index}`).join(",")), { ok: false });
});

test("指定路線だけを返し、座標を小数6桁へ丸める", () => {
  const result = trainsForRequestedLines(
    [train, { ...train, id: "train-b", lineId: "yamanote" }],
    new Set(["tokaido"]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].latitude, 35.123457);
  assert.equal(result[0].longitude, 139.987654);
  assert.deepEqual(result[0].routeSegment?.coordinates, [[139.123457, 35.987654]]);
});
