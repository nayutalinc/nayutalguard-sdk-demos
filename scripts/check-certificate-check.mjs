#!/usr/bin/env node
// check-certificate-check.mjs — the demo apps never turn the SDK's certificate check off.
//
// The SDK's certificateCheck option (SDK 1.8.0) defaults to on; false turns the certificate
// check off, and the check then reports SKIPPED for every scan. These demos are what an
// integrator copies, so they never set it off: a host app that does would report a check it
// never made, and an interception on a pinned service would go unreported. Removing this
// guard is a deliberate decision, not a cleanup.
//
// Red if any demo source (android/demo/src outside the src/test and src/androidTest source sets,
// Kotlin and Java; ios/SDKDemo/Sources, Swift) passes certificateCheck anything but the literal
// `true`. The match is broad on purpose: `false`, a negation, a flag or a build constant all
// count, since the decision is "never" and the guard does not try to evaluate. String literals
// and comments are not code. Names that merely begin with the word (`certificateCheckPassed`),
// declarations (`val certificateCheck = ...`, `let certificateCheck: Bool`) and member references
// (`case .certificateCheck:`) are not the argument. A Swift function parameter declared with the
// name (`func f(certificateCheck: Bool)`) is still reported: it fails closed, and a demo has no
// reason to declare one.
//
// The rules:
//   Kotlin/Java: a named `certificateCheck =` with any value but `true`, and an unnamed argument
//                in certificateCheck's position of a `NayutalSdkConfig(...)` call (the 10th) with
//                any value but `true`, as a positional Kotlin call or a Java call passes it.
//   Swift:       a `certificateCheck:` argument with any value but `true`.
//
// Each demo also has a unit test asserting that its configuration reads certificateCheck true
// (android/demo/src/test, ios/SDKDemo/Tests). This script is the part CI runs on every change.
//
// Usage:
//   node scripts/check-certificate-check.mjs             # check; exit 1 on any finding
//   node scripts/check-certificate-check.mjs --selftest  # the guard must be able to fail
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// String literals are emptied first, so a "/*" or "//" inside one (an Accept header such as
// "text/*", a URL) never starts a comment that hides real code; then comments are removed.
function stripComments(source) {
  return source.replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

// The top-level arguments of the call whose "(" ends at `start`: nested (), {} and [] are skipped,
// so a lambda's own commas or booleans are never an argument.
function topLevelArguments(code, start) {
  const args = [];
  let depth = 0;
  let from = start;
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    if ('({['.includes(c)) depth++;
    else if (')}]'.includes(c)) {
      if (depth === 0) { args.push(code.slice(from, i)); return args; }
      depth--;
    } else if (c === ',' && depth === 0) { args.push(code.slice(from, i)); from = i + 1; }
  }
  return args;
}

// NayutalSdkConfig's parameters in declaration order (SDK 1.8.0, android/sdk NayutalScanner.kt): a
// positional call, Kotlin or Java, passes certificateCheck as the argument at this index.
const CERTIFICATE_CHECK_POSITION = 9;

// What a Kotlin or Java source passes certificateCheck other than `true`.
export function offendingKotlin(source) {
  const code = stripComments(source);
  // A declaration (`val certificateCheck = ...`) or a member reference is not the argument.
  const named = [...code.matchAll(/(?<!\b(?:val|var)\s{1,8})(?<![.\w])certificateCheck\s*=(?!=)\s*([^,)\s][^,)\n]*)/g)]
    .map((m) => m[1].trim()).filter((v) => v !== 'true').map((v) => `certificateCheck = ${v}`);
  const positional = [];
  for (const m of code.matchAll(/\bNayutalSdkConfig\s*\(/g)) {
    const arg = topLevelArguments(code, m.index + m[0].length)[CERTIFICATE_CHECK_POSITION];
    // An unnamed argument in certificateCheck's place: anything but `true` (false, a negation, a flag,
    // Boolean.FALSE) turns the check off or might.
    if (arg !== undefined && !/^\s*\w+\s*=(?!=)/.test(arg) && arg.trim() !== 'true') {
      positional.push(`NayutalSdkConfig(..., ${arg.trim()} as certificateCheck)`);
    }
  }
  return [...named, ...positional];
}

// What a Swift source passes the certificateCheck argument other than `true`; spans line breaks.
export function offendingSwift(source) {
  const code = stripComments(source);
  // A declaration (`let certificateCheck: Bool`) and a member reference (`case .certificateCheck:`) are not
  // the argument.
  return [...code.matchAll(/(?<!\b(?:var|let)\s{1,8})(?<![.\w])certificateCheck\s*:\s*([^,)\s][^,)\n]*)/g)]
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
  const kotlin = walk(join(root, 'android/demo/src'), (p) => /\.(kt|java)$/.test(p) && !/\/src\/(test|androidTest)\//.test(p));
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
    // Positional forms that are not the literal false, and a string that looks like a comment opener.
    'NayutalSdkConfig(u, null, k, null, null, null, null, logger, null, !true)',
    'NayutalSdkConfig(u, null, k, null, null, null, null, logger, null, BuildConfig.CC)',
    'new NayutalSdkConfig(u, null, k, null, null, null, null, logger, null, Boolean.FALSE, null);',
    'val h = "text/*"\nval c = NayutalSdkConfig(baseUrl = u, apiKey = k, certificateCheck = false)\n/* x */',
  ]) expect(offendingKotlin(planted).length > 0, `Kotlin planted form passed: ${JSON.stringify(planted)}`);
  for (const clean of [
    'NayutalSdkConfig(baseUrl = u, apiKey = k, certificateCheck = true)',
    'val certificateCheckPassed = SecurityCheck(id = 1)',
    '// certificateCheck = false is never set here',
    '/* certificateCheck = false */ val x = 1',
    'if (config.certificateCheck == false) log()',
    'NayutalSdkConfig(baseUrl = "https://api.example.jp/", apiKey = key) // a URL, then a comment',
    'val ok = false; NayutalSdkConfig(baseUrl = u, apiKey = k)',
    'val certificateCheck = config.certificateCheck',
    'NayutalSdkConfig(baseUrl = u, apiKey = k, requestHeaders = { if (debug == false) mapOf() else mapOf() })',
    'NayutalSdkConfig(u, null, k, null, null, null, null, logger, null, true, { mapOf("a" to "false") })',
  ]) expect(offendingKotlin(clean).length === 0, `Kotlin near miss tripped: ${JSON.stringify(clean)}`);
  for (const planted of [
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: false)',
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck:!true)',
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: Flags.certCheck)',
    'NayutalSdkConfig(\n    certificateCheck:\n        false\n)',
    'NayutalSdkConfig(baseUrl: "https://api.example.jp/", apiKey: key, certificateCheck: false)',
    'let s = "a/*b"\nNayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: false)',
  ]) expect(offendingSwift(planted).length === 1, `Swift planted form passed: ${JSON.stringify(planted)}`);
  for (const clean of [
    'NayutalSdkConfig(baseUrl: u, apiKey: k, certificateCheck: true)',
    'let certificateCheckPassed: Bool = check(id: 1)',
    '// certificateCheck: false is never set here',
    '/* certificateCheck: false */ let x = 1',
    'NayutalSdkConfig(baseUrl: "https://api.example.jp/", apiKey: key) // a URL, then a comment',
    'let certificateCheck: Bool = result.ok',
    '@Published var certificateCheck: CheckState',
    'case .certificateCheck:\n    return "cert"',
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
  // A main-source file in a package named `test` is app code, and is scanned.
  {
    const tmp = mkdtempSync(join(tmpdir(), 'cc-guard-'));
    try {
      const dir = join(tmp, 'android/demo/src/main/java/com/nayutal/sdkdemo/test');
      cpSync(join(REPO, 'ios/SDKDemo/Sources'), join(tmp, 'ios/SDKDemo/Sources'), { recursive: true });
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'DebugConfig.kt'), 'val c = NayutalSdkConfig(baseUrl = u, apiKey = k, certificateCheck = false)\n');
      expect(check(tmp).found.some((f) => f.includes('/test/DebugConfig.kt')), 'a main source under a package named test was not scanned');
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
