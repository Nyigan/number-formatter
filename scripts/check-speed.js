'use strict';

// Speed guard that does not depend on how fast the machine is.
// Every case is timed against plain Intl in the same process, so a slow CI runner slows both
// sides equally and only a real regression in this library changes the ratio.
// Usage: node scripts/check-speed.js        (npm run check:speed)
const nf = require('..');

const ROUNDS = 5; // take the best of several rounds to ignore scheduling noise
const N = 20000;

function time(fn) {
  let best = Infinity;
  for (let round = 0; round < ROUNDS; round++) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < N; i++) fn(i);
    const ns = Number(process.hrtime.bigint() - start) / N;
    if (ns < best) best = ns;
  }
  return best;
}

const intl = new Intl.NumberFormat('en-US', { signDisplay: 'negative' });
const intlFr = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', signDisplay: 'negative' });

// maxRatio: this library may be at most this many times slower than the Intl baseline.
const cases = [
  {
    name: 'format(n) vs a prebuilt Intl.NumberFormat',
    ours: (i) => nf(i * 1.5),
    base: (i) => intl.format(i * 1.5),
    maxRatio: 4,
  },
  {
    name: 'format(n, locale, options) vs a prebuilt Intl.NumberFormat',
    ours: (i) => nf(i * 1.5, 'fr-FR', { style: 'currency', currency: 'EUR' }),
    base: (i) => intlFr.format(i * 1.5),
    maxRatio: 4,
  },
  {
    name: 'format(n) vs creating a new Intl.NumberFormat each call',
    ours: (i) => nf(i * 1.5, 'de-DE'),
    base: (i) => new Intl.NumberFormat('de-DE', { signDisplay: 'negative' }).format(i * 1.5),
    maxRatio: 0.5, // the cache must make this at least twice as fast
  },
];

const parseTexts = ['1,234,567.89', '-42', '1234.5', '0.001'];
const parser = nf.createParser('en-US');
cases.push({
  name: 'createParser(...)(text) vs Number() on a cleaned string',
  ours: (i) => parser(parseTexts[i % parseTexts.length]),
  base: (i) => Number(parseTexts[i % parseTexts.length].replace(/,/g, '')),
  maxRatio: 40, // parsing does far more than Number() (about 4x here); this catches a collapse
});

const sizeTexts = ['1.5 MB', '300 kB', '2 GiB', '12 B'];
const sizePattern = /^([\d.]+)\s*([kKMGTP]?i?B)$/;
cases.push({
  name: 'parseBytes(text) vs one regular expression and Number()',
  ours: (i) => nf.parseBytes(sizeTexts[i % sizeTexts.length]),
  base: (i) => Number(sizePattern.exec(sizeTexts[i % sizeTexts.length])[1]) * 1000,
  maxRatio: 80, // about 18x here: it also knows locales, units in many languages and rejects bad text
});

let failed = false;
for (const c of cases) {
  c.ours(0); // warm up
  c.base(0);
  const ours = time(c.ours);
  const base = time(c.base);
  const ratio = ours / base;
  const ok = ratio <= c.maxRatio;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}: ${ours.toFixed(0)} ns vs ${base.toFixed(0)} ns (ratio ${ratio.toFixed(2)}, limit ${c.maxRatio})`);
}
if (failed) process.exit(1);
console.log('speed check passed');
