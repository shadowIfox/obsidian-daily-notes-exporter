import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vitest';
import { applyBackup, backupFilename, buildBackup, parseBackup, serializeBackup, type Backup } from '../../src/backup';
import { loadHabits, loadMood, loadSettings, loadTasks } from '../../src/store';
import { mkTask } from './factories';
import { seed } from './seed';

const seedCurrent = () => {
    seed.tasks([mkTask({ id: 't1', text: 'моя' }), mkTask({ id: 't2', text: 'общая (моя версия)' })]);
    seed.habits([
        { id: 'h1', text: 'Зарядка', dates: ['2026-09-01', '2026-09-02'] },
        { id: 'h2', text: 'Только у меня', dates: ['2026-09-05'] },
    ]);
    seed.mood([{ date: '2026-09-01', rating: 3, note: 'моя' }, { date: '2026-09-03', rating: 4, note: '' }]);
    seed.settings({ themeMode: 'dark', userName: 'Я' });
};

const incoming = {
    app: 'moi-den',
    version: 1,
    exportedAt: '2026-09-19T10:00:00.000Z',
    tasks: [mkTask({ id: 't2', text: 'общая (версия из копии)' }), mkTask({ id: 't3', text: 'новая из копии', time: '09:15', priority: 'high', notes: 'заметка' })],
    habits: [
        { id: 'h1', text: 'Зарядка (копия)', dates: ['2026-09-02', '2026-09-03', '2026-09-04'] },
        { id: 'h3', text: 'Новая привычка', dates: ['2026-09-10'], days: [0, 2], archived: true },
    ],
    mood: [{ date: '2026-09-01', rating: 5, note: 'из копии' }, { date: '2026-09-02', rating: 2, note: 'новая запись' }],
    settings: { themeMode: 'light', userName: 'Из копии' },
};

const parseOk = (text: string): Backup => {
    const r = parseBackup(text);
    assert.ok(r.ok, 'ждали успешный разбор');
    return r.backup;
};
const parseError = (text: string): string => {
    const r = parseBackup(text);
    assert.equal(r.ok, false, text.slice(0, 40));
    return r.ok ? '' : r.error;
};

describe('резервная копия: сборка', () => {
    beforeEach(seedCurrent);

    it('собирает все данные с меткой приложения и временем', () => {
        const built = buildBackup(new Date('2026-09-19T12:00:00Z'));
        assert.equal(built.app, 'moi-den');
        assert.equal(built.version, 1);
        assert.equal(built.exportedAt, '2026-09-19T12:00:00.000Z');
        assert.deepEqual([built.tasks.length, built.habits.length, built.mood.length], [2, 2, 2]);
        assert.deepEqual(built.settings, { themeMode: 'dark', userName: 'Я' });
    });

    it('имя файла — по локальной дате, а не по UTC', () => {
        assert.match(backupFilename(new Date(2026, 8, 19, 23, 59)), /^moi-den-backup-2026-09-19\.json$/);
    });

    it('круг: сборка → текст → разбор возвращает те же данные', () => {
        const built = buildBackup(new Date('2026-09-19T12:00:00Z'));
        const r = parseBackup(serializeBackup(built));
        assert.ok(r.ok);
        assert.deepEqual(r.backup.tasks, built.tasks);
        assert.deepEqual(r.backup.habits, built.habits);
        assert.deepEqual(r.backup.mood, built.mood);
        assert.deepEqual(r.backup.settings, built.settings);
        assert.deepEqual(r.counts, { tasks: 2, habits: 2, mood: 2 });
    });
});

describe('резервная копия: разбор и проверка файла', () => {
    it('отклоняет пустой, не-JSON и не похожий на копию файл', () => {
        assert.match(parseError(''), /пустой/);
        assert.match(parseError('   \n'), /пустой/);
        assert.match(parseError('{нет'), /не JSON/);
        for (const text of ['[1,2,3]', '"строка"', 'null', '{"foo": 1}']) assert.match(parseError(text), /не похож/);
    });

    it('отклоняет копию из более новой версии и слишком большой файл', () => {
        assert.match(parseError(JSON.stringify({ app: 'moi-den', version: 99, tasks: [] })), /более новой/);
        assert.match(parseError('x'.repeat(20_000_001)), /слишком большой/);
    });

    it('метка приложения допускается и без данных; без метки достаточно любого массива', () => {
        assert.ok(parseBackup(JSON.stringify({ app: 'moi-den' })).ok);
        assert.ok(parseBackup(JSON.stringify({ tasks: [] })).ok);
        assert.ok(parseBackup(JSON.stringify({ version: 1, habits: [] })).ok);
    });

    it('мусор отбрасывается, дубли схлопываются (последний побеждает), поля дополняются', () => {
        const backup = parseOk(
            JSON.stringify({
                tasks: [{ id: 'a', text: 'первая' }, { id: 'a', text: 'вторая' }, 'мусор', null, 5, { text: 'без id' }],
                habits: [{ id: 'h', text: 'ок', dates: ['2026-09-01', 5], days: [1, 1, 9] }, { id: 'h', text: 'дубль' }],
                mood: [{ date: '2026-09-01', rating: 5 }, { date: '2026-09-01', rating: 2 }, { date: 'плохая', rating: 3 }, { date: '2026-09-02', rating: 99 }],
                settings: { themeMode: 'evil', userName: 12 },
            }),
        );
        assert.deepEqual(backup.tasks.map((t) => t.text), ['вторая', 'без id']);
        assert.ok(backup.tasks[1].id.length > 5); // id выдан
        assert.equal(backup.tasks[0].priority, 'normal');
        assert.deepEqual(backup.habits.map((h) => h.text), ['дубль']);
        assert.deepEqual(backup.habits[0].dates, []);
        assert.deepEqual(backup.mood, [{ date: '2026-09-01', rating: 2, note: '' }]);
        assert.deepEqual(backup.settings, { themeMode: 'system', userName: '' });
    });

    it('лишние поля и «внедрённые» свойства не переносятся', () => {
        const backup = parseOk('{"tasks":[{"id":"x","text":"y","__proto__":{"polluted":1},"constructor":"z","extra":"q"}]}');
        assert.equal(Object.keys(backup.tasks[0]).includes('extra'), false);
        assert.equal(({} as Record<string, unknown>).polluted, undefined);
    });
});

describe('резервная копия: восстановление', () => {
    const backup = () => parseOk(JSON.stringify(incoming));

    describe('«Заменить всё»', () => {
        it('данные и настройки заменяются копией', () => {
            seedCurrent();
            const sum = applyBackup(backup(), 'replace');
            assert.deepEqual(sum, { mode: 'replace', tasks: 2, habits: 2, habitMarks: 0, mood: 2 });
            assert.deepEqual(loadTasks().map((t) => t.id), ['t2', 't3']);
            assert.equal(loadTasks()[1].time, '09:15');
            assert.equal(loadTasks()[1].priority, 'high');
            assert.equal(loadTasks()[1].notes, 'заметка');
            assert.deepEqual(loadHabits().map((h) => h.id), ['h1', 'h3']);
            assert.equal(loadHabits()[1].archived, true);
            assert.deepEqual(loadHabits()[1].days, [0, 2]);
            assert.deepEqual(loadMood().map((m) => m.date), ['2026-09-01', '2026-09-02']);
            assert.deepEqual(loadSettings(), { themeMode: 'light', userName: 'Из копии' });
        });
    });

    describe('«Объединить»', () => {
        it('добавляет только новое, не перезаписывает существующее', () => {
            seedCurrent();
            // t3 новая; h3 новая; у h1 добавились 03 и 04 (02 уже было); настроение 09-02
            const sum = applyBackup(backup(), 'merge');
            assert.deepEqual(sum, { mode: 'merge', tasks: 1, habits: 1, habitMarks: 2, mood: 1 });
            assert.deepEqual(loadTasks().map((t) => t.id), ['t1', 't2', 't3']);
            assert.equal(loadTasks()[1].text, 'общая (моя версия)'); // у общей задачи остаётся текущая версия
            assert.deepEqual(loadHabits().map((h) => h.id), ['h1', 'h2', 'h3']);
            assert.deepEqual(loadHabits()[0].dates, ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']); // отметки объединены и отсортированы
            assert.equal(loadHabits()[0].text, 'Зарядка'); // название текущее
            assert.deepEqual(loadMood().map((m) => `${m.date}:${m.rating}`), ['2026-09-01:3', '2026-09-02:2', '2026-09-03:4']);
            assert.deepEqual(loadSettings(), { themeMode: 'dark', userName: 'Я' }); // настройки не тронуты
        });

        it('повторное объединение ничего не добавляет', () => {
            seedCurrent();
            applyBackup(backup(), 'merge');
            const again = applyBackup(backup(), 'merge');
            assert.deepEqual([again.tasks, again.habits, again.habitMarks, again.mood], [0, 0, 0, 0]);
        });
    });
});
