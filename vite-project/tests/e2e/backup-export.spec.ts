// @ts-nocheck — перенесено из временного скрипта (smoke11.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from './harness';

test("резервная копия и экспорт", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const seed = `(() => { localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light', userName:'Мария'}));
  localStorage.setItem('tasks', JSON.stringify([
    {id:'t1', text:'Звонок клиенту', date:'2026-09-19', time:'14:30', category:'Работа', priority:'high', notes:'Спросить про договор', completed:false},
    {id:'t2', text:'Купить молоко', date:'', category:'', priority:'normal', notes:'', completed:true, completedAt:'2026-09-18'}]));
  localStorage.setItem('habits', JSON.stringify([{id:'h1', text:'Зарядка', dates:['2026-09-18','2026-09-19'], days:[0,2,4]}]));
  localStorage.setItem('moodData', JSON.stringify([{date:'2026-09-18', rating:4, note:'хороший день'}, {date:'2026-09-19', rating:5, note:''}]));
})()`;
const boot = async (custom, hash = 'settings') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); await stubDownloads(); };
const stubDownloads = () => ev(`(() => { window.__downloads = []; let last; URL.createObjectURL = (b) => { last = b; return 'blob:x'; }; HTMLAnchorElement.prototype.click = function () { window.__downloads.push({name: this.download, blob: last}); }; })()`);
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const stored = async (k) => JSON.parse(await ev(`localStorage.getItem('${k}')`));
const dl = async (i = 0) => ev(`(async () => { const d = window.__downloads[${i}]; return d ? JSON.stringify({name: d.name, type: d.blob.type, text: await d.blob.text()}) : null; })()`).then(s => s && JSON.parse(s));
const modalOpen = () => ev(`document.getElementById('import-modal').classList.contains('is-open')`);
const chooseFile = (text, name = 'copy.json') => ev(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, {type: 'application/json'})); const i = document.getElementById('backup-file'); i.files = dt.files; i.dispatchEvent(new Event('change', {bubbles: true})); })()`).then(() => sleep(300));
const esc = () => send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
const copy = (over = {}) => JSON.stringify({ app: 'moi-den', version: 1, exportedAt: '2026-09-10T09:00:00.000Z',
  tasks: [{id:'t1', text:'Звонок (версия из копии)', date:'', category:'', priority:'normal', notes:'', completed:false}, {id:'t9', text:'Новая из копии <img src=x onerror=alert(1)>', date:'2026-09-25', time:'10:00', category:'Дом', priority:'low', notes:'заметка из копии', completed:false}],
  habits: [{id:'h1', text:'Зарядка (копия)', dates:['2026-09-17','2026-09-18']}, {id:'h9', text:'Из копии', dates:['2026-09-01'], archived:true}],
  mood: [{date:'2026-09-18', rating:1, note:'из копии'}, {date:'2026-09-17', rating:3, note:'новая запись'}],
  settings: {themeMode:'dark', userName:'Из копии'}, ...over });

await boot();
// ===== Карточка «Резервная копия» =====
check('в настройках есть карточка с кнопками «Скачать» и «Выбрать файл…», поле выбора файла спрятано визуально', (await n('#backup-download')) === 1 && (await n('#backup-choose')) === 1 && (await ev(`document.getElementById('backup-file').accept`)).includes('.json') && (await ev(`document.getElementById('backup-file').getBoundingClientRect().width <= 1`)) === true);

// ===== Скачивание =====
await ev(`document.getElementById('backup-download').click()`); await sleep(300);
let d0 = await dl(0);
check('«Скачать»: файл moi-den-backup-ГГГГ-ММ-ДД.json, тип application/json', /^moi-den-backup-\d{4}-\d\d-\d\d\.json$/.test(d0.name) && d0.type === 'application/json', d0.name + ' ' + d0.type);
const orig = { tasks: await stored('tasks'), habits: await stored('habits'), mood: await stored('moodData') };
const file0 = JSON.parse(d0.text);
check('в файле метка приложения, версия, дата, все данные и настройки (время, приоритет, заметка, график привычки — на месте)', file0.app === 'moi-den' && file0.version === 1 && !!file0.exportedAt && file0.tasks.length === 2 && file0.tasks[0].time === '14:30' && file0.tasks[0].priority === 'high' && file0.tasks[0].notes === 'Спросить про договор' && file0.habits[0].days.join() === '0,2,4' && file0.mood.length === 2 && file0.settings.userName === 'Мария');
check('статус скачивания со склонениями: «2 задачи, 1 привычка, 2 записи настроения»', (await q('#backup-status')) === 'Копия сохранена: 2 задачи, 1 привычка, 2 записи настроения.', await q('#backup-status'));

// ===== Ошибки выбора файла =====
const errs = [['', 'Файл пустой.'], ['{битый', 'это не JSON'], ['[1,2]', 'не похож на резервную копию'], ['{"a":1}', 'не похож на резервную копию'], [JSON.stringify({app:'moi-den', version: 5, tasks: []}), 'более новой версии']];
for (const [text, expected] of errs) {
  await chooseFile(text);
  check(`неверный файл «${text.slice(0, 14) || '(пустой)'}»: понятная ошибка, окно не открывается, role=alert, красный текст`, (await q('#backup-status')).includes(expected) && !(await modalOpen()) && (await ev(`document.getElementById('backup-status').getAttribute('role')`)) === 'alert' && (await ev(`document.getElementById('backup-status').classList.contains('hint--error')`)) === true, await q('#backup-status'));
}
check('данные после неудачных попыток не тронуты', JSON.stringify(await stored('tasks')) === JSON.stringify(orig.tasks));

// ===== Окно импорта =====
await chooseFile(copy());
check('корректный файл открывает окно с итогами: дата копии и счётчики', (await modalOpen()) && (await q('#import-summary')) === 'В копии от 10 сент.: 2 задачи, 2 привычки, 2 записи настроения.', await q('#import-summary'));
check('ошибка предыдущей попытки убрана, роль статуса вернулась к status', (await q('#backup-status')) === '' && (await ev(`document.getElementById('backup-status').getAttribute('role')`)) === 'status');
await esc(); await sleep(150);
check('Esc закрывает окно, данные не тронуты', !(await modalOpen()) && JSON.stringify(await stored('tasks')) === JSON.stringify(orig.tasks));
await chooseFile(copy());
check('тот же файл можно выбрать снова (поле сбрасывается)', await modalOpen());
await ev(`document.getElementById('import-cancel').click()`); await sleep(100);
await chooseFile(copy());
await ev(`document.getElementById('import-modal').dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))`); await sleep(100);
check('«Отмена» и клик по фону закрывают окно', !(await modalOpen()));

// ===== «Сначала скачать текущие данные» =====
await chooseFile(copy());
await ev(`document.getElementById('import-download').click()`); await sleep(300);
const pre = await dl(1);
check('«Сначала скачать текущие данные» сохраняет текущее состояние, окно остаётся открытым', JSON.parse(pre.text).tasks.length === 2 && JSON.parse(pre.text).settings.userName === 'Мария' && (await modalOpen()));
await esc(); await sleep(100);

// ===== Объединение =====
await chooseFile(copy());
await ev(`document.getElementById('import-merge').click()`); await sleep(300);
check('после «Объединить» показан итог: «добавлено: 1 задача, 1 привычка, 1 запись настроения, новых отметок: 1»', (await q('#backup-status')).startsWith('Данные объединены — добавлено: 1 задача, 1 привычка, 1 запись настроения, новых отметок у привычек: 1.') && !(await modalOpen()), await q('#backup-status'));
await sleep(1900);
const t = await stored('tasks'), h = await stored('habits'), m = await stored('moodData'), s = await stored('userSettings');
check('после перезагрузки: у общей задачи текущая версия, новая добавлена со всеми полями', t.length === 3 && t.find(x => x.id === 't1').text === 'Звонок клиенту' && t.find(x => x.id === 't9').time === '10:00' && t.find(x => x.id === 't9').priority === 'low' && t.find(x => x.id === 't9').notes === 'заметка из копии');
check('привычки: отметки объединены (17, 18, 19), название текущее, новая (архивная) добавлена', h.find(x => x.id === 'h1').dates.join() === '2026-09-17,2026-09-18,2026-09-19' && h.find(x => x.id === 'h1').text === 'Зарядка' && h.find(x => x.id === 'h9').archived === true);
check('настроение: существующая дата не перезаписана, новая добавлена, порядок по дате', m.map(x => `${x.date}:${x.rating}`).join() === '2026-09-17:3,2026-09-18:4,2026-09-19:5');
check('настройки при объединении не меняются (имя «Мария», тема светлая)', s.userName === 'Мария' && s.themeMode === 'light' && (await ev(`document.documentElement.dataset.theme`)) === 'light');
await ev(`location.hash = '#/tasks'`); await sleep(400);
check('в разделе «Задачи» видна новая задача, HTML из копии — как текст', (await q('#task-list')).includes('Новая из копии <img src=x onerror=alert(1)>') && (await n('#task-list img')) === 0);

// ===== Замена =====
await boot();
await chooseFile(copy());
await ev(`document.getElementById('import-replace').click()`); await sleep(150);
check('«Заменить всё»: первое нажатие только просит подтверждения, ничего не меняется', (await q('#import-replace')) === 'Точно заменить?' && (await modalOpen()) && JSON.stringify(await stored('tasks')) === JSON.stringify(orig.tasks));
await ev(`document.getElementById('import-replace').click()`); await sleep(300);
check('второе нажатие: итог замены и сообщение об обновлении страницы', (await q('#backup-status')).startsWith('Данные заменены копией: 2 задачи, 2 привычки, 2 записи настроения.') && (await q('#backup-status')).includes('обновится'), await q('#backup-status'));
await sleep(1900);
check('после перезагрузки данные равны копии (t1 — версия из копии, t2 исчезла)', (await stored('tasks')).map(x => x.id).join() === 't1,t9' && (await stored('tasks'))[0].text === 'Звонок (версия из копии)' && (await stored('habits')).map(x => x.id).join() === 'h1,h9' && (await stored('moodData')).length === 2);
check('настройки заменены: имя «Из копии», тёмная тема применилась', (await stored('userSettings')).userName === 'Из копии' && (await ev(`document.documentElement.dataset.theme`)) === 'dark');
check('подтверждение сбрасывается при новом открытии окна', await (async () => { await stubDownloads(); await ev(`location.hash = '#/settings'`); await sleep(300); await chooseFile(copy()); return (await q('#import-replace')) === 'Заменить всё'; })());
await esc();

// ===== Полный круг: скачать → очистить → восстановить =====
await boot();
await ev(`document.getElementById('backup-download').click()`); await sleep(300);
const roundtrip = (await dl(0)).text;
await ev(`localStorage.clear()`);
await ev(`location.reload()`); await sleep(1400); await stubDownloads();
await chooseFile(roundtrip);
await ev(`document.getElementById('import-replace').click()`); await ev(`document.getElementById('import-replace').click()`); await sleep(2200);
check('круг «скачать → очистить всё → восстановить»: задачи, привычки и настроение совпадают с исходными', JSON.stringify(await stored('tasks')) === JSON.stringify(orig.tasks) && JSON.stringify(await stored('habits')) === JSON.stringify(orig.habits) && JSON.stringify(await stored('moodData')) === JSON.stringify(orig.mood));
await ev(`location.hash = '#/habits'`); await sleep(400);
check('интерфейс после восстановления показывает данные (привычка с графиком и её чип)', (await q('#habit-list')).includes('Зарядка') && (await n('#habit-list .chip--mini')) === 1);

// ===== Мусор в файле отбрасывается =====
await boot();
await chooseFile(JSON.stringify({ tasks: [{id:'a', text:'ок'}, 'мусор', null, {id:'a', text:'дубль'}], habits: [5, {id:'h', text:'ок'}], mood: [{date:'плохая', rating:3}, {date:'2026-09-01', rating:4}], settings: 'x' }));
check('в итоге окна только корректные записи (1 задача, 1 привычка, 1 запись настроения)', (await q('#import-summary')) === 'В копии: 1 задача, 1 привычка, 1 запись настроения.', await q('#import-summary'));
await esc();

// ===== Большой файл =====
const big = JSON.stringify({ tasks: Array.from({ length: 4000 }, (_, i) => ({ id: 'b' + i, text: 'Задача ' + i, date: '2026-09-19', category: 'К' + (i % 7), priority: 'normal', notes: 'заметка '.repeat(20), completed: i % 3 === 0 })) });
const t0 = Date.now();
await chooseFile(big);
check('файл на 4000 задач разбирается быстро (< 3 с) и показывается в итогах', (await q('#import-summary')) === 'В копии: 4000 задач, 0 привычек, 0 записей настроения.' && Date.now() - t0 < 3000, `${Date.now() - t0} мс; ${await q('#import-summary')}`);
await ev(`document.getElementById('import-merge').click()`); await sleep(2200);
check('…и объединяется: всего 4002 задачи', (await stored('tasks')).length === 4002);

// ===== Экспорт по кнопке: время, приоритет, заметки =====
await boot();
await ev(`document.getElementById('open-export-dialog').click()`); await sleep(150);
await ev(`(() => { document.getElementById('export-period').value = 'month'; document.getElementById('export-category').value = 'tasks'; document.getElementById('export-format').value = 'md'; document.getElementById('confirm-export').click(); })()`); await sleep(300);
const ex = await dl(0);
check('экспорт Markdown из интерфейса: время, «важно» и заметка-цитата', /^export_month_tasks_\d{4}-\d\d-\d\d\.md$/.test(ex.name) && ex.text.includes('- [ ] 14:30 Звонок клиенту (Работа) — важно') && ex.text.includes('  > Спросить про договор'), ex.text);

// ===== Тема и ширина =====
await ev(`window.setThemeMode('dark')`); await sleep(200);
await chooseFile(copy());
check('тёмная тема: окно импорта тёмное', (await ev(`getComputedStyle(document.querySelector('#import-modal .modal__panel')).backgroundColor`)) === 'rgb(26, 26, 33)');
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
check('760 px: окно импорта и страница помещаются', (await ev(`(() => { const r = document.querySelector('#import-modal .modal__panel').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth; })()`)) === true);
await esc();
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);

    finish();
});
