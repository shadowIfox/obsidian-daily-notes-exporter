import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildNotices } from '../../src/notifications';
import { mkHabit, mkMood, mkTask } from './factories';

const T = '2026-09-19';
const ids = (n: ReturnType<typeof buildNotices>) => n.map((x) => x.id);

describe('buildNotices', () => {
    it('новому пользователю тихо', () => {
        assert.deepEqual(buildNotices([], [], [], T, '10:00'), []);
    });

    describe('утро: просроченные, сегодняшние, привычки без отметки', () => {
        const tasks = [
            mkTask({ id: 'o1', text: 'Старая 1', date: '2026-09-10' }),
            mkTask({ id: 'o2', text: 'Старая 2', date: '2026-09-15' }),
            mkTask({ id: 'a', text: 'Утренняя', date: T, time: '09:00' }),
            mkTask({ id: 'b', text: 'Вечерняя', date: T, time: '18:30' }),
            mkTask({ id: 'c', text: 'Без времени', date: T }),
            mkTask({ id: 'd', text: 'Сделана', date: T, completed: true }),
            mkTask({ id: 'e', text: 'Завтра', date: '2026-09-20' }),
        ];
        const habits = [
            mkHabit({ id: 'h1', text: 'Зарядка' }),
            mkHabit({ id: 'h2', text: 'Чтение', dates: [T] }),
            mkHabit({ id: 'h3', text: 'Вода' }),
            mkHabit({ id: 'h4', text: 'Сон' }),
        ];
        const n = buildNotices(tasks, habits, [], T, '12:00');

        it('порядок и отсутствие напоминания о настроении до 16:00', () => {
            assert.deepEqual(ids(n), ['overdue', 'today', 'habits']);
        });

        it('просроченные: самая старая первой', () => {
            assert.equal(n[0].title, 'Просрочено: 2 задачи');
            assert.equal(n[0].detail, 'Старая 1 и ещё 1');
            assert.equal(n[0].taskId, 'o1');
        });

        it('сегодня: ближайшая по времени', () => {
            assert.equal(n[1].title, 'На сегодня: 3 задачи');
            assert.equal(n[1].detail, 'Ближайшая в 18:30 — Вечерняя');
            assert.equal(n[1].taskId, 'b');
        });

        it('привычки без отметки', () => {
            assert.equal(n[2].title, 'Привычек без отметки: 3');
            assert.equal(n[2].detail, 'Зарядка, Вода и ещё 1');
            assert.equal(n[2].route, 'habits');
        });
    });

    it('вечером напоминает про настроение, если оно не записано', () => {
        const n = buildNotices([], [], [], T, '16:00');
        assert.deepEqual(ids(n), ['mood']);
        assert.equal(n[0].route, 'mood');
        assert.deepEqual(buildNotices([], [], [mkMood(T, 3)], T, '22:00'), []);
    });

    it('после последней задачи со временем «ближайшей» нет — показывает первую по списку', () => {
        const n = buildNotices([mkTask({ id: 'a', text: 'Утренняя', date: T, time: '09:00' })], [], [], T, '20:00');
        assert.equal(n[0].detail, 'Утренняя');
    });

    it('выполненные и без даты не в счёт', () => {
        assert.deepEqual(
            buildNotices([mkTask({ date: '2026-01-01', completed: true }), mkTask({ text: 'без даты' })], [], [], T, '10:00'),
            [],
        );
    });

    it('привычка не по графику не попадает в «без отметки»', () => {
        const habits = [
            mkHabit({ text: 'Каждый день', dates: [T] }),
            mkHabit({ text: 'Пн Ср Пт', days: [0, 2, 4] }), // сегодня суббота
            mkHabit({ text: 'Сб', days: [5] }),
            mkHabit({ text: 'Не по графику, но отмечена', dates: [T], days: [0] }),
        ];
        const habitNotice = buildNotices([], habits, [], T, '10:00').find((x) => x.id === 'habits')!;
        assert.equal(habitNotice.title, 'Привычек без отметки: 1');
        assert.equal(habitNotice.detail, 'Сб');
    });
});
