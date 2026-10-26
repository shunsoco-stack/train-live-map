import { LegalPageShell } from "@/components/LegalPageShell";

export default function SupportPage() {
  return <LegalPageShell title="Train Live Map サポート" lead="JR東日本・関東版（非公式）">
    <section><h2>お問い合わせ</h2><p>不具合やご質問は <a href="mailto:train-live-map-support@gmail.com">train-live-map-support@gmail.com</a> へご連絡ください。端末の種類、アプリのバージョン、発生時刻、操作内容をお知らせいただくと調査に役立ちます。パスワードや通知トークンは送らないでください。</p></section>
    <section><h2>列車が表示されないとき</h2><p>通信状態と選択路線をご確認ください。情報提供対象外の路線や、列車の情報がない時間帯があります。位置は駅間推定であり、正確なGPS位置ではありません。</p></section>
    <section><h2>通知と位置情報</h2><p>iOS版の初回公開ではPush通知を提供しません。運行情報はアプリ内の運行情報画面でご確認ください。現在地は現在地ボタンを押した場合にだけ使用します。</p></section>
    <section><h2>公式情報について</h2><p>本アプリはJR東日本および公共交通オープンデータ協議会の公式アプリではありません。運行については鉄道事業者の公式案内もご確認ください。利用者投稿は公式な確定情報ではありません。</p></section>
    <section><a href="/privacy">プライバシーポリシー</a>・<a href="/terms">利用規約</a></section>
  </LegalPageShell>;
}
