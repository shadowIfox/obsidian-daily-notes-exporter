import { expect, test, type Page } from '@playwright/test';

// В браузере окно Tauri изображаем подменой window.__TAURI_INTERNALS__: «база» лежит в памяти страницы,
// сама страница ведёт себя так же, как в приложении (выбирает SQLite).
type Fake = { db: Map<string, string>; calls: string[] };
declare global {
    interface Window {
        __fake: Fake;
    }
}

async function fakeTauri(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const fake: Fake = { db: new Map(), calls: [] };
        window.__fake = fake;
        Object.assign(window, {
            __TAURI_INTERNALS__: {
                invoke: async (cmd: string, args: Record<string, string>) => {
                    switch (cmd) {
                        case 'storage_read':
                            return fake.db.get(args.key) ?? null;
                        case 'storage_write':
                            fake.db.set(args.key, args.value);
                            return null;
                        case 'send_test_notification':
                            fake.calls.push(cmd);
                            return null;
                        default:
                            throw new Error(`нет заглушки для ${cmd}`);
                    }
                },
            },
        });
    });
}

const dbValue = (page: Page, key: string) => page.evaluate((k) => window.__fake.db.get(k) ?? null, key);

test.describe('в приложении (подмена Tauri)', () => {
    test('данные из localStorage переезжают в базу, а новые задачи пишутся уже туда', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() =>
            localStorage.setItem(
                'tasks',
                JSON.stringify([
                    { id: 'old', text: 'Задача из браузера', date: '', category: '', priority: 'normal', notes: '', completed: false },
                ]),
            ),
        );
        await fakeTauri(page);
        await page.goto('/#/tasks');
        await page.reload();

        await expect(page.locator('#task-list .task__text')).toHaveText(['Задача из браузера']);
        expect(await dbValue(page, 'tasks')).toContain('Задача из браузера');
        expect(await dbValue(page, 'schemaVersion')).toBe('2');

        await page.locator('#task-text').fill('Новая задача');
        await page.locator('#task-text').press('Enter');
        await expect.poll(() => dbValue(page, 'tasks')).toContain('Новая задача');
    });

    test('уведомления: карточка есть, пока главный переключатель выключен остальное недоступно, включение сохраняется и шлёт пробное', async ({
        page,
    }) => {
        await fakeTauri(page);
        await page.goto('/#/settings');
        await expect(page.locator('#notif-card')).toBeVisible();
        await expect(page.locator('#notif-enabled')).not.toBeChecked();
        await expect(page.locator('#notif-task-start')).toBeDisabled();
        await expect(page.locator('#notif-test')).toBeDisabled();

        await page.locator('#notif-enabled').check();
        await expect(page.locator('#notif-task-start')).toBeEnabled();
        await expect(page.locator('#notif-repeat-time')).toBeDisabled(); // повтор ещё не включён
        await expect(page.locator('#notif-status')).toContainText('Пробное уведомление отправлено');
        expect(await page.evaluate(() => window.__fake.calls)).toEqual(['send_test_notification']);

        await page.locator('#notif-repeat').check();
        await expect(page.locator('#notif-repeat-time')).toBeEnabled();
        await page.locator('#notif-repeat-time').selectOption('19:30');
        await page.locator('#notif-morning').check();

        await expect
            .poll(async () => JSON.parse((await dbValue(page, 'userSettings')) ?? '{}').notifications)
            .toMatchObject({
                enabled: true,
                repeatEnabled: true,
                repeatTime: '19:30',
                morningDigest: true,
                taskAtDayStart: true,
                dayStart: '09:00',
            });
    });

    test('уведомления: сбой пробного уведомления показывается сообщением', async ({ page }) => {
        await fakeTauri(page);
        await page.addInitScript(() => {
            const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } })
                .__TAURI_INTERNALS__;
            const original = internals.invoke;
            internals.invoke = (cmd, args) => (cmd === 'send_test_notification' ? Promise.reject('нет разрешения') : original(cmd, args));
        });
        await page.goto('/#/settings');
        await page.locator('#notif-enabled').check();
        await expect(page.locator('#notif-status')).toContainText('Не удалось показать уведомление: нет разрешения');
    });
});

test('в браузере карточки уведомлений нет: системные уведомления только в приложении', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(page.locator('#backup-download')).toBeVisible();
    await expect(page.locator('#notif-card')).toBeHidden();
});
