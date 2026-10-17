'use strict';

// Run by `prepublishOnly`: stops a publish while placeholder text is still in the files below.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FILES = ['package.json', 'README.md', '.github/FUNDING.yml'];
const PLACEHOLDER = 'YOUR-SHOP-NAME';

const found = FILES.filter((file) => readFileSync(join(__dirname, '..', file), 'utf8').includes(PLACEHOLDER));
if (found.length > 0) {
  console.error(`Replace ${PLACEHOLDER} with your Etsy shop name before publishing. Found in: ${found.join(', ')}`);
  process.exit(1);
}
