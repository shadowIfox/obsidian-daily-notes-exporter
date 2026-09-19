import { daysInMonth, lastNDates, todayStr } from './dates';
import { icon } from './icons';
import { getStreak } from './stats';
import { loadHabits, newId, saveHabits, type Habit } from './store';
import { renderHBars } from './viz';

// --- Переменные ---
let habits: Habit[] = [];

// --- График: текущие серии по привычкам ---
export function updateHabitChart() {
    const box = document.getElementById('habit-streaks');
    if (!box) return;
    if (habits.length === 0) {
        box.innerHTML = '<p class="viz__empty">Добавьте привычку — здесь появятся её серии.</p>';
        return;
    }
    box.innerHTML = renderHBars(
        habits.map((h) => {
            const streak = getStreak(h.dates);
            return { label: h.text, value: streak, valueText: `${streak} дн.`, tip: `${h.text}: серия ${streak} дн. подряд` };
        }),
    );
}

// --- API для главной: отметить/снять привычку на сегодня ---
export function toggleHabitToday(id: string): void {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const today = todayStr();
    habit.dates = habit.dates.includes(today) ? habit.dates.filter((d) => d !== today) : [...habit.dates, today];
    saveHabits(habits);
    renderHabits();
}

/** Подсвечивает привычку в списке (переход из поиска). */
export function revealHabit(id: string): void {
    const li = document.querySelector<HTMLElement>(`#habit-list [data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li.classList.remove('is-flash');
    void li.offsetWidth; // перезапуск анимации
    li.classList.add('is-flash');
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
        li.dataset.id = habit.id;

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
