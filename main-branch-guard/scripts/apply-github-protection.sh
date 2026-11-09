#!/usr/bin/env bash
# Pasang dua ruleset GitHub di repo ini. Dijalankan oleh admin repo (@onrsama/@ahmadaqib), bukan oleh
# AI agent (hook guard.mjs memblokir agent memanggil endpoint rulesets). Aman diulang:
# ruleset yang sudah ada diperbarui, bukan dobel.
#
# Alur yang ditegakkan server GitHub (berlaku untuk manusia DAN agent):
#
#   feat/<x> --> dev/<nama> --PR--> staging --PR (approval @onrsama/@ahmadaqib)--> main
#
#   staging-pr-only
#     - tidak bisa di-push langsung, di-force-push, atau dihapus
#     - perubahan wajib lewat PR (jumlah approval: STAGING_APPROVALS, default 0)
#     - check "branch-flow" wajib lulus => PR ke staging hanya dari dev/<nama>, judul PR berformat
#     - branch wajib up-to-date dengan staging sebelum merge (strict) => pull staging dulu
#   main-pr-only
#     - tidak bisa di-push langsung, di-force-push, atau dihapus
#     - wajib lewat PR yang di-approve code owner (CODEOWNERS: * @onrsama @ahmadaqib)
#     - check "branch-flow" wajib lulus => PR ke main hanya dari staging
#   (check berasal dari .github/workflows/branch-flow.yml, dipasang oleh install.sh)
#   Branch feat/* dan dev/<nama> bebas: tidak dikunci.
#   Bypass: hanya role Admin, dan hanya lewat PR (tidak ada push langsung).
#
# Pemakaian:
#   bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh [owner/repo] [--dry-run]
#   STAGING_APPROVALS=1 bash ...   # bila PR ke staging juga wajib 1 approval
set -euo pipefail

REPO=""
DRY=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    *) REPO="$a" ;;
  esac
done
[[ -n "$REPO" ]] || REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
STAGING_APPROVALS="${STAGING_APPROVALS:-0}"

BYPASS='[{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }]'

MAIN_BODY=$(cat <<JSON
{
  "name": "main-pr-only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH", "refs/heads/main"], "exclude": [] } },
  "bypass_actors": $BYPASS,
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "branch-flow", "integration_id": 15368 } ]
      }
    }
  ]
}
JSON
)

STAGING_BODY=$(cat <<JSON
{
  "name": "staging-pr-only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/staging"], "exclude": [] } },
  "bypass_actors": $BYPASS,
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": $STAGING_APPROVALS,
        "require_code_owner_review": false,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "branch-flow", "integration_id": 15368 } ]
      }
    }
  ]
}
JSON
)

if [[ -n "$DRY" ]]; then
  echo "Repo: $REPO"; echo "$STAGING_BODY"; echo "$MAIN_BODY"; exit 0
fi

if ! gh api "repos/$REPO/branches/staging" >/dev/null 2>&1; then
  echo "Branch staging belum ada di $REPO. Buat dulu dari main:"
  echo "  git push origin main:staging"
  exit 1
fi

apply() { # $1 = nama ruleset, $2 = body
  local id
  id="$(gh api "repos/$REPO/rulesets" -q ".[] | select(.name==\"$1\") | .id" || true)"
  if [[ -n "$id" ]]; then
    echo "Memperbarui ruleset $1 (#$id)"
    echo "$2" | gh api -X PUT "repos/$REPO/rulesets/$id" --input - >/dev/null
  else
    echo "Membuat ruleset $1"
    echo "$2" | gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null
  fi
}
apply staging-pr-only "$STAGING_BODY"
apply main-pr-only "$MAIN_BODY"

echo "Selesai. Cek: https://github.com/$REPO/settings/rules"
echo "Catatan: pastikan hanya @onrsama dan @ahmadaqib yang ber-role Admin; admin lain ikut punya hak bypass-lewat-PR."
