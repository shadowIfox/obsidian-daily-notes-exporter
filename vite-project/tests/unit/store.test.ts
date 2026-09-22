import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
    ensureMarker,
    flushStore,
    initStore,
    loadActiveHabits,
    loadHabits,
    loadMarkers,
    loadMood,
    loadSettings,
    loadTasks,
    recordMarkerHistory,
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

    it('подпункты: разбор, мусор отбрасывается, id выдаётся', async () => {
        await seed.tasks([
            {
                text: 'с подпунктами',
                subtasks: [
                    { id: 's1', text: 'первый', completed: true, completedAt: '2026-09-19' },
                    { text: 'без id' },
                    'мусор',
                    null,
                    { text: 5, completed: 'да' },
                ],
            },
            { text: 'без подпунктов' },
        ]);
        const [t1, t2] = loadTasks();
        assert.equal(t1.subtasks.length, 3);
        assert.deepEqual(t1.subtasks[0], { id: 's1', text: 'первый', completed: true, completedAt: '2026-09-19' });
        assert.ok(t1.subtasks[1].id);
        assert.deepEqual([t1.subtasks[2].text, t1.subtasks[2].completed], ['', true]); // text не строка → '', completed — Boolean(любого значения)
        assert.deepEqual(t2.subtasks, []);
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
        assert.deepEqual(loadSettings(), { themeMode: 'system', userName: '', language: 'ru', notifications: DEFAULT_NOTIFICATIONS });
    });

    it('патчи не затирают друг друга', async () => {
        saveSettings({ userName: 'Анна' });
        saveSettings({ themeMode: 'dark' });
        assert.deepEqual(loadSettings(), { themeMode: 'dark', userName: 'Анна', language: 'ru', notifications: DEFAULT_NOTIFICATIONS });
    });

    it('мусор → значения по умолчанию', async () => {
        await seed.settings({ themeMode: 'bogus', userName: 5 });
        assert.deepEqual(loadSettings(), { themeMode: 'system', userName: '', language: 'ru', notifications: DEFAULT_NOTIFICATIONS });
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

describe('store: маркеры (категории задач)', () => {
    it('мусор при чтении: без имени отбрасывается, отрицательные счётчики — в ноль, id выдаётся', async () => {
        await seed.markers([
            { id: 'm1', name: 'Работа', historyTotal: 5, historyCompleted: 2 },
            { name: '  ' },
            { name: 'Без id', historyTotal: -3 },
        ]);
        const markers = loadMarkers();
        assert.deepEqual(
            markers.map((m) => m.name),
            ['Работа', 'Без id'],
        );
        assert.equal(markers[1].historyTotal, 0);
        assert.ok(markers[1].id);
    });

    it('ensureMarker: добавляет один раз, пустое имя игнорирует, пробелы обрезает', () => {
        ensureMarker('Учёба');
        ensureMarker('Учёба');
        ensureMarker('  ');
        ensureMarker('  Дом  ');
        const names = loadMarkers().map((m) => m.name);
        assert.deepEqual(names, ['Учёба', 'Дом']);
    });

    it('recordMarkerHistory: копит счётчики для существующего маркера, создаёт новый для неизвестного', () => {
        ensureMarker('Учёба');
        recordMarkerHistory('Учёба', true);
        recordMarkerHistory('Учёба', false);
        recordMarkerHistory('Архив', true);
        const byName = Object.fromEntries(loadMarkers().map((m) => [m.name, m]));
        assert.deepEqual(byName['Учёба'], { id: byName['Учёба'].id, name: 'Учёба', historyTotal: 2, historyCompleted: 1 });
        assert.deepEqual(byName['Архив'], { id: byName['Архив'].id, name: 'Архив', historyTotal: 1, historyCompleted: 1 });
    });
});
