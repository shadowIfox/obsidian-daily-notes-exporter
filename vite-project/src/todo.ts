import { todayStr } from './dates';
import { loadTasks, newId, saveTasks, type Task } from './store';

let currentTasks: Task[] = [];
let currentFilter: 'all' | 'active' | 'completed' = 'all';

// --- Создание задачи (с цветовой индикацией дедлайна и анимацией) ---
export function createTaskElement(task: Task): HTMLLIElement {
    const li = document.createElement('li');
    li.className =
        'flex items-center gap-2 p-3 border rounded-2xl bg-white dark:bg-[#282846] shadow-xl opacity-0 translate-y-4 transition-all duration-300';

    setTimeout(() => {
        li.classList.remove('opacity-0', 'translate-y-4');
    }, 10);

    // Чекбокс
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className =
        'w-5 h-5 border-gray-300 rounded accent-lime-500 focus:ring-2 focus:ring-lime-600';
    checkbox.checked = task.completed;

    checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        task.completedAt = checkbox.checked ? todayStr() : undefined;
        saveTasks(currentTasks);
        renderTasks();
    });

    // Текст задачи (редактируемый)
    const spanText = document.createElement('span');
    spanText.className = 'flex-1 text-lg cursor-pointer select-none dark:text-gray-100';
    spanText.textContent = task.text;

    // Редактирование текста по двойному клику
    spanText.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.maxLength = 100;
        input.className =
            'flex-1 px-2 py-1 text-gray-900 border-none outline-none rounded-xl bg-neutral-200 dark:bg-neutral-700 dark:text-gray-100 focus:ring-2 focus:ring-lime-500';
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

    // Дата дедлайна с цветовой индикацией.
    // Даты в формате YYYY-MM-DD сравниваются как строки — это работает и не зависит от часового пояса.
    const spanDate = document.createElement('span');
    spanDate.className = 'text-xs ml-2 px-2 py-0.5 rounded font-semibold';
    spanDate.textContent = task.date ? `до ${task.date}` : '';
    if (task.date) {
        const today = todayStr();
        if (task.date < today) {
            spanDate.classList.add('bg-red-100', 'text-red-700');
        } else if (task.date === today) {
            spanDate.classList.add('bg-yellow-200', 'text-yellow-900');
        } else {
            spanDate.classList.add('bg-blue-100', 'text-blue-700');
        }
    }

    // Категория
    const spanCat = document.createElement('span');
    spanCat.className = 'text-xs bg-lime-100 text-lime-700 px-2 py-0.5 rounded ml-2';
    spanCat.textContent = task.category;

    // Кнопка удаления. Удаляем по id: индекс в отфильтрованном списке не совпадает с индексом в полном.
    const removeBtn = document.createElement('button');
    removeBtn.className =
        'px-3 py-1 ml-2 text-white transition bg-red-500 rounded-xl hover:bg-red-700';
    removeBtn.textContent = 'Удалить';
    removeBtn.onclick = () => {
        currentTasks = currentTasks.filter((t) => t.id !== task.id);
        saveTasks(currentTasks);
        renderTasks();
    };

    // Стилизация выполненных задач
    if (task.completed) {
        spanText.classList.add('line-through', 'text-gray-400');
        li.classList.add('opacity-60');
    }

    li.appendChild(checkbox);
    li.appendChild(spanText);
    if (task.date) li.appendChild(spanDate);
    if (task.category) li.appendChild(spanCat);
    li.appendChild(removeBtn);

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
    const bar = document.getElementById('progress-bar') as HTMLElement;
    const text = document.getElementById('progress-text') as HTMLElement;
    if (bar) bar.style.width = percent + "%";
    if (text) text.textContent = `Выполнено: ${completed} из ${total}`;

    // Если есть отдельный счетчик
    const counter = document.getElementById('progress-count');
    if (counter) counter.textContent = String(completed);
    const label = document.getElementById('progress-label');
    if (label) label.textContent = `Всего задач: ${total}`;
}

// --- Фильтры ---
function setupFilters() {
    const filterContainer = document.getElementById('todo-filters');
    if (!filterContainer) return;

    const highlight = (active: Element | null) => {
        Array.from(filterContainer.children).forEach(btn =>
            btn.classList.remove('bg-lime-500', 'text-black')
        );
        active?.classList.add('bg-lime-500', 'text-black');
    };

    // Сразу подсвечиваем текущий фильтр («Все»)
    highlight(filterContainer.querySelector(`[data-filter="${currentFilter}"]`));

    filterContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' && target.dataset.filter) {
            currentFilter = target.dataset.filter as 'all' | 'active' | 'completed';
            renderTasks();
            highlight(target);
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
