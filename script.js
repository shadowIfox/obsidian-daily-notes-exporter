// Установка сегодняшней даты
const dateInput = document.getElementById('note-date');
const todayBtn = document.getElementById('today-btn');

function setToday() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

function loadFromLocalStorage() {
    const data = JSON.parse(localStorage.getItem('dailyNoteData'));
    if (!data) return;

    if (data.date) dateInput.value = data.date;
    if (data.notes) noteText.value = data.notes;
    if (data.tasks && Array.isArray(data.tasks)) {
        data.tasks.forEach(task => {
            createTaskItem(task.text, task.done);
        });
    }
}

window.addEventListener('load', () => {
    setToday();
    loadFromLocalStorage();
});

todayBtn.addEventListener('click', setToday);

// Работа со списком задач
const taskList = document.getElementById('task-list');
const addTaskBtn = document.getElementById('add-task');

function createTaskItem(value = '', checked = false) {
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

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
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

    taskList.appendChild(li);
}

addTaskBtn.addEventListener('click', () => {
    createTaskItem();
    saveToLocalStorage();
});

// Генерация Markdown
const downloadBtn = document.getElementById('download-btn');
const noteText = document.getElementById('note-text');

downloadBtn.addEventListener('click', () => {
    const date = dateInput.value || 'Без даты';

    const tasks = Array.from(taskList.querySelectorAll('.task-item'))
        .map(item => {
            const textInput = item.querySelector('input[type="text"]');
            const checkbox = item.querySelector('input[type="checkbox"]');
            const text = textInput ? textInput.value.trim() : '';
            const checked = checkbox ? checkbox.checked : false;
            return text ? `- [${checked ? 'x' : ' '}] ${text}` : '';
        })
        .filter(text => text !== '')
        .join('\n');

    const notes = noteText.value.trim();

    const mdContent = `# ${date}\n\n## ✅ Задачи\n${tasks || '-'}\n\n## ✍️ Заметки\n${notes || '-'}`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${date}-daily-note.md`;
    link.click();
});

// Сохранение в localStorage
function saveToLocalStorage() {
    const date = dateInput.value;
    const notes = noteText.value;
    const tasks = Array.from(taskList.querySelectorAll('.task-item')).map(item => {
        return {
            text: item.querySelector('input[type="text"]').value,
            done: item.querySelector('input[type="checkbox"]').checked
        };
    });

    const data = {
        date,
        notes,
        tasks
    };

    localStorage.setItem('dailyNoteData', JSON.stringify(data));
}

noteText.addEventListener('input', saveToLocalStorage);
dateInput.addEventListener('input', saveToLocalStorage);

// Очистка задач, заметки и всего
const clearAllBtn = document.getElementById('clear-all');
const clearTasksBtn = document.getElementById('clear-tasks');
const clearNoteBtn = document.getElementById('clear-note');

clearAllBtn.addEventListener('click', () => {
    taskList.innerHTML = '';
    noteText.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    saveToLocalStorage();
});

clearTasksBtn.addEventListener('click', () => {
    taskList.innerHTML = '';
    saveToLocalStorage();
});

clearNoteBtn.addEventListener('click', () => {
    noteText.value = '';
    saveToLocalStorage();
});