import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

const save = vi.fn<(options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>>();
const writeTextFile = vi.fn<(path: string, content: string) => Promise<void>>();
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: (...a: Parameters<typeof save>) => save(...a) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: (...a: Parameters<typeof writeTextFile>) => writeTextFile(...a) }));

const { downloadText } = await import('../../src/utils/download');
const { isTauri } = await import('../../src/utils/platform');

const inTauri = () => Object.assign(window, { __TAURI_INTERNALS__: {} });

beforeEach(() => {
    save.mockReset();
    writeTextFile.mockReset();
});

afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    vi.restoreAllMocks();
});

describe('isTauri', () => {
    it('в обычном браузере — false, в окне Tauri — true', () => {
        assert.equal(isTauri(), false);
        inTauri();
        assert.equal(isTauri(), true);
    });
});

describe('downloadText в браузере', () => {
    it('скачивает через ссылку с именем файла и не вызывает диалог', async () => {
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        URL.createObjectURL = vi.fn(() => 'blob:x');
        URL.revokeObjectURL = vi.fn();
        await downloadText('привет', 'заметки.md', 'text/markdown');
        assert.equal(click.mock.instances.length, 1);
        assert.equal((click.mock.instances[0] as HTMLAnchorElement).download, 'заметки.md');
        assert.equal(save.mock.calls.length, 0);
    });
});

describe('downloadText в приложении', () => {
    it('спрашивает место в диалоге и пишет файл туда, фильтр по расширению', async () => {
        inTauri();
        save.mockResolvedValue('/Users/я/Desktop/backup.json');
        await downloadText('{"a":1}', 'backup.json', 'application/json');
        assert.deepEqual(save.mock.calls[0][0], {
            defaultPath: 'backup.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        assert.deepEqual(writeTextFile.mock.calls, [['/Users/я/Desktop/backup.json', '{"a":1}']]);
    });

    it('отмена диалога — файл не пишется и ошибки нет', async () => {
        inTauri();
        const alert = vi.fn();
        window.alert = alert;
        save.mockResolvedValue(null);
        await downloadText('x', 'a.csv', 'text/csv');
        assert.equal(writeTextFile.mock.calls.length, 0);
        assert.equal(alert.mock.calls.length, 0);
    });

    it('ошибка записи показывается сообщением, а не пропадает', async () => {
        inTauri();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const alert = vi.fn();
        window.alert = alert;
        save.mockResolvedValue('/x/a.md');
        writeTextFile.mockRejectedValue(new Error('нет доступа'));
        await downloadText('x', 'a.md', 'text/markdown');
        assert.match(String(alert.mock.calls[0][0]), /Не удалось сохранить файл: нет доступа/);
    });
});
