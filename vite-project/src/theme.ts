// src/theme.ts — единый центр управления темой (system/light/dark)
import { rethemeAllCharts } from './utils/chartTheme';

type ThemeMode = 'system' | 'light' | 'dark';
const SETTINGS_KEY = 'userSettings';

type UserSettings = {
  themeMode: ThemeMode;
};

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as UserSettings;
  } catch {}
  return { themeMode: 'system' };
}

function saveSettings(next: Partial<UserSettings>) {
  const prev = loadSettings();
  const merged = { ...prev, ...next } as UserSettings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

function resolveSystemDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function setThemeAttr(resolved: 'light' | 'dark') {
  const el = document.documentElement;
  el.setAttribute('data-theme', resolved);
  // Tailwind ожидает класс .dark на <html>
  el.classList.toggle('dark', resolved === 'dark');
  // на body не вешаем — на всякий случай снимаем
  document.body.classList.remove('dark');
}

export function applyTheme(mode: ThemeMode) {
  const resolved: 'light' | 'dark' = mode === 'system' ? (resolveSystemDark() ? 'dark' : 'light') : mode;
  setThemeAttr(resolved);
  // событие для компонентов
  window.dispatchEvent(new CustomEvent('themechange', { detail: { mode: resolved } }));
  // перекрашиваем графики
  try { rethemeAllCharts(); } catch {}
}

export function setThemeMode(mode: ThemeMode) {
  saveSettings({ themeMode: mode });
  applyTheme(mode);
}

export function getThemeMode(): ThemeMode {
  return loadSettings().themeMode;
}

export function initThemeSwitcher() {
  // 1) применяем сохранённый/системный режим
  const { themeMode } = loadSettings();
  applyTheme(themeMode);

  // 2) слушаем системную тему, если выбран режим system
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (mql) {
    mql.addEventListener('change', () => {
      const { themeMode } = loadSettings();
      if (themeMode === 'system') applyTheme('system');
    });
  }

  // 3) подключаем UI, если есть радиокнопки/кнопка
  const radios = document.querySelectorAll<HTMLInputElement>('input[name="themeMode"]');
  if (radios.length) {
    // выставим текущее значение
    radios.forEach(r => { r.checked = (r.value === themeMode); });
    radios.forEach(r => r.addEventListener('change', () => {
      if (!r.checked) return;
      const mode = r.value as ThemeMode;
      setThemeMode(mode);
    }));
  }

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = getThemeMode();
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
      setThemeMode(next);
    });
  }
}

// Для отладки из консоли:
;(window as any).setThemeMode = setThemeMode;
;(window as any).getThemeMode = getThemeMode;