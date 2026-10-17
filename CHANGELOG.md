# Changelog

## 1.2.0

### Added
- `parse(text, [locale], [options])`: the inverse of `format`. Reads each locale's separators and digits, signs and accounting parentheses, and with the matching `options` also currency symbols, codes and names, percent signs and compact words (`1.2K`, `3,5 Mio.`, `200万`). Ambiguous or malformed text throws a `TypeError` instead of returning a wrong number; `fallback` returns any value you choose instead. `parse(format(x, l, o), l, o)` returns `x`, tested across 50 locales.

## 1.1.0

### Added
- Numeric strings are accepted as input (`'1234.50'`, `'-1e3'`). Other strings still throw a `TypeError`. Long decimal strings keep every digit.
- `fallback` option: returns a placeholder instead of throwing for `null`, `undefined`, `NaN`, infinities and non-numeric strings.
- `createFormatter(locale, options)` returns a reusable `(value) => string` and validates its arguments up front.
- Presets: `currency`, `percent`, `compact`, `signed` and `bytes`.
- Type tests (`npm run test:types`), run in CI.
- Optional ways to support the project: `funding` in `package.json` (shown by `npm fund`), a README section and a GitHub Sponsor button. The package stays free; nothing is printed at install or run time.

### Fixed
- Formatter cache: `Intl.Locale` objects and options with inherited properties could be served another call's formatter. Those calls now bypass the cache.
- A `locale` of the wrong type (for example `42`) now throws a `TypeError` instead of silently using the system locale.

## 1.0.0

### Breaking
- Non-number input now throws a `TypeError` (previously `'1234'`, arrays, dates and objects were passed through `toString`, and `null`/`undefined` threw an unhelpful error).
- `NaN`, `Infinity` and `-Infinity` now throw a `RangeError` instead of returning `'NaN'` / `'∞'`.
- The default locale is now always `en-US` instead of the machine's locale. An empty or `null` locale also uses it.
- `-0` is formatted as `'0'`.
- Requires Node 22 or newer (was `>=4.2.4`).

### Added
- Third `options` argument, passed to `Intl.NumberFormat`.
- `bigint` support.
- TypeScript types and an `exports` map. `format.default` and `format.formatNumber` are also exported.
- Formatter caching for repeated calls.

### Removed
- All 8 runtime dependencies (`boom`, `browser-stdout`, `glob-parent`, `handlebars`, `hoek`, `minimist`, `tough-cookie`, `y18n`). None were used, and several had known vulnerabilities.
- Test files and editor/CI config from the published tarball. Only `index.js`, `index.d.ts`, README, LICENSE and package.json ship.

### Tooling
- Tests moved to Node's built-in runner with 100% coverage via `c8`; Travis, Buddy, mocha, chai, istanbul and coveralls dropped in favour of GitHub Actions on Node 22 and 24.
