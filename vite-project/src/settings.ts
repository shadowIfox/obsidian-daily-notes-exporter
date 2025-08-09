// settings.ts

import { exportFullData } from './exporter';

export function setupSettings() {
    // Модальный экспорт данных
    const openBtn = document.getElementById('open-export-dialog');
    const modal = document.getElementById('export-modal');
    const closeBtn = document.getElementById('close-export-modal');
    const confirmBtn = document.getElementById('confirm-export');

    if (openBtn && modal && closeBtn && confirmBtn) {
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Закрывать по клику на фон, но не на контент
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        confirmBtn.addEventListener('click', () => {
            const period = (document.getElementById('export-period') as HTMLSelectElement).value;
            const category = (document.getElementById('export-category') as HTMLSelectElement).value;
            const format = (document.getElementById('export-format') as HTMLSelectElement).value;
            modal.classList.add('hidden');
            exportFullData({ period, category, format });
        });
    }
}