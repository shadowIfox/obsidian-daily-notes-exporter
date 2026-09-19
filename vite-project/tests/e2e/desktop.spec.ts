import { expect, test, type Page } from '@playwright/test';

// В браузере окно Tauri изображаем подменой window.__TAURI_INTERNALS__: «база» и «vault» лежат в памяти страницы,
// сама страница ведёт себя так же, как в приложении (выбирает SQLite, показывает карточку Obsidian).
type Fake = { db: Map<string, string>; files: Map<string, string> };
declare global {
    interface Window {
        __fake: Fake;
    }
}

async function fakeTauri(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const fake: Fake = { db: new Map(), files: new Map() };
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
                        case 'vault_read_note':
                            return fake.files.get(`${args.vault}/daily-notes/${args.date}.md`) ?? null;
                        case 'vault_write_note':
                            fake.files.set(`${args.vault}/daily-notes/${args.date}.md`, args.content);
                            return null;
                        case 'plugin:dialog|open':
                            return '/Users/тест/Vault';
                        default:
                            throw new Error(`нет заглушки для ${cmd}`);
                    }
                },
            },
        });
    });
}

const dbValue = (page: Page, key: string) => page.evaluate((k) => window.__fake.db.get(k) ?? null, key);

test.describe('в браузере', () => {
    test('карточки Obsidian нет: файлы vault недоступны', async ({ page }) => {
        await page.goto('/#/settings');
        await expect(page.locator('#backup-download')).toBeVisible();
        await expect(page.locator('#vault-card')).toBeHidden();
    });
});

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

    test('карточка Obsidian: выбрать папку и записать заметку дня, свой текст заметки остаётся', async ({ page }) => {
        await fakeTauri(page);
        const today = await page.evaluate(() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
        await page.goto('/#/tasks');
        await page.locator('#task-text').fill('Позвонить маме');
        await page.locator('#task-date').fill(today);
        await page.locator('#task-text').press('Enter');
        await expect(page.locator('#task-list .task__text')).toHaveText(['Позвонить маме']);
        // в заметке уже есть свой текст — он должен остаться
        await page.evaluate((day) => window.__fake.files.set(`/Users/тест/Vault/daily-notes/${day}.md`, 'Мой дневник за день\n'), today);

        await page.goto('/#/settings');
        await expect(page.locator('#vault-card')).toBeVisible();
        await expect(page.locator('#vault-write')).toBeDisabled();

        await page.locator('#vault-choose').click();
        await expect(page.locator('#vault-path')).toHaveText('/Users/тест/Vault');
        await expect(page.locator('#vault-write')).toBeEnabled();

        await page.locator('#vault-write').click();
        await expect(page.locator('#vault-status')).toContainText('Заметка за сегодня записана');

        const note = await page.evaluate(() => [...window.__fake.files.values()][0]);
        expect(note.startsWith('Мой дневник за день\n\n<!-- мой-день:начало -->')).toBe(true);
        expect(note).toContain('## Мой день');
        expect(note).toContain('- [ ] Позвонить маме');
    });

    test('сбой записи в vault: понятное сообщение', async ({ page }) => {
        await fakeTauri(page);
        await page.addInitScript(() => {
            const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } })
                .__TAURI_INTERNALS__;
            const original = internals.invoke;
            internals.invoke = (cmd, args) => (cmd === 'vault_write_note' ? Promise.reject('Папка vault не найдена') : original(cmd, args));
        });
        await page.goto('/#/settings');
        await page.locator('#vault-choose').click();
        await page.locator('#vault-write').click();
        await expect(page.locator('#vault-status')).toContainText('Папка vault не найдена');
    });
});
