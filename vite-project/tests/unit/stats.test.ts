import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import * as S from '../../src/stats';
import { daysBack, doneTask, mkHabit, mkMood, mkTask } from './factories';

const T = '2026-09-19'; // суббота

describe('серии и недельные счётчики', () => {
    it('getStreak без графика', () => {
        assert.equal(S.getStreak(['2026-09-19', '2026-09-18', '2026-09-16'], T), 2);
        assert.equal(S.getStreak(['2026-09-18'], T), 0);
        assert.equal(S.getStreak(['2026-09-19', '2026-09-18', '2026-09-17'], T), 3);
    });

    it('isDue: привычка без графика — каждый день', () => {
        assert.equal(S.isDue({}, T), true);
        assert.equal(S.isDue({ days: [5, 6] }, T), true); // суббота = 5
        assert.equal(S.isDue({ days: [0, 2, 4] }, T), false); // пн ср пт
    });

    it('getStreak по графику Пн/Ср/Пт', () => {
        // сегодня (сб) не по графику; пт 18, ср 16, пн 14 отмечены → серия 3
        assert.equal(S.getStreak(['2026-09-18', '2026-09-16', '2026-09-14'], T, [0, 2, 4]), 3);
        assert.equal(S.getStreak(['2026-09-18', '2026-09-14'], T, [0, 2, 4]), 1); // среда пропущена → серия оборвана
        assert.equal(S.getStreak([T], T, [0, 2, 4]), 0); // отметка в день не по графику серию не даёт
        assert.equal(S.getStreak([], T, [5]), 0); // сегодня по графику и не отмечено
        assert.equal(S.getStreak([T, '2026-09-12'], T, [5]), 2); // только субботы: 19 и 12
        assert.equal(S.getStreak([], T, [0]), 0); // защита от бесконечного цикла
    });

    it('tasksCompletedByWeekday: по дате выполнения, для старых задач — по дедлайну', () => {
        const wk = S.tasksCompletedByWeekday(
            [
                doneTask(T, { date: '2026-09-01' }), // сб
                mkTask({ completed: true, date: '2026-09-18' }), // старая: по дедлайну, пт
                doneTask('2026-08-01', { date: '2026-09-01' }), // вне недели
                mkTask({ date: T }), // не выполнена
            ],
            T,
        );
        assert.deepEqual(wk, [0, 0, 0, 0, 1, 1, 0]);
    });

    it('taskStreak, habitWeekCounts, moodCounts', () => {
        assert.equal(S.taskStreak([doneTask(T)], T), 1);
        assert.deepEqual(S.habitWeekCounts([mkHabit({ id: 'h', text: 'x', dates: [T, '2026-09-10'] })], T), [1]);
        assert.deepEqual(S.moodCounts([mkMood(T, 5), mkMood(T, 1)]), [1, 0, 0, 0, 1]);
    });

    it('pickBestWorst', () => {
        assert.equal(S.pickBestWorst([0, 0, 0]), null);
        assert.deepEqual(S.pickBestWorst([1, 3, 0]), { best: 1, worst: 2 });
    });
});

describe('сводки главной', () => {
    it('taskOverview и deadlineOverview', () => {
        assert.deepEqual(
            S.taskOverview([mkTask({ completed: true }), mkTask({ date: '2026-09-10' }), mkTask({ date: '2026-09-25' }), mkTask()], T),
            { done: 1, active: 3, overdue: 1 },
        );
        assert.deepEqual(
            S.deadlineOverview(
                [
                    mkTask({ date: '2026-09-10' }),
                    mkTask({ date: T }),
                    mkTask({ date: '2026-09-26' }),
                    mkTask({ date: '2026-09-27' }),
                    mkTask({ date: T, completed: true }),
                    mkTask(),
                ],
                T,
            ),
            { overdue: 1, today: 1, week: 1 },
        );
    });

    it('habitOverview', () => {
        assert.deepEqual(S.habitOverview([mkHabit({ dates: [T, '2026-09-18'] }), mkHabit({ dates: [] })], T), {
            doneToday: 1,
            left: 1,
            bestStreak: 2,
        });
        assert.equal(S.habitOverview([], T).bestStreak, 0);
    });

    it('habitOverview: считает только привычки по графику', () => {
        const habits = [
            mkHabit({ text: 'Каждый день', dates: [T] }),
            mkHabit({ text: 'Пн Ср Пт', days: [0, 2, 4] }), // сегодня не по графику
            mkHabit({ text: 'Сб', days: [5] }), // сегодня по графику, не отмечена
            mkHabit({ text: 'Не по графику, но отмечена', dates: [T], days: [0] }),
        ];
        const ov = S.habitOverview(habits, T);
        assert.deepEqual([ov.doneToday, ov.left], [2, 1]);
    });

    it('moodOverview', () => {
        assert.equal(S.moodOverview([], T), null);
        assert.deepEqual(S.moodOverview([mkMood(T, 5), mkMood('2026-09-18', 2), mkMood('2026-08-01', 1)], T), { avg: 3.5, min: 2, max: 5 });
    });
});

describe('ряды для графиков', () => {
    it('tasksCompletedByDay', () => {
        const days = S.tasksCompletedByDay(
            [
                doneTask(T),
                doneTask(T),
                doneTask('2026-09-17'),
                mkTask({ completed: true, date: '2026-09-18' }), // старая задача без completedAt → по дедлайну
                doneTask('2026-08-01'), // вне окна
                mkTask({ completed: false, completedAt: T }), // не выполнена
            ],
            T,
            7,
        );
        assert.equal(days.length, 7);
        assert.equal(days[6].date, T);
        assert.equal(days[6].count, 2);
        assert.equal(days.find((d) => d.date === '2026-09-17')!.count, 1);
        assert.equal(days.find((d) => d.date === '2026-09-18')!.count, 1);
        assert.equal(
            days.reduce((a, d) => a + d.count, 0),
            4,
        );
    });

    it('moodSeries: окно и пустые данные', () => {
        const ms = S.moodSeries([mkMood(T, 5), mkMood('2026-09-06', 2), mkMood('2026-09-05', 1)], T, 14);
        assert.equal(ms.points.length, 2); // 5 сентября — вне окна (14 дней: 6…19)
        assert.deepEqual(
            ms.points.map((p) => p.i),
            [0, 13],
        );
        assert.equal(S.moodSeries([], T).points.length, 0);
    });
});

describe('список задач на главной', () => {
    const list = [
        mkTask({ id: 'late', text: 'просрочена', date: '2026-09-10' }),
        mkTask({ id: 'a', text: 'без времени', date: T }),
        mkTask({ id: 'b', text: 'в 18:30', date: T, time: '18:30' }),
        mkTask({ id: 'c', text: 'в 09:15', date: T, time: '09:15' }),
        mkTask({ id: 'd', text: 'важная без времени', date: T, priority: 'high' }),
        mkTask({ id: 'w', text: 'через 5 дней', date: '2026-09-24' }),
        mkTask({ id: 'far', text: 'через 30 дней', date: '2026-10-19' }),
        mkTask({ id: 'done', text: 'сделана', date: T, completed: true }),
        mkTask({ id: 'nodate', text: 'без даты' }),
    ];
    const ids = (tasks: ReturnType<typeof mkTask>[]) => tasks.map((t) => t.id);

    it('«Сегодня»: по времени, без времени — после, важные раньше, выполненных нет', () => {
        assert.deepEqual(ids(S.tasksForList(list, 'today', T)), ['c', 'b', 'd', 'a']);
    });

    it('«Просроченные»', () => {
        assert.deepEqual(ids(S.tasksForList(list, 'overdue', T)), ['late']);
    });

    describe('«Неделя» — календарная Пн–Вс', () => {
        const withMonday = [...list, mkTask({ id: 'mon', text: 'просрочена, но на этой неделе', date: '2026-09-15' })];

        it('включает предстоящее, просроченное и выполненное (в конце)', () => {
            assert.deepEqual(ids(S.tasksForList(withMonday, 'week', T)), ['mon', 'c', 'b', 'd', 'a', 'done']);
        });

        it('не включает прошлую и следующую недели и задачи без даты', () => {
            const week = ids(S.tasksForList(withMonday, 'week', T));
            for (const id of ['late', 'w', 'far', 'nodate']) assert.ok(!week.includes(id), id);
        });

        it('«Просроченные» — все, в том числе с этой недели; «Сегодня» без выполненных', () => {
            assert.deepEqual(ids(S.tasksForList(withMonday, 'overdue', T)), ['late', 'mon']);
            assert.ok(!ids(S.tasksForList(withMonday, 'today', T)).includes('done'));
        });

        it('граница недели: в воскресенье и в понедельник', () => {
            const sameWeek = ['mon', 'c', 'b', 'd', 'a', 'done'];
            assert.deepEqual(ids(S.tasksForList(withMonday, 'week', '2026-09-14')), sameWeek);
            assert.deepEqual(ids(S.tasksForList(withMonday, 'week', '2026-09-20')), sameWeek);
            assert.deepEqual(ids(S.tasksForList(withMonday, 'week', '2026-09-21')), ['w']);
        });
    });

    it('nearestDeadline: просроченная — первая; пусто — null', () => {
        assert.equal(S.nearestDeadline(list)!.id, 'late');
        assert.equal(S.nearestDeadline([mkTask(), mkTask({ date: T, completed: true })]), null);
    });
});

describe('фильтры и сортировка раздела «Задачи»', () => {
    const tasks = [
        mkTask({ id: 'Яблоки', text: 'Яблоки', category: 'Дом', date: '2026-09-25', priority: 'low' }),
        mkTask({ id: 'Арбуз', text: 'Арбуз', category: 'дом', date: '2026-09-20', priority: 'high', completed: true }),
        mkTask({ id: 'Билеты', text: 'Билеты', category: 'Работа', date: '2026-09-20', time: '10:00', priority: 'high' }),
        mkTask({ id: 'Ёжик', text: 'Ёжик', category: '', priority: 'normal' }),
        mkTask({ id: 'Дела', text: 'Дела', category: 'Работа', date: '2026-09-20', time: '09:00', priority: 'normal' }),
    ];
    const titles = (list: typeof tasks) => list.map((t) => t.text);

    it('категории: уникальные, непустые, по алфавиту (регистр различается)', () => {
        assert.deepEqual(S.taskCategories(tasks), ['дом', 'Дом', 'Работа']);
    });

    it('фильтр по статусу', () => {
        assert.deepEqual(titles(S.filterTasks(tasks, { status: 'active', category: '' })), ['Яблоки', 'Билеты', 'Ёжик', 'Дела']);
        assert.deepEqual(titles(S.filterTasks(tasks, { status: 'completed', category: '' })), ['Арбуз']);
        assert.equal(S.filterTasks(tasks, { status: 'all', category: '' }).length, 5);
    });

    it('фильтр по категории', () => {
        assert.deepEqual(titles(S.filterTasks(tasks, { status: 'all', category: 'Работа' })), ['Билеты', 'Дела']);
        assert.deepEqual(titles(S.filterTasks(tasks, { status: 'all', category: S.NO_CATEGORY })), ['Ёжик']);
        assert.deepEqual(titles(S.filterTasks(tasks, { status: 'active', category: 'дом' })), []);
    });

    it('сортировка', () => {
        assert.deepEqual(titles(S.sortTasks(tasks, 'added')), ['Яблоки', 'Арбуз', 'Билеты', 'Ёжик', 'Дела']);
        assert.deepEqual(titles(S.sortTasks(tasks, 'deadline')), ['Дела', 'Билеты', 'Арбуз', 'Яблоки', 'Ёжик']); // дата → время; без даты в конце
        assert.deepEqual(titles(S.sortTasks(tasks, 'priority')), ['Арбуз', 'Билеты', 'Дела', 'Ёжик', 'Яблоки']); // high → normal → low
        assert.deepEqual(titles(S.sortTasks(tasks, 'title')), ['Арбуз', 'Билеты', 'Дела', 'Ёжик', 'Яблоки']); // «Ё» после «Д»
    });

    it('исходный массив не меняется', () => {
        S.sortTasks(tasks, 'title');
        assert.equal(tasks[0].text, 'Яблоки');
    });
});

describe('аналитика по периодам', () => {
    const tasks = [
        doneTask(T),
        doneTask(T),
        doneTask('2026-09-15'),
        doneTask('2026-09-08'),
        doneTask('2026-09-05'),
        doneTask('2026-08-25'),
        doneTask('2026-08-01'),
    ];

    it('taskPeriodStats: окно и предыдущее окно', () => {
        let st = S.taskPeriodStats(tasks, T, 7);
        assert.equal(st.total, 3);
        assert.equal(st.byDay.length, 7);
        assert.equal(st.prevTotal, 1); // предыдущее окно 6–12 сентября: только 8 сентября
        st = S.taskPeriodStats(tasks, T, 30);
        assert.equal(st.total, 6); // 21 авг…19 сент: без 1 августа
        assert.ok(Math.abs(st.perDay - 6 / 30) < 1e-9);
    });

    it('onTimeStats: в срок / позже / без дедлайна', () => {
        const ot = S.onTimeStats(
            [
                doneTask('2026-09-10', { date: '2026-09-10' }), // в день дедлайна — в срок
                doneTask('2026-09-10', { date: '2026-09-12' }), // раньше — в срок
                doneTask('2026-09-10', { date: '2026-09-08' }), // позже — нет
                doneTask('2026-09-10'), // без дедлайна — не считается
                mkTask({ date: '2026-09-10' }), // не выполнена
            ],
            T,
            30,
        );
        assert.deepEqual(ot, { withDeadline: 3, onTime: 2 });
    });

    it('weekdayTotals и aggregateWeeks', () => {
        const byDay = S.taskPeriodStats(tasks, T, 7).byDay;
        assert.equal(
            S.weekdayTotals(byDay).reduce((a, b) => a + b, 0),
            3,
        );
        assert.equal(S.weekdayTotals(byDay)[5], 2); // суббота 19 сентября
        const weeks = S.aggregateWeeks(S.taskPeriodStats(tasks, T, 91).byDay);
        assert.equal(weeks.length, 13);
        assert.equal(weeks[12].count, 3); // последняя неделя: 13–19 сентября
        assert.equal(
            weeks.reduce((a, w) => a + w.count, 0),
            7,
        ); // все 7 задач попадают в 91 день
        const odd = S.aggregateWeeks(S.taskPeriodStats([], T, 30).byDay);
        assert.equal(odd.length, 5); // 30 = 4 полные недели + хвост из 2 дней
        assert.equal(odd[0].date, '2026-08-21');
    });

    it('categoryBreakdown: по убыванию, при равенстве по алфавиту, с лимитом', () => {
        const cats = S.categoryBreakdown(
            [
                doneTask(T, { category: 'Работа' }),
                doneTask(T, { category: 'Работа' }),
                doneTask(T, { category: 'Дом' }),
                doneTask(T),
                doneTask('2026-01-01', { category: 'Старая' }),
            ],
            T,
            30,
            2,
        );
        assert.deepEqual(cats, [
            { name: 'Работа', count: 2 },
            { name: 'Без категории', count: 1 },
        ]);
        assert.equal(S.categoryBreakdown([doneTask(T)], T, 30)[0].name, 'Без категории');
    });

    it('habitRate и habitPeriodStats', () => {
        const habits = [
            mkHabit({ id: 'a', text: 'Зарядка', dates: [T, '2026-09-18', '2026-09-17', '2026-09-10'] }),
            mkHabit({ id: 'b', text: 'Чтение', dates: ['2026-09-18'] }),
        ];
        assert.equal(S.habitRate(habits, T, 7), Math.round(((3 + 1) / 14) * 100));
        assert.equal(S.habitRate([], T, 7), null);
        const hp = S.habitPeriodStats(habits, T, 7);
        assert.equal(hp.rows[0].percent, Math.round((3 / 7) * 100));
        assert.equal(hp.rows[0].streak, 3);
        assert.equal(hp.rows[1].streak, 0);
        assert.equal(hp.dates.length, 7);
        assert.equal(hp.rows[0].marks[6], true);
        assert.equal(hp.prevRate, S.habitRate(habits, '2026-09-12', 7));
    });

    it('habitRate и habitPeriodStats считают только дни по графику', () => {
        const week = [mkHabit({ text: 'вт чт', dates: ['2026-09-15', '2026-09-17'], days: [1, 3] })]; // 13–19: вт 15, чт 17
        assert.equal(S.habitRate(week, T, 7), 100);
        assert.equal(S.habitRate([{ ...week[0], dates: ['2026-09-15'] }], T, 7), 50);
        assert.equal(S.habitRate([mkHabit({ days: [0] })], '2026-09-13', 1), null); // воскресенье, график — понедельник

        const ps = S.habitPeriodStats([mkHabit({ text: 'вт чт', dates: ['2026-09-15', '2026-09-18'], days: [1, 3] })], T, 7);
        assert.equal(ps.rows[0].due.filter(Boolean).length, 2);
        assert.equal(ps.rows[0].done, 1); // отметка в пятницу (не по графику) не считается
        assert.equal(ps.rows[0].percent, 50);
        assert.equal(ps.rows[0].marks.filter(Boolean).length, 2); // но в marks она есть (для тепловой карты)
    });

    it('moodPeriodStats', () => {
        const mood = [mkMood(T, 5), mkMood('2026-09-18', 3), mkMood('2026-09-05', 1), mkMood('2026-09-10', 4)]; // 10 сент. — предыдущее окно
        const mp = S.moodPeriodStats(mood, T, 7);
        assert.equal(mp.avg, 4);
        assert.equal(mp.entries.length, 2);
        assert.equal(mp.prevAvg, 4);
        assert.deepEqual(mp.counts, [1, 0, 1, 0, 0]);
        assert.equal(S.moodPeriodStats([], T, 7).avg, null);
    });

    describe('moodVsHabits', () => {
        const dates = daysBack(12);
        const habit = [mkHabit({ dates: dates.filter((_, i) => i % 2 === 0) })]; // отмечена в чётные дни
        const mood = dates.map((date, i) => mkMood(date, i % 2 === 0 ? 5 : 2));

        it('сравнивает настроение в дни с отметкой и без', () => {
            assert.deepEqual(S.moodVsHabits(habit, mood, T, 30), { high: 5, low: 2 });
        });

        it('мало данных или нет привычек — null', () => {
            assert.equal(S.moodVsHabits(habit, mood.slice(0, 3), T, 30), null);
            assert.equal(S.moodVsHabits([], mood, T, 30), null);
        });

        it('доля считается по привычкам, назначенным на этот день', () => {
            assert.ok(
                S.moodVsHabits(
                    habit,
                    daysBack(6).map((d, i) => mkMood(d, i % 2 === 0 ? 5 : 1)),
                    T,
                    30,
                ),
            );
            // день, когда ничего не назначено, пропускается
            const mondays = [mkHabit({ days: [0] })];
            assert.equal(
                S.moodVsHabits(
                    mondays,
                    daysBack(6).map((d, i) => mkMood(d, i % 2 === 0 ? 5 : 1)),
                    T,
                    30,
                ),
                null,
            );
        });
    });
});
