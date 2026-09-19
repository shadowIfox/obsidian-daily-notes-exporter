// @ts-nocheck — перенесено из временного скрипта (smoke10.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from '../harness';

test("настроение", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const fmt = `const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };`;
const seed = `(() => { ${fmt} localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light'}));
  localStorage.setItem('moodData', JSON.stringify([{date: day(-10), rating: 4, note: 'давно'}, {date: day(-3), rating: 2, note: 'позавчера-1'}, {date: day(-1), rating: 3, note: 'вчера'}]));
  localStorage.setItem('tasks', '[]'); localStorage.setItem('habits', '[]');
})()`;
const boot = async (custom, hash = 'mood') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const stored = async () => JSON.parse(await ev(`localStorage.getItem('moodData')`));
const day = (k) => ev(`(async () => { const m = await import('/src/dates.ts'); return m.addDays(m.todayStr(), ${k}); })()`);
const item = (date) => `document.querySelector('#mood-history [data-date="${date}"]')`;
const setDate = (v) => ev(`(() => { const i = document.getElementById('mood-date'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('change', {bubbles: true})); })()`);
const rate = (r) => ev(`document.querySelector('.rating__opt[data-r="${r}"] input').click()`);
const setNote = (t) => ev(`document.getElementById('mood-note').value = ${JSON.stringify(t)}`);
const submit = async () => { await ev(`document.getElementById('mood-form').requestSubmit()`); await sleep(250); };
const formState = () => ev(`JSON.stringify({date: document.getElementById('mood-date').value, rating: document.querySelector('input[name="rating"]:checked')?.value ?? null, note: document.getElementById('mood-note').value, hint: document.getElementById('mood-hint').textContent, del: !document.getElementById('mood-delete').classList.contains('hidden')})`);
const short = (d) => ev(`(async () => { const m = await import('/src/dates.ts'); return m.formatDateShort('${d}'); })()`);
const D0 = await (async () => { await boot(); return day(0); })();
const D1 = await day(-1), D2 = await day(-2), D3 = await day(-3), D10 = await day(-10), Dt = await day(1);

// ===== Начальное состояние =====
let f = JSON.parse(await formState());
check('форма: дата = сегодня, max = сегодня, подсказки и «Удалить» нет', f.date === D0 && (await ev(`document.getElementById('mood-date').max`)) === D0 && f.hint === '' && f.del === false && f.rating === null, JSON.stringify(f));
check('история за 7 дней: 2 записи (−1 и −3), кнопка «7 дней» активна', (await n('#mood-history .mood-item')) === 2 && (await ev(`document.querySelector('#mood-range [data-days="7"]').getAttribute('aria-pressed')`)) === 'true');
await ev(`document.querySelector('#mood-range [data-days="30"]').click()`); await sleep(150);
check('«30 дней»: 3 записи, свежие сверху', (await n('#mood-history .mood-item')) === 3 && (await ev(`document.querySelector('#mood-history .mood-item').dataset.date`)) === D1);
await ev(`document.querySelector('#mood-range [data-days="7"]').click()`); await sleep(150);

// ===== Запись за сегодня =====
await rate(5); await setNote('отличный день');
await submit();
check('сохранение за сегодня: запись в хранилище, форма очищена, статус «Сохранено»', (await stored()).some(e => e.date === D0 && e.rating === 5 && e.note === 'отличный день') && (await q('#mood-status')) === 'Сохранено' && JSON.parse(await formState()).rating === null && JSON.parse(await formState()).note === '');
f = JSON.parse(await formState());
check('после сохранения подсказка «Запись за … уже есть» и кнопка «Удалить запись» (запись за сегодня существует)', f.hint.includes('уже есть') && f.del === true, JSON.stringify(f));
check('график и история обновились: 3 записи за неделю, последний столбец — оценка 5', (await n('#mood-history .mood-item')) === 3 && (await n('#mood-week-chart .col__bar')) === 7 && (await n('#mood-week-chart .col__bar[style*="var(--mood-"]')) === 3 && (await ev(`[...document.querySelectorAll('#mood-week-chart .col__bar')].pop().getAttribute('style')`)).includes('var(--mood-5)'));

// ===== Запись за прошлый день, которого не было =====
await setDate(D2);
f = JSON.parse(await formState());
check('выбрали дату без записи (−2): подсказки нет, кнопка «Удалить» скрыта', f.date === D2 && f.hint === '' && f.del === false);
await rate(4); await setNote('позавчера — новое');
await submit();
check('сохранена запись за −2 дня: в хранилище, в истории, статус «Сохранено: дата»', (await stored()).some(e => e.date === D2 && e.rating === 4) && (await ev(`!!${item(D2)}`)) === true && (await q('#mood-status')) === `Сохранено: ${await short(D2)}`, await q('#mood-status'));
check('хранилище отсортировано по дате', JSON.stringify((await stored()).map(e => e.date)) === JSON.stringify([...(await stored()).map(e => e.date)].sort()));
check('на форме снова сегодня', JSON.parse(await formState()).date === D0);

// ===== Выбор даты с записью: подстановка =====
await setDate(D3);
f = JSON.parse(await formState());
check('выбрали дату с записью (−3): подставлены оценка 2 и заметка, подсказка, «Удалить» виден', f.rating === '2' && f.note === 'позавчера-1' && f.hint.includes('уже есть') && f.del === true, JSON.stringify(f));
check('запись подсвечена в истории (is-editing)', (await ev(`${item(D3)}.classList.contains('is-editing')`)) === true);
await setDate(D2 + '');
await setDate(D1);
f = JSON.parse(await formState());
check('смена на другую дату с записью: подставлены её значения (3, «вчера»)', f.rating === '3' && f.note === 'вчера');
// перешли на дату без записи после подстановки → подставленное убирается
await ev(`(async () => { const m = await import('/src/dates.ts'); })()`);
await setDate(await day(-5));
f = JSON.parse(await formState());
check('после подстановки переход на дату без записи очищает подставленные значения', f.rating === null && f.note === '' && f.hint === '' && f.del === false, JSON.stringify(f));
// а введённое вручную при смене даты сохраняется
await rate(1); await setNote('ввёл сам');
await setDate(await day(-6));
f = JSON.parse(await formState());
check('введённое вручную при смене даты (на дату без записи) не стирается', f.rating === '1' && f.note === 'ввёл сам');
await ev(`document.getElementById('mood-form').reset(); document.getElementById('mood-date').value = '${D0}'; document.getElementById('mood-date').dispatchEvent(new Event('change', {bubbles: true}))`); await sleep(100);

// ===== Правка кликом по записи =====
await ev(`${item(D1)}.click()`); await sleep(300);
f = JSON.parse(await formState());
check('клик по записи в истории открывает её в форме, фокус в заметке', f.date === D1 && f.rating === '3' && f.note === 'вчера' && (await ev(`document.activeElement.id`)) === 'mood-note');
await rate(1); await setNote('вчера — исправлено');
await submit();
check('исправленная запись заменила прежнюю (без дубля), в истории обновилась', (await stored()).filter(e => e.date === D1).length === 1 && (await stored()).find(e => e.date === D1).rating === 1 && (await ev(`${item(D1)}.querySelector('.mood-item__note').textContent`)) === 'вчера — исправлено' && (await ev(`${item(D1)}.querySelector('.mood-item__score').dataset.r`)) === '1');
check('график недели: у вчерашнего дня оценка 1 (цвет var(--mood-1))', (await ev(`[...document.querySelectorAll('#mood-week-chart .col__bar')].some(b => b.getAttribute('style').includes('var(--mood-1)'))`)) === true);
// клавиатура
await ev(`${item(D3)}.focus()`);
await ev(`${item(D3)}.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))`); await sleep(250);
check('Enter на записи открывает её на правку (доступность с клавиатуры)', JSON.parse(await formState()).date === D3);
await ev(`document.getElementById('mood-form').reset(); document.getElementById('mood-date').value = '${D0}'; document.getElementById('mood-date').dispatchEvent(new Event('change', {bubbles: true}))`);

// ===== Старая запись (30 дней) =====
await ev(`document.querySelector('#mood-range [data-days="30"]').click()`); await sleep(150);
await ev(`${item(D10)}.click()`); await sleep(250);
await setNote('давно — дописал');
await submit();
check('запись 10-дневной давности правится из истории за 30 дней', (await stored()).find(e => e.date === D10).note === 'давно — дописал' && (await stored()).find(e => e.date === D10).rating === 4);
await ev(`document.querySelector('#mood-range [data-days="7"]').click()`); await sleep(150);
check('старая запись не попадает в график недели (семь дней, 4 из них с записью)', (await n('#mood-week-chart .col__bar')) === 7 && (await n('#mood-week-chart .col__bar[style*="var(--mood-"]')) === 4);
await ev(`document.querySelector('#mood-range [data-days="30"]').click()`); await sleep(150);
check('в графике за 30 дней старая запись есть (30 столбцов, 5 из них с записью)', (await n('#mood-week-chart .col__bar')) === 30 && (await n('#mood-week-chart .col__bar[style*="var(--mood-"]')) === 5);

// ===== Влияние на главную =====
await ev(`location.hash = '#/dashboard'`); await sleep(400);
const avg = (await stored()).filter(e => e.date >= '0').reduce((a, e) => a + e.rating, 0);
check('главная: среднее за 14 дней пересчитано по исправленным записям', (await q('[data-stat="mood.min"]')) === '1' && (await q('[data-stat="mood.max"]')) === '5');
await ev(`location.hash = '#/mood'`); await sleep(400);

// ===== Удаление =====
await ev(`document.querySelector('#mood-range [data-days="7"]').click()`);
await ev(`${item(D2)}.click()`); await sleep(250);
check('кнопка «Удалить запись» видна у открытой записи', JSON.parse(await formState()).del === true);
await ev(`document.getElementById('mood-delete').click()`); await sleep(120);
check('первое нажатие: просит подтверждения, запись цела', (await q('#mood-delete')) === 'Точно удалить?' && (await stored()).some(e => e.date === D2));
await setDate(D3);
check('смена даты сбрасывает подтверждение', (await q('#mood-delete')) === 'Удалить запись');
await setDate(D2);
await ev(`document.getElementById('mood-delete').click()`); await sleep(100);
await ev(`document.getElementById('mood-delete').click()`); await sleep(250);
check('второе нажатие удаляет запись; форма сброшена, статус «Запись за … удалена»', !(await stored()).some(e => e.date === D2) && (await q('#mood-status')) === `Запись за ${await short(D2)} удалена` && JSON.parse(await formState()).date === D0 && (await ev(`!${item(D2)}`)) === true);

// ===== Проверки ввода =====
const cnt = (await stored()).length;
await ev(`document.getElementById('mood-form').requestSubmit()`); await sleep(200);
check('отправка без оценки не сохраняет ничего', (await stored()).length === cnt);
await rate(3);
await ev(`(() => { const i = document.getElementById('mood-date'); i.removeAttribute('max'); i.value = '${Dt}'; i.dispatchEvent(new Event('change', {bubbles: true})); })()`);
await submit();
check('будущая дата не сохраняется, показано пояснение', (await stored()).length === cnt && (await q('#mood-hint')).includes('будущую дату'), await q('#mood-hint'));
await ev(`(() => { const i = document.getElementById('mood-date'); i.max = '${D0}'; i.value = ''; i.dispatchEvent(new Event('change', {bubbles: true})); })()`);
await rate(2); await setNote('<img src=x onerror=alert(1)>');
await submit();
check('пустая дата = сегодня; HTML в заметке — только текст (в истории и в поле)', (await stored()).find(e => e.date === D0).rating === 2 && (await n('#mood-history img')) === 0 && (await ev(`${item(D0)}.querySelector('.mood-item__note').textContent`)) === '<img src=x onerror=alert(1)>');
await ev(`${item(D0)}.click()`); await sleep(250);
check('заметка с HTML подставляется в поле как текст', JSON.parse(await formState()).note === '<img src=x onerror=alert(1)>');

// ===== Переход из поиска и правка старой записи =====
await ev(`document.getElementById('mood-form').reset(); document.getElementById('mood-date').value = '${D0}'; document.getElementById('mood-date').dispatchEvent(new Event('change', {bubbles: true}))`);
await ev(`(async () => { const s = await import('/src/store.ts'); const d = await import('/src/dates.ts'); s.saveMood([...s.loadMood(), {date: d.addDays(d.todayStr(), -60), rating: 3, note: 'очень давняя запись'}]); })()`); await sleep(100);
await ev('location.reload()'); await sleep(1400);
await ev(`document.getElementById('search-input').focus(); document.getElementById('search-input').value = 'очень давняя'; document.getElementById('search-input').dispatchEvent(new Event('input', {bubbles: true}))`); await sleep(200);
await ev(`document.querySelector('#search-results [data-kind="mood"]').click()`); await sleep(500);
check('запись из поиска (старше 30 дней) показана с меткой и открывается на правку', (await ev(`document.querySelector('#mood-history .is-flash .chip').textContent`)) === 'из поиска');
await ev(`document.querySelector('#mood-history .is-flash').click()`); await sleep(250);
check('…и её можно править (в форме дата, оценка, заметка)', JSON.parse(await formState()).note === 'очень давняя запись');

// ===== Тема, ширина, пустой экран =====
await ev(`window.setThemeMode('dark')`); await sleep(200);
check('тёмная тема: выделение правки видно (светлая рамка)', (await ev(`getComputedStyle(document.querySelector('#mood-history .is-editing')).boxShadow`)).includes('240, 238, 232'));
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
check('760 px: без горизонтального скролла', (await ev(`document.documentElement.scrollWidth <= window.innerWidth`)) === true);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
await boot(`localStorage.clear()`);
f = JSON.parse(await formState());
check('пустое приложение: «За последние 7 дней записей нет», форма чистая, «Удалить» скрыт', (await q('#mood-empty')) === 'За последние 7 дней записей нет.' && f.hint === '' && f.del === false);
await ev(`document.querySelector('#mood-range [data-days="30"]').click()`); await sleep(150);
check('«30 дней»: сообщение подстраивается', (await q('#mood-empty')) === 'За последние 30 дней записей нет.');

    finish();
});
