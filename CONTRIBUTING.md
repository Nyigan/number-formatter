# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

This package aims to stay **small, dependency-free and honest**. A new feature should do something that plain `Intl.NumberFormat` does not already do easily. If you are unsure, open an issue first and describe the problem you are solving.

## Setup

```sh
git clone https://github.com/Nyigan/number-formatter.git
cd number-formatter
npm install          # needs Node 22 or newer
npm test             # node's built-in test runner
npm run cover        # c8; the build fails below 100% coverage
npm run test:types   # compiles the TypeScript declarations
npm run check:lock    # package-lock.json must match package.json (fix: npm install --package-lock-only)
npm run check:size    # the published package must stay small and contain only the expected files
npm run check:speed   # formatting must stay close to plain Intl in speed
```

## Making a change

1. Write the test first, including the error cases. Tests must not hard-code locale data that changes between Node versions; derive expectations from `Intl` or test behaviour that every version agrees on.
2. Keep `index.js`, `index.d.ts` and the README in step.
3. Add a line to `CHANGELOG.md` under a new version heading.
4. Run all three commands above. They also run in CI on Node 22 and 24.

## Releasing (maintainers)

```sh
npm version patch      # or minor / major: edits package.json and creates the tag
git push --follow-tags
```

The `Release` workflow publishes to npm with provenance and creates the GitHub release from the changelog. It needs the `NPM_TOKEN` repository secret.
