import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'vitest';
import { en } from '../../src/locales/en';
import { getLanguage, isLanguage, locale, setLanguage, t, tp, translateDom } from '../../src/i18n';

afterEach(() => {
    setLanguage('ru');
    document.body.innerHTML = '';
});

describe('t: перевод строки', () => {
    it('по-русски возвращает исходный текст с подстановкой, по-английски — перевод', () => {
        assert.equal(t('Настройки'), 'Настройки');
        setLanguage('en');
        assert.equal(t('Настройки'), 'Settings');
    });

    it('нет перевода — остаётся русский, ничего не пропадает', () => {
        setLanguage('en');
        assert.equal(t('Такой строки нет в словаре'), 'Такой строки нет в словаре');
    });

    it('подставляет значения, неизвестное имя оставляет как есть', () => {
        assert.equal(t('Привет, {name}! {x}', { name: 'Аня' }), 'Привет, Аня! {x}');
    });
});

describe('tp: склонение', () => {
    const RU = '{n} задача|{n} задачи|{n} задач';

    it('русский: 1 / 2–4 / 5+ и исключения 11–14', () => {
        const forms = [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((n) => tp(RU, n));
        assert.deepEqual(forms, [
            '1 задача',
            '2 задачи',
            '4 задачи',
            '5 задач',
            '11 задач',
            '12 задач',
            '14 задач',
            '21 задача',
            '22 задачи',
            '25 задач',
            '101 задача',
            '111 задач',
        ]);
    });

    it('английский: две формы (1 и остальное), 0 — множественное', () => {
        const key = 'ТЕСТ {n} штука|ТЕСТ {n} штуки|ТЕСТ {n} штук'; // отдельный ключ: настоящий словарь не трогаем
        en[key] = '{n} item|{n} items';
        try {
            setLanguage('en');
            assert.deepEqual(
                [0, 1, 2, 21].map((n) => tp(key, n)),
                ['0 items', '1 item', '2 items', '21 items'],
            );
        } finally {
            delete en[key];
        }
    });

    it('склонение без перевода в словаре не ломается: число подставляется', () => {
        setLanguage('en');
        assert.match(tp(RU, 5), /5/);
    });
});

describe('translateDom: перевод готовой разметки', () => {
    const html = `<div>
        <button id="b"><i data-icon="download"></i> Экспортировать </button>
        <input id="i" placeholder="Что нужно сделать?" aria-label="Поиск" />
        <script id="s">var Задача = 1;</script>
        <p id="p">Строка без перевода в словаре</p>
    </div>`;

    it('переводит текст и подсказки, сохраняя иконки и пробелы по краям', () => {
        document.body.innerHTML = html;
        setLanguage('en');
        const b = document.getElementById('b') as HTMLElement;
        assert.ok(b.querySelector('i'), 'вложенный элемент на месте');
        assert.equal(b.textContent, ' Export ');
        const i = document.getElementById('i') as HTMLInputElement;
        assert.equal(i.placeholder, 'What needs to be done?');
        assert.equal(i.getAttribute('aria-label'), 'Search');
        assert.equal(document.getElementById('p')?.textContent, 'Строка без перевода в словаре');
        assert.equal(document.getElementById('s')?.textContent, 'var Задача = 1;', 'скрипты не трогаются');
    });

    it('возвращает русский обратно и повторный вызов ничего не портит', () => {
        document.body.innerHTML = html;
        setLanguage('en');
        translateDom();
        setLanguage('ru');
        assert.equal(document.getElementById('b')?.textContent, ' Экспортировать ');
        assert.equal((document.getElementById('i') as HTMLInputElement).placeholder, 'Что нужно сделать?');
    });
});

describe('язык страницы', () => {
    it('setLanguage ставит lang, признак готовности и название окна', () => {
        setLanguage('en');
        assert.equal(document.documentElement.lang, 'en');
        assert.equal(document.documentElement.getAttribute('data-lang'), 'en');
        assert.equal(document.documentElement.hasAttribute('data-i18n-ready'), true);
        assert.equal(document.title, 'My Day');
        assert.equal(locale(), 'en-US');
        setLanguage('ru');
        assert.equal(document.title, 'Мой день');
        assert.equal(locale(), 'ru-RU');
        assert.equal(getLanguage(), 'ru');
    });

    it('isLanguage принимает только известные языки', () => {
        assert.deepEqual(['ru', 'en', 'de', '', null, 5].map(isLanguage), [true, true, false, false, false, false]);
    });
});

describe('словарь охватывает всю разметку', () => {
    it('каждая русская строка из index.html (текст и подсказки) имеет английский перевод', () => {
        const source = readFileSync('index.html', 'utf8');
        document.body.innerHTML = (/<body[^>]*>([\s\S]*)<\/body>/.exec(source)?.[1] ?? '').replace(/<script[\s\S]*?<\/script>/g, '');
        const cyr = /[А-Яа-яЁё]/;
        const missing: string[] = [];
        const check = (text: string): void => {
            const core = text.replace(/\s+/g, ' ').trim();
            if (core && cyr.test(core) && !(core in en)) missing.push(core);
        };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!/^(SCRIPT|STYLE)$/.test(n.parentElement?.tagName ?? '')) check(n.nodeValue ?? '');
        }
        document.body
            .querySelectorAll('*')
            .forEach((el) => ['placeholder', 'aria-label', 'title', 'alt'].forEach((a) => check(el.getAttribute(a) ?? '')));
        assert.deepEqual([...new Set(missing)], []);
    });

    it('в английских переводах не осталось кириллицы (кроме названия языка «Русский»)', () => {
        const leftovers = Object.entries(en).filter(([ru, translated]) => /[А-Яа-яЁё]/.test(translated) && translated !== ru);
        assert.deepEqual(leftovers, []);
    });
});

describe('словарь охватывает весь код', () => {
    it('каждая строка в tr(…) и tp(…) в src/ имеет английский перевод', async () => {
        const { readdirSync, readFileSync: read, statSync } = await import('node:fs');
        const files: string[] = [];
        const walk = (dir: string): void => {
            for (const name of readdirSync(dir)) {
                const path = `${dir}/${name}`;
                if (statSync(path).isDirectory()) walk(path);
                else if (path.endsWith('.ts') && !path.endsWith('i18n.ts') && !path.includes('/locales/')) files.push(path);
            }
        };
        walk('src');
        const literal = /\b(?:tr|tp)\(\s*'((?:[^'\\]|\\.)*)'/g;
        const missing: string[] = [];
        for (const file of files) {
            for (const match of read(file, 'utf8').matchAll(literal)) {
                const key = match[1].replace(/\\'/g, "'");
                if (/[А-Яа-яЁё]/.test(key) && !(key in en)) missing.push(`${file}: ${key}`);
            }
        }
        assert.deepEqual(missing, []);
    });
});
