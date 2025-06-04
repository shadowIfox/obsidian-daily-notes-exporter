import './style.css';
import { setupTodo } from './todo';
setupTodo();

import { setupHabits } from "./habits";
setupHabits();

document.addEventListener("DOMContentLoaded", () => {
    const navButtons = document.querySelectorAll<HTMLButtonElement>('nav button');
    const sections = document.querySelectorAll<HTMLElement>('[id$="-section"]');

    navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            // Получаем имя секции из data-section
            const sectionName = btn.dataset.section;
            // Скрыть все секции
            sections.forEach(sec => sec.classList.add("hidden"));
            // Показать нужную секцию
            const target = document.getElementById(`${sectionName}-section`);
            if (target) target.classList.remove("hidden");
        });
    });
});