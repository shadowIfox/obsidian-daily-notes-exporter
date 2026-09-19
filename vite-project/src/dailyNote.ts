// dailyNote.ts — ежедневная заметка для Obsidian: блок «Мой день» в файле daily-notes/ГГГГ-ММ-ДД.md.
//
// Заметка может содержать и её собственный текст, поэтому приложение владеет только блоком между маркерами:
// он заменяется на месте, а если его ещё нет — дописывается в конец. Всё остальное в файле не трогается.

import { invoke } from '@tauri-apps/api/core';
import { taskLine } from './exporter';
import { isDue } from './stats';
import { loadActiveHabits, loadMood, loadTasks, type Habit, type MoodEntry, type Task } from './store';

export const BLOCK_START = '<!-- мой-день:начало -->';
export const BLOCK_END = '<!-- мой-день:конец -->';

export type DayData = { tasks: Task[]; habits: Habit[]; mood: MoodEntry[] };

/** Блок заметки за день: задачи (с дедлайном или выполненные в этот день), привычки по графику, настроение. */
export function buildDailyNoteBlock(date: string, { tasks, habits, mood }: DayData): string {
    const dayTasks = tasks.filter((t) => t.date === date || t.completedAt === date);
    const dayHabits = habits.filter((h) => isDue(h, date));
    const entry = mood.find((m) => m.date === date);

    let body = '';
    if (dayTasks.length) {
        body += '### Задачи\n';
        for (const t of dayTasks) {
            body += `- [${t.completed ? 'x' : ' '}] ${taskLine(t)}\n`;
            // заметка к задаче — цитатой под ней, как в экспорте
            if (t.notes)
                body +=
                    t.notes
                        .split('\n')
                        .map((l) => `  > ${l}`)
                        .join('\n') + '\n';
        }
        body += '\n';
    }
    if (dayHabits.length) {
        body += '### Привычки\n';
        for (const h of dayHabits) body += `- [${h.dates.includes(date) ? 'x' : ' '}] ${h.text}\n`;
        body += '\n';
    }
    if (entry) body += `### Настроение\n${entry.rating}/5${entry.note ? ` — ${entry.note}` : ''}\n\n`;
    if (!body) body = 'Записей за этот день нет.\n\n';

    return `${BLOCK_START}\n## Мой день\n\n${body}${BLOCK_END}`;
}

/** Вставляет блок в текст заметки: заменяет прежний, иначе дописывает в конец; заметки нет — только блок. */
export function mergeNoteBlock(existing: string | null, block: string): string {
    if (existing === null || existing.trim() === '') return `${block}\n`;
    const start = existing.indexOf(BLOCK_START);
    const end = existing.indexOf(BLOCK_END, start + 1);
    if (start !== -1 && end !== -1) return existing.slice(0, start) + block + existing.slice(end + BLOCK_END.length);
    return `${existing.replace(/\s+$/, '')}\n\n${block}\n`;
}

// Записи идут по одной: автообновление и кнопка не должны читать и писать один файл одновременно
let queue: Promise<unknown> = Promise.resolve();

/** Записывает в vault заметку за указанный день (данные берутся из store). Ошибка отклоняет промис. */
export function writeDailyNote(vault: string, date: string): Promise<void> {
    const run = async (): Promise<void> => {
        const existing = await invoke<string | null>('vault_read_note', { vault, date });
        const block = buildDailyNoteBlock(date, { tasks: loadTasks(), habits: loadActiveHabits(), mood: loadMood() });
        await invoke('vault_write_note', { vault, date, content: mergeNoteBlock(existing, block) });
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
}
