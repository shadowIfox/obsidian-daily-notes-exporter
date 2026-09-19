// dates.ts — даты в ЛОКАЛЬНОМ часовом поясе в формате YYYY-MM-DD.
// toISOString() здесь не используем: он отдаёт UTC, и ночью «сегодня» превращается во «вчера».

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
    return toDateStr(new Date());
}

/**
 * Разбирает YYYY-MM-DD как локальную полночь.
 * new Date('YYYY-MM-DD') считает строку UTC, поэтому для сравнения с локальным «сегодня» не годится.
 */
export function parseDateStr(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // отсекаем несуществующие даты вроде 2026-02-31
    return toDateStr(d) === s ? d : null;
}

export function addDays(dateStr: string, n: number): string {
    const d = parseDateStr(dateStr) ?? new Date();
    d.setDate(d.getDate() + n);
    return toDateStr(d);
}

/** Последние n дат по возрастанию; последняя — today. */
export function lastNDates(n: number, today: string = todayStr()): string[] {
    return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function daysInMonth(dateStr: string = todayStr()): number {
    const d = parseDateStr(dateStr) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** День недели: Пн = 0 … Вс = 6. */
export function weekdayIndex(dateStr: string): number {
    const d = parseDateStr(dateStr);
    return d ? (d.getDay() + 6) % 7 : 0;
}

/** «19 сент.» — короткая дата для интерфейса. */
export function formatDateShort(dateStr: string): string {
    const d = parseDateStr(dateStr);
    return d ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : dateStr;
}
