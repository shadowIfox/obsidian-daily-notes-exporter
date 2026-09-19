import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { moodSeries, tasksCompletedByDay } from '../../src/stats';
import { renderBars, renderColumns, renderDonut, renderHBars, renderHeatmap, renderLine, renderMoodArea } from '../../src/viz';
import { daysBack, doneTask, mkMood, mkTask } from './factories';

const T = '2026-09-19';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('renderBars / renderLine (главная)', () => {
    const days = tasksCompletedByDay([doneTask(T), doneTask(T), doneTask('2026-09-17'), mkTask({ completed: true, date: '2026-09-18' })], T, 7);
    const ms = moodSeries([mkMood(T, 5), mkMood('2026-09-06', 2)], T, 14);

    it('renderBars: 7 колонок, сегодня выделено', () => {
        const bars = renderBars(days);
        assert.equal(count(bars, /class="bars__col/g), 7);
        assert.equal(count(bars, /bars__dot/g), 4);
        assert.ok(bars.includes('bars__col--today'));
    });

    it('renderLine: подпись «сегодня», без точек — «пока нет», без NaN', () => {
        const svg = renderLine(ms, T);
        assert.ok(svg.includes('сегодня'));
        assert.ok(!svg.includes('NaN'));
        assert.ok(renderLine(moodSeries([], T), T).includes('пока нет'));
        assert.ok(!renderLine(moodSeries([mkMood(T, 3)], T), T).includes('NaN')); // одна точка
    });
});

describe('графики аналитики', () => {
    it('renderColumns: колонки, высоты, акцент', () => {
        const cols = renderColumns([{ label: 'Пн', value: 3, tip: 'a', accent: true }, { label: 'Вт', value: 0, tip: 'b' }], { height: 100, showValues: true });
        assert.equal(count(cols, /class="col"/g), 2);
        assert.ok(cols.includes('col__bar--accent') && cols.includes('height:100px') && cols.includes('height:0px'));
    });

    it('renderColumns экранирует HTML (XSS)', () => {
        assert.ok(!renderColumns([{ label: '<b>x</b>', value: 1, tip: '"><script>' }], {}).includes('<script>'));
        assert.ok(!renderColumns([{ label: '<b>x</b>', value: 1, tip: 't' }], {}).includes('<b>x</b>'));
    });

    it('renderHBars: экранирует и считает ширину', () => {
        const hb = renderHBars([{ label: '<i>Дом</i>', value: 5, valueText: '5' }, { label: 'Ещё', value: 0, valueText: '0' }]);
        assert.ok(!hb.includes('<i>') && hb.includes('&lt;i&gt;') && hb.includes('width:100%') && hb.includes('width:0%'));
    });

    it('renderHeatmap: ячейки и экранирование', () => {
        const heat = renderHeatmap([{ label: 'А<b>', cells: [1, 0, 0.5], tips: ['x', 'y', 'z'], value: '50%' }], 'с', 'по');
        assert.equal(count(heat, /class="heat__cell"/g), 3);
        assert.ok(heat.includes('repeat(3,') && !heat.includes('А<b>'));
    });

    it('renderDonut: нулевые сегменты пропускаются, NaN нет', () => {
        const donut = renderDonut([{ label: 'a', value: 3, color: 'red' }, { label: 'b', value: 0, color: 'blue' }, { label: 'c', value: 1, color: 'green' }], '4.5', 'среднее');
        assert.equal(count(donut, /donut__seg/g), 2);
        assert.ok(!donut.includes('NaN'));
        assert.ok(!renderDonut([{ label: 'a', value: 0, color: 'red' }], '—', 'x').includes('donut__seg'));
        assert.ok(!renderDonut([{ label: 'a', value: 5, color: 'red' }], '5', 'x').includes('NaN'));
    });

    describe('renderMoodArea', () => {
        const mm = daysBack(12).map((d, i) => mkMood(d, i % 2 === 0 ? 5 : 2));

        it('содержит подписи, точки и цвета оценок; заметки экранируются', () => {
            const series = moodSeries(mm, T, 14);
            const area = renderMoodArea(series, { width: 600, height: 230, avg: 3.5, today: T, notes: new Map([[T, 'заметка <b>']]) });
            assert.ok(!area.includes('NaN') && area.includes('сегодня') && area.includes('ср. 3.5') && area.includes('var(--mood-5)'));
            assert.ok(!area.includes('<b>') && area.includes('&lt;b&gt;'));
            assert.equal(count(area, /<circle/g), series.points.length);
        });

        it('одна точка и отсутствие среднего не ломают SVG', () => {
            assert.ok(!renderMoodArea(moodSeries([mkMood(T, 3)], T, 7), { width: 400, height: 200, avg: 3, today: T }).includes('NaN'));
            const w7 = renderMoodArea(moodSeries(mm, T, 7), { width: 300, height: 200, avg: null, today: T });
            assert.ok(!w7.includes('NaN') && !w7.includes('ср. '));
        });
    });
});
