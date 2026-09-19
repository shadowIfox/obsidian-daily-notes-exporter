import { expect, test } from '@playwright/test';

test.describe('слой данных в браузере', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('добавленная задача переживает перезагрузку страницы', async ({ page }) => {
        await page.goto('/#/tasks');
        await page.locator('#task-text').fill('Купить хлеб');
        await page.locator('#task-text').press('Enter');
        await expect(page.locator('#task-list .task__text')).toHaveText(['Купить хлеб']);

        await page.reload();
        await expect(page.locator('#task-list .task__text')).toHaveText(['Купить хлеб']);
    });

    test('сбой записи: появляется сообщение, а задача остаётся на экране', async ({ page }) => {
        await page.goto('/#/tasks');
        await page.evaluate(() => {
            Storage.prototype.setItem = () => {
                throw new DOMException('нет места', 'QuotaExceededError');
            };
        });

        // alert блокирует страницу, поэтому обработчик ставим до действия
        const messages: string[] = [];
        page.once('dialog', (dialog) => {
            messages.push(dialog.message());
            void dialog.dismiss();
        });

        await page.locator('#task-text').fill('Не запишется');
        await page.locator('#task-text').press('Enter');

        await expect.poll(() => messages).toEqual([expect.stringContaining('Не удалось сохранить данные')]);
        await expect(page.locator('#task-list .task__text')).toHaveText(['Не запишется']);
    });

    test('сбой чтения при запуске: понятное сообщение вместо пустого экрана', async ({ page }) => {
        await page.addInitScript(() => {
            Storage.prototype.getItem = () => {
                throw new Error('доступ запрещён');
            };
        });
        await page.goto('/');
        await expect(page.getByRole('alert')).toContainText('Не удалось открыть данные: доступ запрещён');
    });
});
