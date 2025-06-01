// --- Сохранение в localStorage ---
function saveToLocalStorage() {
    const date = dateInput.value;
    const notes = noteText.value;
    const tasks = Array.from(taskList.querySelectorAll('.task-item')).map(item => {
        return {
            text: item.querySelector('input[type="text"]').value,
            done: item.querySelector('input[type="checkbox"]').checked
        };
    });

    const data = { date, notes, tasks };
    localStorage.setItem('dailyNoteData', JSON.stringify(data));
}

// --- Загрузка из localStorage ---
function loadFromLocalStorage() {
    const data = JSON.parse(localStorage.getItem('dailyNoteData'));
    if (!data) return;

    if (data.date) dateInput.value = data.date;
    if (data.notes) noteText.value = data.notes;
    if (data.tasks && Array.isArray(data.tasks)) {
        data.tasks.forEach(task => createTaskItem(task.text, task.done));
    }
}
