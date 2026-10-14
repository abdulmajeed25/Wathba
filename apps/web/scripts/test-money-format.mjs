import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/app/ops/_lib/money.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports, Intl, BigInt, Number });
const { formatSar, isNonZeroHalalas } = exports;
let checks = 0;
for (const [input, number] of [[0n, '0.00'], [5n, '0.05'], [-5n, '-0.05'], [2005n, '20.05'], [-2005n, '-20.05'],
  ['9007199254740993', '90,071,992,547,409.93'], ['-9007199254740993', '-90,071,992,547,409.93'],
  ['99999999999999999999999999999999', '999,999,999,999,999,999,999,999,999,999.99']]) {
  const normalized = formatSar(input).replace(/[\u061c\u200e\u200f]/g, '');
  assert.ok(normalized.includes(number), `${String(input)} must render ${number}, received ${normalized}`);
  assert.equal(isNonZeroHalalas(input), BigInt(input) !== 0n); checks++;
}
for (const input of [null, undefined, '', '1.5', 'SAR 200', '1,000', 'not money', NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(formatSar(input), 'غير متاح'); assert.equal(isNonZeroHalalas(input), false); checks++;
}
assert.equal(formatSar(' 2005 '), formatSar(2005)); checks++;
console.log(JSON.stringify({ passed: checks, scope: 'Exact currency rendering and malformed/missing input boundaries; no money movement' }));
