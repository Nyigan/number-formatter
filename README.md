# @towett/number-formatter

[![CI](https://github.com/Nyigan/number-formatter/actions/workflows/ci.yml/badge.svg)](https://github.com/Nyigan/number-formatter/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@towett/number-formatter)](https://www.npmjs.com/package/@towett/number-formatter)

Format numbers for people, and read them back: thousands separators, currency, percentages, compact (`1.2K`) and file sizes. Locale-aware, zero dependencies, ships TypeScript types. Node 22+, and it works unchanged in browsers.

**[Try it in your browser](https://nyigan.github.io/number-formatter/playground/)** — type a number, pick a locale and options, and see the result.

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
format.bytes(1536, 'en', { binary: true });  // '1.5 KiB'
format.formatRange(1000, 2000);     // '1,000–2,000'

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
format.parseBytes('1.5 MB');              // 1500000  (file sizes back into bytes)
format.parseBytes('1,5 MiB', 'de-DE');    // 1572864

// Parsing a whole column: validate once, reuse.
const toEuros = format.createParser('de-DE', { style: 'currency', currency: 'EUR' });
['1,50 €', '€ 1.000,00', '(2,25 €)'].map(toEuros);   // [1.5, 1000, -2.25]
```

TypeScript and ESM imports:

```ts
import format, { createFormatter, createParser, currency, parse } from '@towett/number-formatter';
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

`bytes` uses decimal units (1 kB = 1000 B) from `B` to `PB`, rounds to one decimal and moves up a unit instead of printing `1000 kB`. The short labels are not localised; the number is. Two extra options:

| Option | Result |
|---|---|
| `{ binary: true }` | 1024-based units labelled `KiB`, `MiB`, ... `PiB`: `bytes(1536, 'en', { binary: true })` is `1.5 KiB`. |
| `{ unitDisplay: 'long' }` | Localized names from `Intl`: `1.5 kilobytes`, `1,5 Kilobyte`, `1.5 キロバイト`. Decimal units only. |

### `format.formatToParts(value, [locale], [options])`

The same as `format`, but returns the pieces (`integer`, `group`, `decimal`, `currency`, `minusSign`, ...) so you can style them separately, for example a smaller fraction:

```js
format.formatToParts(1234.56, 'en-US', { style: 'currency', currency: 'USD' })
  .map((part) => (part.type === 'fraction' ? `<small>${part.value}</small>` : part.value))
  .join('');                        // '$1,234.<small>56</small>'
```

With a `fallback`, a missing value gives one `literal` part.

### `format.formatRange(start, end, [locale], [options])`

Writes a range the way the locale does: `formatRange(1000, 2000)` is `1,000–2,000`, `formatRange(5, 10, 'de-DE', { style: 'currency', currency: 'EUR' })` is `5,00–10,00 €`, and equal ends give `~5`. Both ends follow the rules of `format`; with a `fallback`, either end missing returns it.

### `format.createParser([locale], [options])`

Returns `(text) => number`. The locale and options are validated and the locale data looked up once, when you create it, so a typo fails at startup and parsing a long column is as cheap as it can be. The options are read when the parser is created; changing the object afterwards has no effect.

### `fallback`

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

A minus sign after the number (`5-`) is read only in locales that write it there, such as Frisian money; elsewhere it is an error. Across every locale in Node 22 and 24, 18 cases fail to read back because ICU's own compact-notation data is inconsistent (Nepali long and Tongan short words); `parse` reports those as errors instead of guessing.

### `fallback`

With `fallback` set, the call returns that string instead of throwing when the value is `null`, `undefined`, `NaN`, an infinity or a non-numeric string (`''`, `'N/A'`). Genuine mistakes, such as passing an object or a boolean, still throw.

### `format.parseBytes(text, [locale], [options])`

Reads a file size back into a number of bytes: the inverse of `format.bytes`. `'1.5 MB'` is `1500000`, `'1,5 MiB'` in `de-DE` is `1572864`.

| Argument | Notes |
|---|---|
| `text` | A number and a unit: `'1.5 MB'`, `'300kB'`, `'2 GiB'`, `'1.5 megabytes'`. Text with no unit is bytes. |
| `locale` | Same as `parse`: it decides what `1,5` and `1.234` mean, and which local unit names are understood. |
| `options` | `{ binary: true }` reads `KB`, `MB`... as 1024-based. `{ fallback }` is returned instead of throwing, as for `parse`. |

Units:

- **`B`, `kB` (or `KB`), `MB`, `GB`, `TB`, `PB`** are 1000-based, the same as `format.bytes` writes them.
- **`KiB`, `MiB`, `GiB`, `TiB`, `PiB`** are always 1024-based, whatever `binary` says. So `parseBytes(format.bytes(n, locale, { binary: true }), locale)` needs no options.
- **Names:** English (`kilobytes`, `mebibytes`) and the locale's own (`Kilobyte` in German, `ko` in French, `キロバイト` in Japanese).
- Case does not matter (`1.5 mb`), and the space before the unit is optional.
- **`Mb`, `Gb`, `Kib` and the like are refused.** A capital letter followed by a lowercase `b` conventionally means bits, and reading it as bytes would be wrong by a factor of eight. Write `MB` for bytes; all-lowercase `mb` and `kb` are read as bytes, as people write them.

The result is not rounded: `'0.5 B'` is `0.5`. Decimal units are exact (`'1.1 kB'` is `1100`, not `1100.0000000000002`). A size that does not fit a number (hundreds of digits) throws a `RangeError`, or gives the `fallback`.

```js
format.parseBytes('1.5 MB');                                   // 1500000
format.parseBytes('1.5 MB', 'en-US', { binary: true });        // 1572864
format.parseBytes('1.5 MiB');                                  // 1572864
format.parseBytes('1,5 Kilobyte', 'de-DE');                    // 1500
format.parseBytes('5 Mb');                                     // throws: megabits, not megabytes
format.parseBytes('lots', 'en-US', { fallback: null });        // null
```

Text must contain a number: a bare unit such as `'MB'` is an error. (One older ICU build, in Node 22.0, writes a single megabyte in Hebrew as the bare word; that form is not read.)

`format.bytes` rounds, so a round trip returns the size as written, not the original: `parseBytes(format.bytes(1536))` is `1500`. With enough decimals, or for sizes that are exact in the unit, it is the same number.

### Behaviour worth knowing

- **The default locale is always `en-US`**, not the machine's, so output is the same everywhere.
- **Decimals are rounded to 3 places** unless you set `maximumFractionDigits`.
- **Negative zero never prints.** `-0`, `'-0'` and tiny negatives that round to zero (`-0.0001`) all format as `0`. This works by defaulting `signDisplay` to `'negative'`; pass your own `signDisplay` to get something else.
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

## Recipes

Every snippet here is run by the test suite (`test/recipes.test.js`), so the outputs are real.

**Table columns.** Build the formatter once, then map over the rows. Fixed decimals keep a column aligned; add `font-variant-numeric: tabular-nums; text-align: right` in CSS.

```js
const price = format.createFormatter('en-US', { style: 'currency', currency: 'USD' });
[1234.5, 99, 0.5].map(price);          // ['$1,234.50', '$99.00', '$0.50']

const cell = format.createFormatter('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
[1234.5, 99, 0.5].map(cell);           // ['1,234.50', '99.00', '0.50']
```

**Missing data.** Put `fallback` in the options and `null`, `undefined`, `NaN`, infinities and text like `'n/a'` all become your placeholder. Objects and booleans still throw, because those are bugs.

```js
const total = format.createFormatter('en-US', { fallback: '—' });
[total(1200), total(null), total(undefined), total('n/a')];   // ['1,200', '—', '—', '—']
```

**Form fields.** Read what people typed in their own locale. With `fallback: null` an invalid field gives `null` to test for, rather than an exception to catch.

```js
const readPrice = format.createParser('de-DE', { style: 'currency', currency: 'EUR', fallback: null });
readPrice('1.234,50 €');   // 1234.5
readPrice('oops');         // null
readPrice('');             // null
```

Store the number, not the formatted text, and format it again when you show it. Without `fallback`, ambiguous text such as `'12,3,4'` throws a `TypeError` whose message says what was wrong, which is useful for an error message.

**Money held in cents.** Divide at the last moment, only for display.

```js
format.currency(1999 / 100, 'USD');    // '$19.99'
```

**Gains and losses.** `signDisplay` is passed to `Intl`, so `exceptZero` shows `+` on gains, `-` on losses and nothing on zero.

```js
format.percent(0.0512, 'en-US', { signDisplay: 'exceptZero' });    // '+5%'
format.percent(-0.0512, 'en-US', { signDisplay: 'exceptZero' });   // '-5%'
```

**Styling the decimals.** `formatToParts` gives the pieces, so you can wrap just the cents.

```js
format.formatToParts(1234.56, 'en-US')
  .map((part) => (part.type === 'fraction' ? `<small>${part.value}</small>` : part.value))
  .join('');                           // '1,234.<small>56</small>'
```

**File sizes and ranges.**

```js
format.bytes(5242880);                                           // '5.2 MB'
format.parseBytes('5.2 MB');                                     // 5200000
format.bytes(1536, 'de-DE', { unitDisplay: 'long' });            // '1,5 Kilobyte'
format.formatRange(10, 20, 'en-US', { style: 'currency', currency: 'USD' });   // '$10.00 – $20.00'
```

**The user's own locale.** In a browser, `format(n, navigator.language)` matches what they expect. A locale tag that `Intl` rejects throws a `RangeError`, so for tags from a request header or a form, check first:

```js
function safeLocale(tag) {
  try { return Intl.getCanonicalLocales(tag)[0]; } catch { return 'en-US'; }
}
format(1234.5, safeLocale(userTag));
```

## How it compares

Checked on 17 October 2026 by running the same inputs through `numeral` 2.0.6, `accounting` 0.4.1 and this package on Node 22.22, and by reading each package's npm release history. Sizes are the minified file after `gzip -9`; this package was minified with esbuild.

| | `toLocaleString` / `Intl` | this package | `numeral` | `accounting` |
|---|---|---|---|---|
| Still maintained | part of the platform | yes | last release March 2017 | last release July 2014 |
| Locale rules | built in | built in (it uses `Intl`) | load locale files first; choosing one that was not loaded threw a `TypeError` | pass the separators yourself on every call |
| Read text back into a number | no | `parse`, per locale; ambiguous text throws | `.value()`; `'1.234,56'` gives `1.23456` under the English settings | `unformat`; `'1.234,56'` gives `1.23456` unless you pass the decimal character |
| `null` | `'0'` | `TypeError`, or your `fallback` | `'0'` | `'0'` |
| `'12ab'` | `'NaN'` | `TypeError`, or your `fallback` | `'12'` | `'12'` |
| `9007199254740993n` | exact | exact | `9,007,199,254,740,992` (rounded) | `9,007,199,254,740,992` (rounded) |
| TypeScript types | in TypeScript's own library | bundled | separate `@types/numeral` | separate `@types/accounting` |
| Size, minified and gzipped | 0 | 3.8 kB | 4.0 kB (no locale files) | 1.3 kB |
| Dependencies | none | none | none | none |

**Speed.** Formatting a euro amount for `de-DE` took about 45.6 µs per call with `toLocaleString('de-DE', options)`, because it builds a new formatter every time, against 1.4 µs here, where formatters are cached. The picture is different without options: plain `n.toLocaleString('de-DE')` took 0.48 µs, faster than this package at 1.07 µs, because V8 caches that case itself. Your numbers will differ, so run `npm run check:speed` for the ratios on your machine.

**When plain `Intl` is enough.** If you only turn numbers into text, always have a valid number, and hold on to one `Intl.NumberFormat` per locale and style, you do not need this package. It earns its place when you also read text back, when values may be missing or bad and you want a placeholder or a clear error, when you want the same `-0` and rounding behaviour everywhere, or when you want ready-made `bytes`, `compact` and `signed` helpers without writing them again.

## Development

```sh
npm install
npm test          # node's built-in test runner
npm run cover     # c8, requires 100% coverage
npm run test:types
npm run check:lock    # fails if package-lock.json is out of step with package.json
npm run check:size    # fails if the published package grows past its limit
npm run check:speed   # fails if formatting gets slower relative to plain Intl
npm run test:browser:install && npm run test:browser   # Chromium, optional
```

The playground in `playground/` is a plain HTML page with no build step. Open it from disk, or from GitHub Pages, and it loads `../index.js`.

## Support

This package is free and MIT-licensed, and it never prints messages or tracks anything. If it saves you time, here are two optional ways to say thanks:

- **Spread the word.** A mention in your team chat, a post, or a ⭐ on [GitHub](https://github.com/Nyigan/number-formatter) helps other developers find it.
  [Share on X](https://twitter.com/intent/tweet?text=Zero-dependency%20number%20formatting%20for%20Node%20and%20the%20browser%3A%20currency%2C%20compact%2C%20bytes%2C%20locales.&url=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40towett%2Fnumber-formatter)
  · [Share on LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40towett%2Fnumber-formatter)
- **Shop with me.** My [Etsy shop](https://www.etsy.com/shop/FrankForgeCo) sells editable Canva templates for invitations, flyers and forms. Every sale helps fund the time I spend maintaining this package.

Bug reports, ideas and pull requests are just as welcome; see [CONTRIBUTING](https://github.com/Nyigan/number-formatter/blob/master/CONTRIBUTING.md). Thank you!

## License

MIT
