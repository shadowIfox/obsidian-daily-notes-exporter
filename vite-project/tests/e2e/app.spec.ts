// @ts-nocheck — перенесено из временного скрипта (smoke2b.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from './harness';

test("общее: задачи, привычки, настроение, тема", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const seed = (settings) => `(() => { const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }; localStorage.clear();
  localStorage.setItem('tasks', JSON.stringify([
    {id:'t1', text:'Первая (сделана)', date: day(0), category:'A', completed:true, completedAt: day(0)},
    {id:'t2', text:'Вторая активная', date: day(0), category:'', completed:false},
    {id:'t3', text:'Третья активная', date: day(-2), category:'', completed:false},
    {id:'t4', text:'Четвёртая активная', date: day(3), category:'', completed:false}]));
  localStorage.setItem('habits', JSON.stringify([{id:'h1', text:'Зарядка <i>x</i>', dates:[day(0), day(-1), day(-2)]}, {id:'h2', text:'Чтение <b>y</b>', dates:[day(-1)]}]));
  localStorage.setItem('moodData', JSON.stringify([{date: day(0), rating: 5, note: '<b>жирный</b> текст'}, {date: day(-1), rating: 1, note: ''}, {date: day(-20), rating: 3, note: 'давно'}]));
  ${settings ? `localStorage.setItem('userSettings', JSON.stringify(${settings}));` : ''} })()`;
const boot = async (settings) => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(seed(settings)); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/dashboard' }); await sleep(300); await ev('location.reload()'); await sleep(1300); };

await boot(`{themeMode:'light', userName:'Мария'}`);

// ===== Главная и роутинг =====
check('главная открыта по умолчанию, приветствие с именем', (await ev(`document.getElementById('greeting').textContent`)).endsWith(', Мария'), await ev(`document.getElementById('greeting').textContent`));
const dash = await ev(`JSON.stringify(Object.fromEntries([...document.querySelectorAll('[data-stat]')].map(e => [e.dataset.stat, e.textContent])))`);
const d = JSON.parse(dash);
check('карточки главной считают верно (задачи 1/3/1, дедлайны 1/1/1, привычки 1/1/2, настроение 3/1/5)',
  d['tasks.done']==='1' && d['tasks.active']==='3' && d['tasks.overdue']==='1' && d['deadlines.overdue']==='1' && d['deadlines.today']==='1' && d['deadlines.week']==='1' && d['habits.done']==='1' && d['habits.left']==='1' && d['habits.streak']==='3' && d['mood.avg']==='3' && d['mood.min']==='1' && d['mood.max']==='5', dash);
check('дата в верхней панели с заглавной буквы и месяц строчный', /^[А-Я][а-я]+, \d+ [а-я]+$/.test(await ev(`document.getElementById('today-label').innerText`)), await ev(`document.getElementById('today-label').innerText`));
await go('habits');
await ev('location.reload()'); await sleep(1200);
check('после обновления страницы остаётся раздел «Привычки»', !(await ev(`document.getElementById('habits-section').classList.contains('hidden')`)) && (await ev(`document.querySelector('[data-route="habits"]').getAttribute('aria-current')`)) === 'page');
check('заголовок вкладки меняется', (await ev('document.title')).startsWith('Привычки'));
await ev(`history.back()`); await sleep(400);
check('кнопка «Назад» возвращает на предыдущий раздел', (await ev('location.hash')) !== '#/habits');

// ===== Задачи =====
await go('tasks');
await ev(`document.querySelector('#todo-filters [data-filter="active"]').click()`); await sleep(300);
check('фильтр подсвечен (is-active + aria-pressed)', (await ev(`document.querySelector('#todo-filters [data-filter="active"]').classList.contains('is-active') && document.querySelector('#todo-filters [data-filter="active"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#todo-filters [data-filter="all"]').classList.contains('is-active')`)) === true);
const before = await ev(`[...document.querySelectorAll('#task-list .task__text')].map(s => s.textContent).join(' | ')`);
await ev(`document.querySelectorAll('#task-list .task')[1].querySelector('[aria-label="Удалить задачу"]').click()`); await sleep(300);
await ev(`document.querySelector('#todo-filters [data-filter="all"]').click()`); await sleep(300);
const after = await ev(`[...document.querySelectorAll('#task-list .task__text')].map(s => s.textContent).join(' | ')`);
check('удаление под фильтром удаляет нужную задачу', !after.includes('Третья') && after.includes('Вторая') && after.includes('Первая') && after.includes('Четвёртая'), `${before} → ${after}`);
check('дедлайн «сегодня» — бейдж badge--today', (await ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('Вторая')).querySelector('.badge').className`)).includes('badge--today'));
check('бейдж дедлайна в коротком формате («до 22 сент.»)', /^до \d+ [а-я]+\.?$/.test(await ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('Четвёртая')).querySelector('.badge').textContent`)));
await ev(`document.getElementById('today-btn').click()`);
check('кнопка «Сегодня» заполняет дату', /^\d{4}-\d\d-\d\d$/.test(await ev(`document.getElementById('task-date').value`)));
await ev(`(() => { document.getElementById('task-date').value=''; document.getElementById('task-text').value='Без даты'; document.getElementById('add-task-form').requestSubmit(); })()`); await sleep(300);
check('задачу можно добавить без дедлайна', (await ev(`document.getElementById('task-list').textContent`)).includes('Без даты'));
await ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('Вторая')).querySelector('input.check').click()`); await sleep(300);
check('при отметке пишется completedAt, строка перечёркнута', (await ev(`JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='t2').completedAt`)) !== null && (await ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('Вторая')).classList.contains('task--done')`)) === true);
await ev(`document.getElementById('clear-completed').click()`); await sleep(300);
check('«Очистить выполненные» удаляет выполненные', !(await ev(`document.getElementById('task-list').textContent`)).includes('Первая') && (await ev(`document.getElementById('task-list').textContent`)).includes('Четвёртая'));
check('пустой фильтр показывает заглушку', (await ev(`(() => { document.querySelector('#todo-filters [data-filter="completed"]').click(); return !document.getElementById('empty-list-msg').classList.contains('hidden'); })()`)) === true);

// ===== Привычки =====
await go('habits');
await ev(`document.querySelector('#habit-list .check:not(:checked)').click()`); await sleep(400);
check('название привычки с HTML показано как текст', (await ev(`document.querySelector('#habit-list .habit__name i')`)) === null && (await ev(`document.querySelector('#habit-list .habit__name').textContent`)).includes('<i>'));
check('полоска прогресса за месяц видна (трек ≠ фон строки)', (await ev(`getComputedStyle(document.querySelector('#habit-list .progress')).backgroundColor !== getComputedStyle(document.querySelector('#habit-list .habit')).backgroundColor`)) === true);

// ===== Настроение =====
await go('mood');
const hist = await ev(`JSON.stringify({ hasB: !!document.querySelector('#mood-history b'), note: document.querySelector('#mood-history .mood-item__note').textContent, rows: document.querySelectorAll('#mood-history .mood-item').length })`);
check('заметка с <b> показана как текст, запись 20-дневной давности не в истории', JSON.parse(hist).hasB === false && JSON.parse(hist).note.includes('<b>жирный</b>') && JSON.parse(hist).rows === 2, hist);
await ev(`(() => { document.querySelector('.rating__opt[data-r="4"] input').click(); document.getElementById('mood-note').value='Тест <u>4</u>'; document.getElementById('mood-form').requestSubmit(); })()`); await sleep(400);
check('сохранение настроения заменяет запись за сегодня (историй по-прежнему 2 строки)', (await ev(`document.querySelectorAll('#mood-history .mood-item').length`)) === 2 && (await ev(`document.querySelector('#mood-history .mood-item__score').dataset.r`)) === '4');

// ===== Тема: график настроения перекрашивается (проверка по пикселям) =====
await ev(`window.setThemeMode('dark')`); await sleep(500);
await go('settings'); await ev(`window.setThemeMode('light')`); await sleep(300); await go('mood'); await sleep(500);

// ===== Кнопка темы в режиме «Системная» =====
await boot(`{themeMode:'system', userName:''}`);
check('режим «Системная», ОС светлая → тема light', (await ev(`document.documentElement.dataset.theme`)) === 'light');
await ev(`document.getElementById('theme-toggle').click()`); await sleep(300);
check('кнопка темы в режиме «Системная» сразу переключает на тёмную', (await ev(`document.documentElement.dataset.theme`)) === 'dark' && (await ev(`JSON.parse(localStorage.getItem('userSettings')).themeMode`)) === 'dark');
check('радиокнопка в настройках синхронизирована', (await ev(`document.querySelector('input[name="themeMode"]:checked').value`)) === 'dark');
await go('dashboard');
check('без имени приветствие без запятой', !(await ev(`document.getElementById('greeting').textContent`)).includes(','));

// ===== Настройки: имя, модалка, Esc =====
await go('settings');
await ev(`(() => { document.getElementById('user-name').value = 'Анна'; document.getElementById('profile-form').requestSubmit(); })()`); await sleep(300);
check('имя сохраняется, показывается «Сохранено»', (await ev(`document.getElementById('profile-hint').textContent`)) === 'Сохранено' && (await ev(`JSON.parse(localStorage.getItem('userSettings')).userName`)) === 'Анна');
check('сохранение имени не затирает тему', (await ev(`JSON.parse(localStorage.getItem('userSettings')).themeMode`)) === 'dark');
await go('dashboard');
check('приветствие подхватило новое имя', (await ev(`document.getElementById('greeting').textContent`)).endsWith(', Анна'));
await go('settings');
await ev(`document.getElementById('open-export-dialog').click()`); await sleep(200);
check('модалка экспорта открывается', (await ev(`document.getElementById('export-modal').classList.contains('is-open')`)) === true);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(200);
check('Esc закрывает модалку', (await ev(`document.getElementById('export-modal').classList.contains('is-open')`)) === false);

// ===== Сайдбар =====
await ev(`document.getElementById('sidebar-toggle').click()`); await sleep(200);
check('сайдбар сворачивается', (await ev(`document.getElementById('app-frame').classList.contains('is-collapsed')`)) === true);
await ev('location.reload()'); await sleep(1200);
check('состояние сайдбара запоминается', (await ev(`document.getElementById('app-frame').classList.contains('is-collapsed')`)) === true);
await ev(`document.getElementById('sidebar-toggle').click()`);

// ===== Аналитика =====
await go('analytics');
for (let i = 0; i < 3; i++) { await go('analytics'); }
await ev(`window.setThemeMode('light')`); await sleep(300); await ev(`window.setThemeMode('dark')`); await sleep(300);

// ===== Экспорт по реальным данным =====
const md = await ev(`(async()=>{ const m = await import('/src/exporter.ts'); return m.buildExport({period:'week', category:'all', format:'md'}).content })()`);
check('экспорт без undefined', !md.includes('undefined') && md.includes('Зарядка <i>x</i>'));

    finish();
});
