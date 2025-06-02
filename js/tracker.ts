// tracker.js
// Трекер задач и привычек

import { taskList } from './storage.js';

export function setupTracker() {
    const progressBox = document.getElementById('progress');

    function updateProgress() {
        const items = taskList.querySelectorAll('li');
        const total = items.length;
        const done = [...items].filter(li => li.querySelector('input[type="checkbox"]').checked).length;
        const percent = total ? Math.round((done / total) * 100) : 0;

        if (progressBox) {
            progressBox.textContent = `Выполнено: ${done} из ${total} (${percent}%)`;
        }
    }

    taskList.addEventListener('change', updateProgress);

    updateProgress();
}
