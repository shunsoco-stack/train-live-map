# Train Live Map

東海道線 **東京〜横浜** 間の電車位置を、地図上でほぼリアルタイムに確認するための検証用 Web アプリ(MVP)です。

- 電車がいまどのあたりを走っているか
- 駅間で停止している場合、どこで何分ほど止まっているか
- 遅延・運転見合わせなどの状況

を、スマートフォンから素早く把握できることを目的にしています。

> ⚠️ **既定ではモック(擬似)データで動作します。**
> 公共交通オープンデータセンター(ODPT)のアクセストークンを設定すると、
> **ODPT の実データ(`odpt:Train` / `odpt:TrainInformation`)へ自動的に切り替わります**。
> ODPT 取得に失敗した場合は自動でモックにフォールバックし、画面に
> 「現在モックデータを表示しています」と明示します(後述の「ODPT 実データ接続」参照)。

---

## 使用技術

| 分類 | 技術 |
| --- | --- |
| フレームワーク | Next.js（App Router）/ React 19 |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 地図 | MapLibre GL JS + OpenStreetMap 系タイル（CARTO Voyager / 明るい Google Maps 風） |
| 実データ | 公共交通オープンデータセンター（ODPT）API |
| アイコン | lucide-react |
| Lint | ESLint（eslint-config-next） |
| パッケージ管理 | npm |

追加ライブラリは最小限に抑えています。

---

## セットアップ方法

### かんたん起動（macOS・推奨）

ターミナルに次の 1 行を貼り付けて実行すると、**Node.js の確認 → 取得 → 依存導入 → 起動 → ブラウザ自動オープン**まで自動で行います。

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/shunsoco-stack/baobao-privacy-policy/claude/train-live-map-mvp-goow6f/scripts/start-mac.sh)
```

- リポジトリは `~/train-live-map` に取得されます（変更する場合は `TRAIN_LIVE_MAP_DIR=/path/to/dir` を指定）。
- Node.js が未導入の場合、Homebrew があれば自動導入し、無ければ公式ダウンロードページを開いて案内します。
- 停止するにはターミナルで `Ctrl+C` を押します。

### 手動セットアップ

前提: Node.js 18.18 以上（推奨 20 以上）と npm。

```bash
git clone https://github.com/shunsoco-stack/baobao-privacy-policy.git
cd baobao-privacy-policy
git checkout claude/train-live-map-mvp-goow6f
npm install
```

### 起動方法

開発サーバー:

```bash
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。

本番ビルド / 起動:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

---

## ディレクトリ構成

責務ごとにディレクトリを分けています。

```
src/
  app/                     # Next.js App Router（ページ・レイアウト・API）
    api/
      trains/route.ts         # GET /api/trains
      service-status/route.ts # GET /api/service-status
      dev/debug/route.ts      # GET /api/dev/debug（開発時のみ）
    dev/debug/page.tsx        # デバッグ画面（開発時のみ）
    layout.tsx
    page.tsx                  # サーバーコンポーネント（薄い入口）
    globals.css
  components/              # 汎用 UI（ヘッダー・データ元バッジ・注意書き・更新状況・エラー表示）
  features/               # 機能単位のコンポーネント
    map/                    # 地図（MapLibre）
    trains/                 # 列車一覧・詳細・フィルター・データ取得フック
    service-status/         # 運行情報バー
    dev/                    # デバッグ画面のビュー
  lib/                    # 汎用ロジック（時刻・座標・状態判定・API クライアント・ログ）
    odpt/                   # ODPT 専用（config / types / api / mapper）
  services/               # サービス層（プロバイダ選択・フォールバック・デバッグ）
  providers/              # データ取得プロバイダ（Mock / ODPT / GTFS-RT / JR東日本）
  types/                  # 型定義（ドメイン型）
  data/                   # 静的データ（駅・路線 GeoJSON）
```

### データの流れ

```
UI (features)  →  lib/apiClient  →  /api/*（Route Handler）
                                        ↓
                              services/trainLocationService
                                        ↓
        ┌───────────────────────────────┴───────────────────────────────┐
        │ ODPT トークンあり → OdptTrainLocationProvider（実データ）        │
        │   └─ 取得失敗時は自動で ↓ へフォールバック                       │
        │ ODPT トークンなし / 失敗 → MockTrainLocationProvider（モック）    │
        └────────────────────────────────────────────────────────────────┘
```

UI は個々のプロバイダ実装を直接参照せず、**必ず API 経由 → サービス層 → プロバイダ**の順でデータを取得します。これによりデータ取得部分が UI から分離され、差し替えが容易です。

---

## モックデータの説明

`src/providers/MockTrainLocationProvider.ts` が擬似的な列車データを生成します。

- 列車は路線の GeoJSON（`src/data/routeLine.ts`）上を、[0, 1] のフラクションで移動するため**線路から外れません**。
- 動きはサーバープロセス起動時刻を基準にした**決定論的な時間関数**です。ページを更新しても連続的で一貫した動きになります。
- 停止中の列車の停止時間は、実時間の経過に応じて増えていきます（画面上では 1 秒ごとに更新表示）。

再現している主な状況:

| 列車 | 状況 |
| --- | --- |
| 945M | 品川〜川崎間で約 8 分停止中（赤） |
| 731M | 新橋〜品川間を通常走行（緑） |
| 1002M | 川崎〜横浜間で 3 分遅延（走行中） |
| 1108M | 横浜駅付近で運転見合わせ（濃赤・黒） |
| 1215M | 品川〜川崎間で停止直後（黄） |
| 812M | 東京〜新橋間を走行（緑） |

列車アイコンは状態によって**色・記号・ラベル**が変わり、色だけに依存せず判別できます。

- 走行中: 緑 `▶`
- 1 分以上停止: 黄 `‖`
- 5 分以上停止: 赤 `■`
- 運転見合わせ: 濃赤／黒 `✕`
- データが古い・不明: グレー `？`

---

## ODPT 実データ接続

データ取得は `TrainLocationProvider` インターフェース（`src/providers/TrainLocationProvider.ts`）に抽象化されています。

```ts
interface TrainLocationProvider {
  getTrainLocations(): Promise<TrainLocation[]>;
  getServiceStatus(): Promise<ServiceStatus>;
  readonly isMock: boolean;
}
```

実データ用に `OdptTrainLocationProvider`（`src/providers/OdptTrainLocationProvider.ts`）を追加済みです。`MockTrainLocationProvider` は削除せず、フォールバックとして残しています。

### ODPT とは（API 調査サマリ）

- **提供元**: 公共交通オープンデータ協議会（公共交通オープンデータセンター / ODPT）。
- **利用可能な API（v4）**: `https://api.odpt.org/api/v4/`
  - `odpt:Train` … 列車位置（**駅間ベース**。多くの事業者で緯度経度は持たない）
  - `odpt:TrainInformation` … 運行情報（遅延・見合わせ等）
  - ほかに `odpt:Railway` / `odpt:Station` / `odpt:TrainTimetable` など。
- **認証方法**: 発行されたアクセストークンをクエリ `acl:consumerKey=<TOKEN>` に付与。
- **東海道線が対象か**: JR 東日本の列車ロケーション情報（`r_train_location-jreast`）が公開されており、路線 `odpt.Railway:JR-East.Tokaido` が対象候補です。ただし**区間・時間帯によって提供有無が変動**するため、実トークンでの確認が必要です（本アプリは空応答・未提供でも安全にフォールバックします）。
- **東京〜横浜が取得できるか**: 取得できた列車のうち、`fromStation` / `toStation` が対象 5 駅（東京・新橋・品川・川崎・横浜）に紐付くものだけを表示します。区間外の列車は除外します。
- **レスポンス例（`odpt:Train`）**:

  ```json
  [
    {
      "@type": "odpt:Train",
      "owl:sameAs": "odpt.Train:JR-East.Tokaido.123M",
      "dc:date": "2026-07-24T07:50:00+09:00",
      "odpt:railway": "odpt.Railway:JR-East.Tokaido",
      "odpt:trainNumber": "123M",
      "odpt:trainType": "odpt.TrainType:JR-East.Local",
      "odpt:fromStation": "odpt.Station:JR-East.Tokaido.Shimbashi",
      "odpt:toStation": "odpt.Station:JR-East.Tokaido.Shinagawa",
      "odpt:railDirection": "odpt.RailDirection:Outbound",
      "odpt:delay": 180,
      "odpt:destinationStation": ["odpt.Station:JR-East.Tokaido.Yokohama"]
    }
  ]
  ```

- **更新頻度**: 列車位置は駅通過・数十秒間隔で更新されます（各要素の `odpt:frequency` が推奨再取得間隔の目安）。本アプリは約 7 秒間隔でポーリングします。

### 登録・アクセストークン取得方法

1. ODPT 開発者サイト <https://developer.odpt.org/> にアクセスし、**無料のユーザー登録**を行う。
2. ログイン後、アプリケーションを登録して**アクセストークン（consumerKey）を発行**する。
3. JR 東日本など一部データは、利用にあたり**追加の同意・申請**が必要な場合があります。データカタログ <https://ckan.odpt.org/> で対象データセットの提供条件を確認してください。

### 環境変数設定

**かんたん設定（推奨）**: リポジトリのディレクトリで次を実行し、トークンを貼り付けます。入力内容は画面に表示されず、`.env.local`（権限 600 / git 管理外）に保存されます。

```bash
bash scripts/set-odpt-token.sh
```

設定後、開発サーバーを再起動（`Ctrl+C` → `npm run dev`）すると実データに切り替わります。
`http://localhost:3000/dev/debug` の **接続診断** で、列車位置・運行情報・路線一覧それぞれの取得可否を確認できます。

**手動設定**: `.env.example` をコピーして `.env.local` を作成し、トークンを設定します。

```bash
cp .env.example .env.local
```

```dotenv
# 必須（未設定ならモックで動作）
ODPT_ACCESS_TOKEN=発行されたトークン

# 任意（未設定なら既定値）
# ODPT_API_BASE_URL=https://api.odpt.org/api/v4
# ODPT_RAILWAY=odpt.Railway:JR-East.Tokaido
# ODPT_OPERATOR=odpt.Operator:JR-East
# ODPT_TIMEOUT_MS=8000
# ODPT_RETRIES=2
```

**トークンはコードに埋め込まないでください。** `.env.local` / `.env*` は `.gitignore` 済みでコミットされません。設定後、開発サーバーを再起動すると自動的に ODPT 実データへ切り替わります。

### フォールバック動作

- `ODPT_ACCESS_TOKEN` 未設定 … 最初からモックで動作（「現在モックデータを表示しています(ODPT 未設定)」）。
- ODPT 取得成功 … 実データを表示（ヘッダーに「ODPT ライブ(推定位置)」）。
- ODPT 取得失敗（HTTP エラー・タイムアウト・解析失敗など）… **自動でモックへフォールバック**し、「現在モックデータを表示しています(実データの取得に失敗したため)」を表示。
- サービス層（`src/services/trainLocationService.ts`）が優先順位とフォールバックを一元管理します。UI の変更は不要です。

### デバッグ画面（開発時のみ）

- `http://localhost:3000/dev/debug` … 取得成功可否・使用中 Provider・件数・通信時間・更新時刻・エラー内容・レスポンス JSON（先頭 3 件）を表示。
- **接続診断**セクションで、次の 3 つを個別に検査します。実データが出ないときの切り分けに使ってください。
  - 列車位置 `odpt:Train`（対象路線）
  - 運行情報 `odpt:TrainInformation`（対象路線）
  - 路線一覧 `odpt:Railway`（対象事業者）→ 利用可能な路線 ID を一覧表示。対象路線が一覧に無ければ `.env.local` の `ODPT_RAILWAY` を正しい ID に変更します。
- `GET /api/dev/debug` … 同等の情報を JSON で返却。
- どちらも `NODE_ENV === "production"` では 404 になります。

### 位置は「実測」か「推定」か

- `odpt:Train` は基本的に緯度経度を持たないため、`fromStation` / `toStation` と路線 GeoJSON から**位置を推定**します（`dataAccuracy: "estimated"`、駅間の中点に配置）。
- 万一 ODPT が `geo:lat` / `geo:long` を返す場合はそれを使用（`dataAccuracy: "actual"`）。
- 推定であることは詳細パネルの「データ精度」と注意書き「位置情報はモックまたは推定です」で明示します。

### 今後 GTFS-RT / JR東日本 API へ切り替える場合の変更箇所

- 雛形 `src/providers/GtfsRealtimeProvider.ts` / `src/providers/JrEastProvider.ts` を実装。
- `src/services/trainLocationService.ts` の `getRealProvider()` の分岐を追加（例: `new GtfsRealtimeProvider(process.env.GTFS_RT_FEED_URL ?? "")`）。
- GTFS-RT の場合は VehiclePositions が緯度経度を持つため、`src/lib/odpt/mapper.ts` の推定ロジックの代わりに座標を直接 `TrainLocation` へ変換すればよい（推定 → 実測）。
- **UI・型・API 経路の変更は不要**です。

---

## 今後の拡張案

以下を追加しやすい構成にしています。

- 対象区間の延長: **東京〜熱海**
- 他路線: 京浜東北線 / 横須賀線 / 上野東京ライン / 湘南新宿ライン
  - 駅データ（`src/data/stations.ts`）と路線 GeoJSON（`src/data/routeLine.ts`）を路線ごとに追加
- 列車停止通知（しきい値超過でプッシュ）
- 障害履歴の記録・表示
- 時刻を巻き戻して再生するリプレイ機能
- Supabase への履歴保存
- PWA 対応
- iOS / Android アプリ化
- 実際の GTFS-RT 接続

---

## 現在の制約

- **既定ではモックデータ**で動作します。ODPT トークン設定時のみ実データに切り替わります。
- ODPT の `odpt:Train` は**位置を駅間で表現**するため、地図上の位置は**推定（駅間の中点）**です。実際の走行位置とは差があります。
- ODPT は**進捗率・速度・駅間停止の開始時刻を提供しない**ため、実データ時は速度が推定値、停止時間（`stoppedSince`）は表示されません。駅間停止の検知にはスナップショットの差分比較（今後の課題）が必要です。
- JR 東日本 東海道線のリアルタイム提供は**区間・時間帯で変動**します。未提供時は対象列車が 0 件になり得ます。
- 対象は東海道線 東京〜横浜間の 5 駅のみです。
- 路線形状は概略で、細かい線路形状（分岐・カーブ）は再現していません。
- モックの停止時間はサーバープロセスの起動時刻を基準にしているため、サーバー再起動で基準がリセットされます。

---

## 地図タイル利用時の注意

- 本アプリは OpenStreetMap ベースの **CARTO Voyager**（明るい Google Maps 風）ラスタタイルを使用しています。
- 地図タイルには各提供元の**利用規約・利用制限（レート制限、帰属表示など）**があります。
  - OpenStreetMap: <https://www.openstreetmap.org/copyright>
  - CARTO: <https://carto.com/attributions>
- 個人検証用途を超える利用（本番運用・商用）では、必ず各提供元の利用条件を確認し、必要に応じて**自前のタイルサーバー**や**契約済みプロバイダ**へ差し替えてください。
- 帰属表示（attribution）は地図右下に表示しています。削除しないでください。

## 外部データ利用規約の確認

- **ODPT**: 利用にあたっては公共交通オープンデータセンターの利用規約・データ提供者ごとの条件に従ってください。データセットの提供条件は <https://ckan.odpt.org/> 、開発者向け情報は <https://developer.odpt.org/> で確認できます。JR 東日本など一部データは追加の同意・申請が必要な場合があります。
- 取得データの**表示・保存・二次利用・再配布の可否は提供元により異なります**。本アプリのように履歴保存（将来の Supabase 連携など）を行う場合は、保存・再配布が許諾されているか必ず確認してください。
- 将来 GTFS-RT や他の API へ接続する際も、**各データ提供者の利用規約・ライセンス・帰属表示条件を必ず確認**してください。
