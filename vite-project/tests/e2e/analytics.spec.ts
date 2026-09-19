// @ts-nocheck — перенесено из временного скрипта (smoke4.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from './harness';

test("аналитика", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const fmt = `const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };`;
// Небольшой детерминированный набор: понятные числа для проверки
const seed = `(() => { ${fmt} localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light', userName:'Мария'}));
  const T = (id, text, date, cat, completedAt) => ({id, text, date, category: cat, priority:'normal', notes:'', completed: !!completedAt, completedAt});
  localStorage.setItem('tasks', JSON.stringify([
    T('a','A', day(0),  'Работа', day(0)),      // в срок
    T('b','B', day(-1), 'Работа', day(0)),      // с опозданием
    T('c','C', day(-2), '<b>Дом</b>', day(-2)), // в срок
    T('d','D', day(-3), '',       day(-3)),     // в срок, без категории
    T('e','E', day(-20),'Работа', day(-20)),    // только в 30/91 днях
    T('f','F', day(-50),'Учёба',  day(-50)),    // только в 91 день
    T('g','G', day(-9), 'Работа', day(-9)),     // предыдущее окно 7 дней (−13…−7)
    T('x','Активная', day(-1), 'Работа', null)]));
  localStorage.setItem('habits', JSON.stringify([
    {id:'h1', text:'Зарядка <i>x</i>', dates:[day(0), day(-1), day(-2), day(-3)]},
    {id:'h2', text:'Чтение', dates:[day(-1)]}]));
  const m = (k, r, note) => ({date: day(k), rating: r, note: note || ''});
  localStorage.setItem('moodData', JSON.stringify([m(0,5,'заметка <u>дня</u>'), m(-1,3), m(-2,4), m(-3,2), m(-5,4), m(-8,1), m(-25,3)]));
})()`;
const boot = async (custom) => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/analytics' }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const period = async (d) => { await ev(`document.querySelector('#analytics-period [data-days="${d}"]').click()`); await sleep(500); };
const kpi = async () => JSON.parse(await ev(`JSON.stringify(Object.fromEntries([...document.querySelectorAll('[data-kpi]')].map(e => [e.dataset.kpi, e.textContent])))`));
const hover = async (sel, idx = 0) => { await ev(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${idx}]; el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true, clientX: 300, clientY: 300})); })()`); await sleep(100); return { text: await q('.tooltip'), hidden: await ev(`document.querySelector('.tooltip').hidden`) }; };

await boot();
check('старых чёрных линий нет: в приложении не осталось <canvas>', (await n('canvas')) === 0);
check('страница аналитики открыта, период по умолчанию — 30 дней (aria-pressed)', (await ev(`document.querySelector('#analytics-period [data-days="30"]').getAttribute('aria-pressed')`)) === 'true' && (await q('#analytics-sub')).includes('30 дней'));

// ===== Итоговые карточки: период 30 дней =====
let k = await kpi();
check('30 дней: выполнено 6 (A,B,C,D,E,G)', k.tasks === '6', JSON.stringify(k));
check('30 дней: «в срок» 5 из 6 с дедлайном = 83% (B опоздала)', k.ontime === '83%' && (await q('[data-kpi-note="ontime"]')).includes('5 из 6'), k.ontime + ' / ' + await q('[data-kpi-note="ontime"]'));
check('30 дней: настроение — среднее 3.1 (5,3,4,2,4,1,3 → 22/7)', k.mood === '3.1', k.mood);
check('30 дней: привычки — 5 отметок из 60 = 8%', k.habits === '8%', k.habits);

// ===== 7 дней =====
await period(7); k = await kpi();
check('7 дней: выполнено 4, изменение к прошлому периоду «↑ +3» (в прошлом окне 1: G)', k.tasks === '4' && (await q('[data-kpi-note="tasks"]')).includes('+3'), k.tasks + ' / ' + await q('[data-kpi-note="tasks"]'));
check('7 дней: 7 столбцов по дням, подписи Пн…Вс', (await n('#an-tasks-days .col')) === 7 && (await n('#an-tasks-days .col__label:not(:empty)')) === 7);
check('7 дней: самый большой столбец — акцентный (один)', (await n('#an-tasks-days .col__bar--accent')) === 1);
check('7 дней: тепловая карта — 2 строки × 7 ячеек', (await n('#an-habits .heat__row')) === 2 && (await n('#an-habits .heat__cell')) === 14);
check('7 дней: жёсткие данные тепловой карты (Зарядка 4/7 = 57%, Чтение 1/7 = 14%)', (await ev(`[...document.querySelectorAll('#an-habits .heat__value')].map(e => e.textContent).join(',')`)) === '57%,14%');
check('7 дней: на линии настроения 5 точек (0, −1, −2, −3, −5)', (await n('#an-mood-line circle')) === 5, String(await n('#an-mood-line circle')));
check('7 дней: кольцо — 4 сегмента (оценки 5,4,3,2), легенда из 5 строк', (await n('#an-mood-donut .donut__seg')) === 4 && (await n('#an-mood-donut .legend__row')) === 5);

// ===== 3 месяца =====
await period(91); k = await kpi();
check('3 месяца: выполнено 7 (добавляется F), столбцы по неделям — 13', k.tasks === '7' && (await n('#an-tasks-days .col')) === 13, k.tasks + ' / ' + await n('#an-tasks-days .col'));
check('3 месяца: тепловая карта по неделям — 13 ячеек на привычку', (await n('#an-habits .heat__cell')) === 26);
check('3 месяца: подпись периода', (await q('#analytics-sub')).includes('3 месяца'));
await period(30);

// ===== Категории и HTML =====
check('категории: «Работа» первой со значением 4, «<b>Дом</b>» показан как текст', (await ev(`document.querySelector('#an-categories .hbar__label').textContent`)) === 'Работа' && (await n('#an-categories b')) === 0 && (await q('#an-categories')).includes('<b>Дом</b>'));
check('тепловая карта: <i> в названии привычки экранирован', (await n('#an-habits i')) === 0 && (await q('#an-habits')).includes('Зарядка <i>x</i>'));
check('наблюдения: HTML в названиях не рендерится, есть текст про «Зарядка»', (await n('#an-insights i')) === 0 && (await q('#an-insights')).includes('«Зарядка <i>x</i>»'));

// ===== Подсказки =====
let t = await hover('#an-tasks-days .col', 29);
check('подсказка на столбце показывает дату и значение', !t.hidden && t.text.endsWith('сент.: 2'), JSON.stringify(t));
t = await hover('#an-mood-line circle', (await n('#an-mood-line circle')) - 1);
check('подсказка на точке настроения: дата, оценка, заметка (HTML — как текст)', !t.hidden && t.text === '19 сент.: 5 — заметка <u>дня</u>' || (!t.hidden && t.text.endsWith('заметка <u>дня</u>') && (await n('.tooltip u')) === 0), JSON.stringify(t));
t = await hover('#an-mood-donut .donut__seg', 0);
check('подсказка на сегменте кольца', !t.hidden && /: \d+$/.test(t.text), JSON.stringify(t));
await ev(`document.body.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}))`); await sleep(100);
check('подсказка скрывается, когда курсор уходит с элемента', (await ev(`document.querySelector('.tooltip').hidden`)) === true);

// ===== Цвета и тема (никакого «чёрного» вне темы) =====
const barColor = () => ev(`getComputedStyle(document.querySelector('#an-tasks-days .col__bar:not(.col__bar--accent)')).backgroundColor`);
check('светлая тема: столбцы тёмные (--ink)', (await barColor()) === 'rgb(20, 19, 15)', await barColor());
await ev(`window.setThemeMode('dark')`); await sleep(300);
check('тёмная тема: столбцы светлые, без перерисовки JS (чистый CSS)', (await barColor()) === 'rgb(240, 238, 232)', await barColor());
check('базовая линия столбцов — полупрозрачная --border, не чёрная', (await ev(`getComputedStyle(document.querySelector('#an-tasks-days .col__track')).borderBottomColor`)).includes('0.09'), await ev(`getComputedStyle(document.querySelector('#an-tasks-days .col__track')).borderBottomColor`));
await ev(`window.setThemeMode('light')`); await sleep(200);
check('точки настроения красятся палитрой --mood-N', (await ev(`document.querySelector('#an-mood-line circle').getAttribute('style')`)).includes('var(--mood-'));

// ===== Адаптивность линии настроения =====
const w1 = await ev(`document.querySelector('#an-mood-line svg').getAttribute('width')`);
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(600);
const w2 = await ev(`document.querySelector('#an-mood-line svg').getAttribute('width')`);
check('линия настроения перерисовывается под ширину окна', Number(w2) < Number(w1) && Number(w2) > 100, `${w1} → ${w2}`);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);

// ===== Советы =====
const before = await q('#an-advice');
check('три совета с текстом', (await n('#an-advice .advice-row')) === 3 && (await ev(`[...document.querySelectorAll('#an-advice .advice-row__text')].every(e => e.textContent.length > 8)`)) === true);
await ev(`document.getElementById('an-advice-refresh').click()`); await sleep(200);
check('«Другие советы» перерисовывает блок без ошибок', (await n('#an-advice .advice-row')) === 3);

// ===== Повторные заходы и смена периода не копят обработчики =====
for (let i = 0; i < 4; i++) { await ev(`location.hash = '#/tasks'`); await sleep(100); await ev(`location.hash = '#/analytics'`); await sleep(150); }
await period(7);
check('после повторных заходов один клик по периоду — одна перерисовка (7 столбцов, не задвоено)', (await n('#an-tasks-days .col')) === 7 && (await n('#analytics-section .kpi')) === 4);

// ===== Страница «Привычки» и «Настроение» =====
await ev(`location.hash = '#/habits'`); await sleep(400);
check('«Привычки»: серии — полосы с числами (Зарядка 4 дн., Чтение 0)', (await ev(`[...document.querySelectorAll('#habit-streaks .hbar__value')].map(e => e.textContent).join(',')`)) === '4 дн.,0 дн.' && (await n('#habit-streaks .hbar')) === 2);
await ev(`document.querySelectorAll('#habit-list .check')[1].click()`); await sleep(300);
check('«Привычки»: после отметки график обновился (Чтение: сегодня + вчера = 2 дн.)', (await ev(`[...document.querySelectorAll('#habit-streaks .hbar__value')].map(e => e.textContent).join(',')`)) === '4 дн.,2 дн.');
await ev(`location.hash = '#/mood'`); await sleep(400);
const moodCols = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#mood-week-chart .col__bar')].map(b => b.style.background || b.getAttribute('style')))`));
check('«Настроение»: 6 столбцов за неделю (0, −1, −2, −3, −5), цвет по оценке', moodCols.length === 5 && moodCols[moodCols.length - 1].includes('var(--mood-5)') && moodCols[0].includes('var(--mood-'), JSON.stringify(moodCols));
await ev(`(() => { document.querySelector('.rating__opt[data-r="1"] input').click(); document.getElementById('mood-form').requestSubmit(); })()`); await sleep(300);
check('«Настроение»: сохранение обновляет график (последний столбец — оценка 1)', (await ev(`[...document.querySelectorAll('#mood-week-chart .col__bar')].pop().getAttribute('style')`)).includes('var(--mood-1)'));

// ===== Пустое приложение =====
await boot(`localStorage.clear()`);
check('пустое приложение: карточки без данных', (await kpi()).tasks === '0' && (await kpi()).mood === '—' && (await kpi()).habits === '—' && (await kpi()).ontime === '—');
check('пустое приложение: во всех блоках понятные сообщения, графики не рисуются', (await n('#analytics-section .viz__empty')) >= 5, String(await n('#analytics-section .viz__empty')));
check('пустое приложение: наблюдения и советы с подсказками', (await q('#an-insights')).includes('Пока мало данных') && (await q('#an-advice')).includes('Добавьте'));
await ev(`location.hash = '#/habits'`); await sleep(300);
check('пустое приложение: «Привычки» — подсказка вместо графика', (await q('#habit-streaks')).includes('Добавьте привычку'));
await ev(`location.hash = '#/mood'`); await sleep(300);
check('пустое приложение: «Настроение» — подсказка вместо графика', (await q('#mood-week-chart')).includes('записей нет'));

    finish();
});
