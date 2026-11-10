#!/usr/bin/env bash
# Helper bersama: daftar owner dari ../OWNERS dan pemeriksaan siapa yang menjalankan skrip.
# Dipakai oleh apply-github-protection.sh dan remove-github-protection.sh.

OWNERS_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/OWNERS"

owners_list() { # cetak login owner, satu per baris
  grep -vE '^\s*(#|$)' "$OWNERS_FILE" | tr -d ' \t\r'
}

owners_pretty() { # "@a atau @b"
  owners_list | sed 's/^/@/' | paste -sd ',' - | sed 's/,/ atau /g'
}

# require_owner <owner/repo>: berhenti bila login gh bukan owner atau tidak punya akses admin.
require_owner() {
  local repo="$1" me admin
  me="$(gh api user -q .login 2>/dev/null || true)"
  [[ -n "$me" ]] || { echo "Tidak bisa membaca login GitHub. Jalankan: gh auth login"; exit 1; }
  if ! owners_list | grep -qix "$me"; then
    echo "Ditolak: @$me bukan owner skill ini. Yang boleh: $(owners_pretty) (lihat $OWNERS_FILE)."
    exit 1
  fi
  admin="$(gh api "repos/$repo" -q .permissions.admin 2>/dev/null || true)"
  if [[ "$admin" != "true" ]]; then
    echo "Ditolak: @$me belum punya akses Admin di $repo. Minta owner lain ($(owners_pretty)) menambahkan role Admin."
    exit 1
  fi
  echo "Dijalankan oleh @$me (owner, admin $repo)."
}
