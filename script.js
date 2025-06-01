// Установка сегодняшней даты
const dateInput = document.getElementById('note-date');
const todayBtn = document.getElementById('today-btn');

function setToday() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

window.addEventListener('load', setToday);
todayBtn.addEventListener('click', setToday);

// Работа со списком задач
const taskList = document.getElementById('task-list');
const addTaskBtn = document.getElementById('add-task');

function createTaskItem(value = '') {
    const li = document.createElement('li');
    li.classList.add('task-item');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = 'Введите задачу...';

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createTaskItem();
        }
    });

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';

    li.appendChild(checkbox);
    li.appendChild(input);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.onclick = () => li.remove();

    li.appendChild(removeBtn);

    taskList.appendChild(li);
}

addTaskBtn.addEventListener('click', () => createTaskItem());

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