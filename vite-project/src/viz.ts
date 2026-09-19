// viz.ts — мини-графики для карточек главной (HTML и SVG, без Chart.js).
// Цвета берутся из CSS (currentColor / --on-pastel), поэтому тема меняется без JS.
// Весь пользовательский текст (названия категорий и привычек) экранируется через escapeHtml.

import { addDays, formatDateShort, weekdayIndex } from './dates';
import type { DayCount, MoodSeries } from './stats';
import { escapeHtml as esc } from './utils/html';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Столбики «выполнено по дням»: пустой день — точка, сегодняшний — подсвечен подписью. */
export function renderBars(days: DayCount[]): string {
    const max = Math.max(1, ...days.map((d) => d.count));
    const maxHeight = 88; // px

    const cols = days.map((d, i) => {
        const isToday = i === days.length - 1;
        const bar =
            d.count > 0
                ? `<span class="bars__value">${d.count}</span><span class="bars__bar" style="height:${Math.max(12, Math.round((d.count / max) * maxHeight))}px"></span>`
                : '<span class="bars__dot"></span>';
        return `<div class="bars__col${isToday ? ' bars__col--today' : ''}" data-tip="${formatDateShort(d.date)}: ${d.count}">${bar}<span class="bars__label">${WEEKDAYS[weekdayIndex(d.date)]}</span></div>`;
    });

    return `<div class="bars" role="img" aria-label="Выполнено задач по дням за неделю">${cols.join('')}</div>`;
}

const f = (n: number): string => n.toFixed(1);
const clamp = (n: number, a: number, b: number): number => Math.min(Math.max(n, a), b);

/** Плавная линия оценок настроения с пунктирной отметкой на последней записи. */
export function renderLine(series: MoodSeries, today: string, width = 400): string {
    if (series.points.length === 0) {
        return `<p class="viz__empty">Оценок за ${series.days} дней пока нет</p>`;
    }

    const W = width;
    const H = 124;
    const padX = 16;
    const top = 28;
    const bottom = 30;
    const plotW = W - 2 * padX;
    const plotH = H - top - bottom;

    const pts = series.points.map((p) => ({
        x: padX + (series.days <= 1 ? 0 : (p.i * plotW) / (series.days - 1)),
        y: top + ((5 - p.rating) / 4) * plotH,
        ...p,
    }));

    // Кривая через точки; контрольные точки ограничены, чтобы линия не «перелетала» между значениями
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let k = 0; k < pts.length - 1; k++) {
        const p0 = pts[k - 1] ?? pts[k];
        const p1 = pts[k];
        const p2 = pts[k + 1];
        const p3 = pts[k + 2] ?? p2;
        const lo = Math.min(p1.y, p2.y);
        const hi = Math.max(p1.y, p2.y);
        const c1y = clamp(p1.y + (p2.y - p0.y) / 6, lo, hi);
        const c2y = clamp(p2.y - (p3.y - p1.y) / 6, lo, hi);
        d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(c1y)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
    }

    const last = pts[pts.length - 1];
    const first = pts[0];
    const baseline = H - bottom + 4;
    const lastLabel = last.date === today ? 'сегодня' : formatDateShort(last.date);
    const lastAnchor = last.x > W - 48 ? 'end' : 'middle';
    const showFirstLabel = last.x - padX > 110;

    return `<svg class="line-viz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Настроение за ${series.days} дней">
  <line x1="${padX}" y1="${baseline}" x2="${W - padX}" y2="${baseline}" stroke="currentColor" stroke-opacity=".18" />
  <path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  <line x1="${f(last.x)}" y1="${f(last.y + 8)}" x2="${f(last.x)}" y2="${baseline}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 4" stroke-opacity=".7" />
  <circle cx="${f(last.x)}" cy="${f(last.y)}" r="5.5" fill="currentColor" />
  <text x="${f(last.x)}" y="${f(last.y - 12)}" text-anchor="${last.x > W - 24 ? 'end' : 'middle'}" font-size="13" font-weight="800" fill="currentColor">${last.rating}</text>
  ${showFirstLabel ? `<text x="${padX}" y="${H - 8}" font-size="11" font-weight="600" fill="currentColor" fill-opacity=".6">${formatDateShort(first.date)}</text>` : ''}
  <text x="${f(last.x)}" y="${H - 8}" text-anchor="${lastAnchor}" font-size="11" font-weight="800" fill="currentColor">${lastLabel}</text>
</svg>`;
}

// ===================================================================
// Графики страниц «Аналитика», «Привычки», «Настроение»
// Без осей и сетки: только данные, лёгкая базовая линия и подсказки при наведении.
// ===================================================================

export type ColumnItem = {
    label: string;
    value: number;
    tip: string;
    color?: string;    // CSS-цвет столбца (например, var(--mood-3)); по умолчанию — «чернильный»
    accent?: boolean;  // подсветить акцентным цветом (например, максимум)
};

/** Столбчатая диаграмма (HTML/CSS): ширина подстраивается под контейнер сама. */
export function renderColumns(
    items: ColumnItem[],
    o: { height?: number; max?: number; showValues?: boolean; labelAt?: (index: number) => boolean } = {},
): string {
    const height = o.height ?? 180;
    const max = Math.max(o.max ?? 0, ...items.map((i) => i.value), 1);
    const dense = items.length > 14;

    const cols = items.map((it, idx) => {
        const px = it.value > 0 ? Math.max(4, Math.round((it.value / max) * height)) : 0;
        const value = o.showValues && it.value > 0 ? `<span class="col__value">${it.value}</span>` : '';
        const bar = `<span class="col__bar${it.accent ? ' col__bar--accent' : ''}" style="height:${px}px${it.color ? `;background:${it.color}` : ''}"></span>`;
        const label = !o.labelAt || o.labelAt(idx) ? esc(it.label) : '';
        return `<div class="col" data-tip="${esc(it.tip)}"><div class="col__track" style="height:${height}px">${value}${bar}</div><span class="col__label">${label}</span></div>`;
    });

    return `<div class="cols${dense ? ' cols--dense' : ''}" role="img" aria-label="Столбчатая диаграмма">${cols.join('')}</div>`;
}

export type HBarItem = { label: string; value: number; valueText: string; tip?: string };

/** Горизонтальные полосы «название — полоса — значение». */
export function renderHBars(items: HBarItem[], max?: number): string {
    const m = Math.max(max ?? 0, ...items.map((i) => i.value), 1);
    const rows = items.map((it) => {
        const pct = it.value > 0 ? Math.max(3, Math.round((it.value / m) * 100)) : 0;
        return `<div class="hbar"${it.tip ? ` data-tip="${esc(it.tip)}"` : ''}><span class="hbar__label">${esc(it.label)}</span><span class="hbar__track"><span class="hbar__fill" style="width:${pct}%"></span></span><span class="hbar__value">${esc(it.valueText)}</span></div>`;
    });
    return `<div class="hbars">${rows.join('')}</div>`;
}

export type HeatRow = { label: string; cells: number[]; tips: string[]; value: string; off?: boolean[] };

/** Тепловая карта: строка на привычку, ячейка на день (или неделю); интенсивность 0…1. */
export function renderHeatmap(rows: HeatRow[], firstLabel: string, lastLabel: string): string {
    const cols = rows[0]?.cells.length ?? 0;
    const body = rows.map((r) => {
        const cells = r.cells
            .map((v, i) => `<span class="heat__cell${r.off?.[i] ? ' heat__cell--off' : ''}" style="--v:${v.toFixed(2)}" data-tip="${esc(r.tips[i] ?? '')}"></span>`)
            .join('');
        return `<div class="heat__row"><span class="heat__label">${esc(r.label)}</span><div class="heat__cells" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cells}</div><span class="heat__value">${esc(r.value)}</span></div>`;
    });
    return `<div class="heat">${body.join('')}<div class="heat__axis"><span></span><div class="heat__axis-labels"><span>${esc(firstLabel)}</span><span>${esc(lastLabel)}</span></div><span></span></div></div>`;
}

export type DonutSegment = { label: string; value: number; color: string };

/** Кольцевая диаграмма с текстом в центре. */
export function renderDonut(segments: DonutSegment[], centerTop: string, centerBottom: string): string {
    const size = 180;
    const stroke = 26;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((a, s) => a + s.value, 0);
    const gap = 3;

    let arcs = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--card-alt)" stroke-width="${stroke}" />`;
    if (total > 0) {
        let offset = 0;
        arcs = '';
        for (const seg of segments.filter((x) => x.value > 0)) {
            const len = (seg.value / total) * c;
            const dash = Math.max(len - (segments.filter((x) => x.value > 0).length > 1 ? gap : 0), 0.1);
            arcs += `<circle class="donut__seg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${seg.color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" data-tip="${esc(`${seg.label}: ${seg.value}`)}" />`;
            offset += len;
        }
    }

    return `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="Распределение оценок">
  <g transform="rotate(-90 ${size / 2} ${size / 2})">${arcs}</g>
  <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" font-size="34" font-weight="800" fill="currentColor">${esc(centerTop)}</text>
  <text x="${size / 2}" y="${size / 2 + 26}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" fill-opacity=".6">${esc(centerBottom)}</text>
</svg>`;
}

/** Линия настроения на всю ширину контейнера: точки в цвет оценки, пунктир среднего, без сетки. */
export function renderMoodArea(
    series: MoodSeries,
    o: { width: number; height: number; avg: number | null; today: string; notes?: Map<string, string> },
): string {
    const { width: W, height: H } = o;
    const padL = 22;
    const padR = o.avg === null ? 14 : 54; // справа оставляем место под подпись среднего
    const top = 16;
    const bottom = 30;
    const plotW = W - padL - padR;
    const plotH = H - top - bottom;
    const x = (i: number) => padL + (series.days <= 1 ? 0 : (i * plotW) / (series.days - 1));
    const y = (r: number) => top + ((5 - r) / 4) * plotH;

    const pts = series.points.map((p) => ({ ...p, x: x(p.i), y: y(p.rating) }));

    let line = '';
    let area = '';
    if (pts.length > 1) {
        line = `M${f(pts[0].x)} ${f(pts[0].y)}`;
        for (let k = 0; k < pts.length - 1; k++) {
            const p0 = pts[k - 1] ?? pts[k];
            const p1 = pts[k];
            const p2 = pts[k + 1];
            const p3 = pts[k + 2] ?? p2;
            const lo = Math.min(p1.y, p2.y);
            const hi = Math.max(p1.y, p2.y);
            const c1y = clamp(p1.y + (p2.y - p0.y) / 6, lo, hi);
            const c2y = clamp(p2.y - (p3.y - p1.y) / 6, lo, hi);
            line += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(c1y)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
        }
        const bottomY = H - bottom;
        area = `${line} L${f(pts[pts.length - 1].x)} ${bottomY} L${f(pts[0].x)} ${bottomY} Z`;
    }

    // Подписи оси Y (только цифры, без линий)
    const yLabels = [1, 2, 3, 4, 5]
        .map((r) => `<text x="${padL - 10}" y="${f(y(r) + 4)}" text-anchor="end" font-size="11" font-weight="700" fill="currentColor" fill-opacity=".45">${r}</text>`)
        .join('');

    // Подписи оси X: не чаще, чем раз в ~80 px, последняя — «сегодня»
    const maxLabels = Math.max(2, Math.floor(plotW / 80));
    const step = Math.max(1, Math.ceil((series.days - 1) / (maxLabels - 1)));
    let xLabels = '';
    for (let i = series.days - 1; i >= 0; i -= step) {
        const date = addDays(o.today, i - (series.days - 1));
        const label = i === series.days - 1 ? 'сегодня' : formatDateShort(date);
        const anchor = i === 0 ? 'start' : i === series.days - 1 ? 'end' : 'middle';
        xLabels += `<text x="${f(x(i))}" y="${H - 8}" text-anchor="${anchor}" font-size="11" font-weight="${i === series.days - 1 ? 800 : 600}" fill="currentColor" fill-opacity="${i === series.days - 1 ? 1 : 0.55}">${label}</text>`;
    }

    const avgLine =
        o.avg === null
            ? ''
            : `<line x1="${padL}" y1="${f(y(o.avg))}" x2="${W - padR + 4}" y2="${f(y(o.avg))}" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="4 5" />
  <text x="${W - padR + 10}" y="${f(y(o.avg) + 4)}" text-anchor="start" font-size="11" font-weight="800" fill="currentColor" fill-opacity=".7">ср. ${o.avg}</text>`;

    const dots = pts
        .map((p) => {
            const note = o.notes?.get(p.date);
            const tip = `${formatDateShort(p.date)}: ${p.rating}${note ? ` — ${note.length > 60 ? note.slice(0, 60) + '…' : note}` : ''}`;
            return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="6" style="fill:var(--mood-${p.rating});stroke:var(--card);stroke-width:2.5" data-tip="${esc(tip)}" />`;
        })
        .join('');

    return `<svg class="area" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Настроение за ${series.days} дней">
  ${yLabels}
  <line x1="${padL}" y1="${H - bottom + 4}" x2="${W - padR}" y2="${H - bottom + 4}" stroke="currentColor" stroke-opacity=".12" />
  ${area ? `<path d="${area}" fill="currentColor" fill-opacity=".07" />` : ''}
  ${avgLine}
  ${line ? `<path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
  ${dots}
  ${xLabels}
</svg>`;
}

// ===================================================================
// Адаптивные графики и подсказки
// ===================================================================

const observers = new Map<Element, ResizeObserver>();

/** Перерисовывает график при изменении ширины контейнера (SVG рисуется в реальных пикселях — текст не масштабируется). */
export function mountResponsive(el: HTMLElement, render: (width: number) => string): void {
    observers.get(el)?.disconnect();
    let last = 0;
    const draw = () => {
        const w = Math.floor(el.clientWidth);
        if (w > 0 && w !== last) {
            last = w;
            el.innerHTML = render(w);
        }
    };
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    observers.set(el, ro);
    draw(); // сразу, чтобы при перерисовке страницы график не мигал пустым
}

/** Отключает наблюдатели для графиков внутри root (вызывать перед перерисовкой страницы). */
export function unmountResponsive(root: Node): void {
    for (const [el, ro] of observers) {
        if (root.contains(el)) {
            ro.disconnect();
            observers.delete(el);
        }
    }
}

/** Одна общая подсказка для всех элементов с data-tip. */
export function initTooltips(): void {
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);

    let current: Element | null = null;
    const move = (e: MouseEvent) => {
        const pad = 12;
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;
        const left = Math.min(Math.max(e.clientX - w / 2, pad), window.innerWidth - w - pad);
        const above = e.clientY - h - 14;
        tip.style.left = `${left}px`;
        tip.style.top = `${above < pad ? e.clientY + 18 : above}px`;
    };

    document.addEventListener('mouseover', (e) => {
        const el = (e.target as Element | null)?.closest?.('[data-tip]') ?? null;
        if (el === current) return;
        current = el;
        if (!el) {
            tip.hidden = true;
            return;
        }
        tip.textContent = el.getAttribute('data-tip') ?? '';
        tip.hidden = false;
        move(e);
    });
    document.addEventListener('mousemove', (e) => {
        if (current && !tip.hidden) move(e);
    });
    document.addEventListener('scroll', () => {
        tip.hidden = true;
        current = null;
    }, true);
}
