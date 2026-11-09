#!/usr/bin/env bash
# Pasang ruleset GitHub "main-pr-only" di repo ini. Dijalankan SEKALI oleh admin repo (@onrsama),
# bukan oleh AI agent (hook guard.mjs memblokir agent memanggil endpoint rulesets).
#
# Hasilnya (ditegakkan server GitHub, berlaku untuk manusia DAN agent):
#   - main tidak bisa di-push langsung, di-force-push, atau dihapus
#   - setiap perubahan ke main wajib lewat PR
#   - PR wajib di-approve code owner (CODEOWNERS: * @onrsama)
#   - approval basi bila ada push baru; push terakhir wajib di-approve orang lain
#   - hanya admin repo yang boleh bypass, dan bypass-nya pun HANYA lewat PR (bukan push langsung)
#
# Pemakaian:
#   bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh [owner/repo] [--dry-run]
set -euo pipefail

REPO="${1:-}"
DRY=""
for a in "$@"; do [[ "$a" == "--dry-run" ]] && DRY=1; done
[[ "$REPO" == "--dry-run" ]] && REPO=""
if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

read -r -d '' BODY <<'JSON' || true
{
  "name": "main-pr-only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH", "refs/heads/main"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true
      }
    }
  ]
}
JSON

if [[ -n "$DRY" ]]; then
  echo "Repo: $REPO"; echo "$BODY"; exit 0
fi

EXISTING="$(gh api "repos/$REPO/rulesets" -q '.[] | select(.name=="main-pr-only") | .id' || true)"
if [[ -n "$EXISTING" ]]; then
  echo "Memperbarui ruleset #$EXISTING di $REPO"
  echo "$BODY" | gh api -X PUT "repos/$REPO/rulesets/$EXISTING" --input - >/dev/null
else
  echo "Membuat ruleset main-pr-only di $REPO"
  echo "$BODY" | gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null
fi

echo "Selesai. Cek: https://github.com/$REPO/settings/rules"
echo "Catatan: pastikan hanya @onrsama yang ber-role Admin; admin lain ikut punya hak bypass-lewat-PR."
