import assert from "node:assert/strict";
import test from "node:test";
import type { ServiceStatus, TrainLocation } from "../../types/train.ts";
import {
  applyFullSuspensionsToTrains,
  mergeOfficialServiceStatus,
  parseJrEastKantoServiceStatuses,
} from "./serviceStatus.ts";

const HTML = `
<p>2026年8月5日 10時33分 現在</p>
<li class="traininfo-routes__table__item">
  <span class="traininfo-routes__name">山手線</span>
  <p class="traininfo-routes__status adjust"><span>１０時４０分頃 運転再開見込</span></p>
  <p class="traininfo-routes__note">山手線は、新宿駅での人身事故の影響で、内・外回り電車で運転を見合わせています。</p>
</li>
<li class="traininfo-routes__table__item">
  <span class="traininfo-routes__name">東海道線</span>
  <p class="traininfo-routes__status normal"><span>平常運転</span></p>
</li>`;

test("JR東日本公式HTMLから見合わせと平常運転を抽出する", () => {
  const statuses = parseJrEastKantoServiceStatuses(HTML);
  assert.equal(statuses.length, 2);
  const yamanote = statuses.find((status) => status.lineId === "yamanote");
  assert.equal(yamanote?.severity, "major");
  assert.match(yamanote?.message ?? "", /内・外回り/);
  assert.equal(yamanote?.sourceLabel, "JR東日本公式");
  assert.equal(
    statuses.find((status) => status.lineId === "tokaido")?.severity,
    "normal",
  );
});

test("公式の異常情報を列車遅延推定より優先する", () => {
  const current: ServiceStatus = {
    lineId: "yamanote",
    lineName: "山手線",
    severity: "major",
    message: "列車位置情報では最大46分の遅れです。",
    updatedAt: "2026-08-05T01:35:00.000Z",
    dataAccuracy: "estimated",
  };
  const official = parseJrEastKantoServiceStatuses(HTML)[0];
  const now = Date.parse("2026-08-05T01:34:00.000Z");
  assert.match(
    mergeOfficialServiceStatus(current, official, now).message,
    /人身事故/,
  );
  assert.equal(
    mergeOfficialServiceStatus(
      current,
      { ...official, updatedAt: "2026-08-05T00:00:00.000Z" },
      now,
    ),
    current,
  );
});

test("全方向の見合わせ時だけ対象路線の車両を見合わせにする", () => {
  const train = {
    id: "1",
    lineId: "yamanote",
    status: "delayed",
    speedKmh: 60,
  } as TrainLocation;
  const official = parseJrEastKantoServiceStatuses(HTML);
  const now = Date.parse("2026-08-05T01:34:00.000Z");
  const [suspended] = applyFullSuspensionsToTrains([train], official, now);
  assert.equal(suspended.status, "suspended");
  assert.equal(suspended.speedKmh, 0);

  const partial = {
    ...official[0],
    message: "一部区間で運転を見合わせています。",
  };
  assert.equal(
    applyFullSuspensionsToTrains([train], [partial], now)[0].status,
    "delayed",
  );
});
