import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrainDashboardViewState } from "./trainDashboardViewState.ts";

test("路線未選択は読み込み中やエラーより優先する", () => {
  assert.equal(
    resolveTrainDashboardViewState({
      loading: true,
      visibleLineCount: 0,
      trainCount: 0,
      filteredTrainCount: 0,
      hasLoadedData: false,
      error: "通信できません",
    }),
    "no-selection",
  );
});

test("初回読み込み中はローディングを表示する", () => {
  assert.equal(
    resolveTrainDashboardViewState({
      loading: true,
      visibleLineCount: 1,
      trainCount: 0,
      filteredTrainCount: 0,
      hasLoadedData: false,
      error: null,
    }),
    "loading",
  );
});

test("取得済みデータが0件なら後続エラーより空状態を優先する", () => {
  assert.equal(
    resolveTrainDashboardViewState({
      loading: false,
      visibleLineCount: 1,
      trainCount: 0,
      filteredTrainCount: 0,
      hasLoadedData: true,
      error: "再取得に失敗しました",
    }),
    "no-trains",
  );
});

test("列車はあるが選択フィルタが0件なら専用の空状態にする", () => {
  assert.equal(
    resolveTrainDashboardViewState({
      loading: false,
      visibleLineCount: 1,
      trainCount: 4,
      filteredTrainCount: 0,
      hasLoadedData: true,
      error: "再取得に失敗しました",
    }),
    "no-filter-results",
  );
});

test("取得成功前のエラーはエラー表示にする", () => {
  assert.equal(
    resolveTrainDashboardViewState({
      loading: false,
      visibleLineCount: 1,
      trainCount: 0,
      filteredTrainCount: 0,
      hasLoadedData: false,
      error: "通信できません",
    }),
    "error",
  );
});

test("列車がある通常状態はreadyにする", () => {
  assert.equal(
    resolveTrainDashboardViewState({
      loading: false,
      visibleLineCount: 1,
      trainCount: 2,
      filteredTrainCount: 2,
      hasLoadedData: true,
      error: null,
    }),
    "ready",
  );
});
