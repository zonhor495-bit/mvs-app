const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const url = process.argv[2] || 'http://localhost:5173/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
  });

  const requests = [];
  page.on('requestfinished', req => {
    requests.push({ url: req.url(), status: req.response() ? req.response().status() : null, ok: req.response() ? req.response().ok() : null });
  });
  page.on('requestfailed', req => {
    requests.push({ url: req.url(), status: 'failed', failureText: req.failure() && req.failure().errorText });
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.error('PAGE LOAD ERROR:', e && e.message);
  }

  // Wait a moment for any runtime logs
  await page.waitForTimeout(1000);

  // Collect DOM snapshot for root app
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);

  console.log('\n==== CONSOLE MESSAGES (all) ====');
  consoleMessages.forEach(m => console.log(m.type.toUpperCase() + ':', m.text));

  console.log('\n==== FAILED/ERROR NETWORK REQUESTS ====');
  requests.filter(r => r.status === 'failed' || (typeof r.status === 'number' && r.status >= 400)).forEach(r => console.log(r.url, r.status, r.failureText || ''));

  console.log('\n==== ALL JS/CSS REQUESTS (summary) ====');
  requests.filter(r => /\.js(\?|$)/.test(r.url) || /\.css(\?|$)/.test(r.url)).forEach(r => console.log(r.url, r.status));

  console.log('\n==== BODY HTML (first 1000 chars) ====');
  console.log(bodyHTML.slice(0, 1000));

  await browser.close();
  process.exit(0);
})();
