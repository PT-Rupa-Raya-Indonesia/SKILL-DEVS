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
const OWNER = '@onrsama/@ahmadaqib';

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

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd: cwd || process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

// --- Format pesan commit & judul PR: Conventional Commits ---
// <tipe>(<scope opsional>)<! opsional>: <ringkasan>   — maks 72 karakter
const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const COMMIT_RE = new RegExp(`^(${COMMIT_TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: \\S.*$`);
const VAGUE_RE = /^(update|updates|fix|fixes|wip|change|changes|misc|minor|perbaikan|ubah|edit|tes|test|coba|asdf|\.+)\.?$/i;

function checkSubject(subject, what) {
  const s = subject.trim();
  if (/^(Merge |Revert ")/.test(s)) return; // pesan bawaan git
  const example = `contoh: "fix(nav): pinch touchpad tidak lagi men-zoom halaman"`;
  if (!COMMIT_RE.test(s)) {
    block(`${what} "${s}" tidak mengikuti format <tipe>(<scope>): <ringkasan>. Tipe: ${COMMIT_TYPES.join(', ')}; ${example}.`);
  }
  if (s.length > 72) block(`${what} terlalu panjang (${s.length} > 72 karakter). Ringkas baris pertama; detail taruh di body.`);
  const desc = s.replace(/^[^:]+:\s*/, '');
  if (desc.length < 8 || VAGUE_RE.test(desc)) block(`${what} "${s}" terlalu umum. Tulis apa yang berubah dan di mana; ${example}.`);
}

function checkCommitMessage(cmd) {
  if (!/\bgit\b[^\n]*\bcommit\b/.test(cmd)) return;
  if (/--amend\b/.test(cmd) && /--no-edit\b/.test(cmd)) return;
  let subject = null;
  const here = cmd.match(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n\s*\1\b/);
  if (here && /(-m|--message|-F|--file)\b/.test(cmd)) {
    subject = here[2].split('\n').find((l) => l.trim()) || '';
  } else {
    // -m, --message, dan flag gabungan seperti -am / -sm
    const m = cmd.match(/(?:\s-[a-zA-Z]*m|\s--message)(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/);
    if (m) subject = (m[1] ?? m[2] ?? m[3] ?? '').split(/\\n|\n/)[0];
  }
  if (subject !== null) checkSubject(subject, 'Pesan commit');
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

const OWNER_SCRIPTS = /\b(uninstall\.sh|install\.sh|apply-github-protection\.sh|remove-github-protection\.sh)\b/;
const DRY_RUN_OK = new Set(['apply-github-protection.sh', 'remove-github-protection.sh']); // yang punya --dry-run
const READ_ONLY_CMDS = new Set(['cat', 'less', 'more', 'head', 'tail', 'grep', 'rg', 'wc', 'ls', 'stat', 'file', 'diff', 'git', 'shellcheck']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

function checkOwnerScripts(cmd) {
  const m = cmd.match(OWNER_SCRIPTS);
  if (!m) return;
  const deny = (name) =>
    block(`"${name}" dijalankan manusia, bukan agent. Minta user (owner: ${OWNER}) menjalankannya sendiri.`);
  const segs = segments(cmd);
  // `... | bash`, `bash -s`, `bash <<EOF`: shell yang membaca dari stdin bersama nama skrip di perintah.
  for (const seg of segs) {
    const t = tokens(seg);
    if (SHELLS.has(path.basename(t[0] || '')) && (t.length === 1 || t.slice(1).every((x) => x.startsWith('-') || x.startsWith('<')))) {
      deny(m[1]);
    }
  }
  for (const seg of segs) {
    const sm = seg.match(OWNER_SCRIPTS);
    if (!sm) continue;
    const name = sm[1];
    const t = tokens(seg);
    const head = path.basename(t[0] || '');
    if (/^(sed|perl)$/.test(head) && !t.some((x) => /^-[a-zA-Z]*i/.test(x))) continue; // sed tanpa -i = baca
    if (READ_ONLY_CMDS.has(head) && !t.some((x) => /^[<>]/.test(x))) continue;
    if (SHELLS.has(head)) {
      // bash -n <skrip> = cek sintaks saja; opsi harus sebelum nama skrip, di pemanggilan yang sama
      const k = t.findIndex((x) => OWNER_SCRIPTS.test(x));
      const opts = t.slice(1, k);
      if (k > 0 && opts.length && opts.every((x) => x.startsWith('-')) && opts.some((x) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(x))) continue;
    }
    // --dry-run hanya sah sebagai argumen skrip yang memang mendukungnya, di segmen yang sama
    const k = t.findIndex((x) => OWNER_SCRIPTS.test(x));
    if (DRY_RUN_OK.has(name) && k !== -1 && t.slice(k + 1).includes('--dry-run')) continue;
    deny(name);
  }
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
  // Skrip pasang/cabut skill & ruleset hanya dijalankan manusia (owner), bukan agent.
  // Diperiksa per segmen perintah; default-nya tolak, kecuali segmen itu jelas hanya membaca.
  checkOwnerScripts(cmd);
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
    // gh api yang menulis ke PR (REST /pulls atau GraphQL) tidak bisa diperiksa sumber/tujuannya
    // dengan andal, jadi semua yang mengubah ditolak; membaca tetap boleh.
    if (/\bgh\s+api\b/.test(seg)) {
      const mutating = /(-X|--method)[\s=]*(POST|PUT|PATCH|DELETE)\b/i.test(seg) || /(^|\s)(-f|-F|--field|--raw-field|--input)(\s|=|$)/.test(seg);
      if (/\/pulls\b/.test(seg) && mutating) {
        block(`gh api yang membuat/mengubah PR diblokir. Pakai gh pr create --base ${STAGING} dari ${PERSONAL}<nama>.`);
      }
      if (/\bgraphql\b/.test(seg) && /(createPullRequest|updatePullRequest|mergePullRequest|enablePullRequestAutoMerge|updatePullRequestBranch|Ruleset|BranchProtection)/i.test(seg)) {
        block('gh api graphql yang membuat/mengubah/merge PR atau ruleset diblokir.');
      }
    }
    // Ganti base PR yang sudah ada: head-nya tidak terlihat dari perintah, jadi tidak diizinkan.
    if (/\bgh\s+pr\s+edit\b/.test(seg) && /(\s--base\b|\s-B)/.test(seg)) {
      block('gh pr edit --base diblokir. Tutup PR lalu buka ulang dengan base yang benar.');
    }
    if (/\bgh\s+pr\s+create\b/.test(seg)) {
      // dukung --base x, --base=x, -B x, -Bx (sama untuk --head/-H). Kumpulkan SEMUA kemunculan:
      // bila ada lebih dari satu nilai (mis. "-Bmain" disisipkan di judul), tolak — lebih aman
      // daripada menebak mana yang dibaca gh.
      const opt = (long, short) => {
        const vals = [];
        t.forEach((x, k) => {
          if (x === long || x === short) vals.push(t[k + 1] || '');
          else if (x.startsWith(`${long}=`)) vals.push(x.slice(long.length + 1));
          else if (x.startsWith(short) && x.length > 2 && !x.startsWith('--')) vals.push(x.slice(2).replace(/^=/, ''));
        });
        const uniq = [...new Set(vals)];
        if (uniq.length > 1) block(`${long} muncul dengan beberapa nilai (${uniq.join(', ')}). Tulis satu ${long} saja.`);
        return uniq[0] || '';
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
      // Judul PR eksplisit ikut format commit.
      const ti = t.findIndex((x) => x === '--title' || x === '-t' || x.startsWith('--title='));
      if (ti !== -1) checkSubject(t[ti].startsWith('--title=') ? t[ti].slice(8) : t[ti + 1] || '', 'Judul PR');
      // Sebelum PR ke staging: branch sudah memuat staging terbaru dan sudah di-push.
      if (base === STAGING) {
        const fix = `git fetch origin && git switch ${head} && git pull origin ${STAGING} && git push`;
        if (git(cwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${STAGING}`]) === null) {
          block(`origin/${STAGING} belum ada di lokal. Jalankan dulu: git fetch origin`);
        }
        if (git(cwd, ['merge-base', '--is-ancestor', `origin/${STAGING}`, head]) === null) {
          block(`${head} belum memuat ${STAGING} terbaru. Sinkronkan dulu, selesaikan konflik di branch sendiri, lalu push: ${fix}`);
        }
        const local = git(cwd, ['rev-parse', head]);
        const remote = git(cwd, ['rev-parse', `refs/remotes/origin/${head}`]);
        if (!remote || local !== remote) {
          block(`${head} di lokal belum sama dengan origin/${head} (belum di-push atau tertinggal). Jalankan: git switch ${head} && git pull --rebase && git push`);
        }
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
    checkCommitMessage(String(ti.command || ''));
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
