'use strict';

const DEFAULT_LOCALE = 'en-US';
const MAX_CACHED_FORMATTERS = 100;
const NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

/** Marks errors caused by "no usable value", which a `fallback` option is allowed to replace. */
const SOFT = Symbol('soft');

/** @type {Map<string, Intl.NumberFormat>} */
const cache = new Map();
/** Parsing data derived from a locale (separators, digits, affixes), keyed like `cache`. */
const parseCache = new Map();

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Returns a cache key, or `null` when the arguments cannot be keyed safely. Only plain strings and
 * plain objects have a faithful JSON form: `Intl.Locale` objects all serialise to `{}` and inherited
 * option properties are skipped, so those calls bypass the cache rather than risk a wrong hit.
 */
function cacheKey(locale, options) {
  const localeKeyable =
    typeof locale === 'string' || (Array.isArray(locale) && locale.every((l) => typeof l === 'string'));
  if (!localeKeyable || (options != null && !isPlainObject(options))) return null;
  // Plain string locales without options (the common case) skip JSON serialisation.
  return options == null && typeof locale === 'string' ? locale : JSON.stringify([locale, options || null]);
}

/** Returns the cached value for `key`, creating it on a miss. A `null` key means "do not cache". */
function remember(map, key, create) {
  if (key === null) return create();
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    if (map.size >= MAX_CACHED_FORMATTERS) {
      // Evict the oldest entry so unusual option combinations cannot grow the cache forever.
      map.delete(map.keys().next().value);
    }
    map.set(key, value);
  }
  return value;
}

function getFormatter(locale, options) {
  return remember(cache, cacheKey(locale, options), () => new Intl.NumberFormat(locale, options));
}

function soft(error) {
  error[SOFT] = true;
  return error;
}

function assertOptions(options) {
  if (options !== undefined && options !== null && typeof options !== 'object') {
    throw new TypeError(`Expected options to be an object, got ${typeof options}`);
  }
}

function resolveLocale(locale) {
  const resolved = locale === undefined || locale === null || locale === '' ? DEFAULT_LOCALE : locale;
  if (typeof resolved !== 'string' && typeof resolved !== 'object') {
    throw new TypeError(`Expected locale to be a string, array or Intl.Locale, got ${typeof resolved}`);
  }
  return resolved;
}

function getFallback(options) {
  assertOptions(options);
  const fallback = options == null ? undefined : options.fallback;
  if (fallback !== undefined && typeof fallback !== 'string') {
    throw new TypeError(`Expected fallback to be a string, got ${typeof fallback}`);
  }
  return fallback;
}

/** `fallback` is ours, not Intl's: keep it out of the formatter and its cache key. */
function intlOptions(options, fallback) {
  if (fallback === undefined || !isPlainObject(options)) return options;
  const rest = { ...options };
  delete rest.fallback;
  return rest;
}

/** Returns the value in a form `Intl.NumberFormat` accepts, or throws a TypeError/RangeError. */
function prepare(value) {
  switch (typeof value) {
    case 'bigint':
      return value;
    case 'number':
      if (!Number.isFinite(value)) throw soft(new RangeError(`Expected a finite number, got ${value}`));
      return value === 0 ? 0 : value; // turns -0 into 0
    case 'string': {
      const text = value.trim();
      if (!NUMERIC_STRING.test(text)) throw soft(new TypeError('Expected a numeric string'));
      const asNumber = Number(text);
      if (!Number.isFinite(asNumber)) throw soft(new RangeError('Expected a finite numeric string'));
      // Strings go to Intl as-is, so newer Node versions keep every digit; zero is normalised.
      return asNumber === 0 ? 0 : text;
    }
    default: {
      const error = new TypeError(
        `Expected a number, bigint or numeric string, got ${value === null ? 'null' : typeof value}`
      );
      throw value === null || value === undefined ? soft(error) : error;
    }
  }
}

function formatValue(formatter, value, fallback) {
  let prepared;
  try {
    prepared = prepare(value);
  } catch (error) {
    if (fallback !== undefined && error[SOFT]) return fallback;
    throw error;
  }
  return formatter.format(prepared);
}

/**
 * Formats a number with locale-aware thousands separators.
 *
 * @param {number | bigint | string} value A finite number, a bigint or a numeric string such as `'1234.50'`.
 * @param {string | string[] | Intl.Locale} [locale='en-US'] A BCP 47 language tag. `undefined`, `null` and `''` use the default.
 * @param {Intl.NumberFormatOptions & { fallback?: string }} [options] Passed to `Intl.NumberFormat`.
 *   `fallback` is returned for `null`, `undefined`, `NaN`, infinities and non-numeric strings instead of throwing.
 * @returns {string}
 * @throws {TypeError} If `value`, `locale`, `options` or `fallback` has the wrong type.
 * @throws {RangeError} If `value` is not finite, or the locale or options are invalid.
 */
function formatNumber(value, locale, options) {
  const fallback = getFallback(options);
  const formatter = getFormatter(resolveLocale(locale), intlOptions(options, fallback));
  return formatValue(formatter, value, fallback);
}

/**
 * Builds a reusable formatter. The locale and options are validated once, up front.
 *
 * @param {string | string[] | Intl.Locale} [locale]
 * @param {Intl.NumberFormatOptions & { fallback?: string }} [options]
 * @returns {(value: number | bigint | string) => string}
 */
function createFormatter(locale, options) {
  const fallback = getFallback(options);
  const formatter = getFormatter(resolveLocale(locale), intlOptions(options, fallback));
  return (value) => formatValue(formatter, value, fallback);
}

/** `format.currency(1234.5, 'USD')` -> `$1,234.50`. */
function currency(value, currencyCode, locale, options) {
  if (typeof currencyCode !== 'string' || currencyCode === '') {
    throw new TypeError('Expected a currency code such as "USD"');
  }
  assertOptions(options);
  return formatNumber(value, locale, { ...options, style: 'currency', currency: currencyCode });
}

/** `format.percent(0.256)` -> `26%`. The value is a fraction, not a percentage. */
function percent(value, locale, options) {
  assertOptions(options);
  return formatNumber(value, locale, { style: 'percent', ...options });
}

/** `format.compact(1234567)` -> `1.2M`. */
function compact(value, locale, options) {
  assertOptions(options);
  return formatNumber(value, locale, { notation: 'compact', ...options });
}

/** `format.signed(12)` -> `+12`; zero stays `0`. */
function signed(value, locale, options) {
  assertOptions(options);
  return formatNumber(value, locale, { signDisplay: 'exceptZero', ...options });
}

/** `format.bytes(1536)` -> `1.5 kB`. Decimal (1000-based) units from B to PB; the unit label is not localised. */
function bytes(value, locale, options) {
  const fallback = getFallback(options);
  let prepared;
  try {
    prepared = prepare(value);
  } catch (error) {
    if (fallback !== undefined && error[SOFT]) return fallback;
    throw error;
  }
  let scaled = Number(prepared);
  let unit = 0;
  while (Math.abs(scaled) >= 1000 && unit < BYTE_UNITS.length - 1) {
    scaled /= 1000;
    unit++;
  }
  // 999.96 kB rounds to 1000.0 kB: move up a unit instead of printing it.
  const digits = unit === 0 ? 0 : 1;
  if (Math.abs(Number(scaled.toFixed(digits))) >= 1000 && unit < BYTE_UNITS.length - 1) {
    scaled /= 1000;
    unit++;
  }
  const number = formatNumber(scaled, locale, { maximumFractionDigits: unit === 0 ? 0 : 1, ...options });
  return `${number} ${BYTE_UNITS[unit]}`;
}

// ---------------------------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------------------------

const BIDI_MARKS = /[\u200e\u200f\u061c]/g;
const WHITESPACE_GROUPS = [' ', '\u00a0', '\u2009', '\u202f'];
const APOSTROPHE_GROUPS = ["'", '\u2019'];

function invalid(reason) {
  return soft(new TypeError(`Cannot parse text as a number: ${reason}`));
}

function memoise(locale, suffix, create) {
  const key = cacheKey(locale, undefined);
  return remember(parseCache, key === null ? null : `${key}|${suffix}`, create);
}

/**
 * Spaces and apostrophes are interchangeable as group separators: Swiss and French writers mix them,
 * and the locale data changes between Node versions (fr-CH moved from a narrow space to "'").
 */
function groupAliases(group) {
  const family = [...WHITESPACE_GROUPS, ...APOSTROPHE_GROUPS];
  return new Set(family.includes(group) || /^\s$/u.test(group) ? family.concat(group) : [group]);
}

/**
 * Separators, digits and group sizes of a locale, read from Intl so no locale tables are needed.
 * Money and percentages can use different separators from plain numbers (de-AT, fr-CH), so the
 * information is read from a formatter in the style being parsed.
 */
function localeInfo(locale, style, currency) {
  const sample =
    style === 'currency'
      ? { style, currency, maximumFractionDigits: 2 }
      : style === 'percent'
        ? { style, maximumFractionDigits: 1 }
        : undefined;
  const suffix = style === 'currency' ? `info:currency:${currency}` : `info:${style === 'percent' ? 'percent' : 'decimal'}`;
  return memoise(locale, suffix, () => {
    const sampleValue = style === 'percent' ? -1234567890.125 : -123456789012.5;
    // 12 digits with a fraction exposes the decimal, the group separator and every group size.
    const parts = getFormatter(locale, sample).formatToParts(sampleValue);
    let decimal = '.';
    let group = '';
    let minus = '-';
    for (const { type, value } of parts) {
      if (type === 'decimal') decimal = value;
      else if (type === 'group') group = value;
      else if (type === 'minusSign') minus = value.replace(BIDI_MARKS, '');
    }
    // Group sizes come from the plain-number format too: some locales group money differently
    // depending on how it is written (mr-IN: "$१,२३४,५६७" but "१२,३४,५६७ यूएस डॉलर्स").
    const lastSizes = new Set();
    const middleSizes = new Set();
    const plainParts = sample === undefined ? parts : getFormatter(locale, undefined).formatToParts(-123456789012.5);
    for (const source of [parts, plainParts]) {
      const sizes = source.filter((part) => part.type === 'integer').map((part) => part.value.length);
      const last = sizes[sizes.length - 1];
      lastSizes.add(last);
      // India-style grouping (12,34,567) has a different size after the first group. Plain thousands
      // grouping is accepted too: Intl itself uses it in some Indian-locale formats.
      /* c8 ignore next -- every locale groups a 12-digit number; this keeps a hypothetical one safe */
      middleSizes.add(sizes.length > 2 ? sizes[sizes.length - 2] : last);
      middleSizes.add(last);
    }
    const plain = getFormatter(locale, { useGrouping: false });
    const digits = new Map();
    for (let digit = 0; digit < 10; digit++) {
      digits.set(plain.format(digit), String(digit));
      digits.set(String(digit), String(digit)); // people type ASCII digits in any locale
    }
    return { decimal, minus, digits, groups: groupAliases(group), lastSizes, middleSizes };
  });
}

function toAscii(text, info) {
  return [...text].map((ch) => info.digits.get(ch)).join('');
}

/**
 * Currency symbols, codes and names for a currency in a locale, longest first. The English symbols
 * are accepted everywhere because that is what people type: "¥" for yen even where Japanese uses "￥".
 */
function currencyTokens(locale, currency) {
  return memoise(locale, `currency:${currency}`, () => {
    const tokens = new Set([currency]);
    const add = (formatter) => {
      // Names change with the number ("1 dollar", "2 dollars"; Czech and Arabic have more forms).
      for (const amount of [0, 1, 1.5, 2, 3, 5, 11, 100]) {
        for (const part of formatter.formatToParts(amount)) {
          if (part.type === 'currency') tokens.add(part.value.replace(BIDI_MARKS, ''));
        }
      }
    };
    for (const currencyDisplay of ['symbol', 'narrowSymbol', 'code', 'name']) {
      add(getFormatter(locale, { style: 'currency', currency, currencyDisplay }));
    }
    for (const currencyDisplay of ['symbol', 'narrowSymbol']) {
      add(getFormatter('en', { style: 'currency', currency, currencyDisplay }));
    }
    return [...tokens].sort((a, b) => b.length - a.length);
  });
}

function percentTokens(locale) {
  return memoise(locale, 'percent', () => {
    const tokens = new Set(['%']);
    for (const part of getFormatter(locale, { style: 'percent' }).formatToParts(0.5)) {
      if (part.type === 'percentSign') tokens.add(part.value.replace(BIDI_MARKS, ''));
    }
    return [...tokens];
  });
}

/** Compact suffixes ("K", "Mio.", "万") mapped to the power of ten they stand for, longest first. */
function compactTokens(locale, info) {
  return memoise(locale, 'compact', () => {
    const tokens = new Map();
    for (const compactDisplay of ['short', 'long']) {
      const formatter = getFormatter(locale, { notation: 'compact', compactDisplay, maximumFractionDigits: 1 });
      for (let power = 0; power <= 15; power++) {
        // Words change with the number ("1 Million", "2 Millionen", Polish "1,5 tysiąca"), so sample
        // the plural categories of common languages.
        for (const multiplier of [1, 1.5, 2, 3, 5, 11, 21, 100]) {
          const amount = multiplier * 10 ** power;
          const parts = formatter.formatToParts(amount);
          const compact = parts.find((part) => part.type === 'compact');
          if (compact === undefined) continue;
          const integer = parts.find((part) => part.type === 'integer');
          const fraction = parts.find((part) => part.type === 'fraction');
          // French writes 1,000 as just "mille": no number is shown, so it stands for 1.
          const shown =
            integer === undefined
              ? 1
              : Number(`${toAscii(integer.value, info)}.${fraction ? toAscii(fraction.value, info) : '0'}`);
          const token = compact.value.replace(BIDI_MARKS, '');
          if (!tokens.has(token)) tokens.set(token, Math.round(Math.log10(amount / shown)));
        }
      }
    }
    return [...tokens].sort((a, b) => b[0].length - a[0].length);
  });
}

// Tokens keep their original case so slice lengths match; "İ" lower-cases to two characters, which
// would break a comparison done on a lower-cased token.
const startsWithToken = (text, token) => text.slice(0, token.length).toLowerCase() === token.toLowerCase();
const endsWithToken = (text, token) =>
  text.slice(text.length - token.length).toLowerCase() === token.toLowerCase();

/**
 * Removes up to one matching token from each end of `text`. Tokens are optional, and some locales put
 * one at both ends: Turkish writes "$1.234,50 ABD doları".
 */
function stripAffix(text, tokens) {
  let result = text;
  const prefix = tokens.find((token) => startsWithToken(result, token));
  if (prefix !== undefined) result = result.slice(prefix.length).trim();
  const suffix = tokens.find((token) => endsWithToken(result, token));
  if (suffix !== undefined) result = result.slice(0, result.length - suffix.length).trim();
  return result;
}

/** Splits a leading sign off `text`. */
function takeSign(text, info) {
  const first = text[0];
  if (first === '+') return [text.slice(1).trim(), 1];
  if (first === '-' || first === '\u2212' || first === info.minus) return [text.slice(1).trim(), -1];
  return [text, 0];
}

function groupingFits(segments, info, middle) {
  const last = segments.length - 1;
  return segments.every((segment, index) => {
    const size = segment.length;
    if (index === 0) return size >= 1 && size <= Math.max(middle, ...info.lastSizes);
    return index === last ? info.lastSizes.has(size) : size === middle;
  });
}

/** Checks that group separators sit where this locale puts them (1,234,567 or 12,34,567). */
function checkGrouping(segments, info) {
  if (![...info.middleSizes].some((middle) => groupingFits(segments, info, middle))) {
    throw invalid('group separators are in the wrong place for this locale');
  }
}

function parseCore(text, locale, options) {
  const { style, currency, notation } = options || {};
  if (style !== undefined && style !== 'decimal' && style !== 'percent' && style !== 'currency') {
    throw new TypeError(`parse does not support style "${style}"`);
  }
  if (style === 'currency' && (typeof currency !== 'string' || currency === '')) {
    throw new TypeError('Expected a currency code when style is "currency"');
  }
  const resolved = resolveLocale(locale);
  const info = localeInfo(resolved, style, currency);

  if (typeof text !== 'string') {
    const error = new TypeError(`Expected a string, got ${text === null ? 'null' : typeof text}`);
    throw text === null || text === undefined ? soft(error) : error;
  }
  let rest = text.replace(BIDI_MARKS, '').trim();
  if (rest === '') throw invalid('the text is empty');

  // Accounting style: (1,234.50) is negative.
  let sign = 0;
  if (rest.startsWith('(') && rest.endsWith(')')) {
    sign = -1;
    rest = rest.slice(1, -1).trim();
  }
  let leading;
  [rest, leading] = takeSign(rest, info);
  if (leading !== 0 && sign !== 0) throw invalid('the text has two signs');
  sign = sign || leading;

  let exponent = 0;
  if (style === 'currency') rest = stripAffix(rest, currencyTokens(resolved, currency));
  if (style === 'percent') {
    rest = stripAffix(rest, percentTokens(resolved));
    exponent -= 2;
  }
  if (notation === 'compact') {
    for (const [token, power] of compactTokens(resolved, info)) {
      if (endsWithToken(rest, token)) {
        rest = rest.slice(0, rest.length - token.length).trim();
      } else if (startsWithToken(rest, token)) {
        rest = rest.slice(token.length).trim();
      } else {
        continue;
      }
      // A lone word means one of them: French "mille", English "million".
      if (rest === '') rest = '1';
      exponent += power;
      break;
    }
  }
  // A sign may also follow the currency symbol: "$-5.00".
  if (sign === 0) [rest, sign] = takeSign(rest, info);

  let integer = '';
  let fraction = '';
  let hasDecimal = false;
  const segments = [''];
  let position = 0;
  for (const ch of rest) {
    position++;
    const digit = info.digits.get(ch);
    if (digit !== undefined) {
      if (hasDecimal) {
        fraction += digit;
      } else {
        integer += digit;
        segments[segments.length - 1] += digit;
      }
    } else if (ch === info.decimal) {
      if (hasDecimal) throw invalid('the text has more than one decimal separator');
      hasDecimal = true;
    } else if (info.groups.has(ch)) {
      if (hasDecimal) throw invalid('a group separator follows the decimal separator');
      segments.push('');
    } else {
      throw invalid(`unexpected character at position ${position}`);
    }
  }
  if (integer === '' && fraction === '') throw invalid('the text has no digits');
  if (segments.length > 1) checkGrouping(segments, info);

  // The exponent is applied in the string so 25.6% is exactly 0.256, not 0.25600000000000006.
  const value = Number(`${integer || '0'}${fraction ? `.${fraction}` : ''}e${exponent}`);
  if (!Number.isFinite(value)) throw soft(new RangeError('the number is too large'));
  return sign < 0 && value !== 0 ? -value : value;
}

/**
 * Parses localized text such as `'1.234,5'` (de-DE), `'$1,234.50'` or `'1.2K'` into a number.
 *
 * @param {string} text
 * @param {string | string[] | Intl.Locale} [locale='en-US']
 * @param {Intl.NumberFormatOptions & { fallback?: unknown }} [options] The options you would pass to
 *   `format` to produce this text: `style` (`'percent'`, `'currency'` with `currency`) and
 *   `notation: 'compact'` are understood. If `fallback` is present, it is returned instead of throwing
 *   for text that is empty or not a number.
 * @returns {number}
 */
function parse(text, locale, options) {
  assertOptions(options);
  try {
    return parseCore(text, locale, options);
  } catch (error) {
    if (options != null && 'fallback' in options && error[SOFT]) return options.fallback;
    throw error;
  }
}

module.exports = formatNumber;
module.exports.default = formatNumber;
module.exports.formatNumber = formatNumber;
module.exports.createFormatter = createFormatter;
module.exports.currency = currency;
module.exports.percent = percent;
module.exports.compact = compact;
module.exports.signed = signed;
module.exports.bytes = bytes;
module.exports.parse = parse;
