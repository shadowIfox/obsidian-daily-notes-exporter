// taskModal.ts — окно задачи: «Новая задача» и «Редактировать задачу».
// Открывается из календаря на главной и кнопкой «Изменить» в разделе «Задачи».
// Разметка лежит в index.html (#task-modal).

import { tr } from './i18n';
import { todayStr } from './dates';
import type { Priority, Task } from './store';
import { addTask, updateTask } from './todo';

/** created — задача только что создана (true) или отредактирована (false). */
type SavedHandler = (task: Task, created: boolean) => void;

let onSaved: SavedHandler = () => {};
let editing: Task | null = null;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** Открывает окно: с task — редактирование, иначе новая задача (дата по умолчанию — date или сегодня). */
export function openTaskModal(opts: { date?: string; task?: Task } = {}): void {
    const modal = el('task-modal');
    const form = el<HTMLFormElement>('task-modal-form');
    if (!modal || !form) return;

    editing = opts.task ?? null;
    form.reset();

    el('task-modal-title')!.textContent = editing ? tr('Редактировать задачу') : tr('Новая задача');
    el('task-modal-submit')!.textContent = editing ? tr('Сохранить') : tr('Добавить');

    el<HTMLInputElement>('tm-text')!.value = editing?.text ?? '';
    el<HTMLInputElement>('tm-date')!.value = editing ? editing.date : opts.date || todayStr();
    el<HTMLInputElement>('tm-time')!.value = editing?.time ?? '';
    el<HTMLInputElement>('tm-category')!.value = editing?.category ?? '';
    el<HTMLTextAreaElement>('tm-notes')!.value = editing?.notes ?? '';
    const priority = editing?.priority ?? 'normal';
    const radio = form.querySelector<HTMLInputElement>(`input[name="tm-priority"][value="${priority}"]`);
    if (radio) radio.checked = true;

    modal.classList.add('is-open');
    el<HTMLInputElement>('tm-text')?.focus();
}

function closeTaskModal(): void {
    el('task-modal')?.classList.remove('is-open');
    editing = null;
}

/** Один раз навешивает обработчики; saved вызывается после создания или сохранения задачи. */
export function setupTaskModal(saved: SavedHandler): void {
    onSaved = saved;
    const modal = el('task-modal');
    const form = el<HTMLFormElement>('task-modal-form');
    if (!modal || !form) return;

    el('task-modal-cancel')?.addEventListener('click', closeTaskModal);
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) closeTaskModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) closeTaskModal();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = el<HTMLInputElement>('tm-text')!.value.trim();
        if (!text) return;
        const time = el<HTMLInputElement>('tm-time')!.value;
        let date = el<HTMLInputElement>('tm-date')!.value;
        if (time && !date) date = todayStr(); // время без даты не попало бы в расписание
        const fields = {
            text,
            date,
            time: time || undefined,
            category: el<HTMLInputElement>('tm-category')!.value.trim(),
            priority: (form.querySelector<HTMLInputElement>('input[name="tm-priority"]:checked')?.value ?? 'normal') as Priority,
            notes: el<HTMLTextAreaElement>('tm-notes')!.value.trim(),
        };

        if (editing) {
            const task = { ...editing, ...fields };
            updateTask(editing.id, fields);
            closeTaskModal();
            onSaved(task, false);
        } else {
            const task = addTask(fields);
            closeTaskModal();
            onSaved(task, true);
        }
    });
}
