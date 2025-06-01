// script.js
// Точка входа для инициализации приложения

import { setToday, createTaskItem, restoreFromStorage, noteText, dateInput, taskList } from './storage.js';
import { setupClearHandlers } from './clear.js';
import { setupTracker } from './tracker.js';
import { setupExporter } from './exporter.js';
import { setupThemeSwitcher } from './theme.js';

// --- Элементы интерфейса (кратко) ---
const addTaskBtn = document.getElementById('add-task');
const todayBtn = document.getElementById('today-btn');

// --- Добавление задачи по кнопке ---
addTaskBtn.addEventListener('click', () => {
    createTaskItem();
});

// --- Установка даты по кнопке "Сегодня" ---
todayBtn.addEventListener('click', setToday);

// --- Восстановление из storage при загрузке ---
document.addEventListener('DOMContentLoaded', () => {
    setToday();
    restoreFromStorage();
    setupClearHandlers();
    setupTracker();
    setupExporter();
    setupThemeSwitcher();
});