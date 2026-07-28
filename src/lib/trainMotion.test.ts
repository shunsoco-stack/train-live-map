import assert from "node:assert/strict";
import test from "node:test";
import { advanceEstimatedFraction } from "./trainMotion.ts";

const common = {
  speedKmh: 60,
  routeLengthMeters: 30_000,
  elapsedMs: 1_000,
};

test("下り方向へ少しずつ進む", () => {
  const next = advanceEstimatedFraction({
    ...common,
    currentFraction: 0.3,
    fromFraction: 0.2,
    toFraction: 0.4,
  });

  assert.ok(next > 0.3);
  assert.ok(next < 0.4);
});

test("上り方向へ少しずつ進む", () => {
  const next = advanceEstimatedFraction({
    ...common,
    currentFraction: 0.7,
    fromFraction: 0.8,
    toFraction: 0.6,
  });

  assert.ok(next < 0.7);
  assert.ok(next > 0.6);
});

test("次駅直前の上限を越えない", () => {
  const next = advanceEstimatedFraction({
    ...common,
    currentFraction: 0.37,
    fromFraction: 0.2,
    toFraction: 0.4,
    elapsedMs: 60_000,
  });

  assert.equal(next, 0.376);
});

test("停止中は動かない", () => {
  const next = advanceEstimatedFraction({
    ...common,
    currentFraction: 0.3,
    fromFraction: 0.2,
    toFraction: 0.4,
    speedKmh: 0,
  });

  assert.equal(next, 0.3);
});
