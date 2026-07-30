import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜Train Live Map",
  description:
    "Train Live Mapにおける保存情報、広告、Push通知、現在地の取り扱いについて説明します。",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="プライバシーポリシー"
      lead="Train Live Map（以下「本サービス」）で扱う情報と、その利用目的を説明します。"
    >
      <section>
        <h2 className="text-lg font-bold">端末内に保存する情報</h2>
        <p className="mt-2 text-rail-muted">
          表示路線、お気に入り路線、案内の確認状態、利用者投稿用に端末で生成したランダムIDを、ブラウザのlocalStorageに保存します。これらは設定の維持と投稿の連続送信防止に使います。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Push通知と利用者投稿</h2>
        <p className="mt-2 text-rail-muted">
          Push通知を有効にした場合、通知endpoint、公開鍵、認証鍵、選択路線をサーバーに保存します。利用者投稿では、投稿内容、路線、作成時刻、ランダムIDと接続元IPをソルト付きで不可逆化したハッシュを、不正利用防止と集計のために扱います。生のIPアドレスを投稿レコードには保存しません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">現在地</h2>
        <p className="mt-2 text-rail-muted">
          現在地は利用者が許可した場合に、端末内で地図を移動するためだけに使います。本サービスのAPIや保存先へ位置情報を送信しません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">アクセスログと広告</h2>
        <p className="mt-2 text-rail-muted">
          安定運用、障害調査、不正利用防止のため、ホスティング事業者がIPアドレス、アクセス日時、ブラウザ情報などのアクセスログを取り扱うことがあります。Google
          AdSenseを有効にした場合、Googleなどの第三者配信事業者がCookieや広告識別子を使用することがあります。詳しくは
          <a
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noreferrer"
            className="mx-1 text-sky-300 underline underline-offset-2"
          >
            Googleの広告に関するポリシー
          </a>
          をご確認ください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">公共交通データとオフライン保存</h2>
        <p className="mt-2 text-rail-muted">
          列車・路線・運行情報には公共交通オープンデータセンター（ODPT）から取得したデータを利用します。オフライン機能が保存するのは画面表示に必要なHTML、CSS、JavaScript、アイコンだけで、APIレスポンスや列車位置データは保存しません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">問い合わせ</h2>
        <p className="mt-2 text-rail-muted">
          本方針に関する問い合わせ先:
          <a
            href="mailto:train-live-map-support@gmail.com"
            className="ml-1 break-all text-sky-300 underline underline-offset-2"
          >
            train-live-map-support@gmail.com
          </a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
