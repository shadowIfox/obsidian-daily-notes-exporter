import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
    addDays,
    daysInMonth,
    formatDateShort,
    isoWeek,
    lastNDates,
    monthGrid,
    parseDateStr,
    toDateStr,
    weekdayIndex,
    weekRange,
} from '../../src/dates';
import { plural } from '../../src/utils/plural';

describe('dates', () => {
    it('сдвигает даты через границы месяца и года', () => {
        assert.equal(addDays('2026-03-01', -1), '2026-02-28');
        assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    });

    it('lastNDates возвращает n дат по возрастанию, последняя — сегодня', () => {
        assert.deepEqual(lastNDates(3, '2026-09-19'), ['2026-09-17', '2026-09-18', '2026-09-19']);
    });

    it('parseDateStr отсекает несуществующие даты', () => {
        assert.equal(parseDateStr('2026-02-31'), null);
        assert.equal(parseDateStr('bad'), null);
    });

    it('daysInMonth и weekdayIndex', () => {
        assert.equal(daysInMonth('2026-02-10'), 28);
        assert.equal(weekdayIndex('2026-09-19'), 5); // суббота
    });

    it('«сегодня» в час ночи по местному времени — не вчера (баг toISOString)', () => {
        const night = new Date(2026, 8, 19, 1, 30); // 19 сентября 01:30 локально (Москва, UTC+3)
        assert.equal(night.toISOString().slice(0, 10), '2026-09-18'); // старый способ ошибался
        assert.equal(toDateStr(night), '2026-09-19'); // новый — верно
    });

    it('formatDateShort не ломается на мусоре', () => {
        assert.equal(formatDateShort('nope'), 'nope');
        assert.ok(formatDateShort('2026-09-19').includes('19'));
    });

    it('weekRange — календарная неделя Пн–Вс', () => {
        assert.deepEqual(weekRange('2026-09-19'), { from: '2026-09-14', to: '2026-09-20' }); // суббота
        assert.deepEqual(weekRange('2026-09-14'), { from: '2026-09-14', to: '2026-09-20' }); // понедельник
        assert.deepEqual(weekRange('2026-09-20'), { from: '2026-09-14', to: '2026-09-20' }); // воскресенье
        assert.deepEqual(weekRange('2026-12-31'), { from: '2026-12-28', to: '2027-01-03' }); // через границу года
    });
});

describe('isoWeek', () => {
    // эталон — python isocalendar()
    const expected: Record<string, number> = {
        '2026-01-01': 1,
        '2026-09-19': 38,
        '2026-12-31': 53,
        '2027-01-01': 53,
        '2024-05-15': 20,
        '2025-12-29': 1,
        '2021-01-03': 53,
        '2026-01-05': 2,
    };

    for (const [date, week] of Object.entries(expected)) {
        it(`${date} — неделя ${week}`, () => {
            assert.equal(isoWeek(date), week);
        });
    }

    it('на мусоре возвращает 0', () => {
        assert.equal(isoWeek('bad'), 0);
    });
});

describe('monthGrid', () => {
    const sept = monthGrid(2026, 8); // сентябрь 2026: 1-е — вторник

    it('6 недель по 7 дней, неделя с понедельника', () => {
        assert.equal(sept.length, 6);
        assert.ok(sept.every((w) => w.length === 7));
        assert.equal(sept[0][0], '2026-08-31');
        assert.equal(sept[0][1], '2026-09-01');
        assert.equal(sept[5][6], '2026-10-11');
    });

    it('содержит все дни месяца и не повторяет дат', () => {
        assert.equal(sept.flat().filter((d) => d.startsWith('2026-09')).length, 30);
        assert.equal(new Set(sept.flat()).size, 42);
    });

    it('каждая строка — ровно одна ISO-неделя', () => {
        for (const week of sept) assert.equal(new Set(week.map((d) => isoWeek(d))).size, 1);
    });

    it('февраль, декабрь и переход через год', () => {
        const feb = monthGrid(2026, 1);
        assert.equal(feb[0][0], '2026-01-26');
        assert.equal(feb.flat().filter((d) => d.startsWith('2026-02')).length, 28);
        assert.equal(
            monthGrid(2026, 11)
                .flat()
                .filter((d) => d.startsWith('2026-12')).length,
            31,
        );
        assert.equal(monthGrid(2027, 0)[0][0], '2026-12-28');
    });
});

describe('plural', () => {
    it('склоняет по-русски', () => {
        const forms: [string, string, string] = ['задача', 'задачи', 'задач'];
        assert.deepEqual(
            [1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map((n) => plural(n, forms)),
            ['задача', 'задачи', 'задач', 'задач', 'задач', 'задача', 'задачи', 'задач', 'задача', 'задач'],
        );
    });
});
