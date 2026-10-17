'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const format = require('../index');
const { parse } = format;

const NBSP = ' ';
const NNBSP = ' ';

const LOCALES = [
  'en-US', 'en-GB', 'en-IN', 'en-ZA', 'de-DE', 'de-CH', 'de-AT', 'fr-FR', 'fr-CA', 'fr-CH',
  'es-ES', 'es-MX', 'it-IT', 'pt-BR', 'pt-PT', 'nl-NL', 'sv-SE', 'nb-NO', 'fi-FI', 'da-DK',
  'pl-PL', 'cs-CZ', 'ru-RU', 'uk-UA', 'tr-TR', 'el-GR', 'he-IL', 'ar-EG', 'ar-SA', 'fa-IR',
  'hi-IN', 'mr-IN', 'bn-BD', 'ur-PK', 'th-TH', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'id-ID',
  'vi-VN', 'sw-KE', 'is-IS', 'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR', 'sk-SK', 'ca-ES', 'lt-LT',
];

describe('parse: round trips with format() in 50 locales', () => {
  it('plain numbers', () => {
    const values = [0, 5, 12, 123, 1234, 12345.5, 1234567.891, -1234567.891, 0.5, -0.25, 999999999.5, 1e9];
    for (const locale of LOCALES) {
      for (const value of values) {
        const text = format(value, locale);
        assert.equal(parse(text, locale), value, `${locale} ${JSON.stringify(text)}`);
      }
    }
  });

  it('currencies, in every display and sign style', () => {
    for (const locale of LOCALES) {
      for (const currency of ['USD', 'EUR', 'JPY', 'GBP', 'INR']) {
        for (const currencyDisplay of ['symbol', 'narrowSymbol', 'code', 'name']) {
          for (const currencySign of ['standard', 'accounting']) {
            const options = { style: 'currency', currency, currencyDisplay, currencySign, maximumFractionDigits: 2 };
            const values = currency === 'JPY' ? [0, 5, 1234, -1234567] : [0, 5, 1234.5, -1234.56, 1234567.89, -0.5];
            for (const value of values) {
              const text = format(value, locale, options);
              assert.equal(parse(text, locale, options), value, `${locale} ${JSON.stringify(text)}`);
            }
          }
        }
      }
    }
  });

  it('percentages', () => {
    const options = { style: 'percent', maximumFractionDigits: 3 };
    for (const locale of LOCALES) {
      for (const value of [0, 0.26, 0.256, 1, -0.5, 12.5, 0.005]) {
        const text = format(value, locale, options);
        assert.equal(parse(text, locale, options), value, `${locale} ${JSON.stringify(text)}`);
      }
    }
  });

  it('compact notation, short and long', () => {
    for (const locale of LOCALES) {
      for (const compactDisplay of ['short', 'long']) {
        const options = { notation: 'compact', compactDisplay, maximumFractionDigits: 3 };
        for (const value of [0, 5, 999, 1500, 2000000, 3500000000, 1e12, -2500, 7e6, 25000]) {
          const text = format(value, locale, options);
          assert.equal(parse(text, locale, options), value, `${locale} ${compactDisplay} ${JSON.stringify(text)}`);
        }
      }
    }
  });
});

describe('parse: plain numbers', () => {
  const cases = [
    ['1234', undefined, 1234],
    ['1,234', undefined, 1234],
    ['1,234.5', undefined, 1234.5],
    ['1,234,567.891', 'en-US', 1234567.891],
    ['  42  ', undefined, 42],
    ['-5', undefined, -5],
    ['+5', undefined, 5],
    ['−5', undefined, -5],
    ['- 5', undefined, -5],
    ['(1,234.50)', undefined, -1234.5],
    ['( 5 )', undefined, -5],
    ['.5', undefined, 0.5],
    ['5.', undefined, 5],
    ['0', undefined, 0],
    ['0.10', undefined, 0.1],
    ['007', undefined, 7],
    ['1.234.567,891', 'de-DE', 1234567.891],
    ['1.234', 'de-DE', 1234],
    ['1,5', 'de-DE', 1.5],
    [`1 234 567,5`, 'fr-FR', 1234567.5],
    [`1${NBSP}234${NBSP}567,5`, 'fr-FR', 1234567.5],
    [`1${NNBSP}234${NNBSP}567,5`, 'fr-FR', 1234567.5],
    ['12,34,567', 'en-IN', 1234567],
    ['1,234,567', 'en-IN', 1234567],
    ['12,345', 'en-IN', 12345],
    ['1’234.5', 'de-CH', 1234.5],
    ["1'234.5", 'de-CH', 1234.5],
    ['1 234.5', 'de-CH', 1234.5],
    ["1'234,5", 'fr-FR', 1234.5],
    ['١٬٢٣٤٫٥', 'ar-EG', 1234.5],
    ['1٬234٫5', 'ar-EG', 1234.5],
    ['‎-5', 'he-IL', -5],
    ['१२,३४,५६७', 'hi-IN-u-nu-deva', 1234567],
    ['१२३४', 'hi-IN-u-nu-deva', 1234],
  ];
  for (const [text, locale, expected] of cases) {
    it(`parses ${JSON.stringify(text)} (${locale ?? 'default'}) as ${expected}`, () => {
      assert.equal(parse(text, locale), expected);
    });
  }

  it('turns negative zero into 0', () => {
    assert.ok(Object.is(parse('-0'), 0));
    assert.ok(Object.is(parse('(0.00)'), 0));
  });

  it('keeps decimal precision exact', () => {
    assert.equal(parse('0.1'), 0.1);
    assert.equal(parse('0.30000000000000004'), 0.30000000000000004);
  });

  it('accepts an array of locales and Intl.Locale objects', () => {
    assert.equal(parse('1.234,5', ['de-DE', 'en-US']), 1234.5);
    assert.equal(parse('1.234,5', new Intl.Locale('de-DE')), 1234.5);
    assert.equal(parse('1,234.5', new Intl.Locale('en-US')), 1234.5);
  });

  it('uses en-US for undefined, null and empty locales', () => {
    assert.equal(parse('1,234.5', undefined), 1234.5);
    assert.equal(parse('1,234.5', null), 1234.5);
    assert.equal(parse('1,234.5', ''), 1234.5);
  });
});

describe('parse: currency', () => {
  const usd = { style: 'currency', currency: 'USD' };
  it('strips symbols, codes and names; they are optional', () => {
    assert.equal(parse('$1,234.50', 'en-US', usd), 1234.5);
    assert.equal(parse('USD 1,234.50', 'en-US', usd), 1234.5);
    assert.equal(parse('usd1,234.50', 'en-US', usd), 1234.5);
    assert.equal(parse('1,234.50 US dollars', 'en-US', usd), 1234.5);
    assert.equal(parse('1,234.50', 'en-US', usd), 1234.5);
    assert.equal(parse('1.234,50 €', 'de-DE', { style: 'currency', currency: 'EUR' }), 1234.5);
    assert.equal(parse(`1.234,50${NBSP}€`, 'de-DE', { style: 'currency', currency: 'EUR' }), 1234.5);
    assert.equal(parse('￥1,235', 'ja-JP', { style: 'currency', currency: 'JPY' }), 1235);
    assert.equal(parse('¥1,235', 'ja-JP', { style: 'currency', currency: 'JPY' }), 1235);
  });
  it('handles signs before or after the symbol, and accounting parentheses', () => {
    assert.equal(parse('-$5.00', 'en-US', usd), -5);
    assert.equal(parse('$-5.00', 'en-US', usd), -5);
    assert.equal(parse('+$5.00', 'en-US', usd), 5);
    assert.equal(parse('($5.00)', 'en-US', usd), -5);
    assert.equal(parse('($ 5.00)', 'en-US', usd), -5);
  });
  it('uses the separators money uses in the locale (de-AT, fr-CH)', () => {
    assert.equal(parse('€ 1.234,50', 'de-AT', { style: 'currency', currency: 'EUR' }), 1234.5);
    const chf = { style: 'currency', currency: 'CHF' };
    // Spaces and apostrophes both work, whichever the running Node version's locale data prefers.
    assert.equal(parse(`1${NNBSP}234.50${NBSP}CHF`, 'fr-CH', chf), 1234.5);
    assert.equal(parse("1'234.50 CHF", 'fr-CH', chf), 1234.5);
    assert.equal(parse(format(1234.5, 'fr-CH', chf), 'fr-CH', chf), 1234.5);
  });
  it('copes with symbols on both sides and capitalised names (tr-TR)', () => {
    const options = { style: 'currency', currency: 'GBP', currencyDisplay: 'name' };
    assert.equal(parse(format(1234.5, 'tr-TR', options), 'tr-TR', options), 1234.5);
  });
  it('requires a currency code', () => {
    assert.throws(() => parse('$5', 'en-US', { style: 'currency' }), /currency code/);
    assert.throws(() => parse('$5', 'en-US', { style: 'currency', currency: '' }), TypeError);
    assert.throws(() => parse('$5', 'en-US', { style: 'currency', currency: 5 }), TypeError);
  });
  it('rejects invalid currency codes through Intl', () => {
    assert.throws(() => parse('5', 'en-US', { style: 'currency', currency: 'usdollars' }), RangeError);
  });
  it('rejects a symbol when no currency was given', () => {
    assert.throws(() => parse('$5', 'en-US'), /unexpected character at position 1/);
  });
  it('can be used with many currencies without growing the caches forever', () => {
    for (let i = 0; i < 150; i++) {
      const currency = `A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`;
      assert.equal(parse('5', 'en-US', { style: 'currency', currency }), 5);
    }
    assert.equal(parse('$5', 'en-US', usd), 5);
  });
});

describe('parse: percent', () => {
  const percent = { style: 'percent' };
  it('returns a fraction', () => {
    assert.equal(parse('26%', 'en-US', percent), 0.26);
    assert.equal(parse('26 %', 'en-US', percent), 0.26);
    assert.equal(parse('-50%', 'en-US', percent), -0.5);
    assert.equal(parse('100%', 'en-US', percent), 1);
    assert.equal(parse('1,000%', 'en-US', percent), 10);
  });
  it('is exact, not 0.25600000000000006', () => {
    assert.equal(parse('25.6%', 'en-US', percent), 0.256);
    assert.equal(parse('7%', 'en-US', percent), 0.07);
  });
  it('treats the percent sign as optional and accepts it on either side', () => {
    assert.equal(parse('26', 'en-US', percent), 0.26);
    assert.equal(parse('%26', 'tr-TR', percent), 0.26);
    assert.equal(parse(`26${NBSP}%`, 'de-DE', percent), 0.26);
    assert.equal(parse('٢٦٪', 'ar-EG', percent), 0.26);
  });
  it('does not apply to plain numbers', () => {
    assert.throws(() => parse('26%', 'en-US'), TypeError);
  });
});

describe('parse: compact', () => {
  const compact = { notation: 'compact' };
  it('understands suffixes, case-insensitively', () => {
    assert.equal(parse('999', 'en-US', compact), 999);
    assert.equal(parse('1.2K', 'en-US', compact), 1200);
    assert.equal(parse('1.2k', 'en-US', compact), 1200);
    assert.equal(parse('3.5M', 'en-US', compact), 3500000);
    assert.equal(parse('2B', 'en-US', compact), 2e9);
    assert.equal(parse('-1.5K', 'en-US', compact), -1500);
    assert.equal(parse('1,234K', 'en-US', compact), 1234000);
  });
  it('understands long forms and other languages', () => {
    const long = { notation: 'compact', compactDisplay: 'long' };
    assert.equal(parse('2 million', 'en-US', long), 2e6);
    assert.equal(parse('1,5 Mio.', 'de-DE', compact), 1.5e6);
    assert.equal(parse('200万', 'ja-JP', compact), 2e6);
    assert.equal(parse('1,5 mille', 'fr-FR', long), 1500);
    assert.equal(parse('mille', 'fr-FR', long), 1000);
    assert.equal(parse('million', 'en-US', { notation: 'compact', compactDisplay: 'long' }), 1e6);
    assert.equal(parse('1,5 tysiąca', 'pl-PL', long), 1500);
    assert.equal(parse('elfu 1.5', 'sw-KE', compact), 1500);
  });
  it('is exact for fractions', () => {
    assert.equal(parse('1.15K', 'en-US', compact), 1150);
    assert.equal(parse('0.3K', 'en-US', compact), 300);
  });
  it('does not apply without notation: compact', () => {
    assert.throws(() => parse('1.2K', 'en-US'), TypeError);
  });
  it('combines with a currency', () => {
    const options = { style: 'currency', currency: 'USD', notation: 'compact' };
    assert.equal(parse('$1.2K', 'en-US', options), 1200);
  });
});

describe('parse: text that is not a number', () => {
  const bad = [
    '', '   ', 'abc', '12abc', 'abc12', '1.2.3', '1,23', '1,2345', ',123', '123,', '1,,234', '1,234.5,6',
    '1,234,56', '1e3', '--5', '+-5', '5-', '$5', '1 234', '.', '-', '+', '()', '(5', '5)', 'NaN',
    'Infinity', '0x10', '1,5', '(-5)', '(+5)',
  ];
  for (const text of bad) {
    it(`throws a TypeError for ${JSON.stringify(text)}`, () => {
      assert.throws(() => parse(text), (error) => error instanceof TypeError && /^Cannot parse text as a number/.test(error.message));
    });
  }
  it('throws for the wrong separators in the locale', () => {
    assert.throws(() => parse('1234.5', 'de-DE'), TypeError);
    assert.throws(() => parse("1'234,5", 'de-DE'), TypeError);
    assert.throws(() => parse('1 234,5'), TypeError);
  });
  it('throws a RangeError for numbers too large to represent', () => {
    assert.throws(() => parse('9'.repeat(400)), RangeError);
  });
  it('names the problem but never repeats the text', () => {
    const secret = 'SECRET-123';
    try {
      parse(secret);
      assert.fail('expected a throw');
    } catch (error) {
      assert.ok(!error.message.includes(secret));
      assert.match(error.message, /position 1/);
    }
    assert.throws(() => parse('1.2.3'), /more than one decimal separator/);
    assert.throws(() => parse('1.2,3'), /group separator follows the decimal separator/);
    assert.throws(() => parse('1,23'), /wrong place/);
    assert.throws(() => parse('.'), /no digits/);
    assert.throws(() => parse(''), /empty/);
    assert.throws(() => parse('(-5)'), /two signs/);
  });
});

describe('parse: wrong types and bad configuration', () => {
  it('throws a TypeError for null and undefined without a fallback', () => {
    assert.throws(() => parse(null), /got null/);
    assert.throws(() => parse(undefined), /got undefined/);
    assert.throws(() => parse(), TypeError);
  });
  it('throws a TypeError for other types, even with a fallback', () => {
    for (const value of [5, true, {}, [], new Date(0), () => 1, 5n]) {
      assert.throws(() => parse(value), TypeError);
      assert.throws(() => parse(value, 'en-US', { fallback: NaN }), TypeError);
    }
  });
  it('rejects non-object options and unsupported styles', () => {
    assert.throws(() => parse('5', 'en-US', 'oops'), /options/);
    assert.throws(() => parse('5', 'en-US', 5), TypeError);
    assert.throws(() => parse('5', 'en-US', { style: 'unit', unit: 'meter' }), /does not support style "unit"/);
    assert.equal(parse('5', 'en-US', null), 5);
    assert.equal(parse('5', 'en-US', { style: 'decimal' }), 5);
  });
  it('rejects invalid locales even when a fallback is set', () => {
    assert.throws(() => parse('5', 'xx_invalid'), RangeError);
    assert.throws(() => parse('5', 42), /Expected locale/);
    assert.throws(() => parse('nope', 'xx_invalid', { fallback: 0 }), RangeError);
    assert.throws(() => parse(null, 'xx_invalid', { fallback: 0 }), RangeError);
  });
});

describe('parse: fallback', () => {
  it('is returned for text that is not a number, whatever its type', () => {
    for (const fallback of [NaN, null, 0, 'n/a', undefined, -1]) {
      for (const text of ['', 'abc', '1,23', null, undefined, '9'.repeat(400)]) {
        const result = parse(text, 'en-US', { fallback });
        assert.ok(Object.is(result, fallback), `${String(text).slice(0, 8)} -> ${String(fallback)}`);
      }
    }
  });
  it('is ignored for valid text', () => {
    assert.equal(parse('1,234.5', 'en-US', { fallback: NaN }), 1234.5);
  });
  it('works with the other options and with inherited properties', () => {
    assert.equal(parse('x', 'en-US', { style: 'percent', fallback: null }), null);
    assert.equal(parse('50%', 'en-US', { style: 'percent', fallback: null }), 0.5);
    const inherited = Object.create({ fallback: 'inherited' });
    assert.equal(parse('x', 'en-US', inherited), 'inherited');
  });
});

describe('parse: exports and caching', () => {
  it('is exported by name and as a property of format', () => {
    assert.equal(typeof parse, 'function');
    assert.equal(format.parse, parse);
  });
  it('gives the same answers on repeated calls and for many locales', () => {
    for (let i = 0; i < 3; i++) assert.equal(parse('1.234,5', 'de-DE'), 1234.5);
    for (const locale of LOCALES) assert.equal(parse(format(1234.5, locale), locale), 1234.5);
    assert.equal(parse('1.234,5', 'de-DE'), 1234.5);
  });
});
