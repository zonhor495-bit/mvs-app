import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`CONSOLE[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.error('PAGE_ERROR', error.stack || error.message);
  });

  page.on('requestfailed', req => {
    console.log('REQUEST_FAILED', req.url(), req.failure()?.errorText);
  });

  try {
    console.log('Loading http://localhost:3001 ...');
    const resp = await page.goto('http://localhost:3001', { waitUntil: 'networkidle' , timeout: 30000});
    console.log('HTTP status:', resp && resp.status());
    // wait a bit for runtime errors
    await page.waitForTimeout(1500);
  } catch (e) {
    console.error('NAV_ERROR', e.stack || e.message);
  }

  await browser.close();
})();
