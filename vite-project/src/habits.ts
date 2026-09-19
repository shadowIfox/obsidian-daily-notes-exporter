import type { Chart as ChartJS } from 'chart.js';
import { daysInMonth, lastNDates, todayStr } from './dates';
import { icon } from './icons';
import { getStreak } from './stats';
import { loadHabits, newId, saveHabits, type Habit } from './store';
import { createThemedChart, destroyThemedChart } from './utils/chartTheme';

// --- Переменные ---
let habits: Habit[] = [];
let habitChart: ChartJS<'bar'> | null = null;

// --- Обновление графика привычек (Chart.js) ---
export function updateHabitChart() {
    const canvas = document.getElementById('habit-progress-chart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const streaks = habits.map(h => getStreak(h.dates));
    const labels = habits.map(h => h.text);

    if (habitChart) destroyThemedChart(habitChart);
    habitChart = createThemedChart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Серия дней подряд',
                data: streaks,
                // Цвета возьмутся из темы автоматически (accent/grid/text)
                borderRadius: 12,
                borderSkipped: false,
                borderWidth: 0,
                maxBarThickness: 72,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

// --- Рендер привычек ---
function renderHabits() {
    const habitList = document.getElementById('habit-list');
    if (!habitList) return;
    habitList.innerHTML = '';
    document.getElementById('habit-empty')?.classList.toggle('hidden', habits.length > 0);

    const today = todayStr();
    const month = today.slice(0, 7); // ГГГГ-ММ
    const monthDays = daysInMonth();

    habits.forEach((habit) => {
        const li = document.createElement('li');
        li.className = 'habit';

        // Чекбокс «выполнено сегодня»
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'check';
        checkbox.checked = habit.dates.includes(today);
        checkbox.setAttribute('aria-label', 'Отметить на сегодня');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!habit.dates.includes(today)) habit.dates.push(today);
            } else {
                habit.dates = habit.dates.filter(d => d !== today);
            }
            saveHabits(habits);
            renderHabits();
        });

        // Основная часть: название + статистика
        const main = document.createElement('div');

        const name = document.createElement('div');
        name.className = 'habit__name';
        name.textContent = habit.text;

        const meta = document.createElement('div');
        meta.className = 'habit__meta';

        // Прогресс за месяц
        const completedThisMonth = habit.dates.filter(date => date.startsWith(month)).length;
        const monthText = document.createElement('span');
        monthText.textContent = `В этом месяце: ${completedThisMonth} из ${monthDays}`;

        const progress = document.createElement('div');
        progress.className = 'progress progress--sm';
        const bar = document.createElement('div');
        bar.className = 'progress__bar';
        bar.style.width = `${Math.min(100, Math.round(completedThisMonth / monthDays * 100))}%`;
        progress.appendChild(bar);

        // Мини-календарь за 7 дней
        const dots = document.createElement('div');
        dots.className = 'dots';
        dots.setAttribute('aria-label', 'Последние 7 дней');
        for (const dayStr of lastNDates(7)) {
            const dot = document.createElement('span');
            dot.className = habit.dates.includes(dayStr) ? 'dot dot--on' : 'dot';
            dot.title = dayStr;
            dots.appendChild(dot);
        }

        meta.append(monthText, progress, dots);
        main.append(name, meta);

        // Правая часть: серия и удаление
        const side = document.createElement('div');
        side.className = 'habit__side';

        const streakValue = getStreak(habit.dates);
        const streak = document.createElement('span');
        streak.className = streakValue > 10 ? 'chip chip--accent' : 'chip';
        streak.title = 'Серия дней подряд';
        streak.innerHTML = `${icon('flame', 14)}<span>${streakValue}</span>`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'icon-btn icon-btn--sm icon-btn--danger';
        removeBtn.setAttribute('aria-label', 'Удалить привычку');
        removeBtn.title = 'Удалить';
        removeBtn.innerHTML = icon('trash-2', 16);
        removeBtn.onclick = () => {
            habits = habits.filter(h => h.id !== habit.id);
            saveHabits(habits);
            renderHabits();
        };

        side.append(streak, removeBtn);
        li.append(checkbox, main, side);
        habitList.appendChild(li);
    });

    // Обновляем график после рендера списка!
    updateHabitChart();
}

// --- Инициализация привычек ---
export function setupHabits() {
    const form = document.getElementById('add-habit-form') as HTMLFormElement | null;
    const input = document.getElementById('habit-text') as HTMLInputElement | null;
    habits = loadHabits();
    renderHabits();

    // Перекрашиваем график при смене темы (без кликов)
    window.addEventListener('themechange', () => {
        updateHabitChart();
    });

    if (!form || !input) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        habits.push({ id: newId(), text, dates: [] });
        saveHabits(habits);
        renderHabits();
        form.reset();
    });
}
