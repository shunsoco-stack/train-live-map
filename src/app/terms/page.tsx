import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "利用規約・免責｜Train Live Map",
  description:
    "Train Live Mapの利用条件、非公式サービスとしての免責、利用者投稿について説明します。",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="利用規約・免責"
      lead="本サービスを利用した時点で、以下の内容に同意したものとします。"
    >
      <section>
        <h2 className="text-lg font-bold">非公式サービス</h2>
        <p className="mt-2 text-rail-muted">
          Train Live MapはJR東日本その他の鉄道事業者が提供・運営する公式サービスではありません。各社への問い合わせに本サービスの名称を使用しないでください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">情報の正確性</h2>
        <p className="mt-2 text-rail-muted">
          列車アイコンの位置や移動は、取得データや駅間情報をもとにした推定表示を含み、GPS軌跡ではありません。運行情報、遅延、時刻、位置の正確性・完全性・継続性を保証しません。乗車判断には鉄道事業者の公式情報をご確認ください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">みんなの運行情報</h2>
        <p className="mt-2 text-rail-muted">
          「みんなの運行情報」は利用者の投稿を集計した参考情報であり、鉄道事業者の発表ではありません。虚偽、いたずら、同一内容の連続投稿など、他の利用者を誤認させる行為を禁止します。必要に応じて投稿の制限・削除・機能停止を行うことがあります。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">禁止事項</h2>
        <p className="mt-2 text-rail-muted">
          本サービスや外部データ提供者へ過度な負荷をかける行為、不正アクセス、通知購読の大量登録、リバースエンジニアリングによる秘密情報の取得、第三者の権利を侵害する行為を禁止します。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">免責と変更</h2>
        <p className="mt-2 text-rail-muted">
          本サービスの利用または利用不能によって生じた損害について、法令上認められる範囲で責任を負いません。保守、データ提供条件、法令・規約の変更などにより、予告なく内容の変更や提供停止を行う場合があります。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">問い合わせ</h2>
        <p className="mt-2 text-rail-muted">
          本規約に関する問い合わせ先:
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
