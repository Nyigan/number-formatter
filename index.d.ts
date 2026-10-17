declare namespace formatNumber {
  type Locale = string | readonly string[] | Intl.Locale | null;

  interface Options extends Intl.NumberFormatOptions {
    /**
     * Returned instead of throwing when the value is `null`, `undefined`, `NaN`, an infinity or a
     * non-numeric string. Wrong types (objects, booleans, ...) still throw.
     */
    fallback?: string;
  }

  type OptionsWithFallback = Options & { fallback: string };
  type Value = number | bigint | string;

  /** A formatter with the locale and options fixed. */
  interface Formatter {
    (value: Value): string;
  }
  interface FallbackFormatter {
    (value: Value | null | undefined): string;
  }
  function createFormatter(locale: Locale | undefined, options: OptionsWithFallback): FallbackFormatter;
  function createFormatter(locale?: Locale, options?: Options | null): Formatter;

  /** `currency(1234.5, 'USD')` -> `$1,234.50`. */
  function currency(value: Value, currency: string, locale?: Locale, options?: Options | null): string;
  /** `percent(0.256)` -> `26%`. The value is a fraction. */
  function percent(value: Value, locale?: Locale, options?: Options | null): string;
  /** `compact(1234567)` -> `1.2M`. */
  function compact(value: Value, locale?: Locale, options?: Options | null): string;
  /** `signed(12)` -> `+12`. */
  function signed(value: Value, locale?: Locale, options?: Options | null): string;
  /**
   * Parses localized text such as `'1.234,5'` (de-DE), `'$1,234.50'` or `'1.2K'` into a number.
   * Pass the options you used to format the text: `style: 'percent'`, `style: 'currency'` with
   * `currency`, and `notation: 'compact'` are understood. Throws a `TypeError` for text that is not
   * a number; with `fallback`, returns that value instead (any type, including `NaN` or `null`).
   */
  function parse<T>(
    text: string | null | undefined,
    locale: Locale | undefined,
    options: Intl.NumberFormatOptions & { fallback: T }
  ): number | T;
  function parse(text: string, locale?: Locale, options?: Intl.NumberFormatOptions | null): number;

  /** `bytes(1536)` -> `1.5 kB`. Decimal units, B to PB; the unit label is not localised. */
  function bytes(value: Value, locale?: Locale, options?: Options | null): string;

  export {
    formatNumber as default,
    formatNumber,
    Locale,
    Options,
    OptionsWithFallback,
    Value,
    Formatter,
    FallbackFormatter,
    createFormatter,
    currency,
    percent,
    compact,
    signed,
    bytes,
    parse,
  };
}

declare function formatNumber(value: formatNumber.Value | null | undefined, locale: formatNumber.Locale | undefined, options: formatNumber.OptionsWithFallback): string;
declare function formatNumber(value: formatNumber.Value, locale?: formatNumber.Locale, options?: formatNumber.Options | null): string;

export = formatNumber;
