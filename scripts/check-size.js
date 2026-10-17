'use strict';

// Fails when the published package grows past a limit or contains an unexpected file.
// Usage: node scripts/check-size.js        (run from the project root, e.g. `npm run check:size`)
const { execFileSync } = require('node:child_process');

const MAX_PACKED = 20 * 1024; // bytes in the .tgz that users download (15.8 kB with the long README)
const MAX_UNPACKED = 64 * 1024; // bytes on disk after install (48.8 kB)
const EXPECTED = ['LICENSE', 'README.md', 'index.d.ts', 'index.js', 'package.json'];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const out = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const [pack] = JSON.parse(out);
const files = pack.files.map((file) => file.path).sort();

const problems = [];
if (pack.size > MAX_PACKED) problems.push(`packed size ${pack.size} B is over the ${MAX_PACKED} B limit`);
if (pack.unpackedSize > MAX_UNPACKED) problems.push(`unpacked size ${pack.unpackedSize} B is over the ${MAX_UNPACKED} B limit`);
for (const file of files) if (!EXPECTED.includes(file)) problems.push(`unexpected file in package: ${file}`);
for (const file of EXPECTED) if (!files.includes(file)) problems.push(`missing file in package: ${file}`);

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`package: ${files.length} files, ${kb(pack.size)} packed, ${kb(pack.unpackedSize)} unpacked`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log('size check passed');
