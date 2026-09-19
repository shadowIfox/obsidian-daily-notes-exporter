// src/main.ts

import '@fontsource-variable/manrope';
import './style.css';

import { setupDashboard } from './dashboard';
import { setupHabits } from './habits';
import { hydrateIcons } from './icons';
import { setupMood } from './mood';
import { readPref, writePref } from './prefs';
import { initRouter } from './router';
import { setupSettings } from './settings';
import { initStore } from './store';
import { initThemeSwitcher } from './theme';
import { openTaskModal } from './taskModal';
import { setEditHandler, setupTodo } from './todo';
import { setupTopbar } from './topbar';
import { initTooltips } from './viz';

const SIDEBAR_KEY = 'sidebarCollapsed';

/** Сообщение на весь экран, если приложение не смогло запуститься. */
function showFatal(error: unknown): void {
    console.error(error);
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText =
        'position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#fff8ee;color:#3a2a10;font:16px/1.5 system-ui;text-align:center;z-index:9999';
    box.textContent = `Не удалось открыть данные: ${error instanceof Error ? error.message : String(error)}`;
    document.body.append(box);
}

// Запись в хранилище идёт следом за изменением — если она не удалась, об этом нельзя молчать
window.addEventListener('storeerror', (e) => {
    const { message } = (e as CustomEvent<{ message: string }>).detail;
    window.alert(`Не удалось сохранить данные: ${message}`);
});

async function start(): Promise<void> {
    // Иконки из разметки → inline-SVG (до остальной инициализации, чтобы кнопки уже были с иконками)
    hydrateIcons();

    // Данные читаются один раз, до запуска разделов
    await initStore();

    // Тема — раньше остальных разделов
    initThemeSwitcher();
    initTooltips();

    // Инициализация разделов
    setupTodo();
    setEditHandler((task) => openTaskModal({ task }));
    setupHabits();
    setupMood();
    setupSettings();
    setupDashboard();

    // Сворачивание сайдбара (запоминается)
    const frame = document.getElementById('app-frame');
    if (readPref(SIDEBAR_KEY) === '1') frame?.classList.add('is-collapsed');
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        const collapsed = frame?.classList.toggle('is-collapsed') ?? false;
        writePref(SIDEBAR_KEY, collapsed ? '1' : '0');
    });

    setupTopbar();
    initRouter();
}

start().catch(showFatal);
