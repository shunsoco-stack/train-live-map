# Google AdSense 設定

Train Live Map は、地図を覆わない固定サイズのディスプレイ広告を画面下部に1枠だけ表示します。

## 必要な値

AdSense でディスプレイ広告ユニットを作成し、次の2つを確認します。

- クライアントID: `ca-pub-` から始まる値
- 広告ユニットID: `data-ad-slot` の数値

## Vercel の環境変数

プロジェクトの Environment Variables に以下を追加します。

```text
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-1234567890123456
NEXT_PUBLIC_ADSENSE_BANNER_SLOT=1234567890
```

Production と Preview を対象にして保存し、Redeploy してください。

## 動作

- 両方の値が正しい形式で設定された場合のみ、320 x 50 px の広告枠を表示します。
- クライアントIDだけを設定した場合は、サイト確認用のAdSenseコードとメタタグだけを追加し、広告枠は表示しません。
- 未設定時は広告用の空白も表示しません。
- `/ads.txt` はクライアントIDから自動生成します。
- 画面を覆う可能性があるため、アプリ側では自動広告を有効化しません。

## 確認URL

- アプリ: <https://train-live-map.vercel.app/>
- ads.txt: <https://train-live-map.vercel.app/ads.txt>

AdSense 側の審査や広告配信開始には時間がかかる場合があります。
