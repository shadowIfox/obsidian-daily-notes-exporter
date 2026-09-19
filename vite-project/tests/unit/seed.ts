// Заполнение хранилища в тестах: кладём данные в localStorage (ключи те же, что у приложения)
// и заново открываем store, чтобы он их прочитал — как при запуске приложения.
import { initStore } from '../../src/store';

const put =
    (key: string) =>
    async (value: unknown): Promise<void> => {
        localStorage.setItem(key, JSON.stringify(value));
        await initStore();
    };

export const seed = {
    tasks: put('tasks'),
    habits: put('habits'),
    mood: put('moodData'),
    settings: put('userSettings'),
};
