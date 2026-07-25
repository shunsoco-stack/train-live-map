#!/bin/bash
# Train Live Map — macOS 向けワンステップ起動スクリプト
#
# 実行するとこの順で処理します:
#   1. Node.js の有無・バージョン確認(無ければ導入を案内 / Homebrew があれば導入)
#   2. リポジトリの取得(既にあれば更新)
#   3. 対象ブランチへ切り替え
#   4. npm install
#   5. 開発サーバー起動 → 起動完了を待って自動でブラウザを開く
#
# 使い方(ターミナルに貼り付け):
#   bash <(curl -fsSL https://raw.githubusercontent.com/shunsoco-stack/baobao-privacy-policy/claude/train-live-map-mvp-goow6f/scripts/start-mac.sh)

set -uo pipefail

REPO_URL="${TRAIN_LIVE_MAP_REPO:-https://github.com/shunsoco-stack/baobao-privacy-policy.git}"
BRANCH="${TRAIN_LIVE_MAP_BRANCH:-claude/train-live-map-mvp-goow6f}"
TARGET_DIR="${TRAIN_LIVE_MAP_DIR:-$HOME/train-live-map}"
PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"
MIN_NODE_MAJOR=18

info()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m! %s\033[0m\n' "$*"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- 1. Node.js
ensure_node() {
  # Homebrew を PATH に載せる(インストール直後は PATH に無いことがある)
  for brew_bin in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$brew_bin" ] && eval "$("$brew_bin" shellenv)" && break
  done

  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [ "$major" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
      ok "Node.js $(node -v) を検出しました"
      return 0
    fi
    warn "Node.js $(node -v) は古いため更新が必要です(v${MIN_NODE_MAJOR} 以上)"
  else
    warn "Node.js が見つかりませんでした"
  fi

  if command -v brew >/dev/null 2>&1; then
    info "Homebrew で Node.js を導入します(数分かかります)"
    brew install node || fail "Homebrew での Node.js 導入に失敗しました"
    ok "Node.js $(node -v) を導入しました"
    return 0
  fi

  # Homebrew が無い場合は公式インストーラーを案内(ブラウザを開く)
  warn "Homebrew が見つかりませんでした。Node.js の公式インストーラーが必要です。"
  echo
  echo "  次のページが開きます。「LTS」版をダウンロードしてインストールしたあと、"
  echo "  このスクリプトをもう一度実行してください。"
  echo
  open "https://nodejs.org/ja/download" 2>/dev/null || true
  fail "Node.js を導入後、もう一度実行してください"
}

# ------------------------------------------------------------ 2-3. リポジトリ
ensure_repo() {
  command -v git >/dev/null 2>&1 || fail "git が見つかりません(Xcode Command Line Tools を導入してください: xcode-select --install)"

  if [ -d "$TARGET_DIR/.git" ]; then
    info "既存のリポジトリを更新します: $TARGET_DIR"
    git -C "$TARGET_DIR" fetch origin "$BRANCH" || fail "git fetch に失敗しました"
    git -C "$TARGET_DIR" checkout "$BRANCH" || fail "ブランチの切り替えに失敗しました"
    git -C "$TARGET_DIR" pull origin "$BRANCH" || fail "git pull に失敗しました"
  else
    info "リポジトリを取得します: $TARGET_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$TARGET_DIR" || fail "git clone に失敗しました"
  fi
  ok "ブランチ $BRANCH を取得しました"
}

# --------------------------------------------------------------- 4. 依存導入
install_deps() {
  cd "$TARGET_DIR" || fail "ディレクトリへ移動できません: $TARGET_DIR"
  info "依存パッケージを導入します(初回は数分かかります)"
  npm install || fail "npm install に失敗しました"
  ok "依存パッケージの導入が完了しました"
}

# ------------------------------------------------------- 5. 起動 + ブラウザ
start_and_open() {
  cd "$TARGET_DIR" || fail "ディレクトリへ移動できません: $TARGET_DIR"

  # 既に同じポートで動いていれば、それを開くだけにする
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    ok "既にサーバーが起動しています"
    open "$URL" 2>/dev/null || true
    echo "  → $URL"
    return 0
  fi

  info "開発サーバーを起動します(停止するには Ctrl+C)"
  PORT="$PORT" npm run dev &
  local server_pid=$!

  # 起動完了を待つ(最大 90 秒)
  local i
  for i in $(seq 1 90); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
      fail "サーバーの起動に失敗しました(上のログを確認してください)"
    fi
    if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
      echo
      ok "起動しました → $URL"
      open "$URL" 2>/dev/null || warn "ブラウザを自動で開けませんでした。手動で $URL を開いてください"
      echo
      echo "  停止するには、このターミナルで Ctrl+C を押してください。"
      echo
      wait "$server_pid"
      return 0
    fi
    sleep 1
  done

  fail "起動の確認がタイムアウトしました($URL に応答がありません)"
}

main() {
  echo
  info "Train Live Map セットアップを開始します"
  echo
  ensure_node
  ensure_repo
  install_deps
  start_and_open
}

main "$@"
