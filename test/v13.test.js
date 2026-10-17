'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const format = require('../index');
const { formatToParts, formatRange, createParser, parse } = format;

const intl = (locale, options) => new Intl.NumberFormat(locale, options);

describe('negative numbers that round to zero', () => {
  it('print 0, not -0', () => {
    assert.equal(format(-0.0001), '0');
    assert.equal(format(-0.0004, 'de-DE'), '0');
    assert.equal(format('-0.0001'), '0');
    assert.equal(format(-0.0001, 'en-US', { maximumFractionDigits: 2 }), '0');
    assert.equal(format.percent(-0.000001), '0%');
    assert.equal(format.currency(-0.001, 'USD'), '$0.00');
    assert.equal(format.currency(-0.001, 'USD', 'en-US', { currencySign: 'accounting' }), '$0.00');
    assert.equal(format.signed(-0.0001), '0');
    assert.equal(format.bytes(-0.4), '0 B');
  });
  it('leave real negatives alone', () => {
    assert.equal(format(-0.001), '-0.001');
    assert.equal(format(-5), '-5');
    assert.equal(format(-5n), '-5');
    assert.equal(format.currency(-5, 'USD'), '-$5.00');
    assert.equal(format.percent(-0.5), '-50%');
  });
  it('respect a signDisplay the caller chose', () => {
    for (const signDisplay of ['auto', 'always', 'exceptZero', 'never', 'negative']) {
      assert.equal(format(-0.0001, 'en-US', { signDisplay }), intl('en-US', { signDisplay }).format(-0.0001), signDisplay);
      assert.equal(format(5, 'en-US', { signDisplay }), intl('en-US', { signDisplay }).format(5), signDisplay);
    }
    assert.equal(format(-0.0001, 'en-US', { signDisplay: 'auto' }), '-0');
  });
  it('keep inherited options working alongside the default', () => {
    const inherited = Object.create({ minimumFractionDigits: 2 });
    assert.equal(format(-0.0001, 'en-US', inherited), '0.00');
    assert.equal(format(-1.5, 'en-US', inherited), '-1.50');
  });
  it('do not change what parse reads', () => {
    assert.equal(parse(format(-1234.5)), -1234.5);
    assert.equal(parse('-0.0001'), -0.0001);
  });
});

describe('formatToParts', () => {
  it('returns the Intl parts', () => {
    const parts = formatToParts(-1234.5);
    assert.deepEqual(parts.map((part) => part.type), ['minusSign', 'integer', 'group', 'integer', 'decimal', 'fraction']);
    assert.equal(parts.map((part) => part.value).join(''), format(-1234.5));
  });
  it('matches format() for locales, options, strings and bigints', () => {
    const cases = [
      [1234567.891, 'de-DE', undefined],
      ['1234.5', 'en-US', { style: 'currency', currency: 'USD' }],
      [12345678901234567890n, 'en-IN', undefined],
      [0.256, 'ar-EG', { style: 'percent', maximumFractionDigits: 1 }],
      [1500, 'en-US', { notation: 'compact' }],
    ];
    for (const [value, locale, options] of cases) {
      const joined = formatToParts(value, locale, options).map((part) => part.value).join('');
      assert.equal(joined, format(value, locale, options));
    }
  });
  it('lets you style pieces separately', () => {
    const html = formatToParts(1234.56, 'en-US', { style: 'currency', currency: 'USD' })
      .map((part) => (part.type === 'fraction' ? `<small>${part.value}</small>` : part.value))
      .join('');
    assert.equal(html, '$1,234.<small>56</small>');
  });
  it('gives a single literal part for a fallback', () => {
    assert.deepEqual(formatToParts(null, 'en-US', { fallback: '—' }), [{ type: 'literal', value: '—' }]);
    assert.deepEqual(formatToParts(NaN, undefined, { fallback: 'n/a' }), [{ type: 'literal', value: 'n/a' }]);
    assert.equal(formatToParts(5, 'en-US', { fallback: 'x' })[0].value, '5');
  });
  it('validates like format', () => {
    assert.throws(() => formatToParts(null), TypeError);
    assert.throws(() => formatToParts(NaN), RangeError);
    assert.throws(() => formatToParts({}, 'en-US', { fallback: 'x' }), TypeError);
    assert.throws(() => formatToParts(1, 'xx_invalid'), RangeError);
    assert.throws(() => formatToParts(1, 'en-US', 'oops'), TypeError);
    assert.throws(() => formatToParts(1, 'en-US', { fallback: 1 }), TypeError);
  });
});

describe('formatRange', () => {
  it('writes ranges the way the locale does', () => {
    const cases = [
      [1, 5, 'en-US', undefined],
      [1000, 2000, 'de-DE', undefined],
      [5, 10, 'de-DE', { style: 'currency', currency: 'EUR' }],
      [1000, 2000000, 'en-US', { notation: 'compact' }],
      [0.1, 0.5, 'en-US', { style: 'percent' }],
      [5, 5, 'en-US', undefined],
      [10, 2, 'en-US', undefined],
    ];
    for (const [start, end, locale, options] of cases) {
      assert.equal(formatRange(start, end, locale, options), intl(locale, options).formatRange(start, end));
    }
    assert.equal(formatRange(1, 5), '1–5');
    assert.equal(formatRange(5, 5), '~5');
  });
  it('accepts numeric strings and bigints', () => {
    assert.equal(formatRange('1.5', '2.5'), '1.5–2.5');
    assert.equal(formatRange(1n, 5n), '1–5');
    assert.equal(formatRange(1, '5'), '1–5');
  });
  it('uses the fallback when either end is missing', () => {
    assert.equal(formatRange(null, 5, 'en-US', { fallback: '—' }), '—');
    assert.equal(formatRange(1, undefined, 'en-US', { fallback: '—' }), '—');
    assert.equal(formatRange(NaN, 5, 'en-US', { fallback: '' }), '');
    assert.equal(formatRange('x', 'y', 'en-US', { fallback: 'n/a' }), 'n/a');
    assert.equal(formatRange(1, 5, 'en-US', { fallback: 'n/a' }), '1–5');
  });
  it('validates both ends', () => {
    assert.throws(() => formatRange(null, 5), TypeError);
    assert.throws(() => formatRange(1, NaN), RangeError);
    assert.throws(() => formatRange(1, {}, 'en-US', { fallback: 'x' }), TypeError);
    assert.throws(() => formatRange(1, 5, 'xx_invalid'), RangeError);
    assert.throws(() => formatRange(1, 5, 'en-US', 'oops'), TypeError);
    assert.throws(() => formatRange(1, 5, 'en-US', { fallback: 0 }), TypeError);
  });
});

describe('bytes: binary and long names', () => {
  const binary = [
    [0, '0 B'],
    [1023, '1,023 B'],
    [1024, '1 KiB'],
    [1536, '1.5 KiB'],
    [1048575, '1 MiB'],
    [1048576, '1 MiB'],
    [5 * 1024 ** 3, '5 GiB'],
    [3 * 1024 ** 5, '3 PiB'],
    [-1536, '-1.5 KiB'],
    ['2048', '2 KiB'],
    [2048n, '2 KiB'],
  ];
  for (const [input, expected] of binary) {
    it(`binary: ${String(input)} is ${expected}`, () => {
      assert.equal(format.bytes(input, 'en-US', { binary: true }), expected);
    });
  }
  it('binary uses the locale for the number and honours Intl options', () => {
    assert.equal(format.bytes(1536, 'de-DE', { binary: true }), '1,5 KiB');
    assert.equal(format.bytes(1500, 'en-US', { binary: true, maximumFractionDigits: 3 }), '1.465 KiB');
  });
  it('binary false or missing keeps decimal units', () => {
    assert.equal(format.bytes(1536, 'en-US', { binary: false }), '1.5 kB');
    assert.equal(format.bytes(1536), '1.5 kB');
  });

  it('long: localized unit names', () => {
    assert.equal(format.bytes(1536, 'en-US', { unitDisplay: 'long' }), '1.5 kilobytes');
    assert.equal(format.bytes(1, 'en-US', { unitDisplay: 'long' }), '1 byte');
    assert.equal(format.bytes(999, 'en-US', { unitDisplay: 'long' }), '999 bytes');
    assert.equal(format.bytes(1000, 'en-US', { unitDisplay: 'long' }), '1 kilobyte');
    assert.equal(format.bytes(999999, 'en-US', { unitDisplay: 'long' }), '1 megabyte');
    assert.equal(format.bytes(2e15, 'en-US', { unitDisplay: 'long' }), '2 petabytes');
    assert.equal(format.bytes(-2500, 'en-US', { unitDisplay: 'long' }), '-2.5 kilobytes');
  });
  it('long: follows Intl for other locales', () => {
    for (const locale of ['de-DE', 'fr-FR', 'ja-JP', 'ar-EG', 'ru-RU']) {
      const expected = intl(locale, { style: 'unit', unit: 'megabyte', unitDisplay: 'long', maximumFractionDigits: 1 }).format(2.5);
      assert.equal(format.bytes(2.5e6, locale, { unitDisplay: 'long' }), expected, locale);
    }
  });
  it('short is the default style', () => {
    assert.equal(format.bytes(1536, 'en-US', { unitDisplay: 'short' }), '1.5 kB');
  });
  it('rejects unsupported combinations', () => {
    assert.throws(() => format.bytes(1536, 'en-US', { unitDisplay: 'narrow' }), /unitDisplay/);
    assert.throws(() => format.bytes(1536, 'en-US', { binary: true, unitDisplay: 'long' }), /binary/);
  });
  it('fallback works with the new options', () => {
    assert.equal(format.bytes(null, 'en-US', { binary: true, fallback: '—' }), '—');
    assert.equal(format.bytes(1024, 'en-US', { binary: true, fallback: '—' }), '1 KiB');
    assert.equal(format.bytes(1500, 'en-US', { unitDisplay: 'long', fallback: '—' }), '1.5 kilobytes');
  });
});

describe('createParser', () => {
  it('parses like parse()', () => {
    const cases = [
      ['de-DE', undefined, '1.234.567,891'],
      ['en-US', { style: 'currency', currency: 'USD' }, '$1,234.50'],
      ['en-US', { style: 'percent' }, '25.6%'],
      ['en-US', { notation: 'compact' }, '1.2K'],
      ['ja-JP', { notation: 'compact' }, '200万'],
      ['fr-FR', undefined, '1 234,5'],
    ];
    for (const [locale, options, text] of cases) {
      assert.equal(createParser(locale, options)(text), parse(text, locale, options), text);
    }
  });
  it('defaults to en-US with no arguments', () => {
    assert.equal(createParser()('1,234.5'), 1234.5);
  });
  it('reuses one parser for many values', () => {
    const toNumber = createParser('de-DE', { style: 'currency', currency: 'EUR' });
    assert.deepEqual(['1,50 €', '€ 1.000,00', '(2,25 €)', '3'].map(toNumber), [1.5, 1000, -2.25, 3]);
  });
  it('validates eagerly, before any text', () => {
    assert.throws(() => createParser('xx_invalid'), RangeError);
    assert.throws(() => createParser(42), /Expected locale/);
    assert.throws(() => createParser('en-US', 'oops'), TypeError);
    assert.throws(() => createParser('en-US', { style: 'unit', unit: 'meter' }), /does not support style/);
    assert.throws(() => createParser('en-US', { style: 'currency' }), /currency code/);
    assert.throws(() => createParser('en-US', { style: 'currency', currency: 'usdollars' }), RangeError);
    assert.throws(() => createParser('xx_invalid', { fallback: 0 }), RangeError);
  });
  it('throws for bad text, and a fallback replaces that', () => {
    const strict = createParser('en-US');
    assert.throws(() => strict('abc'), TypeError);
    assert.throws(() => strict(null), /got null/);
    assert.throws(() => strict(5), TypeError);
    const lenient = createParser('en-US', { fallback: NaN });
    assert.ok(Number.isNaN(lenient('abc')));
    assert.ok(Number.isNaN(lenient(null)));
    assert.equal(lenient('1,234'), 1234);
    assert.throws(() => lenient(5), TypeError);
  });
  it('reads the options once, when it is created', () => {
    const options = { style: 'percent', fallback: 'first' };
    const toFraction = createParser('en-US', options);
    options.style = 'decimal';
    options.fallback = 'second';
    assert.equal(toFraction('50%'), 0.5);
    assert.equal(toFraction('nope'), 'first');
  });
  it('accepts Intl.Locale objects and locale arrays', () => {
    assert.equal(createParser(new Intl.Locale('de-DE'))('1.234,5'), 1234.5);
    assert.equal(createParser(['de-DE', 'en-US'])('1.234,5'), 1234.5);
  });
});

describe('exports', () => {
  it('exposes the new functions', () => {
    for (const name of ['formatToParts', 'formatRange', 'createParser']) {
      assert.equal(typeof format[name], 'function', name);
    }
  });
});
