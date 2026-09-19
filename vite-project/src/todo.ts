import { formatDateShort, todayStr } from './dates';
import { icon } from './icons';
import { loadTasks, newId, saveTasks, type Priority, type Task } from './store';

let currentTasks: Task[] = [];
let editHandler: ((task: Task) => void) | null = null;

/** Кто открывает окно правки задачи (подключается в main.ts). */
export function setEditHandler(handler: (task: Task) => void): void {
    editHandler = handler;
}
let currentFilter: 'all' | 'active' | 'completed' = 'all';

// --- API для других разделов (главная меняет задачи через него, чтобы не разъезжалось состояние) ---
export function toggleTask(id: string): void {
    const task = currentTasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? todayStr() : undefined;
    saveTasks(currentTasks);
    renderTasks();
}

export type NewTask = { text: string; date: string; time?: string; category: string; priority: Priority; notes?: string };

export function addTask(input: NewTask): Task {
    const task: Task = { id: newId(), completed: false, notes: '', ...input };
    currentTasks.push(task);
    saveTasks(currentTasks);
    renderTasks();
    return task;
}

export function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): void {
    const task = currentTasks.find((t) => t.id === id);
    if (!task) return;
    Object.assign(task, patch);
    saveTasks(currentTasks);
    renderTasks();
}

export function removeTask(id: string): void {
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
    checkbox.setAttribute('aria-label', 'Выполнено');

    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Текст задачи (редактируется по двойному клику)
    const spanText = document.createElement('span');
    spanText.className = 'task__text';
    spanText.title = 'Двойной клик — редактировать';
    spanText.textContent = task.text;

    spanText.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.maxLength = 100;
        input.className = 'input task__edit';
        input.addEventListener('blur', () => {
            if (input.parentNode !== li) return; // blur мог сработать повторно при замене элемента
            // пустой текст не сохраняем — остаётся прежний
            const text = input.value.trim();
            if (text) task.text = text;
            spanText.textContent = task.text;
            li.replaceChild(spanText, input);
            saveTasks(currentTasks);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });
        li.replaceChild(input, spanText);
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
        badge.textContent = `до ${formatDateShort(task.date)}${task.time ? ` ${task.time}` : ''}`;
        badge.title = task.date;
        meta.appendChild(badge);
    }

    if (task.priority === 'high') {
        const important = document.createElement('span');
        important.className = 'badge badge--high';
        important.textContent = 'Важно';
        meta.appendChild(important);
    }

    if (task.notes) {
        const note = document.createElement('span');
        note.className = 'task__note';
        note.setAttribute('data-tip', task.notes.length > 160 ? `${task.notes.slice(0, 160)}…` : task.notes);
        note.setAttribute('aria-label', 'Есть заметка');
        note.innerHTML = icon('sticky-note', 16);
        meta.appendChild(note);
    }

    if (task.category) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = task.category;
        meta.appendChild(chip);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn icon-btn--sm';
    editBtn.setAttribute('aria-label', 'Изменить задачу');
    editBtn.title = 'Изменить';
    editBtn.innerHTML = icon('pencil', 16);
    editBtn.onclick = () => editHandler?.(task);
    meta.appendChild(editBtn);

    // Удаляем по id: индекс в отфильтрованном списке не совпадает с индексом в полном
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-btn icon-btn--sm icon-btn--danger';
    removeBtn.setAttribute('aria-label', 'Удалить задачу');
    removeBtn.title = 'Удалить';
    removeBtn.innerHTML = icon('trash-2', 16);
    removeBtn.onclick = () => removeTask(task.id);
    meta.appendChild(removeBtn);

    li.append(checkbox, spanText, meta);
    return li;
}

// --- Рендер списка задач с учётом фильтра ---
function renderTasks() {
    const taskList = document.getElementById('task-list') as HTMLUListElement | null;
    const emptyMsg = document.getElementById('empty-list-msg');
    if (!taskList) return;
    taskList.innerHTML = '';

    let filteredTasks = currentTasks;
    if (currentFilter === 'active') filteredTasks = currentTasks.filter(t => !t.completed);
    if (currentFilter === 'completed') filteredTasks = currentTasks.filter(t => t.completed);

    filteredTasks.forEach((task) => {
        taskList.appendChild(createTaskElement(task));
    });

    // Плейсхолдер если задач нет
    if (filteredTasks.length === 0) {
        emptyMsg?.classList.remove('hidden');
    } else {
        emptyMsg?.classList.add('hidden');
    }

    // Прогресс
    updateProgress();
}

// --- Прогресс-бар и текст ---
function updateProgress() {
    const completed = currentTasks.filter(t => t.completed).length;
    const total = currentTasks.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if (bar) bar.style.width = percent + "%";
    if (text) text.textContent = `Выполнено: ${completed} из ${total}`;
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

    // Сразу подсвечиваем текущий фильтр («Все»)
    highlight(filterContainer.querySelector(`[data-filter="${currentFilter}"]`));

    filterContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLElement>('button[data-filter]');
        if (button && button.dataset.filter) {
            currentFilter = button.dataset.filter as 'all' | 'active' | 'completed';
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

    currentTasks = loadTasks();
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
        });
        form.reset(); // приоритет возвращается к «Обычный» (у него checked в разметке)
    });
}

// --- Очистка выполненных ---
function setupClearCompleted() {
    document.getElementById('clear-completed')?.addEventListener('click', () => {
        currentTasks = currentTasks.filter(t => !t.completed);
        saveTasks(currentTasks);
        renderTasks();
    });
}
