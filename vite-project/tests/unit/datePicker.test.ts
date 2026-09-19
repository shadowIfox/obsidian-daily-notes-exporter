import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vitest';
import { enhanceDateInputs } from '../../src/datePicker';

const html = (attrs = '') => `
    <form id="f">
        <label for="d">Дата</label>
        <input id="d" type="date" class="input" ${attrs} />
    </form>`;

const input = () => document.getElementById('d') as HTMLInputElement;
const button = () => document.querySelector<HTMLButtonElement>('.datepick')!;
const panel = () => document.querySelector<HTMLElement>('.datepick__panel');
const day = (date: string) => document.querySelector<HTMLButtonElement>(`.datepick__day[data-date="${date}"]`)!;

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('datePicker', () => {
    it('прячет родное поле и показывает кнопку; повторный вызов ничего не дублирует', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        enhanceDateInputs();
        assert.equal(document.querySelectorAll('.datepick').length, 1);
        assert.ok(input().classList.contains('datepick__native'));
        assert.match(button().textContent ?? '', /Без даты/);
    });

    it('значение из кода (input.value = …) сразу видно на кнопке', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        input().value = '2026-09-19';
        assert.match(button().textContent ?? '', /19 сентября 2026/);
        assert.equal(input().value, '2026-09-19');
    });

    it('сброс формы возвращает кнопку к «Без даты»', async () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        input().value = '2026-09-19';
        (document.getElementById('f') as HTMLFormElement).reset();
        await new Promise((r) => setTimeout(r, 5));
        assert.match(button().textContent ?? '', /Без даты/);
    });

    it('открывается на месяце выбранной даты, выбор дня ставит значение, шлёт change и закрывает календарь', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        input().value = '2026-09-19';
        let changes = 0;
        input().addEventListener('change', () => changes++);

        button().click();
        assert.ok(panel());
        assert.match(panel()!.textContent ?? '', /сентябрь 2026/);
        assert.ok(day('2026-09-19').classList.contains('is-selected'));

        day('2026-09-18').click();
        assert.equal(input().value, '2026-09-18');
        assert.equal(changes, 1);
        assert.equal(panel(), null);
        assert.match(button().textContent ?? '', /18 сентября 2026/);
    });

    it('листает месяцы', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        input().value = '2026-09-19';
        button().click();
        panel()!.querySelector<HTMLElement>('[data-nav="1"]')!.click();
        assert.match(panel()!.textContent ?? '', /октябрь 2026/);
        panel()!.querySelector<HTMLElement>('[data-nav="-1"]')!.click();
        panel()!.querySelector<HTMLElement>('[data-nav="-1"]')!.click();
        assert.match(panel()!.textContent ?? '', /август 2026/);
    });

    it('дни позже max недоступны и не выбираются', () => {
        document.body.innerHTML = html('max="2026-09-19"');
        enhanceDateInputs();
        input().value = '2026-09-19';
        button().click();
        assert.equal(day('2026-09-20').disabled, true);
        day('2026-09-20').click();
        assert.equal(input().value, '2026-09-19');
        assert.ok(panel(), 'календарь остаётся открытым');
    });

    it('«Очистить» есть только у необязательных дат и убирает значение', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        input().value = '2026-09-19';
        button().click();
        assert.equal(panel()!.querySelector('[data-clear]'), null);
        button().click();

        document.body.innerHTML = html('data-clearable');
        enhanceDateInputs();
        input().value = '2026-09-19';
        let changes = 0;
        input().addEventListener('change', () => changes++);
        button().click();
        panel()!.querySelector<HTMLElement>('[data-clear]')!.click();
        assert.equal(input().value, '');
        assert.equal(changes, 1);
        assert.match(button().textContent ?? '', /Без даты/);
    });

    it('«Сегодня» выбирает сегодняшний день', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        button().click();
        panel()!.querySelector<HTMLElement>('[data-today]')!.click();
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        assert.equal(input().value, today);
    });

    it('Escape закрывает календарь и не доходит до окна под ним; клик снаружи тоже закрывает', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        let reachedModal = false;
        document.addEventListener('keydown', () => (reachedModal = true));

        button().click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(panel(), null);
        assert.equal(reachedModal, false);

        button().click();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        assert.equal(panel(), null);
    });

    it('стрелки двигают выбранный день, в том числе в соседний месяц', () => {
        document.body.innerHTML = html();
        enhanceDateInputs();
        input().value = '2026-09-30';
        button().click();
        day('2026-09-30').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert.match(panel()!.textContent ?? '', /октябрь 2026/);
        assert.equal(day('2026-10-01').tabIndex, 0);
        day('2026-10-01').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        assert.equal(day('2026-10-08').tabIndex, 0);
    });
});
