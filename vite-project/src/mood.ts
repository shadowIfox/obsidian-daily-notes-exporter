import { addDays, formatDateShort, lastNDates, todayStr } from './dates';
import { icon } from './icons';
import { loadMood, saveMood, type MoodEntry } from './store';
import { renderColumns } from './viz';

/** --- Состояние раздела --- */
let moodData: MoodEntry[] = [];
let pinnedDate: string | null = null; // запись из поиска, которую показываем, даже если она вне выбранного периода
let historyDays: 7 | 30 = 7; // период истории
let editingDate: string | null = null; // запись, открытая в форме на правку (подсвечивается в истории)
let prefilledFrom: string | null = null; // дата, из записи которой сейчас заполнена форма
let deleteArmed = false; // кнопка «Удалить запись» ждёт второго нажатия
let statusTimer: number | undefined;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

const sortAsc = (a: MoodEntry, b: MoodEntry) => a.date.localeCompare(b.date);

/** Записи за последние days календарных дней (включая сегодня), по возрастанию даты. */
function entriesSince(days: number): MoodEntry[] {
    const from = addDays(todayStr(), -(days - 1));
    return moodData.filter((e) => e.date >= from).sort(sortAsc);
}

/** Короткое сообщение под кнопками формы. */
function flashStatus(text: string): void {
    const s = el('mood-status');
    if (!s) return;
    s.textContent = text;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
        s.textContent = '';
    }, 2500);
}

// ===== Форма =====

/** Обновляет подсказку и кнопку «Удалить запись» под выбранную дату. */
function updateFormState(date: string): void {
    const exists = moodData.some((e) => e.date === date);
    const hint = el('mood-hint');
    if (hint) hint.textContent = exists ? `Запись за ${formatDateShort(date)} уже есть — сохранение заменит её.` : '';
    const del = el('mood-delete');
    if (del) {
        del.classList.toggle('hidden', !exists);
        del.textContent = 'Удалить запись';
    }
    deleteArmed = false;
}

/** Заполняет форму записью выбранной даты (оценка и заметка); если записи нет — очищает то, что было подставлено ранее. */
function fillForm(date: string): void {
    const form = el<HTMLFormElement>('mood-form');
    if (!form) return;
    el<HTMLInputElement>('mood-date')!.value = date;
    const entry = moodData.find((e) => e.date === date);
    if (entry) {
        form.querySelectorAll<HTMLInputElement>('input[name="rating"]').forEach((r) => {
            r.checked = r.value === String(entry.rating);
        });
        el<HTMLTextAreaElement>('mood-note')!.value = entry.note;
        prefilledFrom = date;
    } else if (prefilledFrom) {
        form.querySelectorAll<HTMLInputElement>('input[name="rating"]').forEach((r) => {
            r.checked = false;
        });
        el<HTMLTextAreaElement>('mood-note')!.value = '';
        prefilledFrom = null;
    }
    updateFormState(date);
}

function resetForm(): void {
    const today = todayStr();
    el<HTMLFormElement>('mood-form')?.reset();
    const dateInput = el<HTMLInputElement>('mood-date');
    if (dateInput) {
        dateInput.max = today;
        dateInput.value = today;
    }
    prefilledFrom = null;
    editingDate = null;
    updateFormState(today);
}

/** Открывает запись в форме на правку (клик по записи в истории). */
function editEntry(date: string): void {
    editingDate = date;
    fillForm(date);
    renderMoodHistory();
    const form = el('mood-form');
    form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el<HTMLTextAreaElement>('mood-note')?.focus();
}

// ===== История =====

/** --- Секция: Рендер истории ---
 * Записи за выбранный период (7 или 30 дней), свежие сверху. Текст заметки вставляется как текст, не как HTML.
 */
function renderMoodHistory(): void {
    const history = el('mood-history');
    if (!history) return;
    history.innerHTML = '';
    const entries = entriesSince(historyDays).reverse();
    const pinned = pinnedDate && !entries.some((e) => e.date === pinnedDate) ? moodData.find((e) => e.date === pinnedDate) : undefined;
    if (pinned) entries.unshift(pinned);

    const empty = el('mood-empty');
    if (empty) {
        empty.textContent = `За последние ${historyDays} дней записей нет.`;
        empty.classList.toggle('hidden', entries.length > 0);
    }
    document.querySelectorAll<HTMLElement>('#mood-range [data-days]').forEach((btn) => {
        const active = Number(btn.dataset.days) === historyDays;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    for (const entry of entries) {
        const li = document.createElement('li');
        li.className = entry.date === editingDate ? 'mood-item is-editing' : 'mood-item';
        li.dataset.date = entry.date;
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `Изменить запись за ${formatDateShort(entry.date)}`);

        const rating = document.createElement('span');
        rating.className = 'mood-item__score';
        rating.dataset.r = String(entry.rating);
        rating.textContent = String(entry.rating);

        const date = document.createElement('span');
        date.className = 'mood-item__date';
        date.textContent = formatDateShort(entry.date);
        date.title = entry.date;

        const note = document.createElement('span');
        note.className = 'mood-item__note';
        note.textContent = entry.note;

        li.append(rating, date, note);
        if (entry === pinned) {
            const tag = document.createElement('span');
            tag.className = 'chip';
            tag.textContent = 'из поиска';
            li.appendChild(tag);
        }
        const pencil = document.createElement('span');
        pencil.className = 'mood-item__edit';
        pencil.setAttribute('aria-hidden', 'true');
        pencil.innerHTML = icon('pencil', 14);
        li.appendChild(pencil);

        li.addEventListener('click', () => editEntry(entry.date));
        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editEntry(entry.date);
            }
        });
        history.appendChild(li);
    }
}

/** Показывает запись настроения в истории и подсвечивает её (переход из поиска). */
export function revealMoodEntry(date: string): void {
    pinnedDate = date;
    renderMoodHistory();
    const li = document.querySelector<HTMLElement>(`#mood-history [data-date="${CSS.escape(date)}"]`);
    if (!li) return;
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li.classList.remove('is-flash');
    void li.offsetWidth;
    li.classList.add('is-flash');
}

// ===== График =====

/** --- Секция: Рендер графика настроения ---
 * Период тот же, что в истории (7 или 30 дней), заканчивая сегодняшним: у каждого дня свой столбец,
 * у дней без записи он пустой. Так вчера стоит рядом с сегодня, а пропуски видны.
 * Цвет столбца — по оценке (палитра --mood-1…5).
 */
export function renderMoodChart(): void {
    const box = el('mood-week-chart');
    if (!box) return;
    const title = el('mood-chart-title');
    if (title) title.textContent = historyDays === 7 ? 'График за неделю' : `График за ${historyDays} дней`;
    const entries = entriesSince(historyDays);
    if (entries.length === 0) {
        box.innerHTML = `<p class="viz__empty">За последние ${historyDays} дней записей нет.</p>`;
        return;
    }
    const byDate = new Map(entries.map((e) => [e.date, e]));
    const dates = lastNDates(historyDays);
    box.innerHTML = renderColumns(
        dates.map((date) => {
            const e = byDate.get(date);
            const label = formatDateShort(date);
            if (!e) return { label, value: 0, tip: `${label}: записи нет` };
            return {
                label,
                value: e.rating,
                tip: `${label}: ${e.rating}${e.note ? ` — ${e.note.length > 60 ? e.note.slice(0, 60) + '…' : e.note}` : ''}`,
                color: `var(--mood-${e.rating})`,
            };
        }),
        // за 30 дней подписи через каждые 5 дней, считая от сегодняшнего, чтобы не слипались
        { height: 200, max: 5, showValues: true, labelAt: historyDays === 7 ? undefined : (i) => (dates.length - 1 - i) % 5 === 0 },
    );
}

function refresh(): void {
    renderMoodHistory();
    renderMoodChart();
}

// ===== Инициализация =====

/** --- Секция: Инициализация блока настроения ---
 * Загружает данные, рендерит историю и график, навешивает обработчики событий.
 */
export function setupMood(): void {
    moodData = loadMood();
    resetForm();
    refresh();

    el('mood-range')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-days]');
        if (!btn) return;
        historyDays = Number(btn.dataset.days) === 30 ? 30 : 7;
        renderMoodHistory();
        renderMoodChart();
    });

    // Смена даты в форме: подставляем сохранённую запись этого дня (если она есть)
    el<HTMLInputElement>('mood-date')?.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value || todayStr();
        editingDate = moodData.some((m) => m.date === value) ? value : null;
        fillForm(value);
        renderMoodHistory();
    });

    // Удаление записи выбранной даты — в два нажатия
    el('mood-delete')?.addEventListener('click', () => {
        const date = el<HTMLInputElement>('mood-date')!.value || todayStr();
        if (!deleteArmed) {
            deleteArmed = true;
            el('mood-delete')!.textContent = 'Точно удалить?';
            return;
        }
        moodData = moodData.filter((m) => m.date !== date);
        saveMood(moodData);
        pinnedDate = pinnedDate === date ? null : pinnedDate;
        resetForm();
        refresh();
        flashStatus(`Запись за ${formatDateShort(date)} удалена`);
    });

    /** После отправки формы добавляет запись (или заменяет запись выбранной даты), сохраняет и перерисовывает. */
    const form = el<HTMLFormElement>('mood-form');
    if (!form) return;

    form.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const ratingInput = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');
        const noteInput = form.querySelector<HTMLTextAreaElement>('#mood-note');
        if (!ratingInput) return;

        const today = todayStr();
        const date = el<HTMLInputElement>('mood-date')?.value || today;
        if (date > today) {
            const hint = el('mood-hint');
            if (hint) hint.textContent = 'Нельзя записать настроение за будущую дату.';
            return;
        }

        const rating = parseInt(ratingInput.value, 10);
        const note = noteInput?.value || '';
        moodData = moodData.filter((entry) => entry.date !== date);
        moodData.push({ date, rating, note });
        moodData.sort(sortAsc);
        pinnedDate = null;
        saveMood(moodData);
        resetForm();
        refresh();
        flashStatus(date === today ? 'Сохранено' : `Сохранено: ${formatDateShort(date)}`);
    });
}
