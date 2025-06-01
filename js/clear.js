// clear.js
// Очистка данных (todo, заметок, привычек)

import { dateInput, noteText, saveToLocalStorage, taskList } from './storage.js';

function showStatus(message, duration = 2000) {
    const statusBox = document.getElementById('status');
    statusBox.textContent = message;
    statusBox.style.display = 'block';
    setTimeout(() => {
        statusBox.style.display = 'none';
    }, duration);
}

export function setupClearHandlers() {
    const clearAllBtn = document.getElementById('clear-all');
    const clearTasksBtn = document.getElementById('clear-tasks');
    const clearNoteBtn = document.getElementById('clear-note');

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
}