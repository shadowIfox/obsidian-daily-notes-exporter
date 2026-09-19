// exporter.ts — экспорт данных в Markdown / CSV / PDF (через печать)

import { addDays, lastNDates, todayStr } from './dates';
import { isDue } from './stats';
import { loadActiveHabits, loadMood, loadTasks, type MoodEntry, type Task } from './store';
import { downloadText } from './utils/download';
import { escapeHtml } from './utils/html';

export type ExportParams = {
    period: string; // 'day' | 'week' | 'month'
    category: string; // 'all' | 'tasks' | 'habits' | 'mood'
    format: string; // 'md' | 'csv' | 'pdf'
};

export type ExportFile = { content: string; filename: string; mime: string };

type HabitStat = { name: string; daysDone: number; totalDays: number };

type ExportData = {
    from: string;
    to: string;
    tasks: Task[];
    habits: HabitStat[];
    mood: MoodEntry[];
};

const PERIOD_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };
const NO_DATE = 'Без даты';
const PRIORITY_LABELS = { low: 'низкий', normal: 'обычный', high: 'высокий' } as const;

/** Строка задачи: «14:30 Название (Категория) — важно». */
function taskLine(t: Task): string {
    const parts = [t.time ? `${t.time} ` : '', t.text, t.category ? ` (${t.category})` : ''];
    if (t.priority === 'high') parts.push(' — важно');
    else if (t.priority === 'low') parts.push(' — низкий приоритет');
    return parts.join('');
}

// ===== Сбор данных за период =====

function collectData({ period, category }: ExportParams, today: string): ExportData {
    const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.week;
    const to = today;
    const from = addDays(to, -(days - 1));
    const inRange = (d?: string): boolean => !!d && d >= from && d <= to;

    const withTasks = category === 'all' || category === 'tasks';
    const withHabits = category === 'all' || category === 'habits';
    const withMood = category === 'all' || category === 'mood';

    // В период попадают задачи с дедлайном или выполнением в эти дни, а также невыполненные без даты
    const tasks = withTasks ? loadTasks().filter((t) => inRange(t.date) || inRange(t.completedAt) || (!t.date && !t.completed)) : [];

    const habits = withHabits
        ? loadActiveHabits().map((h) => {
              // считаем только дни по графику привычки
              const due = lastNDates(days, to).filter((d) => isDue(h, d));
              return { name: h.text, daysDone: due.filter((d) => h.dates.includes(d)).length, totalDays: due.length };
          })
        : [];

    const mood = withMood ? loadMood().filter((m) => inRange(m.date)) : [];

    return { from, to, tasks, habits, mood };
}

/** Задачи по дедлайну, группы по возрастанию даты; задачи без даты — в конце. */
function groupTasksByDate(tasks: Task[]): [string, Task[]][] {
    const groups = new Map<string, Task[]>();
    for (const t of tasks) {
        const key = t.date || NO_DATE;
        groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()].sort(([a], [b]) => {
        if (a === NO_DATE) return 1;
        if (b === NO_DATE) return -1;
        return a.localeCompare(b);
    });
}

const isEmpty = (d: ExportData): boolean => !d.tasks.length && !d.habits.length && !d.mood.length;

// ===== Markdown =====

function toMarkdown(d: ExportData, today: string): string {
    let out = `# Экспорт данных от ${today}\n\n`;
    out += `**Период экспорта:** ${d.from} — ${d.to}\n\n`;

    if (isEmpty(d)) return out + 'Нет данных за выбранный период.\n';

    if (d.tasks.length) {
        out += `## Задачи\n`;
        for (const [day, list] of groupTasksByDate(d.tasks)) {
            out += `### ${day}\n`;
            for (const t of list) {
                out += `- [${t.completed ? 'x' : ' '}] ${taskLine(t)}\n`;
                // заметка — цитатой под задачей (в Obsidian отображается как блок)
                if (t.notes)
                    out +=
                        t.notes
                            .split('\n')
                            .map((l) => `  > ${l}`)
                            .join('\n') + '\n';
            }
            out += '\n';
        }
    }

    if (d.habits.length) {
        out += `## Привычки\n`;
        for (const h of d.habits) out += `- ${h.name}: ${h.daysDone}/${h.totalDays} дней\n`;
        out += '\n';
    }

    if (d.mood.length) {
        out += `## Настроение\n`;
        for (const m of d.mood) out += `- ${m.date}: ${m.rating}/5${m.note ? ' — ' + m.note : ''}\n`;
        out += '\n';
    }

    return out;
}

// ===== CSV =====

/** Оборачивает значение в кавычки и удваивает внутренние кавычки (RFC 4180). */
const csvCell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (cells: (string | number)[]): string => cells.map(csvCell).join(',') + '\n';

function toCsv(d: ExportData): string {
    let out = '';

    if (d.tasks.length) {
        out += csvRow(['Дата', 'Время', 'Задача', 'Категория', 'Приоритет', 'Статус', 'Заметка']);
        for (const t of d.tasks) {
            out += csvRow([
                t.date,
                t.time ?? '',
                t.text,
                t.category,
                PRIORITY_LABELS[t.priority],
                t.completed ? 'выполнено' : 'не выполнено',
                t.notes,
            ]);
        }
        out += '\n';
    }

    if (d.habits.length) {
        out += csvRow(['Привычка', 'Выполнено', 'Всего']);
        for (const h of d.habits) out += csvRow([h.name, h.daysDone, h.totalDays]);
        out += '\n';
    }

    if (d.mood.length) {
        out += csvRow(['Дата', 'Оценка', 'Комментарий']);
        for (const m of d.mood) out += csvRow([m.date, m.rating, m.note]);
        out += '\n';
    }

    // BOM, чтобы Excel/Numbers правильно распознали кириллицу
    return '﻿' + out;
}

// ===== HTML (для печати в PDF) =====

function toHtml(d: ExportData, today: string): string {
    const li = (s: string) => `<li>${escapeHtml(s)}</li>`;
    let body = `<h1>Экспорт данных от ${today}</h1><p><b>Период:</b> ${d.from} — ${d.to}</p>`;

    if (isEmpty(d)) body += '<p>Нет данных за выбранный период.</p>';

    if (d.tasks.length) {
        body += '<h2>Задачи</h2>';
        for (const [day, list] of groupTasksByDate(d.tasks)) {
            body += `<h3>${escapeHtml(day)}</h3><ul>`;
            for (const t of list) {
                body += li(`${t.completed ? '☑' : '☐'} ${taskLine(t)}${t.notes ? ` — ${t.notes}` : ''}`);
            }
            body += '</ul>';
        }
    }
    if (d.habits.length) {
        body += '<h2>Привычки</h2><ul>' + d.habits.map((h) => li(`${h.name}: ${h.daysDone}/${h.totalDays} дней`)).join('') + '</ul>';
    }
    if (d.mood.length) {
        body +=
            '<h2>Настроение</h2><ul>' + d.mood.map((m) => li(`${m.date}: ${m.rating}/5${m.note ? ' — ' + m.note : ''}`)).join('') + '</ul>';
    }

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Экспорт данных</title>
<style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:32px;color:#111}
h1{font-size:22px}h2{font-size:18px;margin-top:24px}h3{font-size:14px;margin:12px 0 4px}ul{margin:0;padding-left:20px}li{margin:2px 0}</style>
</head><body>${body}</body></html>`;
}

// ===== Сборка файла (без обращения к DOM — удобно тестировать) =====

export function buildExport(params: ExportParams, today: string = todayStr()): ExportFile {
    const data = collectData(params, today);
    const base = `export_${params.period}_${params.category}_${today}`;

    if (params.format === 'csv') {
        return { content: toCsv(data), filename: `${base}.csv`, mime: 'text/csv;charset=utf-8' };
    }
    if (params.format === 'pdf') {
        return { content: toHtml(data, today), filename: `${base}.pdf`, mime: 'text/html' };
    }
    return { content: toMarkdown(data, today), filename: `${base}.md`, mime: 'text/markdown;charset=utf-8' };
}

// ===== Доставка пользователю =====

function downloadFile({ content, filename, mime }: ExportFile): void {
    downloadText(content, filename, mime);
}

/** Печатает HTML через скрытый iframe: в диалоге печати macOS выбирается «Сохранить как PDF». */
function printHtml(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
        iframe.remove();
        return;
    }
    win.onafterprint = () => iframe.remove();
    doc.open();
    doc.write(html);
    doc.close();
    win.focus();
    win.print();
}

export function exportFullData(params: ExportParams): void {
    const file = buildExport(params);
    if (params.format === 'pdf') {
        printHtml(file.content);
    } else {
        downloadFile(file);
    }
}
