import { expect, test, type Page } from '@playwright/test';

const dayStr = (page: Page, shift: number) =>
    page.evaluate((k) => {
        const d = new Date();
        d.setDate(d.getDate() + k);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, shift);

test.describe('свой календарь и график настроения', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('настроение за вчера: дата выбирается в календаре, запись появляется в истории и на графике рядом с сегодняшней', async ({
        page,
    }) => {
        const yesterday = await dayStr(page, -1);
        const today = await dayStr(page, 0);
        await page.evaluate((t) => localStorage.setItem('moodData', JSON.stringify([{ date: t, rating: 4, note: 'сегодня' }])), today);
        await page.goto('/#/mood');
        await page.reload();

        // родного календаря нет: поле скрыто, вместо него кнопка и наша панель
        await expect(page.locator('#mood-date')).toHaveClass(/datepick__native/);
        await page.locator('#mood-date + .datepick').click();
        await expect(page.locator('.datepick__panel')).toBeVisible();
        await page.locator(`.datepick__day[data-date="${yesterday}"]`).click();
        await expect(page.locator('.datepick__panel')).toHaveCount(0);
        await expect(page.locator('#mood-date')).toHaveValue(yesterday);

        await page.locator('.rating__opt[data-r="2"]').click();
        await page.locator('#mood-note').fill('вчерашняя заметка');
        await page.locator('#mood-form button[type="submit"]').click();

        await expect(page.locator('#mood-history .mood-item')).toHaveCount(2);
        await expect(page.locator('#mood-history .mood-item').nth(1)).toContainText('вчерашняя заметка');

        // график: семь дней, вчера — предпоследний столбец, сегодня — последний
        const cols = page.locator('#mood-week-chart .col');
        await expect(cols).toHaveCount(7);
        await expect(cols.nth(5).locator('.col__value')).toHaveText('2');
        await expect(cols.nth(6).locator('.col__value')).toHaveText('4');
        await expect(cols.nth(0).locator('.col__value')).toHaveCount(0);
    });

    test('в форме настроения будущие дни недоступны', async ({ page }) => {
        const tomorrow = await dayStr(page, 1);
        await page.goto('/#/mood');
        await page.locator('#mood-date + .datepick').click();
        // завтра может оказаться в следующем месяце — тогда переходим на него
        if ((await page.locator(`.datepick__day[data-date="${tomorrow}"]`).count()) === 0) await page.locator('[data-nav="1"]').click();
        await expect(page.locator(`.datepick__day[data-date="${tomorrow}"]`)).toBeDisabled();
    });

    test('дедлайн задачи: выбрать дату и очистить', async ({ page }) => {
        const today = await dayStr(page, 0);
        await page.goto('/#/tasks');
        await page.locator('#task-date + .datepick').click();
        await page.locator(`.datepick__day[data-date="${today}"]`).click();
        await expect(page.locator('#task-date')).toHaveValue(today);

        await page.locator('#task-date + .datepick').click();
        await page.locator('[data-clear]').click();
        await expect(page.locator('#task-date')).toHaveValue('');
        await expect(page.locator('#task-date + .datepick')).toContainText('Без даты');
    });
});

test.describe('график настроения и период', () => {
    test('переключатель «30 дней» меняет и график: запись 20-дневной давности появляется, заголовок обновляется', async ({ page }) => {
        await page.goto('/');
        const [today, old] = [await dayStr(page, 0), await dayStr(page, -19)];
        await page.evaluate(
            ([t, o]) =>
                localStorage.setItem(
                    'moodData',
                    JSON.stringify([
                        { date: o, rating: 4, note: '' },
                        { date: t, rating: 3, note: '' },
                    ]),
                ),
            [today, old],
        );
        await page.goto('/#/mood');
        await page.reload();

        await expect(page.locator('#mood-chart-title')).toHaveText('График за неделю');
        await expect(page.locator('#mood-week-chart .col')).toHaveCount(7);
        await expect(page.locator('#mood-week-chart .col__value')).toHaveText(['3']);

        await page.locator('#mood-range [data-days="30"]').click();
        await expect(page.locator('#mood-chart-title')).toHaveText('График за 30 дней');
        await expect(page.locator('#mood-week-chart .col')).toHaveCount(30);
        await expect(page.locator('#mood-week-chart .col__value')).toHaveText(['4', '3']);

        await page.locator('#mood-range [data-days="7"]').click();
        await expect(page.locator('#mood-week-chart .col')).toHaveCount(7);
    });
});
