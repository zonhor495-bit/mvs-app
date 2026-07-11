import puppeteer from 'puppeteer';
const targetUrl = process.argv[2] || 'http://127.0.0.1:8001/dist/index.html?profile=1';
(async () => {
  const browser = await puppeteer.launch({headless: 'new', ignoreHTTPSErrors: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-features=site-per-process,IsolateOrigins','--disable-site-isolation-trials']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  page.on('response', async response => {
    const status = response.status();
    const url = response.url();
    const ct = response.headers()['content-type'];
    if (status >= 400) {
      console.log('BAD RESPONSE:', url, status, ct);
    }
    if (ct && ct.includes('application/octet-stream')) {
      console.log('BAD MIME:', url, ct, status);
    }
    if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.map')) {
      console.log('JS/CSS RESPONSE:', url, status, ct);
    }
  });
  await page.goto(targetUrl);
  console.log('[WAITING] for React root to mount...');
  await page.waitForSelector('#root > *', {timeout: 60000});
  console.log('[REACT] mounted, collecting logs...');
  const readyState = await page.evaluate(() => {
    console.log('PAGE READYLOG');
    return document.readyState;
  });
  const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script')).map(s => ({src: s.src, type: s.type, text: s.textContent?.slice(0,100)})));
  const moduleScript = await page.evaluate(() => document.querySelector('script[type=module]')?.textContent?.includes('PROFILER CALLBACK'));
  const queryHasProfile = await page.evaluate(() => new URLSearchParams(window.location.search).has('profile'));
  console.log('READY STATE', readyState);
  console.log('SCRIPT TAGS', JSON.stringify(scripts, null, 2));
  console.log('MODULE SCRIPT HAS CALLBACK?', moduleScript);
  console.log('QUERY HAS profile?', queryHasProfile);
  const search = await page.evaluate(() => window.location.search);
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0,200));
  const rootChildCount = await page.evaluate(() => document.getElementById('root')?.childElementCount);
  const reactContainerKeys = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return null;
    return Object.keys(root).filter(k => k.startsWith('__reactContainer') || k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
  });
  const reactRootState = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return null;
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
    const fiber = root[key];
    if (!fiber) return null;
    const getType = node => {
      if (!node) return null;
      if (typeof node.type === 'function') return node.type.name || '(anonymous)';
      if (typeof node.type === 'symbol') return String(node.type);
      if (typeof node.elementType === 'function') return node.elementType.name || '(anonymous)';
      if (typeof node.elementType === 'symbol') return String(node.elementType);
      return node.type || node.elementType || null;
    };
    const serializeNode = node => {
      if (!node) return null;
      return {
        tag: node.tag,
        type: getType(node),
        childTag: node.child?.tag || null,
        childType: getType(node.child),
        siblingTag: node.sibling?.tag || null,
        siblingType: getType(node.sibling),
      };
    };
    const profiler = fiber.child?.child;
    return {
      current: serializeNode(fiber),
      child: serializeNode(fiber.child),
      childChild: serializeNode(profiler),
      childChildChild: serializeNode(profiler?.child),
      profilerOnRenderType: profiler ? typeof profiler.memoizedProps?.onRender : null,
      profilerOnRenderExists: !!profiler?.memoizedProps?.onRender,
    };
  });
  const jsExists = await page.evaluate(() => typeof React !== 'undefined');
  const hasDevtoolsHook = await page.evaluate(() => typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined');
  const logs = await page.evaluate(() => window.__REACT_PROFILER_LOGS__);
  const dispatchResult = await page.evaluate(() => {
    window.dispatchEvent(new Event('wd-store-changed'));
    return 'dispatched';
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
  const logsAfterDispatch = await page.evaluate(() => window.__REACT_PROFILER_LOGS__);
  console.log('dispatchResult=', dispatchResult);
  console.log('logsAfterDispatch=', JSON.stringify(logsAfterDispatch));
  console.log('rootChildCount=', rootChildCount);
  console.log('reactContainerKeys=', reactContainerKeys);
  console.log('reactRootState=', JSON.stringify(reactRootState, null, 2));
  console.log('devtoolsHook=', hasDevtoolsHook);
  console.log('targetUrl=', targetUrl);
  console.log('search=', search);
  console.log('rootHTML starts=', rootHtml);
  console.log('React defined=', jsExists);
  console.log('LOGS=', logs);
  await browser.close();
})();
