// @ts-nocheck — перенесено из временного скрипта (smoke9.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from './harness';

test("привычки", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const fmt = `const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }; const idx = (new Date().getDay() + 6) % 7;`;
const seed = `(() => { ${fmt} localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light'}));
  localStorage.setItem('habits', JSON.stringify([
    {id:'h1', text:'Зарядка', dates:[day(0), day(-1), day(-2)]},
    {id:'h2', text:'<b>Йога</b>', dates:[], days:[idx]},                       // сегодня по графику, не отмечена
    {id:'h3', text:'Не сегодня', dates:[], days:[(idx+1)%7]},                  // сегодня не по графику
    {id:'h4', text:'Старая привычка', dates:[day(-3), day(-4)], archived: true}]));
  localStorage.setItem('tasks', '[]'); localStorage.setItem('moodData', '[]');
})()`;
const boot = async (custom, hash = 'habits') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const stored = async () => JSON.parse(await ev(`localStorage.getItem('habits')`));
const rowOf = (name) => `[...document.querySelectorAll('#habit-list .habit')].find(li => li.querySelector('.habit__name').textContent.startsWith(${JSON.stringify(name)}))`;
const modalOpen = (id) => ev(`document.getElementById('${id}').classList.contains('is-open')`);
const esc = () => send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
const setv = (sel, v) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', {bubbles: true})); })()`);
const today = await (async () => { await boot(); return ev(`(async () => { const m = await import('/src/dates.ts'); return m.todayStr(); })()`); })();
const dayAgo = (k) => ev(`(async () => { const m = await import('/src/dates.ts'); return m.addDays(m.todayStr(), ${k}); })()`);

// ===== Список и архив =====
check('в списке только активные (3), архивная — отдельно', (await n('#habit-list .habit')) === 3 && (await n('#habit-archive-list .archive-row')) === 1 && (await ev(`!document.getElementById('habit-archive-card').classList.contains('hidden')`)) === true);
check('график показан у привычки: «<b>Йога</b>» — текстом, чип с днём недели', (await n('#habit-list b')) === 0 && (await ev(`${rowOf('<b>Йога</b>')}.querySelector('.chip--mini') !== null`)) === true);
check('у привычки на каждый день чипа графика нет', (await ev(`${rowOf('Зарядка')}.querySelector('.chip--mini')`)) === null);
check('привычка не по графику сегодня: помечена и приглушена', (await ev(`${rowOf('Не сегодня')}.classList.contains('habit--rest') && ${rowOf('Не сегодня')}.textContent.includes('сегодня не по графику')`)) === true);

// ===== Точки — отметка прошлых дней =====
check('7 точек-кнопок у каждой привычки, у Зарядки три отмечены (aria-pressed)', (await ev(`${rowOf('Зарядка')}.querySelectorAll('button.dot').length`)) === 7 && (await ev(`${rowOf('Зарядка')}.querySelectorAll('button.dot[aria-pressed="true"]').length`)) === 3);
const streakOf = (name) => ev(`${rowOf(name)}.querySelector('.habit__side .chip span').textContent`);
check('серия «Зарядки» = 3', (await streakOf('Зарядка')) === '3');
const d5 = await dayAgo(-5);
await ev(`${rowOf('Зарядка')}.querySelector('button.dot[data-date="${d5}"]').click()`); await sleep(250);
check('клик по точке 5-дневной давности отмечает день (в хранилище есть дата), серия не меняется', (await stored()).find(h => h.id === 'h1').dates.includes(d5) && (await streakOf('Зарядка')) === '3');
const d3 = await dayAgo(-3);
await ev(`${rowOf('Зарядка')}.querySelector('button.dot[data-date="${d3}"]').click()`); await sleep(250);
check('отметили пропущенный день −3: серия 4 (сегодня, −1, −2, −3; день −4 всё ещё пропущен)', (await streakOf('Зарядка')) === '4', await streakOf('Зарядка'));
await ev(`${rowOf('Зарядка')}.querySelector('button.dot[data-date="${d3}"]').click()`); await sleep(250);
check('повторный клик снимает отметку: серия обратно 3', (await streakOf('Зарядка')) === '3' && !(await stored()).find(h => h.id === 'h1').dates.includes(d3));
await ev(`${rowOf('Зарядка')}.querySelector('button.dot[data-date="${today}"]').click()`); await sleep(250);
check('точка «сегодня» = чекбокс: снимает сегодняшнюю отметку', (await ev(`${rowOf('Зарядка')}.querySelector('input.check').checked`)) === false && (await streakOf('Зарядка')) === '0');
await ev(`${rowOf('Зарядка')}.querySelector('input.check').click()`); await sleep(250);
check('чекбокс возвращает отметку (серия снова 3)', (await streakOf('Зарядка')) === '3');
check('точки не по графику — пунктирные (dot--off)', (await n('#habit-list .habit:nth-child(3) .dot--off')) >= 5);
check('подсказка точки: дата и подсказка про нажатие', (await ev(`${rowOf('Зарядка')}.querySelector('button.dot').getAttribute('data-tip')`)).includes('нажмите'));

// ===== Календарь отметок =====
await ev(`${rowOf('Зарядка')}.querySelector('[aria-label="Календарь отметок"]').click()`); await sleep(250);
const monthLabel = await q('#hh-month');
check('календарь: открыт, заголовок — название привычки, месяц с заглавной, следующий месяц недоступен', (await modalOpen('habit-history')) && (await q('#hh-title')) === 'Зарядка' && monthLabel[0] === monthLabel[0].toUpperCase() && (await ev(`document.getElementById('hh-next').disabled`)) === true, monthLabel);
const dayNum = +today.slice(8);
check('в текущем месяце нажимаемы дни до сегодня включительно; будущие — disabled', (await n('#hh-grid .hcal__day:not(:disabled)')) === dayNum, String(await n('#hh-grid .hcal__day:not(:disabled)')));
check('статистика месяца: «Отмечено N из M дней по графику · P%»', /^Отмечено \d+ из \d+ дней по графику · \d+%$/.test(await q('#hh-stat')), await q('#hh-stat'));
const statBefore = await q('#hh-stat');
const d10 = await dayAgo(-10);
const inThisMonth = d10.startsWith(today.slice(0, 7));
const target = inThisMonth ? d10 : await dayAgo(-(dayNum - 1));  // если −10 в прошлом месяце — берём первый день этого месяца
await ev(`document.querySelector('#hh-grid [data-date="${target}"]').click()`); await sleep(250);
check('клик по дню в календаре отмечает его (хранилище + подсветка + статистика изменилась)', (await stored()).find(h => h.id === 'h1').dates.includes(target) && (await ev(`document.querySelector('#hh-grid [data-date="${target}"]').classList.contains('hcal__day--done')`)) === true && (await q('#hh-stat')) !== statBefore);
await ev(`document.querySelector('#hh-grid [data-date="${target}"]').click()`); await sleep(250);
check('повторный клик снимает', !(await stored()).find(h => h.id === 'h1').dates.includes(target));
await ev(`document.getElementById('hh-prev').click()`); await sleep(200);
check('переход на прошлый месяц: другой заголовок, «Вперёд» доступна, все дни нажимаемы', (await q('#hh-month')) !== monthLabel && (await ev(`document.getElementById('hh-next').disabled`)) === false && (await n('#hh-grid .hcal__day:not(:disabled)')) >= 28);
const prevDay = await ev(`document.querySelector('#hh-grid .hcal__day:not(:disabled)').dataset.date`);
await ev(`document.querySelector('#hh-grid .hcal__day:not(:disabled)').click()`); await sleep(200);
check('можно отметить день в прошлом месяце', (await stored()).find(h => h.id === 'h1').dates.includes(prevDay));
await ev(`document.getElementById('hh-next').click()`); await sleep(150);
check('«Вперёд» возвращает текущий месяц', (await q('#hh-month')) === monthLabel);
await esc(); await sleep(150);
check('Esc закрывает календарь', !(await modalOpen('habit-history')));
await ev(`${rowOf('Зарядка')}.querySelector('[aria-label="Календарь отметок"]').click()`); await sleep(150);
await ev(`document.getElementById('habit-history').dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`); await sleep(100);
check('клик по фону закрывает календарь', !(await modalOpen('habit-history')));
// календарь привычки с графиком: дни не по графику приглушены
await ev(`${rowOf('Не сегодня')}.querySelector('[aria-label="Календарь отметок"]').click()`); await sleep(200);
check('календарь привычки с графиком: дни не по графику — hcal__day--off, по графику — --due', (await n('#hh-grid .hcal__day--off')) > (await n('#hh-grid .hcal__day--due')) && (await n('#hh-grid .hcal__day--due')) >= 1);
await ev(`document.getElementById('hh-close').click()`); await sleep(100);

// ===== Правка =====
await ev(`${rowOf('<b>Йога</b>')}.querySelector('[aria-label="Изменить привычку"]').click()`); await sleep(200);
const idxNow = await ev(`(new Date().getDay() + 6) % 7`);
check('окно правки: название (текст, не HTML), кнопка сегодняшнего дня недели нажата', (await modalOpen('habit-modal')) && (await ev(`document.getElementById('hm-name').value`)) === '<b>Йога</b>' && (await ev(`[...document.querySelectorAll('#hm-days .chip-btn')].map(b => b.getAttribute('aria-pressed')).join()`)) === [0,1,2,3,4,5,6].map(i => String(i === idxNow)).join());
await esc(); await sleep(100);
check('Esc закрывает окно правки без изменений', !(await modalOpen('habit-modal')) && (await stored()).find(h => h.id === 'h2').text === '<b>Йога</b>');
await ev(`${rowOf('<b>Йога</b>')}.querySelector('[aria-label="Изменить привычку"]').click()`); await sleep(150);
await setv('#hm-name', '   ');
await ev(`document.getElementById('habit-modal-form').requestSubmit()`); await sleep(150);
check('пустое название не сохраняется (окно открыто)', (await modalOpen('habit-modal')) && (await stored()).find(h => h.id === 'h2').text === '<b>Йога</b>');
await ev(`(() => { document.getElementById('hm-name').value = 'Йога утром'; const b = document.querySelectorAll('#hm-days .chip-btn'); b[0].click(); b[2].click(); document.getElementById('habit-modal-form').requestSubmit(); })()`); await sleep(300);
let h2 = (await stored()).find(h => h.id === 'h2');
check('сохранение: новое название и график (день недели сегодня + Пн + Ср), окно закрыто', h2.text === 'Йога утром' && JSON.stringify(h2.days) === JSON.stringify([...new Set([0, 2, idxNow])].sort((a,b) => a-b)) && !(await modalOpen('habit-modal')), JSON.stringify(h2));
check('в списке появился чип графика с сокращениями дней', (await ev(`${rowOf('Йога утром')}.querySelector('.chip--mini').textContent.includes('Пн')`)) === true);
// все семь дней / ни одного = каждый день
await ev(`${rowOf('Йога утром')}.querySelector('[aria-label="Изменить привычку"]').click()`); await sleep(150);
await ev(`(() => { document.querySelectorAll('#hm-days .chip-btn').forEach(b => { if (b.getAttribute('aria-pressed') !== 'true') b.click(); }); document.getElementById('habit-modal-form').requestSubmit(); })()`); await sleep(250);
check('выбраны все семь дней → «каждый день» (график не хранится, чипа нет)', (await stored()).find(h => h.id === 'h2').days === undefined && (await ev(`${rowOf('Йога утром')}.querySelector('.chip--mini')`)) === null);

// ===== Архив =====
await ev(`${rowOf('Йога утром')}.querySelector('[aria-label="Изменить привычку"]').click()`); await sleep(150);
await ev(`document.getElementById('hm-archive').click()`); await sleep(250);
check('«В архив»: привычка ушла из списка (2), появилась в архиве (2), в хранилище archived=true, история цела', (await n('#habit-list .habit')) === 2 && (await n('#habit-archive-list .archive-row')) === 2 && (await stored()).find(h => h.id === 'h2').archived === true);
check('график серий (привычки) без архивных', (await n('#habit-streaks .hbar')) === 2);
await ev(`location.hash = '#/dashboard'`); await sleep(400);
check('главная: архивные не учитываются (осталось 2: «Зарядка» отмечена → «Не сегодня» не по графику…)', (await q('[data-stat="habits.left"]')) === '0', await q('[data-stat="habits.left"]'));
await ev(`location.hash = '#/analytics'`); await sleep(500);
check('аналитика: в тепловой карте только активные привычки (2)', (await n('#an-habits .heat__row')) === 2);
check('аналитика: у привычки по графику есть «выходные» ячейки (heat__cell--off)', (await n('#an-habits .heat__cell--off')) >= 1);
await ev(`document.getElementById('search-input').focus(); document.getElementById('search-input').value = 'Йога'; document.getElementById('search-input').dispatchEvent(new Event('input', {bubbles: true}))`); await sleep(200);
check('поиск: архивные привычки не находятся', (await n('#search-results [data-kind="habit"]')) === 0);
await ev(`document.getElementById('search-input').blur(); document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`);
await ev(`location.hash = '#/habits'`); await sleep(400);
await ev(`document.querySelector('#habit-archive-list .archive-row [class~="btn"]').click()`); await sleep(250);
check('«Вернуть»: привычка снова в списке, archived снят', (await n('#habit-list .habit')) === 3 && (await stored()).filter(h => h.archived).length === 1);
// удаление из архива — двойное нажатие
const arch = `document.querySelector('#habit-archive-list .archive-row [aria-label="Удалить навсегда"]')`;
await ev(`${arch}.click()`); await sleep(150);
check('удаление из архива: первое нажатие только взводит кнопку', (await n('#habit-archive-list .archive-row')) === 1 && (await ev(`${arch}.classList.contains('is-armed')`)) === true);
await ev(`${arch}.click()`); await sleep(250);
check('второе нажатие удаляет привычку насовсем; архив пуст и скрыт', (await stored()).length === 3 && (await ev(`document.getElementById('habit-archive-card').classList.contains('hidden')`)) === true);
// удаление из окна правки
await ev(`${rowOf('Йога утром')}.querySelector('[aria-label="Изменить привычку"]').click()`); await sleep(150);
await ev(`document.getElementById('hm-delete').click()`); await sleep(100);
check('«Удалить» в окне правки: первое нажатие просит подтверждения', (await q('#hm-delete')) === 'Точно удалить?' && (await modalOpen('habit-modal')) && (await stored()).length === 3);
await ev(`document.getElementById('hm-delete').click()`); await sleep(250);
check('второе нажатие удаляет; окно закрыто', (await stored()).length === 2 && !(await modalOpen('habit-modal')) && !(await stored()).some(h => h.text === 'Йога утром'));
await ev(`${rowOf('Зарядка')}.querySelector('[aria-label="Изменить привычку"]').click()`); await sleep(150);
check('подтверждение сбрасывается при новом открытии окна', (await q('#hm-delete')) === 'Удалить');
await esc();

// ===== Новая привычка с графиком =====
await ev(`(() => { document.getElementById('habit-text').value = 'Бассейн'; const c = document.querySelectorAll('#habit-days .chip-btn'); c[1].click(); c[3].click(); document.getElementById('add-habit-form').requestSubmit(); })()`); await sleep(300);
check('новая привычка с графиком Вт/Чт сохранена', JSON.stringify((await stored()).find(h => h.text === 'Бассейн').days) === '[1,3]' && (await ev(`${rowOf('Бассейн')}.querySelector('.chip--mini').textContent`)) === 'Вт · Чт');
check('форма очищена: ни один день не выбран', (await n('#habit-days .chip-btn.is-active')) === 0);
await ev(`(() => { document.getElementById('habit-text').value = 'Каждый день'; document.getElementById('add-habit-form').requestSubmit(); })()`); await sleep(250);
check('привычка без выбранных дней — на каждый день (days отсутствует)', (await stored()).find(h => h.text === 'Каждый день').days === undefined);

// ===== Влияние графика на главную и уведомления =====
await boot();
await ev(`location.hash = '#/dashboard'`); await sleep(400);
check('главная: «осталось» считает только привычки по графику на сегодня («Йога» по графику и «Не сегодня» не считаются вместе)', (await q('[data-stat="habits.left"]')) === '1', await q('[data-stat="habits.left"]'));
check('карточка «Привычки»: не по графику и не отмеченная привычка не показана, остальные — да', !(await q('#viz-habits')).includes('Не сегодня') && (await q('#viz-habits')).includes('Йога') && (await q('#viz-habits')).includes('Зарядка'));
await ev(`document.getElementById('notif-btn').click()`); await sleep(150);
check('колокольчик: «Привычек без отметки: 1 — Йога»', (await q('#notif-list [data-notice="habits"] .notice__title')) === 'Привычек без отметки: 1' && (await q('#notif-list [data-notice="habits"] .notice__detail')).includes('Йога'), await q('#notif-list'));
await ev(`document.getElementById('notif-btn').click()`);

// ===== Тема, ширина =====
await ev(`location.hash = '#/habits'`); await sleep(300);
await ev(`${rowOf('Зарядка')}.querySelector('[aria-label="Календарь отметок"]').click()`); await sleep(200);
await ev(`window.setThemeMode('dark')`); await sleep(200);
check('тёмная тема: отмеченный день в календаре светлый, текст тёмный', (await ev(`getComputedStyle(document.querySelector('#hh-grid .hcal__day--done')).backgroundColor`)) === 'rgb(240, 238, 232)' && (await ev(`getComputedStyle(document.querySelector('#hh-grid .hcal__day--done')).color`)) === 'rgb(20, 19, 15)');
await ev(`document.getElementById('hh-close').click()`);
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
check('760 px: страница «Привычки» без горизонтального скролла', (await ev(`document.documentElement.scrollWidth <= window.innerWidth`)) === true);
await ev(`${rowOf('Зарядка')}.querySelector('[aria-label="Календарь отметок"]').click()`); await sleep(200);
check('760 px: календарь отметок помещается в окно', (await ev(`(() => { const r = document.querySelector('#habit-history .modal__panel').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; })()`)) === true);
await ev(`document.getElementById('hh-close').click()`);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);

// ===== Пустые и повреждённые данные =====
await boot(`localStorage.clear()`);
check('пустое приложение: подсказка «Привычек пока нет», архив скрыт', (await ev(`!document.getElementById('habit-empty').classList.contains('hidden')`)) === true && (await ev(`document.getElementById('habit-archive-card').classList.contains('hidden')`)) === true && (await q('#habit-streaks')).includes('Добавьте привычку'));
await boot(`localStorage.setItem('habits', JSON.stringify([{id:'x', text:'Битая', dates:['2026-01-01'], days:[99,'a'], archived:'да'}]))`);
check('повреждённые поля привычки (days, archived) не ломают страницу', (await n('#habit-list .habit')) === 1);

    finish();
});
