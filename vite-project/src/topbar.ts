// topbar.ts — верхняя панель: дата, поиск (⌘K) и колокольчик с уведомлениями.
// Разметка лежит в index.html (.topbar), здесь — данные и события.

import { focusTask } from './dashboard';
import { todayStr } from './dates';
import { revealHabit } from './habits';
import { icon } from './icons';
import { buildNotices, type Notice } from './notifications';
import { revealMoodEntry } from './mood';
import { navigate, onRouteChange } from './router';
import { searchAll, type Range, type SearchHit, type SearchScope } from './search';
import { loadActiveHabits, loadMood, loadTasks } from './store';

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

const KIND_ICON = { task: 'list-checks', habit: 'repeat', mood: 'smile' } as const;
const GROUP_TITLES = { tasks: 'Задачи', habits: 'Привычки', mood: 'Настроение' } as const;

function nowTime(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Кладёт в element текст, выделяя <mark> найденный фрагмент (без innerHTML — текст пользователя безопасен). */
function fillMarked(el: HTMLElement, text: string, range: Range | null): void {
    el.replaceChildren();
    if (!range) {
        el.textContent = text;
        return;
    }
    const mark = document.createElement('mark');
    mark.textContent = text.slice(range[0], range[1]);
    el.append(text.slice(0, range[0]), mark, text.slice(range[1]));
}

// ===== Поиск =====

let scope: SearchScope = 'all';
let activeIndex = -1;
let rows: HTMLElement[] = [];

function searchEls() {
    return {
        root: $('#search'),
        input: $<HTMLInputElement>('#search-input'),
        panel: $('#search-panel'),
        results: $('#search-results'),
    };
}

function isSearchOpen(): boolean {
    return searchEls().panel?.hidden === false;
}

function openSearch(): void {
    const { input, panel } = searchEls();
    if (!input || !panel) return;
    closeNotifications();
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    renderSearch();
}

function closeSearch(): void {
    const { input, panel } = searchEls();
    if (!input || !panel) return;
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
}

function setActive(index: number): void {
    const { input } = searchEls();
    rows.forEach((r, i) => {
        r.setAttribute('aria-selected', String(i === index));
        if (i === index) r.scrollIntoView({ block: 'nearest' });
    });
    activeIndex = index;
    if (input) {
        if (index >= 0) input.setAttribute('aria-activedescendant', rows[index].id);
        else input.removeAttribute('aria-activedescendant');
    }
}

function activate(hit: SearchHit): void {
    closeSearch();
    searchEls().input?.blur();
    if (hit.kind === 'task') navigate('dashboard', () => focusTask(hit.id));
    else if (hit.kind === 'habit') navigate('habits', () => revealHabit(hit.id));
    else navigate('mood', () => revealMoodEntry(hit.id));
}

function buildRow(hit: SearchHit, index: number): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'search__item';
    row.id = `search-item-${index}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    row.dataset.kind = hit.kind;
    if (hit.done) row.classList.add('search__item--done');

    const badge = document.createElement('span');
    badge.className = 'search__kind';
    badge.innerHTML = icon(KIND_ICON[hit.kind], 16);

    const body = document.createElement('span');
    body.className = 'search__body';
    const title = document.createElement('span');
    title.className = 'search__title';
    fillMarked(title, hit.title, hit.titleRange);
    const sub = document.createElement('span');
    sub.className = 'search__sub';
    fillMarked(sub, hit.sub, hit.subRange);
    body.append(title, sub);
    row.append(badge, body);

    if (hit.meta) {
        const meta = document.createElement('span');
        meta.className = 'pill';
        if (hit.rating) {
            meta.classList.add('pill--mood');
            meta.style.background = `var(--mood-${hit.rating})`;
            meta.style.color = 'var(--on-pastel)';
        }
        meta.textContent = hit.meta;
        row.appendChild(meta);
    }

    row.addEventListener('mousemove', () => {
        if (activeIndex !== index) setActive(index);
    });
    row.addEventListener('click', () => activate(hit));
    return row;
}

function renderSearch(): void {
    const { input, results } = searchEls();
    if (!input || !results) return;
    const query = input.value;
    results.replaceChildren();
    rows = [];
    activeIndex = -1;

    document.querySelectorAll<HTMLElement>('#search-scope [data-scope]').forEach((btn) => {
        const active = btn.dataset.scope === scope;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    if (!query.trim()) {
        const hint = document.createElement('p');
        hint.className = 'search__hint';
        hint.textContent = 'Введите название задачи или привычки, категорию или слова из заметки.';
        results.appendChild(hint);
        return;
    }

    const found = searchAll(query, { tasks: loadTasks(), habits: loadActiveHabits(), mood: loadMood() }, scope);
    let index = 0;
    for (const key of ['tasks', 'habits', 'mood'] as const) {
        const hits = found[key];
        if (hits.length === 0) continue;

        const title = document.createElement('p');
        title.className = 'search__group';
        const count = found.counts[key];
        title.textContent =
            count > hits.length ? `${GROUP_TITLES[key]} · показаны ${hits.length} из ${count}` : `${GROUP_TITLES[key]} · ${count}`;
        results.appendChild(title);

        for (const hit of hits) {
            const row = buildRow(hit, index++);
            rows.push(row);
            results.appendChild(row);
        }
    }

    if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'search__hint';
        empty.textContent = `Ничего не найдено по запросу «${query.trim()}».`;
        results.appendChild(empty);
        return;
    }
    setActive(0);
}

function setupSearch(): void {
    const { root, input } = searchEls();
    if (!root || !input) return;

    // Подсказка про горячую клавишу зависит от системы
    const kbd = $('#search-kbd');
    if (kbd) kbd.textContent = /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';

    input.addEventListener('focus', openSearch);
    input.addEventListener('click', () => {
        if (!isSearchOpen()) openSearch();
    });
    input.addEventListener('input', () => {
        if (!isSearchOpen()) openSearch();
        else renderSearch();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isSearchOpen()) openSearch();
            if (rows.length === 0) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((activeIndex + step + rows.length) % rows.length);
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                rows[activeIndex].click();
            }
        } else if (e.key === 'Escape') {
            if (input.value) {
                input.value = '';
                renderSearch();
            } else {
                closeSearch();
                input.blur();
            }
        }
    });

    $('#search-scope')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-scope]');
        if (!btn?.dataset.scope) return;
        scope = btn.dataset.scope as SearchScope;
        renderSearch();
        input.focus();
    });
    // Клик по кнопке-лупе фокусирует поле
    $('#search-btn')?.addEventListener('click', () => input.focus());

    // Закрытие по клику вне поиска
    document.addEventListener('mousedown', (e) => {
        if (isSearchOpen() && !root.contains(e.target as Node)) closeSearch();
    });

    // ⌘K / Ctrl+K — фокус на поиск из любого места
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            input.focus();
            input.select();
            if (!isSearchOpen()) openSearch();
        }
    });
}

// ===== Колокольчик =====

function currentNotices(): Notice[] {
    return buildNotices(loadTasks(), loadActiveHabits(), loadMood(), todayStr(), nowTime());
}

function isNotifOpen(): boolean {
    return $('#notif-panel')?.hidden === false;
}

function closeNotifications(): void {
    const panel = $('#notif-panel');
    if (!panel) return;
    panel.hidden = true;
    $('#notif-btn')?.setAttribute('aria-expanded', 'false');
}

function renderNotifications(): void {
    const list = $('#notif-list');
    if (!list) return;
    list.replaceChildren();
    const notices = currentNotices();

    if (notices.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'search__hint';
        empty.textContent = 'Всё спокойно — напоминаний нет.';
        list.appendChild(empty);
        return;
    }

    for (const n of notices) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `notice notice--${n.tone}`;
        row.dataset.notice = n.id;

        const dot = document.createElement('span');
        dot.className = 'notice__dot';
        const body = document.createElement('span');
        body.className = 'notice__body';
        const title = document.createElement('span');
        title.className = 'notice__title';
        title.textContent = n.title;
        const detail = document.createElement('span');
        detail.className = 'notice__detail';
        detail.textContent = n.detail;
        body.append(title, detail);
        row.append(dot, body);

        row.addEventListener('click', () => {
            closeNotifications();
            const { taskId } = n;
            navigate(n.route, taskId ? () => focusTask(taskId) : undefined);
        });
        list.appendChild(row);
    }
}

function setupNotifications(): void {
    const btn = $('#notif-btn');
    const panel = $('#notif-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
        if (isNotifOpen()) {
            closeNotifications();
            return;
        }
        closeSearch();
        renderNotifications();
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
    });

    document.addEventListener('mousedown', (e) => {
        if (isNotifOpen() && !$('#notif')?.contains(e.target as Node)) closeNotifications();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isNotifOpen()) {
            closeNotifications();
            btn.focus();
        }
    });
}

// ===== Общее =====

/** Обновляет дату и счётчик на колокольчике (данные читаются из хранилища заново). */
export function refreshTopbar(): void {
    const label = $('#today-label');
    if (label) label.textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

    const count = currentNotices().length;
    const badge = $('#notif-badge');
    if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
    }
    $('#notif-btn')?.setAttribute('aria-label', count > 0 ? `Уведомления: ${count}` : 'Уведомления');
    if (isNotifOpen()) renderNotifications();
}

export function setupTopbar(): void {
    setupSearch();
    setupNotifications();

    // Данные изменились или сменился раздел — обновляем счётчик; панели при переходе закрываем
    let scheduled = false;
    window.addEventListener('datachange', () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            refreshTopbar();
        });
    });
    onRouteChange(() => {
        closeSearch();
        closeNotifications();
        refreshTopbar();
    });
    refreshTopbar();
}
