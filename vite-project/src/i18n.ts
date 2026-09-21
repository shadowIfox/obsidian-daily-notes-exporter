// i18n.ts — язык интерфейса: русский (по умолчанию) и английский.
//
// Как это устроено («как gettext»): ключ — сам русский текст. Русский остаётся в разметке и в коде как источник,
// а перевод лежит в словаре locales/en.ts. Нет перевода — показывается русский, поэтому ничего не пропадает.
//  • t('Привет, {name}', { name }) — строка с подстановкой;
//  • tp('{n} задача|{n} задачи|{n} задач', n) — склонение (по-русски три формы, в словаре для английского — «one|other»);
//  • translateDom() переводит готовую разметку (текст и подсказки), в HTML ничего размечать не нужно;
//  • язык меняется перезагрузкой окна (см. settings.ts), поэтому разделы заново перерисовывать не нужно.

import { en } from './locales/en';

export type Language = 'ru' | 'en';
export const LANGUAGES: readonly Language[] = ['ru', 'en'];
export const DEFAULT_LANGUAGE: Language = 'ru';

const DICTIONARIES: Record<Language, Record<string, string>> = { ru: {}, en };

let current: Language = DEFAULT_LANGUAGE;

export function getLanguage(): Language {
    return current;
}

/** Локаль для Intl и toLocaleDateString. */
export function locale(): string {
    return current === 'en' ? 'en-US' : 'ru-RU';
}

export function isLanguage(value: unknown): value is Language {
    return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
    return vars ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : text;
}

/** Перевод строки. Русский текст — ключ; {имя} заменяется значением из vars. */
export function t(text: string, vars?: Vars): string {
    return fill(DICTIONARIES[current][text] ?? text, vars);
}

/** Номер формы: русский — 1 / 2–4 / 5+, английский — 1 / остальное. */
function formIndex(n: number, forms: number): number {
    if (current === 'en' || forms < 3) return Math.min(n === 1 ? 0 : 1, forms - 1);
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 0;
    return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
}

/** Склонение по числу: forms — «форма1|форма2|форма3» (русский ключ); {n} подставляется само. */
export function tp(forms: string, n: number, vars?: Vars): string {
    const parts = (DICTIONARIES[current][forms] ?? forms).split('|');
    return fill(parts[formIndex(n, parts.length)], { n, ...vars });
}

// ===== Перевод готовой разметки =====

const CYRILLIC = /[А-Яа-яЁё]/;
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'];
// Оригинальный (русский) текст запоминается, чтобы перевод можно было применять повторно и возвращать обратно
const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Record<string, string>>();

/** Переводит строку с сохранением пробелов по краям и схлопыванием переносов внутри. */
function translateKeepingSpaces(original: string): string {
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(original) as RegExpExecArray;
    const translated = DICTIONARIES[current][core.replace(/\s+/g, ' ')];
    return current === 'ru' || translated === undefined ? original : lead + translated + trail;
}

/** Переводит текст и подсказки (placeholder, aria-label, title, alt) внутри root. Русский язык возвращает оригиналы. */
export function translateDom(root: Node = document.body): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
            /^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName ?? '') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const original = textOriginals.get(node) ?? node.nodeValue ?? '';
        if (!CYRILLIC.test(original)) continue;
        textOriginals.set(node, original);
        node.nodeValue = translateKeepingSpaces(original);
    }

    const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...(root as ParentNode).querySelectorAll('*')];
    for (const el of elements) {
        for (const name of TRANSLATABLE_ATTRIBUTES) {
            const saved = attributeOriginals.get(el)?.[name];
            const original = saved ?? el.getAttribute(name) ?? '';
            if (!CYRILLIC.test(original)) continue;
            attributeOriginals.set(el, { ...attributeOriginals.get(el), [name]: original });
            el.setAttribute(name, translateKeepingSpaces(original));
        }
    }
}

/** Включает язык: запоминает его, ставит lang у страницы и переводит разметку и заголовок окна. */
export function setLanguage(language: Language): void {
    current = language;
    document.documentElement.lang = language;
    document.documentElement.setAttribute('data-lang', language);
    if (typeof document.body !== 'undefined' && document.body) translateDom(document.body);
    // название окна («Мой день») — в <title>, вне body
    const titleKey = 'Мой день';
    document.title = language === 'ru' ? titleKey : (DICTIONARIES[language][titleKey] ?? titleKey);
    document.documentElement.setAttribute('data-i18n-ready', '');
}
