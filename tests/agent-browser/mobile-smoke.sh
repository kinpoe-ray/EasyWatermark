#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"
OUT_DIR="${2:-tests/artifacts/mobile}"
FIXTURE_1="${3:-tests/fixtures/input-1.png}"
FIXTURE_2="${4:-tests/fixtures/input-2.png}"

mkdir -p "$OUT_DIR"

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "agent-browser command not found"
  exit 2
fi

agent-browser open "$BASE_URL"
agent-browser wait --load networkidle
agent-browser set viewport 390 844

agent-browser screenshot "$OUT_DIR/mobile-home-before.png"
agent-browser snapshot -i > "$OUT_DIR/01-mobile-home.snapshot.txt"

SNAPSHOT="$(cat "$OUT_DIR/01-mobile-home.snapshot.txt")"
FILE_REF="$(
  printf '%s\n' "$SNAPSHOT" | awk '
    /button "Choose File"|button "选择文件"/ {
      if (match($0, /ref=e[0-9]+/)) {
        print "@" substr($0, RSTART + 4, RLENGTH - 4)
      }
      exit
    }
  '
)"
if [[ -z "$FILE_REF" ]]; then
  echo "Failed to locate file chooser ref"
  exit 1
fi

agent-browser upload "$FILE_REF" "$FIXTURE_1" "$FIXTURE_2"
agent-browser wait 1200

agent-browser find first "#moreBtn" click
agent-browser wait 400
agent-browser find first "#moreHelpBtn" click
agent-browser wait 400
agent-browser screenshot "$OUT_DIR/mobile-help.png"
agent-browser find first "#closeHelp" click

agent-browser find first "#moreBtn" click
agent-browser find first "#moreExportSettingsBtn" click
agent-browser wait 400
agent-browser screenshot "$OUT_DIR/mobile-settings.png"
agent-browser find first "#closeSettings2" click

agent-browser find first "#nextImageBtnOverlay" click
agent-browser wait 400
agent-browser find first "#prevImageBtnOverlay" click
agent-browser wait 400

agent-browser screenshot "$OUT_DIR/mobile-home-after.png"
agent-browser snapshot -i > "$OUT_DIR/02-mobile-after.snapshot.txt"
agent-browser close
