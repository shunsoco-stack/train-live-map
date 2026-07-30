import assert from "node:assert/strict";
import test from "node:test";
import {
  PagePollingController,
  type PagePollingClock,
} from "./pagePolling.ts";

function fakeClock() {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  const cleared: number[] = [];
  const clock: PagePollingClock = {
    setInterval(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearInterval(handle) {
      const id = Number(handle);
      callbacks.delete(id);
      cleared.push(id);
    },
  };
  return { callbacks, cleared, clock };
}

test("表示中かつオンラインなら即時取得して定期取得を開始する", () => {
  const { callbacks, clock } = fakeClock();
  let runs = 0;
  const polling = new PagePollingController(
    [{ intervalMs: 7_000, run: () => void (runs += 1) }],
    clock,
  );

  polling.start(true, true);
  assert.equal(runs, 1);
  assert.equal(callbacks.size, 1);

  [...callbacks.values()][0]?.();
  assert.equal(runs, 2);
});

test("非表示では通信を中断してタイマーを停止する", () => {
  const { callbacks, cleared, clock } = fakeClock();
  let activeSignal: AbortSignal | undefined;
  const polling = new PagePollingController(
    [
      {
        intervalMs: 7_000,
        run: (signal) => {
          activeSignal = signal;
        },
      },
    ],
    clock,
  );

  polling.start(true, true);
  polling.handleVisibilityChange(false, true);

  assert.equal(activeSignal?.aborted, true);
  assert.equal(callbacks.size, 0);
  assert.deepEqual(cleared, [1]);
});

test("表示復帰とオンライン復帰で直ちに1回取得する", () => {
  const { callbacks, clock } = fakeClock();
  let runs = 0;
  const polling = new PagePollingController(
    [{ intervalMs: 20_000, run: () => void (runs += 1) }],
    clock,
  );

  polling.start(false, true);
  assert.equal(runs, 0);
  polling.handleVisibilityChange(true, true);
  assert.equal(runs, 1);
  assert.equal(callbacks.size, 1);

  polling.handleOffline();
  assert.equal(callbacks.size, 0);
  polling.handleOnline(true);
  assert.equal(runs, 2);
  assert.equal(callbacks.size, 1);
});

test("表示中でもオフラインなら即時取得だけ行い定期取得しない", () => {
  const { callbacks, clock } = fakeClock();
  let runs = 0;
  const polling = new PagePollingController(
    [{ intervalMs: 7_000, run: () => void (runs += 1) }],
    clock,
  );

  polling.start(true, false);

  assert.equal(runs, 1);
  assert.equal(callbacks.size, 0);
});
