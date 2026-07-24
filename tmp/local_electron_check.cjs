const puppeteer = require('puppeteer');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const wsEndpoint = process.env.WS_ENDPOINT;
  const port = process.env.DEBUG_PORT || '9222';
  const browser = wsEndpoint
    ? await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null })
    : await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });

  let page = null;
  for (let i = 0; i < 50; i += 1) {
    const pages = await browser.pages();
    page = pages.find((p) => (p.url() || '').includes('/dist/index.html')) || pages.find((p) => p.url().startsWith('file://')) || pages[0] || null;
    if (page) break;
    await wait(200);
  }

  if (!page) {
    throw new Error('No Electron renderer page found');
  }

  await page.bringToFront();

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
    const titleBar = document.querySelector('.app-drag-region');
    const titleBarBg = titleBar ? getComputedStyle(titleBar).backgroundColor : null;

    return {
      bodyBg,
      titleBarBg,
      hasWhiteBackground: bodyBg === 'rgb(255, 255, 255)' || bodyBg === 'white',
      hasLegacyBrand: ['fastdrive', 'fast drive', 'wash&drive'].some((x) => text.includes(x)),
      hasDarkThemeClass: Boolean(document.querySelector('.bg-slate-950')),
      hasTitleBar: Boolean(titleBar),
      hasButtons: {
        minimize: Boolean(document.querySelector('[aria-label="Свернуть окно"]')),
        maximize: Boolean(document.querySelector('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]')),
        close: Boolean(document.querySelector('[aria-label="Закрыть окно"]')),
      },
    };
  });

  const inputs = await page.$$('input');
  if (inputs.length < 4) throw new Error(`Registration form is not visible, inputs=${inputs.length}`);

  await inputs[0].type('MVS Owner');
  await inputs[1].type('mvs_admin');
  await inputs[2].type('StrongPass123');
  await inputs[3].type('StrongPass123');

  const submit = await page.$('button.w-full.rounded-lg');
  if (!submit) throw new Error('Submit button not found');
  await submit.click();

  let destination = 'unknown';
  for (let i = 0; i < 40; i += 1) {
    const state = await page.evaluate(() => {
      const txt = document.body?.innerText || '';
      if (txt.includes('Первоначальная настройка')) return 'first_run_setup';
      if (txt.includes('Дашборд') || txt.includes('Заказы') || txt.includes('Настройки')) return 'main_interface';
      return 'waiting';
    });
    if (state !== 'waiting') {
      destination = state;
      break;
    }
    await wait(250);
  }

  const labelBefore = await page.$eval('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]', (el) => el.getAttribute('aria-label'));
  await page.click('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]');
  await wait(500);
  const labelAfter = await page.$eval('[aria-label="Развернуть окно"], [aria-label="Восстановить окно"]', (el) => el.getAttribute('aria-label'));

  const minimizeCall = await page.evaluate(async () => {
    try {
      await window.electron.windowControls.minimize();
      return 'ok';
    } catch {
      return 'error';
    }
  });

  await wait(300);
  await page.click('[aria-label="Закрыть окно"]');
  await wait(800);

  let closeWorked = false;
  try {
    await browser.pages();
    closeWorked = false;
  } catch {
    closeWorked = true;
  }

  const result = {
    initial,
    destination,
    controls: {
      maximizeToggleWorks: labelBefore !== labelAfter,
      minimizeCall,
      closeWorked,
      labelBefore,
      labelAfter,
    },
  };

  console.log(JSON.stringify(result, null, 2));
})();
