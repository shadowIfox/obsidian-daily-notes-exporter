import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import * as S from '../../src/search';
import { mkHabit, mkMood, mkTask } from './factories';

const T = '2026-09-19';

describe('findRange и snippet', () => {
    it('ищет без учёта регистра и ё/е', () => {
        assert.deepEqual(S.findRange('Купить ЁЛКУ', 'елку'), [7, 11]);
        assert.deepEqual(S.findRange('Отчёт', 'ОТЧЕТ'), [0, 5]);
    });

    it('нет совпадения или пустой запрос — null', () => {
        assert.equal(S.findRange('abc', 'x'), null);
        assert.equal(S.findRange('abc', '  '), null);
    });

    it('snippet сокращает длинный текст с многоточиями, диапазон указывает на то же слово', () => {
        const long = 'Очень длинная заметка о том, как я ходила в поход и потеряла ключи от дома в лесу';
        const range = S.findRange(long, 'ключи')!;
        const sn = S.snippet(long, range, 10);
        assert.ok(sn.text.startsWith('…') && sn.text.endsWith('…'));
        assert.equal(sn.text.slice(sn.range[0], sn.range[1]), 'ключи');
    });

    it('snippet не трогает короткий текст', () => {
        const short = S.snippet('ключи тут', [0, 5]);
        assert.equal(short.text, 'ключи тут');
        assert.deepEqual(short.range, [0, 5]);
    });
});

describe('searchAll', () => {
    const tasks = [
        mkTask({ id: 't1', text: 'Купить молоко', category: 'Дом', date: '2026-09-25' }),
        mkTask({ id: 't2', text: 'Молоко для кота', category: 'Дом', date: '2026-09-20', completed: true }),
        mkTask({ id: 't3', text: 'Позвонить', category: 'Молоко (кухня)', date: '2026-09-21' }),
        mkTask({
            id: 't4',
            text: 'Отчёт',
            notes: 'Не забыть про МОЛОКО в отчёте по закупкам, очень важно уточнить количество у поставщика',
        }),
        mkTask({ id: 't5', text: 'Ничего общего' }),
        mkTask({ id: 't6', text: 'Молоко раньше', date: '2026-09-22' }),
    ];
    const habits = [mkHabit({ id: 'h1', text: 'Пить воду', dates: [T, '2026-09-18'] }), mkHabit({ id: 'h2', text: 'Вода и молоко' })];
    const mood = [
        mkMood('2026-09-10', 4, 'Выпила молока, хороший день'),
        mkMood('2026-09-18', 2, 'молоко закончилось'),
        mkMood('2026-09-01', 3),
    ];
    const data = { tasks, habits, mood };
    const ids = (hits: S.SearchHit[]) => hits.map((h) => h.id);

    it('задачи: невыполненные раньше, лучшее совпадение выше, выполненная в конце', () => {
        const r = S.searchAll('молоко', data);
        assert.deepEqual(ids(r.tasks), ['t6', 't1', 't3', 't4', 't2']);
        assert.equal(r.counts.tasks, 5);
        assert.equal(r.tasks.find((h) => h.id === 't2')!.done, true);
    });

    it('совпадение в категории подсвечивается в подписи, в заметках — показывается фрагмент', () => {
        const r = S.searchAll('молоко', data);
        assert.deepEqual(r.tasks.find((h) => h.id === 't3')!.subRange, [0, 6]);
        const notesHit = r.tasks.find((h) => h.id === 't4')!;
        assert.ok(notesHit.sub.includes('МОЛОКО'));
        assert.equal(notesHit.sub.slice(notesHit.subRange![0], notesHit.subRange![1]), 'МОЛОКО');
    });

    it('привычки и настроение', () => {
        const r = S.searchAll('молоко', data);
        assert.deepEqual(ids(r.habits), ['h2']);
        assert.equal(r.habits[0].sub, 'серия 0 дн.');
        assert.deepEqual(ids(r.mood), ['2026-09-18']); // «молока» ≠ «молоко»
        assert.equal(r.mood[0].rating, 2);
        assert.deepEqual(ids(S.searchAll('молок', data).mood), ['2026-09-18', '2026-09-10']); // свежие первыми
    });

    it('область поиска', () => {
        assert.equal(S.searchAll('молоко', data, 'tasks').habits.length, 0);
        assert.equal(S.searchAll('молоко', data, 'habits').tasks.length, 0);
        assert.equal(S.searchAll('молок', data, 'mood').mood.length, 2);
    });

    it('лимит выдачи не мешает счётчикам', () => {
        const many = Array.from({ length: 10 }, (_, i) => mkTask({ text: 'молоко ' + i }));
        const r = S.searchAll('молоко', { tasks: many, habits: [], mood: [] }, 'all', 3);
        assert.equal(r.tasks.length, 3);
        assert.equal(r.counts.tasks, 10);
    });

    it('пустой запрос и «ничего не найдено»', () => {
        assert.equal(S.searchAll('   ', data).counts.tasks, 0);
        assert.equal(S.searchAll('zzzz', data).counts.habits, 0);
    });

    it('HTML в запросе и данных — просто текст', () => {
        const r = S.searchAll('<b>', { tasks: [mkTask({ text: 'тег <b>жирный</b>' })], habits: [], mood: [] });
        assert.equal(r.tasks.length, 1);
    });
});
