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
import { exportFullData } from './exporter';
import { loadSettings, saveSettings } from './store';
import { plural } from './utils/plural';
import { downloadText } from './utils/download';

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
        hint.textContent = 'Сохранено';
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
    return `${c.tasks} ${plural(c.tasks, ['задача', 'задачи', 'задач'])}, ${c.habits} ${plural(c.habits, ['привычка', 'привычки', 'привычек'])}, ${c.mood} ${plural(c.mood, ['запись настроения', 'записи настроения', 'записей настроения'])}`;
}

function setBackupStatus(text: string, isError = false): void {
    const s = $('backup-status');
    if (!s) return;
    s.textContent = text;
    s.classList.toggle('hint--error', isError);
    s.setAttribute('role', isError ? 'alert' : 'status');
}

function summaryText(s: ImportSummary): string {
    if (s.mode === 'replace') return `Данные заменены копией: ${countsText({ tasks: s.tasks, habits: s.habits, mood: s.mood })}.`;
    const parts = [`добавлено: ${countsText({ tasks: s.tasks, habits: s.habits, mood: s.mood })}`];
    if (s.habitMarks > 0) parts.push(`новых отметок у привычек: ${s.habitMarks}`);
    return `Данные объединены — ${parts.join(', ')}.`;
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
        setBackupStatus(`${summaryText(summary)} Страница сейчас обновится.`);
        // Разделы держат данные в памяти — перезагрузка гарантирует, что везде видны новые
        window.setTimeout(() => window.location.reload(), 1200);
    };

    downloadBtn.addEventListener('click', () => {
        const backup = buildBackup();
        downloadText(serializeBackup(backup), backupFilename(), 'application/json');
        setBackupStatus(
            `Копия сохранена: ${countsText({ tasks: backup.tasks.length, habits: backup.habits.length, mood: backup.mood.length })}.`,
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
            setBackupStatus('Не удалось прочитать файл.', true);
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
                ? ` от ${formatDateShort(`${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`)}`
                : '';
        $('import-summary')!.textContent = `В копии${whenText}: ${countsText(result.counts)}.`;
        $('import-replace')!.textContent = 'Заменить всё';
        setBackupStatus('');
        modal.classList.add('is-open');
    });

    $('import-merge')?.addEventListener('click', () => finish('merge'));
    // Замена стирает текущие данные — второе нажатие обязательно
    $('import-replace')?.addEventListener('click', () => {
        if (!replaceArmed) {
            replaceArmed = true;
            $('import-replace')!.textContent = 'Точно заменить?';
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

export function setupSettings() {
    setupProfile();
    setupExportModal();
    setupBackup();
}
