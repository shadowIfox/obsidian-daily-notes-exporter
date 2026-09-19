import { addDays, formatDateShort, todayStr } from './dates';
import { loadMood, saveMood, type MoodEntry } from './store';
import { renderColumns } from './viz';

/** --- Глобальный массив с данными настроения --- */
let moodData: MoodEntry[] = [];
let pinnedDate: string | null = null; // запись из поиска, которую показываем, даже если она старше недели

/** Записи за последние 7 календарных дней (включая сегодня), по возрастанию даты. */
function lastWeekEntries(): MoodEntry[] {
    const from = addDays(todayStr(), -6);
    return moodData
        .filter((e) => e.date >= from)
        .sort((a, b) => a.date.localeCompare(b.date));
}

/** --- Секция: Рендер истории за последние 7 дней ---
 * Отрисовывает записи в элементе #mood-history. Текст заметки вставляется как текст, не как HTML.
 */
function renderMoodHistory(): void {
    const history: HTMLElement | null = document.getElementById('mood-history');
    if (!history) return;
    history.innerHTML = '';
    const entries = lastWeekEntries().reverse();
    const pinned = pinnedDate && !entries.some((e) => e.date === pinnedDate) ? moodData.find((e) => e.date === pinnedDate) : undefined;
    if (pinned) entries.unshift(pinned);
    document.getElementById('mood-empty')?.classList.toggle('hidden', entries.length > 0);

    for (const entry of entries) {
        const li = document.createElement('li');
        li.className = 'mood-item';
        li.dataset.date = entry.date;

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

/** --- Секция: Рендер графика настроения ---
 * Столбцы по записям за последние 7 дней; цвет столбца — по оценке (палитра из CSS-переменных --mood-1…5).
 */
export function renderMoodChart(): void {
    const box = document.getElementById('mood-week-chart');
    if (!box) return;
    const entries = lastWeekEntries();
    if (entries.length === 0) {
        box.innerHTML = '<p class="viz__empty">За последние 7 дней записей нет.</p>';
        return;
    }
    box.innerHTML = renderColumns(
        entries.map((e) => ({
            label: formatDateShort(e.date),
            value: e.rating,
            tip: `${formatDateShort(e.date)}: ${e.rating}${e.note ? ` — ${e.note.length > 60 ? e.note.slice(0, 60) + '…' : e.note}` : ''}`,
            color: `var(--mood-${e.rating})`,
        })),
        { height: 200, max: 5, showValues: true },
    );
}

/** --- Секция: Инициализация блока настроения ---
 * Загружает данные, рендерит историю и график, навешивает обработчики событий.
 */
export function setupMood(): void {
    moodData = loadMood();
    renderMoodHistory();
    renderMoodChart();

    /** После отправки формы добавляет запись (или заменяет запись за сегодня), сохраняет и перерисовывает. */
    const form = document.getElementById('mood-form') as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const ratingInput = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');
        const noteInput = form.querySelector<HTMLTextAreaElement>('#mood-note');
        if (!ratingInput) return;
        const rating = parseInt(ratingInput.value, 10);
        const note = noteInput?.value || '';
        const date = todayStr();
        moodData = moodData.filter((entry) => entry.date !== date);
        moodData.push({ date, rating, note });
        pinnedDate = null;
        saveMood(moodData);
        renderMoodHistory();
        renderMoodChart();
        form.reset();
    });
}
