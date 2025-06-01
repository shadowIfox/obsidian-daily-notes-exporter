// storage.js
// Логика хранения задач, заметок, привычек, состояния

export const noteText = document.getElementById('note-text');
export const dateInput = document.getElementById('note-date');
export const taskList = document.getElementById('task-list');

export function setToday() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

export function saveToLocalStorage() {
    const tasks = [];
    document.querySelectorAll('#task-list li').forEach(li => {
        const input = li.querySelector('input[type="text"]');
        const checkbox = li.querySelector('input[type="checkbox"]');
        tasks.push({ text: input.value, checked: checkbox.checked });
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('note', noteText.value);
    localStorage.setItem('date', dateInput.value);
}

export function restoreFromStorage() {
    // Загрузка задач
    const savedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    taskList.innerHTML = '';
    savedTasks.forEach(task => createTaskItem(task.text, task.checked));

    // Загрузка заметки и даты
    noteText.value = localStorage.getItem('note') || '';
    dateInput.value = localStorage.getItem('date') || new Date().toISOString().split('T')[0];

    // Подписка на изменения
    noteText.addEventListener('input', saveToLocalStorage);
    dateInput.addEventListener('input', saveToLocalStorage);
}

export function createTaskItem(value = '', checked = false) {
    const li = document.createElement('li');
    li.classList.add('task-item');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', saveToLocalStorage);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = 'Введите задачу...';
    input.addEventListener('input', saveToLocalStorage);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.onclick = () => {
        li.remove();
        saveToLocalStorage();
    };

    li.appendChild(checkbox);
    li.appendChild(input);
    li.appendChild(removeBtn);
    li.dataset.done = checked ? 'true' : 'false';

    taskList.appendChild(li);
}