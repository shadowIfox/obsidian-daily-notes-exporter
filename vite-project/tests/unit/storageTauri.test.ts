import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { createMemoryBackend } from '../../src/storage';

// «База» на стороне Rust заменена картой в памяти: проверяем, что фронтенд правильно зовёт команды и разбирает ответы
const db = new Map<string, string>();
const invoke = vi.fn(async (command: string, args: { key: string; value?: string }) => {
    if (command === 'storage_read') return db.get(args.key) ?? null;
    if (command === 'storage_write') {
        db.set(args.key, args.value as string);
        return null;
    }
    throw new Error(`неизвестная команда ${command}`);
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: Parameters<typeof invoke>) => invoke(...a) }));

const { importFromLocalStorage, isTauri, sqliteBackend } = await import('../../src/storageTauri');

beforeEach(() => {
    db.clear();
    invoke.mockClear();
    localStorage.clear();
});

describe('sqliteBackend', () => {
    it('пишет JSON-текст и читает разобранное значение', async () => {
        await sqliteBackend.write('tasks', [{ id: 'a', text: 'Привет' }]);
        assert.equal(db.get('tasks'), '[{"id":"a","text":"Привет"}]');
        assert.deepEqual(await sqliteBackend.read('tasks'), [{ id: 'a', text: 'Привет' }]);
    });

    it('нет ключа или повреждённый JSON — undefined', async () => {
        assert.equal(await sqliteBackend.read('habits'), undefined);
        db.set('habits', '{сломано');
        assert.equal(await sqliteBackend.read('habits'), undefined);
    });

    it('ошибка базы доходит до вызывающего (store покажет storeerror)', async () => {
        invoke.mockRejectedValueOnce('диск переполнен');
        await assert.rejects(sqliteBackend.write('tasks', []), /диск переполнен/);
    });

    it('настройки дублируются в localStorage для скрипта темы в index.html, остальное — нет', async () => {
        await sqliteBackend.write('userSettings', { themeMode: 'dark', userName: '' });
        assert.equal(localStorage.getItem('userSettings'), '{"themeMode":"dark","userName":""}');
        await sqliteBackend.write('tasks', []);
        assert.equal(localStorage.getItem('tasks'), null);
    });

    it('при чтении настроек кэш темы обновляется из базы', async () => {
        db.set('userSettings', '{"themeMode":"light"}');
        localStorage.setItem('userSettings', '{"themeMode":"dark"}');
        await sqliteBackend.read('userSettings');
        assert.equal(localStorage.getItem('userSettings'), '{"themeMode":"light"}');
    });
});

describe('isTauri', () => {
    it('в обычном браузере — false', () => {
        assert.equal(isTauri(), false);
    });
});

describe('importFromLocalStorage', () => {
    const target = () => sqliteBackend;
    const source = () => createMemoryBackend({ tasks: [{ id: 't' }], habits: [], userSettings: { themeMode: 'dark' } });

    it('переносит данные в пустую базу', async () => {
        assert.equal(await importFromLocalStorage(target(), source()), true);
        assert.equal(db.get('tasks'), '[{"id":"t"}]');
        assert.equal(db.get('habits'), '[]');
        assert.equal(db.has('moodData'), false);
    });

    it('не трогает базу, где уже есть версия схемы', async () => {
        db.set('schemaVersion', '1');
        db.set('tasks', '[]');
        assert.equal(await importFromLocalStorage(target(), source()), false);
        assert.equal(db.get('tasks'), '[]');
    });

    it('нечего переносить — ничего не пишет', async () => {
        assert.equal(await importFromLocalStorage(target(), createMemoryBackend()), false);
        assert.equal(db.size, 0);
    });

    it('schemaVersion пишется последним, чтобы оборванный перенос повторился', async () => {
        const src = createMemoryBackend({ schemaVersion: 1, tasks: [], habits: [] });
        await importFromLocalStorage(target(), src);
        const written = invoke.mock.calls.filter(([c]) => c === 'storage_write').map(([, a]) => a.key);
        assert.equal(written[written.length - 1], 'schemaVersion');
    });

    it('оборванный перенос (нет schemaVersion) при следующем запуске повторяется', async () => {
        db.set('tasks', '[{"id":"обрывок"}]');
        assert.equal(await importFromLocalStorage(target(), source()), true);
        assert.equal(db.get('tasks'), '[{"id":"t"}]');
    });
});
