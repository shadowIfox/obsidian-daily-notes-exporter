import { formatDateShort, todayStr } from './dates';
import { icon } from './icons';
import { loadTasks, newId, saveTasks, type Task } from './store';

let currentTasks: Task[] = [];
let currentFilter: 'all' | 'active' | 'completed' = 'all';

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

    checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        task.completedAt = checkbox.checked ? todayStr() : undefined;
        saveTasks(currentTasks);
        renderTasks();
    });

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
        badge.textContent = `до ${formatDateShort(task.date)}`;
        badge.title = task.date;
        meta.appendChild(badge);
    }

    if (task.category) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = task.category;
        meta.appendChild(chip);
    }

    // Удаляем по id: индекс в отфильтрованном списке не совпадает с индексом в полном
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-btn icon-btn--sm icon-btn--danger';
    removeBtn.setAttribute('aria-label', 'Удалить задачу');
    removeBtn.title = 'Удалить';
    removeBtn.innerHTML = icon('trash-2', 16);
    removeBtn.onclick = () => {
        currentTasks = currentTasks.filter((t) => t.id !== task.id);
        saveTasks(currentTasks);
        renderTasks();
    };
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
    const categoryInput = document.getElementById('task-category') as HTMLInputElement | null;

    currentTasks = loadTasks();
    renderTasks();
    setupFilters();
    setupClearCompleted();
    setupTodayBtn();

    if (!form || !textInput || !dateInput || !categoryInput) {
        console.log('Не найдены нужные элементы формы!');
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = textInput.value.trim();
        const date = dateInput.value;
        const category = categoryInput.value.trim();

        if (!text) return;

        currentTasks.push({ id: newId(), text, date, category, completed: false });
        saveTasks(currentTasks);
        renderTasks();
        form.reset();
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
