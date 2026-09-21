import { expect, test } from '@playwright/test';

test.describe('язык интерфейса', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('по умолчанию русский; переключатель в настройках меняет язык и запоминает выбор', async ({ page }) => {
        await page.goto('/#/settings');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
        await expect(page.locator('.sidebar')).toContainText('Задачи');
        await expect(page.locator('input[name="language"][value="ru"]')).toBeChecked();

        // переключаем на английский: выбор сохраняется, окно перезагружается уже на английском
        await page.locator('#language-group label:has(input[value="en"])').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('.sidebar')).toContainText('Tasks');
        await expect(page.locator('.sidebar')).not.toContainText('Задачи');
        await expect(page.locator('#language-group input[value="en"]')).toBeChecked();
        await expect(page.locator('#settings-section .page-title')).toHaveText('Settings');
        await expect(page.locator('#search-input')).toHaveAttribute('placeholder', 'Search tasks, habits, mood');

        // выбор пережил перезагрузку страницы, и русский не мелькает
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('.sidebar')).toContainText('Tasks');

        // и обратно на русский
        await page.locator('#language-group label:has(input[value="ru"])').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
        await expect(page.locator('.sidebar')).toContainText('Задачи');
    });

    test('английский сохранён заранее: страница строится сразу на английском, без русского в каркасе', async ({ page }) => {
        await page.addInitScript(() =>
            localStorage.setItem('userSettings', JSON.stringify({ themeMode: 'light', userName: '', language: 'en' })),
        );
        await page.goto('/#/tasks');
        await page.reload(); // переход только по «якорю» не перезагружает страницу
        await expect(page.locator('html')).toHaveAttribute('data-lang', 'en');
        await expect(page.locator('html')).toHaveAttribute('data-i18n-ready', '');
        await expect(page.locator('body')).toBeVisible();
        await expect(page.locator('.sidebar')).toContainText('Habits');
        await expect(page.locator('.sidebar')).not.toContainText('Привычки');
        await expect(page.locator('#task-text')).toHaveAttribute('placeholder', 'What needs to be done?');
    });
});
