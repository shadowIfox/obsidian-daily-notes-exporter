// src/main.ts

import '@fontsource-variable/manrope';
import './style.css';

import { setupDashboard } from './dashboard';
import { setupHabits } from './habits';
import { hydrateIcons } from './icons';
import { setupMood } from './mood';
import { initRouter } from './router';
import { setupSettings } from './settings';
import { initThemeSwitcher } from './theme';
import { setupTodo } from './todo';
import { rethemeAllCharts } from './utils/chartTheme';

// Иконки из разметки → inline-SVG (до остальной инициализации, чтобы кнопки уже были с иконками)
hydrateIcons();

// Тема — раньше графиков, чтобы они сразу создавались в нужных цветах
initThemeSwitcher();

// Инициализация разделов
setupTodo();
setupHabits();
setupMood();
setupSettings();
setupDashboard();

// Сворачивание сайдбара (запоминается)
const frame = document.getElementById('app-frame');
const SIDEBAR_KEY = 'sidebarCollapsed';
try {
    if (localStorage.getItem(SIDEBAR_KEY) === '1') frame?.classList.add('is-collapsed');
} catch {}
document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const collapsed = frame?.classList.toggle('is-collapsed') ?? false;
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch {}
});

initRouter();

// Шрифт подгружается лениво: когда он готов, перерисовываем графики, чтобы подписи стали Manrope
document.fonts?.ready.then(() => rethemeAllCharts());
