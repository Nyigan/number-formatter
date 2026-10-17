# Security policy

## Supported versions

Only the latest release receives fixes. This package has no runtime dependencies.

## Reporting a vulnerability

Please report it privately through GitHub:
[Report a vulnerability](https://github.com/Nyigan/number-formatter/security/advisories/new).

Do not open a public issue for security problems. You can expect an acknowledgement within a few days. Fixes are released as a patch version and credited in the changelog unless you prefer otherwise.

## What counts

The package parses text that users type or paste, so the most relevant problems are inputs that make `parse` hang, use excessive memory or CPU, or return a wrong number without throwing. Reports of those are welcome and taken seriously.
