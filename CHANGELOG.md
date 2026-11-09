# Changelog

Catatan perubahan tiap skill. Format: `## <skill> <versi> — <tanggal>`, lalu daftar perubahan dan **apa yang harus dilakukan tim** setelah update. Versi skill ada di `<skill>/VERSION`.

Aturan versi:
- **patch** (1.1.**x**) — perbaikan teks/bug, tidak mengubah alur kerja
- **minor** (1.**x**.0) — aturan atau file baru; tim perlu menjalankan ulang `install.sh`
- **major** (**x**.0.0) — alur kerja berubah; tim perlu membaca catatan ini dulu

## main-branch-guard 1.3.0 — 2026-11-09

- **Approval ke `main` dari @onrsama atau @ahmadaqib.** CODEOWNERS sekarang `* @onrsama @ahmadaqib`; cukup salah satu yang approve, dan keduanya bisa saling approve (penulis PR tidak bisa approve PR sendiri).
- **Pull dulu, baru push.** Hook menolak `gh pr create --base staging` bila `dev/<nama>` belum memuat `origin/staging` atau belum sama dengan `origin/dev/<nama>`. Ruleset `staging-pr-only` sekarang *strict*: branch wajib up-to-date dengan `staging` sebelum merge.
- **Format commit.** Hook menolak `git commit -m` (termasuk `-am` dan heredoc) dan `gh pr create --title` yang tidak berformat `<tipe>(<scope>): <ringkasan>`, lebih dari 72 karakter, atau terlalu umum (`fix: update`, `chore: wip`). Check `branch-flow` di GitHub ikut memeriksa judul PR.
- SKILL.md: bagian "Sinkron dulu, baru push dan buka PR" dan "Format commit dan judul PR"; blok AGENTS.md/CLAUDE.md ikut diperbarui.

**Yang perlu dilakukan:**
1. Semua dev: `git -C ~/SKILL-DEVS pull`, lalu `bash ~/SKILL-DEVS/install.sh <repo-proyek>`. CODEOWNERS yang **sudah ada** tidak ditimpa: ubah manual menjadi `* @onrsama @ahmadaqib`.
2. @onrsama/@ahmadaqib: pastikan keduanya punya akses minimal Write (sebaiknya Admin) di tiap repo, lalu jalankan ulang `apply-github-protection.sh` setelah update sampai `main` (mengaktifkan mode strict di `staging`).

## main-branch-guard 1.2.0 — 2026-11-09

- `install.sh` menulis ringkasan aturan ke **`AGENTS.md`** dan **`CLAUDE.md`** di root repo proyek (dibuat bila belum ada). Blok bertanda `<!-- skill:main-branch-guard start/end -->` diganti saat install ulang; isi lain tidak disentuh. Agent selain Claude (Codex, Cursor, dll.) jadi ikut membaca aturannya.
- Hook menolak `--base`/`--head` yang muncul lebih dari sekali dengan nilai berbeda, dan semua `gh api` yang menulis ke PR (REST `/pulls` maupun mutasi GraphQL PR/ruleset).
- README: skill tidak terikat ke repo/organisasi tertentu; catatan untuk repo kolaborasi di akun personal.

**Yang perlu dilakukan:**
1. Semua dev: `git -C ~/SKILL-DEVS pull`, lalu `bash ~/SKILL-DEVS/install.sh <repo-proyek>`.
2. Commit `AGENTS.md` dan `CLAUDE.md` bersama file skill lewat alur biasa (`feat/*` → `dev/<nama>` → PR `staging`).
3. Ruleset tidak berubah; @onrsama tidak perlu menjalankan ulang skrip ruleset.

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
- Hook juga membaca `-Bstaging`/`-Hdev/x` (opsi tanpa spasi), menolak `gh pr edit --base`, menolak `--base`/`--head` ganda, dan menolak semua `gh api` yang menulis ke PR (REST `/pulls` maupun GraphQL).
- `install.sh` mengganti seluruh folder skill (file lama yang dibuang ikut hilang) dan mencetak versi lama → baru.

**Yang perlu dilakukan:**
1. Semua dev: `git -C ~/SKILL-DEVS pull`, lalu `bash ~/SKILL-DEVS/install.sh <repo-proyek>`, commit lewat alur baru, buka ulang Claude Code.
2. Tiap dev membuat branch personal sekali: `git switch -c dev/<nama> origin/staging && git push -u origin dev/<nama>`.
3. @onrsama: setelah update sampai `main`, jalankan ulang `apply-github-protection.sh` (memasang ruleset staging dan check `branch-flow`).

## main-branch-guard 1.0.0 — 2026-11-09

- Rilis pertama: `main` hanya lewat PR yang di-approve @onrsama, agent tidak bisa push/merge/commit ke `main`, tidak bisa membaca/mengisi ENV.
- Hook `guard.mjs`, `CODEOWNERS`, ruleset `main-pr-only`, `install.sh`.
