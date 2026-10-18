'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const format = require('..');

const { parseBytes, bytes } = format;

// Hausa writes the unit before the number and Zulu has a typo in its narrow kilobyte, so both are here
// on purpose, next to a spread of scripts and separators.
const LOCALES = [
  'en-US', 'en-GB', 'en-IN', 'de-DE', 'de-CH', 'fr-FR', 'fr-CA', 'es-ES', 'it-IT', 'pt-BR', 'nl-NL',
  'sv-SE', 'pl-PL', 'cs-CZ', 'ru-RU', 'uk-UA', 'tr-TR', 'el-GR', 'he-IL', 'ar-EG', 'ar-SA', 'fa-IR',
  'hi-IN', 'bn-BD', 'th-TH', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'id-ID', 'vi-VN', 'sw-KE', 'ha', 'zu',
  'ca-ES', 'lt-LT', 'fi-FI', 'hu-HU',
];

const POWERS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'];

describe('parseBytes: units', () => {
  it('reads decimal units as powers of 1000', () => {
    const cases = {
      '0 B': 0, '12 B': 12, '1 kB': 1e3, '1 KB': 1e3, '1.5 MB': 1.5e6, '2 GB': 2e9, '3 TB': 3e12, '4 PB': 4e15,
    };
    for (const [text, expected] of Object.entries(cases)) assert.equal(parseBytes(text), expected, text);
  });

  it('reads KiB to PiB as powers of 1024, with or without the binary option', () => {
    const cases = { '1 KiB': 1024, '1.5 MiB': 1572864, '2 GiB': 2 * 1024 ** 3, '1 TiB': 1024 ** 4, '1 PiB': 1024 ** 5 };
    for (const [text, expected] of Object.entries(cases)) {
      assert.equal(parseBytes(text), expected, text);
      assert.equal(parseBytes(text, 'en-US', { binary: true }), expected, text);
    }
  });

  it('reads KB, MB... as powers of 1024 when binary is true', () => {
    assert.equal(parseBytes('1 KB', 'en-US', { binary: true }), 1024);
    assert.equal(parseBytes('1.5 mb', 'en-US', { binary: true }), 1572864);
    assert.equal(parseBytes('3 GB', 'en-US', { binary: true }), 3 * 1024 ** 3);
    assert.equal(parseBytes('3 GB', 'en-US', { binary: false }), 3e9);
    assert.equal(parseBytes('12 B', 'en-US', { binary: true }), 12);
  });

  it('ignores case and spacing, and reads unit names', () => {
    for (const text of ['1.5kb', '1.5 KB', ' 1.5  kB ', '1.5 kilobytes', '1.5 Kilobytes', '1.5 kB', '1.5 kB']) {
      assert.equal(parseBytes(text), 1500, JSON.stringify(text));
    }
    assert.equal(parseBytes('1 byte'), 1);
    assert.equal(parseBytes('2 bytes'), 2);
    assert.equal(parseBytes('1 kibibyte'), 1024);
    assert.equal(parseBytes('2 Mebibytes'), 2 * 1024 ** 2);
    assert.equal(parseBytes('1 gibibyte'), 1024 ** 3);
  });

  it('treats text without a unit as bytes and does not round', () => {
    assert.equal(parseBytes('1500'), 1500);
    assert.equal(parseBytes('1,500'), 1500);
    assert.equal(parseBytes('0.5 B'), 0.5);
    assert.equal(parseBytes('0.0005 kB'), 0.5);
  });

  it('is exact for decimal units, where 1.1 * 1000 would give 1100.0000000000002', () => {
    assert.equal(parseBytes('1.1 kB'), 1100);
    assert.equal(parseBytes('0.3 MB'), 300000);
    assert.equal(parseBytes('2.675 GB'), 2675000000);
    assert.equal(parseBytes('1.001 TB'), 1001000000000);
    assert.equal(parseBytes('1.1 KiB'), 1126.4);
  });

  it('reads signs', () => {
    assert.equal(parseBytes('-2 GB'), -2e9);
    assert.equal(parseBytes('+2 GB'), 2e9);
    assert.equal(parseBytes('−2 kB'), -2000);
    assert.equal(Object.is(parseBytes('-0 B'), 0), true);
  });
});

describe('parseBytes: text that must be rejected', () => {
  it('refuses megabits and the like, which are not bytes', () => {
    for (const text of ['5 Mb', '5 Kb', '5 Gb', '5 Tb', '5 Pb', '5 Kib', '5 Mib']) {
      assert.throws(() => parseBytes(text), (error) => error instanceof TypeError && /bits/.test(error.message), text);
    }
    // All-lowercase is how people write kilobytes in practice.
    assert.equal(parseBytes('5 kb'), 5000);
    assert.equal(parseBytes('5 mb'), 5e6);
    assert.equal(parseBytes('5 kib'), 5120);
  });

  it('refuses unknown units, stray text, empty text and a missing number', () => {
    for (const text of ['5 XB', '5 foo', 'abc', '', '   ', 'MB', 'kilobytes', '5 MB 6', '5 MB MB', '1,5 MB', '1.5.5 MB', '1e3 MB']) {
      assert.throws(() => parseBytes(text), TypeError, JSON.stringify(text));
    }
  });

  it('does not accept two signs or a sign after the unit', () => {
    assert.throws(() => parseBytes('(5 MB)-'), TypeError);
    assert.throws(() => parseBytes('--5 MB'), TypeError);
  });

  it('rejects a number too large to hold', () => {
    const huge = `${'9'.repeat(400)} PB`;
    assert.throws(() => parseBytes(huge), RangeError);
    assert.ok(Number.isNaN(parseBytes(huge, 'en-US', { fallback: NaN })));
  });

  it('rejects things that are not strings, and bad options', () => {
    assert.throws(() => parseBytes(5), TypeError);
    assert.throws(() => parseBytes(5, 'en-US', { fallback: 0 }), TypeError);
    assert.throws(() => parseBytes(null), TypeError);
    assert.throws(() => parseBytes(undefined), TypeError);
    assert.throws(() => parseBytes('5 MB', 'en-US', 'binary'), TypeError);
    assert.throws(() => parseBytes('5 MB', 'not a locale'), RangeError);
  });

  it('stays fast on hostile input', () => {
    const start = Date.now();
    for (const text of ['9'.repeat(200000) + ' kB', 'k'.repeat(200000), ' '.repeat(200000) + '1 B', '1,'.repeat(100000) + ' MB']) {
      try { parseBytes(text); } catch { /* the point is that it returns */ }
    }
    assert.ok(Date.now() - start < 2000, 'took too long');
  });
});

describe('parseBytes: fallback', () => {
  it('returns the fallback for text that is not a size, whatever its type', () => {
    for (const fallback of [null, NaN, 0, 'n/a', undefined]) {
      const got = parseBytes('nonsense', 'en-US', { fallback });
      assert.ok(Object.is(got, fallback), String(fallback));
      assert.ok(Object.is(parseBytes('', 'en-US', { fallback }), fallback));
      assert.ok(Object.is(parseBytes(null, 'en-US', { fallback }), fallback));
      assert.ok(Object.is(parseBytes(undefined, 'en-US', { fallback }), fallback));
    }
    assert.equal(parseBytes('5 Mb', 'en-US', { fallback: null }), null);
  });

  it('does not use the fallback for valid text', () => {
    assert.equal(parseBytes('5 MB', 'en-US', { fallback: null }), 5e6);
    assert.equal(parseBytes('5 MB', undefined, null), 5e6);
    assert.equal(parseBytes('5 MB', undefined, {}), 5e6);
  });
});

describe('parseBytes: locales', () => {
  it('reads the number in the locale and the English labels that format.bytes writes', () => {
    assert.equal(parseBytes('1,5 MB', 'de-DE'), 1.5e6);
    assert.equal(parseBytes('1.234,5 kB', 'de-DE'), 1234500);
    assert.equal(parseBytes('1 234,5 kB', 'fr-FR'), 1234500);
    assert.equal(parseBytes('1 234,5 KiB', 'fr-FR'), 1234.5 * 1024);
    assert.equal(parseBytes('12,34,567 B', 'en-IN'), 1234567);
    assert.equal(parseBytes('1.5 MB', 'de-DE', { fallback: null }), null, '"1.5" is not a German number here');
  });

  it('reads the unit names of each locale, in every display style', () => {
    for (const locale of LOCALES) {
      POWERS.forEach((unit, power) => {
        for (const unitDisplay of ['short', 'narrow', 'long']) {
          // Zulu's own narrow kilobyte is "Mb", a typo in the locale data that reads as megabits.
          if (locale === 'zu' && unit === 'kilobyte' && unitDisplay === 'narrow') continue;
          const formatter = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay, maximumFractionDigits: 1 });
          for (const amount of [1, 1.5, 2, 5, 21, 100]) {
            // Some older locale data writes a single unit as a bare word (Hebrew "megabyte"), with no number to read.
            if (!formatter.formatToParts(amount).some((part) => part.type === 'integer')) continue;
            const text = formatter.format(amount);
            assert.equal(parseBytes(text, locale), amount * 1000 ** power, `${locale} ${unitDisplay}: ${text}`);
          }
        }
      });
    }
  });

  it('also reads English unit names in a locale that has its own', () => {
    assert.equal(parseBytes('1,5 kilobytes', 'de-DE'), 1500);
    assert.equal(parseBytes('1,5 megabytes', 'fr-FR'), 1.5e6);
    assert.equal(parseBytes('2 Gigabytes', 'ja-JP'), 2e9);
    assert.equal(parseBytes('2 mebibytes', 'ru-RU'), 2 * 1024 ** 2);
  });

  it('English labels still mean the same thing in a locale with its own names', () => {
    // CLDR's Zulu narrow kilobyte is "Mb". The English labels are added first, so "MB" stays megabytes.
    assert.equal(parseBytes('5 MB', 'zu'), 5e6);
    assert.equal(parseBytes('5 kB', 'zu'), 5000);
    assert.equal(parseBytes('5 ko', 'fr'), 5000);
    assert.equal(parseBytes('5 Mo', 'fr'), 5e6);
  });
});

describe('parseBytes: round trips with format.bytes', () => {
  it('reads back what bytes wrote, in short, long and binary form, in every locale', () => {
    const sizes = [0, 1, 12, 999, 1000, 1500, 1536, 20000, 1234567, 5e9, 2e12, 3e15, 1024, 1048576, 7340032];
    const styles = [{}, { unitDisplay: 'long' }, { binary: true }];
    for (const locale of LOCALES) {
      for (const style of styles) {
        for (const size of sizes) {
          const options = { ...style, maximumFractionDigits: 3 };
          const text = bytes(size, locale, options);
          const back = parseBytes(text, locale);
          assert.equal(bytes(back, locale, options), text, `${locale} ${JSON.stringify(style)} ${size}: ${text}`);
        }
      }
    }
  });

  it('is exact for sizes that the text can hold', () => {
    for (const size of [0, 1, 999, 1500, 20000, 2500000, 5e9, 1.5e12]) {
      assert.equal(parseBytes(bytes(size, 'en-US', { maximumFractionDigits: 3 })), size);
    }
    for (const size of [1024, 1536, 1048576, 3 * 1024 ** 3]) {
      assert.equal(parseBytes(bytes(size, 'en-US', { binary: true, maximumFractionDigits: 3 })), size);
    }
  });
});

describe('parseBytes: exports', () => {
  it('is a named export and a property of the default export', () => {
    assert.equal(typeof parseBytes, 'function');
    assert.equal(format.parseBytes, parseBytes);
    assert.equal(format.default.parseBytes, parseBytes);
  });
});
