import { addDays, formatDateShort, todayStr } from './dates';
import { loadMood, saveMood, type MoodEntry } from './store';
import { renderColumns } from './viz';

/** --- Глобальный массив с данными настроения --- */
let moodData: MoodEntry[] = [];

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
    document.getElementById('mood-empty')?.classList.toggle('hidden', entries.length > 0);

    for (const entry of entries) {
        const li = document.createElement('li');
        li.className = 'mood-item';

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
        history.appendChild(li);
    }
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
        saveMood(moodData);
        renderMoodHistory();
        renderMoodChart();
        form.reset();
    });
}
