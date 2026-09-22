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
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './i18n';
import { migrate, SCHEMA_VERSION, type RawData } from './migrations';
import { localStorageBackend, type StorageBackend, type StoreKey } from './storage';
import { newId } from './utils/id';

export { newId };

export type Priority = 'low' | 'normal' | 'high';

/** Подпункт задачи: свой чекбокс, своя дата выполнения — считается в статистике наравне с задачами. */
export type Subtask = {
    id: string;
    text: string;
    completed: boolean;
    completedAt?: string; // YYYY-MM-DD, когда отмечен выполненным
};

export type Task = {
    id: string;
    text: string;
    date: string; // дедлайн YYYY-MM-DD, может быть пустым
    time?: string; // время HH:MM, необязательно
    category: string;
    priority: Priority;
    notes: string;
    completed: boolean;
    completedAt?: string; // YYYY-MM-DD, когда отмечена выполненной
    subtasks: Subtask[]; // подпункты; пока не заведены — пустой массив
};

/**
 * Маркер — категория задачи, вынесенная в отдельную сущность: список переживает удаление задач,
 * а historyTotal/historyCompleted — счётчик задач, которые уже удалены (см. recordMarkerHistory).
 * Текущие (ещё не удалённые) задачи с этой категорией считаются поверх этих чисел — см. markerStats в stats.ts.
 */
export type Marker = {
    id: string;
    name: string;
    historyTotal: number;
    historyCompleted: number;
};

export type Habit = {
    id: string;
    text: string;
    dates: string[]; // дни, когда привычка отмечена (YYYY-MM-DD)
    days?: number[]; // дни недели по графику (Пн = 0 … Вс = 6); нет — каждый день
    archived?: boolean; // в архиве: не показывается и не учитывается, но история сохранена
};

export type MoodEntry = {
    date: string; // YYYY-MM-DD
    rating: number; // 1–5
    note: string;
};

export type ThemeMode = 'system' | 'light' | 'dark';

/** Системные уведомления (приложение для Mac). Времена — «ЧЧ:ММ». Расписание считает Rust (src-tauri/src/notify.rs) по этим же полям. */
export type NotificationSettings = {
    enabled: boolean; // главный переключатель: пока выключен, ничего не приходит
    dayStart: string; // начало дня: с этого времени идут утренние уведомления
    taskAtDayStart: boolean; // в начале дня — по уведомлению на каждую задачу со временем
    taskBeforeDeadline: boolean; // за 2 часа до срока задачи
    repeatEnabled: boolean; // повторное напоминание о несделанном на сегодня
    repeatTime: string;
    morningDigest: boolean; // утренняя сводка: задачи, просроченное, привычки
    eveningEnabled: boolean; // итоги дня и напоминание про настроение
    eveningTime: string;
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
    enabled: false,
    dayStart: '09:00',
    taskAtDayStart: true,
    taskBeforeDeadline: true,
    repeatEnabled: false,
    repeatTime: '18:00',
    morningDigest: false,
    eveningEnabled: false,
    eveningTime: '21:00',
};

export type UserSettings = {
    themeMode: ThemeMode;
    userName: string;
    language: Language;
    notifications: NotificationSettings;
};

const PRIORITIES: Priority[] = ['low', 'normal', 'high'];

const KEYS = {
    tasks: 'tasks',
    habits: 'habits',
    mood: 'moodData',
    settings: 'userSettings',
    markers: 'categoryMarkers',
    version: 'schemaVersion',
    migrationBackup: 'migrationBackup',
} as const satisfies Record<string, StoreKey>;

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const nonNegInt = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : fallback;

function toRecords(parsed: unknown): Raw[] {
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is Raw => typeof x === 'object' && x !== null);
}

// --- Кэш в памяти и очередь записи ---

type Snapshot = { tasks: Task[]; habits: Habit[]; mood: MoodEntry[]; settings: UserSettings; markers: Marker[] };

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

    const [tasks, habits, mood, settings, markers, version] = await Promise.all([
        next.read(KEYS.tasks),
        next.read(KEYS.habits),
        next.read(KEYS.mood),
        next.read(KEYS.settings),
        next.read(KEYS.markers),
        next.read(KEYS.version),
    ]);
    // Нет версии — данные записаны до появления версий (версия 0)
    const storedVersion = typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : 0;

    const raw: RawData = { tasks, habits, mood, settings, markers };
    const migrated = migrate(raw, storedVersion); // данные из более новой версии: бросает SchemaTooNewError, ничего не записав

    cache = {
        tasks: normalizeTasks(migrated.tasks),
        habits: normalizeHabits(migrated.habits),
        mood: normalizeMood(migrated.mood),
        settings: normalizeSettings(migrated.settings),
        markers: normalizeMarkers(migrated.markers),
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
            commit(KEYS.markers, false);
        }
        persist(KEYS.version, SCHEMA_VERSION);
        await pending;
    }
}

/** Фиксирует изменение: запись в хранилище + (по умолчанию) сообщение интерфейсу, например колокольчику. */
function commit(key: 'tasks' | 'habits' | 'moodData' | 'userSettings' | 'categoryMarkers', notify = true): void {
    const s = state();
    persist(key, { tasks: s.tasks, habits: s.habits, moodData: s.mood, userSettings: s.settings, categoryMarkers: s.markers }[key]);
    if (notify) emit('datachange');
}

// --- Задачи ---

function normalizeSubtasks(raw: unknown): Subtask[] {
    return toRecords(raw).map((s) => ({
        id: str(s.id) || newId(),
        text: str(s.text),
        completed: Boolean(s.completed),
        completedAt: str(s.completedAt) || undefined,
    }));
}

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
        subtasks: normalizeSubtasks(t.subtasks),
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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Приводит сохранённые настройки уведомлений к правильному виду: неизвестное или битое заменяется значениями по умолчанию. */
export function normalizeNotifications(raw: unknown): NotificationSettings {
    const d = DEFAULT_NOTIFICATIONS;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
    const r = raw as Raw;
    const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
    const time = (v: unknown, fallback: string): string => (typeof v === 'string' && TIME_RE.test(v) ? v : fallback);
    return {
        enabled: flag(r.enabled, d.enabled),
        dayStart: time(r.dayStart, d.dayStart),
        taskAtDayStart: flag(r.taskAtDayStart, d.taskAtDayStart),
        taskBeforeDeadline: flag(r.taskBeforeDeadline, d.taskBeforeDeadline),
        repeatEnabled: flag(r.repeatEnabled, d.repeatEnabled),
        repeatTime: time(r.repeatTime, d.repeatTime),
        morningDigest: flag(r.morningDigest, d.morningDigest),
        eveningEnabled: flag(r.eveningEnabled, d.eveningEnabled),
        eveningTime: time(r.eveningTime, d.eveningTime),
    };
}

export function normalizeSettings(raw: unknown): UserSettings {
    const defaults: UserSettings = {
        themeMode: 'system',
        userName: '',
        language: DEFAULT_LANGUAGE,
        notifications: { ...DEFAULT_NOTIFICATIONS },
    };
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaults;
    const r = raw as Raw;
    return {
        themeMode: THEME_MODES.includes(r.themeMode as ThemeMode) ? (r.themeMode as ThemeMode) : defaults.themeMode,
        userName: str(r.userName),
        language: isLanguage(r.language) ? r.language : defaults.language,
        notifications: normalizeNotifications(r.notifications),
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

// --- Маркеры (категории задач как отдельная сущность) ---

export function normalizeMarkers(raw: unknown): Marker[] {
    return toRecords(raw)
        .map((m) => ({
            id: str(m.id) || newId(),
            name: str(m.name).trim(),
            historyTotal: nonNegInt(m.historyTotal),
            historyCompleted: nonNegInt(m.historyCompleted),
        }))
        .filter((m) => m.name);
}

export function loadMarkers(): Marker[] {
    return structuredClone(state().markers);
}

/** Полная замена списка маркеров — для восстановления из резервной копии (см. backup.ts). */
export function saveMarkers(markers: Marker[]): void {
    state().markers = normalizeMarkers(markers);
    commit(KEYS.markers);
}

/** Регистрирует маркер по имени, если такого ещё нет; пустое имя игнорируется. Вызывается при сохранении задачи с категорией. */
export function ensureMarker(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const markers = state().markers;
    if (markers.some((m) => m.name === trimmed)) return;
    state().markers = [...markers, { id: newId(), name: trimmed, historyTotal: 0, historyCompleted: 0 }];
    commit(KEYS.markers);
}

/**
 * Переносит финальное состояние удаляемой задачи в историю её маркера — счётчик переживает удаление задачи,
 * а вместе с текущими (ещё не удалёнными) задачами той же категории даёт полную статистику (см. markerStats в stats.ts).
 */
export function recordMarkerHistory(category: string, wasCompleted: boolean): void {
    const trimmed = category.trim();
    if (!trimmed) return;
    const markers = state().markers;
    const existing = markers.find((m) => m.name === trimmed);
    state().markers = existing
        ? markers.map((m) =>
              m === existing
                  ? { ...m, historyTotal: m.historyTotal + 1, historyCompleted: m.historyCompleted + (wasCompleted ? 1 : 0) }
                  : m,
          )
        : [...markers, { id: newId(), name: trimmed, historyTotal: 1, historyCompleted: wasCompleted ? 1 : 0 }];
    commit(KEYS.markers);
}
