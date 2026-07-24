# Train Live Map

東海道線 **東京〜横浜** 間の電車位置を、地図上でほぼリアルタイムに確認するための検証用 Web アプリ(MVP)です。

- 電車がいまどのあたりを走っているか
- 駅間で停止している場合、どこで何分ほど止まっているか
- 遅延・運転見合わせなどの状況

を、スマートフォンから素早く把握できることを目的にしています。

> ⚠️ **現在表示されている列車位置はすべてモック(擬似)データです。**
> JR東日本の正式なリアルタイム列車位置 API にはまだ接続していません。
> 実データへ差し替えられる設計になっています(後述)。

---

## 使用技術

| 分類 | 技術 |
| --- | --- |
| フレームワーク | Next.js（App Router）/ React 19 |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 地図 | MapLibre GL JS + OpenStreetMap 系タイル（CARTO Dark） |
| アイコン | lucide-react |
| Lint | ESLint（eslint-config-next） |
| パッケージ管理 | npm |

追加ライブラリは最小限に抑えています。

---

## セットアップ方法

前提: Node.js 18.18 以上（推奨 20 以上）と npm。

```bash
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
      trains/route.ts        # GET /api/trains
      service-status/route.ts# GET /api/service-status
    layout.tsx
    page.tsx                 # サーバーコンポーネント（薄い入口）
    globals.css
  components/              # 汎用 UI（ヘッダー・バッジ・更新状況・エラー表示）
  features/               # 機能単位のコンポーネント
    map/                    # 地図（MapLibre）
    trains/                 # 列車一覧・詳細・フィルター・データ取得フック
    service-status/         # 運行情報バー
  lib/                    # 汎用ロジック（時刻・座標・状態判定・API クライアント）
  services/               # サービス層（プロバイダの選択を集約）
  providers/              # データ取得プロバイダ（Mock / GTFS-RT / JR東日本）
  types/                  # 型定義（ドメイン型）
  data/                   # 静的データ（駅・路線 GeoJSON）
```

### データの流れ

```
UI (features)  →  lib/apiClient  →  /api/*（Route Handler）
                                        ↓
                              services/trainLocationService
                                        ↓
                              providers/*Provider（現状は Mock）
```

UI は `MockTrainLocationProvider` を直接参照せず、**必ず API 経由 → サービス層 → プロバイダ**の順でデータを取得します。これによりデータ取得部分が UI から分離され、差し替えが容易です。

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

## 実データ接続時の差し替え方法

データ取得は `TrainLocationProvider` インターフェース（`src/providers/TrainLocationProvider.ts`）に抽象化されています。

```ts
interface TrainLocationProvider {
  getTrainLocations(): Promise<TrainLocation[]>;
  getServiceStatus(): Promise<ServiceStatus>;
  readonly isMock: boolean;
}
```

実データへ移行するには、以下の雛形を実装し、`src/services/trainLocationService.ts` の `createProvider()` が返すプロバイダを差し替えるだけです。UI 側の変更は不要です。

```ts
// src/services/trainLocationService.ts
function createProvider(): TrainLocationProvider {
  // GTFS-Realtime に接続する場合:
  // return new GtfsRealtimeProvider(process.env.GTFS_RT_FEED_URL ?? "");

  // JR東日本 API に接続する場合:
  // return new JrEastProvider(process.env.JR_EAST_API_KEY ?? "");

  return new MockTrainLocationProvider(MODULE_START_MS);
}
```

雛形:

- `src/providers/GtfsRealtimeProvider.ts`
- `src/providers/JrEastProvider.ts`

**API キーやトークンはコードに埋め込まず、環境変数（`.env.local` など）から読み込んでください。** `.env*` は `.gitignore` 済みです。

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

- **列車位置はすべてモックデータ**であり、実際の運行とは無関係です。
- 対象は東海道線 東京〜横浜間の 5 駅のみです。
- 路線形状は概略で、細かい線路形状（分岐・カーブ）は再現していません。
- 停止時間はサーバープロセスの起動時刻を基準にしているため、サーバー再起動で基準がリセットされます。

---

## 地図タイル利用時の注意

- 本アプリは OpenStreetMap ベースの **CARTO Dark** ラスタタイルを使用しています。
- 地図タイルには各提供元の**利用規約・利用制限（レート制限、帰属表示など）**があります。
  - OpenStreetMap: <https://www.openstreetmap.org/copyright>
  - CARTO: <https://carto.com/attributions>
- 個人検証用途を超える利用（本番運用・商用）では、必ず各提供元の利用条件を確認し、必要に応じて**自前のタイルサーバー**や**契約済みプロバイダ**へ差し替えてください。
- 帰属表示（attribution）は地図右下に表示しています。削除しないでください。

## 外部データ利用規約の確認

将来、GTFS-RT や JR東日本の API など外部データに接続する際は、**各データ提供者の利用規約・ライセンス・再配布条件を必ず確認**してください。取得データの表示・保存・二次利用の可否は提供元により異なります。
