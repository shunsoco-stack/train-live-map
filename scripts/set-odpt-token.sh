#!/bin/bash
# ODPT アクセストークンを .env.local に設定するスクリプト。
#
# 使い方(リポジトリのディレクトリで実行):
#   bash scripts/set-odpt-token.sh
#
# トークンは画面に表示されず、.env.local(git 管理外)にのみ書き込まれます。

set -uo pipefail

info()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m! %s\033[0m\n' "$*"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# リポジトリのルートへ移動(スクリプトの位置から解決)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR" || fail "リポジトリのルートへ移動できません"

ENV_FILE="$ROOT_DIR/.env.local"

echo
info "ODPT アクセストークンを設定します"
echo
echo "  トークンの取得方法:"
echo "   1. https://developer.odpt.org/ で無料のユーザー登録(メール認証あり)"
echo "   2. ログイン後、アクセストークンを発行"
echo "   3. 発行された文字列をこの下に貼り付け"
echo

# トークンを非表示で入力(引数で渡された場合はそれを使う)
if [ "$#" -ge 1 ] && [ -n "${1:-}" ]; then
  TOKEN="$1"
else
  printf 'ODPT アクセストークン: '
  read -r -s TOKEN
  echo
fi

TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
[ -n "$TOKEN" ] || fail "トークンが入力されませんでした"

# 既存の .env.local から ODPT_ACCESS_TOKEN 行だけを差し替える
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_FILE.bak" || fail ".env.local のバックアップに失敗しました"
  warn "既存の .env.local を .env.local.bak に退避しました"
  grep -v '^ODPT_ACCESS_TOKEN=' "$ENV_FILE.bak" > "$ENV_FILE" || true
else
  : > "$ENV_FILE"
fi

printf 'ODPT_ACCESS_TOKEN=%s\n' "$TOKEN" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"

ok "トークンを .env.local に保存しました(権限 600 / git 管理外)"
echo
echo "  次の手順:"
echo "   1. 開発サーバーが動いていれば Ctrl+C で停止し、もう一度 npm run dev"
echo "   2. http://localhost:3000/dev/debug で接続状況を確認"
echo "   3. 実データに切り替わると、画面右上が「ODPT ライブ(推定位置)」になります"
echo
