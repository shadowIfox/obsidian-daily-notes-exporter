// analytics.ts — страница «Аналитика»: одна страница с выбором периода.
// Разметка лежит в index.html (#analytics-section), здесь — данные и отрисовка графиков (viz.ts).

import { addDays, formatDateShort, todayStr, weekdayIndex } from './dates';
import {
    aggregateWeeks,
    categoryBreakdown,
    getStreak,
    habitPeriodStats,
    moodPeriodStats,
    moodVsHabits,
    onTimeStats,
    pickBestWorst,
    taskPeriodStats,
    taskStreak,
    weekdayTotals,
    type Period,
} from './stats';
import { loadActiveHabits, loadMood, loadTasks } from './store';
import { generateHabitAdvice, generateMoodAdvice, generateTaskAdvice } from './tips';
import {
    mountResponsive,
    renderColumns,
    renderDonut,
    renderHBars,
    renderHeatmap,
    renderMoodArea,
    unmountResponsive,
    type ColumnItem,
} from './viz';

const PERIOD_LABELS: Record<Period, string> = { 7: '7 дней', 30: '30 дней', 91: '3 месяца' };
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAYS_DATIVE = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
const MOOD_LABELS = ['Отлично', 'Хорошо', 'Нормально', 'Плохо', 'Ужасно'];
const MOOD_WORDS = ['отличное', 'хорошее', 'нормальное', 'плохое', 'ужасное'];

let period: Period = 30;
let menuBound = false;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

function setText(selector: string, value: string | number): void {
    const el = $(selector);
    if (el) el.textContent = String(value);
}

function setEmpty(selector: string, message: string): void {
    const el = $(selector);
    if (el) el.innerHTML = `<p class="viz__empty">${message}</p>`;
}

const sign = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '');

/** «↑ +3 к предыдущему периоду» / «как в предыдущем периоде». */
function deltaNote(diff: number, unit = ''): string {
    if (diff === 0) return 'как в предыдущем периоде';
    return `${diff > 0 ? '↑' : '↓'} ${sign(diff)}${Math.abs(Math.round(diff * 10) / 10)}${unit} к предыдущему периоду`;
}

// ===== Итоговые карточки =====

function renderKpis(days: number, today: string): void {
    const tasks = loadTasks();
    const habits = loadActiveHabits();
    const stats = taskPeriodStats(tasks, today, days);
    const onTime = onTimeStats(tasks, today, days);
    const habitStats = habitPeriodStats(habits, today, days);
    const mood = moodPeriodStats(loadMood(), today, days);

    setText('[data-kpi="tasks"]', stats.total);
    setText('[data-kpi-note="tasks"]', deltaNote(stats.total - stats.prevTotal));

    if (onTime.withDeadline > 0) {
        setText('[data-kpi="ontime"]', `${Math.round((onTime.onTime / onTime.withDeadline) * 100)}%`);
        setText('[data-kpi-note="ontime"]', `${onTime.onTime} из ${onTime.withDeadline} задач с дедлайном`);
    } else {
        setText('[data-kpi="ontime"]', '—');
        setText('[data-kpi-note="ontime"]', 'нет выполненных задач с дедлайном');
    }

    if (habitStats.rate !== null) {
        setText('[data-kpi="habits"]', `${habitStats.rate}%`);
        setText(
            '[data-kpi-note="habits"]',
            habitStats.prevRate === null ? 'дней с отметкой' : deltaNote(habitStats.rate - habitStats.prevRate, ' п.п.'),
        );
    } else {
        setText('[data-kpi="habits"]', '—');
        setText('[data-kpi-note="habits"]', 'привычек пока нет');
    }

    if (mood.avg !== null) {
        setText('[data-kpi="mood"]', mood.avg);
        setText(
            '[data-kpi-note="mood"]',
            mood.prevAvg === null ? `${mood.entries.length} оценок за период` : deltaNote(mood.avg - mood.prevAvg),
        );
    } else {
        setText('[data-kpi="mood"]', '—');
        setText('[data-kpi-note="mood"]', 'оценок за период нет');
    }
}

// ===== Задачи =====

function renderTaskCharts(days: number, today: string): void {
    const tasks = loadTasks();
    const stats = taskPeriodStats(tasks, today, days);

    // Столбцы по дням; за 3 месяца — по неделям
    const weekly = days > 30;
    const source = weekly ? aggregateWeeks(stats.byDay) : stats.byDay;
    const top = Math.max(0, ...source.map((d) => d.count));
    const firstMax = source.findIndex((d) => d.count === top);
    const items: ColumnItem[] = source.map((d, i) => ({
        label: days <= 7 ? WEEKDAYS[weekdayIndex(d.date)] : formatDateShort(d.date),
        value: d.count,
        tip: weekly ? `Неделя с ${formatDateShort(d.date)}: ${d.count}` : `${formatDateShort(d.date)}: ${d.count}`,
        accent: top > 0 && i === firstMax,
    }));
    const every = days <= 7 ? 1 : weekly ? 2 : 5;

    setText(
        '#an-tasks-meta',
        `всего ${stats.total} · в среднем ${(Math.round(stats.perDay * 10) / 10).toString().replace('.', ',')} в день`,
    );
    const box = $('#an-tasks-days');
    if (box) {
        box.innerHTML =
            stats.total === 0
                ? '<p class="viz__empty">За этот период выполненных задач нет.</p>'
                : renderColumns(items, {
                      height: 190,
                      showValues: items.length <= 14,
                      labelAt: (i) => (items.length - 1 - i) % every === 0,
                  });
    }

    // По дням недели
    const totals = weekdayTotals(stats.byDay);
    const bw = pickBestWorst(totals);
    setText('#an-weekdays-meta', bw ? `лучший день — ${WEEKDAYS[bw.best]}` : '');
    const weekdayBox = $('#an-weekdays');
    if (weekdayBox) {
        weekdayBox.innerHTML =
            stats.total === 0
                ? '<p class="viz__empty">Пока нет данных.</p>'
                : renderColumns(
                      totals.map((v, i) => ({
                          label: WEEKDAYS[i],
                          value: v,
                          tip: `${WEEKDAYS[i]}: ${v}`,
                          accent: bw !== null && i === bw.best,
                      })),
                      { height: 130, showValues: true },
                  );
    }

    // По категориям
    const cats = categoryBreakdown(tasks, today, days);
    const catBox = $('#an-categories');
    if (catBox) {
        catBox.innerHTML =
            cats.length === 0
                ? '<p class="viz__empty">Пока нет данных.</p>'
                : renderHBars(
                      cats.map((c) => ({ label: c.name, value: c.count, valueText: String(c.count), tip: `${c.name}: ${c.count}` })),
                  );
    }
}

// ===== Привычки =====

function renderHabitChart(days: number, today: string): void {
    const habits = loadActiveHabits();
    const box = $('#an-habits');
    if (!box) return;

    if (habits.length === 0) {
        setText('#an-habits-meta', '');
        setEmpty('#an-habits', 'Привычек пока нет — добавьте первую в разделе «Привычки».');
        return;
    }

    const stats = habitPeriodStats(habits, today, days);
    setText('#an-habits-meta', `${stats.rate ?? 0}% дней с отметкой`);

    // За 3 месяца — ячейка на неделю (интенсивность = доля отмеченных дней)
    const weekly = days > 30;
    const rows = stats.rows.map((r) => {
        if (!weekly) {
            return {
                label: r.text,
                cells: r.marks.map((m) => (m ? 1 : 0)),
                off: r.marks.map((m, i) => !m && !r.due[i]), // не по графику и не отмечено — «выходной»
                tips: r.marks.map(
                    (m, i) => `${formatDateShort(stats.dates[i])} — ${r.text}: ${m ? 'отмечено' : r.due[i] ? 'нет' : 'не по графику'}`,
                ),
                value: `${r.percent}%`,
            };
        }
        const cells: number[] = [];
        const off: boolean[] = [];
        const tips: string[] = [];
        for (let end = r.marks.length; end > 0; end -= 7) {
            const from = Math.max(0, end - 7);
            const dueN = r.due.slice(from, end).filter(Boolean).length;
            const done = r.marks.slice(from, end).filter((m, i) => m && r.due[from + i]).length;
            cells.unshift(dueN === 0 ? 0 : done / dueN);
            off.unshift(dueN === 0);
            tips.unshift(
                `Неделя с ${formatDateShort(stats.dates[from])} — ${r.text}: ${dueN === 0 ? 'нет дней по графику' : `${done} из ${dueN}`}`,
            );
        }
        return { label: r.text, cells, off, tips, value: `${r.percent}%` };
    });

    box.innerHTML = renderHeatmap(rows, formatDateShort(stats.dates[0]), 'сегодня');
}

// ===== Настроение =====

function renderMoodCharts(days: number, today: string): void {
    const entries = loadMood();
    const stats = moodPeriodStats(entries, today, days);
    const lineBox = $('#an-mood-line');
    const donutBox = $('#an-mood-donut');

    if (stats.entries.length === 0) {
        setText('#an-mood-meta', '');
        setEmpty('#an-mood-line', 'За этот период оценок нет.');
        setEmpty('#an-mood-donut', 'Пока нет данных.');
        return;
    }

    setText('#an-mood-meta', `${stats.entries.length} ${stats.entries.length === 1 ? 'оценка' : 'оценок'}`);

    const notes = new Map(stats.entries.filter((e) => e.note).map((e) => [e.date, e.note]));
    if (lineBox) mountResponsive(lineBox, (width) => renderMoodArea(stats.series, { width, height: 230, avg: stats.avg, today, notes }));

    // Кольцо: порядок «Отлично … Ужасно», цвета — из палитры настроения
    const total = stats.counts.reduce((a, b) => a + b, 0);
    const colors = ['var(--mood-5)', 'var(--mood-4)', 'var(--mood-3)', 'var(--mood-2)', 'var(--mood-1)'];
    const segments = stats.counts.map((value, i) => ({ label: MOOD_LABELS[i], value, color: colors[i] }));
    const legend = segments
        .map(
            (s) =>
                `<div class="legend__row"><span class="legend__dot" style="background:${s.color}"></span><span>${s.label}</span><span class="legend__count">${s.value}</span><span class="legend__pct">${Math.round((s.value / total) * 100)}%</span></div>`,
        )
        .join('');
    if (donutBox)
        donutBox.innerHTML = `<div class="donut-wrap">${renderDonut(segments, String(stats.avg ?? '—'), 'среднее')}<div class="legend">${legend}</div></div>`;
}

// ===== Наблюдения и советы =====

function buildInsights(days: number, today: string): string[] {
    const tasks = loadTasks();
    const habits = loadActiveHabits();
    const list: string[] = [];

    const taskStats = taskPeriodStats(tasks, today, days);
    const totals = weekdayTotals(taskStats.byDay);
    const bw = pickBestWorst(totals);
    if (taskStats.total > 0 && bw) {
        list.push(`Чаще всего вы закрываете задачи по ${WEEKDAYS_DATIVE[bw.best]}: ${totals[bw.best]} из ${taskStats.total}.`);
    }

    const onTime = onTimeStats(tasks, today, days);
    if (onTime.withDeadline > 0) {
        list.push(`В срок закрыто ${onTime.onTime} из ${onTime.withDeadline} задач с дедлайном.`);
    }

    const overdue = tasks.filter((t) => !t.completed && t.date && t.date < today).length;
    if (overdue > 0) list.push(`Сейчас просрочено задач: ${overdue}. Разберите их на главной во вкладке «Просрочено».`);

    const habitStats = habitPeriodStats(habits, today, days);
    if (habitStats.rows.length > 0 && habitStats.rows.some((r) => r.done > 0)) {
        const byPercent = [...habitStats.rows].sort((a, b) => b.percent - a.percent);
        list.push(`Самая стабильная привычка — «${byPercent[0].text}»: отмечена в ${byPercent[0].percent}% дней.`);
        const weakest = byPercent[byPercent.length - 1];
        if (byPercent.length > 1 && weakest.percent < byPercent[0].percent) {
            list.push(`Чаще всего пропускается «${weakest.text}» — отметки в ${weakest.percent}% дней.`);
        }
    }

    const link = moodVsHabits(habits, loadMood(), today, days);
    if (link) {
        list.push(`В дни, когда отмечено не меньше половины привычек, настроение в среднем ${link.high}, в остальные дни — ${link.low}.`);
    }

    if (list.length === 0) list.push('Пока мало данных для выводов — продолжайте отмечать, и здесь появятся наблюдения.');
    return list;
}

function renderInsights(days: number, today: string): void {
    const ul = $('#an-insights');
    if (!ul) return;
    ul.replaceChildren();
    for (const text of buildInsights(days, today)) {
        const li = document.createElement('li');
        li.className = 'insight';
        li.textContent = text;
        ul.appendChild(li);
    }
}

function renderAdvice(days: number, today: string): void {
    const box = $('#an-advice');
    if (!box) return;
    box.replaceChildren();

    const tasks = loadTasks();
    const habits = loadActiveHabits();
    const stats = taskPeriodStats(tasks, today, days);
    const mood = moodPeriodStats(loadMood(), today, days);
    const bestStreak = Math.max(0, ...habits.map((h) => getStreak(h.dates, today, h.days)));

    // Самая частая оценка словом (для совета по настроению)
    const top = mood.counts.indexOf(Math.max(...mood.counts));
    const frequent = mood.entries.length > 0 ? MOOD_WORDS[top] : '';

    const rows: [string, string][] = [
        [
            'Задачи',
            tasks.length > 0
                ? generateTaskAdvice(stats.perDay, taskStreak(tasks, today))
                : 'Добавьте первую задачу — и здесь появится совет.',
        ],
        ['Привычки', habits.length > 0 ? generateHabitAdvice(bestStreak) : 'Добавьте привычку — и здесь появится совет.'],
        ['Настроение', mood.avg !== null ? generateMoodAdvice(mood.avg, frequent) : 'Запишите настроение — и здесь появится совет.'],
    ];

    for (const [tag, text] of rows) {
        const row = document.createElement('div');
        row.className = 'advice-row';
        const label = document.createElement('span');
        label.className = 'advice-row__tag';
        label.textContent = tag;
        const body = document.createElement('span');
        body.className = 'advice-row__text';
        body.textContent = text;
        row.append(label, body);
        box.appendChild(row);
    }
}

// ===== Публичный API =====

/** Перерисовывает страницу целиком; вызывается при каждом переходе на вкладку и при смене периода. */
export function renderAnalyticsPage(): void {
    const section = document.getElementById('analytics-section');
    if (!section) return;
    unmountResponsive(section);

    const today = todayStr();
    setText('#analytics-sub', `Статистика за ${PERIOD_LABELS[period]}: ${formatDateShort(addDays(today, -(period - 1)))} — сегодня`);

    document.querySelectorAll<HTMLElement>('#analytics-period [data-days]').forEach((btn) => {
        const active = Number(btn.dataset.days) === period;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    renderKpis(period, today);
    renderTaskCharts(period, today);
    renderHabitChart(period, today);
    renderMoodCharts(period, today);
    renderInsights(period, today);
    renderAdvice(period, today);

    if (menuBound) return;
    menuBound = true;
    $('#analytics-period')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-days]');
        if (!btn) return;
        period = Number(btn.dataset.days) as Period;
        renderAnalyticsPage();
    });
    $('#an-advice-refresh')?.addEventListener('click', () => renderAdvice(period, todayStr()));
}
