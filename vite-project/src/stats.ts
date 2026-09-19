// stats.ts — чистые функции статистики (без DOM и localStorage), данные приходят аргументами.

import { addDays, lastNDates, todayStr, weekdayIndex } from './dates';
import type { Habit, MoodEntry, Task } from './store';

/** Серия дней подряд, заканчивающаяся сегодня. */
export function getStreak(dates: string[], today: string = todayStr()): number {
    const set = new Set(dates);
    let streak = 0;
    for (let day = today; set.has(day); day = addDays(day, -1)) streak++;
    return streak;
}

/** День выполнения задачи. У задач, сохранённых до появления completedAt, берём дедлайн. */
function completionDay(t: Task): string | undefined {
    return t.completed ? t.completedAt || t.date || undefined : undefined;
}

/** Сколько задач выполнено в каждый день недели (Пн…Вс) за последние 7 дней. */
export function tasksCompletedByWeekday(tasks: Task[], today: string = todayStr()): number[] {
    const week = new Set(lastNDates(7, today));
    const stats = Array<number>(7).fill(0);
    for (const t of tasks) {
        const day = completionDay(t);
        if (day && week.has(day)) stats[weekdayIndex(day)]++;
    }
    return stats;
}

/** Сколько дней подряд (до сегодня) выполнялась хотя бы одна задача. */
export function taskStreak(tasks: Task[], today: string = todayStr()): number {
    const days = tasks.map(completionDay).filter((d): d is string => Boolean(d));
    return getStreak(days, today);
}

/** По каждой привычке — сколько из последних 7 дней она отмечена. */
export function habitWeekCounts(habits: Habit[], today: string = todayStr()): number[] {
    const week = new Set(lastNDates(7, today));
    return habits.map((h) => h.dates.filter((d) => week.has(d)).length);
}

/** Сколько раз выбрана каждая оценка: [Отлично(5), Хорошо(4), Нормально(3), Плохо(2), Ужасно(1)]. */
export function moodCounts(entries: MoodEntry[]): number[] {
    const counts = [0, 0, 0, 0, 0];
    for (const m of entries) {
        if (m.rating >= 1 && m.rating <= 5) counts[5 - m.rating]++;
    }
    return counts;
}

/** Индексы наибольшего и наименьшего значений; null, если данных нет или все значения равны. */
export function pickBestWorst(data: number[]): { best: number; worst: number } | null {
    if (data.length === 0 || data.every((v) => v === data[0])) return null;
    return { best: data.indexOf(Math.max(...data)), worst: data.indexOf(Math.min(...data)) };
}

// --- Сводки для главной страницы ---

/** Задачи: выполнено / в работе / просрочено. */
export function taskOverview(tasks: Task[], today: string = todayStr()) {
    const active = tasks.filter((t) => !t.completed);
    return {
        done: tasks.length - active.length,
        active: active.length,
        overdue: active.filter((t) => t.date && t.date < today).length,
    };
}

/** Дедлайны невыполненных задач: просрочено / сегодня / в ближайшие 7 дней. */
export function deadlineOverview(tasks: Task[], today: string = todayStr()) {
    const weekEnd = addDays(today, 7);
    const active = tasks.filter((t) => !t.completed && t.date);
    return {
        overdue: active.filter((t) => t.date < today).length,
        today: active.filter((t) => t.date === today).length,
        week: active.filter((t) => t.date > today && t.date <= weekEnd).length,
    };
}

/** Привычки: отмечено сегодня / осталось / лучшая текущая серия. */
export function habitOverview(habits: Habit[], today: string = todayStr()) {
    const doneToday = habits.filter((h) => h.dates.includes(today)).length;
    return {
        doneToday,
        left: habits.length - doneToday,
        bestStreak: Math.max(0, ...habits.map((h) => getStreak(h.dates, today))),
    };
}

/** Настроение за последние days дней: среднее / минимум / максимум; null, если записей нет. */
export function moodOverview(entries: MoodEntry[], today: string = todayStr(), days = 14) {
    const from = addDays(today, -(days - 1));
    const ratings = entries.filter((e) => e.date >= from && e.date <= today).map((e) => e.rating);
    if (ratings.length === 0) return null;
    return {
        avg: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
        min: Math.min(...ratings),
        max: Math.max(...ratings),
    };
}
