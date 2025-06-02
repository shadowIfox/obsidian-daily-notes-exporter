// exporter.js
// Экспорт и синхронизация с календарём

import { noteText, dateInput, taskList } from './storage';

export function setupExporter(): void {
    const downloadBtn = document.getElementById('download-btn');
    if (!downloadBtn || !taskList || !noteText || !dateInput) return;

    downloadBtn.addEventListener('click', () => {
        if (!taskList || !noteText || !dateInput) return;
        const tasks: string[] = [];
        taskList.querySelectorAll('li').forEach(li => {
            const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
            const input = li.querySelector('input[type="text"]') as HTMLInputElement | null;
            const checked = checkbox && checkbox.checked ? '[x]' : '[ ]';
            const text = input?.value ?? '';
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