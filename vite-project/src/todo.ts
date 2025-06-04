// todo.ts — эталон с цветовой индикацией дедлайна, анимацией и стилями

type Task = {
    text: string;
    date: string;
    category: string;
    completed: boolean;
};

let currentTasks: Task[] = [];
let currentFilter: 'all' | 'active' | 'completed' = 'all';

function saveTasksToStorage(tasks: Task[]) {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasksFromStorage(): Task[] {
    const data = localStorage.getItem('tasks');
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function getDeadlineColor(dateStr: string, completed: boolean) {
    if (completed) return 'text-gray-400';
    if (!dateStr) return '';
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deadline < today) return 'bg-pink-200 text-red-700 px-2 py-0.5 rounded';         // Просрочено
    if (+deadline === +today) return 'bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded'; // Сегодня
    if ((deadline.getTime() - today.getTime()) / 86400000 <= 2) return 'bg-blue-200 text-blue-800 px-2 py-0.5 rounded'; // Скоро
    return 'text-gray-600';
}

// --- Создание элемента задачи (с анимацией) ---
export function createTaskElement(task: Task, index: number): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-2 p-4 bg-white dark:bg-[#282846] rounded-xl shadow transition-all opacity-0 translate-y-4';
    setTimeout(() => {
        li.classList.remove('opacity-0', 'translate-y-4');
        li.classList.add('opacity-100', 'translate-y-0');
    }, 10);

    // Чекбокс
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'w-5 h-5 accent-lime-500 rounded border-gray-300 focus:ring-2 focus:ring-lime-600';
    checkbox.checked = task.completed;

    checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        saveTasksToStorage(currentTasks);
        renderTasks();
    });

    // Текст
    const spanText = document.createElement('span');
    spanText.className = 'flex-1 text-lg';
    spanText.textContent = task.text;

    if (task.completed) spanText.classList.add('line-through', 'text-gray-400');

    // Дата
    const spanDate = document.createElement('span');
    spanDate.className = 'ml-2 ' + getDeadlineColor(task.date, task.completed);
    if (task.date) {
        spanDate.textContent = `до ${task.date}`;
    }

    // Категория
    const spanCat = document.createElement('span');
    spanCat.className = 'ml-2 px-2 py-0.5 rounded bg-purple-200 text-purple-900 text-xs';
    if (task.category) {
        spanCat.textContent = task.category;
    }

    // Кнопка удалить
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ml-2 px-3 py-1 bg-red-500 text-white rounded-xl hover:bg-red-600 transition';
    removeBtn.textContent = 'Удалить';
    removeBtn.onclick = () => {
        currentTasks.splice(index, 1);
        saveTasksToStorage(currentTasks);
        renderTasks();
    };

    li.appendChild(checkbox);
    li.appendChild(spanText);
    if (task.date) li.appendChild(spanDate);
    if (task.category) li.appendChild(spanCat);
    li.appendChild(removeBtn);

    return li;
}

// --- Рендер списка с фильтрами ---
function renderTasks() {
    const taskList = document.getElementById('task-list') as HTMLUListElement | null;
    if (!taskList) return;
    taskList.innerHTML = '';

    let filteredTasks = currentTasks;
    if (currentFilter === 'active') {
        filteredTasks = currentTasks.filter((task) => !task.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = currentTasks.filter((task) => task.completed);
    }

    filteredTasks.forEach((task, idx) => {
        const li = createTaskElement(task, idx);
        taskList.appendChild(li);
    });

    updateProgress();
}

// --- Прогресс-бар ---
function updateProgress() {
    const done = currentTasks.filter((t) => t.completed).length;
    const all = currentTasks.length;
    const percent = all ? Math.round((done / all) * 100) : 0;
    const progressBar = document.getElementById('progress-bar') as HTMLDivElement | null;
    const progressCount = document.getElementById('progress-count');
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressCount) progressCount.textContent = `Выполнено: ${done} из ${all}`;
}

// --- Обработчик фильтров ---
function setupFilters() {
    const filterContainer = document.getElementById('todo-filters');
    if (!filterContainer) return;

    filterContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' && target.dataset.filter) {
            currentFilter = target.dataset.filter as 'all' | 'active' | 'completed';
            renderTasks();
            Array.from(filterContainer.children).forEach((btn) =>
                btn.classList.remove('ring', 'ring-lime-500', 'scale-105')
            );
            target.classList.add('ring', 'ring-lime-500', 'scale-105');
        }
    });
}

// --- Инициализация ---
export function setupTodo() {
    const form = document.getElementById('add-task-form') as HTMLFormElement | null;
    const textInput = document.getElementById('task-text') as HTMLInputElement | null;
    const dateInput = document.getElementById('task-date') as HTMLInputElement | null;
    const categoryInput = document.getElementById('task-category') as HTMLInputElement | null;

    currentTasks = loadTasksFromStorage();
    renderTasks();
    setupFilters();

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

        const newTask: Task = {
            text,
            date,
            category,
            completed: false,
        };
        currentTasks.push(newTask);
        saveTasksToStorage(currentTasks);
        renderTasks();
        form.reset();
    });
}