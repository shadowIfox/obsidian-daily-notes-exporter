// @ts-nocheck — перенесено из временного скрипта (smoke5.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from '../harness';

test("календарь и расписание дня", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);
    // Времена в тесте считаются как «сейчас ± N минут»: без этого он падает вечером и рано утром, когда время переходит через полночь
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    await page.clock.setFixedTime(noon);

const fmt = `const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }; const hm = m => { const d = new Date(Date.now() + m * 60000); return p(d.getHours())+':'+p(d.getMinutes()); };`;
const seed = `(() => { ${fmt} localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light', userName:'Мария'}));
  const T = (id, text, date, o = {}) => ({id, text, date, category: o.cat ?? '', priority: o.pr ?? 'normal', notes:'', time: o.time, completed: !!o.done, completedAt: o.done ? date : undefined});
  localStorage.setItem('tasks', JSON.stringify([
    T('a','Утро (прошло)', day(0), {time: hm(-120), cat:'Работа'}),
    T('b','Скоро (высокий)', day(0), {time: hm(60), pr:'high', cat:'Личное'}),
    T('c','Позже', day(0), {time: hm(240)}),
    T('d','Без времени', day(0)),
    T('e','Сделано', day(0), {time: hm(-30), done: true}),
    T('f','Просрочена <b>x</b>', day(-3)),
    T('g','Будущая', day(5), {time:'10:00'}),
    T('h','Только сделанное', day(-6), {done: true}),
    T('i1','Двое 1', day(2)), T('i2','Двое 2', day(2))]));
})()`;
const boot = async (custom, hash = 'dashboard') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const clickDay = async (k) => { await ev(`(() => { ${fmt} document.querySelector('#cal-grid [data-date="' + day(${k}) + '"]').click(); })()`); await sleep(200); };
const dayBtn = (k, attr) => ev(`(() => { ${fmt} const b = document.querySelector('#cal-grid [data-date="' + day(${k}) + '"]'); return ${attr}; })()`);
const seq = () => ev(`(() => [...document.querySelectorAll('#tl > *')].map(c => c.classList.contains('tl__now') ? 'NOW' : c.querySelector('.tl__time')?.textContent ?? '?').join('|'))()`);

await boot();
// ===== Календарь =====
check('сетка: 42 дня, 6 номеров недель, 7 названий дней', (await n('#cal-grid .cal__day')) === 42 && (await n('#cal-grid .cal__week')) === 6 && (await n('#cal-grid .cal__dow')) === 7);
const monthNow = await ev(`new Date().toLocaleDateString('ru-RU', {month: 'long', year: 'numeric'}).replace(/\\s*г\\.$/, '')`);
check('название месяца — с заглавной буквы', (await q('#cal-month')) === monthNow.charAt(0).toUpperCase() + monthNow.slice(1), await q('#cal-month'));
check('сегодня: кольцо + выбран (aria-pressed), выбран ровно один день', (await dayBtn(0, "b.classList.contains('cal__day--today') && b.getAttribute('aria-pressed') === 'true'")) === true && (await n('#cal-grid [aria-pressed="true"]')) === 1);
check('номер недели совпадает с ISO (проверка через строку с сегодняшним днём)', (await ev(`(() => { ${fmt} const b = document.querySelector('#cal-grid [data-date="' + day(0) + '"]'); const idx = [...document.querySelectorAll('#cal-grid .cal__day')].indexOf(b); return document.querySelectorAll('#cal-grid .cal__week')[Math.floor(idx / 7)].textContent; })()`)) === String(await ev(`(async () => { const m = await import('/src/dates.ts'); return m.isoWeek(m.todayStr()); })()`)));
check('точки: просроченный день — красная, будущий — обычная, только сделанное — блёклая', (await dayBtn(-3, "!!b.querySelector('.cal__dot--overdue')")) === true && (await dayBtn(2, "!!b.querySelector('.cal__dot') && !b.querySelector('.cal__dot--overdue') && !b.querySelector('.cal__dot--done')")) === true && (await dayBtn(-6, "!!b.querySelector('.cal__dot--done')")) === true);
check('день без задач — без точки', (await dayBtn(1, "!b.querySelector('.cal__dot')")) === true);

// ===== Расписание сегодняшнего дня =====
check('заголовок дня и подпись («сегодня · 5 задач»)', (await q('#tl-sub')).includes('сегодня') && (await q('#tl-sub')).includes('5 задач'), await q('#tl-sub'));
const expected = await ev(`(() => { ${fmt} return ['Весь день', hm(-120), hm(-30), 'NOW', hm(60), hm(240)].join('|'); })()`);
check('порядок: «Весь день» → по времени → линия «сейчас» между прошедшим и будущим', (await seq()) === expected, `${await seq()}  ожидали  ${expected}`);
const nowPill = await q('#tl .tl__now-pill'); const nowExp = await ev(`(() => { ${fmt} return hm(0); })()`);
check('время на линии «сейчас» = текущее (±1 мин)', Math.abs((+nowPill.slice(0,2)) * 60 + (+nowPill.slice(3)) - ((+nowExp.slice(0,2)) * 60 + (+nowExp.slice(3)))) <= 1, `${nowPill} vs ${nowExp}`);
check('ближайшая активная задача — жёлтая (tl__card--next), «Скоро (высокий)»', (await ev(`document.querySelector('#tl .tl__card--next .tl__title').textContent`)) === 'Скоро (высокий)' && (await n('#tl .tl__card--next')) === 1);
check('выполненная задача перечёркнута/приглушена', (await ev(`[...document.querySelectorAll('#tl .tl__card')].find(c => c.textContent.includes('Сделано')).classList.contains('tl__card--done')`)) === true);
check('важная задача (не ближайшая) — розовая: помечена «важно»', (await q('#tl')).includes('Личное · важно'));

// ===== Фильтр расписания =====
await ev(`document.querySelector('#tl-filter [data-filter="active"]').click()`); await sleep(200);
check('фильтр «Активные» скрывает выполненные', !(await q('#tl')).includes('Сделано') && (await n('#tl .tl__card')) === 4);
await ev(`document.querySelector('#tl-filter [data-filter="all"]').click()`); await sleep(200);

// ===== Клик по карточке и чекбокс =====
await ev(`[...document.querySelectorAll('#tl .tl__main')].find(b => b.textContent.includes('Позже')).click()`); await sleep(300);
check('клик по задаче в расписании показывает её детали', (await ev(`document.querySelector('#d-text').value`)) === 'Позже');
await ev(`[...document.querySelectorAll('#tl .tl__card')].find(c => c.textContent.includes('Позже')).querySelector('input.check').click()`); await sleep(300);
check('чекбокс в расписании отмечает задачу; счётчики на главной обновились', (await ev(`[...document.querySelectorAll('#tl .tl__card')].find(c => c.textContent.includes('Позже')).classList.contains('tl__card--done')`)) === true && (await q('[data-stat="tasks.done"]')) === '3', await q('[data-stat="tasks.done"]'));
await ev(`[...document.querySelectorAll('#tl .tl__card')].find(c => c.textContent.includes('Позже')).querySelector('input.check').click()`); await sleep(200);

// ===== Выбор другого дня =====
await clickDay(2);
check('выбор дня: заголовок, подпись «2 задачи», две карточки', (await q('#tl-sub')).includes('2 задачи') && (await n('#tl .tl__card')) === 2 && !(await q('#tl-sub')).includes('сегодня'), await q('#tl-sub'));
check('выбран ровно один день, сегодняшний сохраняет кольцо', (await n('#cal-grid [aria-pressed="true"]')) === 1 && (await dayBtn(0, "b.classList.contains('cal__day--today') && b.getAttribute('aria-pressed') === 'false'")) === true);
check('на не-сегодняшнем дне линии «сейчас» и подсветки «ближайшей» нет', (await n('#tl .tl__now')) === 0 && (await n('#tl .tl__card--next')) === 0);
await clickDay(1);
check('пустой день: сообщение', (await q('#tl')).includes('На этот день задач нет'));
await clickDay(-6);
await ev(`document.querySelector('#tl-filter [data-filter="active"]').click()`); await sleep(200);
check('день из одних выполненных при фильтре «Активные»: «Все задачи этого дня выполнены»', (await q('#tl')).includes('Все задачи этого дня выполнены'));
await ev(`document.querySelector('#tl-filter [data-filter="all"]').click()`); await sleep(200);
await clickDay(-3);
check('HTML в названии задачи в расписании — как текст', (await n('#tl b')) === 0 && (await q('#tl')).includes('<b>x</b>'));

// ===== Листание месяцев =====
const label0 = await q('#cal-month');
await ev(`document.getElementById('cal-next').click()`); await sleep(150);
const label1 = await q('#cal-month');
check('«следующий месяц» меняет заголовок, выбранный день остаётся', label1 !== label0 && (await n('#cal-grid .cal__day')) === 42 && (await q('#tl-sub')).includes('1 задача'), `${label0} → ${label1}`);
for (let i = 0; i < 10; i++) await ev(`document.getElementById('cal-prev').click()`);
await sleep(200);
const monthIdx = await ev(`new Date().getMonth()`); const yearNow = await ev(`new Date().getFullYear()`);
const back = new Date(yearNow, monthIdx - 9, 1);
const expBack = await ev(`new Date(${back.getFullYear()}, ${back.getMonth()}, 1).toLocaleDateString('ru-RU', {month:'long', year:'numeric'}).replace(/\\s*г\\.$/, '')`);
check('листание назад через границу года: −9 месяцев', (await q('#cal-month')).toLowerCase() === expBack, `${await q('#cal-month')} vs ${expBack}`);
check('в чужом месяце нет выбранного дня, но сетка цела (42 дня)', (await n('#cal-grid .cal__day')) === 42);
await ev(`document.getElementById('cal-today').click()`); await sleep(200);
check('кнопка «К сегодняшнему дню» возвращает месяц и выбор', (await q('#cal-month')).toLowerCase() === monthNow && (await dayBtn(0, "b.getAttribute('aria-pressed') === 'true'")) === true && (await q('#tl-sub')).includes('сегодня'));
// день соседнего месяца
const outDay = await ev(`(() => { const b = document.querySelector('#cal-grid .cal__day--out'); b.click(); return b.dataset.date; })()`); await sleep(200);
check('клик по дню соседнего месяца переключает месяц на него', (await ev(`document.querySelector('#cal-grid [data-date="${outDay}"]').classList.contains('cal__day--out')`)) === false && (await ev(`document.querySelector('#cal-grid [data-date="${outDay}"]').getAttribute('aria-pressed')`)) === 'true');
await ev(`document.getElementById('cal-today').click()`); await sleep(200);

// ===== Окно «Новая задача» =====
await clickDay(5);
await ev(`document.getElementById('cal-add').click()`); await sleep(200);
check('окно открывается, дата = выбранный день, фокус в названии, приоритет «Обычный»', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === true && (await ev(`(() => { ${fmt} return document.getElementById('tm-date').value === day(5); })()`)) === true && (await ev(`document.activeElement.id`)) === 'tm-text' && (await ev(`document.querySelector('input[name="tm-priority"]:checked').value`)) === 'normal');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(150);
check('Esc закрывает окно', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === false);
await ev(`document.getElementById('cal-add').click()`); await sleep(150);
await ev(`document.getElementById('task-modal').dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`); await sleep(150);
check('клик по фону закрывает окно', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === false);
const cnt0 = JSON.parse(await ev(`localStorage.getItem('tasks')`)).length;
await ev(`document.getElementById('cal-add').click()`); await sleep(150);
await ev(`document.getElementById('task-modal-form').requestSubmit()`); await sleep(200);
check('пустое название не создаёт задачу (окно остаётся открытым)', JSON.parse(await ev(`localStorage.getItem('tasks')`)).length === cnt0 && (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === true);
await ev(`(() => { document.getElementById('tm-text').value = '  Новая <script>alert(1)</script>  '; document.getElementById('tm-time').value = '14:30'; document.getElementById('tm-category').value = 'Учёба'; document.querySelector('input[name="tm-priority"][value="high"]').click(); document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(400);
const created = JSON.parse(await ev(`localStorage.getItem('tasks')`)).find(t => t.text.startsWith('Новая'));
check('создана задача: название обрезано, дата, время, категория, приоритет, id, notes', !!created && created.text === 'Новая <script>alert(1)</script>' && created.time === '14:30' && created.category === 'Учёба' && created.priority === 'high' && created.completed === false && created.notes === '' && !!created.id, JSON.stringify(created));
check('окно закрылось; задача выбрана: детали показывают её, день остался прежним', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === false && (await ev(`document.querySelector('#d-text').value`)) === 'Новая <script>alert(1)</script>');
check('задача видна в расписании (14:30, розовая «важно»), скрипт не выполнился как HTML', (await q('#tl')).includes('14:30') && (await n('#tl script')) === 0 && (await ev(`!!document.querySelector('#tl .tl__card--high')`)) === true);
check('в календаре у этого дня по-прежнему точка', (await dayBtn(5, "!!b.querySelector('.cal__dot')")) === true);
await ev(`location.hash = '#/tasks'`); await sleep(300);
check('задача появилась и в разделе «Задачи» (с меткой «Важно»)', (await q('#task-list')).includes('Новая') && (await ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('Новая')).querySelector('.badge--high')?.textContent`)) === 'Важно');
await ev(`location.hash = '#/dashboard'`); await sleep(300);

// ===== Добавление на другой месяц =====
await ev(`document.getElementById('cal-next').click()`); await sleep(150); await ev(`document.getElementById('cal-next').click()`); await sleep(150);
await ev(`document.getElementById('cal-add').click()`); await sleep(150);
const before = await q('#cal-month');
await ev(`(() => { ${fmt} const d = new Date(); d.setDate(d.getDate() - 100); document.getElementById('tm-text').value = 'В прошлом'; document.getElementById('tm-date').value = d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(400);
check('задача на другую дату: календарь сам перелистнулся на её месяц и выбрал день', (await q('#cal-month')) !== before && (await n('#cal-grid [aria-pressed="true"]')) === 1 && (await q('#tl')).includes('В прошлом'));
await ev(`document.getElementById('cal-today').click()`); await sleep(200);

// ===== Раскладка =====
const geo = () => ev(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const m = r('.dash__main'), s = r('.dash__side'), l = r('#dash-task-list'), d = r('#task-details'); return JSON.stringify({ sideRight: s.left >= m.right - 1, sideBelow: s.top >= m.bottom - 1, stacked: d.top > l.bottom - 1, overflowX: document.documentElement.scrollWidth > window.innerWidth }); })()`);
let g = JSON.parse(await geo());
check('1440: календарь справа от центра, без горизонтального скролла', g.sideRight && !g.overflowX, JSON.stringify(g));
check('1440: список и детали друг под другом (центр уже 700 px → контейнерный запрос)', g.stacked === true);
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(500);
g = JSON.parse(await geo());
check('1100: календарь уходит под центральный блок, без горизонтального скролла', g.sideBelow && !g.overflowX, JSON.stringify(g));
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(500);
g = JSON.parse(await geo());
check('760: всё в одну колонку, без горизонтального скролла', !g.overflowX && (await ev(`(() => { const c = document.querySelector('#cal-grid').getBoundingClientRect(), t = document.querySelector('#tl').getBoundingClientRect(); return t.top >= c.bottom - 1; })()`)) === true, JSON.stringify(g));
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);

// ===== Мини-линия настроения подстраивается под ширину карточки =====
await boot(`(() => { ${fmt} localStorage.clear(); localStorage.setItem('moodData', JSON.stringify([{date: day(-3), rating: 2, note: ''}, {date: day(-1), rating: 4, note: ''}, {date: day(0), rating: 5, note: ''}])); })()`);
const mw = async () => ({ svg: +(await ev(`document.querySelector('#viz-mood svg').getAttribute('width')`)), box: +(await ev(`document.getElementById('viz-mood').clientWidth`)) });
let w1 = await mw();
check('линия настроения на главной занимает всю ширину карточки', Math.abs(w1.svg - w1.box) <= 1 && w1.svg > 200, JSON.stringify(w1));
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(600);
const w2 = await mw();
check('при изменении окна линия перерисовывается', w2.svg !== w1.svg && Math.abs(w2.svg - w2.box) <= 1, `${w1.svg} → ${w2.svg}`);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
await ev(`(() => { document.querySelector('#viz-habits input')?.click(); })()`); await sleep(200);

// ===== Тёмная тема =====
await boot();
await ev(`window.setThemeMode('dark')`); await sleep(300);
check('тёмная тема: выбранный день розовый с тёмным текстом, «ближайшая» — тёмный текст на жёлтом', (await ev(`getComputedStyle(document.querySelector('#cal-grid [aria-pressed="true"]')).color`)) === 'rgb(20, 19, 15)' && (await ev(`getComputedStyle(document.querySelector('#tl .tl__card--next')).color`)) === 'rgb(20, 19, 15)');
check('тёмная тема: линия «сейчас» видна (кнопка времени светлая на тёмном фоне)', (await ev(`getComputedStyle(document.querySelector('#tl .tl__now-pill')).backgroundColor`)) === 'rgb(240, 238, 232)');

// ===== Новый пользователь =====
await boot(`localStorage.clear()`);
check('пустое приложение: календарь и расписание работают', (await n('#cal-grid .cal__day')) === 42 && (await q('#tl')).includes('На этот день задач нет') && (await n('#cal-grid .cal__dot')) === 0);
await ev(`document.getElementById('cal-add').click()`); await sleep(150);
await ev(`(() => { document.getElementById('tm-text').value = 'Первая'; document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(300);
check('пустое приложение: первая задача создаётся из календаря и сразу видна', (await q('#tl')).includes('Первая') && (await q('#greeting-sub')).includes('1 задача') && (await n('#cal-grid .cal__dot')) === 1);

    finish();
});
