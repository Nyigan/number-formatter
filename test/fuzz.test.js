'use strict';

// Randomised robustness tests for parse(). The generator is seeded, so a failure is reproducible:
// the message names the seed, locale, options and the exact input.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const format = require('../index');
const { parse } = format;

/** Small deterministic PRNG (mulberry32). */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = [
  ...'0123456789', ...'0123456789', ...'0123456789', // digits are common in real input
  '.', ',', ' ', ' ', ' ', "'", '’', '-', '−', '+', '(', ')', '%', '$', '€', '￥', '¥',
  'K', 'k', 'M', 'B', 'T', 'e', 'E', 'x', 'a', 'z', 'Mio.', 'million', 'USD', 'mille', '万', '٣', '१',
  '٫', '٬', '‎', '‏', '؜', '\t', '\n', '\u0000', '😀', '\ud800', 'İ', 'NaN', 'Infinity',
];

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'de-CH', 'en-IN', 'ar-EG', 'ja-JP', 'tr-TR', 'ru-RU', 'sw-KE', 'hi-IN', 'es-ES'];
const OPTION_SETS = [
  undefined,
  { style: 'currency', currency: 'USD' },
  { style: 'currency', currency: 'EUR', currencyDisplay: 'name' },
  { style: 'percent' },
  { notation: 'compact' },
  { style: 'currency', currency: 'JPY', notation: 'compact' },
];

const label = (seed, locale, options, text) =>
  `seed=${seed} locale=${locale} options=${JSON.stringify(options)} text=${JSON.stringify(text)}`;

describe('parse: random text', () => {
  it('returns a finite number or throws a documented error, and fallback never throws', () => {
    const rand = random(20260101);
    let accepted = 0;
    let rejected = 0;
    for (const locale of LOCALES) {
      for (const options of OPTION_SETS) {
        for (let n = 0; n < 1500; n++) {
          const length = Math.floor(rand() * 24);
          let text = '';
          for (let i = 0; i < length; i++) text += ALPHABET[Math.floor(rand() * ALPHABET.length)];
          const where = label(20260101, locale, options, text);

          let result;
          try {
            result = parse(text, locale, options);
            accepted++;
          } catch (error) {
            rejected++;
            assert.ok(error instanceof TypeError || error instanceof RangeError, `${where}: ${error}`);
            // Short inputs can match ordinary words in a message by accident, so only longer ones are checked.
            assert.ok(text.length < 8 || !error.message.includes(text), `error repeats the input: ${where}`);
            continue;
          }
          assert.equal(typeof result, 'number', where);
          assert.ok(Number.isFinite(result), where);
          assert.ok(!Object.is(result, -0), `negative zero: ${where}`);

          // Text that parses must keep parsing to the same number when given a fallback, and a
          // reusable parser must agree with parse().
          assert.equal(parse(text, locale, { ...options, fallback: 'unused' }), result, where);
          assert.equal(format.createParser(locale, options)(text), result, where);
        }
      }
    }
    // Make sure the generator exercises both outcomes, not just one.
    assert.ok(accepted > 500, `only ${accepted} inputs were accepted`);
    assert.ok(rejected > 5000, `only ${rejected} inputs were rejected`);
  });

  it('fallback absorbs every rejection', () => {
    const rand = random(7);
    for (const locale of LOCALES) {
      for (const options of OPTION_SETS) {
        for (let n = 0; n < 300; n++) {
          let text = '';
          const length = Math.floor(rand() * 30);
          for (let i = 0; i < length; i++) text += ALPHABET[Math.floor(rand() * ALPHABET.length)];
          const result = parse(text, locale, { ...options, fallback: 'FALLBACK' });
          assert.ok(typeof result === 'number' || result === 'FALLBACK', label(7, locale, options, text));
        }
      }
    }
  });
});

describe('parse: random numbers made by format()', () => {
  it('round-trips random values in several locales', () => {
    const rand = random(99);
    for (const locale of LOCALES) {
      for (let n = 0; n < 400; n++) {
        const magnitude = 10 ** Math.floor(rand() * 12);
        // Three decimals at most, so format's default rounding is lossless.
        const value = Number(((rand() - 0.3) * magnitude).toFixed(3));
        const text = format(value, locale);
        assert.equal(parse(text, locale), value === 0 ? 0 : value, `${locale} ${JSON.stringify(text)}`);
      }
    }
  });
});

describe('parse: hostile input stays fast', () => {
  const huge = 200_000;
  const cases = {
    'a very long run of digits': '9'.repeat(huge),
    'a very long run of group separators': ',,,,'.repeat(huge / 4),
    'many digit groups': '1,234'.repeat(huge / 5),
    'many decimal separators': '1.'.repeat(huge / 2),
    'thousands of signs': '-'.repeat(huge),
    'deeply nested parentheses': '('.repeat(huge / 2) + ')'.repeat(huge / 2),
    'a very long unknown word': 'x'.repeat(huge),
    'whitespace padding': ' '.repeat(huge) + '5' + ' '.repeat(huge),
    'repeated compact words': 'K'.repeat(huge),
  };
  for (const [name, text] of Object.entries(cases)) {
    it(`finishes quickly for ${name}`, { timeout: 5000 }, () => {
      for (const options of [undefined, { style: 'currency', currency: 'USD' }, { notation: 'compact' }]) {
        try {
          const result = parse(text, 'en-US', options);
          assert.ok(Number.isFinite(result), 'a result must be a finite number');
        } catch (error) {
          assert.ok(error instanceof TypeError || error instanceof RangeError);
        }
      }
    });
  }
});
