import assert from "node:assert/strict";
import test from "node:test";
import { InFlightRequestGate } from "./requestGate.ts";

test("通信中は同種の2件目を開始しない", () => {
  const gate = new InFlightRequestGate();
  const first = gate.begin();

  assert.ok(first);
  assert.equal(gate.isActive(), true);
  assert.equal(gate.begin(), null);
  assert.equal(gate.release(first), true);
  assert.equal(gate.isActive(), false);
});

test("リセット後は新しい通信を開始できる", () => {
  const gate = new InFlightRequestGate();
  assert.ok(gate.begin());

  gate.reset();

  assert.ok(gate.begin());
});

test("古い通信の完了で新しい通信を解放しない", () => {
  const gate = new InFlightRequestGate();
  const oldToken = gate.begin();
  assert.ok(oldToken);
  gate.reset();
  const newToken = gate.begin();
  assert.ok(newToken);

  assert.equal(gate.release(oldToken), false);
  assert.equal(gate.isActive(), true);
  assert.equal(gate.begin(), null);
  assert.equal(gate.release(newToken), true);
});
