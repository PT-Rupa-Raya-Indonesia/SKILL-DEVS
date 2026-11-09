#!/usr/bin/env node
// main-branch-guard — PreToolUse hook untuk Claude Code.
// Alur branch:
//   feat/<x> --merge bebas--> dev/<nama> --PR--> staging --PR oleh code owner--> main
// Memblokir (exit 2) tiga hal, apa pun alasan yang diberikan:
//   1. Perubahan langsung ke `main` / `staging`: commit/merge/rebase/cherry-pick saat berada
//      di branch itu, `git push` ke branch itu, `gh pr merge`, endpoint merge via `gh api`,
//      `gh pr create` ke main, dan PR ke staging yang tidak berasal dari dev/<nama>.
//   2. Menyentuh file ENV berisi nilai (.env, .env.local, .env.production, …) dan
//      CLI yang mengisi secret/variabel di platform (gh secret, railway variables, …).
//   3. Mengubah aturan penjaga itu sendiri (CODEOWNERS, hook ini, ruleset GitHub).
// Pesan stderr dikembalikan ke agent sebagai alasan penolakan.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const MAIN = 'main'; // hanya berubah lewat PR staging -> main yang di-approve code owner
const STAGING = 'staging'; // hanya menerima PR dari branch personal dev/<nama>
const PERSONAL = 'dev/'; // prefix branch personal tiap developer
const PROTECTED = [MAIN, STAGING];
const OWNER = '@onrsama';

// File ENV yang boleh disentuh: hanya templat tanpa nilai.
const ENV_TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template']);

const GUARD_FILES = [
  '.github/CODEOWNERS',
  'CODEOWNERS',
  'docs/CODEOWNERS',
  '.claude/settings.json',
  '.claude/skills/main-branch-guard/',
  '.github/workflows/branch-flow.yml',
];

function block(reason) {
  process.stderr.write(
    `⛔ main-branch-guard: ${reason}\n` +
      `Kebijakan tim: feat/<x> -> ${PERSONAL}<nama> -> PR ke ${STAGING} -> PR ${OWNER} ke ${MAIN} (CODEOWNERS), ` +
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

  // --- main & staging ---
  const branch = currentBranch(cwd);
  for (const seg of segments(cmd)) {
    const t = tokens(seg);
    const gi = t.indexOf('git');
    if (/\bgh\s+pr\s+merge\b/.test(seg)) block('merge PR dilakukan manusia di GitHub, bukan oleh agent.');
    // REST API membuat/mengubah PR: tidak bisa diperiksa sumbernya dengan andal, jadi tolak bila menyentuh base.
    if (/\bgh\s+api\b/.test(seg) && /\/pulls\b/.test(seg) && /\bbase\b/.test(seg)) {
      block(`gh api untuk membuat/mengubah base PR diblokir. Pakai gh pr create --base ${STAGING} dari ${PERSONAL}<nama>.`);
    }
    // Ganti base PR yang sudah ada: head-nya tidak terlihat dari perintah, jadi tidak diizinkan.
    if (/\bgh\s+pr\s+edit\b/.test(seg) && /(\s--base\b|\s-B)/.test(seg)) {
      block('gh pr edit --base diblokir. Tutup PR lalu buka ulang dengan base yang benar.');
    }
    if (/\bgh\s+pr\s+create\b/.test(seg)) {
      // dukung --base x, --base=x, -B x, -Bx (sama untuk --head/-H)
      const opt = (long, short) => {
        const k = t.findIndex(
          (x) => x === long || x === short || x.startsWith(`${long}=`) || (x.startsWith(short) && x.length > 2),
        );
        if (k === -1) return '';
        const x = t[k];
        if (x.startsWith(`${long}=`)) return x.slice(long.length + 1);
        if (x !== long && x !== short) return x.slice(2).replace(/^=/, '');
        return t[k + 1] || '';
      };
      const base = opt('--base', '-B');
      const head = opt('--head', '-H') || branch;
      if (base === MAIN) block(`PR ke ${MAIN} hanya dibuka ${OWNER} dari ${STAGING}.`);
      if (!base && /\bgh\s+pr\s+create\b/.test(seg)) {
        block(`gh pr create tanpa --base akan mengarah ke ${MAIN}. Pakai --base ${PERSONAL}<nama> (dari feat/*) atau --base ${STAGING} (dari ${PERSONAL}<nama>).`);
      }
      if (base === STAGING && !head.startsWith(PERSONAL)) {
        block(`PR ke ${STAGING} hanya dari branch personal ${PERSONAL}<nama> (sekarang: ${head || '?'}). Gabungkan dulu ke ${PERSONAL}<nama>, lalu buka PR dari sana.`);
      }
    }
    if (gi === -1) continue;
    // lewati opsi global git (-C dir, -c k=v)
    let i = gi + 1;
    while (t[i] && t[i].startsWith('-')) i += t[i] === '-C' || t[i] === '-c' ? 2 : 1;
    const sub = t[i];
    const rest = t.slice(i + 1);

    if (sub === 'push') {
      if (rest.some((x) => x === '--all' || x === '--mirror')) block(`git push --all/--mirror ikut mendorong ${MAIN}/${STAGING}.`);
      const hit = PROTECTED.find((b) =>
        rest.some((x) => x === b || x === `+${b}` || x.endsWith(`:${b}`) || x.endsWith(`refs/heads/${b}`)),
      );
      const refspecs = rest.filter((x) => !x.startsWith('-'));
      const implicit = refspecs.length <= 1 && PROTECTED.includes(branch) ? branch : ''; // `git push` di main/staging
      const target = hit || implicit;
      if (target) block(`git push ke ${target} diblokir. Push ke feat/* atau ${PERSONAL}<nama>, lalu buka PR ${PERSONAL}<nama> -> ${STAGING}.`);
    }

    // `git pull` tetap boleh: menyamakan staging lokal sebelum membuat branch.
    if (PROTECTED.includes(branch) && ['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am'].includes(sub)) {
      block(`"git ${sub}" saat berada di branch ${branch}. Pindah dulu: git switch ${PERSONAL}<nama> lalu git switch -c feat/<ringkas>.`);
    }
    const ur = PROTECTED.find((b) => rest.some((x) => x.endsWith(`refs/heads/${b}`)));
    if (sub === 'update-ref' && ur) block(`git update-ref pada ${ur} diblokir.`);
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
