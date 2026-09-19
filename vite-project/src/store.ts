// store.ts — единственное место, где приложение читает и пишет данные.
//
// Как это устроено:
//  • физическое хранилище спрятано за асинхронным интерфейсом StorageBackend (storage.ts): сейчас localStorage,
//    дальше SQLite в Tauri — код приложения при этом не меняется;
//  • при запуске initStore() один раз читает всё из хранилища в память, дальше load*() отдают данные мгновенно;
//  • save*() сразу обновляют память и сообщают интерфейсу (событие datachange), а в хранилище пишут следом
//    по очереди (записи не обгоняют друг друга); сбой записи — событие storeerror, а не тихая потеря;
//  • load*() отдают копии: изменить данные можно только через save*();
//  • вместе с данными хранится версия схемы: при запуске данные более старой версии проходят миграции
//    (migrations.ts), а данные более новой версии не трогаются — приложение сообщает об этом.

import { parseDateStr } from './dates';
import { migrate, SCHEMA_VERSION, type RawData } from './migrations';
import { localStorageBackend, type StorageBackend, type StoreKey } from './storage';
import { newId } from './utils/id';

export { newId };

export type Priority = 'low' | 'normal' | 'high';

export type Task = {
    id: string;
    text: string;
    date: string;          // дедлайн YYYY-MM-DD, может быть пустым
    time?: string;         // время HH:MM, необязательно
    category: string;
    priority: Priority;
    notes: string;
    completed: boolean;
    completedAt?: string;  // YYYY-MM-DD, когда отмечена выполненной
};

export type Habit = {
    id: string;
    text: string;
    dates: string[];       // дни, когда привычка отмечена (YYYY-MM-DD)
    days?: number[];       // дни недели по графику (Пн = 0 … Вс = 6); нет — каждый день
    archived?: boolean;    // в архиве: не показывается и не учитывается, но история сохранена
};

export type MoodEntry = {
    date: string;          // YYYY-MM-DD
    rating: number;        // 1–5
    note: string;
};

export type ThemeMode = 'system' | 'light' | 'dark';

export type UserSettings = {
    themeMode: ThemeMode;
    userName: string;
};

const PRIORITIES: Priority[] = ['low', 'normal', 'high'];

const KEYS = {
    tasks: 'tasks',
    habits: 'habits',
    mood: 'moodData',
    settings: 'userSettings',
    version: 'schemaVersion',
    migrationBackup: 'migrationBackup',
} as const satisfies Record<string, StoreKey>;

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function toRecords(parsed: unknown): Raw[] {
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is Raw => typeof x === 'object' && x !== null);
}

// --- Кэш в памяти и очередь записи ---

type Snapshot = { tasks: Task[]; habits: Habit[]; mood: MoodEntry[]; settings: UserSettings };

let backend: StorageBackend = localStorageBackend;
let cache: Snapshot | null = null;
let pending: Promise<void> = Promise.resolve();

function state(): Snapshot {
    if (!cache) throw new Error('Хранилище не открыто: сначала нужно вызвать initStore().');
    return cache;
}

function emit(name: string, detail?: unknown): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Ставит запись в очередь. Ошибка не пропадает: она уходит в консоль и в событие storeerror. */
function persist(key: StoreKey, value: unknown): void {
    const target = backend;
    pending = pending
        .then(() => target.write(key, value))
        .catch((error: unknown) => {
            console.error(`Не удалось сохранить «${key}»`, error);
            emit('storeerror', { key, message: error instanceof Error ? error.message : String(error) });
        });
}

/** Дожидается, пока все поставленные в очередь записи дойдут до хранилища. */
export function flushStore(): Promise<void> {
    return pending;
}

/**
 * Открывает хранилище: читает все данные в память. Вызывается один раз до запуска интерфейса
 * (и повторно в тестах — тогда данные читаются заново). Можно передать другой бэкенд.
 */
export async function initStore(next: StorageBackend = backend): Promise<void> {
    await pending; // дописываем то, что ещё не ушло в прежнее хранилище
    backend = next;
    cache = null; // если открыть не получится, старые данные из памяти не должны сойти за актуальные

    const [tasks, habits, mood, settings, version] = await Promise.all([
        next.read(KEYS.tasks),
        next.read(KEYS.habits),
        next.read(KEYS.mood),
        next.read(KEYS.settings),
        next.read(KEYS.version),
    ]);
    // Нет версии — данные записаны до появления версий (версия 0)
    const storedVersion = typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : 0;

    const raw: RawData = { tasks, habits, mood, settings };
    const migrated = migrate(raw, storedVersion); // данные из более новой версии: бросает SchemaTooNewError, ничего не записав

    cache = {
        tasks: normalizeTasks(migrated.tasks),
        habits: normalizeHabits(migrated.habits),
        mood: normalizeMood(migrated.mood),
        settings: normalizeSettings(migrated.settings),
    };

    if (storedVersion < SCHEMA_VERSION) {
        const isFirstRun = Object.values(raw).every((v) => v === undefined);
        if (!isFirstRun) {
            // Сначала страховочная копия того, что было, потом новые данные, версия — последней:
            // если запись прервётся, при следующем запуске миграция просто повторится.
            persist(KEYS.migrationBackup, { fromVersion: storedVersion, savedAt: new Date().toISOString(), data: raw });
            commit(KEYS.tasks, false);
            commit(KEYS.habits, false);
            commit(KEYS.mood, false);
            commit(KEYS.settings, false);
        }
        persist(KEYS.version, SCHEMA_VERSION);
        await pending;
    }
}

/** Фиксирует изменение: запись в хранилище + (по умолчанию) сообщение интерфейсу, например колокольчику. */
function commit(key: 'tasks' | 'habits' | 'moodData' | 'userSettings', notify = true): void {
    const s = state();
    persist(key, { tasks: s.tasks, habits: s.habits, moodData: s.mood, userSettings: s.settings }[key]);
    if (notify) emit('datachange');
}

// --- Задачи ---

export function normalizeTasks(raw: unknown): Task[] {
    return toRecords(raw).map((t) => ({
        id: str(t.id) || newId(),
        text: str(t.text),
        date: str(t.date),
        time: /^\d{2}:\d{2}$/.test(str(t.time)) ? str(t.time) : undefined,
        category: str(t.category),
        priority: PRIORITIES.includes(t.priority as Priority) ? (t.priority as Priority) : 'normal',
        notes: str(t.notes),
        // checked/done — поля старых версий приложения
        completed: Boolean(t.completed ?? t.checked ?? t.done),
        completedAt: str(t.completedAt) || undefined,
    }));
}

export function loadTasks(): Task[] {
    return structuredClone(state().tasks);
}

export function saveTasks(tasks: Task[]): void {
    state().tasks = normalizeTasks(tasks);
    commit(KEYS.tasks);
}

// --- Привычки ---

/** Дни недели графика: только целые 0–6 без повторов; пусто или все семь — значит «каждый день» (undefined). */
function sanitizeDays(v: unknown): number[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const days = [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
    return days.length === 0 || days.length === 7 ? undefined : days;
}

export function normalizeHabits(raw: unknown): Habit[] {
    return toRecords(raw).map((h) => ({
        id: str(h.id) || newId(),
        text: str(h.text),
        dates: Array.isArray(h.dates) ? h.dates.filter((d): d is string => typeof d === 'string') : [],
        days: sanitizeDays(h.days),
        archived: h.archived === true ? true : undefined,
    }));
}

export function loadHabits(): Habit[] {
    return structuredClone(state().habits);
}

/** Привычки, которые не в архиве, — их видят все разделы, кроме самого архива. */
export function loadActiveHabits(): Habit[] {
    return loadHabits().filter((h) => !h.archived);
}

export function saveHabits(habits: Habit[]): void {
    state().habits = normalizeHabits(habits);
    commit(KEYS.habits);
}

// --- Настроение ---

export function normalizeMood(raw: unknown): MoodEntry[] {
    return toRecords(raw)
        .map((m) => ({ date: str(m.date), rating: Number(m.rating), note: str(m.note) }))
        .filter((m) => parseDateStr(m.date) !== null && m.rating >= 1 && m.rating <= 5)
        .sort((a, b) => a.date.localeCompare(b.date));
}

export function loadMood(): MoodEntry[] {
    return structuredClone(state().mood);
}

export function saveMood(entries: MoodEntry[]): void {
    state().mood = normalizeMood(entries);
    commit(KEYS.mood);
}

// --- Настройки ---

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function normalizeSettings(raw: unknown): UserSettings {
    const defaults: UserSettings = { themeMode: 'system', userName: '' };
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaults;
    const r = raw as Raw;
    return {
        themeMode: THEME_MODES.includes(r.themeMode as ThemeMode) ? (r.themeMode as ThemeMode) : defaults.themeMode,
        userName: str(r.userName),
    };
}

export function loadSettings(): UserSettings {
    return { ...state().settings };
}

export function saveSettings(patch: Partial<UserSettings>): UserSettings {
    state().settings = normalizeSettings({ ...state().settings, ...patch });
    commit(KEYS.settings);
    return loadSettings();
}
