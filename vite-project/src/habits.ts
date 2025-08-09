import { createThemedChart, registerChart } from './utils/chartTheme';

// --- Тип данных для привычки ---
type Habit = {
    text: string;
    dates: string[]; // Массив дат, когда была отмечена привычка (ISO строки)
};

// --- Переменные ---
let habits: Habit[] = [];
let habitChart: any = null;

// --- Получить streak (дни подряд) ---
function getStreak(dates: string[]): number {
    if (dates.length === 0) return 0;
    let streak = 0;
    let day = new Date();
    for (; ;) {
        const dayStr = day.toISOString().slice(0, 10);
        if (dates.includes(dayStr)) {
            streak++;
            day.setDate(day.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

// --- Сохранение и загрузка привычек ---
function saveHabitsToStorage() {
    localStorage.setItem('habits', JSON.stringify(habits));
}
function loadHabitsFromStorage(): Habit[] {
    const data = localStorage.getItem('habits');
    if (!data) return [];
    try {
        const arr = JSON.parse(data);
        return arr.map((h: any) => ({
            text: h.text,
            dates: Array.isArray(h.dates) ? h.dates : [],
        }));
    } catch {
        return [];
    }
}

// --- Обновление графика привычек (Chart.js) ---
export function updateHabitChart() {
    const canvas = document.getElementById('habit-progress-chart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const streaks = habits.map(h => getStreak(h.dates));
    const labels = habits.map(h => h.text);

    if (habitChart) habitChart.destroy();
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
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
    registerChart(habitChart as any);
}

// --- Рендер привычек ---
function renderHabits() {
    const habitList = document.getElementById('habit-list');
    if (!habitList) return;
    habitList.innerHTML = '';

    habits.forEach((habit, idx) => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-4 p-2 mb-3 transition-all duration-300 translate-y-4 opacity-0 app-section rounded-xl';
        setTimeout(() => {
            li.classList.remove('opacity-0', 'translate-y-4');
        }, 10);

        // Чекбокс "выполнено"
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'w-5 h-5 accent-current';
        const today = new Date().toISOString().slice(0, 10);
        checkbox.checked = habit.dates.includes(today);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!habit.dates.includes(today)) habit.dates.push(today);
            } else {
                habit.dates = habit.dates.filter(d => d !== today);
            }
            saveHabitsToStorage();
            renderHabits();
            updateHabitChart();
        });

        // Текст привычки
        const spanText = document.createElement('span');
        spanText.className = 'flex-1 text-token';
        spanText.textContent = habit.text;

        // Streak
        const streakBadge = document.createElement('span');
        const streakValue = getStreak(habit.dates);
        const baseBadge = 'ml-2 px-2 py-0.5 rounded-xl text-xs font-semibold badge';
        let streakClass = baseBadge;            // базовый бейдж под тему
        if (streakValue > 10) {
          streakClass = `${baseBadge} theme-accent`; // яркий бейдж на высоком стрике
        }
        else if (streakValue > 5) {
          streakClass = `${baseBadge}`; // средний — оставим базовый
        }
        streakBadge.className = streakClass;
        streakBadge.textContent = `Серия: ${streakValue}`;

        // Статистика за месяц
        const month = new Date().toISOString().slice(0, 7); // ГГГГ-ММ
        const completedThisMonth = habit.dates.filter(date => date.startsWith(month)).length;
        const monthStats = document.createElement('span');
        monthStats.className = 'text-xs theme-muted';
        monthStats.textContent = `В этом месяце: ${completedThisMonth} дней`;

        // Прогресс-бар за месяц
        const progressBar = document.createElement('div');
        progressBar.className = 'w-24 h-2 overflow-hidden border rounded-full border-token';
        const innerBar = document.createElement('div');
        innerBar.className = 'h-2 transition-all rounded-full theme-accent';
        innerBar.style.width = `${Math.round(completedThisMonth / 30 * 100)}%`;
        progressBar.appendChild(innerBar);

        // Мини-календарь за 7 дней
        const calendar = document.createElement('div');
        calendar.className = 'flex gap-1 ml-2';
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStr = date.toISOString().slice(0, 10);
            const dot = document.createElement('span');
            dot.className = habit.dates.includes(dayStr)
              ? 'inline-block w-3 h-3 rounded-full theme-accent border-2'
              : 'inline-block w-3 h-3 rounded-full bg-token border border-token';
            calendar.appendChild(dot);
        }

        // Кнопка удаления
        const removeBtn = document.createElement('button');
        removeBtn.className = 'px-2 py-1 ml-2 text-xs btn btn-danger';
        removeBtn.textContent = 'Удалить';
        removeBtn.onclick = () => {
            habits.splice(idx, 1);
            saveHabitsToStorage();
            renderHabits();
            updateHabitChart();
        };

        // Собираем карточку привычки
        li.appendChild(checkbox);
        li.appendChild(spanText);
        li.appendChild(streakBadge);
        li.appendChild(monthStats);
        li.appendChild(progressBar);
        li.appendChild(calendar);
        li.appendChild(removeBtn);

        habitList.appendChild(li);
    });

    // Обновляем график после рендера списка!
    updateHabitChart();
}

// --- Инициализация привычек ---
export function setupHabits() {
    const form = document.getElementById('add-habit-form') as HTMLFormElement | null;
    const input = document.getElementById('habit-text') as HTMLInputElement | null;
    habits = loadHabitsFromStorage();
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
        habits.push({ text, dates: [] });
        saveHabitsToStorage();
        renderHabits();
        form.reset();
    });
}
// Делаем функцию доступной глобально для плавной перерисовки при смене темы (fallback)
;(window as any).updateHabitChart = updateHabitChart;