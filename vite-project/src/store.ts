// store.ts — единственное место, где приложение читает и пишет данные.
// Сейчас бэкенд — localStorage. При переходе на SQLite (Tauri) менять нужно только этот файл.
// Ключи localStorage не менялись, поэтому уже сохранённые данные подхватятся.

import { parseDateStr } from './dates';

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

const KEYS = { tasks: 'tasks', habits: 'habits', mood: 'moodData', settings: 'userSettings' } as const;

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export function newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toRecords(parsed: unknown): Raw[] {
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is Raw => typeof x === 'object' && x !== null);
}

/** Читает JSON из localStorage; при ошибке или отсутствии — пустой массив. */
function readJson(key: string): unknown {
    try {
        return JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
        return [];
    }
}

function write(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
    // Сообщаем интерфейсу (например, колокольчику), что данные изменились
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('datachange'));
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
    return normalizeTasks(readJson(KEYS.tasks));
}

export function saveTasks(tasks: Task[]): void {
    write(KEYS.tasks, tasks);
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
    return normalizeHabits(readJson(KEYS.habits));
}

/** Привычки, которые не в архиве, — их видят все разделы, кроме самого архива. */
export function loadActiveHabits(): Habit[] {
    return loadHabits().filter((h) => !h.archived);
}

export function saveHabits(habits: Habit[]): void {
    write(KEYS.habits, habits);
}

// --- Настроение ---

export function normalizeMood(raw: unknown): MoodEntry[] {
    return toRecords(raw)
        .map((m) => ({ date: str(m.date), rating: Number(m.rating), note: str(m.note) }))
        .filter((m) => parseDateStr(m.date) !== null && m.rating >= 1 && m.rating <= 5)
        .sort((a, b) => a.date.localeCompare(b.date));
}

export function loadMood(): MoodEntry[] {
    return normalizeMood(readJson(KEYS.mood));
}

export function saveMood(entries: MoodEntry[]): void {
    write(KEYS.mood, entries);
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
    try {
        return normalizeSettings(JSON.parse(localStorage.getItem(KEYS.settings) ?? '{}'));
    } catch {
        return normalizeSettings(null);
    }
}

export function saveSettings(patch: Partial<UserSettings>): UserSettings {
    const next = { ...loadSettings(), ...patch };
    write(KEYS.settings, next);
    return next;
}
