#!/usr/bin/env bash
# Pasang / perbarui skill dari repo SKILL-DEVS ke sebuah repo proyek.
#
#   bash install.sh <path-repo-proyek> [nama-skill]
#
# Default nama-skill: main-branch-guard. Yang dilakukan:
#   1. ganti isi <repo>/.claude/skills/<skill>/ dengan versi di SKILL-DEVS
#   2. (main-branch-guard) buat .github/CODEOWNERS bila belum ada (tidak ditimpa)
#   3. (main-branch-guard) pasang .github/workflows/branch-flow.yml (selalu versi terbaru)
#   4. (main-branch-guard) gabungkan hook + deny ke <repo>/.claude/settings.json
#      tanpa menghapus isi settings yang sudah ada
#   5. bila skill punya templates/agents-block.md: tulis blok aturannya ke AGENTS.md dan
#      CLAUDE.md di root repo (dibuat bila belum ada). Blok diberi penanda
#      <!-- skill:<nama> start --> … <!-- skill:<nama> end --> dan diganti saat install ulang;
#      isi lain di file itu tidak disentuh.
# Aman dijalankan ulang. Jalankan oleh manusia, bukan AI agent.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:?pakai: bash install.sh <path-repo-proyek> [nama-skill]}"
SKILL="${2:-main-branch-guard}"
TARGET="$(cd "$TARGET" && pwd)"

[[ -d "$HERE/$SKILL" ]] || { echo "Skill '$SKILL' tidak ada di $HERE"; exit 1; }
[[ -d "$TARGET/.git" ]] || { echo "$TARGET bukan repo git"; exit 1; }

DEST="$TARGET/.claude/skills/$SKILL"
OLD_VER="$(cat "$DEST/VERSION" 2>/dev/null || echo 'belum terpasang')"
NEW_VER="$(cat "$HERE/$SKILL/VERSION" 2>/dev/null || echo '-')"

# Folder skill dikelola penuh oleh SKILL-DEVS: hapus dulu agar file yang sudah dibuang ikut hilang.
rm -rf "$DEST"
mkdir -p "$DEST"
( cd "$HERE/$SKILL" && find . -type f ! -path './templates/*' -print0 ) | while IFS= read -r -d '' f; do
  mkdir -p "$DEST/$(dirname "$f")"
  cp "$HERE/$SKILL/$f" "$DEST/$f"
done
chmod +x "$DEST"/scripts/*.sh 2>/dev/null || true
if [[ "$OLD_VER" == "$NEW_VER" ]]; then
  echo "✓ skill $SKILL v$NEW_VER disalin ulang (versi sama)"
else
  echo "✓ skill $SKILL: $OLD_VER → v$NEW_VER (lihat CHANGELOG.md di SKILL-DEVS)"
fi

BLOCK="$HERE/$SKILL/templates/agents-block.md"
if [[ -f "$BLOCK" ]]; then
  for DOC in AGENTS.md CLAUDE.md; do
    node - "$BLOCK" "$TARGET/$DOC" "$SKILL" "$NEW_VER" <<'JS'
const fs = require('fs');
const [blockPath, docPath, skill, ver] = process.argv.slice(2);
const start = `<!-- skill:${skill} start -->`;
const end = `<!-- skill:${skill} end -->`;
const body = fs.readFileSync(blockPath, 'utf8').trim();
const block = `${start}\n<!-- Dikelola SKILL-DEVS/install.sh (v${ver}). Jangan diubah di sini; ubah di SKILL-DEVS lalu install ulang. -->\n${body}\n${end}`;
const name = require('path').basename(docPath);
let doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
const i = doc.indexOf(start);
const j = doc.indexOf(end);
let action;
if (i !== -1 && j > i) {
  doc = doc.slice(0, i) + block + doc.slice(j + end.length);
  action = 'diperbarui';
} else if (doc) {
  doc = doc.replace(/\s*$/, '\n\n') + block + '\n';
  action = 'ditambahkan';
} else {
  doc = block + '\n';
  action = 'dibuat';
}
fs.writeFileSync(docPath, doc);
console.log(`✓ blok aturan ${skill} ${action} di ${name}`);
JS
  done
fi

if [[ "$SKILL" == "main-branch-guard" ]]; then
  if [[ -f "$TARGET/.github/CODEOWNERS" ]]; then
    echo "• .github/CODEOWNERS sudah ada — tidak ditimpa. Pastikan berisi: * @onrsama @ahmadaqib"
  else
    mkdir -p "$TARGET/.github"
    cp "$HERE/$SKILL/templates/CODEOWNERS" "$TARGET/.github/CODEOWNERS"
    echo "✓ .github/CODEOWNERS dibuat (* @onrsama @ahmadaqib)"
  fi

  mkdir -p "$TARGET/.github/workflows"
  cp "$HERE/$SKILL/templates/branch-flow.yml" "$TARGET/.github/workflows/branch-flow.yml"
  echo "✓ .github/workflows/branch-flow.yml dipasang"

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
fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(cur, null, 2) + '\n');
console.log(has ? '• hook sudah terpasang di .claude/settings.json' : '✓ hook ditambahkan ke .claude/settings.json');
JS

  cat <<EOF

Langkah berikutnya (alur: feat/<x> → dev/<nama> → PR staging → PR @onrsama/@ahmadaqib → main):
  1. Commit perubahan ini di feat/<x>, gabungkan ke dev/<nama>, buka PR dev/<nama> → staging.
  2. Pemasangan pertama: setelah sampai main, @onrsama/@ahmadaqib menjalankan
       bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh --dry-run
       bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh
  3. Buka ulang sesi Claude Code agar hook terbaca.
EOF
fi
