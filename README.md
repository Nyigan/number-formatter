# @towett/number-formatter

[![CI](https://github.com/Nyigan/number-formatter/actions/workflows/ci.yml/badge.svg)](https://github.com/Nyigan/number-formatter/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@towett/number-formatter)](https://www.npmjs.com/package/@towett/number-formatter)

Format numbers for people: thousands separators, currency, percentages, compact (`1.2K`) and file sizes. Locale-aware, zero dependencies, ships TypeScript types. Node 22+, and it works unchanged in browsers.

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
```

TypeScript and ESM imports:

```ts
import format, { createFormatter, currency } from '@towett/number-formatter';
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

### `fallback`

With `fallback` set, the call returns that string instead of throwing when the value is `null`, `undefined`, `NaN`, an infinity or a non-numeric string (`''`, `'N/A'`). Genuine mistakes, such as passing an object or a boolean, still throw.

### Behaviour worth knowing

- **The default locale is always `en-US`**, not the machine's, so output is the same everywhere.
- **Decimals are rounded to 3 places** unless you set `maximumFractionDigits`.
- **`-0` and `'-0'` format as `0`.** A small negative that rounds to zero (`-0.0001`) still prints `-0`; use `maximumFractionDigits` or `signDisplay: 'negative'` if that matters.
- **Numbers above `Number.MAX_SAFE_INTEGER` lose precision** in JavaScript itself. Pass a `bigint` or a numeric string to keep every digit.
- **Formatters are cached** per locale and options, so repeated calls are cheap. With options set, 300,000 calls took about 0.4 s against about 13 s for plain `toLocaleString`. Without options, V8 already caches, so there is no difference.

### Errors

| Condition | Error |
|---|---|
| `value` is not a number, bigint or numeric string | `TypeError` |
| `value` is `null` or `undefined` | `TypeError` (unless `fallback` is set) |
| `value` is `NaN` or infinite, including `'1e999'` | `RangeError` (unless `fallback` is set) |
| `options` is not an object, `fallback` is not a string, `locale` has the wrong type | `TypeError` |
| Invalid locale or option value | `RangeError` (from `Intl`) |

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
