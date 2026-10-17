# Changelog

## 1.3.0

Versions 1.2.1 and Unreleased were never published; everything from them is part of this release.

### Added
- `createParser(locale, options)`: a reusable parser that validates and looks up locale data once.
- `formatToParts(value, locale, options)`: the pieces of the formatted number, for styling them separately.
- `formatRange(start, end, locale, options)`: `1,000–2,000`, `5,00–10,00 €`, `~5`.
- `bytes` options: `binary: true` for 1024-based `KiB`/`MiB`..., and `unitDisplay: 'long'` for localized names such as "1.5 kilobytes".
- A playground at `playground/index.html`: one-click examples, then three labelled steps (your number, who will read it, how it should look). It shows the result with each part coloured, explains mistakes in plain language, and gives the exact code to copy. It can also read text back into a number. Works offline from the repo; GitHub Pages serves it at `/playground/`.
- README sections "Recipes" (every snippet is run by `test/recipes.test.js`) and "How it compares" (with `toLocaleString`, `numeral` and `accounting`, from running the same inputs through each).
- Project checks: `npm run check:size` (package size and file list), `check:speed` (speed relative to plain `Intl`, independent of the machine), `check:lock` (package-lock.json matches package.json) and a Chromium browser test (`test:browser`) that also opens the playground. CI runs them; the size and lock checks also run before publishing.
- Release workflow: pushing a `v*` tag runs the tests and publishes to npm with provenance, then creates the GitHub release from this changelog. A weekly workflow runs the tests on the newest Node and the current LTS to catch locale data changes early.
- `SECURITY.md`, `CONTRIBUTING.md`, issue and pull request templates, and Dependabot for the dev tooling and GitHub Actions.
- Randomised tests for `parse` with a seeded generator, and regression tests for every bug listed under Fixed.

### Changed
- A negative number that rounds to zero (`-0.0001`) now formats as `0` instead of `-0`, for plain numbers, currency (including accounting style), percent and `bytes`. This is done by defaulting `signDisplay` to `'negative'`; a `signDisplay` you pass is respected, so `signDisplay: 'auto'` brings the old output back.

### Fixed
- `bytes`: asking for `minimumFractionDigits: 2` now gives `1.50 kB` instead of throwing, and the unit only rolls over (`999.96 kB` to `1 MB`) when the decimals actually shown round up to 1000.
- Options set to `undefined` (for example `{ signDisplay: undefined }`) no longer switch off the preset of `percent`, `compact`, `signed`, `bytes` or `currency`.
- Options that cannot be serialised (circular references, `BigInt` values) no longer fail with a JSON error; they behave as `Intl` does.
- `parse` reads numbering systems whose digits are outside the Basic Multilingual Plane (such as Adlam).
- `parse` accepts a trailing minus in locales that write it there (Frisian money, `fy`), and nowhere else.
- `parse` reads currency names for whole amounts and for the other plural forms (Czech, Polish, Russian, Arabic, Welsh, Breton, Catalan and more), including zero-decimal currencies shown with decimals.
- Across all 609 locales in Node 22 and 24, text from `format` reads back to the same number, except 18 cases where ICU's own data is inconsistent (Nepali long and Tongan short compact words). Those are reported as errors, never as a wrong number.

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
