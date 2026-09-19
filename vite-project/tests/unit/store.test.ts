import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
    flushStore,
    initStore,
    loadActiveHabits,
    loadHabits,
    loadMood,
    loadSettings,
    loadTasks,
    saveHabits,
    saveSettings,
    DEFAULT_NOTIFICATIONS,
} from '../../src/store';
import { seed } from './seed';

describe('store: разбор старых и битых данных', () => {
    it('задачи: старые форматы, мусорные записи, выдача id', async () => {
        await seed.tasks([
            { text: 'старая', checked: true },
            { text: 'новая', date: '2026-09-19', category: 'A', completed: false, id: 'x' },
            'мусор',
            null,
        ]);
        const tasks = loadTasks();
        assert.equal(tasks.length, 2);
        assert.equal(tasks[0].completed, true); // checked → completed
        assert.ok(tasks[0].id && tasks[0].id !== 'x'); // id выдан
    });

    it('задачи: новые поля (время, приоритет, заметка) и значения по умолчанию', async () => {
        await seed.tasks([
            { text: 'старая', date: '2026-09-19' }, // без priority/notes/time
            { text: 'новая', time: '09:15', priority: 'high', notes: 'заметка' },
            { text: 'мусор', time: '9:5', priority: 'urgent', notes: 5 },
        ]);
        const [t1, t2, t3] = loadTasks();
        assert.deepEqual([t1.priority, t1.notes, t1.time], ['normal', '', undefined]);
        assert.deepEqual([t2.priority, t2.notes, t2.time], ['high', 'заметка', '09:15']);
        assert.deepEqual([t3.priority, t3.notes, t3.time], ['normal', '', undefined]);
    });

    it('привычки и настроение: битые записи отбрасываются', async () => {
        await seed.habits([{ text: 'Зарядка', dates: ['2026-09-19', 5, '2026-09-18'] }]);
        await seed.mood([
            { date: '2026-09-19', rating: 4, note: 'ок' },
            { date: 'bad', rating: 3 },
            { date: '2026-09-18', rating: 9 },
        ]);
        assert.deepEqual(loadHabits()[0].dates, ['2026-09-19', '2026-09-18']);
        assert.equal(loadMood().length, 1);
    });

    it('пустое хранилище и битый JSON дают пустые списки', async () => {
        assert.deepEqual(loadTasks(), []);
        localStorage.setItem('tasks', '{не json');
        assert.deepEqual(loadTasks(), []);
    });
});

describe('store: график и архив привычек', () => {
    const raw = [
        { id: 'a', text: 'ok', dates: [], days: [4, 0, 0, 2] }, // дубли и порядок
        { id: 'b', text: 'все семь', dates: [], days: [0, 1, 2, 3, 4, 5, 6] },
        { id: 'c', text: 'мусор', dates: [], days: [9, -1, 'x', 1.5, null] },
        { id: 'd', text: 'архив', dates: [], archived: true },
        { id: 'e', text: 'не булево', dates: [], archived: 'yes' },
        { id: 'f', text: 'не массив', dates: [], days: 'пн' },
    ];

    it('график очищается: дубли, порядок, «каждый день» → undefined', async () => {
        await seed.habits(raw);
        assert.deepEqual(
            loadHabits().map((h) => h.days),
            [[0, 2, 4], undefined, undefined, undefined, undefined, undefined],
        );
    });

    it('archived — только строгое true; активные без архива', async () => {
        await seed.habits(raw);
        assert.deepEqual(
            loadHabits().map((h) => h.archived),
            [undefined, undefined, undefined, true, undefined, undefined],
        );
        assert.deepEqual(
            loadActiveHabits().map((h) => h.id),
            ['a', 'b', 'c', 'e', 'f'],
        );
    });

    it('сохранение не теряет график и архив', async () => {
        await seed.habits(raw);
        saveHabits(loadHabits());
        await flushStore();
        await initStore(); // как после перезапуска: читаем то, что реально записано
        assert.deepEqual(
            loadHabits().map((h) => h.days?.join()),
            ['0,2,4', undefined, undefined, undefined, undefined, undefined],
        );
        assert.equal(loadHabits()[3].archived, true);
    });
});

describe('store: настройки', () => {
    it('по умолчанию', async () => {
        assert.deepEqual(loadSettings(), { themeMode: 'system', userName: '', notifications: DEFAULT_NOTIFICATIONS });
    });

    it('патчи не затирают друг друга', async () => {
        saveSettings({ userName: 'Анна' });
        saveSettings({ themeMode: 'dark' });
        assert.deepEqual(loadSettings(), { themeMode: 'dark', userName: 'Анна', notifications: DEFAULT_NOTIFICATIONS });
    });

    it('мусор → значения по умолчанию', async () => {
        await seed.settings({ themeMode: 'bogus', userName: 5 });
        assert.deepEqual(loadSettings(), { themeMode: 'system', userName: '', notifications: DEFAULT_NOTIFICATIONS });
    });

    it('сохранение сообщает интерфейсу событием datachange', async () => {
        let fired = 0;
        const on = () => fired++;
        window.addEventListener('datachange', on);
        saveSettings({ userName: 'Я' });
        window.removeEventListener('datachange', on);
        assert.equal(fired, 1);
    });
});
