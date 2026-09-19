// storage.ts — «где физически лежат данные». Интерфейс асинхронный: в Tauri база SQLite отвечает через IPC.
// Остальной код про хранилище ничего не знает: он работает через store.ts.

/**
 * Ключи данных. Совпадают с ключами localStorage, поэтому уже сохранённые данные подхватываются.
 * schemaVersion — версия схемы данных (см. migrations.ts); migrationBackup — копия данных перед последней миграцией.
 */
export type StoreKey = 'tasks' | 'habits' | 'moodData' | 'userSettings' | 'schemaVersion' | 'migrationBackup';

export interface StorageBackend {
    /** Сохранённое значение (уже разобранный JSON) или undefined, если ничего нет или запись повреждена. */
    read(key: StoreKey): Promise<unknown>;
    /** Записывает значение целиком; при ошибке промис отклоняется. */
    write(key: StoreKey, value: unknown): Promise<void>;
}

/** Данные в localStorage браузера (текущий вариант хранения). */
export const localStorageBackend: StorageBackend = {
    async read(key) {
        const text = localStorage.getItem(key);
        if (text === null) return undefined;
        try {
            return JSON.parse(text);
        } catch {
            return undefined;
        }
    },
    async write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
};

/** Данные только в памяти — для тестов и для проверки, что store не зависит от localStorage. */
export function createMemoryBackend(initial: Partial<Record<StoreKey, unknown>> = {}): StorageBackend & { data: Map<StoreKey, unknown> } {
    const data = new Map<StoreKey, unknown>(Object.entries(initial) as [StoreKey, unknown][]);
    return {
        data,
        async read(key) {
            return data.has(key) ? structuredClone(data.get(key)) : undefined;
        },
        async write(key, value) {
            data.set(key, structuredClone(value));
        },
    };
}
