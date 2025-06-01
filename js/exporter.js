// --- Генерация Markdown-файла ---
downloadBtn.addEventListener('click', () => {
    const date = dateInput.value || 'Без даты';

    const tasks = Array.from(taskList.querySelectorAll('.task-item'))
        .map(item => {
            const textInput = item.querySelector('input[type="text"]');
            const checkbox = item.querySelector('input[type="checkbox"]');
            const text = textInput ? textInput.value.trim() : '';
            const checked = checkbox ? checkbox.checked : false;
            return text ? `- [${checked ? 'x' : ' '}] ${text}` : '';
        })
        .filter(text => text !== '')
        .join('\n');

    const notes = noteText.value.trim();

    if (!tasks && !notes) {
        showStatus("Нечего экспортировать");
        return;
    }

    const mdContent = `# ${date}\n\n## ✅ Задачи\n${tasks || '-'}\n\n## ✍️ Заметки\n${notes || '-'}`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${date}-daily-note.md`;
    link.click();

    showStatus("Файл успешно экспортирован");
});
