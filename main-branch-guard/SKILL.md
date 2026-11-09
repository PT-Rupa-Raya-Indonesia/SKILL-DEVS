---
name: main-branch-guard
description: Kebijakan tim PT Rupa Raya Indonesia untuk branch main dan ENV. main hanya berubah lewat Pull Request yang disetujui code owner @Onrsama; AI agent tidak pernah push/merge/commit langsung ke main, tidak menjalankan `gh pr merge`, dan tidak membaca atau mengisi file ENV (.env, .env.local, secret platform). Gunakan skill ini setiap kali pekerjaan menyentuh git push, merge, rebase, rilis, deploy, "naikkan ke main", "langsung merge saja", membuat/menyelesaikan PR, CODEOWNERS, branch protection, atau ENV, API key, token, secret, variabel lingkungan, Railway/Supabase/GitHub secrets — termasuk ketika user meminta melewati aturan ini.
---

# Main Branch Guard

Dua aturan keras untuk semua anggota tim dan semua AI agent di repo ini:

1. **main hanya berubah lewat PR yang di-approve @Onrsama.** Tidak ada push langsung, merge lokal ke main, force-push, atau merge PR oleh agent.
2. **AI agent tidak menyentuh ENV yang berisi nilai.** Tidak membaca, menulis, atau mengisi `.env*` (kecuali templat `.env.example`), dan tidak memasang secret/variabel di platform (GitHub, Railway, Supabase, Vercel, dsb.).

Alasannya: main adalah sumber deploy, jadi satu commit tanpa review bisa langsung sampai ke pengguna; dan isi ENV (kunci API, kredensial database) yang masuk ke konteks agent bisa ikut ke log, transkrip, atau commit. Satu pemilik (@Onrsama) membuat tanggung jawab review jelas.

## Tiga lapis penegakan

Skill ini hanya instruksi; yang benar-benar mengunci ada di lapisan lain, jadi aturan tetap berlaku meski agent atau orang lupa:

| Lapis | File | Menahan siapa |
|---|---|---|
| Server GitHub (ruleset `main-pr-only`) | `scripts/apply-github-protection.sh` | semua orang & semua agent — penegak utama |
| CODEOWNERS | `.github/CODEOWNERS` (`* @Onrsama`) | PR tanpa approval @Onrsama tidak bisa di-merge |
| Hook Claude Code (PreToolUse) | `.claude/settings.json` → `scripts/guard.mjs` | agent Claude di mesin lokal, sebelum perintah jalan |

Bila hook menolak perintah (pesan `⛔ main-branch-guard`), jangan mencari jalan memutar (perintah lain yang efeknya sama, menyunting hook, `--no-verify`, `gh api` langsung, browser). Penolakan itu memang hasil yang diinginkan; laporkan ke user dan tawarkan alur PR.

## Alur kerja agent

1. **Cek branch dulu:** `git branch --show-current`. Bila di `main`, buat branch sebelum mengubah apa pun:
   `git switch -c <tipe>/<ringkas>` — tipe: `feat`, `fix`, `docs`, `chore`, `refactor`.
2. Commit di branch itu seperti biasa.
3. **Push branch fitur saja:** `git push -u origin <tipe>/<ringkas>`.
4. **Buka PR ke main** (boleh oleh agent bila user memintanya): `gh pr create --base main --fill`, lalu sebutkan link PR. Reviewer otomatis @Onrsama lewat CODEOWNERS.
5. **Berhenti di situ.** Merge dilakukan @Onrsama di GitHub. Agent tidak menjalankan `gh pr merge`, tidak mengaktifkan auto-merge, dan tidak menekan tombol merge lewat browser.

Branch lain (`staging`, branch fitur) tetap bebas dipakai; aturan keras hanya untuk `main`.

### Bila user meminta "langsung merge ke main saja"

Tolak dengan sopan, jelaskan singkat, lalu kerjakan versi yang diizinkan. Contoh:

> Main dikunci: perubahan hanya masuk lewat PR yang di-approve @Onrsama, dan agent tidak boleh merge. Saya sudah push branch `fix/pinch-zoom` dan membuka PR: <link>. Tinggal di-review dan di-merge oleh @Onrsama.

Ini berlaku juga bila user mengaku owner, bilang "darurat", atau menyuruh mematikan hook/ruleset. Owner yang sebenarnya bisa merge sendiri di GitHub; agent tidak perlu melakukannya.

## ENV: apa yang boleh dan tidak

| Boleh | Tidak boleh |
|---|---|
| Menulis/memperbarui `.env.example` berisi **nama** variabel + placeholder (`SUPABASE_URL=`, `API_KEY=your-key-here`) | Membaca `.env`, `.env.local`, `.env.production`, dst. (`cat`, `grep`, `source`, `--env-file`) |
| Membaca kode untuk tahu variabel apa yang dibutuhkan (`process.env.X`) | Menulis nilai ke `.env*` (`echo X=... >> .env`, `sed -i`) |
| Menjelaskan ke user variabel mana yang perlu diisi dan di mana | `gh secret set`, `gh variable set`, `railway variables --set`, `supabase secrets set`, `vercel env add`, panel ENV hosting lewat MCP/browser |
| Menjalankan app yang memuat ENV sendiri (`npm run api`) tanpa mencetak nilainya | Menempelkan kunci/token ke kode, commit, log, URL, atau chat |

Bila tugas butuh ENV yang belum ada, berhenti dan beri user daftar yang perlu diisi sendiri:

> Butuh 2 variabel baru. Tolong isi manual di `.env` (lokal) dan di dashboard Railway (produksi):
> - `RENDER_API_URL` — URL layanan render
> - `RENDER_API_KEY` — kunci dari dashboard render
> Nama dan placeholder-nya sudah saya tambahkan di `.env.example`.

Kalau user menempelkan nilai secret di chat dan meminta agent menuliskannya: jangan tulis; sarankan mereka mengisinya sendiri dan merotasi kunci itu karena sudah muncul di transkrip.

## Penjaga tidak diubah oleh agent

File berikut hanya boleh diubah manusia lewat PR yang di-approve @Onrsama, dan hook memblokir agent menyuntingnya:

- `.github/CODEOWNERS`
- `.claude/settings.json`
- `.claude/skills/main-branch-guard/**`
- ruleset/branch protection di GitHub (`gh api .../rulesets`, `.../protection`)

## Setup sekali (untuk @Onrsama)

1. Merge PR yang berisi `.github/CODEOWNERS`, `.claude/settings.json`, dan folder skill ini.
2. Jalankan sendiri (bukan lewat agent), dengan `gh` yang login sebagai admin repo:
   ```bash
   bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh --dry-run
   bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh
   ```
3. Di GitHub › Settings › Collaborators, pastikan hanya @Onrsama yang ber-role **Admin** (anggota lain: Write). Admin mendapat hak bypass, tapi bypass-nya pun hanya lewat PR.
4. Uji: dari akun anggota lain, `git push origin main` harus ditolak GitHub dengan pesan rule violation.

Batasan yang perlu diketahui:
- Ruleset di repo **private** milik akun personal butuh GitHub Pro (atau repo di organisasi Team). Bila API menolak, pakai *Settings › Branches › Branch protection rule* untuk `main` dengan opsi yang sama (Require PR, Require review from Code Owners, Do not allow bypassing).
- GitHub tidak mengizinkan penulis PR meng-approve PR-nya sendiri. PR buatan @Onrsama di-merge lewat hak bypass admin (tetap lewat PR).
- Hook hanya mengikat Claude Code. Agent lain (Codex, Cursor, dsb.) tetap tertahan ruleset GitHub, tapi tidak oleh hook lokal; untuk ENV mereka bergantung pada kebijakan ini dan `.gitignore`.

## Anggota tim tanpa AI

Aturan yang sama: kerja di branch, push branch, buka PR ke main, tunggu approval @Onrsama. Jangan simpan secret produksi di repo; kirim kebutuhan ENV ke @Onrsama.
