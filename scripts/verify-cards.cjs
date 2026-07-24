const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const outDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });

  let serverUrl = process.argv[2] || 'http://localhost:4177';
  console.log(`Connecting to: ${serverUrl}\n`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const sizes = [
    { w: 1920, h: 1080 },
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
    { w: 1024, h: 768 },
  ];

  for (const s of sizes) {
    await page.setViewport({ width: s.w, height: s.h });
    await page.goto(serverUrl + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    const cards = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('main section .mt-10.grid > *')).slice(0, 4);
      return nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const overflowX = node.scrollWidth > node.clientWidth;
        const overflowY = node.scrollHeight > node.clientHeight;
        const texts = node.querySelectorAll('p');
        const title = texts[1];

        return {
          heading: texts[0]?.textContent?.trim() || '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          overflowX,
          overflowY,
          titleOverflow: title ? (title.scrollWidth > title.clientWidth || title.scrollHeight > title.clientHeight) : false,
        };
      });
    });

    const widths = cards.map((c) => c.width);
    const heights = cards.map((c) => c.height);
    const allSameWidth = widths.every((v) => v === widths[0]);
    const allSameHeight = heights.every((v) => v === heights[0]);
    const anyOverflow = cards.some((c) => c.overflowX || c.overflowY || c.titleOverflow);

    await page.screenshot({ path: path.join(outDir, `homepage-cards-${s.w}.png`), fullPage: true });

    console.log(`\n[${s.w}x${s.h}]`);
    console.log(JSON.stringify(cards, null, 2));
    console.log(`sameWidth=${allSameWidth} sameHeight=${allSameHeight} anyOverflow=${anyOverflow}`);

    if (!allSameWidth || !allSameHeight || anyOverflow) {
      throw new Error(`Validation failed for ${s.w}x${s.h}`);
    }
  }

  await browser.close();
  console.log('\nAll card checks passed. Screenshots saved to artifacts/.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
