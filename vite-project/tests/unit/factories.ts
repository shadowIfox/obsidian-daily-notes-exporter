// Фабрики тестовых данных: пустая задача/привычка/запись настроения с точечными переопределениями.
import type { Habit, Marker, MoodEntry, Subtask, Task } from '../../src/store';

let counter = 0;
const nextId = (): string => `id-${++counter}`;

export const mkTask = (o: Partial<Task> = {}): Task => ({
    id: nextId(),
    text: '',
    date: '',
    category: '',
    priority: 'normal',
    notes: '',
    completed: false,
    subtasks: [],
    ...o,
});

/** Выполненная задача: completedAt = day. */
export const doneTask = (day: string, o: Partial<Task> = {}): Task => mkTask({ completed: true, completedAt: day, ...o });

export const mkSubtask = (o: Partial<Subtask> = {}): Subtask => ({ id: nextId(), text: '', completed: false, ...o });

/** Выполненный подпункт: completedAt = day. */
export const doneSubtask = (day: string, o: Partial<Subtask> = {}): Subtask => mkSubtask({ completed: true, completedAt: day, ...o });

export const mkHabit = (o: Partial<Habit> = {}): Habit => ({ id: nextId(), text: '', dates: [], ...o });

export const mkMood = (date: string, rating: number, note = ''): MoodEntry => ({ date, rating, note });

export const mkMarker = (o: Partial<Marker> = {}): Marker => ({ id: nextId(), name: '', historyTotal: 0, historyCompleted: 0, ...o });

/** n дней назад от 2026-09-19 включительно (самый свежий — первым), в локальном формате. */
export function daysBack(n: number, from = new Date(2026, 8, 19)): string[] {
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
}
