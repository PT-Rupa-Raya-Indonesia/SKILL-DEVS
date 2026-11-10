# SKILL-DEVS

Kumpulan skill Claude Code untuk tim developer PT Rupa Raya Indonesia. Setiap folder di root adalah satu skill (`<nama>/SKILL.md` + skrip pendukung + `VERSION`). Riwayat perubahan ada di [CHANGELOG.md](CHANGELOG.md).

| Skill | Versi | Fungsi |
|---|---|---|
| [`main-branch-guard`](main-branch-guard/SKILL.md) | [1.4.0](CHANGELOG.md) | Alur branch `feat/*` → `dev/<nama>` → PR `staging` → PR → `main` (approval @onrsama atau @ahmadaqib). Pull/sinkron dulu sebelum push & PR, commit dan judul PR berformat Conventional Commits. AI agent tidak bisa push/commit ke `main`/`staging`, tidak bisa membuka PR ke `main` atau me-merge PR, dan tidak bisa membaca/mengisi ENV (`.env*`, secret GitHub/Railway/Supabase/Vercel, …). |

Aturan ini **berlaku umum di semua project dan repo** tim (organisasi maupun repo kolaborasi di akun personal); tidak ada nama repo yang ditulis mati.

## Alur branch tim

```
feat/<x> ──merge bebas──▶ dev/<nama> ──PR──▶ staging ──PR oleh @onrsama/@ahmadaqib──▶ main
 (fitur)                  (personal)          (integrasi)    (approval code owner)
```

| Branch | Siapa yang mengubah | Caranya |
|---|---|---|
| `feat/<x>`, `fix/<x>` | dev sendiri | commit & push bebas |
| `dev/<nama>` | pemilik branch | merge `feat/*` bebas (atau lewat PR bila mau review) |
| `staging` | anggota tim | **hanya PR dari `dev/<nama>`** |
| `main` | **@onrsama atau @ahmadaqib** | **hanya PR dari `staging`**, wajib approval salah satu code owner (penulis PR tidak bisa approve PR sendiri, jadi saling approve) |

Contoh sehari-hari:

```bash
# sekali saja: buat branch personal dari staging
git fetch origin
git switch -c dev/ahmad origin/staging
git push -u origin dev/ahmad

# tiap fitur: mulai dari dev/<nama> yang terbaru
git switch dev/ahmad && git pull
git switch -c feat/login-fix
# ... kerja ...
git commit -m "fix(auth): login magic link tidak lagi kedaluwarsa dini"
git switch dev/ahmad && git pull && git merge feat/login-fix

# naikkan ke staging: PULL DULU, baru push
git fetch origin
git pull origin staging          # konflik diselesaikan di branch sendiri
# jalankan tes/lint project
git push
gh pr create --base staging --fill
```

## Format commit & judul PR

[Conventional Commits](https://www.conventionalcommits.org/): `<tipe>(<scope>): <ringkasan>`, maksimal 72 karakter, jelas apa yang berubah dan di mana.

| Tipe | Untuk | Contoh |
|---|---|---|
| `feat` | fitur baru | `feat(search): pencarian global Ctrl+K` |
| `fix` | perbaikan bug | `fix(nav): pinch touchpad tidak lagi men-zoom halaman` |
| `docs` | dokumentasi | `docs(readme): tambah cara update skill` |
| `refactor` | struktur kode, perilaku sama | `refactor(engine): pisahkan hitung dinding dari render` |
| `perf` | percepatan | `perf(assets): penambahan model pertama 574→20 ms` |
| `test` | tes | `test(walls): kasus sudut T` |
| `style` | format saja | `style: rapikan indentasi plan.js` |
| `build` / `ci` | build, dependensi, pipeline | `ci: cek judul PR di branch-flow` |
| `chore` | pemeliharaan lain | `chore(deps): naikkan vite ke 5.4.10` |
| `revert` | batalkan commit | `revert: feat(search) pencarian global` |

Ditolak: `update`, `fix bug`, `fix: update`, `chore: wip`, tipe huruf besar, baris pertama > 72 karakter. Perubahan yang memutus kompatibilitas pakai `!`: `feat(api)!: ganti format respons /plans`. Satu commit = satu perubahan logis.

Yang menegakkan: hook Claude Code (`git commit -m`, `gh pr create --title`) dan check `branch-flow` di GitHub (judul PR ke `staging`/`main`).

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
2. membuat `.github/CODEOWNERS` berisi `* @onrsama @ahmadaqib` (bila belum ada; file lama tidak ditimpa)
3. memasang `.github/workflows/branch-flow.yml` (check yang menolak PR dari branch yang salah)
4. menambahkan hook `PreToolUse` dan daftar `deny` ke `.claude/settings.json` (isi settings lama tetap ada; aman dijalankan ulang)
5. menulis ringkasan aturan ke **`AGENTS.md`** dan **`CLAUDE.md`** di root repo (dibuat bila belum ada), supaya agent selain Claude (Codex, Cursor, dll.) juga membaca aturannya. Blok ini diberi penanda `<!-- skill:main-branch-guard start -->` … `end -->` dan diganti otomatis saat install ulang; isi lain di kedua file tidak disentuh.

Skill ini **tidak terikat ke repo atau organisasi tertentu**: bisa dipasang di repo organisasi PT-Rupa-Raya-Indonesia maupun repo kolaborasi di akun personal (mis. milik @onrsama/@ahmadaqib). Nama repo dibaca otomatis dari folder tempat skrip dijalankan. Untuk repo kolaborasi: @onrsama/@ahmadaqib harus punya akses minimal **Write** agar CODEOWNERS berlaku, dan skrip ruleset dijalankan oleh pemilik/admin repo itu.

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
git add .claude/skills/main-branch-guard .claude/settings.json .github/CODEOWNERS .github/workflows/branch-flow.yml AGENTS.md CLAUDE.md
git commit -m "chore: pasang main-branch-guard"
git switch dev/<nama> && git merge chore/main-branch-guard && git push
gh pr create --base staging --fill
```

### 4. Aktifkan penguncian di GitHub (salah satu owner: @onrsama atau @ahmadaqib)

Setelah perubahan sampai di `main` (PR `staging → main`), **salah satu** owner menjalankan dari repo proyek. Skrip memeriksa bahwa login `gh` ada di [`OWNERS`](main-branch-guard/OWNERS) dan ber-role Admin di repo itu:

```bash
bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh --dry-run
bash .claude/skills/main-branch-guard/scripts/apply-github-protection.sh
```

Ini memasang dua ruleset:

- `staging-pr-only` — `staging` wajib lewat PR, check `branch-flow` wajib lulus (sumber harus `dev/<nama>`), tidak bisa force-push/dihapus. Mau wajib 1 approval juga? Jalankan dengan `STAGING_APPROVALS=1`.
- `main-pr-only` — `main` wajib lewat PR dari `staging`, wajib approval code owner (@onrsama/@ahmadaqib), tidak bisa force-push/dihapus.

Admin hanya bisa bypass lewat PR. **Jadikan @onrsama dan @ahmadaqib sama-sama Admin** di tiap repo, supaya pasang, cabut, dan approval tidak bergantung pada satu orang. Skrip memberi peringatan bila baru satu owner yang Admin. Branch `staging` harus sudah ada di GitHub sebelum skrip dijalankan.

> Ruleset di repo **private** butuh paket GitHub berbayar (Pro untuk akun personal, Team untuk organisasi). Bila API menolak, buat *Settings › Branches › Branch protection rule* untuk `main` dan `staging` dengan opsi yang sama, ditambah required status check `branch-flow`.

### 5. Buka ulang Claude Code

Hook dibaca saat sesi dimulai. Tutup lalu buka lagi sesi Claude Code di repo proyek.

### Cek pemasangan

Di sesi Claude Code repo proyek, minta: *"push langsung ke staging"*, *"buka PR ke main"*, atau *"isi .env dengan API key ini"*. Semuanya harus ditolak dengan pesan `⛔ main-branch-guard`.

## Owner (tanpa single point of failure)

Daftar owner ada di satu file: [`main-branch-guard/OWNERS`](main-branch-guard/OWNERS) (saat ini **@onrsama** dan **@ahmadaqib**). Dari file itu:

| Hal | Siapa yang bisa |
|---|---|
| Approve PR `staging → main` | salah satu owner (CODEOWNERS dibuat dari `OWNERS`) |
| Pasang / perbarui ruleset (`apply-github-protection.sh`) | salah satu owner yang Admin di repo itu |
| Cabut ruleset (`remove-github-protection.sh`, `uninstall.sh --github`) | salah satu owner yang Admin di repo itu |
| Approve PR yang mencabut skill dari repo proyek | salah satu owner |

Kalau satu owner berhalangan, owner lain bisa melakukan semuanya sendiri. Menambah atau mengganti owner: ubah `OWNERS` lewat PR ke SKILL-DEVS, lalu jalankan ulang `install.sh` di tiap repo. CODEOWNERS yang sudah ada tidak ditimpa; `install.sh` memberi tahu owner yang belum tercantum.

## Uninstall (mencabut skill dari repo proyek)

Dilakukan manusia, bukan AI agent (hook memblokir agent menjalankan skrip ini). Urutan yang aman:

```bash
# 1. cabut file skill di branch fitur
cd /path/ke/repo-proyek
git switch dev/<nama> && git pull && git switch -c chore/cabut-main-branch-guard
bash ~/SKILL-DEVS/uninstall.sh .            # tanya konfirmasi; --yes untuk lewati
git add -A && git commit -m "chore(guard): cabut skill main-branch-guard"
git switch dev/<nama> && git pull origin staging && git merge chore/cabut-main-branch-guard && git push
gh pr create --base staging --fill          # lalu PR staging → main, approve salah satu owner

# 2. segera setelah PR itu sampai di main: cabut ruleset (salah satu owner yang Admin)
bash ~/SKILL-DEVS/main-branch-guard/scripts/remove-github-protection.sh <owner/repo> --dry-run
bash ~/SKILL-DEVS/main-branch-guard/scripts/remove-github-protection.sh <owner/repo>
```

`uninstall.sh` hanya menghapus yang dipasang `install.sh`:
- folder `.claude/skills/main-branch-guard/`
- blok bertanda di `AGENTS.md`/`CLAUDE.md`; file dihapus bila hanya berisi blok itu
- hook dan `deny` bawaan di `.claude/settings.json`; pengaturan lain tetap ada
- `branch-flow.yml` dan `CODEOWNERS`, hanya bila isinya masih buatan SKILL-DEVS; yang sudah diubah manual dibiarkan dan diberi tahu

Kenapa ruleset dicabut **setelah** PR sampai `main`: selama ruleset aktif, PR ke `staging` mewajibkan check `branch-flow`. Setelah workflow-nya hilang dari `staging`, check itu tidak lagi berjalan, sehingga PR berikutnya tertahan sampai ruleset dicabut. Untuk mencabut semuanya sekaligus tanpa PR, salah satu owner bisa menjalankan `bash ~/SKILL-DEVS/uninstall.sh <repo> --github`. Perintah ini mencabut ruleset lebih dulu, lalu menghapus file.

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

### Untuk @onrsama/@ahmadaqib

Bila CHANGELOG menyebut ruleset berubah, jalankan ulang `apply-github-protection.sh` setelah update sampai di `main`. Skrip memperbarui ruleset yang ada, tidak membuat dobel.

### Untuk yang mengubah skill

1. Ubah file di `SKILL-DEVS/<skill>/` (bukan salinan di repo proyek — salinan itu ditimpa saat `install.sh` berikutnya).
2. Naikkan `<skill>/VERSION`: patch untuk perbaikan kecil, minor untuk aturan/file baru, major bila alur kerja berubah.
3. Tambah entri di atas CHANGELOG.md: apa yang berubah + **yang perlu dilakukan** tim.
4. Perbarui baris versi di tabel atas README ini.
5. Kirim lewat PR ke repo SKILL-DEVS untuk di-review @onrsama/@ahmadaqib.

Hook memblokir AI agent menyunting file penjaga (`CODEOWNERS`, `branch-flow.yml`, `.claude/settings.json`, folder skill) di repo proyek, jadi perubahan skill selalu lewat repo ini.

## Lapis penegakan

| Lapis | Menahan |
|---|---|
| Ruleset GitHub `main-pr-only` + `staging-pr-only` | semua orang & semua agent (penegak utama) |
| Check `branch-flow` | PR ke `staging` bukan dari `dev/*`, PR ke `main` bukan dari `staging` |
| `.github/CODEOWNERS` → `* @onrsama @ahmadaqib` | merge ke `main` tanpa approval @onrsama/@ahmadaqib |
| Hook Claude Code (`guard.mjs`) | agent Claude di laptop, sebelum perintah dijalankan |

Hook hanya mengikat Claude Code. Agent lain (Codex, Cursor, dsb.) tetap tertahan ruleset dan check GitHub.
