import assert from "node:assert/strict";
import test from "node:test";
import type { LngLat } from "../../types/geo.ts";
import {
  classifySaikyoKawagoeTrain,
  KAWAGOE_RAILWAY_ID,
  SAIKYO_KAWAGOE_RAILWAY_ID,
  splitSaikyoKawagoePaths,
} from "./saikyoKawagoe.ts";

const OSAKI_TO_KAWAGOE: LngLat[] = [
  [139.728, 35.62],
  [139.7, 35.69],
  [139.625, 35.906],
  [139.58, 35.91],
  [139.483, 35.91],
];

test("ODPT路線IDと現在区間から埼京線・川越線を分類する", () => {
  assert.equal(
    classifySaikyoKawagoeTrain(SAIKYO_KAWAGOE_RAILWAY_ID, [
      [139.7, 35.69],
    ]),
    "saikyo",
  );
  assert.equal(
    classifySaikyoKawagoeTrain(SAIKYO_KAWAGOE_RAILWAY_ID, [
      [139.54, 35.91],
    ]),
    "kawagoe",
  );
  assert.equal(
    classifySaikyoKawagoeTrain(KAWAGOE_RAILWAY_ID, []),
    "kawagoe",
  );
  assert.equal(
    classifySaikyoKawagoeTrain(
      "odpt.Railway:JR-East.NotSaikyoKawagoe",
      [[139.54, 35.91]],
    ),
    null,
  );
});

test("結合線形を大崎〜大宮側と大宮〜川越側へ分割する", () => {
  const result = splitSaikyoKawagoePaths([OSAKI_TO_KAWAGOE]);

  assert.equal(result.saikyo.length, 1);
  assert.equal(result.kawagoe.length, 1);
  assert.deepEqual(result.saikyo[0][0], [139.728, 35.62]);
  assert.deepEqual(result.kawagoe[0].at(-1), [139.483, 35.91]);
  assert.equal(
    result.saikyo[0].some(([longitude]) => longitude < 139.55),
    false,
  );
  assert.equal(
    result.kawagoe[0].some(([, latitude]) => latitude < 35.87),
    false,
  );
});

test("点順が逆でも同じ区間へ分割する", () => {
  const result = splitSaikyoKawagoePaths([
    [...OSAKI_TO_KAWAGOE].reverse(),
  ]);

  assert.deepEqual(result.saikyo[0].at(-1), [139.728, 35.62]);
  assert.deepEqual(result.kawagoe[0][0], [139.483, 35.91]);
});

test("分割不能な線形は未クリップ線形へ戻さない", () => {
  const result = splitSaikyoKawagoePaths([
    [
      [139.728, 35.62],
      [139.7, 35.69],
      [139.66, 35.82],
    ],
  ]);
  assert.deepEqual(result, { saikyo: [], kawagoe: [] });
});

test("分割結果は入力座標の参照を共有しない", () => {
  const input = OSAKI_TO_KAWAGOE.map(
    ([longitude, latitude]) => [longitude, latitude] as LngLat,
  );
  const result = splitSaikyoKawagoePaths([input]);
  result.saikyo[0][0][0] = 0;
  assert.equal(input[0][0], 139.728);
});
