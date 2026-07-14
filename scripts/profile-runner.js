const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const userId = 'user-profile-runner';
  const orgId = 'org-profile-runner';
  const now = new Date().toISOString();
  await page.goto('about:blank');
  await page.evaluate(function(params) {
    localStorage.setItem('wd_users', JSON.stringify([{ id: params.userId, username: 'tester', email: 'tester@example.com', name: 'Tester', photoUrl: '', role: 'admin', createdAt: params.now, updatedAt: params.now, lastLoginAt: params.now }]));
    localStorage.setItem('wd_organizations', JSON.stringify([{ id: params.orgId, ownerId: params.userId, name: 'Test Org', currency: '₸', timezone: 'Asia/Almaty', language: 'ru', createdAt: params.now, updatedAt: params.now, warehouseAdminView: true, analyticsAdminView: true, washerPercent: 45, financialSettings: { calculationMode: 'percent', employeePercent: 45, organizationPercent: 55, salaryAmount: 0, fixedOrderAmount: 0 } }]));
    localStorage.setItem('wd_session', JSON.stringify({ userId: params.userId, activeOrgId: params.orgId, createdAt: params.now, updatedAt: params.now }));
    localStorage.setItem('wd_active_org', params.orgId);
    localStorage.setItem('wd_seeded', 'true');
  }, { userId: userId, orgId: orgId, now: now });
  await page.goto('http://127.0.0.1:4173/?profile', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForTimeout(3000);
  const navLabels = ['Дашборд', 'Клиенты', 'Заказы', 'Аналитика', '💳 Доходы', 'Настройки'];
  for (let i = 0; i < navLabels.length; i++) {
    const label = navLabels[i];
    const buttons = await page.$x("//button[contains(., '" + label + "')]");
    if (buttons.length === 0) {
      throw new Error('Не найдено nav-кнопки: ' + label);
    }
    await buttons[0].click();
    await page.waitForTimeout(2000);
  }
  const logs = await page.evaluate(() => window.__REACT_PROFILER_LOGS__ || []);
  console.log('PROFILER_LOGS_COUNT=' + logs.length);
  console.log(JSON.stringify(logs, null, 2));
  await browser.close();
})();
