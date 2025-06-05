import Chart from 'chart.js/auto';
import { generateHabitAdvice, generateMoodAdvice, generateTaskAdvice } from './tips';

// --- Достаем реальные данные из localStorage ---

function getTasks(): { text: string; done: boolean; date: string; }[] {
    try {
        return JSON.parse(localStorage.getItem('tasks') || '[]');
    } catch {
        return [];
    }
}

function getHabits(): { text: string; dates: string[] }[] {
    try {
        return JSON.parse(localStorage.getItem('habits') || '[]');
    } catch {
        return [];
    }
}

function getMood(): { date: string; rating: number; note?: string }[] {
    try {
        return JSON.parse(localStorage.getItem('moodData') || '[]');
    } catch {
        return [];
    }
}

// --- Функции для подсчета статистики ---

function getTasksStatsByDay() {
    // Вернет массив: [Пн, Вт, Ср, Чт, Пт, Сб, Вс]
    //const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const stats = Array(7).fill(0);
    const tasks = getTasks();
    tasks.forEach(t => {
        if (t.done && t.date) {
            // t.date — должен быть в формате YYYY-MM-DD
            const d = new Date(t.date);
            const idx = (d.getDay() + 6) % 7; // Пн=0, ... Вс=6
            stats[idx]++;
        }
    });
    return stats;
}

function getHabitStreaks() {
    // Вернет массив — сколько дней отмечено по каждой привычке за последнюю неделю
    const habits = getHabits();
    const weekDates = getLastNDates(7); // последние 7 дат (строки)
    return habits.map(h => h.dates.filter(date => weekDates.includes(date)).length);
}

function getMoodStats() {
    // Вернет массив по 5 категориям: [Отлично, Хорошо, Нормально, Плохо, Ужасно]
    const data = [0, 0, 0, 0, 0];
    getMood().forEach(m => {
        if (m.rating >= 1 && m.rating <= 5) data[5 - m.rating]++;
    });
    return data;
}

// Вспомогательные функции
function getLastNDates(n: number): string[] {
    const arr = [];
    let d = new Date();
    for (let i = 0; i < n; i++) {
        arr.unshift(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() - 1);
    }
    return arr;
}

// --- Главный рендер аналитики ---
export function renderAnalyticsPage() {
    const container = document.getElementById('analytics-section');
    if (!container) return;

    const analyticsMenu = container.querySelector('#analytics-menu') as HTMLElement;
    analyticsMenu?.classList.remove('hidden');
    const detailsDiv = container.querySelector('#analytics-details') as HTMLDivElement;
    if (detailsDiv) detailsDiv.innerHTML = '';

    analyticsMenu.querySelectorAll('[data-analytics]').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-analytics');
            analyticsMenu.classList.add('hidden');
            showAnalyticsDetails(section || 'tasks', container);
        });
    });
}

// --- Детальный просмотр раздела ---
function showAnalyticsDetails(section: string, container: HTMLElement) {
    const detailsDiv = container.querySelector('#analytics-details') as HTMLDivElement;

    let title = '';
    let chartData: number[] = [];
    let chartType = '';
    let labels: string[] = [];
    let avg = 0;
    let best = '';
    let worst = '';
    let summary = '';
    let chartBg: any = '';
    let adviceBlock = '';

    if (section === 'tasks') {
        title = 'Задачи';
        labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        chartData = getTasksStatsByDay();
        chartType = 'bar';
        chartBg = '#60A5FA';
        avg = chartData.length ? Math.round(chartData.reduce((a, b) => a + b, 0) / chartData.length * 10) / 10 : 0;
        let max = Math.max(...chartData), min = Math.min(...chartData);
        let bestIdx = chartData.indexOf(max), worstIdx = chartData.indexOf(min);
        best = labels[bestIdx] || '';
        worst = labels[worstIdx] || '';
        summary = `Ваше среднее выполнение задач за неделю — <b>${avg}</b>.<br>Лучший день — <b>${best}</b>, спокойный — <b>${worst}</b>.`;
        adviceBlock = `
      <div class="flex flex-col items-center mt-4">
        <div id="advice-blur" class="backdrop-blur-md bg-blue-100/60 text-gray-800 rounded-xl px-5 py-4 mt-2 text-base font-medium shadow transition hover:backdrop-blur-0 hover:bg-blue-100/90 cursor-pointer select-none max-w-lg text-center">
          Совет по задачам — наведите мышку!
          <span id="advice-text" class="block opacity-0 transition-opacity duration-300"></span>
        </div>
        <button id="refresh-advice" class="mt-3 opacity-60 hover:opacity-100 bg-blue-200 text-blue-800 rounded px-4 py-1 text-sm">Обновить совет</button>
      </div>
    `;
    }

    if (section === 'habits') {
        title = 'Привычки';
        labels = getHabits().map(h => h.text);
        chartData = getHabitStreaks();
        chartType = 'bar';
        chartBg = '#34D399';
        avg = chartData.length ? Math.round(chartData.reduce((a, b) => a + b, 0) / chartData.length * 10) / 10 : 0;
        let max = Math.max(...chartData), min = Math.min(...chartData);
        let bestIdx = chartData.indexOf(max), worstIdx = chartData.indexOf(min);
        best = labels[bestIdx] || '';
        worst = labels[worstIdx] || '';
        summary = `Среднее выполнение привычек за неделю — <b>${avg}</b>.<br>Лучшая привычка — <b>${best}</b>, сложная — <b>${worst}</b>.`;
        adviceBlock = `
      <div class="flex flex-col items-center mt-4">
        <div id="advice-blur" class="backdrop-blur-md bg-lime-100/60 text-gray-800 rounded-xl px-5 py-4 mt-2 text-base font-medium shadow transition hover:backdrop-blur-0 hover:bg-lime-100/90 cursor-pointer select-none max-w-lg text-center">
          Совет по привычкам — наведите мышку!
          <span id="advice-text" class="block opacity-0 transition-opacity duration-300"></span>
        </div>
        <button id="refresh-advice" class="mt-3 opacity-60 hover:opacity-100 bg-lime-200 text-lime-800 rounded px-4 py-1 text-sm">Обновить совет</button>
      </div>
    `;
    }

    if (section === 'mood') {
        title = 'Настроение';
        labels = ['Отлично', 'Хорошо', 'Нормально', 'Плохо', 'Ужасно'];
        chartData = getMoodStats();
        chartType = 'doughnut';
        chartBg = ['#F472B6', '#FB7185', '#FBCFE8', '#C026D3', '#A21CAF'];
        let sum = chartData.reduce((a, b) => a + b, 0);
        avg = sum
            ? Math.round((chartData[0] * 5 + chartData[1] * 4 + chartData[2] * 3 + chartData[3] * 2 + chartData[4]) / sum * 10) / 10
            : 0;
        let moods = ['отличное', 'хорошее', 'нормальное', 'плохое', 'ужасное'];
        let bestIdx = chartData.indexOf(Math.max(...chartData));
        let worstIdx = chartData.indexOf(Math.min(...chartData));
        best = moods[bestIdx] || '';
        worst = moods[worstIdx] || '';
        summary = `Средняя оценка настроения — <b>${avg}</b>.<br>Чаще всего вы выбирали <b>${best}</b>, реже всего — <b>${worst}</b>.`;
        adviceBlock = `
      <div class="flex flex-col items-center mt-4">
        <div id="advice-blur" class="backdrop-blur-md bg-pink-100/60 text-gray-800 rounded-xl px-5 py-4 mt-2 text-base font-medium shadow transition hover:backdrop-blur-0 hover:bg-pink-100/90 cursor-pointer select-none max-w-lg text-center">
          Совет для настроения — наведите мышку!
          <span id="advice-text" class="block opacity-0 transition-opacity duration-300"></span>
        </div>
        <button id="refresh-advice" class="mt-3 opacity-60 hover:opacity-100 bg-pink-200 text-pink-800 rounded px-4 py-1 text-sm">Обновить совет</button>
      </div>
    `;
    }

    detailsDiv.innerHTML = `
    <button id="back-to-analytics" class="mb-4 text-blue-700 hover:underline">&larr; Назад к аналитике</button>
    <h3 class="mb-6 text-2xl font-bold">${title}</h3>
    <div class="flex flex-col items-center">
      <canvas id="analytics-detail-chart" class="w-full max-w-xl h-72 mb-6 bg-white rounded-xl shadow"></canvas>
      <div class="w-full flex flex-wrap gap-4 justify-center mb-4">
        <span class="text-base text-gray-800"><b>Среднее:</b> <span id="avg-value"></span></span>
        <span class="text-base text-gray-800"><b>Лучший:</b> <span id="best-day"></span></span>
        <span class="text-base text-gray-800"><b>Менее активный:</b> <span id="worst-day"></span></span>
      </div>
      <div id="analytics-summary" class="w-full mt-2 p-4 bg-gray-100 rounded-lg text-gray-700 text-sm">${summary}</div>
      ${adviceBlock}
    </div>
  `;

    // Назад к меню
    detailsDiv.querySelector('#back-to-analytics')?.addEventListener('click', () => {
        const analyticsMenu = container.querySelector('#analytics-menu') as HTMLElement;
        analyticsMenu.classList.remove('hidden');
        detailsDiv.innerHTML = '';
    });

    // Chart
    const chartCtx = detailsDiv.querySelector('#analytics-detail-chart') as HTMLCanvasElement;
    if (chartCtx) {
        new Chart(chartCtx, {
            type: chartType as any,
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: chartData,
                    backgroundColor: chartBg,
                    borderColor: chartBg,
                    fill: section === 'habits',
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: section === 'mood' } },
                scales: section === 'mood' ? {} : { y: { beginAtZero: true } }
            }
        });
    }

    // Совет (blur + обновить)
    const adviceBlur = detailsDiv.querySelector('#advice-blur') as HTMLDivElement | null;
    const adviceText = detailsDiv.querySelector('#advice-text') as HTMLSpanElement | null;
    let advice: string = '';
    function updateAdvice() {
        if (section === 'tasks') advice = generateTaskAdvice(avg, chartData[0]);
        else if (section === 'habits') advice = generateHabitAdvice(chartData[0]);
        else advice = generateMoodAdvice(avg, best);
        if (adviceText) {
            adviceText.textContent = advice;
            adviceText.classList.remove('opacity-0');
        }
    }
    if (adviceBlur && adviceText) {
        adviceBlur.addEventListener('mouseenter', updateAdvice);
        adviceBlur.addEventListener('mouseleave', () => adviceText.classList.add('opacity-0'));
        detailsDiv.querySelector('#refresh-advice')?.addEventListener('click', updateAdvice);
    }

    // Статы
    if (detailsDiv.querySelector('#avg-value')) detailsDiv.querySelector('#avg-value')!.textContent = String(avg);
    if (detailsDiv.querySelector('#best-day')) detailsDiv.querySelector('#best-day')!.textContent = best;
    if (detailsDiv.querySelector('#worst-day')) detailsDiv.querySelector('#worst-day')!.textContent = worst;
}