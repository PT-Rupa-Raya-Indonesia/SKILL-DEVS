#!/usr/bin/env node
// main-branch-guard — PreToolUse hook untuk Claude Code.
// Memblokir (exit 2) tiga hal, apa pun alasan yang diberikan:
//   1. Perubahan langsung ke `main`: commit/merge/rebase/cherry-pick saat berada di main,
//      `git push` ke main, `gh pr merge`, dan endpoint merge via `gh api`.
//   2. Menyentuh file ENV berisi nilai (.env, .env.local, .env.production, …) dan
//      CLI yang mengisi secret/variabel di platform (gh secret, railway variables, …).
//   3. Mengubah aturan penjaga itu sendiri (CODEOWNERS, hook ini, ruleset GitHub).
// Pesan stderr dikembalikan ke agent sebagai alasan penolakan.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const PROTECTED = 'main';
const OWNER = '@onrsama';

// File ENV yang boleh disentuh: hanya templat tanpa nilai.
const ENV_TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template']);

const GUARD_FILES = [
  '.github/CODEOWNERS',
  'CODEOWNERS',
  'docs/CODEOWNERS',
  '.claude/settings.json',
  '.claude/skills/main-branch-guard/',
];

function block(reason) {
  process.stderr.write(
    `⛔ main-branch-guard: ${reason}\n` +
      `Kebijakan tim: main hanya berubah lewat Pull Request yang disetujui ${OWNER} (CODEOWNERS), ` +
      `dan AI agent tidak mengisi/membaca ENV. Lihat .claude/skills/main-branch-guard/SKILL.md.\n`,
  );
  process.exit(2);
}

function isEnvValueFile(p) {
  if (!p) return false;
  const base = path.basename(String(p));
  if (ENV_TEMPLATES.has(base)) return false;
  return /^\.env(\..+)?$/.test(base) || /\.env$/.test(base) && base !== '.env.example';
}

function isGuardFile(p, cwd) {
  if (!p) return false;
  const abs = path.resolve(cwd || process.cwd(), String(p));
  const root = process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd();
  const rel = path.relative(root, abs).split(path.sep).join('/');
  return GUARD_FILES.some((g) => (g.endsWith('/') ? rel.startsWith(g) : rel === g));
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

// Pecah perintah majemuk (&&, ||, ;, |, baris baru) jadi segmen-segmen.
function segments(cmd) {
  return cmd
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokens(seg) {
  return (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^['"]|['"]$/g, ''));
}

function checkBash(cmd, cwd) {
  // --- ENV: file berisi nilai ---
  const envRefs = cmd.match(/(?:^|[\s"'=/<>:])(\.env(?:\.[A-Za-z0-9_-]+)*)(?=$|[\s"';|&)>])/g) || [];
  for (const raw of envRefs) {
    const name = raw.replace(/^[\s"'=/<>:]/, '');
    if (!ENV_TEMPLATES.has(name)) block(`perintah menyentuh file ENV "${name}". Isi ENV dikerjakan manusia, bukan agent.`);
  }

  // --- ENV: CLI pengisi secret/variabel platform ---
  const secretCli = [
    [/\bgh\s+secret\s+(set|delete|remove)\b/, 'gh secret'],
    [/\bgh\s+variable\s+(set|delete)\b/, 'gh variable'],
    [/\brailway\s+variables?\b.*(--set|\bset\b|--remove|\bdelete\b)/, 'railway variables'],
    [/\bvercel\s+env\s+(add|rm|remove|pull)\b/, 'vercel env'],
    [/\bsupabase\s+secrets\s+(set|unset)\b/, 'supabase secrets'],
    [/\bfly(ctl)?\s+secrets\s+(set|unset|import)\b/, 'fly secrets'],
    [/\bheroku\s+config:(set|unset)\b/, 'heroku config'],
    [/\bnetlify\s+env:(set|unset|import)\b/, 'netlify env'],
    [/\bwrangler\s+secret\s+(put|delete|bulk)\b/, 'wrangler secret'],
  ];
  for (const [re, name] of secretCli) {
    if (re.test(cmd)) block(`"${name}" mengisi/mengubah ENV di platform. Minta manusia yang menjalankannya.`);
  }

  // --- Penjaga itu sendiri ---
  if (/\bgh\s+api\b/.test(cmd) && /(rulesets|branches\/[^\s]+\/protection|\/merges\b|\/pulls\/\d+\/merge)/.test(cmd)) {
    const readOnly = !/(-X|--method)\s*(PUT|POST|PATCH|DELETE)/i.test(cmd) && !/\s-(f|F)\s|--field|--raw-field|--input/.test(cmd);
    if (!readOnly || /\/merges\b|\/pulls\/\d+\/merge/.test(cmd)) block('gh api tidak boleh mengubah ruleset/branch protection atau melakukan merge.');
  }
  for (const g of GUARD_FILES) {
    const needle = g.replace(/\/$/, '');
    if (cmd.includes(needle) && /(>|\bsed\s+-i|\btee\b|\brm\b|\bmv\b|\bcp\b|\bperl\s+-pi|\bgit\s+(rm|mv|checkout|restore))/.test(cmd)) {
      block(`perintah tampak mengubah file penjaga "${needle}". Ubah lewat PR oleh ${OWNER}.`);
    }
  }

  // --- main ---
  const branch = currentBranch(cwd);
  for (const seg of segments(cmd)) {
    const t = tokens(seg);
    const gi = t.indexOf('git');
    if (/\bgh\s+pr\s+merge\b/.test(seg)) block(`merge PR hanya oleh ${OWNER} di GitHub, bukan oleh agent.`);
    if (gi === -1) continue;
    // lewati opsi global git (-C dir, -c k=v)
    let i = gi + 1;
    while (t[i] && t[i].startsWith('-')) i += t[i] === '-C' || t[i] === '-c' ? 2 : 1;
    const sub = t[i];
    const rest = t.slice(i + 1);

    if (sub === 'push') {
      if (rest.some((x) => x === '--all' || x === '--mirror')) block('git push --all/--mirror ikut mendorong main.');
      const hitsMain = rest.some(
        (x) =>
          x === PROTECTED ||
          x === `+${PROTECTED}` ||
          x.endsWith(`:${PROTECTED}`) ||
          x.endsWith(`refs/heads/${PROTECTED}`),
      );
      const refspecs = rest.filter((x) => !x.startsWith('-'));
      const implicit = refspecs.length <= 1 && branch === PROTECTED; // `git push` / `git push origin` di main
      if (hitsMain || implicit) block(`git push ke ${PROTECTED} diblokir. Push ke branch fitur lalu buka PR.`);
    }

    if (branch === PROTECTED && ['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am', 'pull'].includes(sub)) {
      block(`"git ${sub}" saat berada di branch ${PROTECTED}. Buat branch dulu: git switch -c <tipe>/<ringkas>.`);
    }
    if (sub === 'update-ref' && rest.some((x) => x.endsWith(`refs/heads/${PROTECTED}`))) {
      block(`git update-ref pada ${PROTECTED} diblokir.`);
    }
  }
}

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input || '{}');
  } catch {
    process.exit(0);
  }
  const tool = data.tool_name || '';
  const ti = data.tool_input || {};
  const cwd = data.cwd;

  if (tool === 'Bash') {
    checkBash(String(ti.command || ''), cwd);
  } else {
    const p = ti.file_path || ti.notebook_path || ti.path || '';
    if (isEnvValueFile(p)) block(`${tool} pada file ENV "${path.basename(p)}" diblokir (baca maupun tulis).`);
    if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool) && isGuardFile(p, cwd)) {
      block(`file penjaga "${p}" hanya boleh diubah manusia lewat PR yang disetujui ${OWNER}.`);
    }
    if (tool === 'Grep' && ti.glob && /\.env/.test(ti.glob) && !/\.env\.(example|sample|template)/.test(ti.glob)) {
      block('Grep ke file ENV diblokir.');
    }
  }
  process.exit(0);
});
