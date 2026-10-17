'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const format = require('../index');
const { createFormatter } = format;

describe('default (en-US) integers', () => {
  const cases = [
    [0, '0'],
    [1, '1'],
    [12, '12'],
    [123, '123'],
    [1234, '1,234'],
    [12345, '12,345'],
    [123456, '123,456'],
    [1234567, '1,234,567'],
    [12345678, '12,345,678'],
    [123456789, '123,456,789'],
    [1000000, '1,000,000'],
    [-1, '-1'],
    [-999, '-999'],
    [-1000, '-1,000'],
    [-1234567, '-1,234,567'],
    [Number.MAX_SAFE_INTEGER, '9,007,199,254,740,991'],
    [1e21, '1,000,000,000,000,000,000,000'],
  ];
  for (const [input, expected] of cases) {
    it(`formats ${String(input)} as ${expected}`, () => {
      assert.equal(format(input), expected);
    });
  }
});

describe('decimals', () => {
  it('keeps up to 3 fraction digits by default', () => {
    assert.equal(format(1234.5), '1,234.5');
    assert.equal(format(1234.5678), '1,234.568');
    assert.equal(format(0.1 + 0.2), '0.3');
  });
  it('rounds very small values to 0 by default', () => {
    assert.equal(format(0.0000001), '0');
  });
  it('honours fraction digit options', () => {
    assert.equal(format(1234.5, 'en-US', { minimumFractionDigits: 2 }), '1,234.50');
    assert.equal(format(0.0000001, 'en-US', { maximumFractionDigits: 10 }), '0.0000001');
    assert.equal(format(1234.5678, 'en-US', { maximumFractionDigits: 0 }), '1,235');
  });
});

describe('zero', () => {
  it('formats -0 as 0', () => {
    assert.equal(format(-0), '0');
  });
});

describe('bigint', () => {
  it('formats without losing precision', () => {
    assert.equal(format(12345678901234567890n), '12,345,678,901,234,567,890');
    assert.equal(format(-1000n), '-1,000');
    assert.equal(format(0n), '0');
  });
});

describe('locales', () => {
  it('formats with the requested locale', () => {
    assert.equal(format(1234567.891, 'de-DE'), '1.234.567,891');
    assert.equal(format(1234567, 'en-IN'), '12,34,567');
    assert.equal(format(1234567, 'fr-FR').replace(/\s/g, ' '), '1 234 567');
  });
  it('accepts an array of locales', () => {
    assert.equal(format(1234.5, ['de-DE', 'en-US']), '1.234,5');
  });
  it('uses en-US for undefined, null and empty locales', () => {
    assert.equal(format(1234, undefined), '1,234');
    assert.equal(format(1234, null), '1,234');
    assert.equal(format(1234, ''), '1,234');
  });
  it('throws a RangeError for an invalid locale', () => {
    assert.throws(() => format(1234, 'xx_invalid'), RangeError);
  });
});

describe('input validation', () => {
  const bad = [true, {}, [1, 2], new Date(0), () => 1, Symbol('x')];
  for (const value of bad) {
    it(`throws a TypeError for ${typeof value === 'symbol' ? 'a symbol' : String(value)}`, () => {
      assert.throws(() => format(value), TypeError);
    });
  }
  it('throws a TypeError for null, undefined and no arguments', () => {
    assert.throws(() => format(null), /got null/);
    assert.throws(() => format(undefined), /got undefined/);
    assert.throws(() => format(), TypeError);
  });
  it('names the offending type', () => {
    assert.throws(() => format(true), /got boolean/);
  });
  for (const value of ['', '  ', 'abc', '12ab', '1,234', '0x10', 'Infinity', 'NaN', '1.2.3', '--1']) {
    it(`throws a TypeError for the string ${JSON.stringify(value)}`, () => {
      assert.throws(() => format(value), /numeric string/);
    });
  }
  for (const value of [NaN, Infinity, -Infinity, '1e999', '-1e999']) {
    it(`throws a RangeError for ${value}`, () => {
      assert.throws(() => format(value), RangeError);
    });
  }
  it('rejects non-object options', () => {
    assert.throws(() => format(1, 'en-US', 'oops'), TypeError);
    assert.throws(() => format(1, 'en-US', 5), TypeError);
  });
  it('accepts null options', () => {
    assert.equal(format(1234, 'en-US', null), '1,234');
  });
  it('propagates invalid option values from Intl', () => {
    assert.throws(() => format(1, 'en-US', { maximumFractionDigits: 999 }), RangeError);
  });
});

describe('numeric strings', () => {
  const cases = [
    ['1234', '1,234'],
    ['1234.5', '1,234.5'],
    ['  1234  ', '1,234'],
    ['-1234567', '-1,234,567'],
    ['+42', '42'],
    ['.5', '0.5'],
    ['5.', '5'],
    ['1e3', '1,000'],
    ['1E3', '1,000'],
    ['0', '0'],
    ['-0', '0'],
    ['0.000', '0'],
  ];
  for (const [input, expected] of cases) {
    it(`formats ${JSON.stringify(input)} as ${expected}`, () => {
      assert.equal(format(input), expected);
    });
  }
  it('applies locale and options to strings', () => {
    assert.equal(format('1234567.891', 'de-DE'), '1.234.567,891');
    assert.equal(format('1234.5', 'en-US', { minimumFractionDigits: 2 }), '1,234.50');
  });
  it('keeps every digit of long decimal strings', () => {
    assert.equal(
      format('12345678901234567890.123456789', 'en-US', { maximumFractionDigits: 20 }),
      '12,345,678,901,234,567,890.123456789'
    );
  });
});

describe('fallback', () => {
  const options = { fallback: '—' };
  for (const value of [null, undefined, NaN, Infinity, -Infinity, '', 'N/A', '1e999']) {
    it(`returns the fallback for ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`, () => {
      assert.equal(format(value, 'en-US', options), '—');
    });
  }
  it('allows an empty string as the fallback', () => {
    assert.equal(format(null, 'en-US', { fallback: '' }), '');
  });
  it('still formats valid values', () => {
    assert.equal(format(1234, 'en-US', options), '1,234');
    assert.equal(format('1234', 'en-US', options), '1,234');
    assert.equal(format(5n, 'en-US', options), '5');
  });
  it('still throws for wrong types', () => {
    assert.throws(() => format({}, 'en-US', options), TypeError);
    assert.throws(() => format(true, 'en-US', options), TypeError);
  });
  it('requires the fallback to be a string', () => {
    assert.throws(() => format(1, 'en-US', { fallback: 0 }), /fallback/);
    assert.throws(() => format(1, 'en-US', { fallback: null }), TypeError);
  });
  it('does not treat an undefined fallback as set', () => {
    assert.throws(() => format(null, 'en-US', { fallback: undefined }), TypeError);
  });
  it('combines with Intl options and keeps them out of the way', () => {
    assert.equal(format(1, 'en-US', { fallback: 'x', minimumFractionDigits: 2 }), '1.00');
    assert.equal(format(null, 'en-US', { fallback: 'x', minimumFractionDigits: 2 }), 'x');
  });
  it('works with null-prototype and inherited options', () => {
    const bare = Object.assign(Object.create(null), { fallback: 'none' });
    assert.equal(format(null, 'en-US', bare), 'none');
    const inherited = Object.create({ fallback: 'inherited', minimumFractionDigits: 1 });
    assert.equal(format(null, 'en-US', inherited), 'inherited');
    assert.equal(format(2, 'en-US', inherited), '2.0');
  });
  it('still throws for an invalid locale even when a fallback is set', () => {
    assert.throws(() => format(null, 'xx_invalid', options), RangeError);
  });
});

describe('createFormatter', () => {
  it('fixes the locale and options', () => {
    const euro = createFormatter('de-DE', { minimumFractionDigits: 2 });
    assert.equal(euro(1234), '1.234,00');
    assert.equal(euro('1234.5'), '1.234,50');
    assert.equal(euro(5n), '5,00');
  });
  it('defaults to en-US with no arguments', () => {
    assert.equal(createFormatter()(1234567), '1,234,567');
  });
  it('validates eagerly', () => {
    assert.throws(() => createFormatter('xx_invalid'), RangeError);
    assert.throws(() => createFormatter('en-US', 'oops'), TypeError);
    assert.throws(() => createFormatter(42), TypeError);
    assert.throws(() => createFormatter('en-US', { fallback: 1 }), TypeError);
  });
  it('supports a fallback', () => {
    const safe = createFormatter('en-US', { fallback: 'n/a' });
    assert.equal(safe(null), 'n/a');
    assert.equal(safe(undefined), 'n/a');
    assert.equal(safe(1000), '1,000');
  });
  it('throws on bad values without a fallback', () => {
    const strict = createFormatter();
    assert.throws(() => strict(null), TypeError);
    assert.throws(() => strict(NaN), RangeError);
  });
  it('is not affected by later changes to the options object', () => {
    const options = { minimumFractionDigits: 2 };
    const fmt = createFormatter('en-US', options);
    options.minimumFractionDigits = 0;
    assert.equal(fmt(1), '1.00');
  });
});

describe('presets', () => {
  it('currency', () => {
    assert.equal(format.currency(1234.5, 'USD'), '$1,234.50');
    assert.equal(format.currency(1234.5, 'EUR', 'de-DE').replace(/\s/g, ' '), '1.234,50 €');
    assert.equal(format.currency(-5, 'USD'), '-$5.00');
    assert.equal(format.currency('1234.5', 'JPY', 'ja-JP'), '￥1,235');
    assert.equal(format.currency(1234.5, 'USD', 'en-US', { maximumFractionDigits: 0 }), '$1,235');
    assert.equal(format.currency(null, 'USD', 'en-US', { fallback: '—' }), '—');
  });
  it('currency requires a code and ignores style/currency in options', () => {
    assert.throws(() => format.currency(1), /currency code/);
    assert.throws(() => format.currency(1, ''), TypeError);
    assert.throws(() => format.currency(1, 5), TypeError);
    assert.throws(() => format.currency(1, 'usdollars'), RangeError);
    assert.equal(format.currency(1, 'USD', 'en-US', { style: 'percent', currency: 'EUR' }), '$1.00');
  });
  it('percent takes a fraction', () => {
    assert.equal(format.percent(0.256), '26%');
    assert.equal(format.percent(1), '100%');
    assert.equal(format.percent(0.2564, 'en-US', { maximumFractionDigits: 1 }), '25.6%');
    assert.equal(format.percent(0.5, 'de-DE').replace(/\s/g, ' '), '50 %');
    assert.equal(format.percent(NaN, 'en-US', { fallback: 'n/a' }), 'n/a');
  });
  it('compact', () => {
    assert.equal(format.compact(999), '999');
    assert.equal(format.compact(1234), '1.2K');
    assert.equal(format.compact(1234567), '1.2M');
    assert.equal(format.compact(1234567, 'en-US', { compactDisplay: 'long' }), '1.2 million');
    assert.equal(format.compact(-1500), '-1.5K');
  });
  it('signed', () => {
    assert.equal(format.signed(12), '+12');
    assert.equal(format.signed(-12), '-12');
    assert.equal(format.signed(0), '0');
    assert.equal(format.signed(1.5, 'en-US', { maximumFractionDigits: 0 }), '+2');
  });
  it('presets reject bad options', () => {
    for (const preset of [format.percent, format.compact, format.signed, format.bytes]) {
      assert.throws(() => preset(1, 'en-US', 'oops'), TypeError);
    }
    assert.throws(() => format.currency(1, 'USD', 'en-US', 'oops'), TypeError);
  });
  it('presets keep type checks on the value', () => {
    assert.throws(() => format.percent(null), TypeError);
    assert.throws(() => format.compact({}), TypeError);
  });
});

describe('bytes', () => {
  const cases = [
    [0, '0 B'],
    [1, '1 B'],
    [999, '999 B'],
    [1000, '1 kB'],
    [1536, '1.5 kB'],
    [999949, '999.9 kB'],
    [999950, '1 MB'],
    [999999, '1 MB'],
    [1000000, '1 MB'],
    [2.5e9, '2.5 GB'],
    [1.2345e12, '1.2 TB'],
    [1e15, '1 PB'],
    [1e18, '1,000 PB'],
    [-1536, '-1.5 kB'],
    [999.5, '1 kB'],
    ['1536', '1.5 kB'],
    [1536n, '1.5 kB'],
    [-0, '0 B'],
  ];
  for (const [input, expected] of cases) {
    it(`formats ${String(input)} as ${expected}`, () => {
      assert.equal(format.bytes(input), expected);
    });
  }
  it('uses the locale for the number', () => {
    assert.equal(format.bytes(1536, 'de-DE'), '1,5 kB');
  });
  it('lets options override the precision', () => {
    assert.equal(format.bytes(1536, 'en-US', { maximumFractionDigits: 3 }), '1.536 kB');
    assert.equal(format.bytes(1500, 'en-US', { maximumFractionDigits: 0 }), '2 kB');
  });
  it('returns the fallback for missing values and throws otherwise', () => {
    assert.equal(format.bytes(null, 'en-US', { fallback: '—' }), '—');
    assert.equal(format.bytes('n/a', 'en-US', { fallback: '—' }), '—');
    assert.equal(format.bytes(1500, 'en-US', { fallback: '—' }), '1.5 kB');
    assert.throws(() => format.bytes(null), TypeError);
    assert.throws(() => format.bytes(NaN), RangeError);
    assert.throws(() => format.bytes({}, 'en-US', { fallback: '—' }), TypeError);
  });
});

describe('formatter cache', () => {
  it('gives identical results on repeated calls', () => {
    for (let i = 0; i < 3; i++) assert.equal(format(1234.5, 'de-DE'), '1.234,5');
  });
  it('stays correct after many distinct locale/option combinations', () => {
    for (let i = 1; i <= 21; i++) {
      for (let j = 0; j <= 10; j++) {
        const out = format(5, 'en-US', { minimumIntegerDigits: i, minimumFractionDigits: j });
        assert.equal(out.replace(/[,.]/g, '').length, i + j);
      }
    }
    assert.equal(format(1234), '1,234');
    assert.equal(format(1234, 'de-DE'), '1.234');
  });
});

describe('cache safety', () => {
  it('does not mix up Intl.Locale objects', () => {
    assert.equal(format(1234.5, new Intl.Locale('de-DE')), '1.234,5');
    assert.equal(format(1234.5, new Intl.Locale('en-US')), '1,234.5');
    assert.equal(format(1234.5, new Intl.Locale('fr-FR')).replace(/\s/g, ' '), '1 234,5');
  });
  it('honours inherited option properties without poisoning plain ones', () => {
    const inherited = Object.create({ minimumFractionDigits: 2 });
    assert.equal(format(1, 'en-US', inherited), '1.00');
    assert.equal(format(1, 'en-US', {}), '1');
    assert.equal(format(1, 'en-US'), '1');
  });
  it('accepts null-prototype options', () => {
    const options = Object.assign(Object.create(null), { minimumFractionDigits: 1 });
    assert.equal(format(1, 'en-US', options), '1.0');
  });
  it('rejects locales of the wrong type', () => {
    assert.throws(() => format(1, 42), /Expected locale/);
    assert.throws(() => format(1, true), TypeError);
  });
  it('does not cache arrays containing non-strings', () => {
    assert.throws(() => format(1, [42]), TypeError);
  });
});

describe('exports', () => {
  it('is the function itself and also available as named and default exports', () => {
    assert.equal(typeof format, 'function');
    assert.equal(format.default, format);
    assert.equal(format.formatNumber, format);
    assert.equal(format.createFormatter, createFormatter);
    for (const name of ['currency', 'percent', 'compact', 'signed', 'bytes']) {
      assert.equal(typeof format[name], 'function', name);
    }
  });
});
