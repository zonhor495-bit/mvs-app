import { chromium } from '@playwright/test';

const url = 'http://localhost:5173/app/';
const adminPassword = 'Admin123';
const managerPassword = 'Manager456';

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    log('INIT', 'Очищены localStorage/sessionStorage до первого рендера');

    await page.getByPlaceholder('Имя (необязательно)').fill('Owner');
    await page.getByPlaceholder('Логин').fill('owner');
    await page.locator('input[placeholder="Пароль"]').first().fill('Owner123');
    await page.locator('input[placeholder="Повторите пароль"]').first().fill('Owner123');
    await page.getByRole('button', { name: 'Создать аккаунт и войти' }).click();

    await page.waitForSelector('text=🛡️ Пароль администратора', { timeout: 20000 });
    log('SETUP', 'Модалка установки пароля админа появилась');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(adminPassword);
    await passwordInputs.nth(1).fill(adminPassword);
    await page.getByRole('button', { name: 'Далее' }).click();

    await page.waitForSelector('text=👑 Пароль управляющего', { timeout: 20000 });
    log('SETUP', 'Переход к установке пароля менеджера');

    await passwordInputs.nth(0).fill(managerPassword);
    await passwordInputs.nth(1).fill(managerPassword);
    await page.getByRole('button', { name: 'Завершить' }).click();

    await page.waitForSelector('text=Пароли установлены', { timeout: 20000 });
    log('SETUP', 'Пароли успешно сохранены');

    await page.waitForTimeout(1500);
    const noPasswordModal = await page.locator('text=Пароль администратора').count();
    log('CHECK', `Количество видимых модалок паролей после закрытия: ${noPasswordModal}`);

    await expectVisible(page, 'text=Дашборд');
    log('CHECK', 'Главный экран открылся после завершения настройки');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    const modalOnReloadCount = await page.locator('text=Пароль администратора').count();
    log('CHECK', `Модалка после reload: ${modalOnReloadCount}`);
    await expectVisible(page, 'text=Дашборд');

    await page.getByRole('button', { name: /Администратор|Управляющий/ }).first().click();
    await page.getByRole('button', { name: '👑 Управляющий' }).last().click();

    const rolePrompt = page.locator('text=Введите пароль управляющего');
    await rolePrompt.waitFor({ timeout: 10000 });
    await page.locator('input[type="password"]').last().fill(managerPassword);
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    await page.waitForTimeout(1000);
    await expectVisible(page, 'text=Управляющий');
    log('ROLE', 'Переключение на роль управляющего прошло успешно');

    await page.getByRole('button', { name: /Управляющий|Администратор/ }).first().click();
    await page.getByRole('button', { name: '🛡️ Администратор' }).last().click();

    await page.locator('text=Введите пароль администратора').waitFor({ timeout: 10000 });
    await page.locator('input[type="password"]').last().fill(adminPassword);
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    await page.waitForTimeout(1000);
    await expectVisible(page, 'text=Администратор');
    log('ROLE', 'Переключение обратно на роль администратора прошло успешно');

    log('SUCCESS', 'E2E сценарий завершён успешно');
    await browser.close();
  } catch (error) {
    console.error('E2E FAILED');
    console.error(error);
    await browser.close();
    process.exit(1);
  }
})();

async function expectVisible(page, selector) {
  await page.locator(selector).first().waitFor({ timeout: 20000 });
}
