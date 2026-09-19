import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { createMemoryBackend, localStorageBackend, type StorageBackend } from '../../src/storage';
import { flushStore, initStore, loadHabits, loadMood, loadSettings, loadTasks, saveHabits, saveMood, saveSettings, saveTasks } from '../../src/store';
import { mkHabit, mkMood, mkTask } from './factories';

describe('localStorageBackend', () => {
    it('пишет и читает JSON', async () => {
        await localStorageBackend.write('tasks', [{ id: 'a' }]);
        assert.equal(localStorage.getItem('tasks'), '[{"id":"a"}]');
        assert.deepEqual(await localStorageBackend.read('tasks'), [{ id: 'a' }]);
    });

    it('нет значения или повреждённый JSON — undefined', async () => {
        assert.equal(await localStorageBackend.read('habits'), undefined);
        localStorage.setItem('habits', '{сломано');
        assert.equal(await localStorageBackend.read('habits'), undefined);
    });
});

describe('память как хранилище', () => {
    it('store работает без localStorage', async () => {
        const memory = createMemoryBackend({ tasks: [{ id: 'm1', text: 'из памяти' }] });
        await initStore(memory);
        assert.deepEqual(loadTasks().map((t) => t.text), ['из памяти']);

        saveMood([mkMood('2026-09-19', 4)]);
        await flushStore();
        assert.deepEqual(memory.data.get('moodData'), [{ date: '2026-09-19', rating: 4, note: '' }]);
        assert.equal(localStorage.getItem('moodData'), null);
    });

    it('повторный initStore читает хранилище заново', async () => {
        const memory = createMemoryBackend({ tasks: [{ id: 'a', text: 'раз' }] });
        await initStore(memory);
        memory.data.set('tasks', [{ id: 'a', text: 'два' }]);
        assert.equal(loadTasks()[0].text, 'раз'); // до повторного открытия — прежние данные
        await initStore();
        assert.equal(loadTasks()[0].text, 'два');
    });
});

describe('кэш и запись', () => {
    it('сохранённое видно сразу, а в хранилище оказывается после flushStore', async () => {
        const memory = createMemoryBackend();
        await initStore(memory);
        saveTasks([mkTask({ id: 'a', text: 'новая' })]);
        assert.equal(loadTasks()[0].text, 'новая'); // мгновенно
        await flushStore();
        assert.equal((memory.data.get('tasks') as { text: string }[])[0].text, 'новая');
    });

    it('записи идут по порядку: побеждает последняя', async () => {
        const memory = createMemoryBackend();
        await initStore(memory);
        saveSettings({ userName: 'Первая' });
        saveSettings({ userName: 'Вторая' });
        saveSettings({ userName: 'Третья' });
        await flushStore();
        assert.equal((memory.data.get('userSettings') as { userName: string }).userName, 'Третья');
    });

    it('load* отдаёт копии: правка результата не меняет хранилище', () => {
        saveHabits([mkHabit({ id: 'h', text: 'Зарядка', dates: ['2026-09-01'] })]);
        const habits = loadHabits();
        habits[0].dates.push('2026-09-02');
        habits[0].text = 'Испорчено';
        assert.deepEqual(loadHabits()[0].dates, ['2026-09-01']);
        assert.equal(loadHabits()[0].text, 'Зарядка');
    });

    it('save* копирует переданное: правка массива после сохранения не меняет хранилище', () => {
        const tasks = [mkTask({ id: 'a', text: 'исходная' })];
        saveTasks(tasks);
        tasks[0].text = 'изменена снаружи';
        tasks.push(mkTask({ id: 'b' }));
        assert.deepEqual(loadTasks().map((t) => t.text), ['исходная']);
    });

    it('сохранение приводит данные к нормальному виду, как это сделал бы перезапуск', () => {
        saveMood([mkMood('2026-09-19', 3), mkMood('2026-09-01', 5), mkMood('плохая', 2), mkMood('2026-09-02', 99)]);
        assert.deepEqual(loadMood().map((m) => m.date), ['2026-09-01', '2026-09-19']);
    });

    it('save* сообщает событием datachange', () => {
        const listener = vi.fn();
        window.addEventListener('datachange', listener);
        saveTasks([]);
        saveSettings({ userName: 'Я' });
        window.removeEventListener('datachange', listener);
        assert.equal(listener.mock.calls.length, 2);
    });
});

describe('сбой записи', () => {
    const failingBackend = (failOn: number): StorageBackend & { writes: unknown[] } => {
        const writes: unknown[] = [];
        let calls = 0;
        return {
            writes,
            read: async () => undefined,
            write: async (_key, value) => {
                if (++calls === failOn) throw new Error('диск переполнен');
                writes.push(value);
            },
        };
    };

    it('ошибка не теряется: событие storeerror, данные в памяти остаются', async () => {
        const errors: { key: string; message: string }[] = [];
        const listener = (e: Event) => errors.push((e as CustomEvent).detail);
        window.addEventListener('storeerror', listener);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        await initStore(failingBackend(1));
        saveTasks([mkTask({ id: 'a', text: 'не записалась' })]);
        await flushStore();

        window.removeEventListener('storeerror', listener);
        consoleError.mockRestore();
        assert.deepEqual(errors, [{ key: 'tasks', message: 'диск переполнен' }]);
        assert.equal(loadTasks()[0].text, 'не записалась');
    });

    it('после сбоя следующие записи проходят', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const backend = failingBackend(1);
        await initStore(backend);
        saveSettings({ userName: 'Первая' }); // упадёт
        saveSettings({ userName: 'Вторая' }); // должна записаться
        await flushStore();
        consoleError.mockRestore();
        assert.deepEqual(backend.writes, [{ themeMode: 'system', userName: 'Вторая' }]);
        assert.equal(loadSettings().userName, 'Вторая');
    });
});

describe('до открытия', () => {
    it('чтение до initStore — понятная ошибка, а не пустые данные', async () => {
        vi.resetModules();
        const fresh = await import('../../src/store');
        assert.throws(() => fresh.loadTasks(), /initStore/);
    });
});
