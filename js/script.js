// --- Элементы интерфейса ---
const dateInput = document.getElementById('note-date');
const todayBtn = document.getElementById('today-btn');
const taskList = document.getElementById('task-list');
const addTaskBtn = document.getElementById('add-task');
const noteText = document.getElementById('note-text');
const downloadBtn = document.getElementById('download-btn');
const statusBox = document.getElementById('status');
const clearAllBtn = document.getElementById('clear-all');
const clearTasksBtn = document.getElementById('clear-tasks');
const clearNoteBtn = document.getElementById('clear-note');
const toggleThemeBtn = document.getElementById('toggle-theme');

// --- Установка текущей даты ---
function setToday() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

// --- Показ уведомлений ---
function showStatus(message, duration = 2000) {
    statusBox.textContent = message;
    statusBox.style.display = 'block';
    setTimeout(() => {
        statusBox.style.display = 'none';
    }, duration);
}

// --- Создание новой задачи ---
function createTaskItem(value = '', checked = false) {
    const li = document.createElement('li');
    li.classList.add('task-item');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => {
        saveToLocalStorage();
        li.dataset.done = checkbox.checked ? 'true' : 'false';
        updateProgress();
        filterTasks();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = 'Введите задачу...';
    input.addEventListener('input', saveToLocalStorage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
            e.preventDefault();
            createTaskItem();
            saveToLocalStorage();
        }
    });

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

    updateProgress();
    filterTasks();
}

// --- Обработчики событий ---
addTaskBtn.addEventListener('click', () => {
    createTaskItem();
    saveToLocalStorage();
});

noteText.addEventListener('input', saveToLocalStorage);
dateInput.addEventListener('input', saveToLocalStorage);

document.addEventListener('DOMContentLoaded', () => {
    if (!dateInput.value) setToday();
});