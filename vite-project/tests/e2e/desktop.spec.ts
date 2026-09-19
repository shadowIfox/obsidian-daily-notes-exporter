import { expect, test, type Page } from '@playwright/test';

// В браузере окно Tauri изображаем подменой window.__TAURI_INTERNALS__: «база» лежит в памяти страницы,
// сама страница ведёт себя так же, как в приложении (выбирает SQLite).
type Fake = { db: Map<string, string> };
declare global {
    interface Window {
        __fake: Fake;
    }
}

async function fakeTauri(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const fake: Fake = { db: new Map() };
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
        expect(await dbValue(page, 'schemaVersion')).toBe('1');

        await page.locator('#task-text').fill('Новая задача');
        await page.locator('#task-text').press('Enter');
        await expect.poll(() => dbValue(page, 'tasks')).toContain('Новая задача');
    });
});
