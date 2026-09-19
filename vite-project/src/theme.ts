// src/theme.ts — единый центр управления темой (system/light/dark)
import { loadSettings, saveSettings, type ThemeMode } from './store';

function resolveSystemDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function setThemeAttr(resolved: 'light' | 'dark') {
  const el = document.documentElement;
  el.setAttribute('data-theme', resolved);
  // Tailwind ожидает класс .dark на <html>
  el.classList.toggle('dark', resolved === 'dark');
}

function resolvedTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode) {
  const resolved: 'light' | 'dark' = mode === 'system' ? (resolveSystemDark() ? 'dark' : 'light') : mode;
  setThemeAttr(resolved);
  // событие для компонентов
  window.dispatchEvent(new CustomEvent('themechange', { detail: { mode: resolved } }));
}

export function setThemeMode(mode: ThemeMode) {
  saveSettings({ themeMode: mode });
  applyTheme(mode);
  // синхронизируем переключатель в настройках
  document.querySelectorAll<HTMLInputElement>('input[name="themeMode"]').forEach((r) => {
    r.checked = r.value === mode;
  });
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
      if (getThemeMode() === 'system') applyTheme('system');
    });
  }

  // 3) радиокнопки в настройках
  const radios = document.querySelectorAll<HTMLInputElement>('input[name="themeMode"]');
  radios.forEach(r => { r.checked = (r.value === themeMode); });
  radios.forEach(r => r.addEventListener('change', () => {
    if (r.checked) setThemeMode(r.value as ThemeMode);
  }));

  // 4) кнопка-переключатель в верхней панели: от текущей видимой темы, а не от сохранённого режима
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    setThemeMode(resolvedTheme() === 'dark' ? 'light' : 'dark');
  });
}

// Для отладки из консоли:
;(window as any).setThemeMode = setThemeMode;
;(window as any).getThemeMode = getThemeMode;
