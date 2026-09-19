// dashboard.ts — главная страница: приветствие, цветные карточки с графиками,
// список задач и редактируемые детали выбранной задачи.
// Статичная разметка лежит в index.html (#dashboard-section), здесь — данные и события.

import { renderSide, selectDate, setupSide } from './calendar';
import { formatDateShort, todayStr } from './dates';
import { toggleHabitToday } from './habits';
import { icon } from './icons';
import {
    deadlineOverview,
    getStreak,
    habitOverview,
    moodOverview,
    moodSeries,
    nearestDeadline,
    taskOverview,
    tasksCompletedByDay,
    tasksForList,
    type TaskListFilter,
} from './stats';
import { loadHabits, loadMood, loadSettings, loadTasks, type Habit, type Priority, type Task } from './store';
import { setupTaskModal } from './taskModal';
import { removeTask, toggleTask, updateTask } from './todo';
import { plural } from './utils/plural';
import { mountResponsive, renderBars, renderLine } from './viz';

// --- Состояние главной ---
let listFilter: TaskListFilter = 'today';
let selectedId: string | null = null;
let savedFlash = false; // показать «Сохранено» после перерисовки деталей

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

function greetingFor(hour: number): string {
    if (hour < 5) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
}

function setText(selector: string, value: string | number): void {
    const el = $(selector);
    if (el) el.textContent = String(value);
}

// ===== Приветствие и цифры в карточках =====

function renderHeader(tasks: Task[], habits: Habit[], today: string): void {
    const { userName } = loadSettings();
    const name = userName.trim();
    const greeting = greetingFor(new Date().getHours());
    setText('#greeting', name ? `${greeting}, ${name}` : greeting);

    const deadlines = deadlineOverview(tasks, today);
    const habitStats = habitOverview(habits, today);
    const dueNow = deadlines.overdue + deadlines.today;

    let sub = 'Добавьте первую задачу или привычку — и здесь появится сводка дня.';
    if (tasks.length > 0 || habits.length > 0) {
        const parts: string[] = [];
        if (dueNow > 0) parts.push(`${dueNow} ${plural(dueNow, ['задача', 'задачи', 'задач'])} на сегодня и просроченных`);
        if (habitStats.left > 0) parts.push(`${habitStats.left} ${plural(habitStats.left, ['привычка ждёт', 'привычки ждут', 'привычек ждут'])} отметки`);
        sub = parts.length > 0 ? `${parts.join(', ')}.` : 'На сегодня всё сделано — можно отдыхать.';
    }
    setText('#greeting-sub', sub);
    setText('#today-label', new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));
}

function renderNumbers(tasks: Task[], habits: Habit[], today: string): void {
    const taskStats = taskOverview(tasks, today);
    const deadlines = deadlineOverview(tasks, today);
    const habitStats = habitOverview(habits, today);
    const mood = moodOverview(loadMood(), today);

    setText('[data-stat="tasks.done"]', taskStats.done);
    setText('[data-stat="tasks.active"]', taskStats.active);
    setText('[data-stat="tasks.overdue"]', taskStats.overdue);

    setText('[data-stat="mood.avg"]', mood ? mood.avg : '—');
    setText('[data-stat="mood.min"]', mood ? mood.min : '—');
    setText('[data-stat="mood.max"]', mood ? mood.max : '—');

    setText('[data-stat="habits.done"]', habitStats.doneToday);
    setText('[data-stat="habits.left"]', habitStats.left);
    setText('[data-stat="habits.streak"]', habitStats.bestStreak);

    setText('[data-stat="deadlines.overdue"]', deadlines.overdue);
    setText('[data-stat="deadlines.today"]', deadlines.today);
    setText('[data-stat="deadlines.week"]', deadlines.week);
}

// ===== Графики в карточках =====

function renderHabitsViz(habits: Habit[], today: string): void {
    const box = $('#viz-habits');
    if (!box) return;
    box.replaceChildren();

    if (habits.length === 0) {
        box.innerHTML = '<p class="viz__empty">Привычек пока нет — добавьте первую в разделе «Привычки».</p>';
        return;
    }

    // Неотмеченные на сегодня — сверху
    const sorted = [...habits].sort((a, b) => Number(a.dates.includes(today)) - Number(b.dates.includes(today)));
    const list = document.createElement('div');
    list.className = 'mini-list';

    for (const habit of sorted.slice(0, 3)) {
        const row = document.createElement('label');
        row.className = 'mini-row';

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'check';
        check.checked = habit.dates.includes(today);
        check.addEventListener('change', () => {
            toggleHabitToday(habit.id);
            renderDashboard();
        });

        const name = document.createElement('span');
        name.className = 'mini-row__name';
        name.textContent = habit.text;

        const streak = document.createElement('span');
        streak.className = 'chip';
        streak.title = 'Серия дней подряд';
        streak.innerHTML = `${icon('flame', 14)}<span>${getStreak(habit.dates, today)}</span>`;

        row.append(check, name, streak);
        list.appendChild(row);
    }

    if (habits.length > 3) {
        const more = document.createElement('a');
        more.className = 'mini-more';
        more.href = '#/habits';
        more.textContent = `Ещё ${habits.length - 3} →`;
        list.appendChild(more);
    }
    box.appendChild(list);
}

function renderDeadlineViz(tasks: Task[], today: string): void {
    const box = $('#viz-deadline');
    if (!box) return;
    box.replaceChildren();

    const next = nearestDeadline(tasks, today);
    if (!next) {
        box.innerHTML = '<p class="viz__empty">Активных дедлайнов нет.</p>';
        return;
    }

    const row = document.createElement('div');
    row.className = 'mini-row mini-row--static';

    const text = document.createElement('div');
    text.className = 'mini-row__body';
    const label = document.createElement('span');
    label.className = 'mini-row__label';
    label.textContent = next.date < today ? 'Просрочено' : 'Ближайший дедлайн';
    const title = document.createElement('span');
    title.className = 'mini-row__name';
    title.textContent = next.text;
    text.append(label, title);

    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = next.date === today ? 'сегодня' : formatDateShort(next.date);

    row.append(text, pill);
    box.appendChild(row);
}

// ===== Список задач =====

function pillFor(task: Task, today: string): string {
    if (task.time) return task.time;
    if (!task.date) return '—';
    return task.date === today ? 'сегодня' : formatDateShort(task.date);
}

function renderTaskList(tasks: Task[], today: string): Task[] {
    const list = $('#dash-task-list');
    const empty = $('#dash-task-empty');
    const items = tasksForList(tasks, listFilter, today);
    if (!list) return items;
    list.replaceChildren();

    // Выбранная задача может не попасть в этот фильтр — тогда подсвечиваем первую
    if (!selectedId || !tasks.some((t) => t.id === selectedId)) selectedId = items[0]?.id ?? null;

    document.querySelectorAll<HTMLElement>('#dash-list-filter [data-filter]').forEach((btn) => {
        const active = btn.dataset.filter === listFilter;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    if (empty) {
        const messages: Record<TaskListFilter, string> = {
            today: 'На сегодня задач нет.',
            week: 'На ближайшую неделю задач нет.',
            overdue: 'Просроченных задач нет — отлично!',
        };
        empty.textContent = messages[listFilter];
        empty.classList.toggle('hidden', items.length > 0);
    }

    for (const task of items) {
        const li = document.createElement('li');
        li.className = 'pick';
        if (task.id === selectedId) li.setAttribute('aria-current', 'true');

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'check';
        check.checked = task.completed;
        check.setAttribute('aria-label', 'Выполнено');
        check.addEventListener('change', () => {
            toggleTask(task.id);
            renderDashboard();
        });

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'pick__main';
        const title = document.createElement('span');
        title.className = 'pick__title';
        title.textContent = task.text;
        const sub = document.createElement('span');
        sub.className = 'pick__sub';
        sub.textContent = task.category || 'Без категории';
        main.append(title, sub);
        main.addEventListener('click', () => {
            selectedId = task.id;
            renderDashboard();
        });

        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = pillFor(task, today);

        li.append(check, main, pill);
        list.appendChild(li);
    }

    return items;
}

// ===== Детали выбранной задачи =====

const PRIORITY_LABELS: Record<Priority, string> = { low: 'Низкий', normal: 'Обычный', high: 'Высокий' };

function statusOf(task: Task, today: string): string {
    if (task.completed) return 'Выполнена';
    if (task.date && task.date < today) return 'Просрочена';
    if (task.date === today) return 'На сегодня';
    return 'В работе';
}

function renderDetails(tasks: Task[], today: string): void {
    const box = $('#task-details');
    if (!box) return;
    const task = tasks.find((t) => t.id === selectedId);

    if (!task) {
        box.innerHTML = '<p class="viz__empty">Выберите задачу в списке — здесь появятся её детали и редактирование.</p>';
        return;
    }

    // Статичная разметка; пользовательские значения подставляются через .value / textContent
    box.innerHTML = `
    <form class="details" novalidate>
      <div class="details__head">
        <span class="chip" data-role="status"></span>
        <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-role="delete" aria-label="Удалить задачу" title="Удалить">${icon('trash-2', 16)}</button>
      </div>
      <div class="field">
        <label class="field__label" for="d-text">Название</label>
        <input id="d-text" class="input" maxlength="100" />
      </div>
      <div class="details__grid">
        <div class="field"><label class="field__label" for="d-date">Дедлайн</label><input id="d-date" type="date" class="input" /></div>
        <div class="field"><label class="field__label" for="d-time">Время</label><input id="d-time" type="time" class="input" /></div>
        <div class="field"><label class="field__label" for="d-category">Категория</label><input id="d-category" class="input" maxlength="30" /></div>
      </div>
      <div class="field">
        <span class="field__label">Приоритет</span>
        <div class="segmented" role="radiogroup" aria-label="Приоритет">
          ${(['low', 'normal', 'high'] as Priority[])
              .map((p) => `<label class="segmented__opt"><input type="radio" name="d-priority" value="${p}" /><span class="segmented__btn">${PRIORITY_LABELS[p]}</span></label>`)
              .join('')}
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="d-notes">Заметки</label>
        <textarea id="d-notes" class="input" rows="3" placeholder="Подробности, ссылки, что нужно не забыть…"></textarea>
      </div>
      <div class="details__actions">
        <button type="submit" class="btn btn--primary">Сохранить</button>
        <button type="button" class="btn btn--ghost" data-role="toggle"></button>
        <span class="hint" data-role="hint" role="status"></span>
      </div>
    </form>`;

    const form = box.querySelector<HTMLFormElement>('form')!;
    const field = <T extends HTMLElement>(sel: string) => form.querySelector<T>(sel)!;

    field('[data-role="status"]').textContent = statusOf(task, today);
    field<HTMLInputElement>('#d-text').value = task.text;
    field<HTMLInputElement>('#d-date').value = task.date;
    field<HTMLInputElement>('#d-time').value = task.time ?? '';
    field<HTMLInputElement>('#d-category').value = task.category;
    field<HTMLTextAreaElement>('#d-notes').value = task.notes;
    form.querySelectorAll<HTMLInputElement>('input[name="d-priority"]').forEach((r) => {
        r.checked = r.value === task.priority;
    });
    field('[data-role="toggle"]').textContent = task.completed ? 'Вернуть в работу' : 'Отметить выполненной';

    const hint = field('[data-role="hint"]');
    if (savedFlash) {
        savedFlash = false;
        hint.textContent = 'Сохранено';
        window.setTimeout(() => { hint.textContent = ''; }, 2000);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = field<HTMLInputElement>('#d-text').value.trim();
        const time = field<HTMLInputElement>('#d-time').value;
        updateTask(task.id, {
            text: text || task.text, // пустое название не сохраняем
            date: field<HTMLInputElement>('#d-date').value,
            time: time || undefined,
            category: field<HTMLInputElement>('#d-category').value.trim(),
            priority: (form.querySelector<HTMLInputElement>('input[name="d-priority"]:checked')?.value ?? 'normal') as Priority,
            notes: field<HTMLTextAreaElement>('#d-notes').value.trim(),
        });
        savedFlash = true;
        renderDashboard();
    });

    field('[data-role="toggle"]').addEventListener('click', () => {
        toggleTask(task.id);
        renderDashboard();
    });

    field('[data-role="delete"]').addEventListener('click', () => {
        removeTask(task.id);
        selectedId = null;
        renderDashboard();
    });
}

// ===== Публичный API =====

export function renderDashboard(): void {
    const today = todayStr();
    const tasks = loadTasks();
    const habits = loadHabits();

    renderHeader(tasks, habits, today);
    renderNumbers(tasks, habits, today);

    const tasksViz = $('#viz-tasks');
    if (tasksViz) tasksViz.innerHTML = renderBars(tasksCompletedByDay(tasks, today));
    const moodViz = $('#viz-mood');
    if (moodViz) {
        const series = moodSeries(loadMood(), today);
        mountResponsive(moodViz, (width) => renderLine(series, today, width));
    }
    renderHabitsViz(habits, today);
    renderDeadlineViz(tasks, today);

    renderTaskList(tasks, today);
    renderDetails(tasks, today);
    renderSide(tasks, today);
}

/** Один раз навешивает обработчики на статичные элементы главной (фильтр списка). */
export function setupDashboard(): void {
    setupSide({
        onSelectTask: (id) => {
            selectedId = id;
            renderDashboard();
            document.getElementById('dash-details-title')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
        onChange: () => renderDashboard(),
    });

    // Новая задача из календаря: выбираем её день и сразу показываем детали
    setupTaskModal((task) => {
        if (task.date) selectDate(task.date);
        selectedId = task.id;
        renderDashboard();
    });

    $('#dash-list-filter')?.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest<HTMLElement>('button[data-filter]');
        if (!button?.dataset.filter) return;
        listFilter = button.dataset.filter as TaskListFilter;
        selectedId = null; // при смене фильтра выбираем первую задачу нового списка
        renderDashboard();
    });
}
