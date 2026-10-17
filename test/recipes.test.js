'use strict';

// The README "Recipes" section is documentation people copy from, so every snippet in it runs here.
// If you change a recipe in README.md, change it here too (and the other way round).
const test = require('node:test');
const assert = require('node:assert/strict');
const format = require('..');

test('table columns', () => {
  const price = format.createFormatter('en-US', { style: 'currency', currency: 'USD' });
  assert.deepEqual([1234.5, 99, 0.5].map(price), ['$1,234.50', '$99.00', '$0.50']);

  const cell = format.createFormatter('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.deepEqual([1234.5, 99, 0.5].map(cell), ['1,234.50', '99.00', '0.50']);
});

test('missing data', () => {
  const total = format.createFormatter('en-US', { fallback: '—' });
  assert.deepEqual([total(1200), total(null), total(undefined), total('n/a')], ['1,200', '—', '—', '—']);
  assert.throws(() => total({}), TypeError);
  assert.throws(() => total(true), TypeError);
});

test('form fields', () => {
  const readPrice = format.createParser('de-DE', { style: 'currency', currency: 'EUR', fallback: null });
  assert.equal(readPrice('1.234,50 €'), 1234.5);
  assert.equal(readPrice('oops'), null);
  assert.equal(readPrice(''), null);

  assert.throws(() => format.parse('12,3,4', 'de-DE'), (error) => error instanceof TypeError && error.message.length > 10);
});

test('money held in cents', () => {
  assert.equal(format.currency(1999 / 100, 'USD'), '$19.99');
});

test('gains and losses', () => {
  assert.equal(format.percent(0.0512, 'en-US', { signDisplay: 'exceptZero' }), '+5%');
  assert.equal(format.percent(-0.0512, 'en-US', { signDisplay: 'exceptZero' }), '-5%');
  assert.equal(format.percent(0, 'en-US', { signDisplay: 'exceptZero' }), '0%');
});

test('styling the decimals', () => {
  const html = format
    .formatToParts(1234.56, 'en-US')
    .map((part) => (part.type === 'fraction' ? `<small>${part.value}</small>` : part.value))
    .join('');
  assert.equal(html, '1,234.<small>56</small>');
});

test('file sizes and ranges', () => {
  assert.equal(format.bytes(5242880), '5.2 MB');
  // Long unit names come from the locale data of the running Node version, so compare with Intl.
  const long = format.bytes(1536, 'de-DE', { unitDisplay: 'long' });
  const expected = new Intl.NumberFormat('de-DE', { style: 'unit', unit: 'kilobyte', unitDisplay: 'long', maximumFractionDigits: 1 }).format(1.5);
  assert.equal(long, expected);
  assert.match(long, /^1,5\s+Kilobyte/);
  assert.match(format.formatRange(10, 20, 'en-US', { style: 'currency', currency: 'USD' }), /^\$10\.00\s?[–-]\s?\$20\.00$/);
});

test("the user's own locale", () => {
  function safeLocale(tag) {
    try {
      return Intl.getCanonicalLocales(tag)[0];
    } catch {
      return 'en-US';
    }
  }
  assert.equal(format(1234.5, safeLocale('de-de')), '1.234,5');
  assert.equal(format(1234.5, safeLocale('not a locale!!')), '1,234.5');
  assert.throws(() => format(1234.5, 'not a locale!!'), RangeError);
});
