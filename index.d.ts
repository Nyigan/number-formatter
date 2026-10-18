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

  interface ParseBytesOptions {
    /** Read `KB`, `MB`... as 1024-based. `KiB`, `MiB`... are always 1024-based. */
    binary?: boolean;
  }

  /**
   * Reads a file size such as `'1.5 MB'` or `'1,5 Ko'` into a number of bytes: `B`, `kB` to `PB`
   * (1000-based), `KiB` to `PiB` (1024-based), their English names, and the locale's own names. Text
   * without a unit is bytes. The result is not rounded. Throws a `TypeError` for text that is not a size
   * (`'5 Mb'` is megabits, so it is refused); with `fallback`, returns that value instead.
   */
  function parseBytes<T>(
    text: string | null | undefined,
    locale: Locale | undefined,
    options: ParseBytesOptions & { fallback: T }
  ): number | T;
  function parseBytes(text: string, locale?: Locale, options?: ParseBytesOptions | null): number;

  /**
   * Builds a reusable parser. Locale and options are validated and looked up once, up front, and read
   * when it is created.
   */
  function createParser<T>(
    locale: Locale | undefined,
    options: Intl.NumberFormatOptions & { fallback: T }
  ): (text: string | null | undefined) => number | T;
  function createParser(locale?: Locale, options?: Intl.NumberFormatOptions | null): (text: string) => number;

  /** The pieces of the formatted number, for styling them separately. A `fallback` gives one `literal` part. */
  function formatToParts(
    value: Value | null | undefined,
    locale: Locale | undefined,
    options: OptionsWithFallback
  ): Intl.NumberFormatPart[];
  function formatToParts(value: Value, locale?: Locale, options?: Options | null): Intl.NumberFormatPart[];

  /** `formatRange(1000, 2000)` -> `1,000–2,000`. Equal ends give `~1,000`. */
  function formatRange(
    start: Value | null | undefined,
    end: Value | null | undefined,
    locale: Locale | undefined,
    options: OptionsWithFallback
  ): string;
  function formatRange(start: Value, end: Value, locale?: Locale, options?: Options | null): string;

  interface BytesOptions extends Options {
    /** 1024-based units labelled `KiB`, `MiB`... instead of 1000-based `kB`, `MB`... */
    binary?: boolean;
    /** `'long'` gives localized names ("1.5 kilobytes"); decimal units only. */
    unitDisplay?: 'short' | 'long';
  }

  /** `bytes(1536)` -> `1.5 kB`; `bytes(1536, 'en', { binary: true })` -> `1.5 KiB`. Decimal units, B to PB; the unit label is not localised. */
  function bytes(value: Value | null | undefined, locale: Locale | undefined, options: BytesOptions & { fallback: string }): string;
  function bytes(value: Value, locale?: Locale, options?: BytesOptions | null): string;

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
    parseBytes,
    createParser,
    formatToParts,
    formatRange,
    BytesOptions,
    ParseBytesOptions,
  };
}

declare function formatNumber(value: formatNumber.Value | null | undefined, locale: formatNumber.Locale | undefined, options: formatNumber.OptionsWithFallback): string;
declare function formatNumber(value: formatNumber.Value, locale?: formatNumber.Locale, options?: formatNumber.Options | null): string;

export = formatNumber;
