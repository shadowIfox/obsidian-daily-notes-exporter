// @ts-nocheck — перенесено из временного скрипта (smoke6.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from '../harness';

test("поиск и колокольчик", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const fmt = `const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }; const hm = m => { const d = new Date(Date.now() + m * 60000); return p(d.getHours())+':'+p(d.getMinutes()); };`;
const seed = `(() => { ${fmt} localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light', userName:'Мария'}));
  const T = (id, text, date, o = {}) => ({id, text, date, category: o.cat ?? '', priority:'normal', notes: o.notes ?? '', time: o.time, completed: !!o.done, completedAt: o.done ? date : undefined});
  const many = Array.from({length: 8}, (_, i) => T('f'+i, 'массовая '+i, day(4)));
  localStorage.setItem('tasks', JSON.stringify([
    T('a','Купить молоко', day(0), {time: hm(30), cat:'Дом'}),
    T('b','Молоко для кота', day(-2), {cat:'Дом'}),
    T('c','Отчёт', day(-5), {notes:'Не забыть про МОЛОКО в отчёте по закупкам, очень важно уточнить количество'}),
    T('d','Сделанное молоко', day(-1), {done: true}),
    T('e','<img src=x onerror=alert(1)> тест', day(3)), ...many]));
  localStorage.setItem('habits', JSON.stringify([{id:'h1', text:'Пить воду', dates:[day(-1)]}, {id:'h2', text:'Вода и молоко', dates:[]}, {id:'h3', text:'Зарядка', dates:[day(0)]}]));
  localStorage.setItem('moodData', JSON.stringify([{date: day(-12), rating: 4, note: 'Выпила молока в поход'}, {date: day(-1), rating: 3, note: 'молоко закончилось'}]));
})()`;
const boot = async (custom, hash = 'dashboard') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const hashNow = () => ev('location.hash');
const type = async (text) => { await ev(`(() => { const i = document.getElementById('search-input'); i.focus(); i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input', {bubbles: true})); })()`); await sleep(120); };
const key = (k, extra = {}) => ev(`document.getElementById('search-input').dispatchEvent(new KeyboardEvent('keydown', {key: ${JSON.stringify(k)}, bubbles: true, cancelable: true, ...${JSON.stringify(extra)}}))`);
const open = () => ev(`!document.getElementById('search-panel').hidden`);
const rowsText = () => ev(`[...document.querySelectorAll('#search-results .search__item')].map(r => r.querySelector('.search__title').textContent).join(' | ')`);
const sel = () => ev(`[...document.querySelectorAll('#search-results .search__item')].findIndex(r => r.getAttribute('aria-selected') === 'true')`);
const expectedBadge = await (async () => { await boot(); return ev(`new Date().getHours() >= 16 ? 4 : 3`); })();

// ===== Верхняя панель =====
check('дата в верхней панели заполнена сразу (и на главной)', /[а-я]+, \d+ [а-я]+/.test(await q('#today-label')), await q('#today-label'));
await boot(undefined, 'tasks');
check('дата заполнена, даже если открыть сразу раздел «Задачи» (раньше пропадала)', /[а-я]+, \d+ [а-я]+/.test(await q('#today-label')));
await boot();

// ===== Открытие поиска =====
check('панель поиска по умолчанию скрыта, подсказка про клавишу есть', (await open()) === false && ['⌘K', 'Ctrl K'].includes(await q('#search-kbd')));
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', metaKey: true, bubbles: true, cancelable: true}))`); await sleep(150);
check('⌘K фокусирует поиск и открывает панель с подсказкой', (await ev(`document.activeElement.id`)) === 'search-input' && (await open()) === true && (await q('#search-results')).includes('Введите название'));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(150);
check('Esc закрывает поиск и убирает фокус', (await open()) === false && (await ev(`document.activeElement.id`)) !== 'search-input');
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'K', ctrlKey: true, bubbles: true, cancelable: true}))`); await sleep(150);
check('Ctrl+K тоже открывает поиск', (await open()) === true);

// ===== Результаты =====
await type('молоко');
const groups = await ev(`[...document.querySelectorAll('#search-results .search__group')].map(g => g.textContent).join(' | ')`);
check('три группы: «Задачи · 4», «Привычки · 1», «Настроение · 1» (заметка «молока» не совпадает — это другая форма слова)', groups === 'Задачи · 4 | Привычки · 1 | Настроение · 1', groups);
check('порядок задач: невыполненные по совпадению, выполненная последней', (await rowsText()).startsWith('Молоко для кота | Купить молоко | Отчёт | Сделанное молоко'), await rowsText());
check('найденный фрагмент выделен <mark> (без учёта регистра), в заметках — фрагмент', (await ev(`[...document.querySelectorAll('#search-results mark')].every(m => m.textContent.toLowerCase() === 'молоко')`)) === true && (await q('#search-results [data-kind="task"]:nth-of-type(3) .search__sub')) !== null && (await ev(`[...document.querySelectorAll('#search-results .search__sub')].some(s => s.textContent.includes('МОЛОКО') && s.textContent.includes('…'))`)) === true);
check('выполненная задача перечёркнута в результатах', (await n('#search-results .search__item--done')) === 1);
check('первая строка выбрана, aria-activedescendant указывает на неё', (await sel()) === 0 && (await ev(`document.getElementById('search-input').getAttribute('aria-activedescendant')`)) === 'search-item-0');
await key('ArrowDown'); check('стрелка вниз двигает выбор', (await sel()) === 1);
await key('ArrowUp'); await key('ArrowUp');
check('стрелка вверх с первой строки переходит на последнюю (по кругу)', (await sel()) === (await n('#search-results .search__item')) - 1);

// ===== Области поиска =====
await ev(`document.querySelector('#search-scope [data-scope="tasks"]').click()`); await sleep(150);
check('область «Задачи»: только задачи, кнопка нажата', (await n('#search-results .search__group')) === 1 && (await n('#search-results [data-kind="habit"], #search-results [data-kind="mood"]')) === 0 && (await ev(`document.querySelector('#search-scope [data-scope="tasks"]').getAttribute('aria-pressed')`)) === 'true' && (await ev(`document.activeElement.id`)) === 'search-input');
await ev(`document.querySelector('#search-scope [data-scope="mood"]').click()`); await sleep(150);
check('область «Настроение»: только записи настроения, у строки цветная оценка', (await n('#search-results [data-kind="mood"]')) === 1 && (await ev(`document.querySelector('#search-results .pill--mood').style.background`)).includes('var(--mood-3)'));
await ev(`document.querySelector('#search-scope [data-scope="all"]').click()`); await sleep(150);

// ===== Обрезка длинных групп, «ничего не найдено» =====
await type('массовая');
check('группа длиннее 6: «показаны 6 из 8»', (await q('#search-results .search__group')) === 'Задачи · показаны 6 из 8' && (await n('#search-results .search__item')) === 6, await q('#search-results .search__group'));
await type('zzzz');
check('ничего не найдено: понятное сообщение со словом запроса', (await q('#search-results')).includes('Ничего не найдено по запросу «zzzz»'));
await key('Enter');
check('Enter без результатов ничего не ломает (остаёмся на месте)', (await hashNow()) === '#/dashboard' && (await open()) === true);

// ===== HTML в данных и в запросе =====
await type('img');
check('HTML в названии задачи — только текст (нет <img> в результатах, выделено «img»)', (await n('#search-results img')) === 0 && (await ev(`document.querySelector('#search-results mark').textContent`)) === 'img' && (await rowsText()).includes('<img src=x onerror=alert(1)>'));
await type('<script>');
check('«опасный» запрос — просто ничего не найдено, без ошибок', (await q('#search-results')).includes('Ничего не найдено') && (await n('#search-results script')) === 0);

// ===== Esc: сначала очищает запрос, потом закрывает =====
await key('Escape');
check('первый Esc очищает запрос (панель открыта)', (await ev(`document.getElementById('search-input').value`)) === '' && (await open()) === true);
await key('Escape');
check('второй Esc закрывает панель', (await open()) === false);
await type('молоко');
await ev(`document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`); await sleep(100);
check('клик вне поиска закрывает панель', (await open()) === false);

// ===== Переходы из результатов =====
await ev(`location.hash = '#/tasks'`); await sleep(300);
await type('молоко'); await key('Enter'); await sleep(500);
check('Enter по задаче: открывается главная, детали показывают «Молоко для кота»', (await hashNow()) === '#/dashboard' && (await ev(`document.querySelector('#d-text').value`)) === 'Молоко для кота', await hashNow());
check('…в календаре выбран день задачи, фильтр списка — «Просрочено», панель закрыта', (await ev(`(() => { ${fmt} return document.querySelector('#cal-grid [aria-pressed="true"]').dataset.date === day(-2); })()`)) === true && (await ev(`document.querySelector('#dash-list-filter [data-filter="overdue"]').classList.contains('is-active')`)) === true && (await open()) === false);
await type('вода');
await ev(`[...document.querySelectorAll('#search-results .search__item')].find(r => r.dataset.kind === 'habit' && r.textContent.includes('Вода и молоко')).click()`); await sleep(500);
check('клик по привычке: раздел «Привычки», найденная строка подсвечена (is-flash)', (await hashNow()) === '#/habits' && (await ev(`document.querySelector('#habit-list .is-flash .habit__name').textContent`)) === 'Вода и молоко');
await type('в поход');
await ev(`document.querySelector('#search-results [data-kind="mood"]').click()`); await sleep(500);
check('запись настроения старше недели: раздел «Настроение», запись показана и подсвечена с меткой «из поиска»', (await hashNow()) === '#/mood' && (await ev(`document.querySelector('#mood-history .is-flash .mood-item__note').textContent`)) === 'Выпила молока в поход' && (await ev(`document.querySelector('#mood-history .is-flash .chip').textContent`)) === 'из поиска');
await ev(`(() => { document.querySelector('.rating__opt[data-r="5"] input').click(); document.getElementById('mood-form').requestSubmit(); })()`); await sleep(300);
check('после сохранения новой записи «прикреплённая» старая запись убирается из истории', (await n('#mood-history [data-date]')) === 2 && !(await q('#mood-history')).includes('в поход'));

// ===== Колокольчик =====
await ev(`location.hash = '#/dashboard'`); await sleep(400);
await boot();
const badge = () => ev(`(() => { const b = document.getElementById('notif-badge'); return b.hidden ? 0 : +b.textContent; })()`);
check(`счётчик на колокольчике = ${expectedBadge} (просрочено, сегодня, привычки${expectedBadge === 4 ? ', настроение после 16:00' : ''})`, (await badge()) === expectedBadge, String(await badge()));
check('aria-label колокольчика содержит число', (await ev(`document.getElementById('notif-btn').getAttribute('aria-label')`)) === `Уведомления: ${expectedBadge}`);
await ev(`document.getElementById('notif-btn').click()`); await sleep(150);
const notices = await ev(`[...document.querySelectorAll('#notif-list .notice')].map(r => r.dataset.notice + ': ' + r.querySelector('.notice__title').textContent + ' — ' + r.querySelector('.notice__detail').textContent).join(' || ')`);
check('панель открыта, строки по одной на уведомление', (await ev(`!document.getElementById('notif-panel').hidden`)) === true && (await n('#notif-list .notice')) === expectedBadge, notices);
check('просроченные: самая старая задача указана первой (Отчёт)', notices.includes('overdue: Просрочено: 2 задачи — Отчёт и ещё 1'), notices);
check('привычки: «Привычек без отметки: 2 — Пить воду, Вода и молоко»', notices.includes('habits: Привычек без отметки: 2 — Пить воду, Вода и молоко'), notices);
check('на сегодня: ближайшая по времени с указанием часа', /today: На сегодня: 1 задача — Ближайшая в \d\d:\d\d — Купить молоко/.test(notices), notices);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(150);
check('Esc закрывает панель, фокус возвращается на колокольчик', (await ev(`document.getElementById('notif-panel').hidden`)) === true && (await ev(`document.activeElement.id`)) === 'notif-btn');
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
await ev(`document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`); await sleep(100);
check('клик вне панели закрывает её', (await ev(`document.getElementById('notif-panel').hidden`)) === true);
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
await ev(`document.getElementById('search-input').focus()`); await sleep(100);
check('открытие поиска закрывает уведомления (одна панель за раз)', (await ev(`document.getElementById('notif-panel').hidden`)) === true && (await open()) === true);
await ev(`document.getElementById('search-input').blur(); document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`);

// переходы из уведомлений
await ev(`location.hash = '#/settings'`); await sleep(300);
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
await ev(`document.querySelector('#notif-list [data-notice="overdue"]').click()`); await sleep(500);
check('клик по «Просрочено»: главная, открыта самая старая задача (Отчёт), панель закрыта', (await hashNow()) === '#/dashboard' && (await ev(`document.querySelector('#d-text').value`)) === 'Отчёт' && (await ev(`document.getElementById('notif-panel').hidden`)) === true);
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
await ev(`document.querySelector('#notif-list [data-notice="habits"]').click()`); await sleep(400);
check('клик по «Привычки без отметки»: раздел «Привычки»', (await hashNow()) === '#/habits');
if (expectedBadge === 4) {
  await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
  await ev(`document.querySelector('#notif-list [data-notice="mood"]').click()`); await sleep(400);
  check('клик по «Настроение не записано»: раздел «Настроение»', (await hashNow()) === '#/mood');
}
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
await ev(`location.hash = '#/analytics'`); await sleep(300);
check('при смене раздела панель уведомлений закрывается', (await ev(`document.getElementById('notif-panel').hidden`)) === true);

// счётчик живой: меняем данные через хранилище (как это делает интерфейс)
await ev(`location.hash = '#/dashboard'`); await sleep(300);
const before = await badge();
await ev(`(async () => { const m = await import('/src/store.ts'); ${fmt} m.saveHabits(m.loadHabits().map(h => ({...h, dates: [...new Set([...h.dates, day(0)])]}))); })()`); await sleep(200);
check('счётчик уменьшается, когда отмечены все привычки', (await badge()) === before - 1, `${before} → ${await badge()}`);
await ev(`(async () => { const m = await import('/src/store.ts'); m.saveTasks(m.loadTasks().map(t => ({...t, completed: true}))); })()`); await sleep(200);
await ev(`(async () => { const m = await import('/src/store.ts'); ${fmt} m.saveMood([...m.loadMood(), {date: day(0), rating: 4, note: ''}]); })()`); await sleep(200);
check('когда всё сделано — значок скрыт', (await ev(`document.getElementById('notif-badge').hidden`)) === true);
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
check('пустая панель: «Всё спокойно — напоминаний нет»', (await q('#notif-list')).includes('Всё спокойно'));
await ev(`document.getElementById('notif-btn').click()`);
await ev(`(async () => { const m = await import('/src/store.ts'); ${fmt} m.saveTasks([...m.loadTasks(), {id:'zz', text:'Новая просроченная', date: day(-1), category:'', priority:'normal', notes:'', completed:false}]); })()`); await sleep(200);
check('новая просроченная задача сразу появляется на счётчике', (await badge()) === 1);
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
check('и в открытой панели список обновляется на лету', (await q('#notif-list')).includes('Просрочено: 1 задача'));
await ev(`document.getElementById('notif-btn').click()`);

// ===== Раскладка =====
const geo = () => ev(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const s = r('#search'); const d = document.getElementById('today-label'); return JSON.stringify({ searchW: Math.round(s.width), dateShown: getComputedStyle(d).display !== 'none', overflowX: document.documentElement.scrollWidth > window.innerWidth }); })()`);
let g = JSON.parse(await geo());
check('1440: поиск не шире 600 px, дата видна, без горизонтального скролла', g.searchW <= 600 && g.searchW > 250 && g.dateShown && !g.overflowX, JSON.stringify(g));
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
g = JSON.parse(await geo());
check('1100: дата скрыта, поиск занимает освободившееся место', !g.dateShown && !g.overflowX, JSON.stringify(g));
await type('молоко');
check('1100: панель результатов не вылезает за окно', (await ev(`(() => { const r = document.getElementById('search-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; })()`)) === true);
await ev(`document.getElementById('notif-btn').click()`); await sleep(100);
check('1100: панель уведомлений тоже в пределах окна', (await ev(`(() => { const r = document.getElementById('notif-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; })()`)) === true);
await ev(`document.getElementById('notif-btn').click()`);
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
g = JSON.parse(await geo());
check('760: без горизонтального скролла', !g.overflowX, JSON.stringify(g));
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);

// ===== Тёмная тема =====
await boot();
await ev(`window.setThemeMode('dark')`); await sleep(200);
await type('молоко');
check('тёмная тема: выделение — тёмный текст на жёлтом, панель тёмная', (await ev(`getComputedStyle(document.querySelector('#search-results mark')).color`)) === 'rgb(20, 19, 15)' && (await ev(`getComputedStyle(document.getElementById('search-panel')).backgroundColor`)) === 'rgb(26, 26, 33)');
await ev(`document.getElementById('search-input').blur(); document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`);

// ===== Новый пользователь =====
await boot(`localStorage.clear()`);
check('пустое приложение: значок скрыт, при открытии — «Всё спокойно»', (await badge()) === 0 || (new Date().getHours() >= 16 && (await badge()) === 1));
await type('что-нибудь');
check('пустое приложение: поиск отвечает «Ничего не найдено»', (await q('#search-results')).includes('Ничего не найдено'));

    finish();
});
