const puppeteer = require('puppeteer');

async function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  let disconnected = false;
  const browser = await puppeteer.launch({
    executablePath: './node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['.'],
    defaultViewport: null,
    headless: false,
    env: { ...process.env, FORCE_PROD: '1' },
  });
  browser.on('disconnected', () => {
    disconnected = true;
  });

  let page = null;
  for (let i = 0; i < 60; i += 1) {
    const pages = await browser.pages();
    page = pages.find((p) => p.url().startsWith('file://')) || pages[0] || null;
    if (page) break;
    await wait(200);
  }

  if (!page) throw new Error('No renderer page');

  await page.bringToFront();
  await wait(1000);

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('wd_seeded', 'true');
    localStorage.setItem('wd_users', '[]');
    localStorage.setItem('wd_organizations', '[]');
    localStorage.removeItem('wd_session');
  });
  await page.reload({ waitUntil: 'networkidle0' });

  const initial = await page.evaluate(() => {
    const text = (document.body?.innerText || '').toLowerCase();
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    return {
      bodyBg,
      hasLegacyBrand: ['fastdrive', 'fast drive', 'wash&drive'].some((x) => text.includes(x)),
      hasDarkThemeClass: Boolean(document.querySelector('.bg-slate-950')),
      hasTitleBar: Boolean(document.querySelector('.app-drag-region')),
      hasButtons: {
        minimize: Boolean(document.querySelector('[aria-label="Свернуть окно"]')),
        maximize: Boolean(document.querySelector('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]')),
        close: Boolean(document.querySelector('[aria-label="Закрыть окно"]')),
      },
    };
  });

  const inputs = await page.$$('input');
  if (inputs.length < 4) throw new Error(`Registration form missing, inputs=${inputs.length}`);

  await inputs[0].type('MVS Owner');
  await inputs[1].type('mvs_admin');
  await inputs[2].type('StrongPass123');
  await inputs[3].type('StrongPass123');
  await page.click('button.w-full.rounded-lg');

  let destination = 'unknown';
  for (let i = 0; i < 40; i += 1) {
    const state = await page.evaluate(() => {
      const txt = document.body?.innerText || '';
      if (txt.includes('Первоначальная настройка')) return 'first_run_setup';
      if (txt.includes('Дашборд') || txt.includes('Заказы') || txt.includes('Настройки')) return 'main_interface';
      return 'waiting';
    });
    if (state !== 'waiting') { destination = state; break; }
    await wait(250);
  }

  const labelBefore = await page.$eval('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]', (el) => el.getAttribute('aria-label'));
  await page.click('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]');
  await wait(600);
  const labelAfter = await page.$eval('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]', (el) => el.getAttribute('aria-label'));

  const minimizeCall = await page.evaluate(async () => {
    try { await window.electron.windowControls.minimize(); return 'ok'; } catch { return 'error'; }
  });

  await wait(300);
  await page.click('[aria-label="Закрыть окно"]');
  await wait(1000);

  let windowsAfterClose = -1;
  try {
    windowsAfterClose = (await browser.pages()).length;
  } catch {
    windowsAfterClose = 0;
  }

  const result = {
    initial,
    destination,
    controls: {
      maximizeToggleWorks: labelBefore !== labelAfter,
      minimizeCall,
      closeWorks: disconnected,
      windowsAfterClose,
      labels: { before: labelBefore, after: labelAfter },
    },
  };

  console.log(JSON.stringify(result, null, 2));
  try { await browser.close(); } catch {}
})();
