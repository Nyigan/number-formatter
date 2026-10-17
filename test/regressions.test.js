'use strict';

// Bugs found by auditing 1.3.0 against every locale in Node and against odd option objects.
// Expectations that depend on locale data are derived from Intl, so they hold on every Node version.
const test = require('node:test');
const assert = require('node:assert/strict');
const format = require('..');

test('options that cannot be serialised still work, because Intl ignores unknown properties', () => {
  const options = { minimumFractionDigits: 2 };
  options.owner = options; // a circular reference, as in a column definition that points back at its table
  assert.equal(format(1, 'en-US', options), '1.00');
  assert.equal(format(1, 'en-US', options), '1.00');
  assert.equal(format.currency(1, 'USD', 'en-US', options), '$1.00');
});

test('a bigint option reaches Intl, which reports it, instead of leaking a JSON error', () => {
  assert.throws(
    () => format(1, 'en-US', { minimumFractionDigits: 2n }),
    (error) => error instanceof TypeError && !/serialize|circular|JSON/i.test(error.message)
  );
});

test('a preset option set to undefined does not switch the preset off', () => {
  assert.equal(format.signed(5, 'en-US', { signDisplay: undefined }), '+5');
  assert.equal(format.percent(0.5, 'en-US', { style: undefined }), '50%');
  assert.equal(format.compact(1500, 'en-US', { notation: undefined }), '1.5K');
  assert.equal(format.currency(5, 'USD', 'en-US', { style: undefined }), '$5.00');
  assert.equal(format.bytes(1536, 'en-US', { maximumFractionDigits: undefined }), '1.5 kB');
  assert.equal(format.bytes(1536, 'en-US', { maximumFractionDigits: undefined, unitDisplay: 'long' }), '1.5 kilobytes');
  // A value the caller does set still wins over the preset.
  assert.equal(format.signed(5, 'en-US', { signDisplay: 'never' }), '5');
  assert.equal(format.percent(0.5, 'en-US', { minimumFractionDigits: 1 }), '50.0%');
});

test('bytes: asking for a minimum number of decimals raises the maximum with it', () => {
  assert.equal(format.bytes(1500, 'en-US', { minimumFractionDigits: 2 }), '1.50 kB');
  assert.equal(format.bytes(1536, 'en-US', { minimumFractionDigits: 2 }), '1.54 kB'); // 1.536 kB, two decimals
  assert.equal(format.bytes(-1536, 'en-US', { minimumFractionDigits: 2 }), '-1.54 kB');
  assert.equal(format.bytes(999, 'en-US', { minimumFractionDigits: 1 }), '999.0 B');
  assert.equal(format.bytes(1536, 'en-US', { minimumFractionDigits: 0 }), '1.5 kB');
  const long = new Intl.NumberFormat('en-US', { style: 'unit', unit: 'kilobyte', unitDisplay: 'long', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.equal(format.bytes(1536, 'en-US', { minimumFractionDigits: 2, unitDisplay: 'long' }), long.format(1.536));
  // A minimum above an explicit maximum is still the caller's mistake, and Intl says so.
  assert.throws(() => format.bytes(1536, 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 1 }), RangeError);
});

test('bytes: the unit only rolls over when the decimals that are shown round up to 1000', () => {
  assert.equal(format.bytes(999960, 'en-US'), '1 MB');
  assert.equal(format.bytes(999960, 'en-US', { maximumFractionDigits: 3 }), '999.96 kB');
  assert.equal(format.bytes(999500, 'en-US', { maximumFractionDigits: 0 }), '1 MB');
  assert.equal(format.bytes(999400, 'en-US', { maximumFractionDigits: 0 }), '999 kB');
  assert.equal(format.bytes(1536, 'en-US', { maximumFractionDigits: 3 }), '1.536 kB');
  assert.throws(() => format.bytes(1536, 'en-US', { maximumFractionDigits: 200 }), RangeError);
});

test('parse reads numbering systems whose digits are outside the Basic Multilingual Plane', (t) => {
  const locale = 'en-u-nu-adlm';
  if (new Intl.NumberFormat(locale).format(1) === '1') return t.skip('this Node has no Adlam digits');
  const options = { maximumFractionDigits: 3 };
  for (const value of [1, 12, 1234.5, -1234567.891, 999999, 1e9]) {
    const text = format(value, locale, options);
    assert.equal(format.parse(text, locale), value, text);
  }
  assert.equal(format.parse(format(-1234.5, locale, { style: 'currency', currency: 'USD' }), locale, { style: 'currency', currency: 'USD' }), -1234.5);
});

test('parse accepts a minus after the number in locales that write it there (Frisian money)', () => {
  const money = { style: 'currency', currency: 'USD' };
  const written = format(-1234.5, 'fy', { ...money, maximumFractionDigits: 2 });
  assert.match(written, /-$/, 'fy writes negative money with a trailing minus; update this test if the locale data changes');
  assert.equal(format.parse(written, 'fy', money), -1234.5);
  assert.equal(format.parse('US$ 1.234,50−', 'fy', money), -1234.5);
  assert.equal(format.parse('US$ 1.234,50', 'fy', money), 1234.5);
  // A leading and a trailing minus together are two signs, not a double negative.
  assert.throws(() => format.parse('-US$ 1.234,50-', 'fy', money), TypeError);
  // Everywhere else a trailing minus is not a sign.
  assert.throws(() => format.parse('5-', 'en-US'), TypeError);
  assert.throws(() => format.parse('1.234,50-', 'de-DE'), TypeError);
});

test('currency names read back for whole amounts as well as for amounts with decimals', () => {
  const digitStyles = [{}, { minimumFractionDigits: 0, maximumFractionDigits: 0 }, { minimumFractionDigits: 0, maximumFractionDigits: 3 }];
  const cases = {
    ca: [0, 1, 2, 5],
    cs: [0, 1, 2, 5, 21, 1e6],
    pl: [1, 2, 5, 22, 25],
    ru: [1, 2, 5, 21, 22, 25, 100],
    ar: [0, 1, 2, 3, 11, 100],
    cy: [0, 1, 2, 3, 6],
    br: [1, 2, 5, 1e6],
    bs: [1, 2, 5],
    fr: [0, 1, 2],
    en: [1, 2],
  };
  for (const [locale, amounts] of Object.entries(cases)) {
    if (new Intl.NumberFormat(locale).resolvedOptions().locale !== locale) continue;
    for (const currency of ['USD', 'EUR']) {
      for (const digits of digitStyles) {
        const options = { style: 'currency', currency, currencyDisplay: 'name', ...digits };
        for (const amount of amounts) {
          const text = format(amount, locale, options);
          assert.equal(format.parse(text, locale, { style: 'currency', currency }), amount, `${locale} ${currency} ${JSON.stringify(digits)}: ${text}`);
        }
      }
    }
  }
});

test('currency names for zero-decimal currencies read back when the caller shows decimals (Czech yen)', () => {
  for (const locale of ['cs', 'be', 'pl', 'ru']) {
    if (new Intl.NumberFormat(locale).resolvedOptions().locale !== locale) continue;
    const options = { style: 'currency', currency: 'JPY', currencyDisplay: 'name', minimumFractionDigits: 0, maximumFractionDigits: 3 };
    for (const amount of [12.5, 1234.5, 1.5, 2.5]) {
      const text = format(amount, locale, options);
      assert.equal(format.parse(text, locale, { style: 'currency', currency: 'JPY' }), amount, `${locale}: ${text}`);
    }
  }
});
