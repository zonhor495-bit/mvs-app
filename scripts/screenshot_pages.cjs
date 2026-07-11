const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || '5174';
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const serverScript = path.join(__dirname, 'static_server.cjs');
const outDir = path.join(__dirname, '..', 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const server = spawn(process.execPath, [serverScript], {
  env: { ...process.env, PORT: port },
  stdio: ['ignore', 'inherit', 'inherit'],
});

const pages = [
  { name: 'home', path: '/' },
  { name: 'features', path: '/features' },
  { name: 'reviews', path: '/reviews' },
  { name: 'faq', path: '/faq' },
  { name: 'download', path: '/download' },
  { name: 'support', path: '/support' },
];

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200 });
    for (const item of pages) {
      const url = `${baseUrl}${item.path}`;
      console.log('Opening', url);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      if (!bodyHTML || bodyHTML.trim().length === 0) {
        throw new Error(`Empty body on ${url}`);
      }
      const screenshotPath = path.join(outDir, `${item.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('Saved', screenshotPath);
    }
    console.log('Screenshots completed');
  } catch (err) {
    console.error('ERROR', err);
  } finally {
    if (browser) {
      await browser.close();
    }
    server.kill('SIGTERM');
    process.exit(0);
  }
})();
