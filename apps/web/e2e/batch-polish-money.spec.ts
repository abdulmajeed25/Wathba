import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Batch POLISH Unit 5 — Wathba is SAR-only, and «ر.س» is the only currency mark
 * allowed to reach a user.
 *
 * The homepage hero shipped «$312M» for months. It survived every previous
 * currency sweep because of WHERE the dollar sign hides: in JSX text position,
 *
 *     <Num>${compactNum(stats.raised)}</Num>
 *
 * is a literal "$" followed by a JSX expression — which looks exactly like a
 * `${...}` template placeholder to a grep, so the usual searches filtered it out
 * as a false positive. It was not one. There were six of these, not one.
 *
 * M1 is therefore a STATIC guard against that precise shape, and it is the
 * assertion the scope asks for — that the SAR formatter is the only money
 * renderer. M2/M3 prove the rendered output.
 */

const SRC = join(__dirname, '..', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/**
 * Blank out template literals, strings and comments while PRESERVING newlines,
 * so a match's line number is still the real one.
 *
 * A per-line "does it contain a backtick" heuristic is not enough: a template
 * literal spans lines, and `${wathbaKeyframes}` inside one is an interpolation
 * on a line that holds no backtick of its own. Only a stateful scan can tell
 * "$ followed by { in rendered JSX text" from "$ followed by { inside a
 * template literal", which is the whole distinction this guard rests on.
 */
function blankNonJsx(code: string): string {
  let out = '';
  let i = 0;
  type Mode = 'code' | 'tpl' | 'sq' | 'dq' | 'line' | 'block' | 're';
  let mode: Mode = 'code';
  let depth = 0; // ${ } nesting inside a template
  let cls = false; // inside a [...] character class of a regex

  // A "/" starts a regex only in an expression position. Without this, the "\"" in
  // a pattern like /[",\r\n]/ is read as a string opener and every mode after it
  // desyncs — which is exactly how ops/_lib/csv.ts produced two false positives.
  const startsRegex = (): boolean => {
    const prev = out.replace(/\s+$/, '').slice(-1);
    if (prev === '') return true;
    if ('(,=:[!&|?{};+-*%~^<>'.includes(prev)) return true;
    return /\b(return|typeof|case|in|of|new|delete|void|do|else)$/.test(out.replace(/\s+$/, ''));
  };

  while (i < code.length) {
    const c = code[i]!;
    const next = code[i + 1];
    const keep = (ch: string) => (out += ch === '\n' ? '\n' : ch);
    const blank = () => (out += c === '\n' ? '\n' : ' ');

    if (mode === 'code') {
      if (c === '/' && next === '/') { mode = 'line'; blank(); i++; blank(); i++; continue; }
      if (c === '/' && next === '*') { mode = 'block'; blank(); i++; blank(); i++; continue; }
      if (c === '/' && startsRegex()) { mode = 're'; cls = false; blank(); i++; continue; }
      if (c === '`') { mode = 'tpl'; depth = 0; blank(); i++; continue; }
      if (c === "'") { mode = 'sq'; blank(); i++; continue; }
      if (c === '"') { mode = 'dq'; blank(); i++; continue; }
      keep(c); i++; continue;
    }
    if (mode === 'line') { if (c === '\n') mode = 'code'; blank(); i++; continue; }
    if (mode === 'block') {
      if (c === '*' && next === '/') { mode = 'code'; blank(); i++; blank(); i++; continue; }
      blank(); i++; continue;
    }
    if (mode === 're') {
      if (c === '\\') { blank(); i++; if (i < code.length) { blank(); i++; } continue; }
      if (c === '[') cls = true;
      else if (c === ']') cls = false;
      else if (c === '/' && !cls) mode = 'code';
      else if (c === '\n') mode = 'code'; // unterminated: bail rather than desync
      blank(); i++; continue;
    }
    if (mode === 'sq' || mode === 'dq') {
      if (c === '\\') { blank(); i++; if (i < code.length) { blank(); i++; } continue; }
      if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"')) mode = 'code';
      blank(); i++; continue;
    }
    // mode === 'tpl'
    if (c === '\\') { blank(); i++; if (i < code.length) { blank(); i++; } continue; }
    if (c === '$' && next === '{') { depth++; blank(); i++; blank(); i++; continue; }
    if (c === '}' && depth > 0) { depth--; blank(); i++; continue; }
    if (c === '`' && depth === 0) { mode = 'code'; blank(); i++; continue; }
    blank(); i++; continue;
  }
  return out;
}

test('M1: no literal "$" renders next to a value anywhere in the source', () => {
  const offenders: string[] = [];

  for (const file of walk(SRC)) {
    blankNonJsx(readFileSync(file, 'utf8')).split('\n').forEach((line, idx) => {
      const lineNo = idx + 1;
      // A "$" immediately followed by a JSX expression, at a line start or after
      // whitespace/">" — i.e. sitting in rendered text, not in code.
      if (/(?:^|[>\s])\$\{/.test(line)) {
        offenders.push(`${file.replace(SRC, 'src')}:${lineNo}`);
      }
    });
  }

  expect(offenders, `literal "$" in rendered text — use formatSar/formatSarCompact:\n${offenders.join('\n')}`)
    .toEqual([]);
});

test('M2: the SAR formatters are the only place a currency mark is produced', () => {
  // Every «ر.س» a user sees must come from lib/i18n/format.ts. A component that
  // hand-writes the mark next to its own number formatting is how drift starts.
  // TWO modules are allowed, deliberately — and only these two:
  //   lib/i18n/format.ts   consumer presentation: rounded, Western digits
  //   app/ops/_lib/money.ts operator presentation: BigInt-exact, 2 decimals,
  //                         because the API serialises halalas as BigInt strings
  //                         that exceed 2^53 and a ledger screen must not round.
  // What this test forbids is a THIRD one hand-rolled inside a component, which
  // is how nine separate local `fmtSAR` helpers had drifted apart — three of them
  // emitting Arabic-Indic digits while the rest emitted Western.
  const allowed = new Set(['src/lib/i18n/format.ts', 'src/app/ops/_lib/money.ts']);
  const offenders: string[] = [];

  for (const file of walk(SRC)) {
    const rel = file.replace(SRC, 'src');
    if (allowed.has(rel)) continue;
    const code = readFileSync(file, 'utf8');
    // Hand-rolled currency: a locale-formatted number and the mark on one line.
    if (/ر\.س/.test(code)) {
      code.split('\n').forEach((line, i) => {
        if (/ر\.س/.test(line) && /toLocaleString|Intl\.NumberFormat/.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
  }

  expect(offenders, `hand-rolled SAR formatting — call formatSar instead:\n${offenders.join('\n')}`)
    .toEqual([]);
});

test('M3: rendered money pages show «ر.س» and never «$»', async ({ page }) => {
  await page.goto('/projects');
  const heroStats = page.locator('main').first();
  await expect(heroStats).toBeVisible();

  // The hero stat that used to read «$312M».
  await expect(page.getByText('مليون ر.س').first()).toBeVisible();

  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  expect(body, 'a dollar sign reached the homepage').not.toContain('$');
});
