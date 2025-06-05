// exporter.ts


// Универсальная функция для скачивания файла
function downloadFile(content: string, filename: string, type: string = 'text/markdown') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Типы данных для экспорта
type Task = { text: string; done: boolean; date: string; };
type Habit = { name: string; daysDone: number; totalDays: number; };
type Mood = { date: string; rating: number; note?: string; };

type ExportParams = {
    period: string;      // 'day' | 'week' | 'month'
    category: string;    // 'all' | 'tasks' | 'habits' | 'mood'
    format: string;      // 'md' | 'csv' | 'pdf'
};

// ВНИМАНИЕ: подключи здесь свои функции, которые реально возвращают данные пользователя!
function getTasks(_period: string): Task[] {
    const raw = localStorage.getItem('tasks');
    if (!raw) return [];
    try {
        const tasks: Task[] = JSON.parse(raw);
        // TODO: фильтрация по period пока не реализована
        return tasks;
    } catch {
        return [];
    }
}

function getHabits(_period: string): Habit[] {
    const raw = localStorage.getItem('habits');
    if (!raw) return [];
    try {
        const habits: Habit[] = JSON.parse(raw);
        return habits;
    } catch {
        return [];
    }
}

function getMood(_period: string): Mood[] {
    const raw = localStorage.getItem('moodData');
    if (!raw) return [];
    try {
        const mood: Mood[] = JSON.parse(raw);
        return mood;
    } catch {
        return [];
    }
}

export function exportFullData({ period, category, format }: ExportParams) {
    const tasks = (category === 'all' || category === 'tasks') ? getTasks(period) : [];
    const habits = (category === 'all' || category === 'habits') ? getHabits(period) : [];
    const mood = (category === 'all' || category === 'mood') ? getMood(period) : [];

    let content = '';
    let filename = `export_${period}_${category}.${format}`;

    if (format === 'md') {
        // Шапка
        content += `# Экспорт данных от ${new Date().toLocaleDateString()}\n\n`;
        content += `**Период экспорта:** ${period}\n\n`;

        // ===== Задачи =====
        if (tasks.length) {
            content += `## Задачи\n`;
            // Группируем задачи по дате
            const grouped: { [key: string]: Task[] } = {};
            tasks.forEach(t => {
                if (!grouped[t.date]) grouped[t.date] = [];
                grouped[t.date].push(t);
            });
            Object.keys(grouped).forEach(day => {
                content += `### ${day}\n`;
                grouped[day].forEach(t => {
                    content += `- [${t.done ? 'x' : ' '}] ${t.text}\n`;
                });
                content += '\n';
            });
        }

        // ===== Привычки =====
        if (habits.length) {
            content += `## Привычки\n`;
            habits.forEach(h => {
                content += `- ${h.name}: ${h.daysDone}/${h.totalDays} дней\n`;
            });
            content += '\n';
        }

        // ===== Настроение =====
        if (mood.length) {
            content += `## Настроение\n`;
            mood.forEach(m => {
                content += `- ${m.date}: ${m.rating}${m.note ? ' — ' + m.note : ''}\n`;
            });
            content += '\n';
        }

        downloadFile(content, filename, 'text/markdown');
        return;
    }

    if (format === 'csv') {
        // ===== Задачи =====
        if (tasks.length) {
            content += 'Дата,Задача,Статус\n';
            tasks.forEach(t => {
                content += `${t.date},"${t.text}",${t.done ? 'выполнено' : 'не выполнено'}\n`;
            });
            content += '\n';
        }
        // ===== Привычки =====
        if (habits.length) {
            content += 'Привычка,Выполнено,Всего\n';
            habits.forEach(h => {
                content += `${h.name},${h.daysDone},${h.totalDays}\n`;
            });
            content += '\n';
        }
        // ===== Настроение =====
        if (mood.length) {
            content += 'Дата,Оценка,Комментарий\n';
            mood.forEach(m => {
                content += `${m.date},${m.rating},"${m.note ?? ''}"\n`;
            });
            content += '\n';
        }
        downloadFile(content, filename, 'text/csv');
        return;
    }

    if (format === 'pdf') {
        // PDF (реализация через jsPDF/pdf-lib при необходимости)
        alert('Экспорт в PDF пока не реализован!');
        return;
    }
}