#!/usr/bin/env bash
# Cabut ruleset "main-pr-only" dan "staging-pr-only" dari sebuah repo GitHub.
# Boleh dijalankan oleh SALAH SATU owner di ../OWNERS (bukan hanya satu orang), asalkan
# ber-role Admin di repo itu. Bukan untuk AI agent (hook guard.mjs memblokirnya).
#
# Pemakaian:
#   bash remove-github-protection.sh [owner/repo] [--dry-run] [--yes]
#     --dry-run  tampilkan ruleset yang akan dihapus, tanpa menghapus
#     --yes      lewati konfirmasi ketik nama repo
set -euo pipefail
source "$(dirname "$0")/owners.sh"

REPO="" DRY="" YES=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    *) REPO="$a" ;;
  esac
done
[[ -n "$REPO" ]] || REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

IDS="$(gh api "repos/$REPO/rulesets" -q '.[] | select(.name=="main-pr-only" or .name=="staging-pr-only") | "\(.id) \(.name)"' || true)"
if [[ -z "$IDS" ]]; then
  echo "Tidak ada ruleset main-pr-only / staging-pr-only di $REPO."
  exit 0
fi
echo "Ruleset di $REPO yang akan dihapus:"
echo "$IDS" | sed 's/^/  #/'
[[ -n "$DRY" ]] && exit 0

require_owner "$REPO"

if [[ -z "$YES" ]]; then
  read -r -p "Setelah ini main & staging tidak lagi dikunci. Ketik nama repo ($REPO) untuk lanjut: " ans
  [[ "$ans" == "$REPO" ]] || { echo "Dibatalkan."; exit 1; }
fi

while read -r id name; do
  gh api -X DELETE "repos/$REPO/rulesets/$id" >/dev/null
  echo "✓ ruleset $name (#$id) dihapus"
done <<<"$IDS"
echo "Selesai. Cek: https://github.com/$REPO/settings/rules"
