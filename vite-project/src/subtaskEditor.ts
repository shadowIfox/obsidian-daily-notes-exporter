// subtaskEditor.ts — редактор подпунктов: список с чекбоксами, полем ввода и удалением.
// Используется и в окне задачи (taskModal), и в форме быстрого добавления на странице «Задачи» (todo) —
// логика одна и та же, различаются только id элементов в разметке.

import { tr } from './i18n';
import { todayStr } from './dates';
import { icon } from './icons';
import { newId, type Subtask } from './store';

export type SubtaskEditor = {
    /** Текущие подпункты: пустой текст отбрасывается, текст обрезается от пробелов по краям. */
    get(): Subtask[];
    /** Заполняет редактор подпунктами (клон — исходный массив не меняется, пока форма открыта). */
    set(subtasks: Subtask[]): void;
};

/** ids элементов разметки: `<ul id={listId}>`, `<input id={inputId}>`, `<button id={addBtnId}>`. */
export function createSubtaskEditor(listId: string, inputId: string, addBtnId: string): SubtaskEditor {
    let draft: Subtask[] = [];
    const list = document.getElementById(listId) as HTMLUListElement | null;
    const input = document.getElementById(inputId) as HTMLInputElement | null;

    function render(): void {
        if (!list) return;
        list.replaceChildren();

        draft.forEach((subtask, index) => {
            const row = document.createElement('li');
            row.className = 'subtask-editor__row';

            const check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'check check--sm';
            check.checked = subtask.completed;
            check.setAttribute('aria-label', tr('Выполнено'));
            check.addEventListener('change', () => {
                subtask.completed = check.checked;
                subtask.completedAt = subtask.completed ? todayStr() : undefined;
            });

            const text = document.createElement('input');
            text.type = 'text';
            text.className = 'input subtask-editor__text';
            text.maxLength = 100;
            text.value = subtask.text;
            text.addEventListener('input', () => {
                subtask.text = text.value;
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'icon-btn icon-btn--sm icon-btn--danger';
            removeBtn.setAttribute('aria-label', tr('Удалить подпункт'));
            removeBtn.title = tr('Удалить');
            removeBtn.innerHTML = icon('x', 16);
            removeBtn.addEventListener('click', () => {
                draft.splice(index, 1);
                render();
            });

            row.append(check, text, removeBtn);
            list.appendChild(row);
        });
    }

    function add(): void {
        const text = input?.value.trim();
        if (!input || !text) return;
        draft.push({ id: newId(), text, completed: false });
        input.value = '';
        render();
        input.focus();
    }

    document.getElementById(addBtnId)?.addEventListener('click', add);
    input?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault(); // иначе Enter отправил бы всю форму задачи
        add();
    });

    return {
        get: () => draft.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text),
        set: (subtasks) => {
            draft = subtasks.map((s) => ({ ...s }));
            render();
        },
    };
}
