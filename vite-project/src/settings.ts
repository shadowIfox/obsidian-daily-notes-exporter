// settings.ts — страница настроек: профиль и экспорт данных.
// Тема (System / Light / Dark) переключается в theme.ts.

import { exportFullData } from './exporter';
import { loadSettings, saveSettings } from './store';

function setupProfile() {
    const form = document.getElementById('profile-form') as HTMLFormElement | null;
    const input = document.getElementById('user-name') as HTMLInputElement | null;
    const hint = document.getElementById('profile-hint');
    if (!form || !input) return;

    input.value = loadSettings().userName;

    let hideTimer: number | undefined;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({ userName: input.value.trim() });
        if (!hint) return;
        hint.textContent = 'Сохранено';
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => { hint.textContent = ''; }, 2000);
    });
}

function setupExportModal() {
    const openBtn = document.getElementById('open-export-dialog');
    const modal = document.getElementById('export-modal');
    const closeBtn = document.getElementById('close-export-modal');
    const confirmBtn = document.getElementById('confirm-export');
    if (!openBtn || !modal || !closeBtn || !confirmBtn) return;

    const open = () => modal.classList.add('is-open');
    const close = () => modal.classList.remove('is-open');

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    // Клик по фону (не по содержимому) и клавиша Esc
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    confirmBtn.addEventListener('click', () => {
        const value = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? '';
        close();
        exportFullData({
            period: value('export-period'),
            category: value('export-category'),
            format: value('export-format'),
        });
    });
}

export function setupSettings() {
    setupProfile();
    setupExportModal();
}
