# SKILL-DEVS

Kumpulan skill Claude Code untuk tim developer PT Rupa Raya Indonesia. Setiap folder di root adalah satu skill (`<nama>/SKILL.md` + skrip pendukung + `VERSION`). Riwayat perubahan ada di [CHANGELOG.md](CHANGELOG.md).

| Skill | Versi | Fungsi |
|---|---|---|
| [`main-branch-guard`](main-branch-guard/SKILL.md) | [1.1.0](CHANGELOG.md) | Alur branch `feat/*` → `dev/<nama>` → PR `staging` → PR @onrsama → `main`. AI agent tidak bisa push/commit ke `main`/`staging`, tidak bisa membuka PR ke `main` atau me-merge PR, dan tidak bisa membaca/mengisi ENV (`.env*`, secret GitHub/Railway/Supabase/Vercel, …). |

## Alur branch tim

```
feat/<x> ──merge bebas──▶ dev/<nama> ──PR──▶ staging ──PR oleh @onrsama──▶ main
 (fitur)                  (personal)          (integrasi)    (approval code owner)
```

| Branch | Siapa yang mengubah | Caranya |
|---|---|---|
| `feat/<x>`, `fix/<x>` | dev sendiri | commit & push bebas |
| `dev/<nama>` | pemilik branch | merge `feat/*` bebas (atau lewat PR bila mau review) |
| `staging` | anggota tim | **hanya PR dari `dev/<nama>`** |
| `main` | **hanya @onrsama** | **hanya PR dari `staging`**, wajib approval code owner |

Contoh sehari-hari:

```bash
# sekali saja: buat branch personal dari staging
git fetch origin
git switch -c dev/ahmad origin/staging
git push -u origin dev/ahmad

# tiap fitur
git switch dev/ahmad && git pull
git switch -c feat/login-fix
# ... kerja, commit ...
git switch dev/ahmad && git merge feat/login-fix && git push

# naikkan ke staging
git pull origin staging          # selesaikan konflik di branch sendiri
gh pr create --base staging --fill
```

## Cara install

### Syarat

- [Claude Code](https://claude.com/claude-code)
- `git`, `node` ≥ 18
- `gh` (GitHub CLI) yang sudah login — untuk membuka PR dan langkah ruleset oleh admin

### 1. Clone repo ini (sekali per laptop)

```bash
git clone https://github.com/PT-Rupa-Raya-Indonesia/SKILL-DEVS.git ~/SKILL-DEVS
```

### 2. Pasang ke repo proyek

```bash
bash ~/SKILL-DEVS/install.sh /path/ke/repo-proyek
```

Untuk skill lain: `bash ~/SKILL-DEVS/install.sh /path/ke/repo-proyek <nama-skill>`.

Skrip ini:

1. mengganti isi `repo-proyek/.claude/skills/main-branch-guard/` dengan versi terbaru
2. membuat `.github/CODEOWNERS` berisi `* @onrsama` (bila belum ada; file lama tidak ditimpa)
3. memasang `.github/workflows/branch-flow.yml` (check yang menolak PR dari branch yang salah)
4. menambahkan hook `PreToolUse` dan daftar `deny` ke `.claude/settings.json` (isi settings lama tetap ada; aman dijalankan ulang)

<details>
<summary>Install manual (tanpa skrip)</summary>

```bash
cd /path/ke/repo-proyek
rm -rf .claude/skills/main-branch-guard
mkdir -p .claude/skills .github/workflows
cp -R ~/SKILL-DEVS/main-branch-guard .claude/skills/
rm -rf .claude/skills/main-branch-guard/templates
cp -n ~/SKILL-DEVS/main-branch-guard/templates/CODEOWNERS .github/CODEOWNERS
cp ~/SKILL-DEVS/main-branch-guard/templates/branch-flow.yml .github/workflows/branch-flow.yml
```

Lalu gabungkan isi `main-branch-guard/templates/settings.json` ke `.claude/settings.json` (jangan menimpa isi yang sudah ada).

</details>

### 3. Commit lewat alur tim

```bash
cd /path/ke/repo-proyek
git switch dev/<nama> && git pull
git switch -c chore/main-branch-guard
git add .claude/skills/main-branch-guard .claude/settings.json .github/CODEOWNERS .github/workflows/branch-flow.yml
git commit -m "chore: pasang main-branch-guard"
git switch dev/<nama> && git merge chore/main-branch-guard && git push
gh pr create --base staging --fill
```

### 4. Aktifkan penguncian di GitHub (hanya @onrsama)

Setelah perubahan sampai di `main` (PR `staging → main`), dari repo proyek:

```bash
bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh --dry-run
bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh
```

Ini memasang dua ruleset:

- `staging-pr-only` — `staging` wajib lewat PR, check `branch-flow` wajib lulus (sumber harus `dev/<nama>`), tidak bisa force-push/dihapus. Mau wajib 1 approval juga? Jalankan dengan `STAGING_APPROVALS=1`.
- `main-pr-only` — `main` wajib lewat PR dari `staging`, wajib approval code owner (@onrsama), tidak bisa force-push/dihapus.

Admin hanya bisa bypass lewat PR. Pastikan hanya @onrsama yang ber-role **Admin** di repo itu. Branch `staging` harus sudah ada di GitHub sebelum skrip dijalankan.

> Ruleset di repo **private** butuh paket GitHub berbayar (Pro untuk akun personal, Team untuk organisasi). Bila API menolak, buat *Settings › Branches › Branch protection rule* untuk `main` dan `staging` dengan opsi yang sama, ditambah required status check `branch-flow`.

### 5. Buka ulang Claude Code

Hook dibaca saat sesi dimulai. Tutup lalu buka lagi sesi Claude Code di repo proyek.

### Cek pemasangan

Di sesi Claude Code repo proyek, minta: *"push langsung ke staging"*, *"buka PR ke main"*, atau *"isi .env dengan API key ini"*. Semuanya harus ditolak dengan pesan `⛔ main-branch-guard`.

## Saat ada update skill

Setiap perubahan skill menaikkan angka di `<skill>/VERSION` dan dicatat di [CHANGELOG.md](CHANGELOG.md), lengkap dengan **apa yang harus dilakukan tim**.

### Untuk semua dev

```bash
git -C ~/SKILL-DEVS pull
cat ~/SKILL-DEVS/CHANGELOG.md | head -40          # baca bagian "Yang perlu dilakukan"
bash ~/SKILL-DEVS/install.sh /path/ke/repo-proyek  # mencetak versi lama → baru
```

Lalu commit hasilnya lewat alur tim (langkah 3 di atas) dan buka ulang Claude Code. Cukup satu dev yang meng-commit update ke repo proyek; dev lain mendapatkannya lewat `git pull` dari `staging` setelah PR-nya di-merge.

Cek versi yang terpasang di repo proyek:

```bash
cat /path/ke/repo-proyek/.claude/skills/main-branch-guard/VERSION
```

### Untuk @onrsama

Bila CHANGELOG menyebut ruleset berubah, jalankan ulang `apply-github-protection.sh` setelah update sampai di `main`. Skrip memperbarui ruleset yang ada, tidak membuat dobel.

### Untuk yang mengubah skill

1. Ubah file di `SKILL-DEVS/<skill>/` (bukan salinan di repo proyek — salinan itu ditimpa saat `install.sh` berikutnya).
2. Naikkan `<skill>/VERSION`: patch untuk perbaikan kecil, minor untuk aturan/file baru, major bila alur kerja berubah.
3. Tambah entri di atas CHANGELOG.md: apa yang berubah + **yang perlu dilakukan** tim.
4. Perbarui baris versi di tabel atas README ini.
5. Kirim lewat PR ke repo SKILL-DEVS untuk di-review @onrsama.

Hook memblokir AI agent menyunting file penjaga (`CODEOWNERS`, `branch-flow.yml`, `.claude/settings.json`, folder skill) di repo proyek, jadi perubahan skill selalu lewat repo ini.

## Lapis penegakan

| Lapis | Menahan |
|---|---|
| Ruleset GitHub `main-pr-only` + `staging-pr-only` | semua orang & semua agent (penegak utama) |
| Check `branch-flow` | PR ke `staging` bukan dari `dev/*`, PR ke `main` bukan dari `staging` |
| `.github/CODEOWNERS` → `* @onrsama` | merge ke `main` tanpa approval @onrsama |
| Hook Claude Code (`guard.mjs`) | agent Claude di laptop, sebelum perintah dijalankan |

Hook hanya mengikat Claude Code. Agent lain (Codex, Cursor, dsb.) tetap tertahan ruleset dan check GitHub.
