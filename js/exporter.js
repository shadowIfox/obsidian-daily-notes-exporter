// exporter.js
// Экспорт и синхронизация с календарём

import { noteText, dateInput, taskList } from './storage.js';

export function setupExporter() {
    const downloadBtn = document.getElementById('download-btn');

    if (!downloadBtn) return;

    downloadBtn.addEventListener('click', () => {
        const tasks = [];
        taskList.querySelectorAll('li').forEach(li => {
            const checked = li.querySelector('input[type="checkbox"]').checked ? '[x]' : '[ ]';
            const text = li.querySelector('input[type="text"]').value;
            tasks.push(`- ${checked} ${text}`);
        });
        const note = `# Заметка на ${dateInput.value}\n\n${noteText.value}\n\n## Задачи\n${tasks.join('\n')}`;

        const blob = new Blob([note], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `note_${dateInput.value}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}