import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜Train Live Map",
  description: "Train Live Map JR東日本・関東版のプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="プライバシーポリシー" lead="Train Live Map（JR東日本・関東版）で扱う情報と、その利用目的を説明します。最終更新日: 2026年10月27日">
      <section><h2>1. 収集・保存する情報</h2><ul><li>端末内のlocalStorage: 表示路線、お気に入り、案内の確認状態、投稿用ランダムID、最後に列車情報を取得した時刻</li><li>Push通知を有効にした場合: ブラウザが発行するendpoint・暗号鍵・選択路線・最終更新時刻</li><li>「みんなの運行情報」: 投稿内容、投稿時刻、端末内ランダムIDと接続元を復元不能な識別子に変換した値</li><li>ホスティング事業者が記録するアクセスログ: IPアドレス、User-Agent、アクセス日時など</li></ul></section>
      <section><h2>2. 利用目的</h2><p>表示設定の保存、不正な連続投稿の防止、利用者投稿の集計、選択路線へのPush通知、障害調査、サービスの安全な運用に利用します。元のIPアドレスをコミュニティ投稿データとして保存しません。</p></section>
      <section><h2>3. 現在地情報</h2><p>現在地ボタンで取得した位置は、端末上で地図を移動し現在位置を示すためだけに使います。現在地の緯度・経度を当アプリのサーバーへ送信・保存しません。</p></section>
      <section><h2>4. 第三者サービス</h2><p>公共交通データは公共交通オープンデータセンター（ODPT）から取得します。また、広告を表示する場合はGoogle AdSenseがCookieや広告識別子等を使用することがあります。詳細は<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">Googleの広告ポリシー</a>をご確認ください。</p></section>
      <section><h2>5. 保存期間と削除</h2><p>Push購読情報は最終更新から最大180日保持し、通知解除時に削除します。投稿は直近情報の集計に必要な期間だけ保持します。端末内データはブラウザのサイトデータ削除機能から消去できます。</p></section>
      <section><h2>6. 安全管理</h2><p>通信はHTTPSを前提とし、秘密情報はサーバー環境変数で管理します。不正利用防止のため、投稿・Push購読変更には同一オリジン検証、入力検証、回数制限を適用します。</p></section>
      <section><h2>iOSアプリについて</h2><p>iOS版の初回公開ではPush通知を提供しません。通知権限の要求、APNs端末トークンの登録・送信は行いません。広告やトラッキングSDKも使用しません。</p><p>表示路線とお気に入りは端末のUserDefaultsへ保存します。投稿用ランダムIDはKeychainで保護し、利用者投稿の送信時だけサーバーへ送信します。サーバーでは識別子をHMAC化し、不正な連続投稿の防止と投稿の集計に使用します。</p><p>APIのホスティング先Vercelでは、IPアドレス、User-Agent、要求パス、HTTP状態、時刻、処理時間、メモリ利用などの技術的ログが、障害調査と安全なサービス運営のために処理・保存されます。現在のHobbyプランのRuntime Logsは1時間保持されます。外部へのログ転送（Drains）とWeb Analyticsは有効にしていません。この保持時間はVercelの安全対策ログ全体の保持期限を示すものではありません。広告目的のトラッキングには使用しません。</p><p>背景地図はOpenFreeMapを使用します。地図タイルの要求時に、地図提供者にはIPアドレスと表示対象の地図領域が伝わります。端末の現在地座標を当アプリのAPIへ送信・保存しません。OpenFreeMapは通常のアクセスログにIPを保存しませんが、エラー時やセキュリティ上の調査時には一時的に保存する場合があります。詳細は<a href="https://openfreemap.org/privacy/">OpenFreeMapのプライバシーポリシー</a>をご確認ください。</p></section>
      <section><h2>7. お問い合わせ</h2><p>本アプリに関するお問い合わせは <a href="mailto:train-live-map-support@gmail.com">train-live-map-support@gmail.com</a> までお願いします。鉄道事業者やODPTへ本アプリについて直接問い合わせないでください。</p></section>
    </LegalPageShell>
  );
}
