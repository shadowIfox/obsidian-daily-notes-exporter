// habitDialogs.ts — окна привычки: «Изменить» (название, дни недели, архив, удаление)
// и календарь отметок за любой месяц (можно отметить и прошлые дни).
// Разметка лежит в index.html (#habit-modal, #habit-history).

import { locale, tr } from './i18n';
import { daysInMonth, monthGrid, parseDateStr, todayStr } from './dates';
import { isDue } from './stats';
import type { Habit } from './store';

export type HabitApi = {
    get: (id: string) => Habit | undefined;
    /** Сохранить изменения и перерисовать список привычек. */
    commit: () => void;
    remove: (id: string) => void;
};

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** «Будни», «Выходные» или «Пн · Ср · Пт»; для «каждый день» — пустая строка. */
export function describeDays(days?: number[]): string {
    if (!days) return '';
    const key = days.join(',');
    if (key === '0,1,2,3,4') return tr('Будни');
    if (key === '5,6') return tr('Выходные');
    return days.map((d) => tr(WEEKDAY_LABELS[d])).join(' · ');
}

/** Переключаемые кнопки дней недели. Ничего не выбрано или выбраны все семь — «каждый день» (undefined). */
export function createWeekdayPicker(container: HTMLElement, initial?: number[]) {
    const selected = new Set<number>(initial ?? []);
    const buttons = WEEKDAY_LABELS.map((label, day) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip-btn';
        b.textContent = tr(label);
        b.addEventListener('click', () => {
            if (selected.has(day)) selected.delete(day);
            else selected.add(day);
            sync();
        });
        return b;
    });
    const sync = () =>
        buttons.forEach((b, day) => {
            b.classList.toggle('is-active', selected.has(day));
            b.setAttribute('aria-pressed', String(selected.has(day)));
        });
    container.replaceChildren(...buttons);
    sync();

    return {
        get(): number[] | undefined {
            return selected.size === 0 || selected.size === 7 ? undefined : [...selected].sort((a, b) => a - b);
        },
        set(days?: number[]): void {
            selected.clear();
            (days ?? []).forEach((d) => selected.add(d));
            sync();
        },
    };
}

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ===== Окно «Изменить привычку» =====

let editingId: string | null = null;
let picker: ReturnType<typeof createWeekdayPicker> | null = null;
let deleteArmed = false;

export function openHabitEditor(api: HabitApi, id: string): void {
    const habit = api.get(id);
    const modal = el('habit-modal');
    const days = el('hm-days');
    if (!habit || !modal || !days) return;

    editingId = id;
    deleteArmed = false;
    picker = createWeekdayPicker(days, habit.days);
    el<HTMLInputElement>('hm-name')!.value = habit.text;
    el('hm-delete')!.textContent = tr('Удалить');
    modal.classList.add('is-open');
    el<HTMLInputElement>('hm-name')?.focus();
}

function closeEditor(): void {
    el('habit-modal')?.classList.remove('is-open');
    editingId = null;
}

// ===== Календарь отметок =====

let historyId: string | null = null;
let viewYear = 0;
let viewMonth = 0;

export function openHabitHistory(api: HabitApi, id: string): void {
    const habit = api.get(id);
    const modal = el('habit-history');
    if (!habit || !modal) return;
    historyId = id;
    const now = parseDateStr(todayStr())!;
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    modal.classList.add('is-open');
    renderHistory(api);
}

function closeHistory(): void {
    el('habit-history')?.classList.remove('is-open');
    historyId = null;
}

function renderHistory(api: HabitApi): void {
    const habit = historyId ? api.get(historyId) : undefined;
    const grid = el('hh-grid');
    if (!habit || !grid) return;

    const today = todayStr();
    const marked = new Set(habit.dates);
    const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

    el('hh-title')!.textContent = habit.text;
    el('hh-month')!.textContent = capitalize(
        new Date(viewYear, viewMonth, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, ''),
    );

    // Статистика месяца: только прошедшие дни (включая сегодня), и только по графику
    let dueCount = 0;
    let doneCount = 0;
    for (let day = 1; day <= daysInMonth(`${monthKey}-01`); day++) {
        const date = `${monthKey}-${String(day).padStart(2, '0')}`;
        if (date > today || !isDue(habit, date)) continue;
        dueCount++;
        if (marked.has(date)) doneCount++;
    }
    el('hh-stat')!.textContent =
        dueCount === 0
            ? tr('В этом месяце дней по графику ещё не было.')
            : tr('Отмечено {done} из {due} дней по графику · {pct}%', {
                  done: doneCount,
                  due: dueCount,
                  pct: Math.round((doneCount / dueCount) * 100),
              });

    const isCurrentMonth = monthKey === today.slice(0, 7);
    el<HTMLButtonElement>('hh-next')!.disabled = isCurrentMonth;

    const cells = WEEKDAY_LABELS.map((d) => `<span class="hcal__dow">${tr(d)}</span>`);
    for (const week of monthGrid(viewYear, viewMonth)) {
        for (const date of week) {
            const d = parseDateStr(date)!;
            const inMonth = d.getMonth() === viewMonth;
            const done = marked.has(date);
            const classes = ['hcal__day'];
            if (!inMonth) classes.push('hcal__day--out');
            else if (done) classes.push('hcal__day--done');
            else if (!isDue(habit, date)) classes.push('hcal__day--off');
            else classes.push('hcal__day--due');
            if (date === today) classes.push('hcal__day--today');
            const disabled = !inMonth || date > today;
            const human = d.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
            cells.push(
                `<button type="button" class="${classes.join(' ')}" data-date="${date}" aria-pressed="${done}" aria-label="${human}${done ? `, ${tr('отмечено')}` : ''}"${disabled ? ' disabled' : ''}>${inMonth ? d.getDate() : ''}</button>`,
            );
        }
    }
    grid.innerHTML = cells.join('');
}

// ===== Подключение обработчиков =====

export function setupHabitDialogs(api: HabitApi): void {
    // --- правка ---
    const modal = el('habit-modal');
    const form = el<HTMLFormElement>('habit-modal-form');
    if (modal && form) {
        el('hm-cancel')?.addEventListener('click', closeEditor);
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) closeEditor();
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const habit = editingId ? api.get(editingId) : undefined;
            const name = el<HTMLInputElement>('hm-name')!.value.trim();
            if (!habit || !name) return;
            habit.text = name;
            habit.days = picker?.get();
            closeEditor();
            api.commit();
        });
        el('hm-archive')?.addEventListener('click', () => {
            const habit = editingId ? api.get(editingId) : undefined;
            if (!habit) return;
            habit.archived = true;
            closeEditor();
            api.commit();
        });
        // Удаление стирает историю, поэтому требует второго нажатия
        el('hm-delete')?.addEventListener('click', () => {
            if (!editingId) return;
            if (!deleteArmed) {
                deleteArmed = true;
                el('hm-delete')!.textContent = tr('Точно удалить?');
                return;
            }
            const id = editingId;
            closeEditor();
            api.remove(id);
        });
    }

    // --- календарь отметок ---
    const history = el('habit-history');
    if (history) {
        el('hh-close')?.addEventListener('click', closeHistory);
        history.addEventListener('mousedown', (e) => {
            if (e.target === history) closeHistory();
        });
        el('hh-prev')?.addEventListener('click', () => {
            viewMonth--;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
            }
            renderHistory(api);
        });
        el('hh-next')?.addEventListener('click', () => {
            viewMonth++;
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear++;
            }
            renderHistory(api);
        });
        el('hh-grid')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-date]');
            const habit = historyId ? api.get(historyId) : undefined;
            if (!btn || btn.disabled || !habit || !btn.dataset.date) return;
            const date = btn.dataset.date;
            habit.dates = habit.dates.includes(date) ? habit.dates.filter((d) => d !== date) : [...habit.dates, date];
            api.commit();
            renderHistory(api);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (el('habit-modal')?.classList.contains('is-open')) closeEditor();
        else if (el('habit-history')?.classList.contains('is-open')) closeHistory();
    });
}
