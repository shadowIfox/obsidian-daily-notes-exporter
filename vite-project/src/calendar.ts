// calendar.ts — правая колонка главной: календарь месяца и расписание выбранного дня.
// Разметка лежит в index.html (.dash__side), здесь — данные и события.

import { isoWeek, monthGrid, parseDateStr } from './dates';
import type { Priority, Task } from './store';
import { openTaskModal } from './taskModal';
import { toggleTask } from './todo';
import { plural } from './utils/plural';

export type SideHandlers = {
    /** Клик по задаче в расписании: показать её детали. */
    onSelectTask: (id: string) => void;
    /** Данные изменились (например, отмечена задача) — перерисовать главную. */
    onChange: () => void;
};

// --- Состояние ---
let selectedDate: string | null = null; // null — «сегодня»
let viewYear: number | null = null;
let viewMonth = 0;
let timelineFilter: 'all' | 'active' = 'all';
let handlers: SideHandlers | null = null;
let lastTasks: Task[] = [];
let lastToday = '';

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Дата, выбранная в календаре (по умолчанию — сегодня). */
export function getSelectedDate(today: string): string {
    return selectedDate ?? today;
}

function showMonthOf(date: string): void {
    const d = parseDateStr(date);
    if (!d) return;
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
}

/** Программно выбрать день (например, после добавления задачи на другую дату). */
export function selectDate(date: string): void {
    selectedDate = date;
    showMonthOf(date);
}

// ===== Календарь =====

function renderCalendar(tasks: Task[], today: string): void {
    const grid = $('#cal-grid');
    const label = $('#cal-month');
    if (!grid || !label || viewYear === null) return;

    label.textContent = capitalize(
        new Date(viewYear, viewMonth, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, ''),
    );

    // Сколько задач на каждый день: активных, выполненных, есть ли просроченные
    const byDate = new Map<string, { active: number; done: number }>();
    for (const t of tasks) {
        if (!t.date) continue;
        const entry = byDate.get(t.date) ?? { active: 0, done: 0 };
        if (t.completed) entry.done++;
        else entry.active++;
        byDate.set(t.date, entry);
    }

    const sel = getSelectedDate(today);
    const cells: string[] = ['<span></span>', ...WEEKDAYS.map((d) => `<span class="cal__dow">${d}</span>`)];

    for (const week of monthGrid(viewYear, viewMonth)) {
        cells.push(`<span class="cal__week" title="Неделя ${isoWeek(week[0])}">${isoWeek(week[0])}</span>`);
        for (const date of week) {
            const d = parseDateStr(date)!;
            const info = byDate.get(date);
            const total = (info?.active ?? 0) + (info?.done ?? 0);
            const classes = ['cal__day'];
            if (d.getMonth() !== viewMonth) classes.push('cal__day--out');
            if (date === today) classes.push('cal__day--today');
            let dot = '';
            if (info) {
                const kind = info.active === 0 ? 'cal__dot--done' : date < today ? 'cal__dot--overdue' : '';
                dot = `<span class="cal__dot ${kind}"></span>`;
            }
            const human = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            const aria = `${human}${total ? `, задач: ${total}` : ''}`;
            cells.push(
                `<button type="button" class="${classes.join(' ')}" data-date="${date}" aria-pressed="${date === sel}" aria-label="${aria}">${d.getDate()}${dot}</button>`,
            );
        }
    }
    grid.innerHTML = cells.join('');
}

// ===== Расписание дня =====

function nowTime(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildCard(task: Task, isNext: boolean): HTMLElement {
    const card = document.createElement('div');
    card.className = 'tl__card';
    if (task.completed) card.classList.add('tl__card--done');
    else if (isNext) card.classList.add('tl__card--next');
    else if (task.priority === 'high') card.classList.add('tl__card--high');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'check';
    check.checked = task.completed;
    check.setAttribute('aria-label', 'Выполнено');
    check.addEventListener('change', () => {
        toggleTask(task.id);
        handlers?.onChange();
    });

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'tl__main';
    const title = document.createElement('span');
    title.className = 'tl__title';
    title.textContent = task.text;
    const sub = document.createElement('span');
    sub.className = 'tl__sub';
    sub.textContent = [task.category || 'Без категории', task.priority === 'high' ? 'важно' : ''].filter(Boolean).join(' · ');
    main.append(title, sub);
    main.addEventListener('click', () => handlers?.onSelectTask(task.id));

    card.append(check, main);
    return card;
}

function renderTimeline(tasks: Task[], today: string): void {
    const box = $('#tl');
    if (!box) return;
    const sel = getSelectedDate(today);

    const d = parseDateStr(sel);
    const items = tasks.filter((t) => t.date === sel && (timelineFilter === 'all' || !t.completed));
    const all = tasks.filter((t) => t.date === sel).length;

    const heading = $('#tl-title');
    if (heading && d) heading.textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const sub = $('#tl-sub');
    if (sub && d) {
        const weekday = d.toLocaleDateString('ru-RU', { weekday: 'long' });
        sub.textContent = `${weekday}${sel === today ? ' · сегодня' : ''} · ${all} ${plural(all, ['задача', 'задачи', 'задач'])}`;
    }
    document.querySelectorAll<HTMLElement>('#tl-filter [data-filter]').forEach((btn) => {
        const active = btn.dataset.filter === timelineFilter;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    box.replaceChildren();

    if (items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = all > 0 ? 'Все задачи этого дня выполнены.' : 'На этот день задач нет.';
        box.appendChild(empty);
        return;
    }

    const allDay = items
        .filter((t) => !t.time)
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.text.localeCompare(b.text));
    const timed = items.filter((t) => t.time).sort((a, b) => (a.time as string).localeCompare(b.time as string));

    const isToday = sel === today;
    const now = nowTime();
    // Ближайшая по времени активная задача сегодня — подсвечивается жёлтым
    const next = isToday ? timed.find((t) => !t.completed && (t.time as string) >= now) : undefined;

    const row = (time: string, content: HTMLElement): HTMLElement => {
        const r = document.createElement('div');
        r.className = 'tl__row';
        const t = document.createElement('span');
        t.className = 'tl__time';
        t.textContent = time;
        r.append(t, content);
        return r;
    };

    if (allDay.length > 0) {
        const group = document.createElement('div');
        group.className = 'tl__group';
        for (const task of allDay) group.appendChild(buildCard(task, false));
        box.appendChild(row('Весь день', group));
    }

    let nowPlaced = !isToday || timed.length === 0;
    for (const task of timed) {
        if (!nowPlaced && (task.time as string) > now) {
            box.appendChild(buildNowLine(now));
            nowPlaced = true;
        }
        box.appendChild(row(task.time as string, buildCard(task, task.id === next?.id)));
    }
    if (!nowPlaced) box.appendChild(buildNowLine(now));
}

function buildNowLine(now: string): HTMLElement {
    const line = document.createElement('div');
    line.className = 'tl__now';
    line.setAttribute('aria-label', `Сейчас ${now}`);
    const pill = document.createElement('span');
    pill.className = 'tl__now-pill';
    pill.textContent = now;
    const rule = document.createElement('span');
    rule.className = 'tl__now-line';
    line.append(pill, rule);
    return line;
}

// ===== Публичный API =====

/** Перерисовывает календарь и расписание. */
export function renderSide(tasks: Task[], today: string): void {
    lastTasks = tasks;
    lastToday = today;
    if (viewYear === null) showMonthOf(getSelectedDate(today));
    renderCalendar(tasks, today);
    renderTimeline(tasks, today);
}

/** Один раз навешивает обработчики на статичные элементы правой колонки. */
export function setupSide(h: SideHandlers): void {
    handlers = h;

    $('#cal-prev')?.addEventListener('click', () => {
        viewMonth--;
        if (viewMonth < 0) {
            viewMonth = 11;
            viewYear = (viewYear ?? new Date().getFullYear()) - 1;
        }
        renderSide(lastTasks, lastToday);
    });
    $('#cal-next')?.addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 11) {
            viewMonth = 0;
            viewYear = (viewYear ?? new Date().getFullYear()) + 1;
        }
        renderSide(lastTasks, lastToday);
    });
    $('#cal-today')?.addEventListener('click', () => {
        selectedDate = null;
        showMonthOf(lastToday);
        renderSide(lastTasks, lastToday);
    });
    $('#cal-grid')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
        if (!btn?.dataset.date) return;
        selectDate(btn.dataset.date);
        renderSide(lastTasks, lastToday);
    });
    $('#tl-filter')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-filter]');
        if (!btn?.dataset.filter) return;
        timelineFilter = btn.dataset.filter as 'all' | 'active';
        renderSide(lastTasks, lastToday);
    });
    $('#cal-add')?.addEventListener('click', () => openTaskModal({ date: getSelectedDate(lastToday) }));
}
