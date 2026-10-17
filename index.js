'use strict';

const DEFAULT_LOCALE = 'en-US';
const MAX_CACHED_FORMATTERS = 100;
const NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

/** Marks errors caused by "no usable value", which a `fallback` option is allowed to replace. */
const SOFT = Symbol('soft');

/** @type {Map<string, Intl.NumberFormat>} */
const cache = new Map();

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

function getFormatter(locale, options) {
  const key = cacheKey(locale, options);
  if (key === null) return new Intl.NumberFormat(locale, options);
  let formatter = cache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, options);
    if (cache.size >= MAX_CACHED_FORMATTERS) {
      // Evict the oldest entry so unusual option combinations cannot grow the cache forever.
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, formatter);
  }
  return formatter;
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

module.exports = formatNumber;
module.exports.default = formatNumber;
module.exports.formatNumber = formatNumber;
module.exports.createFormatter = createFormatter;
module.exports.currency = currency;
module.exports.percent = percent;
module.exports.compact = compact;
module.exports.signed = signed;
module.exports.bytes = bytes;
