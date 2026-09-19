// store.ts — единственное место, где приложение читает и пишет данные.
// Сейчас бэкенд — localStorage. При переходе на SQLite (Tauri) менять нужно только этот файл.
// Ключи localStorage не менялись, поэтому уже сохранённые данные подхватятся.

import { parseDateStr } from './dates';

export type Task = {
    id: string;
    text: string;
    date: string;          // дедлайн YYYY-MM-DD, может быть пустым
    category: string;
    completed: boolean;
    completedAt?: string;  // YYYY-MM-DD, когда отмечена выполненной
};

export type Habit = {
    id: string;
    text: string;
    dates: string[];       // дни, когда привычка отмечена (YYYY-MM-DD)
};

export type MoodEntry = {
    date: string;          // YYYY-MM-DD
    rating: number;        // 1–5
    note: string;
};

const KEYS = { tasks: 'tasks', habits: 'habits', mood: 'moodData' } as const;

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export function newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRecords(key: string): Raw[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x): x is Raw => typeof x === 'object' && x !== null);
    } catch {
        return [];
    }
}

function write(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
}

// --- Задачи ---

export function loadTasks(): Task[] {
    return readRecords(KEYS.tasks).map((t) => ({
        id: str(t.id) || newId(),
        text: str(t.text),
        date: str(t.date),
        category: str(t.category),
        // checked/done — поля старых версий приложения
        completed: Boolean(t.completed ?? t.checked ?? t.done),
        completedAt: str(t.completedAt) || undefined,
    }));
}

export function saveTasks(tasks: Task[]): void {
    write(KEYS.tasks, tasks);
}

// --- Привычки ---

export function loadHabits(): Habit[] {
    return readRecords(KEYS.habits).map((h) => ({
        id: str(h.id) || newId(),
        text: str(h.text),
        dates: Array.isArray(h.dates) ? h.dates.filter((d): d is string => typeof d === 'string') : [],
    }));
}

export function saveHabits(habits: Habit[]): void {
    write(KEYS.habits, habits);
}

// --- Настроение ---

export function loadMood(): MoodEntry[] {
    return readRecords(KEYS.mood)
        .map((m) => ({ date: str(m.date), rating: Number(m.rating), note: str(m.note) }))
        .filter((m) => parseDateStr(m.date) !== null && m.rating >= 1 && m.rating <= 5)
        .sort((a, b) => a.date.localeCompare(b.date));
}

export function saveMood(entries: MoodEntry[]): void {
    write(KEYS.mood, entries);
}
