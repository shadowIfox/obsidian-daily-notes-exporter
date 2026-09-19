import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { MIGRATIONS, migrate, SCHEMA_VERSION, SchemaTooNewError, type Migration, type RawData } from '../../src/migrations';
import { createMemoryBackend } from '../../src/storage';
import { flushStore, initStore, loadHabits, loadSettings, loadTasks, DEFAULT_NOTIFICATIONS } from '../../src/store';
import { parseBackup, BACKUP_VERSION, buildBackup } from '../../src/backup';

const empty: RawData = { tasks: [], habits: [], mood: [], settings: {} };

describe('migrate', () => {
    it('текущая версия — без изменений, тот же объект', () => {
        const data: RawData = { tasks: [{ text: 'x' }], habits: [], mood: [], settings: {} };
        assert.equal(migrate(data, SCHEMA_VERSION), data);
    });

    it('данные из более новой версии отклоняются с понятной ошибкой', () => {
        assert.throws(
            () => migrate(empty, SCHEMA_VERSION + 1),
            (e: unknown) => {
                assert.ok(e instanceof SchemaTooNewError);
                assert.equal(e.found, SCHEMA_VERSION + 1);
                assert.equal(e.supported, SCHEMA_VERSION);
                assert.match(e.message, /более новой версией/);
                return true;
            },
        );
    });

    it('миграции применяются по цепочке в правильном порядке', () => {
        const log: string[] = [];
        const step = (from: number): Migration => ({
            from,
            to: from + 1,
            description: `${from}→${from + 1}`,
            up: (d) => {
                log.push(`${from}→${from + 1}`);
                return { ...d, settings: { ...(d.settings as object), [`v${from + 1}`]: true } };
            },
        });
        // в списке намеренно не по порядку
        const result = migrate(empty, 0, [step(2), step(0), step(1)], 3);
        assert.deepEqual(log, ['0→1', '1→2', '2→3']);
        assert.deepEqual(result.settings, { v1: true, v2: true, v3: true });
        // старт с середины
        log.length = 0;
        migrate(empty, 2, [step(0), step(1), step(2)], 3);
        assert.deepEqual(log, ['2→3']);
    });

    it('пропуск в цепочке — ошибка, а не молчаливая потеря шагов', () => {
        assert.throws(() => migrate(empty, 0, [], 1), /Нет миграции данных с версии 0/);
    });

    it('в реестре нет пропусков: от 0 до текущей версии есть шаг для каждой версии', () => {
        for (let v = 0; v < SCHEMA_VERSION; v++)
            assert.ok(
                MIGRATIONS.some((m) => m.from === v && m.to === v + 1),
                `нет шага ${v}→${v + 1}`,
            );
    });
});

describe('миграция 0 → 1 (данные до появления версий)', () => {
    const legacy: RawData = {
        tasks: [
            { text: 'галочка старым способом', checked: true },
            { text: 'ещё старее', done: true },
            { id: 'keep', text: 'уже нормальная', completed: false },
            { id: 'both', text: 'новое поле важнее', completed: false, checked: true },
            'мусор',
            null,
        ],
        habits: [
            { text: 'без id', dates: [] },
            { id: 'h1', text: 'с id', dates: [] },
        ],
        mood: [{ date: '2026-09-19', rating: 4 }],
        settings: { themeMode: 'dark' },
    };
    const result = migrate(legacy, 0);
    const tasks = result.tasks as Record<string, unknown>[];

    it('checked / done → completed, старые поля убираются', () => {
        assert.equal(tasks[0].completed, true);
        assert.equal(tasks[1].completed, true);
        assert.equal('checked' in tasks[0] || 'done' in tasks[1], false);
    });

    it('completed, если он уже есть, важнее старых полей', () => {
        assert.equal(tasks[3].completed, false);
    });

    it('записям без id выдаётся id, существующие сохраняются', () => {
        assert.ok(typeof tasks[0].id === 'string' && tasks[0].id !== '');
        assert.equal(tasks[2].id, 'keep');
        const habits = result.habits as Record<string, unknown>[];
        assert.ok(typeof habits[0].id === 'string' && habits[0].id !== '');
        assert.equal(habits[1].id, 'h1');
    });

    it('мусор не падает, остальные разделы не тронуты, входные данные не меняются', () => {
        assert.equal(tasks[4], 'мусор');
        assert.equal(tasks[5], null);
        assert.deepEqual(result.mood, legacy.mood);
        assert.deepEqual(result.settings, legacy.settings);
        assert.equal((legacy.tasks as Record<string, unknown>[])[0].checked, true); // исходный объект цел
    });

    it('повторный запуск на уже мигрированных данных ничего не портит', () => {
        assert.deepEqual(migrate(result, 0), result);
    });

    it('не-массивы вместо списков переживают миграцию', () => {
        assert.deepEqual(migrate({ tasks: undefined, habits: 'oops', mood: null, settings: undefined }, 0), {
            tasks: undefined,
            habits: 'oops',
            mood: null,
            settings: undefined,
        });
    });
});

describe('initStore и версия схемы', () => {
    const legacyBackend = () =>
        createMemoryBackend({
            tasks: [
                { text: 'старая', checked: true },
                { id: 'a', text: 'новая' },
            ],
            habits: [{ text: 'привычка без id', dates: ['2026-09-19'] }],
            userSettings: { themeMode: 'dark', userName: 'Аня' },
        });

    it('старые данные (без версии): мигрируют, записываются заново, ставится версия', async () => {
        const backend = legacyBackend();
        await initStore(backend);

        assert.equal(loadTasks()[0].completed, true);
        assert.deepEqual(loadSettings(), { themeMode: 'dark', userName: 'Аня', notifications: DEFAULT_NOTIFICATIONS });
        assert.equal(backend.data.get('schemaVersion'), SCHEMA_VERSION);
        const savedTasks = backend.data.get('tasks') as { id: string; completed: boolean }[];
        assert.equal(savedTasks[0].completed, true);
        assert.ok(savedTasks[0].id, 'id записан в хранилище');
        assert.equal((savedTasks[0] as Record<string, unknown>).checked, undefined);
    });

    it('перед миграцией сохраняется копия прежних данных', async () => {
        const backend = legacyBackend();
        await initStore(backend);
        const saved = backend.data.get('migrationBackup') as { fromVersion: number; savedAt: string; data: RawData };
        assert.equal(saved.fromVersion, 0);
        assert.ok(!Number.isNaN(Date.parse(saved.savedAt)));
        assert.deepEqual(saved.data.tasks, [
            { text: 'старая', checked: true },
            { id: 'a', text: 'новая' },
        ]); // как было
    });

    it('id, выданные при миграции, постоянны: после перезапуска те же', async () => {
        const backend = legacyBackend();
        await initStore(backend);
        const firstIds = loadHabits().map((h) => h.id);
        await initStore(backend);
        assert.deepEqual(
            loadHabits().map((h) => h.id),
            firstIds,
        );
    });

    it('актуальные данные не мигрируют и ничего не переписывают', async () => {
        const backend = legacyBackend();
        await initStore(backend); // первая миграция
        const writes: string[] = [];
        const write = backend.write;
        backend.write = async (key, value) => {
            writes.push(key);
            return write(key, value);
        };
        await initStore(backend);
        await flushStore();
        assert.deepEqual(writes, []);
    });

    it('первый запуск (хранилище пустое): ставится только версия, без копий и лишних записей', async () => {
        const backend = createMemoryBackend();
        await initStore(backend);
        assert.deepEqual([...backend.data.keys()], ['schemaVersion']);
        assert.deepEqual(loadTasks(), []);
    });

    it('данные более новой версии: ошибка, в хранилище ничего не меняется, старые данные из памяти не подсовываются', async () => {
        const backend = createMemoryBackend({ tasks: [{ id: 'a', text: 'из будущего' }], schemaVersion: SCHEMA_VERSION + 1 });
        await initStore(createMemoryBackend()); // до этого что-то было открыто
        await assert.rejects(initStore(backend), SchemaTooNewError);
        await flushStore();
        assert.deepEqual([...backend.data.keys()].sort(), ['schemaVersion', 'tasks']);
        assert.equal(backend.data.get('schemaVersion'), SCHEMA_VERSION + 1);
        assert.throws(() => loadTasks(), /initStore/);
    });

    it('некорректная версия в хранилище считается «до версий»', async () => {
        const backend = createMemoryBackend({ tasks: [{ text: 'x', checked: true }], schemaVersion: 'abc' });
        await initStore(backend);
        assert.equal(loadTasks()[0].completed, true);
        assert.equal(backend.data.get('schemaVersion'), SCHEMA_VERSION);
    });
});

describe('резервные копии и версия схемы', () => {
    it('новая копия несёт текущую версию', async () => {
        assert.equal(buildBackup().version, SCHEMA_VERSION);
        assert.equal(BACKUP_VERSION, SCHEMA_VERSION);
    });

    it('копия старого формата (без версии) проходит миграцию: галочки и id', () => {
        const r = parseBackup(JSON.stringify({ tasks: [{ text: 'старая', checked: true }], habits: [{ text: 'без id', dates: [] }] }));
        assert.ok(r.ok);
        assert.equal(r.backup.tasks[0].completed, true);
        assert.ok(r.backup.tasks[0].id && r.backup.habits[0].id);
    });

    it('копия из более новой версии отклоняется', () => {
        const r = parseBackup(JSON.stringify({ app: 'moi-den', version: SCHEMA_VERSION + 1, tasks: [] }));
        assert.equal(r.ok, false);
    });
});
