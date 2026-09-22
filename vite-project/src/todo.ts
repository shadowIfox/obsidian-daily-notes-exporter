import { tr } from './i18n';
import { formatDateShort, todayStr } from './dates';
import { icon } from './icons';
import { readPref, writePref } from './prefs';
import { NO_CATEGORY, filterTasks, sortTasks, taskCategories, type TaskSort, type TaskStatus } from './stats';
import {
    ensureMarker,
    loadMarkers,
    loadTasks,
    newId,
    recordMarkerHistory,
    saveTasks,
    type Priority,
    type Subtask,
    type Task,
} from './store';
import { createSubtaskEditor } from './subtaskEditor';

let currentTasks: Task[] = [];
let editHandler: ((task: Task) => void) | null = null;

/** Кто открывает окно правки задачи (подключается в main.ts). */
export function setEditHandler(handler: (task: Task) => void): void {
    editHandler = handler;
}
let currentFilter: TaskStatus = 'all';
let currentCategory = ''; // '' — все категории, NO_CATEGORY — без категории
let currentSort: TaskSort = 'added';

// --- Настройки вида списка запоминаются между запусками ---
const VIEW_KEY = 'taskView';
const SORTS: TaskSort[] = ['added', 'deadline', 'priority', 'title'];
const STATUSES: TaskStatus[] = ['all', 'active', 'completed', 'overdue'];

function loadView(): void {
    try {
        const v = JSON.parse(readPref(VIEW_KEY) ?? '{}');
        if (STATUSES.includes(v.filter)) currentFilter = v.filter;
        if (SORTS.includes(v.sort)) currentSort = v.sort;
        if (typeof v.category === 'string') currentCategory = v.category;
    } catch {
        // повреждённая запись настроек вида — остаются значения по умолчанию
    }
}

function saveView(): void {
    writePref(VIEW_KEY, JSON.stringify({ filter: currentFilter, category: currentCategory, sort: currentSort }));
}

// --- API для других разделов (главная меняет задачи через него, чтобы не разъезжалось состояние) ---
export function toggleTask(id: string): void {
    const task = currentTasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? todayStr() : undefined;
    saveTasks(currentTasks);
    renderTasks();
}

export type NewTask = {
    text: string;
    date: string;
    time?: string;
    category: string;
    priority: Priority;
    notes?: string;
    subtasks?: Subtask[];
};

/**
 * Задача с подпунктами завершена, когда завершены все подпункты — и снята с завершения, как только
 * хоть один подпункт снова не выполнен. Ручная отметка самой задачи (чекбокс в списке) подпункты не трогает.
 */
function syncCompletionFromSubtasks(task: Task): void {
    if (task.subtasks.length === 0) return;
    const allDone = task.subtasks.every((s) => s.completed);
    if (allDone && !task.completed) {
        task.completed = true;
        task.completedAt = todayStr();
    } else if (!allDone && task.completed) {
        task.completed = false;
        task.completedAt = undefined;
    }
}

export function addTask(input: NewTask): Task {
    const task: Task = { id: newId(), completed: false, notes: '', subtasks: [], ...input };
    syncCompletionFromSubtasks(task);
    if (task.category) ensureMarker(task.category); // категория запоминается как маркер — не придётся печатать заново
    currentTasks.push(task);
    saveTasks(currentTasks);
    renderTasks();
    return task;
}

export function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): void {
    const task = currentTasks.find((t) => t.id === id);
    if (!task) return;
    Object.assign(task, patch);
    if ('subtasks' in patch) syncCompletionFromSubtasks(task); // подпункты пришли из окна редактирования — пересчитать
    if (patch.category) ensureMarker(patch.category);
    saveTasks(currentTasks);
    renderTasks();
}

/** Отмечает подпункт выполненным/невыполненным; пересчитывает завершённость самой задачи. */
export function toggleSubtask(taskId: string, subtaskId: string): void {
    const task = currentTasks.find((t) => t.id === taskId);
    const subtask = task?.subtasks.find((s) => s.id === subtaskId);
    if (!task || !subtask) return;
    subtask.completed = !subtask.completed;
    subtask.completedAt = subtask.completed ? todayStr() : undefined;
    syncCompletionFromSubtasks(task);
    saveTasks(currentTasks);
    renderTasks();
}

export function removeTask(id: string): void {
    const task = currentTasks.find((t) => t.id === id);
    if (task?.category) recordMarkerHistory(task.category, task.completed); // задача уйдёт — её вклад в историю маркера остаётся
    currentTasks = currentTasks.filter((t) => t.id !== id);
    saveTasks(currentTasks);
    renderTasks();
}

// --- Создание строки задачи ---
export function createTaskElement(task: Task): HTMLLIElement {
    const li = document.createElement('li');
    li.className = task.completed ? 'task task--done' : 'task';

    // Чекбокс
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'check';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', tr('Выполнено'));

    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Текст задачи (редактируется по двойному клику)
    const spanText = document.createElement('span');
    spanText.className = 'task__text';
    spanText.title = tr('Двойной клик — редактировать');
    spanText.textContent = task.text;

    spanText.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.maxLength = 100;
        input.className = 'input task__edit';
        input.addEventListener('blur', () => {
            if (!input.parentNode) return; // blur мог сработать повторно при замене элемента
            // пустой текст не сохраняем — остаётся прежний
            const text = input.value.trim();
            if (text) task.text = text;
            spanText.textContent = task.text;
            input.parentNode.replaceChild(spanText, input);
            saveTasks(currentTasks);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });
        spanText.parentNode?.replaceChild(input, spanText);
        input.focus();
    });

    // Правая часть: дедлайн, категория, удаление
    const meta = document.createElement('div');
    meta.className = 'task__meta';

    // Даты в формате YYYY-MM-DD сравниваются как строки — это не зависит от часового пояса
    if (task.date) {
        const today = todayStr();
        const badge = document.createElement('span');
        badge.className = 'badge ' + (task.date < today ? 'badge--overdue' : task.date === today ? 'badge--today' : 'badge--upcoming');
        badge.textContent = `${tr('до {date}', { date: formatDateShort(task.date) })}${task.time ? ` ${task.time}` : ''}`;
        badge.title = task.date;
        meta.appendChild(badge);
    }

    if (task.priority === 'high') {
        const important = document.createElement('span');
        important.className = 'badge badge--high';
        important.textContent = tr('Важно');
        meta.appendChild(important);
    }

    if (task.notes) {
        const note = document.createElement('span');
        note.className = 'task__note';
        note.setAttribute('data-tip', task.notes.length > 160 ? `${task.notes.slice(0, 160)}…` : task.notes);
        note.setAttribute('aria-label', tr('Есть заметка'));
        note.innerHTML = icon('sticky-note', 16);
        meta.appendChild(note);
    }

    if (task.category) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = task.category;
        meta.appendChild(chip);
    }

    if (task.subtasks.length > 0) {
        const done = task.subtasks.filter((s) => s.completed).length;
        const progress = document.createElement('span');
        progress.className = 'chip';
        progress.title = tr('Подпункты');
        progress.innerHTML = `${icon('list-checks', 14)}<span>${done}/${task.subtasks.length}</span>`;
        meta.appendChild(progress);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn icon-btn--sm';
    editBtn.setAttribute('aria-label', tr('Изменить задачу'));
    editBtn.title = tr('Изменить');
    editBtn.innerHTML = icon('pencil', 16);
    editBtn.onclick = () => editHandler?.(task);
    meta.appendChild(editBtn);

    // Удаляем по id: индекс в отфильтрованном списке не совпадает с индексом в полном
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-btn icon-btn--sm icon-btn--danger';
    removeBtn.setAttribute('aria-label', tr('Удалить задачу'));
    removeBtn.title = tr('Удалить');
    removeBtn.innerHTML = icon('trash-2', 16);
    removeBtn.onclick = () => removeTask(task.id);
    meta.appendChild(removeBtn);

    const row = document.createElement('div');
    row.className = 'task__row';
    row.append(checkbox, spanText, meta);
    li.appendChild(row);

    if (task.subtasks.length > 0) li.appendChild(createSubtaskList(task));

    return li;
}

// --- Список подпунктов под задачей: только просмотр и отметка; добавляются/удаляются в окне задачи ---
function createSubtaskList(task: Task): HTMLUListElement {
    const list = document.createElement('ul');
    list.className = 'task__subtasks';

    for (const subtask of task.subtasks) {
        const item = document.createElement('li');
        item.className = subtask.completed ? 'subtask subtask--done' : 'subtask';

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'check check--sm';
        check.checked = subtask.completed;
        check.setAttribute('aria-label', tr('Выполнено'));
        check.addEventListener('change', () => toggleSubtask(task.id, subtask.id));

        const text = document.createElement('span');
        text.className = 'subtask__text';
        text.textContent = subtask.text;

        item.append(check, text);
        list.appendChild(item);
    }

    return list;
}

// --- Выпадающий список категорий: перестраивается вместе с данными ---
function renderCategoryOptions(): void {
    const select = document.getElementById('task-category-filter') as HTMLSelectElement | null;
    if (!select) return;
    const categories = taskCategories(currentTasks);
    // выбранная категория могла исчезнуть (задачи удалены или переименованы)
    if (currentCategory && currentCategory !== NO_CATEGORY && !categories.includes(currentCategory)) currentCategory = '';

    select.replaceChildren();
    const add = (value: string, label: string) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        select.appendChild(o);
    };
    add('', tr('Все категории'));
    if (currentTasks.some((t) => !t.category)) add(NO_CATEGORY, tr('Без категории'));
    categories.forEach((c) => add(c, c));
    select.value = currentCategory;
}

/** Подсказки при вводе категории (поле формы и окно задачи используют один и тот же datalist). */
function renderCategoryDatalist(): void {
    const list = document.getElementById('category-options') as HTMLDataListElement | null;
    if (!list) return;
    list.replaceChildren(
        ...loadMarkers().map((m) => {
            const o = document.createElement('option');
            o.value = m.name;
            return o;
        }),
    );
}

// --- Рендер списка задач с учётом фильтра, категории и сортировки ---
function renderTasks() {
    const taskList = document.getElementById('task-list') as HTMLUListElement | null;
    const emptyMsg = document.getElementById('empty-list-msg');
    if (!taskList) return;
    taskList.innerHTML = '';

    renderCategoryOptions();
    renderCategoryDatalist();
    const sortSelect = document.getElementById('task-sort') as HTMLSelectElement | null;
    if (sortSelect) sortSelect.value = currentSort;

    const filteredTasks = sortTasks(filterTasks(currentTasks, { status: currentFilter, category: currentCategory }), currentSort);

    filteredTasks.forEach((task) => {
        taskList.appendChild(createTaskElement(task));
    });

    // Плейсхолдер если задач нет
    if (emptyMsg) {
        emptyMsg.textContent =
            currentTasks.length === 0 ? tr('Задач пока нет — добавьте первую выше.') : tr('По выбранным условиям задач нет.');
        emptyMsg.classList.toggle('hidden', filteredTasks.length > 0);
    }

    // Прогресс
    updateProgress();
}

// --- Прогресс-бар и текст ---
function updateProgress() {
    const completed = currentTasks.filter((t) => t.completed).length;
    const total = currentTasks.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = tr('Выполнено: {completed} из {total}', { completed, total });
}

// --- Фильтры ---
function setupFilters() {
    const filterContainer = document.getElementById('todo-filters');
    if (!filterContainer) return;

    const highlight = (active: Element | null) => {
        Array.from(filterContainer.children).forEach((btn) => {
            const isActive = btn === active;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    };

    // Сразу подсвечиваем текущий фильтр (по умолчанию «Все»)
    highlight(filterContainer.querySelector(`[data-filter="${currentFilter}"]`));

    document.getElementById('task-category-filter')?.addEventListener('change', (e) => {
        currentCategory = (e.target as HTMLSelectElement).value;
        saveView();
        renderTasks();
    });
    document.getElementById('task-sort')?.addEventListener('change', (e) => {
        currentSort = (e.target as HTMLSelectElement).value as TaskSort;
        saveView();
        renderTasks();
    });

    filterContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLElement>('button[data-filter]');
        if (button && button.dataset.filter) {
            currentFilter = button.dataset.filter as TaskStatus;
            saveView();
            renderTasks();
            highlight(button);
        }
    });
}

// --- Кнопка «Сегодня» в дате ---
function setupTodayBtn() {
    const btn = document.getElementById('today-btn') as HTMLButtonElement | null;
    const dateInput = document.getElementById('task-date') as HTMLInputElement | null;
    if (btn && dateInput) {
        btn.addEventListener('click', () => {
            dateInput.value = todayStr();
            dateInput.focus();
        });
    }
}

// --- Инициализация секции Todo ---
export function setupTodo() {
    const form = document.getElementById('add-task-form') as HTMLFormElement | null;
    const textInput = document.getElementById('task-text') as HTMLInputElement | null;
    const dateInput = document.getElementById('task-date') as HTMLInputElement | null;
    const timeInput = document.getElementById('task-time') as HTMLInputElement | null;
    const categoryInput = document.getElementById('task-category') as HTMLInputElement | null;
    const notesInput = document.getElementById('task-notes') as HTMLTextAreaElement | null;
    const subtaskEditor = createSubtaskEditor('task-subtasks', 'task-subtask-input', 'task-subtask-add');

    currentTasks = loadTasks();
    loadView();
    renderTasks();
    setupFilters();
    setupClearCompleted();
    setupTodayBtn();

    if (!form || !textInput || !dateInput || !timeInput || !categoryInput || !notesInput) {
        console.log('Не найдены нужные элементы формы!');
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = textInput.value.trim();
        if (!text) return;

        const time = timeInput.value;
        // Время без даты не попало бы в расписание дня — считаем, что задача на сегодня
        const date = dateInput.value || (time ? todayStr() : '');
        const priority = (form.querySelector<HTMLInputElement>('input[name="task-priority"]:checked')?.value ?? 'normal') as Priority;

        addTask({
            text,
            date,
            time: time || undefined,
            category: categoryInput.value.trim(),
            priority,
            notes: notesInput.value.trim(),
            subtasks: subtaskEditor.get(),
        });
        form.reset(); // приоритет возвращается к «Обычный» (у него checked в разметке)
        subtaskEditor.set([]); // form.reset() список подпунктов не трогает — очищаем отдельно
    });
}

// --- Очистка выполненных ---
function setupClearCompleted() {
    document.getElementById('clear-completed')?.addEventListener('click', () => {
        for (const t of currentTasks) {
            if (t.completed && t.category) recordMarkerHistory(t.category, true);
        }
        currentTasks = currentTasks.filter((t) => !t.completed);
        saveTasks(currentTasks);
        renderTasks();
    });
}
