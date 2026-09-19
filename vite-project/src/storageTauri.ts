// storageTauri.ts — данные в базе SQLite внутри приложения Tauri (см. src-tauri/src/db.rs).
// Отдельный файл, чтобы веб-версия и тесты не тянули код Tauri.

import { invoke } from '@tauri-apps/api/core';
import { STORE_KEYS, type StorageBackend, type StoreKey } from './storage';

/** Работает ли страница внутри окна Tauri (а не в обычном браузере). */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Ключ, под которым тему хранит localStorage: её читает скрипт в index.html до отрисовки страницы. */
const THEME_MIRROR_KEY = 'userSettings';

/**
 * Настройки (в них тема) дополнительно копируются в localStorage окна. Это только кэш для index.html:
 * скрипт темы должен отработать синхронно, пока страница не нарисована, а база отвечает асинхронно.
 * Настоящие данные — в SQLite, кэш при запуске перезаписывается ими.
 */
function mirrorTheme(key: StoreKey, value: unknown): void {
    if (key !== THEME_MIRROR_KEY) return;
    try {
        localStorage.setItem(THEME_MIRROR_KEY, JSON.stringify(value));
    } catch {
        // кэш недоступен — при следующем запуске тема просто применится чуть позже
    }
}

export const sqliteBackend: StorageBackend = {
    async read(key) {
        const text = await invoke<string | null>('storage_read', { key });
        if (text === null) return undefined;
        let value: unknown;
        try {
            value = JSON.parse(text);
        } catch {
            return undefined;
        }
        mirrorTheme(key, value);
        return value;
    },
    async write(key, value) {
        await invoke('storage_write', { key, value: JSON.stringify(value) });
        mirrorTheme(key, value);
    },
};

/**
 * Одноразовый перенос: если база ещё не заполнялась, а в localStorage этого окна есть данные (например, от запуска
 * приложения на веб-версии без Tauri), они копируются в базу. Сам localStorage не очищается — это запасная копия.
 * Признак «перенос завершён» — ключ schemaVersion: он пишется последним, и при первом же запуске store ставит его сам.
 * Если перенос оборвался, при следующем запуске он повторится с начала. Возвращает true, если что-то перенесено.
 */
export async function importFromLocalStorage(target: StorageBackend, source: StorageBackend): Promise<boolean> {
    if ((await target.read('schemaVersion')) !== undefined) return false;

    const entries: [StoreKey, unknown][] = [];
    for (const key of STORE_KEYS) {
        const value = await source.read(key);
        if (value !== undefined) entries.push([key, value]);
    }
    if (entries.length === 0) return false;

    entries.sort(([a], [b]) => Number(a === 'schemaVersion') - Number(b === 'schemaVersion'));
    for (const [key, value] of entries) await target.write(key, value);
    return true;
}
