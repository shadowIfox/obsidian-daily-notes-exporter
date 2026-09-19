// Общая подготовка для юнит-тестов: одинаковый часовой пояс и чистое хранилище.
import { beforeEach } from 'vitest';

// Даты считаются в локальном часовом поясе — фиксируем его, чтобы тесты не зависели от машины.
process.env.TZ = 'Europe/Moscow';

beforeEach(() => {
    localStorage.clear();
});
