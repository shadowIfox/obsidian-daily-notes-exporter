// --- Очистка данных ---
clearAllBtn.addEventListener('click', () => {
    taskList.innerHTML = '';
    noteText.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    saveToLocalStorage();
    showStatus("Содержимое очищено и сохранено");
});

clearTasksBtn.addEventListener('click', () => {
    taskList.innerHTML = '';
    saveToLocalStorage();
    showStatus("Задачи очищены");
});

clearNoteBtn.addEventListener('click', () => {
    noteText.value = '';
    saveToLocalStorage();
    showStatus("Заметка очищена");
});