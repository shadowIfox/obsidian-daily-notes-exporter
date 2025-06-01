
// Получаем кнопки очистки и необходимые элементы
const clearAllBtn = document.getElementById('clear-all');
const clearTasksBtn = document.getElementById('clear-tasks');
const clearNoteBtn = document.getElementById('clear-note');
const taskList = document.getElementById('task-list');
const noteText = document.getElementById('note-text');
const dateInput = document.getElementById('note-date');

// Функции для очистки
function clearAll() {
    taskList.innerHTML = '';
    noteText.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    saveToLocalStorage();
    showStatus("Содержимое очищено и сохранено");
}

function clearTasks() {
    taskList.innerHTML = '';
    saveToLocalStorage();
    showStatus("Задачи очищены");
}

function clearNote() {
    noteText.value = '';
    saveToLocalStorage();
    showStatus("Заметка очищена");
}

// Обработчики событий
clearAllBtn.addEventListener('click', clearAll);
clearTasksBtn.addEventListener('click', clearTasks);
clearNoteBtn.addEventListener('click', clearNote);

// Если используешь модули, экспортируй функции:
export { clearAll, clearTasks, clearNote };