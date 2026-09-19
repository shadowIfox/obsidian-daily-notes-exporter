// @ts-nocheck — перенесено из временного скрипта (smoke8.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from '../harness';

test("фильтры и сортировка задач", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const seed = `(() => { localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light'}));
  const T = (id, text, date, cat, pr, done) => ({id, text, date, category: cat, priority: pr, notes:'', completed: !!done, completedAt: done ? date : undefined});
  localStorage.setItem('tasks', JSON.stringify([
    T('a','Яблоки','2026-09-25','Дом','low'), T('b','Арбуз','2026-09-20','Дом','high',true), T('c','Билеты','2026-09-20','Работа','high'),
    T('d','Ёжик','','','normal'), T('e','Дела','2026-09-21','Работа','normal')]));
})()`;
const boot = async (custom, hash = 'tasks') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const titles = () => ev(`[...document.querySelectorAll('#task-list .task__text')].map(e => e.textContent).join(' | ')`);
const pick = async (id, v) => { await ev(`(() => { const s = document.getElementById('${id}'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change', {bubbles: true})); })()`); await sleep(200); };
const opts = () => ev(`[...document.querySelectorAll('#task-category-filter option')].map(o => o.textContent).join(' | ')`);
const view = () => ev(`localStorage.getItem('taskView')`);

await boot();
check('порядок по умолчанию — как добавлены; сортировка «По добавлению»', (await titles()) === 'Яблоки | Арбуз | Билеты | Ёжик | Дела' && (await ev(`document.getElementById('task-sort').value`)) === 'added', await titles());
check('список категорий: «Все», «Без категории», затем по алфавиту', (await opts()) === 'Все категории | Без категории | Дом | Работа', await opts());
await pick('task-category-filter', 'Работа');
check('фильтр по категории «Работа»', (await titles()) === 'Билеты | Дела', await titles());
check('прогресс считается по всем задачам, а не по видимым', (await ev(`document.getElementById('progress-text').textContent`)) === 'Выполнено: 1 из 5');
await ev(`document.querySelector('#todo-filters [data-filter="active"]').click()`); await sleep(200);
await pick('task-category-filter', 'Дом');
check('категория + статус «Активные»: только невыполненные «Дом»', (await titles()) === 'Яблоки', await titles());
await pick('task-category-filter', '__none__');
check('«Без категории»', (await titles()) === 'Ёжик');
await ev(`document.querySelector('#todo-filters [data-filter="completed"]').click()`); await sleep(200);
check('пустой результат: понятное сообщение (а не «задач нет»)', (await ev(`document.getElementById('empty-list-msg').textContent`)) === 'По выбранным условиям задач нет.' && (await ev(`!document.getElementById('empty-list-msg').classList.contains('hidden')`)) === true);
await ev(`document.querySelector('#todo-filters [data-filter="all"]').click()`); await sleep(200);
await pick('task-category-filter', '');
await pick('task-sort', 'deadline');
check('сортировка по дедлайну: без даты в конце', (await titles()) === 'Арбуз | Билеты | Дела | Яблоки | Ёжик', await titles());
await pick('task-sort', 'priority');
check('сортировка по приоритету: высокий → обычный → низкий', (await titles()) === 'Арбуз | Билеты | Дела | Ёжик | Яблоки', await titles());
await pick('task-sort', 'title');
check('сортировка по названию (Ё после Д)', (await titles()) === 'Арбуз | Билеты | Дела | Ёжик | Яблоки', await titles());
await pick('task-category-filter', 'Работа'); await pick('task-sort', 'deadline');
check('вид сохраняется в localStorage', JSON.parse(await view()).category === 'Работа' && JSON.parse(await view()).sort === 'deadline');
await ev('location.reload()'); await sleep(1300);
check('после перезагрузки вид восстановлен: фильтр, категория, сортировка', (await ev(`document.getElementById('task-category-filter').value`)) === 'Работа' && (await ev(`document.getElementById('task-sort').value`)) === 'deadline' && (await titles()) === 'Билеты | Дела');

// действия при активных фильтрах работают с нужной задачей (по id)
await ev(`[...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('Дела')).querySelector('[aria-label="Удалить задачу"]').click()`); await sleep(250);
check('удаление при фильтре и сортировке удаляет именно выбранную', (await titles()) === 'Билеты' && JSON.parse(await ev(`localStorage.getItem('tasks')`)).length === 4);
// новая категория сразу в списке; исчезнувшая категория сбрасывается
await ev(`(() => { document.getElementById('task-text').value = 'Новая'; document.getElementById('task-category').value = 'Учёба'; document.getElementById('add-task-form').requestSubmit(); })()`); await sleep(300);
check('добавленная задача с новой категорией: категория сразу в списке (по-прежнему отображается фильтр «Работа»)', (await opts()).includes('Учёба') && (await titles()) === 'Билеты');
await ev(`[...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('Билеты')).querySelector('[aria-label="Удалить задачу"]').click()`); await sleep(250);
check('удалили последнюю задачу выбранной категории: фильтр сбрасывается на «Все категории», список не пустой', (await ev(`document.getElementById('task-category-filter').value`)) === '' && (await titles()).includes('Новая') && !(await opts()).includes('Работа'), await opts());
// правка категории через окно
await ev(`[...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('Новая')).querySelector('[aria-label="Изменить задачу"]').click()`); await sleep(200);
await ev(`(() => { document.getElementById('tm-category').value = 'Спорт'; document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(300);
check('переименовали категорию в окне правки: в фильтре «Спорт», «Учёба» исчезла', (await opts()).includes('Спорт') && !(await opts()).includes('Учёба'));
// XSS в названии категории
await ev(`(() => { document.getElementById('task-text').value = 'x'; document.getElementById('task-category').value = '<b>hack</b>'; document.getElementById('add-task-form').requestSubmit(); })()`); await sleep(300);
check('HTML в названии категории — только текст в списке', (await ev(`document.querySelectorAll('#task-category-filter b').length`)) === 0 && (await opts()).includes('<b>hack</b>'));
// тёмная тема и ширина
await ev(`window.setThemeMode('dark')`); await sleep(200);
check('тёмная тема: выпадающие списки читаются (светлый текст)', (await ev(`getComputedStyle(document.getElementById('task-sort')).color`)) === 'rgb(240, 238, 232)');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
check('900 px: панель фильтров переносится, без горизонтального скролла', (await ev(`document.documentElement.scrollWidth <= window.innerWidth`)) === true);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
// пустое приложение
await boot(`localStorage.clear()`);
check('пустое приложение: «Задач пока нет», список категорий — только «Все категории»', (await ev(`document.getElementById('empty-list-msg').textContent`)) === 'Задач пока нет — добавьте первую выше.' && (await opts()) === 'Все категории');
// повреждённые настройки вида не ломают страницу
await boot(`(() => { localStorage.setItem('taskView', '{bad json'); localStorage.setItem('tasks', JSON.stringify([{id:'a', text:'ok', date:'', category:'', priority:'normal', notes:'', completed:false}])); })()`);
check('повреждённые настройки вида игнорируются', (await titles()) === 'ok');
await boot(`(() => { localStorage.setItem('taskView', JSON.stringify({filter: 'evil', sort: 'evil', category: 5})); localStorage.setItem('tasks', JSON.stringify([{id:'a', text:'ok', date:'', category:'', priority:'normal', notes:'', completed:false}])); })()`);
check('неизвестные значения вида заменяются на значения по умолчанию', (await titles()) === 'ok' && (await ev(`document.getElementById('task-sort').value`)) === 'added');

    finish();
});
