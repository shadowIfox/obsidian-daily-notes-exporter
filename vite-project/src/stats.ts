// stats.ts — чистые функции статистики (без DOM и localStorage), данные приходят аргументами.

import { addDays, lastNDates, todayStr, weekRange, weekdayIndex } from './dates';
import type { Habit, MoodEntry, Task } from './store';

export type DayCount = { date: string; count: number };
export type MoodSeries = { days: number; points: { i: number; date: string; rating: number }[] };
export type TaskListFilter = 'today' | 'week' | 'overdue';

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

/** Сколько задач выполнено в каждый из последних days дней (по возрастанию, последний — сегодня). */
export function tasksCompletedByDay(tasks: Task[], today: string = todayStr(), days = 7): DayCount[] {
    const counts = new Map(lastNDates(days, today).map((d) => [d, 0]));
    for (const t of tasks) {
        const day = completionDay(t);
        if (day && counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

/** Оценки настроения за последние days дней: позиция дня (0 — самый ранний) и оценка. */
export function moodSeries(entries: MoodEntry[], today: string = todayStr(), days = 14): MoodSeries {
    const dates = lastNDates(days, today);
    const byDate = new Map(entries.map((e) => [e.date, e.rating]));
    const points = dates.flatMap((date, i) => (byDate.has(date) ? [{ i, date, rating: byDate.get(date) as number }] : []));
    return { days, points };
}

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

function byDeadline(a: Task, b: Task): number {
    return (
        a.date.localeCompare(b.date) ||
        (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    );
}

/**
 * Задачи для списка на главной.
 * «Сегодня» и «Просрочено» — только невыполненные.
 * «Неделя» — всё, что назначено на текущую календарную неделю (Пн–Вс): и предстоящее, и просроченное,
 * и уже выполненное (выполненные в конце списка).
 */
export function tasksForList(tasks: Task[], filter: TaskListFilter, today: string = todayStr()): Task[] {
    if (filter === 'week') {
        const { from, to } = weekRange(today);
        const inWeek = tasks.filter((t) => t.date >= from && t.date <= to);
        return [...inWeek.filter((t) => !t.completed).sort(byDeadline), ...inWeek.filter((t) => t.completed).sort(byDeadline)];
    }
    const active = tasks.filter((t) => !t.completed);
    const picked = filter === 'overdue' ? active.filter((t) => t.date && t.date < today) : active.filter((t) => t.date === today);
    return picked.sort(byDeadline);
}

/** Ближайший дедлайн среди невыполненных задач (просроченные идут первыми); null, если дедлайнов нет. */
export function nearestDeadline(tasks: Task[], _today: string = todayStr()): Task | null {
    return tasks.filter((t) => !t.completed && t.date).sort(byDeadline)[0] ?? null;
}

// --- Аналитика за период ---

export type Period = 7 | 30 | 91;

const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Выполненные задачи за окно days дней и за предыдущее окно той же длины (для сравнения). */
export function taskPeriodStats(tasks: Task[], today: string = todayStr(), days: number = 30) {
    const byDay = tasksCompletedByDay(tasks, today, days);
    const total = sum(byDay.map((d) => d.count));
    const prevTotal = sum(tasksCompletedByDay(tasks, addDays(today, -days), days).map((d) => d.count));
    return { byDay, total, prevTotal, perDay: total / days };
}

/** Из выполненных за период задач с дедлайном: сколько закрыто не позже дедлайна. */
export function onTimeStats(tasks: Task[], today: string = todayStr(), days: number = 30) {
    const window = new Set(lastNDates(days, today));
    let withDeadline = 0;
    let onTime = 0;
    for (const t of tasks) {
        if (!t.completed || !t.completedAt || !t.date || !window.has(t.completedAt)) continue;
        withDeadline++;
        if (t.completedAt <= t.date) onTime++;
    }
    return { withDeadline, onTime };
}

/** Суммы по дням недели (Пн…Вс) из посуточных значений. */
export function weekdayTotals(byDay: DayCount[]): number[] {
    const totals = Array<number>(7).fill(0);
    for (const d of byDay) totals[weekdayIndex(d.date)] += d.count;
    return totals;
}

/** Группировка по неделям: последняя группа заканчивается последним днём; дата группы — её первый день. */
export function aggregateWeeks(byDay: DayCount[]): DayCount[] {
    const groups: DayCount[] = [];
    for (let end = byDay.length; end > 0; end -= 7) {
        const chunk = byDay.slice(Math.max(0, end - 7), end);
        groups.unshift({ date: chunk[0].date, count: sum(chunk.map((d) => d.count)) });
    }
    return groups;
}

/** Выполненные за период задачи по категориям: топ-limit, по убыванию. */
export function categoryBreakdown(tasks: Task[], today: string = todayStr(), days: number = 30, limit = 5) {
    const window = new Set(lastNDates(days, today));
    const counts = new Map<string, number>();
    for (const t of tasks) {
        const day = completionDay(t);
        if (!day || !window.has(day)) continue;
        const name = t.category || 'Без категории';
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, limit);
}

/** Процент выполнения привычек за окно: отметки / (привычки × дни); null, если привычек нет. */
export function habitRate(habits: Habit[], today: string = todayStr(), days: number = 30): number | null {
    if (habits.length === 0) return null;
    const window = new Set(lastNDates(days, today));
    const marks = sum(habits.map((h) => h.dates.filter((d) => window.has(d)).length));
    return Math.round((marks / (habits.length * days)) * 100);
}

/** Привычки по дням: для каждой — отметки за окно, процент и текущая серия. */
export function habitPeriodStats(habits: Habit[], today: string = todayStr(), days: number = 30) {
    const dates = lastNDates(days, today);
    const rows = habits.map((h) => {
        const set = new Set(h.dates);
        const marks = dates.map((d) => set.has(d));
        const done = marks.filter(Boolean).length;
        return { id: h.id, text: h.text, marks, done, percent: Math.round((done / days) * 100), streak: getStreak(h.dates, today) };
    });
    return {
        dates,
        rows,
        rate: habitRate(habits, today, days),
        prevRate: habitRate(habits, addDays(today, -days), days),
    };
}

/** Настроение за окно: записи, среднее, распределение [5…1] и среднее за предыдущее окно. */
export function moodPeriodStats(entries: MoodEntry[], today: string = todayStr(), days: number = 30) {
    const avgOf = (list: MoodEntry[]) => (list.length ? round1(sum(list.map((e) => e.rating)) / list.length) : null);
    const inWindow = (end: string) => {
        const from = addDays(end, -(days - 1));
        return entries.filter((e) => e.date >= from && e.date <= end);
    };
    const current = inWindow(today);
    return {
        entries: current,
        avg: avgOf(current),
        prevAvg: avgOf(inWindow(addDays(today, -days))),
        counts: moodCounts(current),
        series: moodSeries(entries, today, days),
    };
}

/** Среднее настроение в дни, когда отмечено не меньше половины привычек, и в остальные дни; null, если данных мало. */
export function moodVsHabits(habits: Habit[], mood: MoodEntry[], today: string = todayStr(), days: number = 30) {
    if (habits.length === 0) return null;
    const rating = new Map(mood.map((m) => [m.date, m.rating]));
    const high: number[] = [];
    const low: number[] = [];
    for (const date of lastNDates(days, today)) {
        const r = rating.get(date);
        if (r === undefined) continue;
        const share = habits.filter((h) => h.dates.includes(date)).length / habits.length;
        (share >= 0.5 ? high : low).push(r);
    }
    if (high.length < 3 || low.length < 3) return null;
    return { high: round1(sum(high) / high.length), low: round1(sum(low) / low.length) };
}
