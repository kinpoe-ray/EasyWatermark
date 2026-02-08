#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"
OUT_DIR="${2:-tests/artifacts/layout}"
mkdir -p "$OUT_DIR"

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "agent-browser command not found"
  exit 2
fi

agent-browser open "$BASE_URL"
agent-browser wait --load networkidle
agent-browser set viewport 390 844

cat <<'JS' | agent-browser eval --stdin > "$OUT_DIR/mobile-assert.json"
(() => {
  const failures = [];
  const panel = document.querySelector('.panel');
  const preview = document.querySelector('.preview');
  if (!panel || !preview) failures.push('panel_or_preview_missing');

  if (panel && preview) {
    const p = panel.getBoundingClientRect();
    const v = preview.getBoundingClientRect();
    if (!(p.top <= v.top)) failures.push('mobile_order_invalid_panel_not_first');
  }

  const actionButtons = Array.from(document.querySelectorAll('.watermark-actions button'));
  if (actionButtons.length < 3) failures.push('watermark_action_buttons_missing');
  actionButtons.forEach((btn, index) => {
    const box = btn.getBoundingClientRect();
    if (box.height < 44) failures.push(`touch_target_too_small_${index}`);
  });

  if (document.querySelector('.bottom-actions')) {
    failures.push('legacy_bottom_actions_should_be_removed');
  }

  const emptyState = document.getElementById('emptyState');
  if (!emptyState) failures.push('empty_state_missing');

  if (failures.length) {
    throw new Error(failures.join(';'));
  }
  return JSON.stringify({ ok: true, checks: ['mobile_order', 'touch_target', 'no_legacy_bottom_actions', 'empty_state'] });
})();
JS

agent-browser screenshot "$OUT_DIR/mobile-layout.png"
agent-browser close

agent-browser open "$BASE_URL"
agent-browser wait --load networkidle
agent-browser set viewport 1366 900

cat <<'JS' | agent-browser eval --stdin > "$OUT_DIR/desktop-assert.json"
(() => {
  const failures = [];
  const panel = document.querySelector('.panel');
  const preview = document.querySelector('.preview');
  if (!panel || !preview) failures.push('panel_or_preview_missing');

  if (panel && preview) {
    const p = panel.getBoundingClientRect();
    const v = preview.getBoundingClientRect();
    if (!(Math.abs(p.top - v.top) < 40)) failures.push('desktop_alignment_drift');
  }

  const modeButtons = document.querySelectorAll('.mode-toggle button');
  if (modeButtons.length !== 2) failures.push('mode_toggle_not_unified');

  if (document.getElementById('processMode')?.tagName !== 'INPUT') {
    failures.push('legacy_process_select_found');
  }

  if (failures.length) {
    throw new Error(failures.join(';'));
  }
  return JSON.stringify({ ok: true, checks: ['desktop_alignment', 'mode_toggle_unified', 'no_legacy_select'] });
})();
JS

agent-browser screenshot "$OUT_DIR/desktop-layout.png"
agent-browser close
