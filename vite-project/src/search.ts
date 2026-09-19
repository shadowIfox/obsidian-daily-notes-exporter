// search.ts — поиск по задачам, привычкам и заметкам настроения (чистая логика, без DOM).

import { formatDateShort } from './dates';
import { getStreak } from './stats';
import type { Habit, MoodEntry, Task } from './store';

export type SearchScope = 'all' | 'tasks' | 'habits' | 'mood';
export type Range = [number, number];

export type SearchHit = {
    kind: 'task' | 'habit' | 'mood';
    id: string;            // id задачи/привычки; для настроения — дата записи
    title: string;
    titleRange: Range | null;
    sub: string;
    subRange: Range | null;
    meta: string;          // плашка справа: время/дата
    rating?: number;       // только для настроения
    done?: boolean;        // выполненная задача
};

export type SearchResult = {
    tasks: SearchHit[];
    habits: SearchHit[];
    mood: SearchHit[];
    counts: { tasks: number; habits: number; mood: number };
};

const norm = (s: string): string => s.toLowerCase().replace(/ё/g, 'е');

/** Границы первого вхождения query в text (без учёта регистра и ё/е); null, если не найдено. */
export function findRange(text: string, query: string): Range | null {
    const q = norm(query.trim());
    if (!q) return null;
    const t = norm(text);
    if (t.length !== text.length) return null; // редкие символы, у которых длина меняется при смене регистра
    const i = t.indexOf(q);
    return i < 0 ? null : [i, i + q.length];
}

/** Фрагмент вокруг совпадения для длинных текстов, с многоточиями по краям. */
export function snippet(text: string, range: Range, radius = 28): { text: string; range: Range } {
    const start = Math.max(0, range[0] - radius);
    const end = Math.min(text.length, range[1] + radius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    const shift = prefix.length - start;
    return { text: prefix + text.slice(start, end) + suffix, range: [range[0] + shift, range[1] + shift] };
}

type Scored = { hit: SearchHit; score: number; key: string };

function searchTasks(query: string, tasks: Task[]): Scored[] {
    const out: Scored[] = [];
    for (const t of tasks) {
        const inTitle = findRange(t.text, query);
        const inCategory = inTitle ? null : findRange(t.category, query);
        const inNotes = inTitle || inCategory ? null : findRange(t.notes, query);
        if (!inTitle && !inCategory && !inNotes) continue;

        let sub = t.category || 'Без категории';
        let subRange: Range | null = null;
        if (inCategory) subRange = inCategory;
        if (inNotes) {
            const s = snippet(t.notes, inNotes);
            sub = s.text;
            subRange = s.range;
        }
        out.push({
            hit: {
                kind: 'task',
                id: t.id,
                title: t.text,
                titleRange: inTitle,
                sub,
                subRange,
                meta: t.time ?? (t.date ? formatDateShort(t.date) : ''),
                done: t.completed,
            },
            score: inTitle ? (inTitle[0] === 0 ? 0 : 1) : inCategory ? 2 : 3,
            key: (t.completed ? '1' : '0') + (t.date || '9999-99-99'),
        });
    }
    // Сначала невыполненные и лучшие совпадения, затем по ближайшей дате
    return out.sort((a, b) => a.key[0].localeCompare(b.key[0]) || a.score - b.score || a.key.localeCompare(b.key));
}

function searchHabits(query: string, habits: Habit[]): Scored[] {
    const out: Scored[] = [];
    for (const h of habits) {
        const range = findRange(h.text, query);
        if (!range) continue;
        out.push({
            hit: { kind: 'habit', id: h.id, title: h.text, titleRange: range, sub: `серия ${getStreak(h.dates)} дн.`, subRange: null, meta: '' },
            score: range[0] === 0 ? 0 : 1,
            key: h.text,
        });
    }
    return out.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
}

function searchMood(query: string, entries: MoodEntry[]): Scored[] {
    const out: Scored[] = [];
    for (const e of entries) {
        const range = findRange(e.note, query);
        if (!range) continue;
        const s = snippet(e.note, range, 40);
        out.push({
            hit: { kind: 'mood', id: e.date, title: s.text, titleRange: s.range, sub: formatDateShort(e.date), subRange: null, meta: String(e.rating), rating: e.rating },
            score: 0,
            key: e.date,
        });
    }
    return out.sort((a, b) => b.key.localeCompare(a.key)); // свежие записи первыми
}

/** Ищет query в выбранных разделах; в каждой группе возвращает не больше limit результатов. */
export function searchAll(
    query: string,
    data: { tasks: Task[]; habits: Habit[]; mood: MoodEntry[] },
    scope: SearchScope = 'all',
    limit = 6,
): SearchResult {
    const empty: SearchResult = { tasks: [], habits: [], mood: [], counts: { tasks: 0, habits: 0, mood: 0 } };
    if (!query.trim()) return empty;

    const tasks = scope === 'all' || scope === 'tasks' ? searchTasks(query, data.tasks) : [];
    const habits = scope === 'all' || scope === 'habits' ? searchHabits(query, data.habits) : [];
    const mood = scope === 'all' || scope === 'mood' ? searchMood(query, data.mood) : [];

    return {
        tasks: tasks.slice(0, limit).map((s) => s.hit),
        habits: habits.slice(0, limit).map((s) => s.hit),
        mood: mood.slice(0, limit).map((s) => s.hit),
        counts: { tasks: tasks.length, habits: habits.length, mood: mood.length },
    };
}
