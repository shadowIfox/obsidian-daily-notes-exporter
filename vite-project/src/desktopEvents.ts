// desktopEvents.ts — сообщения от оболочки приложения (Rust): меню-бар и горячая клавиша.

import { listen } from '@tauri-apps/api/event';

/** Название события «открыть окно новой задачи» (то же, что NEW_TASK_EVENT в src-tauri/src/shell.rs). */
export const NEW_TASK_EVENT = 'open-new-task';

/** Вызывает handler, когда пользователь просит новую задачу из меню-бара или горячей клавишей. Возвращает функцию отписки. */
export function onNewTaskRequested(handler: () => void): Promise<() => void> {
    return listen(NEW_TASK_EVENT, () => handler());
}
