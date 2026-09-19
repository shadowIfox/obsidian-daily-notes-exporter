import type { Chart as ChartJS } from 'chart.js';
import { addDays, formatDateShort, todayStr } from './dates';
import { loadMood, saveMood, type MoodEntry } from './store';
import { createThemedChart, destroyThemedChart, getMoodColors, rethemeChart } from './utils/chartTheme';

/** --- Глобальный массив с данными настроения --- */
let moodData: MoodEntry[] = [];
let moodChart: ChartJS<'bar'> | null = null;

/** Записи за последние 7 календарных дней (включая сегодня), по возрастанию даты. */
function lastWeekEntries(): MoodEntry[] {
    const from = addDays(todayStr(), -6);
    return moodData
        .filter((e) => e.date >= from)
        .sort((a, b) => a.date.localeCompare(b.date));
}

/** Цвет каждого столбца — по оценке записи, а не по позиции столбца. */
function barColors(entries: MoodEntry[]): string[] {
    const palette = getMoodColors();
    return entries.map((e) => palette[e.rating - 1]);
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
 * Столбчатая диаграмма по записям за последние 7 дней.
 * Старый график уничтожается перед созданием нового (важно для смены темы и обновления данных).
 */
export function renderMoodChart(): void {
    const canvas = document.getElementById('mood-chart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const entries = lastWeekEntries();

    if (moodChart) destroyThemedChart(moodChart);
    moodChart = createThemedChart(ctx, {
        type: 'bar',
        data: {
            labels: entries.map((e) => formatDateShort(e.date)),
            datasets: [{
                label: 'Настроение',
                data: entries.map((e) => e.rating),
                backgroundColor: barColors(entries),
                borderWidth: 0,
                borderRadius: 10,
                maxBarThickness: 64,
            }]
        },
        options: {
            animation: false,
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } }
        }
    });
}

/** --- Секция: Инициализация блока настроения ---
 * Загружает данные, рендерит историю и график, навешивает обработчики событий.
 */
export function setupMood(): void {
    moodData = loadMood();
    renderMoodHistory();
    renderMoodChart();

    /** Перекрашиваем существующий график при смене темы мгновенно, без анимации. */
    window.addEventListener('themechange', () => {
        if (!moodChart) return;
        try {
            rethemeChart(moodChart);
            moodChart.data.datasets[0].backgroundColor = barColors(lastWeekEntries());
            moodChart.update('none');
        } catch {}
    });

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
