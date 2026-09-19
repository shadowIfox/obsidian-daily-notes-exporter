// notifications.ts — что стоит показать в колокольчике (чистая логика, без DOM).

import { isDue } from './stats';
import { plural } from './utils/plural';
import type { Habit, MoodEntry, Task } from './store';

export type NoticeTone = 'danger' | 'info' | 'habit' | 'mood';

export type Notice = {
    id: string;
    tone: NoticeTone;
    title: string;
    detail: string;
    route: 'dashboard' | 'habits' | 'mood';
    taskId?: string; // открыть эту задачу на главной
};

/** С какого времени напоминать, что настроение за день не записано. */
export const MOOD_REMINDER_FROM = '16:00';

/**
 * Список уведомлений на сейчас:
 * просроченные задачи, задачи на сегодня, привычки без отметки, незаписанное настроение.
 * now — время в формате HH:MM.
 */
export function buildNotices(tasks: Task[], habits: Habit[], mood: MoodEntry[], today: string, now: string): Notice[] {
    const notices: Notice[] = [];
    const active = tasks.filter((t) => !t.completed && t.date);

    const overdue = active.filter((t) => t.date < today).sort((a, b) => a.date.localeCompare(b.date));
    if (overdue.length > 0) {
        const rest = overdue.length - 1;
        notices.push({
            id: 'overdue',
            tone: 'danger',
            title: `Просрочено: ${overdue.length} ${plural(overdue.length, ['задача', 'задачи', 'задач'])}`,
            detail: rest > 0 ? `${overdue[0].text} и ещё ${rest}` : overdue[0].text,
            route: 'dashboard',
            taskId: overdue[0].id,
        });
    }

    const todays = active.filter((t) => t.date === today).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    if (todays.length > 0) {
        const upcoming = todays.find((t) => t.time && t.time >= now);
        const focus = upcoming ?? todays[0];
        notices.push({
            id: 'today',
            tone: 'info',
            title: `На сегодня: ${todays.length} ${plural(todays.length, ['задача', 'задачи', 'задач'])}`,
            detail: upcoming ? `Ближайшая в ${upcoming.time} — ${upcoming.text}` : focus.text,
            route: 'dashboard',
            taskId: focus.id,
        });
    }

    const pending = habits.filter((h) => isDue(h, today) && !h.dates.includes(today));
    if (pending.length > 0) {
        const names = pending
            .slice(0, 2)
            .map((h) => h.text)
            .join(', ');
        notices.push({
            id: 'habits',
            tone: 'habit',
            title: `Привычек без отметки: ${pending.length}`,
            detail: pending.length > 2 ? `${names} и ещё ${pending.length - 2}` : names,
            route: 'habits',
        });
    }

    if (now >= MOOD_REMINDER_FROM && !mood.some((m) => m.date === today)) {
        notices.push({
            id: 'mood',
            tone: 'mood',
            title: 'Настроение за сегодня не записано',
            detail: 'Оцените день — это займёт пару секунд',
            route: 'mood',
        });
    }

    return notices;
}
