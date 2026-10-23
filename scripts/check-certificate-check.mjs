#!/usr/bin/env node
// check-certificate-check.mjs — the demo apps never turn the SDK's certificate check off.
//
// The SDK's certificateCheck option (SDK 1.8.0) defaults to on; false turns the certificate
// check off, and the check then reports SKIPPED for every scan. These demos are what an
// integrator copies, so they never set it off: a host app that does would report a check it
// never made, and an interception on a pinned service would go unreported. Removing this
// guard is a deliberate decision, not a cleanup.
//
// Red if any demo source (android/demo/src outside test/ and androidTest/, Kotlin and Java;
// ios/SDKDemo/Sources, Swift) passes certificateCheck anything but the literal `true`. The
// match is broad on purpose: `false`, a negation, a flag or a build constant all count, since
// the decision is "never" and the guard does not try to evaluate. Comments are not code: a
// block comment, and a line comment only where `//` starts the line or follows whitespace (a
// URL's `https://` is code). Names that merely begin with the word (`certificateCheckPassed`)
// and Swift declarations (`let certificateCheck: Bool`) are not the argument.
//
// The rules are the same as the Nayutal Guard apps' own guards, so both refuse the same forms:
//   Kotlin/Java: a named `certificateCheck =` with any value but `true`, and any bare `false`
//                inside a `NayutalSdkConfig(...)` argument list (the configuration has no other
//                boolean, so a positional or Java call passing `false` can only be turning it off).
//   Swift:       a `certificateCheck:` argument with any value but `true`.
//
// Each demo also has a unit test asserting that its configuration reads certificateCheck true
// (android/demo/src/test, ios/SDKDemo/Tests). This script is the part CI runs on every change.
//
// Usage:
//   node scripts/check-certificate-check.mjs             # check; exit 1 on any finding
//   node scripts/check-certificate-check.mjs --selftest  # the guard must be able to fail
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');
}

// What a Kotlin or Java source passes certificateCheck other than `true`.
export function offendingKotlin(source) {
  const code = stripComments(source);
  const named = [...code.matchAll(/\bcertificateCheck\s*=(?!=)\s*([^,)\s][^,)\n]*)/g)]
    .map((m) => m[1].trim()).filter((v) => v !== 'true').map((v) => `certificateCheck = ${v}`);
  const positional = [];
  for (const m of code.matchAll(/\bNayutalSdkConfig\s*\(/g)) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    if (/\bfalse\b/.test(code.slice(start, Math.max(i - 1, start)))) positional.push('NayutalSdkConfig(... false ...)');
  }
  return [...named, ...positional];
}

// What a Swift source passes the certificateCheck argument other than `true`; spans line breaks.
export function offendingSwift(source) {
  const code = stripComments(source);
  return [...code.matchAll(/(?<!\b(?:var|let)\s{1,8})\bcertificateCheck\s*:\s*([^,)\s][^,)\n]*)/g)]
    .map((m) => m[1].trim()).filter((v) => v !== 'true').map((v) => `certificateCheck: ${v}`);
}

function walk(dir, keep, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

// Every finding in the tree at `root`. Fails closed: a tree where either demo's sources cannot be
// found is a finding, never a pass by not looking.
export function check(root) {
  const kotlin = walk(join(root, 'android/demo/src'), (p) => /\.(kt|java)$/.test(p) && !/\/(test|androidTest)\//.test(p));
  const swift = walk(join(root, 'ios/SDKDemo/Sources'), (p) => p.endsWith('.swift'));
  const found = [];
  if (kotlin.length === 0) found.push('android/demo/src: no Kotlin or Java sources found (failing closed)');
  if (swift.length === 0) found.push('ios/SDKDemo/Sources: no Swift sources found (failing closed)');
  for (const f of kotlin) for (const o of offendingKotlin(readFileSync(f, 'utf8'))) found.push(`${relative(root, f)}: ${o}`);
  for (const f of swift) for (const o of offendingSwift(readFileSync(f, 'utf8'))) found.push(`${relative(root, f)}: ${o}`);
  return { found, scanned: kotlin.length + swift.length };
}

function selftest() {
  const failures = [];
  const expect = (cond, what) => { if (!cond) failures.push(what); };

  // The consumer apps' planted forms (not one literal) and near misses, verbatim.
  for (const planted of [
    'NayutalSdkConfig(baseUrl = u, apiKey = k, certificateCheck = false)',
    'config.copy(certificateCheck=!true)',
    'NayutalSdkConfig(u, k, certificateCheck = BuildConfig.CERT_CHECK)',
    'NayutalSdkConfig(\n    certificateCheck =\n        false,\n)',
    'NayutalSdkConfig(baseUrl = "https://api.example.jp/", apiKey = key, certificateCheck = false)',
    'NayutalSdkConfig(url, key, null, null, null, null, null, logger, null, false)',
    'new NayutalSdkConfig(url, key, null, null, null, null, null, logger, null, false);',
  ]) expect(offendingKotlin(planted).length > 0, `Kotlin planted form passed: ${JSON.stringify(planted)}`);
  for (const clean of [
    'NayutalSdkConfig(baseUrl = u, apiKey = k, certificateCheck = true)',
    'val certificateCheckPassed = SecurityCheck(id = 1)',
    '// certificateCheck = false is never set here',
    '/* certificateCheck = false */ val x = 1',
    'if (config.certificateCheck == false) log()',
    'NayutalSdkConfig(baseUrl = "https://api.example.jp/", apiKey = key) // a URL, then a comment',
    'val ok = false; NayutalSdkConfig(baseUrl = u, apiKey = k)',
  ]) expect(offendingKotlin(clean).length === 0, `Kotlin near miss tripped: ${JSON.stringify(clean)}`);
  for (const planted of [
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: false)',
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck:!true)',
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: Flags.certCheck)',
    'NayutalSdkConfig(\n    certificateCheck:\n        false\n)',
    'NayutalSdkConfig(baseUrl: "https://api.example.jp/", apiKey: key, certificateCheck: false)',
  ]) expect(offendingSwift(planted).length === 1, `Swift planted form passed: ${JSON.stringify(planted)}`);
  for (const clean of [
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: true)',
    'let certificateCheckPassed: Bool = check(id: 1)',
    '// certificateCheck: false is never set here',
    '/* certificateCheck: false */ let x = 1',
    'NayutalSdkConfig(baseUrl: "https://api.example.jp/", apiKey: key) // a URL, then a comment',
    'let certificateCheck: Bool = result.ok',
    '@Published var certificateCheck: CheckState',
  ]) expect(offendingSwift(clean).length === 0, `Swift near miss tripped: ${JSON.stringify(clean)}`);

  // The real tree is clean, and the same tree with the check turned off in each demo's
  // configuration is red: the walk reaches the files a demo actually builds from.
  expect(check(REPO).found.length === 0, 'the repository itself is not clean; run without --selftest');
  const plants = [
    ['android/demo/src/main/java/com/nayutal/sdkdemo/DemoSdkConfig.kt', /certificateCheck = true/, 'certificateCheck = false'],
    ['ios/SDKDemo/Sources/DemoSdkConfig.swift', /certificateCheck: true/, 'certificateCheck: false'],
  ];
  for (const [file, from, to] of plants) {
    const tmp = mkdtempSync(join(tmpdir(), 'cc-guard-'));
    try {
      for (const d of ['android/demo/src', 'ios/SDKDemo/Sources']) cpSync(join(REPO, d), join(tmp, d), { recursive: true });
      if (!existsSync(join(tmp, file))) { expect(false, `${file}: missing; the plant has nowhere to go`); continue; }
      const text = readFileSync(join(tmp, file), 'utf8');
      expect(from.test(text), `${file}: the configuration no longer writes the default out; update the plant`);
      writeFileSync(join(tmp, file), text.replace(from, to));
      expect(check(tmp).found.some((f) => f.startsWith(file)), `${file}: certificateCheck turned off in a tree copy was not caught`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  // An empty tree fails closed.
  const empty = mkdtempSync(join(tmpdir(), 'cc-guard-'));
  try {
    expect(check(empty).found.length === 2, 'a tree with no demo sources passed');
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
  return failures;
}

// Compare real paths: under a symlinked tmp or a path with a space, a string comparison never matches.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  if (process.argv.includes('--selftest')) {
    const failures = selftest();
    for (const f of failures) console.error(`SELFTEST FAIL: ${f}`);
    if (failures.length) process.exit(1);
    console.log('selftest OK: every planted form is caught, every near miss is clean, a planted tree is red, an empty tree fails closed');
  } else {
    const { found, scanned } = check(REPO);
    for (const f of found) console.error(`CERTIFICATE CHECK OFF: ${f}`);
    if (found.length) process.exit(1);
    console.log(`OK: ${scanned} demo sources, none turns the certificate check off`);
  }
}
