// backup.ts — резервная копия всех данных одним JSON-файлом и восстановление из неё (без DOM).

import { toDateStr } from './dates';
import { migrate, SCHEMA_VERSION } from './migrations';
import {
    loadHabits,
    loadMood,
    loadSettings,
    loadTasks,
    normalizeHabits,
    normalizeMood,
    normalizeSettings,
    normalizeTasks,
    saveHabits,
    saveMood,
    saveSettings,
    saveTasks,
    type Habit,
    type MoodEntry,
    type Task,
    type UserSettings,
} from './store';

export const BACKUP_APP = 'moi-den';
/** Версия копии = версия схемы данных: копии из старых версий проходят те же миграции, что и данные при запуске. */
export const BACKUP_VERSION = SCHEMA_VERSION;
const MAX_BACKUP_CHARS = 20_000_000;

export type Backup = {
    app: typeof BACKUP_APP;
    version: number;
    exportedAt: string;
    tasks: Task[];
    habits: Habit[];
    mood: MoodEntry[];
    settings: UserSettings;
};

export type BackupCounts = { tasks: number; habits: number; mood: number };

export type ParseResult =
    | { ok: true; backup: Backup; counts: BackupCounts }
    | { ok: false; error: string };

export type ImportMode = 'merge' | 'replace';

export type ImportSummary = {
    mode: ImportMode;
    tasks: number;        // добавлено (при замене — записано) задач
    habits: number;       // привычек
    habitMarks: number;   // новых отметок у уже существующих привычек (только при объединении)
    mood: number;         // записей настроения
};

/** Собирает копию из текущих данных. */
export function buildBackup(now: Date = new Date()): Backup {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        tasks: loadTasks(),
        habits: loadHabits(),
        mood: loadMood(),
        settings: loadSettings(),
    };
}

export function backupFilename(now: Date = new Date()): string {
    return `${BACKUP_APP}-backup-${toDateStr(now)}.json`;
}

export function serializeBackup(backup: Backup): string {
    return JSON.stringify(backup, null, 2);
}

/** Оставляет по одной записи на ключ (последняя побеждает). */
function dedupeBy<T>(list: T[], key: (item: T) => string): T[] {
    return [...new Map(list.map((item) => [key(item), item])).values()];
}

/** Разбирает и проверяет текст копии. Ничего не сохраняет. Мусорные записи отбрасываются. */
export function parseBackup(text: string): ParseResult {
    if (!text.trim()) return { ok: false, error: 'Файл пустой.' };
    if (text.length > MAX_BACKUP_CHARS) return { ok: false, error: 'Файл слишком большой для резервной копии.' };

    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return { ok: false, error: 'Не удалось прочитать файл: это не JSON.' };
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { ok: false, error: 'Файл не похож на резервную копию приложения.' };
    }

    const d = data as Record<string, unknown>;
    const hasData = ['tasks', 'habits', 'mood'].some((k) => Array.isArray(d[k]));
    if (d.app !== BACKUP_APP && !hasData) return { ok: false, error: 'Файл не похож на резервную копию приложения.' };
    if (typeof d.version === 'number' && d.version > BACKUP_VERSION) {
        return { ok: false, error: 'Копия создана в более новой версии приложения — обновите приложение и повторите.' };
    }

    // Копия без версии — от руки собранный или очень старый файл: считаем её версией 0
    const fileVersion = typeof d.version === 'number' && Number.isInteger(d.version) && d.version >= 0 ? d.version : 0;
    const migrated = migrate({ tasks: d.tasks, habits: d.habits, mood: d.mood, settings: d.settings }, fileVersion);

    const backup: Backup = {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : '',
        tasks: dedupeBy(normalizeTasks(migrated.tasks), (t) => t.id),
        habits: dedupeBy(normalizeHabits(migrated.habits), (h) => h.id),
        mood: dedupeBy(normalizeMood(migrated.mood), (m) => m.date),
        settings: normalizeSettings(migrated.settings),
    };
    return { ok: true, backup, counts: { tasks: backup.tasks.length, habits: backup.habits.length, mood: backup.mood.length } };
}

/**
 * Записывает данные из копии.
 * replace — текущие данные и настройки заменяются копией.
 * merge — добавляется то, чего ещё нет (задачи и привычки по id, настроение по дате);
 *         у общих привычек объединяются отметки; настройки не меняются.
 */
export function applyBackup(backup: Backup, mode: ImportMode): ImportSummary {
    if (mode === 'replace') {
        saveTasks(backup.tasks);
        saveHabits(backup.habits);
        saveMood(backup.mood);
        saveSettings(backup.settings);
        return { mode, tasks: backup.tasks.length, habits: backup.habits.length, habitMarks: 0, mood: backup.mood.length };
    }

    const tasks = loadTasks();
    const taskIds = new Set(tasks.map((t) => t.id));
    const newTasks = backup.tasks.filter((t) => !taskIds.has(t.id));
    saveTasks([...tasks, ...newTasks]);

    const habits = loadHabits();
    const byId = new Map(habits.map((h) => [h.id, h]));
    let newHabits = 0;
    let habitMarks = 0;
    for (const incoming of backup.habits) {
        const existing = byId.get(incoming.id);
        if (!existing) {
            habits.push(incoming);
            newHabits++;
            continue;
        }
        const merged = [...new Set([...existing.dates, ...incoming.dates])].sort();
        habitMarks += merged.length - existing.dates.length;
        existing.dates = merged;
    }
    saveHabits(habits);

    const mood = loadMood();
    const dates = new Set(mood.map((m) => m.date));
    const newMood = backup.mood.filter((m) => !dates.has(m.date));
    saveMood([...mood, ...newMood].sort((a, b) => a.date.localeCompare(b.date)));

    return { mode, tasks: newTasks.length, habits: newHabits, habitMarks, mood: newMood.length };
}
