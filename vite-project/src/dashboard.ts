// dashboard.ts — главная страница: приветствие и сводные карточки.
// Разметка лежит в index.html (#dashboard-section), здесь только подстановка данных.

import { todayStr } from './dates';
import { deadlineOverview, habitOverview, moodOverview, taskOverview } from './stats';
import { loadHabits, loadMood, loadSettings, loadTasks } from './store';

/** Склонение по числу: plural(5, ['задача', 'задачи', 'задач']) → «задач». */
function plural(n: number, forms: [string, string, string]): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
}

function greetingFor(hour: number): string {
    if (hour < 5) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
}

function setText(selector: string, value: string | number): void {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) el.textContent = String(value);
}

export function renderDashboard(): void {
    const today = todayStr();
    const tasks = loadTasks();
    const habits = loadHabits();
    const { userName } = loadSettings();

    const taskStats = taskOverview(tasks, today);
    const deadlines = deadlineOverview(tasks, today);
    const habitStats = habitOverview(habits, today);
    const mood = moodOverview(loadMood(), today);

    // Приветствие
    const name = userName.trim();
    setText('#greeting', name ? `${greetingFor(new Date().getHours())}, ${name}` : greetingFor(new Date().getHours()));

    // Строка под приветствием: что ждёт на сегодня
    const dueNow = deadlines.overdue + deadlines.today;
    let sub = 'Добавьте первую задачу или привычку — и здесь появится сводка дня.';
    if (tasks.length > 0 || habits.length > 0) {
        const parts: string[] = [];
        if (dueNow > 0) parts.push(`${dueNow} ${plural(dueNow, ['задача', 'задачи', 'задач'])} на сегодня и просроченных`);
        if (habitStats.left > 0) parts.push(`${habitStats.left} ${plural(habitStats.left, ['привычка ждёт', 'привычки ждут', 'привычек ждут'])} отметки`);
        sub = parts.length > 0 ? `${parts.join(', ')}.` : 'На сегодня всё сделано — можно отдыхать.';
    }
    setText('#greeting-sub', sub);

    // Дата в верхней панели
    setText('#today-label', new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));

    // Карточки
    setText('[data-stat="tasks.done"]', taskStats.done);
    setText('[data-stat="tasks.active"]', taskStats.active);
    setText('[data-stat="tasks.overdue"]', taskStats.overdue);

    setText('[data-stat="mood.avg"]', mood ? mood.avg : '—');
    setText('[data-stat="mood.min"]', mood ? mood.min : '—');
    setText('[data-stat="mood.max"]', mood ? mood.max : '—');

    setText('[data-stat="habits.done"]', habitStats.doneToday);
    setText('[data-stat="habits.left"]', habitStats.left);
    setText('[data-stat="habits.streak"]', habitStats.bestStreak);

    setText('[data-stat="deadlines.overdue"]', deadlines.overdue);
    setText('[data-stat="deadlines.today"]', deadlines.today);
    setText('[data-stat="deadlines.week"]', deadlines.week);
}
