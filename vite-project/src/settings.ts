// settings.ts — страница настроек: профиль и экспорт данных.
// Тема (System / Light / Dark) переключается в theme.ts.

import {
    applyBackup,
    backupFilename,
    buildBackup,
    parseBackup,
    serializeBackup,
    type Backup,
    type BackupCounts,
    type ImportSummary,
} from './backup';
import { formatDateShort } from './dates';
import { getLanguage, isLanguage, tp, tr } from './i18n';
import { exportFullData } from './exporter';
import { flushStore, loadSettings, saveSettings, type NotificationSettings } from './store';
import { downloadText } from './utils/download';
import { isTauri } from './utils/platform';

function setupProfile() {
    const form = document.getElementById('profile-form') as HTMLFormElement | null;
    const input = document.getElementById('user-name') as HTMLInputElement | null;
    const hint = document.getElementById('profile-hint');
    if (!form || !input) return;

    input.value = loadSettings().userName;

    let hideTimer: number | undefined;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({ userName: input.value.trim() });
        if (!hint) return;
        hint.textContent = tr('Сохранено');
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
            hint.textContent = '';
        }, 2000);
    });
}

function setupExportModal() {
    const openBtn = document.getElementById('open-export-dialog');
    const modal = document.getElementById('export-modal');
    const closeBtn = document.getElementById('close-export-modal');
    const confirmBtn = document.getElementById('confirm-export');
    if (!openBtn || !modal || !closeBtn || !confirmBtn) return;

    const open = () => modal.classList.add('is-open');
    const close = () => modal.classList.remove('is-open');

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    // Клик по фону (не по содержимому) и клавиша Esc
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    confirmBtn.addEventListener('click', () => {
        const value = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? '';
        close();
        exportFullData({
            period: value('export-period'),
            category: value('export-category'),
            format: value('export-format'),
        });
    });
}

// ===== Резервная копия и восстановление =====

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

function countsText(c: BackupCounts): string {
    return [
        tp('{n} задача|{n} задачи|{n} задач', c.tasks),
        tp('{n} привычка|{n} привычки|{n} привычек', c.habits),
        tp('{n} запись настроения|{n} записи настроения|{n} записей настроения', c.mood),
    ].join(', ');
}

function setBackupStatus(text: string, isError = false): void {
    const s = $('backup-status');
    if (!s) return;
    s.textContent = text;
    s.classList.toggle('hint--error', isError);
    s.setAttribute('role', isError ? 'alert' : 'status');
}

function summaryText(s: ImportSummary): string {
    if (s.mode === 'replace')
        return tr('Данные заменены копией: {counts}.', { counts: countsText({ tasks: s.tasks, habits: s.habits, mood: s.mood }) });
    const parts = [tr('добавлено: {counts}', { counts: countsText({ tasks: s.tasks, habits: s.habits, mood: s.mood }) })];
    if (s.habitMarks > 0) parts.push(tr('новых отметок у привычек: {n}', { n: s.habitMarks }));
    return tr('Данные объединены — {parts}.', { parts: parts.join(', ') });
}

function setupBackup(): void {
    const downloadBtn = $('backup-download');
    const fileInput = $<HTMLInputElement>('backup-file');
    const modal = $('import-modal');
    if (!downloadBtn || !fileInput || !modal) return;

    let pending: Backup | null = null;
    let replaceArmed = false;

    const closeModal = () => {
        modal.classList.remove('is-open');
        pending = null;
        replaceArmed = false;
    };

    const finish = (mode: 'merge' | 'replace') => {
        if (!pending) return;
        const summary = applyBackup(pending, mode);
        closeModal();
        setBackupStatus(tr('{summary} Страница сейчас обновится.', { summary: summaryText(summary) }));
        // Разделы держат данные в памяти — перезагрузка гарантирует, что везде видны новые
        window.setTimeout(() => window.location.reload(), 1200);
    };

    downloadBtn.addEventListener('click', () => {
        const backup = buildBackup();
        downloadText(serializeBackup(backup), backupFilename(), 'application/json');
        setBackupStatus(
            tr('Копия сохранена: {counts}.', {
                counts: countsText({ tasks: backup.tasks.length, habits: backup.habits.length, mood: backup.mood.length }),
            }),
        );
    });

    $('backup-choose')?.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = ''; // чтобы можно было выбрать тот же файл ещё раз
        if (!file) return;
        let text: string;
        try {
            text = await file.text();
        } catch {
            setBackupStatus(tr('Не удалось прочитать файл.'), true);
            return;
        }
        const result = parseBackup(text);
        if (!result.ok) {
            setBackupStatus(result.error, true);
            return;
        }
        pending = result.backup;
        replaceArmed = false;
        const when = result.backup.exportedAt ? new Date(result.backup.exportedAt) : null;
        const whenText =
            when && !isNaN(when.getTime())
                ? ` ${tr('от {date}', { date: formatDateShort(`${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`) })}`
                : '';
        $('import-summary')!.textContent = tr('В копии{when}: {counts}.', { when: whenText, counts: countsText(result.counts) });
        $('import-replace')!.textContent = tr('Заменить всё');
        setBackupStatus('');
        modal.classList.add('is-open');
    });

    $('import-merge')?.addEventListener('click', () => finish('merge'));
    // Замена стирает текущие данные — второе нажатие обязательно
    $('import-replace')?.addEventListener('click', () => {
        if (!replaceArmed) {
            replaceArmed = true;
            $('import-replace')!.textContent = tr('Точно заменить?');
            return;
        }
        finish('replace');
    });
    $('import-cancel')?.addEventListener('click', closeModal);
    $('import-download')?.addEventListener('click', () => {
        downloadText(serializeBackup(buildBackup()), backupFilename(), 'application/json');
    });
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
}

// ===== Системные уведомления (только в приложении) =====

/** Времена «ЧЧ:ММ» с шагом в полчаса от from до to (часы), включительно. */
function timeOptions(from: number, to: number): string[] {
    const out: string[] = [];
    for (let m = from * 60; m <= to * 60; m += 30)
        out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    return out;
}

function fillTimeSelect(select: HTMLSelectElement, options: string[], value: string): void {
    // сохранённое время может не попасть в сетку (импорт копии): добавляем его, чтобы не подменить молча
    const all = options.includes(value) ? options : [...options, value].sort();
    select.innerHTML = all.map((t) => `<option value="${t}">${t}</option>`).join('');
    select.value = value;
}

function setupNotifications(): void {
    const card = $('notif-card');
    if (!card || !isTauri()) return; // системные уведомления есть только в приложении
    card.classList.remove('hidden');

    const box = (id: string) => $<HTMLInputElement>(id)!;
    const select = (id: string) => $<HTMLSelectElement>(id)!;
    const status = $('notif-status')!;
    const testBtn = $<HTMLButtonElement>('notif-test')!;

    const settings = loadSettings().notifications;
    fillTimeSelect(select('notif-day-start'), timeOptions(5, 12), settings.dayStart);
    fillTimeSelect(select('notif-repeat-time'), timeOptions(10, 23), settings.repeatTime);
    fillTimeSelect(select('notif-evening-time'), timeOptions(17, 23), settings.eveningTime);

    const render = (n: NotificationSettings): void => {
        box('notif-enabled').checked = n.enabled;
        box('notif-task-start').checked = n.taskAtDayStart;
        box('notif-task-before').checked = n.taskBeforeDeadline;
        box('notif-repeat').checked = n.repeatEnabled;
        box('notif-morning').checked = n.morningDigest;
        box('notif-evening').checked = n.eveningEnabled;
        select('notif-day-start').value = n.dayStart;
        select('notif-repeat-time').value = n.repeatTime;
        select('notif-evening-time').value = n.eveningTime;
        // пока главный переключатель выключен, остальное недоступно
        card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach((el) => {
            if (el.id !== 'notif-enabled') el.disabled = !n.enabled;
        });
        select('notif-repeat-time').disabled = !n.enabled || !n.repeatEnabled;
        select('notif-evening-time').disabled = !n.enabled || !n.eveningEnabled;
    };

    const read = (): NotificationSettings => ({
        enabled: box('notif-enabled').checked,
        dayStart: select('notif-day-start').value,
        taskAtDayStart: box('notif-task-start').checked,
        taskBeforeDeadline: box('notif-task-before').checked,
        repeatEnabled: box('notif-repeat').checked,
        repeatTime: select('notif-repeat-time').value,
        morningDigest: box('notif-morning').checked,
        eveningEnabled: box('notif-evening').checked,
        eveningTime: select('notif-evening-time').value,
    });

    const setStatus = (text: string, isError = false): void => {
        status.textContent = text;
        status.classList.toggle('hint--error', isError);
        status.setAttribute('role', isError ? 'alert' : 'status');
    };

    /** Пробное уведомление: заодно macOS в первый раз спрашивает разрешение на показ. */
    const sendTest = async (): Promise<void> => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('send_test_notification');
            setStatus(tr('Пробное уведомление отправлено. Если его не видно — проверьте Системные настройки → Уведомления → «Мой день».'));
        } catch (error) {
            setStatus(
                tr('Не удалось показать уведомление: {message}', { message: error instanceof Error ? error.message : String(error) }),
                true,
            );
        }
    };

    card.addEventListener('change', (e) => {
        const wasEnabled = loadSettings().notifications.enabled;
        const next = read();
        saveSettings({ notifications: next });
        render(loadSettings().notifications);
        if (e.target === box('notif-enabled') && next.enabled && !wasEnabled) void sendTest();
    });
    testBtn.addEventListener('click', () => void sendTest());

    render(settings);
}

// ===== Язык интерфейса =====

/** Переключатель языка: язык запоминается, окно перезагружается и строится уже на новом языке. */
function setupLanguage(): void {
    const group = $('language-group');
    if (!group) return;
    group.querySelectorAll<HTMLInputElement>('input[name="language"]').forEach((radio) => {
        radio.checked = radio.value === getLanguage();
    });
    group.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (!isLanguage(value) || value === getLanguage()) return;
        saveSettings({ language: value });
        // сначала дожидаемся записи, иначе после перезагрузки прочитается прежний язык
        void flushStore().then(() => window.location.reload());
    });
}

export function setupSettings() {
    setupProfile();
    setupExportModal();
    setupBackup();
    setupNotifications();
    setupLanguage();
}
