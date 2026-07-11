#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

async function run() {
  const repoRoot = path.resolve(new URL(import.meta.url).pathname, '..', '..');
  const distPath = path.join(repoRoot, 'dist', 'index.html');
  if (!fs.existsSync(distPath)) {
    console.error('dist/index.html not found. Run `npm run build` first.');
    process.exit(2);
  }

  const fileUrl = `file://${distPath}?profile=1`;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

    await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    // emit page location for debugging
    await page.evaluate(() => console.log('PAGE_LOCATION', window.location.href, window.location.search));

    // Interact with navigation to mount heavy pages
    await interactWithNav(page, [
      'Заказы',
      'Клиенты',
      'Сотрудники',
      'Склад',
      'Аналитика',
      'Отчёты',
    ]);

    // Wait up to 12s for profiler logs to appear
    const logs = await waitForProfilerLogs(page, { timeout: 12000 });

    const outDir = path.join(repoRoot, 'scripts', 'profile-output');
    fs.mkdirSync(outDir, { recursive: true });

    const rawPath = path.join(outDir, 'raw-logs.json');
    fs.writeFileSync(rawPath, JSON.stringify(logs, null, 2), 'utf8');

    const top = aggregateTop(logs, 10);
    const topPath = path.join(outDir, 'top10.json');
    fs.writeFileSync(topPath, JSON.stringify(top, null, 2), 'utf8');

    console.log('Saved raw logs to', rawPath);
    console.log('Saved top-10 to', topPath);
    console.log('Top-10 components:');
    top.forEach((t, i) => {
      console.log(`${i + 1}. ${t.id} — totalActual:${t.totalActual.toFixed(2)}ms renders:${t.renders} avg:${(t.totalActual / t.renders).toFixed(2)}ms`);
    });
  } finally {
    await browser.close();
  }
}

async function interactWithNav(page, labels = []) {
  for (const label of labels) {
    try {
      // find button by exact text match
      const found = await page.$x(`//button[normalize-space(.)='${label}']`);
        if (found && found.length) {
        await found[0].click();
        // allow time for lazy load + render
        await new Promise((r) => setTimeout(r, 1200));
      } else {
        // try contains
        const found2 = await page.$x(`//button[contains(normalize-space(.), '${label}')]`);
        if (found2 && found2.length) {
          await found2[0].click();
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    } catch (e) {
      // ignore individual failures
    }
  }
  // final settle
  await new Promise((r) => setTimeout(r, 1200));
}

async function waitForProfilerLogs(page, opts = {}) {
  const timeout = opts.timeout || 10000;
  const pollInterval = 250;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const logs = await page.evaluate(() => window.__REACT_PROFILER_LOGS__ || null);
    if (logs && logs.length) return logs;
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  // final attempt: return whatever is there (including empty array)
  return await page.evaluate(() => window.__REACT_PROFILER_LOGS__ || []);
}

function aggregateTop(logs, n = 10) {
  const map = new Map();
  for (const r of logs) {
    const id = r.id || '<unknown>';
    const entry = map.get(id) || { id, totalActual: 0, totalBase: 0, renders: 0 };
    entry.totalActual += r.actualDuration || 0;
    entry.totalBase += r.baseDuration || 0;
    entry.renders += 1;
    map.set(id, entry);
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => b.totalActual - a.totalActual);
  return arr.slice(0, n);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
