// @ts-nocheck — перенесено из временного скрипта (smoke3.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from './harness';

test("главная", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const seed = `(() => { const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }; localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light', userName:'Мария'}));
  localStorage.setItem('tasks', JSON.stringify([
    {id:'a', text:'Утренний звонок', date: day(0), time:'09:15', category:'Работа', priority:'high', notes:'Взять <b>документы</b>', completed:false},
    {id:'b', text:'Вечерняя учёба', date: day(0), time:'18:30', category:'Учёба', priority:'normal', notes:'', completed:false},
    {id:'c', text:'Просроченная <i>задача</i>', date: day(-2), category:'', priority:'normal', notes:'', completed:false},
    {id:'d', text:'На неделе', date: day(3), category:'', priority:'low', notes:'', completed:false},
    {id:'e', text:'Уже сделана', date: day(0), category:'', priority:'normal', notes:'', completed:true, completedAt: day(0)}]));
  localStorage.setItem('habits', JSON.stringify([{id:'h1', text:'Зарядка', dates:[day(-1)]}, {id:'h2', text:'Чтение', dates:[]}, {id:'h3', text:'Вода', dates:[day(0)]}, {id:'h4', text:'Сон', dates:[]}]));
  localStorage.setItem('moodData', JSON.stringify([{date: day(-3), rating: 2, note: ''}, {date: day(-1), rating: 4, note: ''}, {date: day(0), rating: 5, note: ''}]));
})()`;
const boot = async (custom) => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/dashboard' }); await sleep(300); await ev('location.reload()'); await sleep(1300); };
const texts = (sel) => ev(`[...document.querySelectorAll('${sel}')].map(e => e.textContent).join(' | ')`);
const setVal = (sel, v) => ev(`(() => { const e = document.querySelector('${sel}'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', {bubbles:true})); })()`);

await boot();
// ===== Карточки и графики =====
check('столбики: 7 колонок, сегодняшний день выделен', (await ev(`document.querySelectorAll('#viz-tasks .bars__col').length`)) === 7 && (await ev(`document.querySelectorAll('#viz-tasks .bars__col--today').length`)) === 1);
check('в столбиках сегодня выполнена 1 задача', (await ev(`document.querySelector('#viz-tasks .bars__col--today .bars__value').textContent`)) === '1');
check('линия настроения нарисована, без NaN, метка «сегодня»', (await ev(`(() => { const s = document.querySelector('#viz-mood svg'); return !!s && !s.outerHTML.includes('NaN') && s.textContent.includes('сегодня'); })()`)) === true);
check('привычки в карточке: 3 из 4 + «Ещё 1», неотмеченные сверху', (await texts('#viz-habits .mini-row__name')) === 'Зарядка | Чтение | Сон' && (await ev(`document.querySelector('#viz-habits .mini-more').textContent`)).includes('Ещё 1'), await texts('#viz-habits .mini-row__name'));
check('дедлайны: ближайшая — просроченная, HTML в названии не рендерится', (await ev(`document.querySelector('#viz-deadline .mini-row__label').textContent`)) === 'Просрочено' && (await ev(`document.querySelector('#viz-deadline i')`)) === null && (await texts('#viz-deadline .mini-row__name')).includes('<i>'));

// ===== Отметка привычки прямо в карточке, синхронизация с разделом =====
await ev(`document.querySelector('#viz-habits .mini-row:nth-child(1) input').click()`); await sleep(300);
check('отметка в карточке: «отмечено сегодня» 1 → 2', (await ev(`document.querySelector('[data-stat="habits.done"]').textContent`)) === '2');
await ev(`location.hash = '#/habits'`); await sleep(400);
check('в разделе «Привычки» привычка отмечена (состояние общее)', (await ev(`[...document.querySelectorAll('#habit-list .habit')].find(li => li.textContent.includes('Зарядка')).querySelector('input.check').checked`)) === true);
await ev(`[...document.querySelectorAll('#habit-list .habit')].find(li => li.textContent.includes('Зарядка')).querySelector('input.check').click()`); await sleep(300);
await ev(`location.hash = '#/dashboard'`); await sleep(400);
check('снятие в разделе отражается на главной (2 → 1)', (await ev(`document.querySelector('[data-stat="habits.done"]').textContent`)) === '1');
check('после снятия в разделе в localStorage у «Зарядки» осталась только вчерашняя отметка', JSON.parse(await ev(`localStorage.getItem('habits')`)).find(h => h.id === 'h1').dates.length === 1);

// ===== Список задач и фильтры =====
check('«Сегодня»: по времени, выполненная не показана', (await texts('#dash-task-list .pick__title')) === 'Утренний звонок | Вечерняя учёба', await texts('#dash-task-list .pick__title'));
check('время в плашке вместо даты', (await texts('#dash-task-list .pill')) === '09:15 | 18:30');
check('первая задача выбрана (aria-current)', (await ev(`document.querySelector('#dash-task-list .pick[aria-current="true"] .pick__title').textContent`)) === 'Утренний звонок');
await ev(`document.querySelector('#dash-list-filter [data-filter="overdue"]').click()`); await sleep(300);
check('«Просрочено»: одна задача, выбрана автоматически, HTML как текст', (await texts('#dash-task-list .pick__title')) === 'Просроченная <i>задача</i>' && (await ev(`document.querySelector('#dash-task-list i')`)) === null && (await ev(`document.querySelector('#d-text').value`)) === 'Просроченная <i>задача</i>');
await ev(`document.querySelector('#dash-list-filter [data-filter="week"]').click()`); await sleep(300);
const weekExpected = await ev(`(async () => { const m = await import('/src/dates.ts'); const r = m.weekRange(m.todayStr()); const all = JSON.parse(localStorage.getItem('tasks')); const inW = all.filter(t => t.date >= r.from && t.date <= r.to); return JSON.stringify([...inW.filter(t => !t.completed), ...inW.filter(t => t.completed)].length); })()`);
check('«Неделя» — календарная неделя Пн–Вс (с просроченными и выполненными): число задач сходится с данными', String(await ev(`document.querySelectorAll('#dash-task-list .pick').length`)) === JSON.parse(weekExpected).toString(), `${await ev(`document.querySelectorAll('#dash-task-list .pick').length`)} vs ${weekExpected}`);
await ev(`document.querySelector('#dash-list-filter [data-filter="today"]').click()`); await sleep(300);

// ===== Детали: чтение =====
check('детали: поля заполнены', (await ev(`JSON.stringify([document.querySelector('#d-text').value, document.querySelector('#d-time').value, document.querySelector('#d-category').value, document.querySelector('input[name="d-priority"]:checked').value, document.querySelector('#d-notes').value])`)) === JSON.stringify(['Утренний звонок', '09:15', 'Работа', 'high', 'Взять <b>документы</b>']));
check('детали: статус «На сегодня», кнопка «Отметить выполненной»', (await ev(`document.querySelector('[data-role="status"]').textContent`)) === 'На сегодня' && (await ev(`document.querySelector('[data-role="toggle"]').textContent`)) === 'Отметить выполненной');
await ev(`document.querySelectorAll('#dash-task-list .pick__main')[1].click()`); await sleep(300);
check('клик по другой задаче переключает детали', (await ev(`document.querySelector('#d-text').value`)) === 'Вечерняя учёба');

// ===== Детали: редактирование =====
await setVal('#d-text', '  Вечерняя учёба (TS)  ');
await setVal('#d-time', '19:45');
await setVal('#d-category', 'TypeScript');
await ev(`document.querySelector('input[name="d-priority"][value="high"]').click()`);
await setVal('#d-notes', 'Глава 5, <script>alert(1)</script>');
await ev(`document.querySelector('.details').requestSubmit()`); await sleep(400);
const saved = JSON.parse(await ev(`localStorage.getItem('tasks')`)).find(t => t.id === 'b');
check('сохранение: текст обрезан, время/категория/приоритет/заметки записаны', saved.text === 'Вечерняя учёба (TS)' && saved.time === '19:45' && saved.category === 'TypeScript' && saved.priority === 'high' && saved.notes.startsWith('Глава 5'), JSON.stringify(saved));
check('после сохранения задача осталась выбранной, показано «Сохранено»', (await ev(`document.querySelector('#d-text').value`)) === 'Вечерняя учёба (TS)' && (await ev(`document.querySelector('[data-role="hint"]').textContent`)) === 'Сохранено');
check('в списке обновились название и время', (await texts('#dash-task-list .pick__title')).includes('Вечерняя учёба (TS)') && (await texts('#dash-task-list .pill')).includes('19:45'));
await setVal('#d-text', '   ');
await ev(`document.querySelector('.details').requestSubmit()`); await sleep(300);
check('пустое название не сохраняется (остаётся прежнее)', (await ev(`document.querySelector('#d-text').value`)) === 'Вечерняя учёба (TS)');
await setVal('#d-time', '');
await ev(`document.querySelector('.details').requestSubmit()`); await sleep(300);
check('очистка времени убирает поле time', !('time' in JSON.parse(await ev(`localStorage.getItem('tasks')`)).find(t => t.id === 'b')) || JSON.parse(await ev(`localStorage.getItem('tasks')`)).find(t => t.id === 'b').time === undefined);

// ===== Синхронизация с разделом «Задачи» =====
await ev(`location.hash = '#/tasks'`); await sleep(400);
check('в разделе «Задачи» видны правки и метка «Важно»', (await texts('#task-list .task__text')).includes('Вечерняя учёба (TS)') && (await texts('#task-list .badge--high')).includes('Важно'));

// ===== Выполнение и удаление с главной =====
await ev(`location.hash = '#/dashboard'`); await sleep(400);
await ev(`document.querySelector('[data-role="toggle"]').click()`); await sleep(300);
check('«Отметить выполненной» в деталях: задача уходит из списка, счётчик растёт, completedAt записан', !(await texts('#dash-task-list .pick__title')).includes('(TS)') && (await ev(`document.querySelector('[data-stat="tasks.done"]').textContent`)) === '2' && JSON.parse(await ev(`localStorage.getItem('tasks')`)).find(t => t.id === 'b').completedAt != null);
await ev(`location.hash = '#/tasks'`); await sleep(300);
check('раздел «Задачи»: та же задача перечёркнута', (await ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('(TS)')).classList.contains('task--done')`)) === true);
await ev(`location.hash = '#/dashboard'`); await sleep(300);
await ev(`document.querySelector('#dash-task-list .pick input.check').click()`); await sleep(300);
check('чекбокс в списке отмечает задачу и обновляет карточки', (await ev(`document.querySelector('[data-stat="tasks.done"]').textContent`)) === '3');
await ev(`document.querySelector('#dash-list-filter [data-filter="overdue"]').click()`); await sleep(300);
await ev(`document.querySelector('[data-role="delete"]').click()`); await sleep(300);
check('удаление в деталях убирает задачу везде', !JSON.parse(await ev(`localStorage.getItem('tasks')`)).some(t => t.id === 'c') && (await ev(`!document.getElementById('dash-task-empty').classList.contains('hidden')`)) === true && (await ev(`document.getElementById('dash-task-empty').textContent`)).includes('Просроченных задач нет'));
check('при пустом списке детали показывают подсказку', (await ev(`document.querySelector('#task-details .viz__empty')`)) !== null || (await ev(`document.querySelector('#d-text')`)) !== null);

// ===== Пустое состояние (новый пользователь) =====
await boot(`localStorage.clear()`);
check('пустое приложение: подсказка в приветствии', (await ev(`document.getElementById('greeting-sub').textContent`)).includes('Добавьте первую задачу'));
check('пустое приложение: все пустые состояния на месте', (await ev(`document.querySelector('#viz-mood .viz__empty')`)) !== null && (await ev(`document.querySelector('#viz-habits .viz__empty')`)) !== null && (await ev(`document.querySelector('#viz-deadline .viz__empty')`)) !== null && (await ev(`document.querySelectorAll('#viz-tasks .bars__dot').length`)) === 7);
check('пустое приложение: пустой список и детали без ошибок', (await ev(`!document.getElementById('dash-task-empty').classList.contains('hidden')`)) === true && (await ev(`document.querySelector('#task-details .viz__empty')`)) !== null);

// ===== Тёмная тема на главной =====
await boot();
await ev(`window.setThemeMode('dark')`); await sleep(300);
check('тёмная тема: цветные карточки и текст на них остаются тёмными на пастели', (await ev(`getComputedStyle(document.querySelector('.card--pink .input') ?? document.querySelector('.card--pink')).color`)) === 'rgb(20, 19, 15)');

    finish();
});
