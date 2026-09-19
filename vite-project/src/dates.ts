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

/** Номер недели по ISO 8601 (неделя начинается в понедельник; первая — та, где четверг первого января). */
export function isoWeek(dateStr: string): number {
    const d = parseDateStr(dateStr);
    if (!d) return 0;
    const mondayIndex = (d.getDay() + 6) % 7;
    const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex + 3);
    const jan4 = new Date(thursday.getFullYear(), 0, 4);
    const week1Thursday = new Date(thursday.getFullYear(), 0, 4 - ((jan4.getDay() + 6) % 7) + 3);
    return 1 + Math.round((thursday.getTime() - week1Thursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/** Сетка месяца для календаря: 6 недель по 7 дней, неделя с понедельника (month: 0–11). */
export function monthGrid(year: number, month: number): string[][] {
    const first = new Date(year, month, 1);
    const start = addDays(toDateStr(first), -((first.getDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

/** Календарная неделя, в которую входит день: с понедельника по воскресенье. */
export function weekRange(dateStr: string): { from: string; to: string } {
    const from = addDays(dateStr, -weekdayIndex(dateStr));
    return { from, to: addDays(from, 6) };
}
