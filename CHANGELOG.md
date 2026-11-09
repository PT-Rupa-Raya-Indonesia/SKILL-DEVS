# Changelog

Catatan perubahan tiap skill. Format: `## <skill> <versi> — <tanggal>`, lalu daftar perubahan dan **apa yang harus dilakukan tim** setelah update. Versi skill ada di `<skill>/VERSION`.

Aturan versi:
- **patch** (1.1.**x**) — perbaikan teks/bug, tidak mengubah alur kerja
- **minor** (1.**x**.0) — aturan atau file baru; tim perlu menjalankan ulang `install.sh`
- **major** (**x**.0.0) — alur kerja berubah; tim perlu membaca catatan ini dulu

## main-branch-guard 1.1.0 — 2026-11-09

Alur branch baru:

```
feat/<x>  →  dev/<nama>  --PR-->  staging  --PR @onrsama-->  main
```

- PR agent tidak lagi ke `main`. Branch fitur digabung ke branch personal `dev/<nama>`, lalu `dev/<nama>` membuka PR ke `staging`.
- Hanya @onrsama yang membuka PR `staging → main` dan meng-approve-nya (CODEOWNERS).
- `staging` ikut dikunci: tidak bisa push/commit langsung, wajib PR.
- Hook menolak `gh pr create` tanpa `--base`, PR ke `main`, dan PR ke `staging` yang bukan dari `dev/<nama>`.
- Baru: `.github/workflows/branch-flow.yml` (check `branch-flow`) yang menolak PR dari sumber yang salah.
- Baru: ruleset `staging-pr-only`; ruleset `main-pr-only` sekarang mewajibkan check `branch-flow`.
- `git pull` di `staging`/`main` boleh (untuk menyamakan branch lokal).
- `branch-flow.yml` memakai `pull_request_target` (dijalankan dari versi di branch tujuan), dan check di ruleset dikunci ke GitHub Actions (`integration_id: 15368`). Tujuannya agar PR tidak bisa meluluskan check-nya sendiri dengan mengubah workflow atau memalsukan status.
- Ruleset `main-pr-only` juga berlaku untuk default branch (`~DEFAULT_BRANCH`).
- Hook juga membaca `-Bstaging`/`-Hdev/x` (opsi tanpa spasi), menolak `gh pr edit --base`, dan menolak `gh api` yang membuat/mengubah base PR.
- `install.sh` mengganti seluruh folder skill (file lama yang dibuang ikut hilang) dan mencetak versi lama → baru.

**Yang perlu dilakukan:**
1. Semua dev: `git -C ~/SKILL-DEVS pull`, lalu `bash ~/SKILL-DEVS/install.sh <repo-proyek>`, commit lewat alur baru, buka ulang Claude Code.
2. Tiap dev membuat branch personal sekali: `git switch -c dev/<nama> origin/staging && git push -u origin dev/<nama>`.
3. @onrsama: setelah update sampai `main`, jalankan ulang `apply-github-protection.sh` (memasang ruleset staging dan check `branch-flow`).

## main-branch-guard 1.0.0 — 2026-11-09

- Rilis pertama: `main` hanya lewat PR yang di-approve @onrsama, agent tidak bisa push/merge/commit ke `main`, tidak bisa membaca/mengisi ENV.
- Hook `guard.mjs`, `CODEOWNERS`, ruleset `main-pr-only`, `install.sh`.
