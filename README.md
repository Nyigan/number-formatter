# @towett/number-formatter

[![CI](https://github.com/Nyigan/number-formatter/actions/workflows/ci.yml/badge.svg)](https://github.com/Nyigan/number-formatter/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@towett/number-formatter)](https://www.npmjs.com/package/@towett/number-formatter)

Format numbers for people, and read them back: thousands separators, currency, percentages, compact (`1.2K`) and file sizes. Locale-aware, zero dependencies, ships TypeScript types. Node 22+, and it works unchanged in browsers.

## Install

```sh
npm install @towett/number-formatter
```

## Usage

```js
const format = require('@towett/number-formatter');

format(35666);                      // '35,666'
format(-1234567);                   // '-1,234,567'
format('1234.50');                  // '1,234.5'        numeric strings work
format(12345678901234567890n);      // '12,345,678,901,234,567,890'
format(1234567.891, 'de-DE');       // '1.234.567,891'
format(1234567, 'en-IN');           // '12,34,567'
format(1234.5, 'en-US', { minimumFractionDigits: 2 }); // '1,234.50'

format.currency(1234.5, 'USD');     // '$1,234.50'
format.percent(0.256);              // '26%'
format.compact(1234567);            // '1.2M'
format.signed(12);                  // '+12'
format.bytes(1536);                 // '1.5 kB'

// Missing data in a UI: return a placeholder instead of throwing.
format(null, 'en-US', { fallback: '—' });   // '—'

// A formatter with everything fixed, for lists and loops.
const euros = format.createFormatter('de-DE', { style: 'currency', currency: 'EUR' });
euros(1234.5);                      // '1.234,50 €'

// And back again: text people type or paste, read in their locale.
format.parse('1.234.567,891', 'de-DE');   // 1234567.891
format.parse('1,234.50');                 // 1234.5
format.parse('$1,234.50', 'en-US', { style: 'currency', currency: 'USD' }); // 1234.5
format.parse('25.6%', 'en-US', { style: 'percent' });                        // 0.256
format.parse('1.2K', 'en-US', { notation: 'compact' });                      // 1200
format.parse('abc', 'en-US', { fallback: NaN });                             // NaN
```

TypeScript and ESM imports:

```ts
import format, { createFormatter, currency, parse } from '@towett/number-formatter';
```

## API

### `format(value, [locale], [options])`

| Argument | Type | Notes |
|---|---|---|
| `value` | `number \| bigint \| string` | Must be finite. Strings must be plain decimal numbers (`'1234.5'`, `'-1e3'`), not `'1,234'`. |
| `locale` | `string \| string[] \| Intl.Locale` | BCP 47 tag. `undefined`, `null` and `''` use `'en-US'`. |
| `options` | `Intl.NumberFormatOptions & { fallback?: string }` | Passed to `Intl.NumberFormat`. `fallback` is described below. |

Returns a string.

### `format.createFormatter([locale], [options])`

Returns `(value) => string`. The locale and options are validated once, when you create it, so a typo fails at startup instead of on first render. Best for loops and table rendering.

### Presets

All take `(value, [locale], [options])`, except `currency`, which takes the currency code second. Your `options` override a preset's defaults, except `style` and `currency` for `format.currency`.

| Preset | Example | Result |
|---|---|---|
| `format.currency(value, code, [locale], [options])` | `currency(1234.5, 'EUR', 'de-DE')` | `1.234,50 €` |
| `format.percent(value, ...)` | `percent(0.256)` | `26%` (the value is a fraction) |
| `format.compact(value, ...)` | `compact(1234567)` | `1.2M` |
| `format.signed(value, ...)` | `signed(12)` | `+12` (zero stays `0`) |
| `format.bytes(value, ...)` | `bytes(1536)` | `1.5 kB` |

`bytes` uses decimal units (1 kB = 1000 B) from `B` to `PB`, rounds to one decimal and moves up a unit instead of printing `1000 kB`. The unit labels are not localised; the number is.

### `format.parse(text, [locale], [options])`

Turns localized text into a number: the inverse of `format`. `Number('1,234.5')` is `NaN` and `parseFloat('1.234,5')` is `1.234`; `parse` reads each locale's own separators and digits.

| Argument | Notes |
|---|---|
| `text` | A string such as `'1.234,5'`, `'(1,234.50)'`, `'-5'`, `'١٬٢٣٤'`. |
| `locale` | Same as `format`. **This decides what `1,234` means**: 1234 in `en-US`, 1.234 in `de-DE`. |
| `options` | The options you used to format the text. `style: 'percent'`, `style: 'currency'` with `currency`, and `notation: 'compact'` are understood. Other formatting options are ignored. `style: 'unit'` is not supported. |

What it accepts:

- **Group and decimal separators of the locale**, with the locale's digits or ASCII digits. Spaces and apostrophes are interchangeable as group separators (Swiss and French writers mix them).
- **Signs:** `-`, `−`, `+`, and accounting parentheses `(1,234.50)` for negatives.
- **Currency symbols, codes and names** when you pass `style: 'currency'`. They are optional, and the English symbols (`¥`, `€`, `$`) are always accepted.
- **Percent signs** with `style: 'percent'`. The result is a fraction: `'26%'` gives `0.26`, and so does `'26'`.
- **Compact words** with `notation: 'compact'`: `1.2K`, `3,5 Mio.`, `200万`, `2 million`, case-insensitively.

What it rejects, with a `TypeError` that says what is wrong but never repeats your text: empty text, stray characters, two decimal separators, and group separators in the wrong place (`'1,23'` in `en-US`). This is deliberate. A user in Germany typing `1,5` into an `en-US` field gets an error and not a silent `15`.

Pass `fallback` to get a value instead of an exception for text that is not a number. Unlike `format`, the fallback can be any value: `NaN`, `null`, `0`, a string.

```js
format.parse('1,23');                              // throws TypeError
format.parse('1,23', 'en-US', { fallback: null }); // null
format.parse('1234.5', 'de-DE');                   // throws: '.' is a group separator there
```

`parse(format(x, locale, options), locale, options)` returns `x` for the supported options. This is tested across 50 locales, including currencies in every display style, percent and compact notation.

### `fallback`

With `fallback` set, the call returns that string instead of throwing when the value is `null`, `undefined`, `NaN`, an infinity or a non-numeric string (`''`, `'N/A'`). Genuine mistakes, such as passing an object or a boolean, still throw.

### Behaviour worth knowing

- **The default locale is always `en-US`**, not the machine's, so output is the same everywhere.
- **Decimals are rounded to 3 places** unless you set `maximumFractionDigits`.
- **`-0` and `'-0'` format as `0`.** A small negative that rounds to zero (`-0.0001`) still prints `-0`; use `maximumFractionDigits` or `signDisplay: 'negative'` if that matters.
- **Numbers above `Number.MAX_SAFE_INTEGER` lose precision** in JavaScript itself. Pass a `bigint` or a numeric string to keep every digit.
- **`parse` follows the locale data of the Node version or browser it runs in.** Locale data is updated between releases (for example, Swiss-French money moved from a narrow space to `'` in newer versions), so text that you store and parse later should be parsed with the same options, or normalised first.
- **`parse` returns a JavaScript number**, so more than about 15 significant digits lose precision. Compact words and percents are applied exactly: `'25.6%'` is exactly `0.256`.
- **Formatters are cached** per locale and options, so repeated calls are cheap. With options set, 300,000 calls took about 0.4 s against about 13 s for plain `toLocaleString`. Without options, V8 already caches, so there is no difference.

### Errors

| Condition | Error |
|---|---|
| `value` is not a number, bigint or numeric string | `TypeError` |
| `value` is `null` or `undefined` | `TypeError` (unless `fallback` is set) |
| `value` is `NaN` or infinite, including `'1e999'` | `RangeError` (unless `fallback` is set) |
| `options` is not an object, `fallback` is not a string, `locale` has the wrong type | `TypeError` |
| Invalid locale or option value | `RangeError` (from `Intl`) |
| `parse`: `text` is not a string | `TypeError` (`null` and `undefined` count as missing text, which `fallback` covers) |
| `parse`: text is empty or not a number | `TypeError` (unless `fallback` is set) |
| `parse`: more digits than a number can hold | `RangeError` (unless `fallback` is set) |

## Development

```sh
npm install
npm test          # node's built-in test runner
npm run cover     # c8, requires 100% coverage
npm run test:types
```

## Support

This package is free and MIT-licensed, and it never prints messages or tracks anything. If it saves you time, here are two optional ways to say thanks:

- **Spread the word.** A mention in your team chat, a post, or a ⭐ on [GitHub](https://github.com/Nyigan/number-formatter) helps other developers find it.
  [Share on X](https://twitter.com/intent/tweet?text=Zero-dependency%20number%20formatting%20for%20Node%20and%20the%20browser%3A%20currency%2C%20compact%2C%20bytes%2C%20locales.&url=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40towett%2Fnumber-formatter)
  · [Share on LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40towett%2Fnumber-formatter)
- **Shop with me.** My [Etsy shop](https://www.etsy.com/shop/FrankForgeCo) sells editable Canva templates for invitations, flyers and forms. Every sale helps fund the time I spend maintaining this package.

Bug reports, ideas and pull requests are just as welcome. Thank you!

## License

MIT
