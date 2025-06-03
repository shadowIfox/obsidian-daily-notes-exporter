// src/todo.ts — логика секции задач

// --- Тип данных для задачи ---
type Task = {
    text: string;
    date: string;
    category: string;
    completed: boolean;
};

// --- Массив для хранения всех задач ---
let currentTasks: Task[] = [];

// --- Сохранение задач в localStorage ---
function saveTasksToStorage(tasks: Task[]) {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// --- Загрузка задач из localStorage ---
function loadTasksFromStorage(): Task[] {
    const data = localStorage.getItem('tasks');
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// --- Создание одного элемента задачи с редактированием по двойному клику ---
export function createTaskElement(task: Task, index: number): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-2 p-2 border rounded bg-white shadow';

    // Чекбокс выполнения
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'accent-green-600';
    checkbox.checked = task.completed;

    checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        if (checkbox.checked) {
            spanText.classList.add('line-through', 'text-gray-400');
            li.classList.add('opacity-60');
        } else {
            spanText.classList.remove('line-through', 'text-gray-400');
            li.classList.remove('opacity-60');
        }
        saveTasksToStorage(currentTasks);
    });

    // Текст задачи (редактируемый по двойному клику)
    const spanText = document.createElement('span');
    spanText.className = 'flex-1';
    spanText.textContent = task.text;

    // --- Редактирование текста задачи по двойному клику ---
    spanText.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = spanText.textContent || '';
        input.className = 'flex-1 border px-2 py-1 rounded';

        input.addEventListener('blur', () => {
            spanText.textContent = input.value;
            task.text = input.value;
            li.replaceChild(spanText, input);
            saveTasksToStorage(currentTasks);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });

        li.replaceChild(input, spanText);
        input.focus();
    });

    // Дата дедлайна
    const spanDate = document.createElement('span');
    spanDate.className = 'text-xs text-gray-400 ml-2';
    spanDate.textContent = task.date ? `до ${task.date}` : '';

    // Категория
    const spanCat = document.createElement('span');
    spanCat.className = 'text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2';
    spanCat.textContent = task.category;

    // Кнопка удаления
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-700';
    removeBtn.textContent = 'Удалить';
    removeBtn.onclick = () => {
        currentTasks.splice(index, 1);
        saveTasksToStorage(currentTasks);
        renderTasks();
    };

    // --- Собираем задачу ---
    li.appendChild(checkbox);
    li.appendChild(spanText);
    if (task.date) li.appendChild(spanDate);
    if (task.category) li.appendChild(spanCat);
    li.appendChild(removeBtn);

    // Визуальный статус "выполнено" при инициализации
    if (task.completed) {
        spanText.classList.add('line-through', 'text-gray-400');
        li.classList.add('opacity-60');
    }

    return li;
}

// --- Рендер списка задач ---
function renderTasks() {
    const taskList = document.getElementById('task-list') as HTMLUListElement | null;
    if (!taskList) return;
    taskList.innerHTML = '';
    currentTasks.forEach((task, idx) => {
        const li = createTaskElement(task, idx);
        taskList.appendChild(li);
    });
}

// --- Основная функция инициализации секции Todo ---
export function setupTodo() {
    const form = document.getElementById('add-task-form') as HTMLFormElement | null;
    const textInput = document.getElementById('task-text') as HTMLInputElement | null;
    const dateInput = document.getElementById('task-date') as HTMLInputElement | null;
    const categoryInput = document.getElementById('task-category') as HTMLInputElement | null;

    // --- Инициализация массива из localStorage ---
    currentTasks = loadTasksFromStorage();
    renderTasks();

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
            completed: false
        };
        currentTasks.push(newTask);
        saveTasksToStorage(currentTasks);
        renderTasks();
        form.reset();
    });
}