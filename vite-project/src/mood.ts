
import { createThemedChart, rethemeChart } from './utils/chartTheme';

// Палитра цветов для оценок 1..5 из CSS-переменных с мягкими fallbacks
function getMoodPalette(): (string | CanvasGradient)[] {
    const s = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => (s.getPropertyValue(name).trim() || fb);
    return [
        v('--mood-1', '#fca5a5'), // 1 — плохо
        v('--mood-2', '#fdba74'), // 2 — так себе
        v('--mood-3', '#fde68a'), // 3 — норм
        v('--mood-4', '#86efac'), // 4 — хорошо
        v('--mood-5', '#a78bfa'), // 5 — отлично (мягкий фиолет)
    ];
}


/** --- Тип данных для записи настроения --- */
type MoodEntry = {
    date: string;   // YYYY-MM-DD
    rating: number; // 1–5
    note: string;   // комментарий
};

/** --- Глобальный массив с данными настроения --- */
let moodData: MoodEntry[] = [];

/** --- Секция: Сохранение данных в localStorage ---
 * Сохраняет текущий массив moodData в localStorage пользователя.
 */
function saveMoodData(): void {
    localStorage.setItem('moodData', JSON.stringify(moodData));
}

/** --- Секция: Загрузка данных из localStorage ---
 * Возвращает массив записей настроения из localStorage.
 * Если данных нет или они повреждены, возвращает пустой массив.
 */
function loadMoodData(): MoodEntry[] {
    const data: string | null = localStorage.getItem('moodData');
    if (!data) return [];
    try {
        return JSON.parse(data) as MoodEntry[];
    } catch {
        return [];
    }
}

/** --- Секция: Рендер истории за последние 7 дней ---
 * Отрисовывает список последних 7 записей настроения в элементе #mood-history.
 */
function renderMoodHistory(): void {
    const history: HTMLElement | null = document.getElementById('mood-history');
    if (!history) return;
    history.innerHTML = '';
    const last7: MoodEntry[] = moodData.slice(-7).reverse();
    for (const entry of last7) {
        const li: HTMLLIElement = document.createElement('li');
        li.className = 'flex items-center gap-2';
        li.innerHTML = `
            <span class="w-8 text-center font-bold">${entry.rating}</span>
            <span class="text-xs text-gray-500">${entry.date}</span>
            <span class="flex-1">${entry.note}</span>
        `;
        history.appendChild(li);
    }
}

/** --- Секция: Рендер графика настроения ---
 * Строит столбчатую диаграмму по последним 7 записям.
 * Старый график всегда уничтожается перед созданием нового (важно для смены темы и обновления данных).
 * Функция экспортируется и также доступна через window для fallback.
 */
export function renderMoodChart(): void {
    const canvas: HTMLCanvasElement | null = document.getElementById('mood-chart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    const data7: MoodEntry[] = moodData.slice(-7);
    const labels: string[] = data7.map(e => e.date);
    const ratings: number[] = data7.map(e => e.rating);
    // Очистить старый график, если есть
    if ((window as any).moodChart) {
        (window as any).moodChart.destroy();
    }
    (window as any).moodChart = createThemedChart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Настроение',
                data: ratings,
                backgroundColor: getMoodPalette()
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
    moodData = loadMoodData();
    renderMoodHistory();
    renderMoodChart();

    /** --- Секция: Переключение темы ---
     * Перекрашиваем существующий график при событии themechange (без анимации).
     */
    window.addEventListener('themechange', () => {
        const ch: any = (window as any).moodChart;
        if (ch) {
            try {
                // Перекраска осей/легенды
                rethemeChart(ch);
                // Мгновенно подменяем палитру столбиков под новую тему
                if (ch.data && ch.data.datasets && ch.data.datasets[0]) {
                    ch.data.datasets[0].backgroundColor = getMoodPalette();
                }
                ch.update('none');
            } catch {}
        }
    });

    /** --- Секция: Обработка формы добавления настроения ---
     * После отправки формы добавляет новую запись (или заменяет за сегодня), сохраняет и перерисовывает.
     */
    const form: HTMLFormElement | null = document.getElementById('mood-form') as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const ratingInput: HTMLInputElement | null = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');
        const noteInput: HTMLTextAreaElement | null = form.querySelector<HTMLTextAreaElement>('#mood-note');
        if (!ratingInput) return;
        const rating: number = parseInt(ratingInput.value, 10);
        const note: string = noteInput?.value || '';
        const date: string = new Date().toISOString().slice(0, 10);
        // Удалить старую запись за сегодня и добавить новую
        moodData = moodData.filter((entry: MoodEntry) => entry.date !== date);
        moodData.push({ date, rating, note });
        saveMoodData();
        renderMoodHistory();
        renderMoodChart();
        form.reset();
    });
}

/** --- Fallback: Доступ к функции рендера графика из window ---
 * Позволяет вручную вызывать renderMoodChart из консоли или других скриптов.
 */
;(window as any).renderMoodChart = renderMoodChart;