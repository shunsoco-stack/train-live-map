# Train Live Map — 開発引き継ぎドキュメント

このドキュメントは、**別の開発者/AI エージェントが本プロジェクトを引き継ぐため**の完全な資料です。
アプリの目的・設計・全ファイルの役割・現状・既知の制約・次にやるべきことをまとめています。

- **リポジトリ**: `shunsoco-stack/train-live-map`（public）
- **既定ブランチ**: `main`

---

## 1. アプリ概要

東海道線 **東京〜横浜** 間の電車位置を地図上でほぼリアルタイムに表示する Web アプリ（MVP・自分用検証版）。

主な目的:
- 電車がいまどのあたりを走っているか
- 駅間で停止している場合、どこで何分止まっているか
- 遅延・運転見合わせの状況

将来的に「東京〜熱海への延伸」「他路線（京浜東北線・横須賀線・上野東京ライン・湘南新宿ライン）」「iOS/Android アプリ化」へ拡張できる設計にしてあります。

---

## 2. 技術スタック

| 分類 | 採用技術 | 備考 |
| --- | --- | --- |
| フレームワーク | Next.js 15.1.6（App Router） | React 19 |
| 言語 | TypeScript（strict） | **`any` 不使用** |
| スタイリング | Tailwind CSS v3 | ダークテーマ基調 |
| 地図 | MapLibre GL JS v4 | ラスタタイル（CARTO Voyager） |
| アイコン | lucide-react | 地図マーカーは自前 SVG |
| Lint | ESLint（eslint-config-next） | **警告ゼロを維持** |
| パッケージ管理 | npm | |

> 方針: **追加ライブラリを極力増やさない**。状態管理ライブラリ・データ取得ライブラリは使わず、React の標準 API のみで実装しています。

---

## 3. アーキテクチャ（最重要）

### 設計の核: データ取得を UI から完全分離

```
UI (features/)
   ↓ lib/apiClient.ts        …… fetch のみ
/api/trains, /api/service-status   …… Next.js Route Handler
   ↓
services/trainLocationService.ts   …… ★プロバイダ選択とフォールバックを一元管理
   ↓
providers/*Provider.ts             …… 実際のデータ取得
   ├─ OdptTrainLocationProvider（実データ・ODPT）
   ├─ MockTrainLocationProvider （モック・フォールバック用）
   ├─ GtfsRealtimeProvider      （雛形・未実装）
   └─ JrEastProvider            （雛形・未実装）
```

**UI は具体的なプロバイダを一切参照しません。** データソースを差し替える際は
`services/trainLocationService.ts` の `getRealProvider()` を変更するだけで、UI・型・API 経路の変更は不要です。

### プロバイダの共通インターフェース

```ts
// src/providers/TrainLocationProvider.ts
export interface TrainLocationProvider {
  getTrainLocations(): Promise<TrainLocation[]>;
  getServiceStatus(): Promise<ServiceStatus>;
  readonly isMock: boolean;
}
```

### フォールバック動作（重要な仕様）

`services/trainLocationService.ts` の `withProvider()` が制御します。

| 状況 | 表示されるデータ | 画面の通知 |
| --- | --- | --- |
| `ODPT_ACCESS_TOKEN` 未設定 | モック | 「現在モックデータを表示しています(ODPT 未設定)。」 |
| ODPT 取得成功 | **実データ** | 通知なし・ヘッダーが「ODPT ライブ(推定位置)」 |
| ODPT 取得失敗（HTTP/タイムアウト/解析エラー） | モックへ**自動フォールバック** | 「現在モックデータを表示しています(実データの取得に失敗したため)。」 |

API レスポンスには `source`（`"odpt"` / `"mock"`）、`fallback`（boolean）、`notice`（string|null）が含まれ、UI はこれを表示します。

---

## 4. ディレクトリ構成と全ファイルの役割

```
src/
├── app/                                  # App Router
│   ├── layout.tsx                        # ルートレイアウト・メタデータ・viewport(iOS対応)
│   ├── page.tsx                          # トップ(サーバーコンポーネント。TrainDashboard を描画するだけ)
│   ├── globals.css                       # Tailwind + セーフエリア + MapLibre のダーク調整
│   ├── api/
│   │   ├── trains/route.ts               # GET /api/trains
│   │   ├── service-status/route.ts       # GET /api/service-status
│   │   └── dev/debug/route.ts            # GET /api/dev/debug（本番は404）
│   └── dev/debug/page.tsx                # デバッグ画面（本番は404）
│
├── components/                           # 汎用UI
│   ├── AppHeader.tsx                     # アプリ名・サブタイトル・データ元バッジ・更新状況
│   ├── DataSourceBadge.tsx               # 「モックデータ使用中」/「ODPT ライブ(推定位置)」
│   ├── DataSourceNotice.tsx              # モック表示中の注意バナー
│   ├── UpdateStatus.tsx                  # 最終更新時刻・次回更新までの秒数(1秒ごと)
│   └── ErrorNotice.tsx                   # 取得失敗時の通知＋再取得ボタン
│
├── features/                             # 機能単位
│   ├── map/
│   │   ├── MapPanel.tsx                  # next/dynamic(ssr:false) で地図を遅延読込＋ローディング
│   │   ├── TrainMapInner.tsx             # ★MapLibre 本体。路線・駅・列車マーカー描画
│   │   └── mapStyle.ts                   # 地図スタイル(CARTO Voyager + 背景レイヤー)
│   ├── trains/
│   │   ├── TrainDashboard.tsx            # ★画面全体を束ねるクライアントコンポーネント
│   │   ├── TrainDetailPanel.tsx          # 詳細ボトムシート(スマホは下から表示)
│   │   ├── TrainFilterBar.tsx            # フィルター(すべて/走行中/停止中/遅延/運転見合わせ)
│   │   ├── StoppedDuration.tsx           # 停止時間を1秒ごとに更新表示
│   │   └── useTrainData.ts               # ★データ取得フック(7秒ごとポーリング)
│   ├── service-status/
│   │   └── ServiceStatusBar.tsx          # 運行情報バー(重要度で色分け)
│   └── dev/
│       └── DebugView.tsx                 # デバッグ画面のUI(接続診断を含む)
│
├── lib/                                  # 汎用ロジック
│   ├── apiClient.ts                      # /api/* を叩くクライアント
│   ├── time.ts                           # ★時刻処理を集約(経過秒・「12分05秒」整形・時刻表示)
│   ├── geo.ts                            # Haversine距離・ポリライン累積距離・fraction→座標
│   ├── routeGeometry.ts                  # ★駅ID↔fraction変換、駅間内挿、進行方向の方位角計算
│   ├── trainStatus.ts                    # ★状態→色/記号/ラベル、フィルター判定、日本語表記
│   ├── useNow.ts                         # 一定間隔で現在時刻を返すフック
│   ├── logger.ts                         # 構造化ログ(時刻・レベル・スコープ)
│   └── odpt/                             # ODPT専用
│       ├── config.ts                     # 環境変数の読込(トークン・路線・タイムアウト等)
│       ├── types.ts                      # odpt:Train / TrainInformation / Railway の型
│       ├── api.ts                        # ★認証・タイムアウト・リトライ・エラー分類・ログ
│       └── mapper.ts                     # ★ODPT→TrainLocation変換＋駅間からの位置推定
│
├── services/
│   └── trainLocationService.ts           # ★プロバイダ選択・フォールバック・デバッグ用診断
│
├── providers/
│   ├── TrainLocationProvider.ts          # 共通インターフェース
│   ├── MockTrainLocationProvider.ts      # ★モック(決定論的に動く6列車)
│   ├── OdptTrainLocationProvider.ts      # ODPT実装
│   ├── GtfsRealtimeProvider.ts           # 雛形(未実装・throwする)
│   └── JrEastProvider.ts                 # 雛形(未実装・throwする)
│
├── types/
│   ├── train.ts                          # ★ドメイン型(TrainLocation, ServiceStatus, API型)
│   └── geo.ts                            # LngLat, Station, RouteLineFeature
│
└── data/
    ├── stations.ts                       # 対象5駅の正確な緯度経度
    └── routeLine.ts                      # 路線形状(GeoJSON LineString・中間点付き)

scripts/
├── start-mac.sh                          # macOS向け:Node確認→取得→install→起動→ブラウザ起動
└── set-odpt-token.sh                     # ODPTトークンを.env.local(600)へ安全に保存
```

★ = 特に重要なファイル

---

## 5. 主要な型定義

```ts
// src/types/train.ts
export type TrainDirection = "inbound" | "outbound";   // inbound=上り(東京方面) / outbound=下り
export type TrainStatus = "running" | "stopped" | "delayed" | "suspended" | "unknown";
export type DataAccuracy = "actual" | "estimated" | "mock";
export type TrainType = "local" | "rapid" | "special_rapid";
export type ProviderSource = "odpt" | "mock";

export interface TrainLocation {
  id: string;
  trainNumber: string;
  direction: TrainDirection;
  destination: string;
  trainType: TrainType;
  latitude: number;
  longitude: number;
  delayMinutes: number;
  speedKmh: number;
  status: TrainStatus;
  lastUpdatedAt: string;      // ISO8601
  stoppedSince: string | null; // ISO8601。停止していなければ null
  dataAccuracy: DataAccuracy;
}

export interface ServiceStatus {
  lineName: string;
  severity: "normal" | "minor" | "major";
  message: string;
  updatedAt: string;
  dataAccuracy: DataAccuracy;
}
```

API レスポンス（`TrainsApiResponse`）には上記に加えて `generatedAt` / `isMock` / `source` / `fallback` / `notice` が含まれます。

---

## 6. 重要な実装ポイント

### 6-1. 位置の扱い（実測 vs 推定）

ODPT の `odpt:Train` は **多くの場合、緯度経度を返しません**。代わりに `odpt:fromStation` / `odpt:toStation`（駅間）で位置を表現します。

そのため `lib/odpt/mapper.ts` で:
1. `geo:lat` / `geo:long` があればそれを使用 → `dataAccuracy: "actual"`
2. 無ければ **fromStation / toStation から路線 GeoJSON 上の位置を推定** → `dataAccuracy: "estimated"`
   - 現在は**駅間の中点（`BETWEEN_STATION_RATIO = 0.5`）**に配置
   - 対象5駅に紐付かない列車は `null` を返して除外（区間外）

**改善余地**: 時刻表（`odpt:TrainTimetable`）を併用すれば、駅間の進捗率を推定してより正確な位置を出せます。現状は中点固定です。

### 6-2. 列車が線路から外れない仕組み

位置は常に「路線ポリライン上の fraction（0〜1）」として扱い、`lib/geo.ts` の `positionAtFraction()` で座標へ変換します。fraction は 0〜1 にクランプされるため、**構造的に線路から外れません**。

### 6-3. 進行方向（マーカーの向き）

`lib/routeGeometry.ts` の `headingAtPosition(lng, lat, reverse)`:
1. 与えられた座標に最も近い線路区間を探す（点-線分距離、平面近似）
2. その区間の方位角を Haversine ベースで算出
3. `reverse=true`（上り）なら 180° 反転

路線座標は 東京 → 横浜 の順なので、その向きが「下り」です。
計算結果は実測で検証済み: **上り = 北東 26〜42°、下り = 南〜南西 197〜222°**。

### 6-4. 列車マーカーの構成（`TrainMapInner.tsx`）

React ではなく **DOM 直接操作**（MapLibre の `Marker` に HTMLElement を渡す）で描画しています。

マーカー1つの構成:
- 進行方向の三角矢印（方位角ぶん CSS `rotate()`）
- 電車アイコン（lucide train-front 相当の SVG を文字列で埋め込み）
- 列車番号
- **状態記号のバッジ**（右上・`▶ ‖ ■ ✕ ？`）

> **色だけに依存しない**という要件のため、色・記号・ラベルの3重で状態を表現しています。変更時はこの原則を壊さないでください。

### 6-5. 状態の色分け（`lib/trainStatus.ts`）

| 状態 | 色 | 記号 |
| --- | --- | --- |
| 走行中（running / delayed） | 緑 `#22c55e` | ▶ |
| 停止 1分以上 | 黄 `#eab308` | ‖ |
| 停止 5分以上 | 赤 `#ef4444` | ■ |
| 運転見合わせ | 黒 `#111827`＋赤枠 | ✕ |
| 不明・データが古い(90秒超) | グレー `#6b7280` | ？ |

### 6-6. SSR 対策

MapLibre は `window` を参照するため、`MapPanel.tsx` で `next/dynamic(..., { ssr: false })` を使い**クライアントでのみ**読み込んでいます。`TrainMapInner.tsx` を直接 import しないでください。

### 6-7. 地図スタイル

`features/map/mapStyle.ts`。CARTO Voyager（明るい Google Maps 風）のラスタタイル。
**背景レイヤー（`background-color: #e8eaed`）を必ず最下部に置いています** — タイル読込前/失敗時でも路線・駅・列車が描画されるようにするためです（これが無いと地図全体が真っ白/描画されない事象が起きます）。

### 6-8. モックの動き

`MockTrainLocationProvider.ts`。サーバープロセス起動時刻を基準にした**決定論的な時間関数（三角波）**で 6 列車を動かします。再現している状況:

| 列車 | 状況 |
| --- | --- |
| 731M | 新橋〜品川を走行（緑） |
| 812M | 東京〜新橋を走行・上り（緑） |
| 945M | 品川〜川崎で 8 分停止（赤） |
| 1002M | 川崎〜横浜で 3 分遅延（緑） |
| 1108M | 横浜駅付近で運転見合わせ（黒） |
| 1215M | 品川〜川崎で停止直後（黄） |

---

## 7. API 仕様

| エンドポイント | 説明 |
| --- | --- |
| `GET /api/trains` | `{ trains, generatedAt, isMock, source, fallback, notice }` |
| `GET /api/service-status` | `{ serviceStatus, isMock, source, fallback, notice }` |
| `GET /api/dev/debug` | 接続診断（**本番は 404**） |

すべて `export const dynamic = "force-dynamic"`（キャッシュしない）。

---

## 8. ODPT 実データ接続（未完了・要対応）

### 現状
**コードは完成していますが、アクセストークンが未設定のためモックで動作中です。**

### 接続手順
1. https://developer.odpt.org/ で無料ユーザー登録 → アクセストークン発行
2. `bash scripts/set-odpt-token.sh` でトークンを設定（`.env.local` に権限600で保存）
3. `npm run dev` で再起動 → 自動的に実データへ切替

### 環境変数（すべて `.env.local`。`.env.example` 参照）

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `ODPT_ACCESS_TOKEN` | (空) | **必須**。未設定ならモック動作 |
| `ODPT_API_BASE_URL` | `https://api.odpt.org/api/v4` | |
| `ODPT_RAILWAY` | `odpt.Railway:JR-East.Tokaido` | 対象路線 |
| `ODPT_OPERATOR` | `odpt.Operator:JR-East` | 対象事業者 |
| `ODPT_TIMEOUT_MS` | `8000` | |
| `ODPT_RETRIES` | `2` | 指数バックオフ(500ms, 1000ms…) |

> **トークンは絶対にコミットしないでください。** `.env*` は `.gitignore` 済みです。

### ⚠️ 未検証の重要事項

**JR東日本 東海道線の「列車位置」が ODPT で実際に取得できるかは未確認です。**
理由: 開発環境から外部APIへ到達できず、実トークンでの疎通確認ができていません。

- 提供内容は事業者・時期により変動し、**追加の申請・同意が必要な場合**があります
- 路線 ID (`odpt.Railway:JR-East.Tokaido`) が正しいかも未検証です

そのため **`/dev/debug` に「接続診断」を実装済み**です。トークン設定後にここを見れば切り分けできます:

| 診断項目 | 分かること |
| --- | --- |
| 列車位置 `odpt:Train` | 本命。取得できれば地図に実列車が出る |
| 運行情報 `odpt:TrainInformation` | 列車位置がダメでもこれは取れることが多い |
| 路線一覧 `odpt:Railway` | **利用可能な路線IDの一覧**。IDが違えば正しい値が判明する |

**引き継いだ方への最初のお願い**: トークンを設定して `/dev/debug` を確認し、実際に何が取得できるかを確定させてください。

---

## 9. 現在の制約・既知の課題

1. **既定はモックデータ**。ODPT トークン設定時のみ実データ。
2. **位置は推定（駅間の中点）**。ODPT が緯度経度を返さないため。
3. **実データ時は停止時間が出ない**。ODPT に「駅間停止の開始時刻」が無いため `stoppedSince: null`。
   → 検知するには**スナップショットの差分比較**（前回位置と同じなら停止とみなす）の実装が必要。
4. **実データ時の速度は推定値**（走行中は 60km/h 固定、停車中 0）。ODPT が速度を提供しないため。
5. **実データ時の状態判定が粗い**。現在は遅延の有無だけで `running` / `delayed` を決めており、駅間停止・運転見合わせを判定できていません。
6. 対象は**東京〜横浜の5駅のみ**。
7. 路線形状は概略（分岐・カーブ半径は非再現）。
8. モックの停止時間はサーバー再起動でリセットされます。

---

## 10. 開発の進め方

### 起動

```bash
npm install
npm run dev          # http://localhost:3000
```

macOS なら 1 コマンドで全自動（Node導入〜ブラウザ起動まで）:
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/shunsoco-stack/train-live-map/main/scripts/start-mac.sh)
```

### 検証（変更時は必ず両方通すこと）

```bash
npm run lint         # 警告ゼロを維持
npm run build        # 型チェック含む
```

> ⚠️ **`npm run dev` の実行中に `npm run build` を走らせないでください。** `.next` が壊れて
> `Cannot find module './vendor-chunks/...'` や CSS 未適用が発生します。
> 発生した場合は `rm -rf .next && npm run build` で復旧します。

### コーディング規約
- **`any` 禁止**（型を明示するか `unknown` + 絞り込み）
- ESLint 警告ゼロ
- 時刻処理は `lib/time.ts` に集約
- 緯度経度の順序に注意（**GeoJSON/MapLibre は `[経度, 緯度]`**、`TrainLocation` は `latitude`/`longitude` の名前付き）
- クライアントコンポーネント（`"use client"`）は必要最小限に
- アクセシビリティ（`aria-label`、タップ領域 40px 以上）を維持

---

## 11. 今後の拡張ロードマップ

### 優先度: 高（実用化に必要）
1. **ODPT 実データの疎通確認**（`/dev/debug` で何が取れるか確定）
2. **駅間停止の検知**（スナップショット差分。位置が変わらない時間を計測して `stoppedSince` を復元）
3. **位置推定の精度向上**（`odpt:TrainTimetable` を併用して駅間の進捗率を算出）

### 優先度: 中
4. 東京〜熱海への区間延長（`data/stations.ts` と `data/routeLine.ts` に駅・座標を追加）
5. 他路線対応（京浜東北線・横須賀線・上野東京ライン・湘南新宿ライン）
   → **路線ごとに stations/routeLine を持つ構造へリファクタが必要**（現在は単一路線前提）
6. 列車停止通知（しきい値超過でプッシュ）

### 優先度: 低
7. 障害履歴の記録・表示
8. リプレイ機能（時刻を巻き戻して再生）
9. Supabase への履歴保存（**利用規約で保存可否の確認が必要**）
10. PWA 対応
11. iOS / Android アプリ化
12. GTFS-RT 接続（`GtfsRealtimeProvider` を実装 → `getRealProvider()` に分岐追加。GTFS-RT は緯度経度を持つので **推定 → 実測** に格上げできる）

---

## 12. 法務・利用規約（必ず確認）

- **地図タイル**: CARTO Voyager（OpenStreetMap ベース）。帰属表示は地図右下に表示中（**削除しないこと**）。
  - https://www.openstreetmap.org/copyright / https://carto.com/attributions
  - 個人検証を超える利用では利用条件の確認、必要なら自前タイル/契約プロバイダへ差し替え。
- **ODPT**: データ提供者ごとに条件が異なります。JR東日本など一部は追加の同意・申請が必要な場合があります。
  - https://developer.odpt.org/ / https://ckan.odpt.org/
  - **表示・保存・二次利用・再配布の可否は提供元により異なります**。履歴保存機能を作る際は必ず確認してください。

---

## 13. コミット履歴（このブランチ）

| SHA | 内容 |
| --- | --- |
| `39e8560` | MVP 実装（モックデータ・地図・詳細・フィルター） |
| `027bb19` | ODPT プロバイダ追加＋モックフォールバック、地図を明るいタイルへ |
| `3a66892` | 地図の背景レイヤー追加、明るい地図での可読性改善 |
| `132fc58` | macOS 向けワンコマンド起動スクリプト |
| `1fd6aa4` | ODPT トークン設定スクリプト＋接続診断 |
| `fe99b39` | 列車マーカーを電車アイコン化＋進行方向表示 |

---

## 14. 引き継ぎ時の注意（まとめ）

1. **開発は `main` ブランチから開始してください。**
2. **ODPT の実データ疎通は未検証**です。まずトークン設定 → `/dev/debug` 確認から始めてください。
3. データソースを変える時は `services/trainLocationService.ts` の `getRealProvider()` だけ触れば済みます。
4. マーカーの状態表現は**色・記号・ラベルの3重**。色だけにしないでください。
5. `npm run dev` 中に `npm run build` を実行しないでください（`.next` が壊れます）。
6. トークン等の秘密情報をコミットしないでください。
