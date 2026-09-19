// prefs.ts — мелкие настройки вида (свёрнутый сайдбар, фильтры списка задач).
// Это не данные пользователя, поэтому в резервную копию и в базу не попадают; потеря значения безвредна.

export function readPref(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writePref(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // хранилище недоступно или переполнено — настройка просто не запомнится
    }
}
