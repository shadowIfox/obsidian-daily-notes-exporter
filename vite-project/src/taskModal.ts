// taskModal.ts — окно «Новая задача» (открывается из календаря на главной).
// Разметка лежит в index.html (#task-modal).

import { todayStr } from './dates';
import { addTask } from './todo';
import type { Priority, Task } from './store';

let onCreated: (task: Task) => void = () => {};

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

export function openTaskModal(date: string): void {
    const modal = el('task-modal');
    const form = el<HTMLFormElement>('task-modal-form');
    if (!modal || !form) return;

    form.reset();
    el<HTMLInputElement>('tm-date')!.value = date || todayStr();
    const normal = form.querySelector<HTMLInputElement>('input[name="tm-priority"][value="normal"]');
    if (normal) normal.checked = true;

    modal.classList.add('is-open');
    el<HTMLInputElement>('tm-text')?.focus();
}

function closeTaskModal(): void {
    el('task-modal')?.classList.remove('is-open');
}

/** Один раз навешивает обработчики; onCreated вызывается после добавления задачи. */
export function setupTaskModal(created: (task: Task) => void): void {
    onCreated = created;
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
        const priority = (form.querySelector<HTMLInputElement>('input[name="tm-priority"]:checked')?.value ?? 'normal') as Priority;
        const task = addTask({
            text,
            date: el<HTMLInputElement>('tm-date')!.value,
            time: time || undefined,
            category: el<HTMLInputElement>('tm-category')!.value.trim(),
            priority,
        });
        closeTaskModal();
        onCreated(task);
    });
}
