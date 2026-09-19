import { defineConfig } from '@playwright/test';

// Интерфейс проверяется в настоящем Chromium против dev-сервера Vite.
// Наборы шли по одному общему localStorage-браузеру, поэтому параллельность выключена.
export default defineConfig({
    testDir: 'tests/e2e',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 180_000,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:5173',
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
