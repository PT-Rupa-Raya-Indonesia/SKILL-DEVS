# SKILL-DEVS

Kumpulan skill Claude Code untuk tim developer PT Rupa Raya Indonesia. Setiap folder di root adalah satu skill (`<nama>/SKILL.md` + skrip pendukung).

| Skill | Fungsi |
|---|---|
| [`main-branch-guard`](main-branch-guard/SKILL.md) | `main` hanya berubah lewat PR yang di-approve **@onrsama** (CODEOWNERS). AI agent tidak bisa push/merge/commit ke `main`, tidak bisa `gh pr merge`, dan tidak bisa membaca/mengisi ENV (`.env*`, secret GitHub/Railway/Supabase/Vercel, …). |

## Cara install

### Syarat

- [Claude Code](https://claude.com/claude-code)
- `git`, `node` ≥ 18
- `gh` (GitHub CLI) yang sudah login — hanya untuk langkah ruleset oleh admin

### 1. Clone repo ini (sekali per laptop)

```bash
git clone https://github.com/PT-Rupa-Raya-Indonesia/SKILL-DEVS.git ~/SKILL-DEVS
```

Untuk memperbarui nanti: `git -C ~/SKILL-DEVS pull`.

### 2. Pasang ke repo proyek

Dari mana saja, arahkan ke folder repo proyek:

```bash
bash ~/SKILL-DEVS/install.sh /path/ke/repo-proyek
```

Untuk skill lain: `bash ~/SKILL-DEVS/install.sh /path/ke/repo-proyek <nama-skill>`.

Skrip ini:

1. menyalin skill ke `repo-proyek/.claude/skills/main-branch-guard/`
2. membuat `.github/CODEOWNERS` berisi `* @onrsama` (bila belum ada; file lama tidak ditimpa)
3. menambahkan hook `PreToolUse` dan daftar `deny` ke `.claude/settings.json` (isi settings lama tetap dipertahankan; aman dijalankan ulang)

<details>
<summary>Install manual (tanpa skrip)</summary>

```bash
cd /path/ke/repo-proyek
mkdir -p .claude/skills .github
cp -R ~/SKILL-DEVS/main-branch-guard .claude/skills/
rm -rf .claude/skills/main-branch-guard/templates
cp ~/SKILL-DEVS/main-branch-guard/templates/CODEOWNERS .github/CODEOWNERS
```

Lalu salin isi `main-branch-guard/templates/settings.json` ke `.claude/settings.json` (gabungkan dengan isi yang sudah ada, jangan menimpa).

</details>

### 3. Commit lewat PR

```bash
cd /path/ke/repo-proyek
git switch -c chore/main-branch-guard
git add .claude/skills/main-branch-guard .claude/settings.json .github/CODEOWNERS
git commit -m "chore: pasang main-branch-guard"
git push -u origin chore/main-branch-guard
gh pr create --base main --fill
```

### 4. Aktifkan penguncian di GitHub (hanya @onrsama, sekali per repo)

Setelah PR di-merge, dari repo proyek:

```bash
bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh --dry-run
bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh
```

Ini memasang ruleset `main-pr-only`: `main` wajib lewat PR, wajib approval code owner, tidak bisa force-push atau dihapus, dan admin hanya bisa bypass lewat PR. Pastikan hanya @onrsama yang ber-role **Admin** di repo itu.

> Repo **private** di akun personal butuh GitHub Pro untuk ruleset. Repo di organisasi (seperti PT-Rupa-Raya-Indonesia) memakai paket organisasi; bila API menolak, buat *Settings › Branches › Branch protection rule* untuk `main` dengan opsi yang sama.

### 5. Buka ulang Claude Code

Hook dibaca saat sesi dimulai. Tutup lalu buka lagi sesi Claude Code di repo proyek.

### Cek pemasangan

Di sesi Claude Code repo proyek, minta: *"push langsung ke main"* atau *"isi .env dengan API key ini"*. Keduanya harus ditolak dengan pesan `⛔ main-branch-guard`.

## Tiga lapis penegakan

| Lapis | Menahan |
|---|---|
| Ruleset GitHub `main-pr-only` | semua orang & semua agent (penegak utama) |
| `.github/CODEOWNERS` → `* @onrsama` | merge tanpa approval @onrsama |
| Hook Claude Code (`guard.mjs`) | agent Claude di laptop, sebelum perintah dijalankan |

Hook hanya mengikat Claude Code. Agent lain (Codex, Cursor, dsb.) tetap tertahan ruleset GitHub.

## Mengubah skill

Skill di repo ini juga mengikuti aturannya sendiri: ubah lewat branch + PR yang di-approve @onrsama. Hook memblokir AI agent menyunting file penjaga (`CODEOWNERS`, `.claude/settings.json`, folder skill) di repo proyek, jadi perubahan dilakukan manusia.
