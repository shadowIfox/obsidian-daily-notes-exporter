// datePicker.ts — свой календарь вместо родного выбора даты браузера.
//
// Родной календарь <input type="date"> в окне приложения (WKWebView) рисуется системой и не подчиняется стилям.
// Поэтому родное поле остаётся в разметке как источник значения (value = YYYY-MM-DD, min/max, события change),
// но скрыто, а вместо него показывается кнопка с датой; по нажатию открывается календарь в стиле приложения.
// Код, который читает или ставит input.value, менять не нужно.

import { addDays, monthGrid, parseDateStr, todayStr, toDateStr, weekdayIndex } from './dates';
import { icon } from './icons';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const ENHANCED = 'datepickEnhanced';

const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') as PropertyDescriptor;

/** «19 сентября 2026» — как дата показывается на кнопке. */
function formatLong(dateStr: string): string {
    const d = parseDateStr(dateStr);
    return d ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '') : '';
}

function monthTitle(year: number, month: number): string {
    return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
}

// Открыт может быть только один календарь
let openPanel: { close: () => void; owner: HTMLElement } | null = null;

/** Заменяет родные поля даты внутри root (по умолчанию — весь документ). Повторный вызов поля не трогает. */
export function enhanceDateInputs(root: ParentNode = document): void {
    root.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(enhance);
}

function enhance(input: HTMLInputElement): void {
    if (input.dataset[ENHANCED]) return;
    input.dataset[ENHANCED] = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'input datepick';
    button.setAttribute('aria-haspopup', 'dialog');
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    const labelText = label?.textContent?.trim() ?? 'Дата';
    const placeholder = input.dataset.placeholder ?? 'Без даты';

    input.classList.add('datepick__native');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.after(button);
    // клик по подписи или фокус на скрытом поле переходят на видимую кнопку
    input.addEventListener('focus', () => button.focus());

    /** Показывает текущее значение на кнопке. */
    const sync = (): void => {
        const text = formatLong(input.value);
        button.innerHTML = `<span class="datepick__text${text ? '' : ' is-empty'}"></span>${icon('calendar', 16)}`;
        button.firstElementChild!.textContent = text || placeholder;
        button.setAttribute('aria-label', `${labelText}: ${text || placeholder}`);
    };

    // Значение меняют и из кода (input.value = …), и сама форма (reset): кнопка должна это подхватывать
    Object.defineProperty(input, 'value', {
        configurable: true,
        get: () => valueDescriptor.get!.call(input) as string,
        set: (v: string) => {
            valueDescriptor.set!.call(input, v);
            sync();
        },
    });
    input.form?.addEventListener('reset', () => setTimeout(sync, 0));
    input.addEventListener('change', sync);
    input.addEventListener('input', sync);

    button.addEventListener('click', () => {
        // повторное нажатие на «свою» кнопку закрывает календарь; чужой открытый календарь просто закрывается
        const wasOwn = openPanel?.owner === button;
        openPanel?.close();
        openPanel = wasOwn ? null : openCalendar(input, button);
    });
    sync();
}

/** Показывает календарь под кнопкой (или над ней, если снизу не хватает места). Возвращает функцию закрытия. */
function openCalendar(input: HTMLInputElement, button: HTMLButtonElement): NonNullable<typeof openPanel> {
    const today = todayStr();
    const min = input.min || '';
    const max = input.max || '';
    const clearable = input.hasAttribute('data-clearable');
    const selected = input.value;
    let focusDay = selected || (max && today > max ? max : today);
    const start = parseDateStr(focusDay) ?? new Date();
    let year = start.getFullYear();
    let month = start.getMonth();

    const panel = document.createElement('div');
    panel.className = 'datepick__panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Выбор даты');
    document.body.append(panel);

    const disabled = (d: string): boolean => (!!min && d < min) || (!!max && d > max);

    const pick = (d: string | ''): void => {
        input.value = d;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
        button.focus();
    };

    const render = (): void => {
        const cells = monthGrid(year, month)
            .flat()
            .map((d) => {
                const inMonth = parseDateStr(d)?.getMonth() === month;
                const cls = ['datepick__day', inMonth ? '' : 'is-other', d === today ? 'is-today' : '', d === selected ? 'is-selected' : '']
                    .filter(Boolean)
                    .join(' ');
                const dis = disabled(d) ? ' disabled' : '';
                const day = String(parseDateStr(d)?.getDate() ?? '');
                return `<button type="button" class="${cls}" data-date="${d}" tabindex="${d === focusDay ? 0 : -1}"${dis} aria-label="${formatLong(d)}"${d === selected ? ' aria-pressed="true"' : ''}>${day}</button>`;
            })
            .join('');
        panel.innerHTML = `
            <div class="datepick__head">
                <button type="button" class="icon-btn icon-btn--sm" data-nav="-1" aria-label="Предыдущий месяц">${icon('chevron-left', 16)}</button>
                <span class="datepick__title" aria-live="polite">${monthTitle(year, month)}</span>
                <button type="button" class="icon-btn icon-btn--sm" data-nav="1" aria-label="Следующий месяц">${icon('chevron-right', 16)}</button>
            </div>
            <div class="datepick__weekdays" aria-hidden="true">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
            <div class="datepick__grid">${cells}</div>
            <div class="datepick__foot">
                <button type="button" class="datepick__link" data-today${disabled(today) ? ' disabled' : ''}>Сегодня</button>
                ${clearable ? '<button type="button" class="datepick__link" data-clear>Очистить</button>' : ''}
            </div>`;
    };

    const place = (): void => {
        const r = button.getBoundingClientRect();
        const h = panel.offsetHeight;
        const w = panel.offsetWidth;
        const below = window.innerHeight - r.bottom;
        const top = below >= h + 8 || r.top < h + 8 ? r.bottom + 6 : r.top - h - 6;
        panel.style.top = `${Math.max(8, Math.min(top, window.innerHeight - h - 8))}px`;
        panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    };

    const focusCurrent = (): void => panel.querySelector<HTMLElement>(`[data-date="${focusDay}"]`)?.focus();

    /** Переносит выбранный день (стрелками) и, если нужно, переключает месяц. */
    const moveFocus = (d: string): void => {
        const date = parseDateStr(d);
        if (!date) return;
        focusDay = d;
        if (date.getFullYear() !== year || date.getMonth() !== month) {
            year = date.getFullYear();
            month = date.getMonth();
            render();
        } else {
            panel.querySelectorAll<HTMLElement>('.datepick__day').forEach((b) => (b.tabIndex = b.dataset.date === d ? 0 : -1));
        }
        focusCurrent();
    };

    panel.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const nav = target.closest<HTMLElement>('[data-nav]');
        if (nav) {
            const shifted = new Date(year, month + Number(nav.dataset.nav), 1);
            year = shifted.getFullYear();
            month = shifted.getMonth();
            render();
            return;
        }
        const day = target.closest<HTMLButtonElement>('[data-date]');
        if (day && !day.disabled) return pick(day.dataset.date!);
        if (target.closest('[data-today]') && !disabled(today)) return pick(today);
        if (target.closest('[data-clear]')) pick('');
    });

    panel.addEventListener('keydown', (e) => {
        const day = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
        if (!day) return;
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (e.key in steps) {
            e.preventDefault();
            moveFocus(addDays(day.dataset.date!, steps[e.key]));
        } else if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault();
            const d = parseDateStr(day.dataset.date!)!;
            const shifted = new Date(d.getFullYear(), d.getMonth() + (e.key === 'PageUp' ? -1 : 1), 1);
            const last = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
            moveFocus(toDateStr(new Date(shifted.getFullYear(), shifted.getMonth(), Math.min(d.getDate(), last))));
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            moveFocus(
                addDays(day.dataset.date!, e.key === 'Home' ? -weekdayIndex(day.dataset.date!) : 6 - weekdayIndex(day.dataset.date!)),
            );
        }
    });

    const onOutside = (e: MouseEvent): void => {
        const t = e.target as Node;
        if (!panel.contains(t) && !button.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape') return;
        e.stopPropagation(); // Escape закрывает только календарь, а не окно под ним
        close();
        button.focus();
    };
    const onScrollOrResize = (): void => place();

    let closed = false;
    function close(): void {
        if (closed) return;
        closed = true;
        panel.remove();
        document.removeEventListener('mousedown', onOutside, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', onScrollOrResize);
        window.removeEventListener('scroll', onScrollOrResize, true);
        if (openPanel === handle) openPanel = null;
    }
    const handle = { close, owner: button as HTMLElement };

    render();
    place();
    focusCurrent();
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return handle;
}
