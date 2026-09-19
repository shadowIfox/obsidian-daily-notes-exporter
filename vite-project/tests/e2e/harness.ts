// Общий «обвяз» браузерных проверок поверх Playwright.
// Наборы писались как скрипты на Chrome DevTools Protocol: ev(...) выполняет JS-строку в странице,
// check(...) фиксирует результат, send(...) — редкие низкоуровневые действия (окно, навигация, клавиши).
// Здесь эти же имена реализованы через Playwright, поэтому тела наборов перенесены без изменений.

import { expect, type Page } from '@playwright/test';

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createHarness(page: Page) {
    const problems: string[] = [];

    page.on('pageerror', (e) => problems.push('EXC ' + e.message.split('\n')[0]));
    page.on('console', (m) => {
        if (['error', 'warning'].includes(m.type())) problems.push(`CONSOLE ${m.type()} ${m.text().slice(0, 200)}`);
    });

    /** Выполняет выражение в странице; ошибка возвращается строкой «ERR …», как в исходных наборах. */
    const ev = async (expression: string): Promise<any> => {
        try {
            return await page.evaluate(expression);
        } catch (e) {
            return 'ERR ' + String((e as Error).message).split('\n')[0];
        }
    };

    /** Низкоуровневые действия, которые использовали наборы. */
    const send = async (method: string, params: any = {}): Promise<void> => {
        switch (method) {
            case 'Page.enable':
            case 'Runtime.enable':
                return;
            case 'Emulation.setDeviceMetricsOverride':
                await page.setViewportSize({ width: params.width, height: params.height });
                return;
            case 'Emulation.setEmulatedMedia': {
                const scheme = params.features?.find((f: any) => f.name === 'prefers-color-scheme')?.value;
                if (scheme) await page.emulateMedia({ colorScheme: scheme });
                return;
            }
            case 'Page.navigate':
                await page.goto(params.url);
                return;
            case 'Input.dispatchKeyEvent':
                await page.keyboard.press(params.key);
                return;
            default:
                throw new Error(`Неподдерживаемый вызов: ${method}`);
        }
    };

    /** Проверка «мягкая»: набор доходит до конца, а в отчёте видны все провалившиеся пункты. */
    const check = (name: string, ok: unknown, extra: unknown = ''): void => {
        expect.soft(Boolean(ok), extra ? `${name} — ${extra}` : name).toBe(true);
    };

    const go = async (route: string): Promise<void> => {
        await ev(`location.hash = '#/${route}'`);
        await sleep(400);
    };

    /** В конце набора: на странице не должно быть ошибок и предупреждений в консоли. */
    const finish = (): void => {
        expect.soft([...new Set(problems)], 'ошибки страницы и консоли').toEqual([]);
    };

    return { page, sleep, ev, send, check, go, finish, problems };
}
