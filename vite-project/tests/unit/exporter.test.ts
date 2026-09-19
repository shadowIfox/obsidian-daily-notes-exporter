import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildExport } from '../../src/exporter';
import { seed } from './seed';

const T = '2026-09-19';

describe('экспорт: Markdown / CSV / PDF-HTML', () => {
    describe('на данных, которые раньше давали «undefined»', () => {
        const fill = () => {
            seed.tasks([
                { id: 'a', text: 'Сделать "отчёт", срочно', date: T, category: 'Учёба', completed: true, completedAt: T },
                { id: 'b', text: 'Старая', date: '2026-08-01', category: '', completed: false },
                { id: 'c', text: 'Без даты', date: '', category: '', completed: false },
            ]);
            seed.habits([{ id: 'h', text: 'Зарядка', dates: [T, '2026-09-18', '2026-08-01'] }]);
            seed.mood([{ date: T, rating: 4, note: 'ок, <b>да</b>' }, { date: '2026-08-01', rating: 2, note: '' }]);
        };

        it('неделя в Markdown', () => {
            fill();
            const md = buildExport({ period: 'week', category: 'all', format: 'md' }, T);
            assert.ok(!md.content.includes('undefined'));
            assert.ok(md.content.includes('- [x] Сделать "отчёт", срочно (Учёба)'));
            assert.ok(md.content.includes('Зарядка: 2/7 дней'));
            assert.ok(!md.content.includes('Старая') && md.content.includes('Без даты'));
            assert.ok(!md.content.includes('2026-08-01'));
        });

        it('CSV: BOM и экранирование кавычек и запятых', () => {
            fill();
            const csv = buildExport({ period: 'month', category: 'tasks', format: 'csv' }, T);
            assert.ok(csv.content.startsWith('﻿'));
            assert.ok(csv.content.includes('"Сделать ""отчёт"", срочно"'));
        });

        it('PDF (HTML): заметка экранируется', () => {
            fill();
            const html = buildExport({ period: 'day', category: 'mood', format: 'pdf' }, T).content;
            assert.ok(html.includes('&lt;b&gt;да&lt;/b&gt;') && !html.includes('<b>да</b>'));
        });

        it('привычка без отметок за день всё равно выводится (0/1)', () => {
            fill();
            assert.equal(buildExport({ period: 'day', category: 'habits', format: 'md' }, '2026-01-01').content.includes('Нет данных'), false);
        });
    });

    it('только активные привычки и дни по графику', () => {
        seed.habits([
            { id: 'v', text: 'Вт Чт', dates: ['2026-09-15', '2026-09-17', '2026-09-18'], days: [1, 3] },
            { id: 'z', text: 'Архивная', dates: [T], archived: true },
        ]);
        seed.tasks([]);
        seed.mood([]);
        const md = buildExport({ period: 'week', category: 'habits', format: 'md' }, T).content;
        assert.ok(md.includes('Вт Чт: 2/2 дней'), md); // 2 дня по графику, оба отмечены; пятница не в счёт
        assert.ok(!md.includes('Архивная'));
    });

    describe('задачи со временем, приоритетом и заметками', () => {
        const task = (o: Record<string, unknown>) => ({ text: 'т', date: '', category: '', priority: 'normal', notes: '', completed: false, ...o });
        const fill = () => {
            seed.tasks([
                task({ id: 'a', text: 'Звонок', date: T, time: '14:30', category: 'Работа', priority: 'high', notes: 'строка 1\nстрока "2"' }),
                task({ id: 'b', text: 'Обычная', date: T }),
                task({ id: 'c', text: 'Потом', date: T, priority: 'low', completed: true, completedAt: T }),
            ]);
            seed.habits([]);
            seed.mood([]);
        };

        it('Markdown', () => {
            fill();
            const md = buildExport({ period: 'day', category: 'tasks', format: 'md' }, T).content;
            assert.ok(md.includes('- [ ] 14:30 Звонок (Работа) — важно\n  > строка 1\n  > строка "2"\n'), md);
            assert.ok(md.includes('- [ ] Обычная\n')); // без лишних пометок
            assert.ok(md.includes('- [x] Потом — низкий приоритет\n'));
        });

        it('CSV', () => {
            fill();
            const csv = buildExport({ period: 'day', category: 'tasks', format: 'csv' }, T).content;
            assert.ok(csv.includes('"Дата","Время","Задача","Категория","Приоритет","Статус","Заметка"'));
            assert.ok(csv.includes('"2026-09-19","14:30","Звонок","Работа","высокий","не выполнено","строка 1\nстрока ""2"""'), csv);
            assert.ok(csv.includes('"2026-09-19","","Обычная","","обычный","не выполнено",""'));
        });

        it('PDF (HTML)', () => {
            fill();
            const html = buildExport({ period: 'day', category: 'tasks', format: 'pdf' }, T).content;
            assert.ok(html.includes('14:30 Звонок (Работа) — важно') && html.includes('&quot;2&quot;'));
        });

        it('HTML и скрипты в названии и заметке не попадают в документ как разметка', () => {
            seed.tasks([task({ id: 'x', text: '<b>x</b>', date: T, notes: '<script>alert(1)</script>' })]);
            seed.habits([]);
            seed.mood([]);
            const html = buildExport({ period: 'day', category: 'tasks', format: 'pdf' }, T).content;
            assert.ok(!html.includes('<script>alert') && !html.includes('<b>x</b>'));
        });
    });
});
