// utils/download.ts — сохранение текста как файла

import { isTauri } from './platform';

const EXTENSION = /\.([a-z0-9]+)$/i;

/** В окне Tauri: системный диалог «Сохранить как…» и запись файла в выбранное место. Отмена диалога — не ошибка. */
async function saveWithDialog(content: string, filename: string): Promise<void> {
    const [{ save }, { writeTextFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
    const extension = EXTENSION.exec(filename)?.[1];
    const path = await save({
        defaultPath: filename,
        filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : undefined,
    });
    if (path) await writeTextFile(path, content);
}

function saveInBrowser(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Отдаёт текст пользователю как файл: в браузере — обычное скачивание, в приложении — диалог сохранения
 * (скачивание через ссылку в окне приложения не работает). Ошибку показывает сама, чтобы вызывающему не надо было ловить.
 */
export async function downloadText(content: string, filename: string, mime: string): Promise<void> {
    if (!isTauri()) {
        saveInBrowser(content, filename, mime);
        return;
    }
    try {
        await saveWithDialog(content, filename);
    } catch (error) {
        console.error('Не удалось сохранить файл', error);
        window.alert(`Не удалось сохранить файл: ${error instanceof Error ? error.message : String(error)}`);
    }
}
