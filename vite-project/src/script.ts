// script.ts — главный модуль приложения
import { setupTodo } from './todo';

// Переключение секций по кнопкам (SPA-навигация)
const navButtons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll<HTMLElement>('.app-section');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-section');
        sections.forEach(sec => {
            sec.hidden = sec.id !== `${target}-section`;
        });
    });
});

// Запуск логики todo после загрузки страницы
setupTodo();