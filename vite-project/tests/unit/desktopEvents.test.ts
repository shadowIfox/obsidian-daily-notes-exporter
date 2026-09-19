import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';

const listeners = new Map<string, () => void>();
const listen = vi.fn(async (name: string, cb: () => void) => {
    listeners.set(name, cb);
    return () => listeners.delete(name);
});
vi.mock('@tauri-apps/api/event', () => ({ listen: (...a: Parameters<typeof listen>) => listen(...a) }));

const { NEW_TASK_EVENT, onNewTaskRequested } = await import('../../src/desktopEvents');

describe('onNewTaskRequested', () => {
    it('подписывается на событие оболочки и вызывает обработчик при каждом запросе', async () => {
        let calls = 0;
        await onNewTaskRequested(() => calls++);
        assert.equal(NEW_TASK_EVENT, 'open-new-task');
        listeners.get('open-new-task')!();
        listeners.get('open-new-task')!();
        assert.equal(calls, 2);
    });

    it('отписка снимает обработчик', async () => {
        const off = await onNewTaskRequested(() => {});
        off();
        assert.equal(listeners.has('open-new-task'), false);
    });
});
