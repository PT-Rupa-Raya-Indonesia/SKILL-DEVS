## Alur branch & ENV (main-branch-guard)

Aturan tim untuk semua developer dan semua AI agent (Claude Code, Codex, Cursor, dll.) di repo ini. Detail: `.claude/skills/main-branch-guard/SKILL.md`.

```
feat/<x> ──merge bebas──▶ dev/<nama> ──PR──▶ staging ──PR oleh @onrsama──▶ main
```

- Kerja di `feat/<x>` yang dibuat dari branch personal `dev/<nama>`, lalu gabungkan ke `dev/<nama>`.
- `staging` hanya menerima PR dari `dev/<nama>`: `gh pr create --base staging --fill`.
- `main` hanya menerima PR dari `staging`, yang dibuka dan di-approve **@onrsama** (CODEOWNERS).
- Agent **tidak** push/commit langsung ke `main` atau `staging`, **tidak** membuka PR ke `main`, dan **tidak** me-merge PR mana pun (`gh pr merge`, auto-merge, tombol merge).
- Agent **tidak** membaca atau mengisi ENV berisi nilai (`.env`, `.env.local`, `.env.production`, …) dan tidak memasang secret/variabel platform (`gh secret`, `railway variables`, `supabase secrets`, `vercel env`, …). Yang boleh: `.env.example` berisi nama variabel + placeholder. Bila butuh ENV baru, beri tahu user variabel apa yang perlu diisi sendiri.
- Bila hook menolak perintah (`⛔ main-branch-guard`), jangan mencari jalan memutar; laporkan ke user dan tawarkan langkah yang diizinkan.
- File penjaga (`.github/CODEOWNERS`, `.github/workflows/branch-flow.yml`, `.claude/settings.json`, `.claude/skills/main-branch-guard/`) hanya diubah manusia lewat repo SKILL-DEVS + `install.sh`.
