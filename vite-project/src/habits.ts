import Chart from 'chart.js/auto';
// --- Тип данных для привычки ---
type Habit = {
    text: string;
    dates: string[];
};

let habits: Habit[] = [];
let habitChart: Chart | null = null;

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
function updateHabitChart() {
    const ctx = document.getElementById('habit-progress-chart') as HTMLCanvasElement | null;
    if (!ctx) return;

    const streaks = habits.map(h => getStreak(h.dates));
    const labels = habits.map(h => h.text);

    if (habitChart) habitChart.destroy();
    habitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Серия дней подряд',
                data: streaks,
                backgroundColor: 'rgba(132, 204, 22, 0.7)', // lime-500 с прозрачностью
                borderRadius: 12,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}
// --- Рендер привычек ---
function renderHabits() {
    const habitList = document.getElementById('habit-list');
    if (!habitList) return;
    habitList.innerHTML = '';

    habits.forEach((habit, idx) => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-4 p-2 bg-gray-100 shadow rounded-xl';

        // Чекбокс "выполнено"
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'w-5 h-5 accent-lime-500';
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
        spanText.className = 'flex-1 text-gray-800';
        spanText.textContent = habit.text;

        // Streak
        const streakBadge = document.createElement('span');
        streakBadge.className = 'ml-2 px-2 py-0.5 rounded-xl text-xs font-semibold bg-lime-200 text-lime-800';
        streakBadge.textContent = `Серия: ${getStreak(habit.dates)}`;

        // Статистика за месяц
        const month = new Date().toISOString().slice(0, 7); // ГГГГ-ММ
        const completedThisMonth = habit.dates.filter(date => date.startsWith(month)).length;
        const monthStats = document.createElement('span');
        monthStats.className = 'text-xs text-gray-500';
        monthStats.textContent = `В этом месяце: ${completedThisMonth} дней`;

        // Прогресс-бар за месяц
        const progressBar = document.createElement('div');
        progressBar.className = 'w-24 h-2 overflow-hidden bg-gray-200 rounded-full';
        const innerBar = document.createElement('div');
        innerBar.className = 'h-2 transition-all rounded-full bg-lime-400';
        innerBar.style.width = `${Math.round(completedThisMonth / 30 * 100)}%`;
        progressBar.appendChild(innerBar);

        // Мини-календарь
        const calendar = document.createElement('div');
        calendar.className = 'flex gap-1 ml-2';
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStr = date.toISOString().slice(0, 10);
            const dot = document.createElement('span');
            dot.className = habit.dates.includes(dayStr)
                ? 'inline-block w-3 h-3 rounded-full bg-lime-500 border-2 border-lime-300'
                : 'inline-block w-3 h-3 rounded-full bg-gray-300 border';
            calendar.appendChild(dot);
        }

        // Кнопка удаления
        const removeBtn = document.createElement('button');
        removeBtn.className = 'px-2 py-1 ml-2 text-xs text-white transition bg-red-400 rounded hover:bg-red-600';
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