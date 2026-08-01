import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "利用規約・免責｜Train Live Map",
  description: "Train Live Map JR東日本・関東版の利用規約と免責事項",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="利用規約・免責" lead="本アプリを利用する前に、以下をご確認ください。最終更新日: 2026年8月1日">
      <section><h2>1. 非公式アプリ</h2><p>Train Live Mapは個人が運営する非公式アプリで、JR東日本、公共交通オープンデータ協議会、公共交通オープンデータセンターその他の交通事業者とは関係ありません。</p></section>
      <section><h2>2. 情報の性質</h2><p>列車アイコンの位置と動きは、駅間情報等をもとにした推定でありGPS実測ではありません。運行情報を含め、正確性、完全性、即時性、継続提供を保証しません。乗車判断には必ず鉄道事業者の公式情報をご確認ください。</p></section>
      <section><h2>3. 利用者投稿</h2><p>「みんなの運行情報」は利用者による参考投稿です。鉄道事業者の公式発表ではなく、誤りやいたずらが含まれる可能性があります。虚偽、第三者への迷惑行為、自動化された大量投稿を禁止します。</p></section>
      <section><h2>4. Push通知</h2><p>通知は利用者投稿の増加から運転見合わせの可能性を知らせる補助機能です。事実の確定や安全を保証するものではなく、通知の遅延・不達が生じる場合があります。</p></section>
      <section><h2>5. 禁止事項</h2><p>サービスへの過大な負荷、不正アクセス、データの改ざん、第三者の権利侵害、法令または公序良俗に反する利用を禁止します。</p></section>
      <section><h2>6. 免責</h2><p>本アプリの利用または利用不能、掲載情報や利用者投稿を信頼した判断によって生じた損害について、運営者は法令上許される範囲で責任を負いません。サービス内容は予告なく変更・停止する場合があります。</p></section>
      <section><h2>7. お問い合わせ</h2><p><a href="mailto:train-live-map-support@gmail.com">train-live-map-support@gmail.com</a> へご連絡ください。</p></section>
    </LegalPageShell>
  );
}
