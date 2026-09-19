import { daysInMonth, formatDateShort, lastNDates, todayStr, weekdayIndex } from './dates';
import { WEEKDAY_LABELS, createWeekdayPicker, describeDays, openHabitEditor, openHabitHistory, setupHabitDialogs } from './habitDialogs';
import { icon } from './icons';
import { getStreak, isDue } from './stats';
import { loadHabits, newId, saveHabits, type Habit } from './store';
import { renderHBars } from './viz';

// --- Переменные ---
let habits: Habit[] = []; // все привычки, включая архивные (сохраняются вместе)

const activeHabits = (): Habit[] => habits.filter((h) => !h.archived);

// --- График: текущие серии по привычкам ---
export function updateHabitChart() {
    const box = document.getElementById('habit-streaks');
    if (!box) return;
    const active = activeHabits();
    if (active.length === 0) {
        box.innerHTML = '<p class="viz__empty">Добавьте привычку — здесь появятся её серии.</p>';
        return;
    }
    box.innerHTML = renderHBars(
        active.map((h) => {
            const streak = getStreak(h.dates, undefined, h.days);
            return { label: h.text, value: streak, valueText: `${streak} дн.`, tip: `${h.text}: серия ${streak} дн. подряд` };
        }),
    );
}

/** Ставит или снимает отметку в указанный день. */
function toggleDate(habit: Habit, date: string): void {
    habit.dates = habit.dates.includes(date) ? habit.dates.filter((d) => d !== date) : [...habit.dates, date];
    saveHabits(habits);
    renderHabits();
}

// --- API для главной: отметить/снять привычку на сегодня ---
export function toggleHabitToday(id: string): void {
    const habit = habits.find((h) => h.id === id);
    if (habit) toggleDate(habit, todayStr());
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

function iconButton(name: string, label: string, onClick: () => void, extraClass = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `icon-btn icon-btn--sm ${extraClass}`.trim();
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = icon(name, 16);
    b.onclick = onClick;
    return b;
}

// --- Рендер привычек ---
function renderHabits() {
    const habitList = document.getElementById('habit-list');
    if (!habitList) return;
    habitList.innerHTML = '';
    const active = activeHabits();
    document.getElementById('habit-empty')?.classList.toggle('hidden', active.length > 0);

    const today = todayStr();
    const month = today.slice(0, 7); // ГГГГ-ММ

    active.forEach((habit) => {
        const dueToday = isDue(habit, today);
        const li = document.createElement('li');
        li.className = dueToday ? 'habit' : 'habit habit--rest';
        li.dataset.id = habit.id;

        // Чекбокс «выполнено сегодня»
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'check';
        checkbox.checked = habit.dates.includes(today);
        checkbox.setAttribute('aria-label', 'Отметить на сегодня');
        checkbox.addEventListener('change', () => toggleDate(habit, today));

        // Основная часть: название + статистика
        const main = document.createElement('div');

        const name = document.createElement('div');
        name.className = 'habit__name';
        name.textContent = habit.text;
        const schedule = describeDays(habit.days);
        if (schedule) {
            const chip = document.createElement('span');
            chip.className = 'chip chip--mini';
            chip.textContent = schedule;
            chip.title = 'Дни по графику';
            name.append(' ', chip);
        }

        const meta = document.createElement('div');
        meta.className = 'habit__meta';

        // Прогресс за месяц: отмеченные дни по графику / все дни по графику в месяце
        let dueMonth = 0;
        let doneMonth = 0;
        for (let day = 1; day <= daysInMonth(); day++) {
            const date = `${month}-${String(day).padStart(2, '0')}`;
            if (!isDue(habit, date)) continue;
            dueMonth++;
            if (habit.dates.includes(date)) doneMonth++;
        }
        const monthText = document.createElement('span');
        monthText.textContent = `В этом месяце: ${doneMonth} из ${dueMonth}`;

        const progress = document.createElement('div');
        progress.className = 'progress progress--sm';
        const bar = document.createElement('div');
        bar.className = 'progress__bar';
        bar.style.width = `${dueMonth === 0 ? 0 : Math.min(100, Math.round((doneMonth / dueMonth) * 100))}%`;
        progress.appendChild(bar);

        // Мини-календарь за 7 дней: по точке можно отметить или снять любой из этих дней
        const dots = document.createElement('div');
        dots.className = 'dots';
        dots.setAttribute('role', 'group');
        dots.setAttribute('aria-label', 'Последние 7 дней');
        for (const dayStr of lastNDates(7)) {
            const on = habit.dates.includes(dayStr);
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = on ? 'dot dot--on' : isDue(habit, dayStr) ? 'dot' : 'dot dot--off';
            dot.setAttribute('aria-pressed', String(on));
            dot.dataset.date = dayStr;
            dot.setAttribute('data-tip', `${formatDateShort(dayStr)} (${WEEKDAY_LABELS[weekdayIndex(dayStr)]}): ${on ? 'отмечено — нажмите, чтобы снять' : 'нажмите, чтобы отметить'}`);
            dot.setAttribute('aria-label', `${formatDateShort(dayStr)}: ${on ? 'отмечено' : 'не отмечено'}`);
            dot.addEventListener('click', () => toggleDate(habit, dayStr));
            dots.appendChild(dot);
        }

        meta.append(monthText, progress, dots);
        if (!dueToday) {
            const rest = document.createElement('span');
            rest.textContent = 'сегодня не по графику';
            meta.appendChild(rest);
        }
        main.append(name, meta);

        // Правая часть: серия и кнопки
        const side = document.createElement('div');
        side.className = 'habit__side';

        const streakValue = getStreak(habit.dates, today, habit.days);
        const streak = document.createElement('span');
        streak.className = streakValue > 10 ? 'chip chip--accent' : 'chip';
        streak.title = 'Серия дней подряд';
        streak.innerHTML = `${icon('flame', 14)}<span>${streakValue}</span>`;

        side.append(
            streak,
            iconButton('calendar', 'Календарь отметок', () => openHabitHistory(api, habit.id)),
            iconButton('pencil', 'Изменить привычку', () => openHabitEditor(api, habit.id)),
        );
        li.append(checkbox, main, side);
        habitList.appendChild(li);
    });

    renderArchive();

    // Обновляем график после рендера списка!
    updateHabitChart();
}

// --- Архив: привычки, скрытые из списка (история сохраняется) ---
function renderArchive() {
    const card = document.getElementById('habit-archive-card');
    const list = document.getElementById('habit-archive-list');
    if (!card || !list) return;
    const archived = habits.filter((h) => h.archived);
    card.classList.toggle('hidden', archived.length === 0);
    list.replaceChildren();

    for (const habit of archived) {
        const li = document.createElement('li');
        li.className = 'archive-row';
        li.dataset.id = habit.id;

        const name = document.createElement('span');
        name.className = 'archive-row__name';
        name.textContent = habit.text;
        const info = document.createElement('span');
        info.className = 'archive-row__info';
        info.textContent = `отметок: ${habit.dates.length}`;

        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'btn btn--ghost btn--sm';
        restore.textContent = 'Вернуть';
        restore.addEventListener('click', () => {
            habit.archived = undefined;
            saveHabits(habits);
            renderHabits();
        });

        let armed = false;
        const del = iconButton('trash-2', 'Удалить навсегда', () => {
            if (!armed) {
                armed = true;
                del.classList.add('is-armed');
                del.title = 'Нажмите ещё раз, чтобы удалить навсегда';
                return;
            }
            api.remove(habit.id);
        }, 'icon-btn--danger');

        li.append(name, info, restore, del);
        list.appendChild(li);
    }
}

const api = {
    get: (id: string) => habits.find((h) => h.id === id),
    commit: () => {
        saveHabits(habits);
        renderHabits();
    },
    remove: (id: string) => {
        habits = habits.filter((h) => h.id !== id);
        saveHabits(habits);
        renderHabits();
    },
};

// --- Инициализация привычек ---
export function setupHabits() {
    const form = document.getElementById('add-habit-form') as HTMLFormElement | null;
    const input = document.getElementById('habit-text') as HTMLInputElement | null;
    const daysBox = document.getElementById('habit-days');
    habits = loadHabits();
    setupHabitDialogs(api);
    renderHabits();

    if (!form || !input) return;
    const picker = daysBox ? createWeekdayPicker(daysBox) : null;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        habits.push({ id: newId(), text, dates: [], days: picker?.get() });
        saveHabits(habits);
        renderHabits();
        form.reset();
        picker?.set(undefined);
    });
}
