# Browser test

Loads the real `index.js` into Chromium and checks formatting, parsing and the error behaviour, then compares a few results with Node. It also opens `playground/index.html`, the page published on GitHub Pages, and checks that it renders results and errors.

```sh
npm run test:browser:install   # once: installs Playwright into browser-test/ and downloads Chromium
npm run test:browser
```

If you already have a Chromium, skip the download and point at it: `CHROMIUM_PATH=/path/to/chromium npm run test:browser`.

This lives outside the main package on purpose: `npm install` in the project root never downloads a browser, and the published package does not include this folder.
