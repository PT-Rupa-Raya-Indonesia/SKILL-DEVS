#!/usr/bin/env bash
# Cabut skill dari repo proyek — kebalikan install.sh.
#
#   bash uninstall.sh <path-repo-proyek> [nama-skill] [--github] [--yes]
#
# Yang dihapus (hanya yang dipasang install.sh; isi lain tidak disentuh):
#   1. <repo>/.claude/skills/<skill>/
#   2. blok <!-- skill:<skill> start/end --> di AGENTS.md dan CLAUDE.md (file dihapus bila jadi kosong)
#   3. (main-branch-guard) hook guard.mjs dan daftar deny bawaan di .claude/settings.json
#   4. (main-branch-guard) .github/workflows/branch-flow.yml, bila masih versi dari SKILL-DEVS
#   5. (main-branch-guard) .github/CODEOWNERS, bila isinya masih persis buatan install.sh
#   --github  juga cabut ruleset main-pr-only / staging-pr-only di GitHub. Boleh dijalankan
#             oleh SALAH SATU owner di main-branch-guard/OWNERS (tidak bergantung satu orang),
#             asalkan ber-role Admin di repo itu.
#
# Perubahan file tetap harus naik lewat alur biasa (feat/* → dev/<nama> → PR staging → PR main),
# dan PR ke main cukup di-approve salah satu owner. Jalankan oleh manusia, bukan AI agent.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ARGS=() GITHUB="" YES=""
for a in "$@"; do
  case "$a" in
    --github) GITHUB=1 ;;
    --yes) YES=1 ;;
    *) ARGS+=("$a") ;;
  esac
done
TARGET="${ARGS[0]:?pakai: bash uninstall.sh <path-repo-proyek> [nama-skill] [--github] [--yes]}"
SKILL="${ARGS[1]:-main-branch-guard}"
TARGET="$(cd "$TARGET" && pwd)"
[[ -d "$TARGET/.git" ]] || { echo "$TARGET bukan repo git"; exit 1; }

if [[ -z "$YES" ]]; then
  read -r -p "Cabut skill $SKILL dari $TARGET${GITHUB:+ (termasuk ruleset GitHub)}? [y/N] " ans
  [[ "$ans" =~ ^[yY]$ ]] || { echo "Dibatalkan."; exit 1; }
fi

# 0. Ruleset GitHub dulu (butuh skrip & daftar owner yang masih ada di SKILL-DEVS).
if [[ -n "$GITHUB" && "$SKILL" == "main-branch-guard" ]]; then
  REPO="$(cd "$TARGET" && gh repo view --json nameWithOwner -q .nameWithOwner)"
  bash "$HERE/$SKILL/scripts/remove-github-protection.sh" "$REPO" --yes
fi

# 1. Folder skill
if [[ -d "$TARGET/.claude/skills/$SKILL" ]]; then
  rm -rf "$TARGET/.claude/skills/$SKILL"
  echo "✓ .claude/skills/$SKILL dihapus"
else
  echo "• .claude/skills/$SKILL tidak ada"
fi
rmdir "$TARGET/.claude/skills" 2>/dev/null || true

# 2. Blok aturan di AGENTS.md / CLAUDE.md
for DOC in AGENTS.md CLAUDE.md; do
  node - "$TARGET/$DOC" "$SKILL" <<'JS'
const fs = require('fs');
const [docPath, skill] = process.argv.slice(2);
const name = require('path').basename(docPath);
if (!fs.existsSync(docPath)) { console.log(`• ${name} tidak ada`); process.exit(0); }
const start = `<!-- skill:${skill} start -->`, end = `<!-- skill:${skill} end -->`;
let doc = fs.readFileSync(docPath, 'utf8');
const i = doc.indexOf(start), j = doc.indexOf(end);
if (i === -1 || j < i) { console.log(`• ${name} tidak memuat blok ${skill}`); process.exit(0); }
doc = (doc.slice(0, i).replace(/\s*$/, '') + '\n' + doc.slice(j + end.length).replace(/^\s*/, '\n')).trim();
if (!doc) { fs.unlinkSync(docPath); console.log(`✓ ${name} dihapus (hanya berisi blok ${skill})`); }
else { fs.writeFileSync(docPath, doc + '\n'); console.log(`✓ blok ${skill} dihapus dari ${name}`); }
JS
done

if [[ "$SKILL" == "main-branch-guard" ]]; then
  # 3. settings.json: hanya hook & deny bawaan template
  SETTINGS="$TARGET/.claude/settings.json"
  if [[ -f "$SETTINGS" ]]; then
    node - "$HERE/$SKILL/templates/settings.json" "$SETTINGS" <<'JS'
const fs = require('fs');
const [tplPath, outPath] = process.argv.slice(2);
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
const cur = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const deny = new Set(tpl.permissions.deny);
if (cur.permissions?.deny) {
  cur.permissions.deny = cur.permissions.deny.filter((d) => !deny.has(d));
  if (!cur.permissions.deny.length) delete cur.permissions.deny;
  if (!Object.keys(cur.permissions).length) delete cur.permissions;
}
if (cur.hooks?.PreToolUse) {
  cur.hooks.PreToolUse = cur.hooks.PreToolUse
    .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !/main-branch-guard\/scripts\/guard\.mjs/.test(h.command || '')) }))
    .filter((m) => m.hooks.length);
  if (!cur.hooks.PreToolUse.length) delete cur.hooks.PreToolUse;
  if (!Object.keys(cur.hooks).length) delete cur.hooks;
}
if (!Object.keys(cur).length) { fs.unlinkSync(outPath); console.log('✓ .claude/settings.json dihapus (hanya berisi hook skill)'); }
else { fs.writeFileSync(outPath, JSON.stringify(cur, null, 2) + '\n'); console.log('✓ hook & deny skill dihapus dari .claude/settings.json'); }
JS
  fi

  # 4. Workflow branch-flow (hanya bila masih versi SKILL-DEVS)
  WF="$TARGET/.github/workflows/branch-flow.yml"
  if [[ -f "$WF" ]] && grep -q 'Dipasang oleh SKILL-DEVS/main-branch-guard' "$WF"; then
    rm -f "$WF"; rmdir "$TARGET/.github/workflows" 2>/dev/null || true
    echo "✓ .github/workflows/branch-flow.yml dihapus"
  elif [[ -f "$WF" ]]; then
    echo "• .github/workflows/branch-flow.yml sudah diubah manual — tidak dihapus"
  fi

  # 5. CODEOWNERS (hanya bila buatan install.sh)
  CO="$TARGET/.github/CODEOWNERS"
  if [[ -f "$CO" ]] && grep -q 'Dibuat SKILL-DEVS/install.sh' "$CO"; then
    rm -f "$CO"; echo "✓ .github/CODEOWNERS dihapus"
  elif [[ -f "$CO" ]]; then
    echo "• .github/CODEOWNERS tidak dibuat install.sh (atau sudah diubah) — tidak dihapus; tinjau manual"
  fi
  rmdir "$TARGET/.github" 2>/dev/null || true
fi

cat <<EOF

Langkah berikutnya:
  1. Commit penghapusan ini lewat alur biasa: feat/<x> → dev/<nama> → PR staging → PR main.
     PR ke main cukup di-approve salah satu owner: $(grep -vE '^\s*(#|$)' "$HERE/$SKILL/OWNERS" 2>/dev/null | sed 's/^/@/' | paste -sd ' ' -).
EOF
if [[ -z "$GITHUB" && "$SKILL" == "main-branch-guard" ]]; then
  echo "  2. Ruleset GitHub masih aktif. Untuk mencabutnya (oleh salah satu owner yang Admin):"
  echo "       bash $HERE/uninstall.sh $TARGET --github"
  echo "     atau: bash $HERE/$SKILL/scripts/remove-github-protection.sh"
fi
echo "  Buka ulang sesi Claude Code agar hook yang dicabut tidak lagi terbaca."
