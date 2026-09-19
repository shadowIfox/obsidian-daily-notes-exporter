// settings.ts

import { exportFullData } from './exporter';

// Тема (System / Light / Dark) переключается в theme.ts — здесь только экспорт.
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
}
