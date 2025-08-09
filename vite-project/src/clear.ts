// clear.js
// Очистка данных (todo, заметок, привычек)

import { dateInput, noteText, saveToLocalStorage, taskList } from './storage';

// Типизация аргументов функции showStatus
function showStatus(message: string, duration: number = 2000): void {
    const statusBox = document.getElementById('status');
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.style.display = 'block';
    setTimeout(() => {
        statusBox.style.display = 'none';
    }, duration);
}

export function setupClearHandlers(): void {
    const clearAllBtn = document.getElementById('clear-all');
    const clearTasksBtn = document.getElementById('clear-tasks');
    const clearNoteBtn = document.getElementById('clear-note');

    // Проверяем что элементы существуют!
    if (!clearAllBtn || !clearTasksBtn || !clearNoteBtn || !taskList || !noteText || !dateInput) return;

    clearAllBtn.addEventListener('click', () => {
        if (!taskList || !noteText || !dateInput) return;
        taskList.innerHTML = '';
        noteText.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        saveToLocalStorage();
        showStatus("Содержимое очищено и сохранено");
    });

    clearTasksBtn.addEventListener('click', () => {
        if (!taskList) return;
        saveToLocalStorage();
        showStatus("Задачи очищены");
    });

    clearNoteBtn.addEventListener('click', () => {
        if (!noteText) return;
        saveToLocalStorage();
        showStatus("Заметка очищена");
    });
}