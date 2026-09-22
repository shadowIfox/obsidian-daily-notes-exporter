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

    test('старые данные без версии: приложение их открывает, данные переносятся на текущую схему, копия сохраняется', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('tasks', JSON.stringify([{ text: 'Старая задача', checked: true }]));
            localStorage.setItem('habits', JSON.stringify([{ text: 'Зарядка', dates: [] }]));
        });
        await page.goto('/#/tasks');
        await page.reload();
        await expect(page.locator('#task-list .task__text')).toHaveText(['Старая задача']);

        const saved = await page.evaluate(() => ({
            version: localStorage.getItem('schemaVersion'),
            tasks: JSON.parse(localStorage.getItem('tasks') ?? '[]'),
            backup: JSON.parse(localStorage.getItem('migrationBackup') ?? 'null'),
        }));
        expect(saved.version).toBe('2');
        expect(saved.tasks[0]).toMatchObject({ text: 'Старая задача', completed: true });
        expect(saved.tasks[0].id).toBeTruthy();
        expect(saved.backup.fromVersion).toBe(0);
        expect(saved.backup.data.tasks).toEqual([{ text: 'Старая задача', checked: true }]);
    });

    test('данные более новой версии: приложение предупреждает и ничего не трогает', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('schemaVersion', '99');
            localStorage.setItem('tasks', JSON.stringify([{ id: 'a', text: 'Из будущего' }]));
        });
        await page.reload();
        await expect(page.getByRole('alert')).toContainText('более новой версией приложения');

        const saved = await page.evaluate(() => ({ version: localStorage.getItem('schemaVersion'), tasks: localStorage.getItem('tasks') }));
        expect(saved).toEqual({ version: '99', tasks: '[{"id":"a","text":"Из будущего"}]' });
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
