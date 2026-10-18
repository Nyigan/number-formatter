'use strict';

// Loads the real index.js into Chromium and checks that it behaves the same as in Node.
// Run with `npm run test:browser` (see browser-test/README.md for setup).
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const source = readFileSync(join(__dirname, '..', 'index.js'), 'utf8');

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  // index.js is CommonJS: give it the `module` object a bundler or loader would provide.
  await page.setContent('<!doctype html><meta charset="utf-8"><title>number-formatter</title>');
  await page.evaluate((code) => {
    const module = { exports: {} };
    new Function('module', 'exports', code)(module, module.exports);
    window.nf = module.exports;
  }, source);

  const run = (fn, ...args) => page.evaluate(fn, ...args);

  const results = await run(() => {
    const nf = window.nf;
    const out = {};
    out.api = Object.keys(nf).sort();
    out.basic = nf(1234567.891);
    out.german = nf(1234567.891, 'de-DE');
    out.currency = nf.currency(1234.5, 'USD', 'en-US');
    out.euro = nf.currency(1234.5, 'EUR', 'de-DE');
    out.percent = nf.percent(0.256, 'en-US');
    out.compact = nf.compact(1250000, 'en-US');
    out.bytes = nf.bytes(1536, 'en-US');
    out.bytesBinary = nf.bytes(1536, 'en-US', { binary: true });
    out.signed = nf.signed(5, 'en-US');
    out.negZero = nf(-0.0001);
    out.bigint = nf(12345678901234567890n);
    out.fallback = nf(null, 'en-US', { fallback: 'n/a' });
    out.parse = nf.parse('1,234.56', 'en-US');
    out.parseDe = nf.parse('1.234,56', 'de-DE');
    out.parseMoney = nf.parse('$1,234.50', 'en-US', { style: 'currency', currency: 'USD' });
    out.parsePercent = nf.parse('25%', 'en-US', { style: 'percent' });
    out.parseCompact = nf.parse('1.2M', 'en-US', { notation: 'compact' });
    out.roundTrip = nf.parse(nf(-9876543.21, 'fr-FR'), 'fr-FR');
    out.parser = nf.createParser('de-DE')('1.000,5');
    out.parseBytes = nf.parseBytes('1,5 MiB', 'de-DE');
    out.parts = nf.formatToParts(1234.5, 'en-US').map((p) => p.type).join(',');
    out.range = nf.formatRange(1000, 2000, 'en-US');
    out.formatter = nf.createFormatter('ja-JP', { style: 'currency', currency: 'JPY' })(5000);
    try {
      nf('12ab');
    } catch (error) {
      out.threw = error.constructor.name;
    }
    return out;
  });

  assert.deepEqual(results.api, [
    'bytes', 'compact', 'createFormatter', 'createParser', 'currency', 'default',
    'formatNumber', 'formatRange', 'formatToParts', 'parse', 'parseBytes', 'percent', 'signed',
  ]);
  assert.equal(results.basic, '1,234,567.891');
  assert.equal(results.parseBytes, 1572864);
  assert.equal(results.german, '1.234.567,891');
  assert.equal(results.currency, '$1,234.50');
  assert.match(results.euro, /^1\.234,50\s€$/);
  assert.equal(results.percent, '26%');
  assert.equal(results.compact, '1.3M');
  assert.equal(results.bytes, '1.5 kB');
  assert.equal(results.bytesBinary, '1.5 KiB');
  assert.equal(results.signed, '+5');
  assert.equal(results.negZero, '0');
  assert.equal(results.bigint, '12,345,678,901,234,567,890');
  assert.equal(results.fallback, 'n/a');
  assert.equal(results.parse, 1234.56);
  assert.equal(results.parseDe, 1234.56);
  assert.equal(results.parseMoney, 1234.5);
  assert.equal(results.parsePercent, 0.25);
  assert.equal(results.parseCompact, 1200000);
  assert.equal(results.roundTrip, -9876543.21);
  assert.equal(results.parser, 1000.5);
  assert.equal(results.parts, 'integer,group,integer,decimal,fraction');
  assert.match(results.range, /^1,000.2,000$/);
  assert.match(results.formatter, /5,000/);
  assert.equal(results.threw, 'TypeError');

  // The same checks in Node must agree with the browser, whatever its locale data says.
  const nodeLib = require('..');
  assert.equal(nodeLib(1234567.891), results.basic);
  assert.equal(nodeLib.parse('1.234,56', 'de-DE'), results.parseDe);
  assert.equal(nodeLib.bytes(1536, 'en-US', { binary: true }), results.bytesBinary);

  // The playground page (served by GitHub Pages) loads ../index.js with a plain <script> tag.
  const playground = await browser.newPage();
  const playgroundErrors = [];
  playground.on('pageerror', (error) => playgroundErrors.push(error.message));
  playground.on('console', (message) => {
    if (message.type() === 'error') playgroundErrors.push(message.text());
  });
  await playground.goto(pathToFileURL(join(__dirname, '..', 'playground', 'index.html')).href);
  const shown = () => playground.evaluate(() => ({
    out: document.getElementById('out').textContent,
    error: document.getElementById('error').hidden ? '' : document.getElementById('error').textContent,
    code: document.getElementById('code').textContent,
  }));
  let state = await shown();
  assert.match(state.out, /^1\.234\.567,89\s€$/);
  assert.match(state.code, /format\.currency\(1234567\.891, 'EUR', 'de-DE'\)/);
  await playground.check('input[name=mode][value=number]', { force: true });
  await playground.selectOption('#locale', 'en-US');
  await playground.fill('#value', '-0.0001');
  state = await shown();
  assert.equal(state.out, '0');
  await playground.fill('#value', '12ab');
  state = await shown();
  assert.match(state.error, /is not a number/);
  assert.match(state.error, /TypeError/);
  // An example button sets every field at once, and the call shown matches the result.
  await playground.click('button[data-example=read-german]');
  state = await shown();
  assert.equal(state.out, '1234.5');
  assert.match(state.code, /format\.parse\('1\.234,50\s€', 'de-DE', \{ style: 'currency', currency: 'EUR' \}\)/);
  // Reading a file size: the example, the 1024 option, a unit that means bits, and a locale's own number format.
  await playground.click('button[data-example=read-size]');
  state = await shown();
  assert.equal(state.out, '1500000 bytes');
  assert.match(state.code, /format\.parseBytes\('1\.5 MB', 'en-US'\)/);
  assert.equal(await playground.isVisible('#s-readbytes'), true);
  await playground.check('#binaryRead', { force: true });
  state = await shown();
  assert.equal(state.out, '1572864 bytes');
  assert.match(state.code, /\{ binary: true \}/);
  await playground.fill('#value', '5 Mb');
  state = await shown();
  assert.match(state.error, /bits/);
  await playground.selectOption('#locale', 'de-DE');
  await playground.fill('#value', '1,5 Kilobyte');
  state = await shown();
  assert.equal(state.out, '1536 bytes');
  await playground.check('input[name=direction][value=format]', { force: true });
  await playground.selectOption('#locale', 'other');
  await playground.fill('#localeOther', 'zz zz!!');
  state = await shown();
  assert.match(state.error, /locale code/);
  // A missing currency is reported as a missing currency, not as a bad number.
  await playground.goto(pathToFileURL(join(__dirname, '..', 'playground', 'index.html')).href + '#mode=currency&value=1234.5&currency=');
  state = await shown();
  assert.match(state.error, /three-letter currency code/);
  // Every link that leaves the page opens in a new tab and cannot reach back into it.
  const links = await playground.$$eval('a[href^="http"]', (anchors) => anchors.map((a) => ({ href: a.href, target: a.target, rel: a.rel })));
  assert.ok(links.length >= 5, 'expected the header and support links');
  for (const link of links) {
    assert.equal(link.target, '_blank', `${link.href} should open in a new tab`);
    assert.match(link.rel, /noopener/, `${link.href} needs rel=noopener`);
  }
  assert.ok(links.some((link) => link.href.startsWith('https://www.etsy.com/shop/FrankForgeCo')), 'the shop link is on the page');
  assert.deepEqual(playgroundErrors, [], `playground reported errors: ${playgroundErrors.join('; ')}`);

  assert.deepEqual(pageErrors, [], `browser reported errors: ${pageErrors.join('; ')}`);
  const version = browser.version();
  await browser.close();
  console.log(`browser test passed in Chromium ${version}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
