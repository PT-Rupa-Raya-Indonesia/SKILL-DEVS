#!/usr/bin/env bash
# Pasang skill dari repo SKILL-DEVS ke sebuah repo proyek.
#
#   bash install.sh <path-repo-proyek> [nama-skill]
#
# Default nama-skill: main-branch-guard. Yang dilakukan:
#   1. salin <skill>/ ke <repo>/.claude/skills/<skill>/
#   2. (main-branch-guard) buat .github/CODEOWNERS bila belum ada
#   3. (main-branch-guard) gabungkan hook + deny ke <repo>/.claude/settings.json
#      tanpa menghapus isi settings yang sudah ada
# Jalankan oleh manusia, bukan AI agent.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:?pakai: bash install.sh <path-repo-proyek> [nama-skill]}"
SKILL="${2:-main-branch-guard}"
TARGET="$(cd "$TARGET" && pwd)"

[[ -d "$HERE/$SKILL" ]] || { echo "Skill '$SKILL' tidak ada di $HERE"; exit 1; }
[[ -d "$TARGET/.git" ]] || { echo "$TARGET bukan repo git"; exit 1; }

DEST="$TARGET/.claude/skills/$SKILL"
mkdir -p "$DEST"
# salin isi skill, kecuali templates/ (dipasang terpisah di bawah)
( cd "$HERE/$SKILL" && find . -type f ! -path './templates/*' -print0 ) | while IFS= read -r -d '' f; do
  mkdir -p "$DEST/$(dirname "$f")"
  cp "$HERE/$SKILL/$f" "$DEST/$f"
done
chmod +x "$DEST"/scripts/*.sh 2>/dev/null || true
echo "✓ skill disalin ke $DEST"

if [[ "$SKILL" == "main-branch-guard" ]]; then
  if [[ -f "$TARGET/.github/CODEOWNERS" ]]; then
    echo "• .github/CODEOWNERS sudah ada — tidak ditimpa. Pastikan berisi: * @onrsama"
  else
    mkdir -p "$TARGET/.github"
    cp "$HERE/$SKILL/templates/CODEOWNERS" "$TARGET/.github/CODEOWNERS"
    echo "✓ .github/CODEOWNERS dibuat (* @onrsama)"
  fi

  node - "$HERE/$SKILL/templates/settings.json" "$TARGET/.claude/settings.json" <<'JS'
const fs = require('fs');
const [tplPath, outPath] = process.argv.slice(2);
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
const cur = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
cur.permissions ??= {};
cur.permissions.deny = [...new Set([...(cur.permissions.deny || []), ...tpl.permissions.deny])];
cur.hooks ??= {};
cur.hooks.PreToolUse ??= [];
const cmd = tpl.hooks.PreToolUse[0].hooks[0].command;
const has = cur.hooks.PreToolUse.some((m) => (m.hooks || []).some((h) => h.command === cmd));
if (!has) cur.hooks.PreToolUse.push(tpl.hooks.PreToolUse[0]);
fs.writeFileSync(outPath, JSON.stringify(cur, null, 2) + '\n');
console.log(has ? '• hook sudah terpasang di .claude/settings.json' : '✓ hook ditambahkan ke .claude/settings.json');
JS

  cat <<EOF

Langkah berikutnya:
  1. Commit di branch baru lalu buka PR ke main (jangan langsung ke main).
  2. Setelah PR di-merge, @onrsama menjalankan:
       bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh --dry-run
       bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh
  3. Buka ulang sesi Claude Code agar hook terbaca.
EOF
fi
