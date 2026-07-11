const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5181/?profile', { waitUntil: 'domcontentloaded', timeout: 120000 });
  const scripts = await page.evaluate(() => Array.from(document.scripts).map(s => ({ type: s.type, src: s.src, hasSrc: s.hasAttribute('src'), textLen: s.textContent.length })));
  const scriptText = await page.evaluate(() => document.scripts[0].textContent);
  const indexSearch = scriptText.indexOf('window.location.search');
  const indexHasProfile = scriptText.indexOf('params.has');
  const indexGetProfile = scriptText.indexOf('params.get');
  const indexProfiler = scriptText.indexOf('Profiler');
  const indexLogs = scriptText.indexOf('__REACT_PROFILER_LOGS__');
  const indexOnRender = scriptText.indexOf('onRender');
  const indexCreateElementProfiler = scriptText.indexOf('Profiler');
  const indexReactProfiler = scriptText.indexOf('react/jsx-dev-runtime');
  console.log('SCRIPTS=' + JSON.stringify(scripts, null, 2));
  console.log('search=' + indexSearch + ' has=' + indexHasProfile + ' get=' + indexGetProfile + ' profiler=' + indexProfiler + ' onRender=' + indexOnRender + ' logs=' + indexLogs);
  if (indexLogs !== -1) {
    const snippetLogs = scriptText.slice(Math.max(0, indexLogs - 120), indexLogs + 260);
    console.log('LOGS_SNIPPET=' + snippetLogs);
  }
  if (indexOnRender !== -1) {
    const snippetRender = scriptText.slice(Math.max(0, indexOnRender - 100), indexOnRender + 200);
    console.log('ONRENDER_SNIPPET=' + snippetRender);
  }
  if (indexProfiler !== -1) {
    const snippetProfiler = scriptText.slice(Math.max(0, indexProfiler - 80), indexProfiler + 160);
    console.log('PROFILER_SNIPPET=' + snippetProfiler);
  }
  const indexTMe = scriptText.indexOf('tMe?');
  if (indexTMe !== -1) {
    const snippetTMe = scriptText.slice(Math.max(0, indexTMe - 100), indexTMe + 220);
    console.log('TME_SNIPPET=' + snippetTMe);
  }
  const indexEMe = scriptText.indexOf('eMe=');
  if (indexEMe !== -1) {
    const snippetEMe = scriptText.slice(Math.max(0, indexEMe - 120), indexEMe + 260);
    console.log('EME_SNIPPET=' + snippetEMe);
  }
  if (indexSearch !== -1) {
    const snippet = scriptText.slice(Math.max(0, indexSearch - 100), indexSearch + 300);
    console.log('SNIPPET=' + snippet);
  }
  await browser.close();
})();
