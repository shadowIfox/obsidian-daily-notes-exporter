// settings.ts

import { exportFullData } from './exporter';

export function setupSettings() {
    // ===== Модальное окно экспорта данных =====

    const openBtn = document.getElementById('open-export-dialog');
    const modal = document.getElementById('export-modal');
    const closeBtn = document.getElementById('close-export-modal');
    const confirmBtn = document.getElementById('confirm-export');

    if (openBtn && modal && closeBtn && confirmBtn) {

        // Открытие модального окна
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });

        // Закрытие модального окна по кнопке закрытия
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });

        // Закрытие модального окна по клику на фон (не на контент)
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });

        // Подтверждение экспорта данных
        confirmBtn.addEventListener('click', () => {
            // ===== Выбор периода, категории и формата для экспорта =====
            const periodSelect = document.getElementById('export-period') as HTMLSelectElement | null;
            const categorySelect = document.getElementById('export-category') as HTMLSelectElement | null;
            const formatSelect = document.getElementById('export-format') as HTMLSelectElement | null;

            const period = periodSelect ? periodSelect.value : '';
            const category = categorySelect ? categorySelect.value : '';
            const format = formatSelect ? formatSelect.value : '';

            modal.classList.add('hidden');
            modal.classList.remove('flex');

            exportFullData({ period, category, format });
        });
    }

    // ===== Тема (System / Light / Dark) =====

    const themeRadios = document.querySelectorAll<HTMLInputElement>('input[name="themeMode"]');

    if (themeRadios.length) {

        // Загрузка текущей темы из localStorage и установка активной радиокнопки
        try {
            const rawSettings = localStorage.getItem('userSettings');
            const currentSettings = rawSettings ? JSON.parse(rawSettings) : { themeMode: 'system' };

            themeRadios.forEach(radio => {
                radio.checked = (radio.value === currentSettings.themeMode);
            });
        } catch {
            // Ошибка при чтении localStorage — пропускаем
        }

        // Отправка события для main.ts при изменении темы
        themeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;

                const mode = radio.value as 'system' | 'light' | 'dark';

                window.dispatchEvent(new CustomEvent('set-theme-mode', { detail: { mode } }));
            });
        });
    }
}