import type { Chart as ChartJS } from 'chart.js';
import {
    getStreak,
    habitWeekCounts,
    moodCounts,
    pickBestWorst,
    taskStreak,
    tasksCompletedByWeekday,
} from './stats';
import { icon } from './icons';
import { loadHabits, loadMood, loadTasks } from './store';
import { generateHabitAdvice, generateMoodAdvice, generateTaskAdvice } from './tips';
import { createThemedChart, destroyThemedChart, getMoodColors } from './utils/chartTheme';
import { escapeHtml } from './utils/html';

type Section = 'tasks' | 'habits' | 'mood';

/** Всё, что нужно для отрисовки одного раздела аналитики. */
type SectionView = {
    title: string;
    chartType: 'bar' | 'doughnut';
    labels: string[];
    data: number[];
    avg: number;
    best: string;
    worst: string;
    summary: string;      // HTML; пользовательский текст внутри уже экранирован
    advice: () => string;
    adviceLabel: string;
    tone: 'yellow' | 'green' | 'pink';   // цвет блока совета (как у карточки на главной)
};

const NO_VALUE = '—';
const NO_DATA_SUMMARY = 'Пока недостаточно данных — добавьте записи, и здесь появится статистика.';

const round1 = (n: number): number => Math.round(n * 10) / 10;
const average = (data: number[]): number =>
    data.length ? round1(data.reduce((a, b) => a + b, 0) / data.length) : 0;

// --- Состояние экрана аналитики ---
let currentChart: ChartJS | null = null;
let currentSection: Section | null = null;
let menuBound = false;

function disposeChart() {
    if (currentChart) destroyThemedChart(currentChart);
    currentChart = null;
    currentSection = null;
}

/** Красит сегменты круговой диаграммы настроения; порядок легенды: Отлично … Ужасно. */
function applyMoodColors(chart: ChartJS) {
    const colors = getMoodColors().reverse();
    Object.assign(chart.data.datasets[0], { backgroundColor: colors, borderColor: colors });
}

// Один обработчик на всё время жизни страницы — а не по одному на каждое открытие раздела
window.addEventListener('themechange', () => {
    if (currentChart && currentSection === 'mood') {
        try {
            applyMoodColors(currentChart);
            currentChart.update('none');
        } catch {}
    }
});

// --- Построение данных по разделам ---

function buildTasksView(): SectionView {
    const tasks = loadTasks();
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const data = tasksCompletedByWeekday(tasks);
    const avg = average(data);
    const bw = pickBestWorst(data);
    const best = bw ? labels[bw.best] : NO_VALUE;
    const worst = bw ? labels[bw.worst] : NO_VALUE;
    const streak = taskStreak(tasks);

    let summary = NO_DATA_SUMMARY;
    if (data.some((v) => v > 0)) {
        summary = `Среднее число выполненных задач в день за последние 7 дней — <b>${avg}</b>.`;
        if (bw) summary += `<br>Лучший день — <b>${best}</b>, спокойный — <b>${worst}</b>.`;
    }

    return {
        title: 'Задачи',
        chartType: 'bar',
        labels,
        data,
        avg,
        best,
        worst,
        summary,
        advice: () => generateTaskAdvice(avg, streak),
        adviceLabel: 'Совет по задачам',
        tone: 'yellow',
    };
}

function buildHabitsView(): SectionView {
    const habits = loadHabits();
    const labels = habits.map((h) => h.text);
    const data = habitWeekCounts(habits);
    const avg = average(data);
    const bw = pickBestWorst(data);
    const best = bw ? labels[bw.best] : NO_VALUE;
    const worst = bw ? labels[bw.worst] : NO_VALUE;
    const longestStreak = Math.max(0, ...habits.map((h) => getStreak(h.dates)));

    let summary = NO_DATA_SUMMARY;
    if (data.some((v) => v > 0)) {
        summary = `Среднее число отмеченных дней на привычку за последние 7 дней — <b>${avg}</b>.`;
        if (bw) summary += `<br>Лучшая привычка — <b>${escapeHtml(best)}</b>, сложная — <b>${escapeHtml(worst)}</b>.`;
    }

    return {
        title: 'Привычки',
        chartType: 'bar',
        labels,
        data,
        avg,
        best,
        worst,
        summary,
        advice: () => generateHabitAdvice(longestStreak),
        adviceLabel: 'Совет по привычкам',
        tone: 'green',
    };
}

function buildMoodView(): SectionView {
    const labels = ['Отлично', 'Хорошо', 'Нормально', 'Плохо', 'Ужасно'];
    const words = ['отличное', 'хорошее', 'нормальное', 'плохое', 'ужасное'];
    const data = moodCounts(loadMood());
    const total = data.reduce((a, b) => a + b, 0);
    // data[0] — оценка 5, data[4] — оценка 1
    const avg = total ? round1(data.reduce((sum, count, i) => sum + count * (5 - i), 0) / total) : 0;
    const bw = pickBestWorst(data);
    const best = bw ? words[bw.best] : NO_VALUE;
    const worst = bw ? words[bw.worst] : NO_VALUE;

    let summary = NO_DATA_SUMMARY;
    if (total > 0) {
        summary = `Средняя оценка настроения — <b>${avg}</b>.`;
        if (bw) summary += `<br>Чаще всего вы выбирали <b>${best}</b>, реже всего — <b>${worst}</b>.`;
    }

    return {
        title: 'Настроение',
        chartType: 'doughnut',
        labels,
        data,
        avg,
        best,
        worst,
        summary,
        advice: () => generateMoodAdvice(avg, best),
        adviceLabel: 'Совет для настроения',
        tone: 'pink',
    };
}

function buildView(section: Section): SectionView {
    if (section === 'habits') return buildHabitsView();
    if (section === 'mood') return buildMoodView();
    return buildTasksView();
}

// --- Главный рендер аналитики ---
// Вызывается при каждом переходе на вкладку: сбрасывает экран к меню.
// Обработчики кнопок меню навешиваются один раз, иначе они копились бы с каждым заходом.
export function renderAnalyticsPage() {
    const container = document.getElementById('analytics-section');
    const analyticsMenu = container?.querySelector<HTMLElement>('#analytics-menu');
    const detailsDiv = container?.querySelector<HTMLDivElement>('#analytics-details');
    if (!container || !analyticsMenu || !detailsDiv) return;

    disposeChart();
    detailsDiv.innerHTML = '';
    analyticsMenu.classList.remove('hidden');

    if (menuBound) return;
    menuBound = true;
    analyticsMenu.querySelectorAll('[data-analytics]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const section = (btn.getAttribute('data-analytics') || 'tasks') as Section;
            analyticsMenu.classList.add('hidden');
            showAnalyticsDetails(section, container);
        });
    });
}

// --- Детальный просмотр раздела ---
function showAnalyticsDetails(section: Section, container: HTMLElement) {
    const detailsDiv = container.querySelector<HTMLDivElement>('#analytics-details');
    if (!detailsDiv) return;

    disposeChart();
    const view = buildView(section);

    detailsDiv.innerHTML = `
    <div class="analytics-detail">
      <div class="analytics-detail__head">
        <button id="back-to-analytics" type="button" class="btn btn--ghost btn--sm">${icon('arrow-left', 16)} Назад</button>
        <h2 class="page-title">${view.title}</h2>
      </div>
      <div class="card">
        <div class="chart-box ${section === 'mood' ? 'chart-box--tall' : ''}"><canvas id="analytics-detail-chart"></canvas></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat__label">Среднее</div><div class="stat__value" id="avg-value"></div></div>
        <div class="stat"><div class="stat__label">Лучший</div><div class="stat__value" id="best-day"></div></div>
        <div class="stat"><div class="stat__label">Менее активный</div><div class="stat__value" id="worst-day"></div></div>
      </div>
      <div id="analytics-summary" class="card card--alt summary">${view.summary}</div>
      <div id="advice-blur" class="advice advice--${view.tone}" tabindex="0" role="button" aria-label="${view.adviceLabel}">
        <span class="advice__label">${view.adviceLabel}</span>
        <span class="advice__hint">Наведите курсор или нажмите, чтобы увидеть совет</span>
        <span id="advice-text" class="advice__text"></span>
      </div>
      <div><button id="refresh-advice" type="button" class="btn btn--ghost btn--sm">Обновить совет</button></div>
    </div>
  `;

    // Назад к меню
    detailsDiv.querySelector('#back-to-analytics')?.addEventListener('click', () => {
        disposeChart();
        container.querySelector('#analytics-menu')?.classList.remove('hidden');
        detailsDiv.innerHTML = '';
    });

    // График
    const ctx = detailsDiv.querySelector<HTMLCanvasElement>('#analytics-detail-chart')?.getContext('2d');
    if (ctx) {
        currentChart = createThemedChart(ctx, {
            type: view.chartType,
            data: {
                labels: view.labels,
                datasets: [{ label: view.title, data: view.data }],
            },
            options: {
                responsive: true,
                plugins: { legend: { display: section === 'mood' } },
                scales: section === 'mood' ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } },
            },
        }) as ChartJS;
        currentSection = section;
        if (section === 'mood') {
            applyMoodColors(currentChart);
            currentChart.update('none');
        }
    }

    // Совет: открывается по наведению, фокусу и клику
    const adviceBox = detailsDiv.querySelector<HTMLDivElement>('#advice-blur');
    const adviceText = detailsDiv.querySelector<HTMLSpanElement>('#advice-text');
    const showAdvice = () => {
        if (!adviceBox || !adviceText) return;
        adviceText.textContent = view.advice();
        adviceBox.classList.add('is-open');
    };
    const hideAdvice = () => adviceBox?.classList.remove('is-open');
    if (adviceBox && adviceText) {
        adviceBox.addEventListener('mouseenter', showAdvice);
        adviceBox.addEventListener('focus', showAdvice);
        adviceBox.addEventListener('click', showAdvice);
        adviceBox.addEventListener('mouseleave', hideAdvice);
        adviceBox.addEventListener('blur', hideAdvice);
        detailsDiv.querySelector('#refresh-advice')?.addEventListener('click', showAdvice);
    }

    // Статы — через textContent, чтобы пользовательский текст не попадал в разметку
    detailsDiv.querySelector('#avg-value')!.textContent = String(view.avg);
    detailsDiv.querySelector('#best-day')!.textContent = view.best;
    detailsDiv.querySelector('#worst-day')!.textContent = view.worst;
}
