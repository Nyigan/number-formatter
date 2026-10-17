'use strict';

// Fails when package-lock.json has drifted from package.json (version, engines, funding, dev dependencies).
// `npm ci` only checks dependencies, so a stale version or funding entry would otherwise slip through.
// Usage: node scripts/check-lock.js        (npm run check:lock)
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const entry = (lock.packages && lock.packages['']) || {};

const problems = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const compare = (label, fromPackage, fromLock) => {
  if (!same(fromPackage, fromLock)) problems.push(`${label}: package.json has ${JSON.stringify(fromPackage)}, package-lock.json has ${JSON.stringify(fromLock)}`);
};

compare('name', pkg.name, lock.name);
compare('name (root entry)', pkg.name, entry.name);
compare('version', pkg.version, lock.version);
compare('version (root entry)', pkg.version, entry.version);
compare('engines', pkg.engines, entry.engines);
compare('funding', pkg.funding, entry.funding);
compare('license', pkg.license, entry.license);
compare('devDependencies', pkg.devDependencies, entry.devDependencies);
compare('dependencies', pkg.dependencies, entry.dependencies);

if (problems.length) {
  console.error('package-lock.json is out of date:\n  ' + problems.join('\n  ') + '\nRun: npm install --package-lock-only');
  process.exit(1);
}
console.log('package-lock.json matches package.json');
