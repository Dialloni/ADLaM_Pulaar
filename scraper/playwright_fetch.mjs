// Gando AI — Playwright renderer for JS-heavy ADLaM sites.
// Loads a URL in a headless browser, waits for content, prints rendered HTML to stdout.
// Used by scrape_generic.py as a subprocess fallback when static fetch returns no ADLaM.
//
// Usage: node scraper/playwright_fetch.mjs <url> [timeoutMs]
// Output: rendered HTML on stdout. Errors on stderr, exit code 1.

import { chromium } from 'playwright';

const url = process.argv[2];
const timeoutMs = parseInt(process.argv[3] || '30000', 10);

if (!url) {
  console.error('usage: node playwright_fetch.mjs <url> [timeoutMs]');
  process.exit(2);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'GandoAI-Scraper/1.0 (+adlam corpus collection)',
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  // Give late-loading ADLaM text a moment.
  await page.waitForTimeout(1500);
  const html = await page.content();
  process.stdout.write(html);
} catch (err) {
  console.error(`render failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
