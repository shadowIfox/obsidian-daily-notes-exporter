// Общая подготовка для юнит-тестов: одинаковый часовой пояс и чистое хранилище.
import { afterEach, beforeEach } from 'vitest';
import { localStorageBackend } from '../../src/storage';
import { flushStore, initStore } from '../../src/store';

// Даты считаются в локальном часовом поясе — фиксируем его, чтобы тесты не зависели от машины.
process.env.TZ = 'Europe/Moscow';

beforeEach(async () => {
    localStorage.clear();
    await initStore(localStorageBackend);
});

afterEach(async () => {
    await flushStore(); // отложенные записи не должны «протечь» в следующий тест
});
