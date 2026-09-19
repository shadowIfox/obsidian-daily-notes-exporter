// @ts-nocheck — перенесено из временного скрипта (smoke7.mjs) без изменений; типы появятся при переписывании на локаторы Playwright.
import { test } from '@playwright/test';
import { createHarness } from '../harness';

test("неделя на главной и правка задач", async ({ page }) => {
    const { sleep, ev, send, check, go, finish } = createHarness(page);

const fmt = `const p = n => String(n).padStart(2,'0'); const day = k => { const d = new Date(); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };`;
// даты относительно понедельника текущей недели — тест верен в любой день
const seed = `(() => { ${fmt} localStorage.clear();
  localStorage.setItem('userSettings', JSON.stringify({themeMode:'light', userName:'Мария'}));
  const off = (new Date().getDay() + 6) % 7;        // сколько дней прошло с понедельника
  const mon = k => day(k - off);                     // mon(0) — понедельник этой недели
  const T = (id, text, date, o = {}) => ({id, text, date, category: o.cat ?? '', priority: o.pr ?? 'normal', notes: o.notes ?? '', time: o.time, completed: !!o.done, completedAt: o.done ? date : undefined});
  localStorage.setItem('tasks', JSON.stringify([
    T('t1','Пн активная', mon(0), {time:'09:00'}),
    T('t2','Вс активная', mon(6)),
    T('t3','Ср сделана', mon(2), {done: true}),
    T('t4','След. неделя', mon(7)),
    T('t5','Пред. неделя', mon(-1)),
    T('t6','Без даты', '')]));
})()`;
const boot = async (custom, hash = 'dashboard') => { await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900); await ev(custom ?? seed); await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/' + hash }); await sleep(300); await ev('location.reload()'); await sleep(1400); };
const q = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const n = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const titles = (sel) => ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent).join(' | ')`);
const tab = async (f) => { await ev(`document.querySelector('#dash-list-filter [data-filter="${f}"]').click()`); await sleep(250); };
const stored = async () => JSON.parse(await ev(`localStorage.getItem('tasks')`));
const setv = (sel, v) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', {bubbles: true})); })()`);

await boot();
// ===== Главная: вкладка «Неделя» =====
check('вкладка «Неделя» — активные задачи недели по датам, выполненная в конце; прошлая/следующая недели и «без даты» не входят', (await tab('week'), await titles('#dash-task-list .pick__title')) === 'Пн активная | Вс активная | Ср сделана', await titles('#dash-task-list .pick__title'));
check('выполненная строка приглушена и перечёркнута (pick--done)', (await n('#dash-task-list .pick--done')) === 1 && (await ev(`getComputedStyle(document.querySelector('#dash-task-list .pick--done .pick__title')).textDecorationLine`)) === 'line-through');
check('вкладка «Неделя» подсказывает про Пн–Вс (title)', (await ev(`document.querySelector('#dash-list-filter [data-filter="week"]').title`)).includes('понедельника'));
await tab('overdue');
const off = await ev(`(new Date().getDay() + 6) % 7`);
check('«Просрочено» — все просроченные (в том числе из прошлой недели); «Пн активная» — только если сегодня не понедельник', (await titles('#dash-task-list .pick__title')).includes('Пред. неделя') && (await titles('#dash-task-list .pick__title')).includes('Пн активная') === (off > 0), await titles('#dash-task-list .pick__title'));
await tab('today');
check('«Сегодня» не показывает выполненные (как раньше)', (await n('#dash-task-list .pick--done')) === 0);
await tab('week');
await ev(`document.querySelector('#dash-task-list .pick--done input.check').click()`); await sleep(300);
check('снял отметку у выполненной: задача встала по дате между активными (Пн → Ср → Вс)', (await titles('#dash-task-list .pick__title')) === 'Пн активная | Ср сделана | Вс активная' && (await n('#dash-task-list .pick--done')) === 0, await titles('#dash-task-list .pick__title'));
check('подпись в карточке дедлайнов: «ближ. 7 дней»', (await titles('.card--blue .stat-card__label')).includes('ближ. 7 дней'));
await boot(`localStorage.clear()`);
await tab('week');
check('пустая неделя: «На этой неделе задач нет.»', (await q('#dash-task-empty')) === 'На этой неделе задач нет.');

// ===== Страница «Задачи»: форма =====
await boot(undefined, 'tasks');
check('в форме есть время, приоритет (по умолчанию «Обычный») и заметка', (await n('#task-time')) === 1 && (await n('#add-task-form textarea#task-notes')) === 1 && (await n('input[name="task-priority"]')) === 3 && (await ev(`document.querySelector('input[name="task-priority"]:checked').value`)) === 'normal');
check('раскладка формы 1440: категория/приоритет во втором ряду, заметка и кнопка — в третьем на одной линии', (await ev(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const c = r('.task-form__category'), p = r('.task-form__priority'), n = r('.task-form__notes'), b = r('.task-form__submit'), t = r('.task-form__text'), d = r('.task-form__date'), tm = r('.task-form__time'); return Math.abs(c.top - p.top) < 30 && n.top > c.bottom && Math.abs(b.bottom - n.bottom) < 2 && Math.abs(t.top - d.top) < 30 && Math.abs(d.top - tm.top) < 30 && b.left >= n.right - 1 && document.documentElement.scrollWidth <= window.innerWidth; })()`)) === true);
await ev(`(() => { document.getElementById('task-text').value = '  Звонок клиенту  '; document.getElementById('task-time').value = '14:30'; document.getElementById('task-category').value = 'Работа'; document.querySelector('input[name="task-priority"][value="high"]').click(); document.getElementById('task-notes').value = 'Спросить про <b>договор</b>'; document.getElementById('add-task-form').requestSubmit(); })()`); await sleep(300);
let rec = (await stored()).find(t => t.text === 'Звонок клиенту');
const today = await ev(`(async () => { const m = await import('/src/dates.ts'); return m.todayStr(); })()`);
check('создана с временем, приоритетом и заметкой; время без даты → дата = сегодня', !!rec && rec.time === '14:30' && rec.priority === 'high' && rec.notes === 'Спросить про <b>договор</b>' && rec.date === today && rec.category === 'Работа' && rec.completed === false, JSON.stringify(rec));
const row = `[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes('Звонок клиенту'))`;
check('в строке: бейдж дедлайна со временем, «Важно», значок заметки, кнопки «Изменить» и «Удалить»', (await ev(`(() => { const li = ${row}; return li.querySelector('.badge').textContent.includes('14:30') && li.querySelector('.badge--high').textContent === 'Важно' && !!li.querySelector('.task__note') && !!li.querySelector('[aria-label="Изменить задачу"]') && !!li.querySelector('[aria-label="Удалить задачу"]'); })()`)) === true);
check('заметка в подсказке значка — как текст, HTML не рендерится', (await ev(`${row}.querySelector('.task__note').getAttribute('data-tip')`)) === 'Спросить про <b>договор</b>' && (await ev(`${row}.querySelectorAll('b').length`)) === 0);
await ev(`${row}.querySelector('.task__note').dispatchEvent(new MouseEvent('mouseover', {bubbles: true, clientX: 300, clientY: 300}))`); await sleep(100);
check('подсказка по наведению на значок заметки показывает текст', (await q('.tooltip')) === 'Спросить про <b>договор</b>' && (await ev(`document.querySelector('.tooltip').hidden`)) === false);
check('форма очищена: приоритет снова «Обычный», время и заметка пусты', (await ev(`document.querySelector('input[name="task-priority"]:checked').value`)) === 'normal' && (await ev(`document.getElementById('task-time').value + document.getElementById('task-notes').value`)) === '');
await ev(`(() => { document.getElementById('task-text').value = 'Просто задача'; document.getElementById('add-task-form').requestSubmit(); })()`); await sleep(300);
rec = (await stored()).find(t => t.text === 'Просто задача');
check('минимальная задача: приоритет «normal», заметка пуста, времени и даты нет', rec.priority === 'normal' && rec.notes === '' && rec.time === undefined && rec.date === '', JSON.stringify(rec));
check('у обычной задачи нет ни «Важно», ни значка заметки', (await ev(`(() => { const li = [...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('Просто задача')); return !li.querySelector('.badge--high') && !li.querySelector('.task__note'); })()`)) === true);

// ===== Редактирование =====
const editBtn = (text) => ev(`[...document.querySelectorAll('#task-list .task')].find(li => li.textContent.includes(${JSON.stringify(text)})).querySelector('[aria-label="Изменить задачу"]').click()`);
await editBtn('Звонок клиенту'); await sleep(200);
check('«Изменить» открывает окно в режиме правки: заголовок, кнопка «Сохранить», поля заполнены', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === true && (await q('#task-modal-title')) === 'Редактировать задачу' && (await q('#task-modal-submit')) === 'Сохранить' && (await ev(`JSON.stringify([tmv('tm-text'), tmv('tm-time'), tmv('tm-category'), tmv('tm-notes'), document.querySelector('input[name="tm-priority"]:checked').value, tmv('tm-date')]); function tmv(id) { return document.getElementById(id).value; }`)) === JSON.stringify(['Звонок клиенту', '14:30', 'Работа', 'Спросить про <b>договор</b>', 'high', today]));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(150);
check('Esc закрывает окно без изменений', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === false && (await stored()).find(t => t.text === 'Звонок клиенту').time === '14:30');
await editBtn('Звонок клиенту'); await sleep(150);
await setv('#tm-text', '   ');
await ev(`document.getElementById('task-modal-form').requestSubmit()`); await sleep(200);
check('пустое название при правке не сохраняется (окно открыто)', (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === true && (await stored()).some(t => t.text === 'Звонок клиенту'));
const idBefore = (await stored()).find(t => t.text === 'Звонок клиенту').id;
await ev(`(() => { document.getElementById('tm-text').value = 'Звонок клиенту (перенесён)'; document.getElementById('tm-time').value = '16:00'; document.getElementById('tm-category').value = 'Клиенты'; document.querySelector('input[name="tm-priority"][value="low"]').click(); document.getElementById('tm-notes').value = 'Новая заметка'; document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(300);
rec = (await stored()).find(t => t.id === idBefore);
check('сохранение правки: все поля обновлены, id тот же, окно закрыто', rec.text === 'Звонок клиенту (перенесён)' && rec.time === '16:00' && rec.category === 'Клиенты' && rec.priority === 'low' && rec.notes === 'Новая заметка' && (await ev(`document.getElementById('task-modal').classList.contains('is-open')`)) === false, JSON.stringify(rec));
check('строка перерисована: время 16:00, «Важно» исчезло, категория новая, заметка есть', (await ev(`(() => { const li = [...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('перенесён')); return li.querySelector('.badge').textContent.includes('16:00') && !li.querySelector('.badge--high') && li.textContent.includes('Клиенты') && li.querySelector('.task__note').getAttribute('data-tip') === 'Новая заметка'; })()`)) === true);
await editBtn('перенесён'); await sleep(150);
await ev(`(() => { document.getElementById('tm-time').value = ''; document.getElementById('tm-notes').value = ''; document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(300);
rec = (await stored()).find(t => t.id === idBefore);
check('очистка времени и заметки убирает их (время не остаётся «пустой строкой»)', !rec.time && rec.notes === '' && (await ev(`(() => { const li = [...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('перенесён')); return !li.querySelector('.task__note') && !li.querySelector('.badge').textContent.includes(':'); })()`)) === true, JSON.stringify(rec));
// правка выполненной задачи сохраняет её статус
await ev(`[...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('перенесён')).querySelector('input.check').click()`); await sleep(250);
const doneAt = (await stored()).find(t => t.id === idBefore).completedAt;
await editBtn('перенесён'); await sleep(150);
await setv('#tm-text', 'Готово и переименовано');
await ev(`document.getElementById('task-modal-form').requestSubmit()`); await sleep(300);
rec = (await stored()).find(t => t.id === idBefore);
check('правка выполненной задачи не сбрасывает «выполнено» и дату выполнения', rec.completed === true && rec.completedAt === doneAt && !!doneAt && (await ev(`[...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('Готово и переименовано')).classList.contains('task--done')`)) === true);
// окно после правки снова «новая задача»
await ev(`location.hash = '#/dashboard'`); await sleep(400);
await ev(`document.getElementById('cal-add').click()`); await sleep(150);
check('после правки окно из календаря снова «Новая задача»: пустые поля, приоритет «Обычный»', (await q('#task-modal-title')) === 'Новая задача' && (await q('#task-modal-submit')) === 'Добавить' && (await ev(`document.getElementById('tm-text').value + document.getElementById('tm-notes').value`)) === '' && (await ev(`document.querySelector('input[name="tm-priority"]:checked').value`)) === 'normal');
await ev(`(() => { document.getElementById('tm-text').value = 'Из календаря'; document.getElementById('tm-notes').value = 'Заметка из календаря'; document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(300);
check('создание из календаря тоже сохраняет заметку и показывает её в деталях', (await stored()).find(t => t.text === 'Из календаря').notes === 'Заметка из календаря' && (await ev(`document.querySelector('#d-notes').value`)) === 'Заметка из календаря');
// правка видна на главной
await ev(`location.hash = '#/tasks'`); await sleep(300);
await ev(`(() => { const li = [...document.querySelectorAll('#task-list .task')].find(l => l.textContent.includes('Просто задача')); li.querySelector('[aria-label="Изменить задачу"]').click(); })()`); await sleep(150);
await ev(`(() => { document.getElementById('tm-date').value = '${today}'; document.getElementById('tm-time').value = '12:15'; document.querySelector('input[name="tm-priority"][value="high"]').click(); document.getElementById('task-modal-form').requestSubmit(); })()`); await sleep(300);
await ev(`location.hash = '#/dashboard'`); await sleep(400);
check('правка со страницы «Задачи» видна в расписании дня на главной (12:15)', (await q('#tl')).includes('12:15') && (await q('#tl')).includes('Просто задача'));

// ===== Раскладка, тёмная тема, ошибки =====
await ev(`location.hash = '#/tasks'`); await sleep(300);
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
check('900 px: форма без горизонтального скролла, поля не налезают друг на друга', (await ev(`(() => { const rs = ['.task-form__text','.task-form__date','.task-form__time','.task-form__category','.task-form__priority','.task-form__notes','.task-form__submit'].map(s => document.querySelector(s).getBoundingClientRect()); const overlap = rs.some((a, i) => rs.some((b, j) => i < j && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)); return !overlap && document.documentElement.scrollWidth <= window.innerWidth; })()`)) === true);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
await ev(`window.setThemeMode('dark')`); await sleep(200);
check('тёмная тема: значок заметки и поля формы читаются (цвет текста светлый)', (await ev(`getComputedStyle(document.getElementById('task-notes')).color`)) === 'rgb(240, 238, 232)');

    finish();
});
