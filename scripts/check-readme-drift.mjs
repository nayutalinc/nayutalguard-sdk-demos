#!/usr/bin/env node
// check-readme-drift.mjs — the Japanese READMEs never drift from the English ones.
//
// Ported from the docs-site check (nayutalguard-docs scripts/check-ja-drift.mjs). Every
// README.md in this repository has a README.ja.md beside it, and the Japanese file opens
// with a pin line on its own line:
//
//   <!-- en-source: <path of the English README> sha256:<sha256 of that English file> -->
//
// The check enforces, for every README.md:
//   1. a README.ja.md sibling exists;
//   2. its pin names the right English file and carries the sha256 of the English file AS IT
//      IS NOW — so an English edit that does not carry its Japanese edit (and a fresh pin) in
//      the same commit fails;
//   3. code is byte-identical: fenced blocks (same order, same info string, same body); and the
//      inline code spans, versions (x.y.z[-rc.N]), SHA-256 values and links are the same
//      multisets. Two link rules are deliberate: the language cross-link at the top of each
//      file (README.md <-> README.ja.md) is excluded, and a Japanese file may point a link at
//      the Japanese counterpart of what the English links: a relative README.ja.md where that
//      file exists, or the /ja/ page under docs.nayutalguard.com (which cannot be probed
//      offline, so either form is accepted for the same page - a different page still fails).
//
// Usage:
//   node scripts/check-readme-drift.mjs             # check; exit 1 on any failure
//   node scripts/check-readme-drift.mjs --pin android/demo/README.md   # print a fresh pin line
//   node scripts/check-readme-drift.mjs --selftest  # the guard must be able to fail
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename, relative } from 'node:path';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const PIN_RE = /^<!--\s*en-source:\s*([\w./-]*README\.md)\s+sha256:([0-9a-f]{64})\s*-->\s*$/m;
const DOCS_HOST = 'https://docs.nayutalguard.com';

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules' || e === 'build' || e === 'DerivedData') continue;
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : e === 'README.md' && out.push(p);
  }
  return out;
}
const jaPathFor = (enPath) => join(dirname(enPath), 'README.ja.md');

// Split a README into fenced code blocks and the prose in between.
function extract(text) {
  const fences = [];
  const prose = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, info, body) => { fences.push({ info: info.trim(), body }); return '\n'; });
  const inline = [...prose.matchAll(/`([^`\n]+)`/g)].map(m => m[1]);
  const versions = [...prose.matchAll(/\b\d+\.\d+\.\d+(?:-rc\.\d+)?\b/g)].map(m => m[0]);
  const shas = [...prose.matchAll(/\b[0-9a-f]{64}\b/g)].map(m => m[0]);
  const links = [...prose.matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1])
    .concat([...prose.matchAll(/\*\*(https?:\/\/[^\s*]+)\*\*/g)].map(m => m[1]));
  const isLanguageLink = (l) => /^(\.\/)?README(\.ja)?\.md$/.test(l);
  return { fences, inline, versions, shas, links: links.filter(l => !isLanguageLink(l)) };
}
// What the English link may look like in the Japanese file.
function jaFormOf(link, jaExists) {
  if (/README\.md$/.test(link)) {
    const jaLink = link.replace(/README\.md$/, 'README.ja.md');
    return jaExists(jaLink) ? jaLink : link;
  }
  return link;
}
const sortedJoin = (a) => [...a].sort().join('\n');
function diffMultiset(name, en, ja, failures) {
  if (sortedJoin(en) !== sortedJoin(ja)) {
    const enOnly = en.filter(x => !ja.includes(x)); const jaOnly = ja.filter(x => !en.includes(x));
    failures.push(`${name}: EN-only [${enOnly.slice(0, 5).join(', ')}] JA-only [${jaOnly.slice(0, 5).join(', ')}]`);
  }
}

// Compare one Japanese README to its English reference. Returns failure strings (empty = ok).
export function compareReadme(enText, jaText, enPath, jaExists = () => true) {
  const failures = [];
  const pin = jaText.match(PIN_RE);
  if (!pin) return ['pin line missing or malformed (expected <!-- en-source: <path>/README.md sha256:<hex> --> on its own line)'];
  if (pin[1] !== enPath) failures.push(`pin names ${pin[1]} but this file mirrors ${enPath}`);
  const enHash = sha256(Buffer.from(enText));
  if (pin[2] !== enHash) failures.push(`English README changed since translation: pinned sha256 ${pin[2].slice(0, 12)}… but current is ${enHash.slice(0, 12)}… — update the Japanese README and re-pin in the same commit (node scripts/check-readme-drift.mjs --pin ${enPath})`);
  const jaBody = jaText.replace(PIN_RE, '');
  const en = extract(enText), ja = extract(jaBody);
  if (en.fences.length !== ja.fences.length) failures.push(`fenced code blocks: EN ${en.fences.length}, JA ${ja.fences.length}`);
  else en.fences.forEach((f, i) => {
    if (f.info !== ja.fences[i].info) failures.push(`code block ${i + 1}: info string EN '${f.info}' vs JA '${ja.fences[i].info}'`);
    if (f.body !== ja.fences[i].body) failures.push(`code block ${i + 1} (${f.info || 'plain'}): body differs from English`);
  });
  diffMultiset('inline code', en.inline, ja.inline, failures);
  diffMultiset('versions', en.versions, ja.versions, failures);
  diffMultiset('SHA-256 values', en.shas, ja.shas, failures);
  // A docs.nayutalguard.com/ja/... link is the same page as its English URL for this comparison.
  const docsNormalized = (l) => l.startsWith(DOCS_HOST + '/ja/') ? DOCS_HOST + '/' + l.slice((DOCS_HOST + '/ja/').length) : l;
  diffMultiset('links (Japanese counterpart accepted where it exists)', en.links.map(l => jaFormOf(l, jaExists)), ja.links.map(docsNormalized), failures);
  return failures;
}

export const pinLine = (enPath) => `<!-- en-source: ${enPath} sha256:${sha256(readFileSync(enPath))} -->`;

function selftest() {
  const en = '# Title\n\n日本語版: [README.ja.md](README.ja.md)\n\nUse `foo/bar.kt` and version 1.4.2, hash `' + 'a'.repeat(64) + '`.\n\n```bash\nshasum -a 256 x.aar\n```\n\nSee [Android](android/demo/README.md) and **https://docs.nayutalguard.com/release-notes/**.\n';
  const good = `<!-- en-source: README.md sha256:${sha256(Buffer.from(en))} -->\n# 見出し\n\nEnglish: [README.md](README.md)\n\n\`foo/bar.kt\` とバージョン 1.4.2、ハッシュ \`${'a'.repeat(64)}\` を使います。\n\n\`\`\`bash\nshasum -a 256 x.aar\n\`\`\`\n\n[Android](android/demo/README.ja.md) と **https://docs.nayutalguard.com/release-notes/** を参照してください。\n`;
  const cases = [
    ['identical code passes', good, 0],
    ['changed code block fails', good.replace('shasum -a 256 x.aar', 'shasum -a 256 y.aar'), 1],
    ['changed inline path fails', good.replace('foo/bar.kt', 'foo/baz.kt'), 1],
    ['changed version fails', good.replace('1.4.2', '1.4.1'), 1],
    ['changed SHA-256 fails', good.replace('a'.repeat(64), 'b'.repeat(64)), 1],
    ['link to the English README where the Japanese one exists fails', good.replace('android/demo/README.ja.md', 'android/demo/README.md'), 1],
    ['link to the English README passes while the Japanese one is missing', good.replace('android/demo/README.ja.md', 'android/demo/README.md'), 0, () => false],
    ['docs link in its /ja/ form passes (same page)', good.replace('docs.nayutalguard.com/release-notes/', 'docs.nayutalguard.com/ja/release-notes/'), 0],
    ['docs link to a different page fails', good.replace('docs.nayutalguard.com/release-notes/', 'docs.nayutalguard.com/ja/app-release-notes/'), 1],
    ['stale pin (English edited without the Japanese) fails', good.replace(/sha256:[0-9a-f]{64}/, 'sha256:' + '0'.repeat(64)), 1],
    ['missing pin fails', good.split('\n').slice(1).join('\n'), 1],
  ];
  let bad = 0;
  for (const [name, ja, wantFail, exists] of cases) {
    // Default fixture state = this repository today: README.ja.md twins exist, no /ja/ docs page does.
    const f = compareReadme(en, ja, 'README.md', exists ?? ((l) => !l.startsWith('http')));
    const ok = wantFail ? f.length > 0 : f.length === 0;
    console.log(`${ok ? 'ok  ' : 'FAIL'} selftest: ${name}${f.length ? ' -> ' + f[0].slice(0, 90) : ''}`);
    if (!ok) bad++;
  }
  console.log(`selftest: ${cases.length} cases, ${bad} unexpected`);
  return bad;
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args[0] === '--selftest') process.exit(selftest() ? 1 : 0);
  if (args[0] === '--pin') { console.log(pinLine(args[1])); process.exit(0); }
  let failed = 0, checked = 0;
  const root = process.cwd();
  for (const enAbs of walk(root)) {
    const en = relative(root, enAbs);
    const ja = jaPathFor(en);
    checked++;
    if (!existsSync(ja)) { failed++; console.log(`FAIL ${en}: no Japanese README at ${ja}`); continue; }
    const jaExists = (link) => existsSync(join(dirname(en), link));
    const f = compareReadme(readFileSync(en, 'utf8'), readFileSync(ja, 'utf8'), en, jaExists);
    if (f.length) { failed++; console.log(`FAIL ${ja}`); f.forEach(x => console.log(`     - ${x}`)); }
    else console.log(`ok   ${ja} <- ${en}`);
  }
  console.log(`readme-drift: ${checked} README(s) checked, ${failed} failing`);
  process.exit(failed ? 1 : 0);
}
