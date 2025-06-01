
// --- Элементы интерфейса (только основные) ---
const dateInput = document.getElementById('note-date');
const todayBtn = document.getElementById('today-btn');
const taskList = document.getElementById('task-list');
const addTaskBtn = document.getElementById('add-task');
const noteText = document.getElementById('note-text');
const downloadBtn = document.getElementById('download-btn');
const statusBox = document.getElementById('status');

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

// --- Сохранение в LocalStorage ---
function saveToLocalStorage() {
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

// --- Создание задачи ---
function createTaskItem(value = '', checked = false) {
    const li = document.createElement('li');
    li.classList.add('task-item');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => {
        saveToLocalStorage();
        li.dataset.done = checkbox.checked ? 'true' : 'false';
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
}

// --- Добавление задачи по кнопке ---
addTaskBtn.addEventListener('click', () => {
    createTaskItem();
    saveToLocalStorage();
});

// --- Сохраняем заметку и дату при вводе ---
noteText.addEventListener('input', saveToLocalStorage);
dateInput.addEventListener('input', saveToLocalStorage);

// --- Установка даты по кнопке "Сегодня" ---
todayBtn.addEventListener('click', setToday);

// --- Инициализация при загрузке ---
document.addEventListener('DOMContentLoaded', () => {
    if (!dateInput.value) setToday();

    const savedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    taskList.innerHTML = '';
    savedTasks.forEach(task => createTaskItem(task.text, task.checked));

    noteText.value = localStorage.getItem('note') || '';
    dateInput.value = localStorage.getItem('date') || new Date().toISOString().split('T')[0];
});