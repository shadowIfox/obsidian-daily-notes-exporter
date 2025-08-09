// storage.js
// Логика хранения задач, заметок, привычек, состояния

export const noteText = document.getElementById('note-text') as HTMLTextAreaElement | null;
export const dateInput = document.getElementById('note-date') as HTMLInputElement | null;
export const taskList = document.getElementById('task-list') as HTMLUListElement | null;

export function setToday(): void {
    if (!dateInput) return;
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

export function saveToLocalStorage(): void {
    if (!taskList || !noteText || !dateInput) return;
    const tasks: { text: string; checked: boolean }[] = [];
    taskList.querySelectorAll('li').forEach(li => {
        const input = li.querySelector('input[type="text"]') as HTMLInputElement | null;
        const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        tasks.push({ text: input?.value ?? '', checked: checkbox?.checked ?? false });
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('note', noteText.value);
    localStorage.setItem('date', dateInput.value);
}

export function restoreFromStorage(): void {
    if (!taskList || !noteText || !dateInput) return;

    // Загрузка задач
    const savedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    taskList.innerHTML = '';
    savedTasks.forEach((task: { text: string; checked: boolean }) => createTaskItem(task.text, task.checked));

    // Загрузка заметки и даты
    noteText.value = localStorage.getItem('note') || '';
    dateInput.value = localStorage.getItem('date') || new Date().toISOString().split('T')[0];

    // Подписка на изменения
    noteText.addEventListener('input', saveToLocalStorage);
    dateInput.addEventListener('input', saveToLocalStorage);
}

export function createTaskItem(value = '', checked = false): void {
    if (!taskList) return;
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