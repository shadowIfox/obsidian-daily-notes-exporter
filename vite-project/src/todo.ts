// src/todo.ts — логика секции задач

// --- Создание одного элемента задачи с редактированием по двойному клику ---
export function createTaskElement(text: string, date: string, category: string): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-2 p-2 border rounded bg-white shadow';

    // Чекбокс выполнения
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'accent-green-600';
    checkbox.checked = false;

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            spanText.classList.add('line-through', 'text-gray-400');
            li.classList.add('opacity-60');
        } else {
            spanText.classList.remove('line-through', 'text-gray-400');
            li.classList.remove('opacity-60');
        }
    });

    // Текст задачи (редактируемый по двойному клику)
    const spanText = document.createElement('span');
    spanText.className = 'flex-1';
    spanText.textContent = text;

    // --- Редактирование текста задачи по двойному клику ---
    spanText.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = spanText.textContent || '';
        input.className = 'flex-1 border px-2 py-1 rounded';

        input.addEventListener('blur', () => {
            spanText.textContent = input.value;
            li.replaceChild(spanText, input);
            // TODO: сохранить изменения в localStorage, если будет нужно
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
    spanDate.textContent = date ? `до ${date}` : '';

    // Категория
    const spanCat = document.createElement('span');
    spanCat.className = 'text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2';
    spanCat.textContent = category;

    // Кнопка удаления
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-700';
    removeBtn.textContent = 'Удалить';
    removeBtn.onclick = () => li.remove();

    // --- Собираем задачу ---
    li.appendChild(checkbox);
    li.appendChild(spanText);
    if (date) li.appendChild(spanDate);
    if (category) li.appendChild(spanCat);
    li.appendChild(removeBtn);

    return li;
}

// --- Основная функция инициализации секции Todo ---
export function setupTodo() {
    console.log("setupTodo вызван!");

    const form = document.getElementById('add-task-form') as HTMLFormElement | null;
    const textInput = document.getElementById('task-text') as HTMLInputElement | null;
    const dateInput = document.getElementById('task-date') as HTMLInputElement | null;
    const categoryInput = document.getElementById('task-category') as HTMLInputElement | null;
    const taskList = document.getElementById('task-list') as HTMLUListElement | null;

    if (!form || !textInput || !dateInput || !categoryInput || !taskList) {
        console.log('Не найдены нужные элементы формы!');
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const text = textInput.value.trim();
        const date = dateInput.value;
        const category = categoryInput.value.trim();

        if (!text) return;

        const li = createTaskElement(text, date, category);
        taskList.appendChild(li);

        form.reset();
    });
}