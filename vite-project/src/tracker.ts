// tracker.js
// Трекер задач и привычек

import { taskList } from './storage';

export function setupTracker() {
    const progressBox = document.getElementById('progress');

    function updateProgress() {
        if (!taskList) return;

        // Явно приводим к NodeListOf<HTMLLIElement>
        const items = taskList.querySelectorAll('li');
        const total = items.length;
        let done = 0;

        items.forEach(li => {
            const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
            if (checkbox && checkbox.checked) done++;
        });

        const percent = total ? Math.round((done / total) * 100) : 0;

        if (progressBox) {
            progressBox.textContent = `Выполнено: ${done} из ${total} (${percent}%)`;
        }
    }

    if (taskList) {
        taskList.addEventListener('change', updateProgress);
        updateProgress();
    }
}
