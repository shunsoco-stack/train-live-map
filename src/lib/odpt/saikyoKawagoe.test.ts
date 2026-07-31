import assert from "node:assert/strict";
import test from "node:test";
import {
  isSaikyoKawagoeRailway,
  splitSaikyoKawagoePaths,
  splitSaikyoKawagoeStations,
} from "./saikyoKawagoe.ts";

const osaki = [139.72824, 35.61994] as const;
const omiya = [139.62396, 35.90626] as const;
const nisshin = [139.60606, 35.93153] as const;
const kawagoe = [139.4832, 35.90668] as const;

test("単独の川越線を埼京線・川越線の共通系統と誤判定しない", () => {
  assert.equal(
    isSaikyoKawagoeRailway("odpt.Railway:JR-East.Kawagoe"),
    false,
  );
  assert.equal(
    isSaikyoKawagoeRailway("odpt.Railway:JR-East.SaikyoKawagoe"),
    true,
  );
});

test("大崎〜川越の線形を大宮で埼京線と川越線に分ける", () => {
  const paths = [[osaki, omiya, nisshin, kawagoe]];

  assert.deepEqual(splitSaikyoKawagoePaths(paths, "saikyo"), [
    [osaki, omiya],
  ]);
  assert.deepEqual(splitSaikyoKawagoePaths(paths, "kawagoe"), [
    [omiya, nisshin, kawagoe],
  ]);
});

test("川越線の駅一覧に接続駅の大宮を含める", () => {
  const stations = [
    { id: "osaki", name: "大崎", position: osaki },
    { id: "omiya", name: "大宮", position: omiya },
    { id: "nisshin", name: "日進", position: nisshin },
    { id: "kawagoe", name: "川越", position: kawagoe },
  ];

  assert.deepEqual(
    splitSaikyoKawagoeStations(stations, "saikyo").map(
      (station) => station.name,
    ),
    ["大崎", "大宮"],
  );
  assert.deepEqual(
    splitSaikyoKawagoeStations(stations, "kawagoe").map(
      (station) => station.name,
    ),
    ["大宮", "日進", "川越"],
  );
});
