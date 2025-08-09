// src/main.ts

import { renderAnalyticsPage } from './analytics';
import { setupHabits } from './habits';
import { setupMood } from './mood';
import { setupSettings } from './settings';
import './style.css';
import { initThemeSwitcher } from './theme';
import { setupTodo } from './todo';



// Инициализация разделов
setupTodo();
setupHabits();
setupMood();
setupSettings();

document.addEventListener("DOMContentLoaded", () => {
    initThemeSwitcher();

    const navButtons = document.querySelectorAll<HTMLButtonElement>('nav button');
    const sections = document.querySelectorAll<HTMLElement>('[id$="-section"]');

    // Показываем первую секцию (например, задачи)
    sections.forEach((sec, idx) => sec.classList.toggle('hidden', idx !== 0));

    navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            // Получаем имя секции из data-section
            const sectionName = btn.dataset.section;
            // Скрыть все секции
            sections.forEach(sec => sec.classList.add("hidden"));
            // Показать нужную секцию
            const target = document.getElementById(`${sectionName}-section`);
            if (target) target.classList.remove("hidden");

            // При переходе на аналитику — вызываем её отрисовку
            if (sectionName === "analytics") {
                renderAnalyticsPage();
            }
        });
    });
});