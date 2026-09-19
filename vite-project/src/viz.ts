// viz.ts — мини-графики для карточек главной (HTML и SVG, без Chart.js).
// Цвета берутся из CSS (currentColor / --on-pastel), поэтому тема меняется без JS.
// В разметку попадают только числа и подписи из дат — пользовательский текст сюда не приходит.

import { formatDateShort, weekdayIndex } from './dates';
import type { DayCount, MoodSeries } from './stats';

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
        return `<div class="bars__col${isToday ? ' bars__col--today' : ''}" title="${formatDateShort(d.date)}: ${d.count}">${bar}<span class="bars__label">${WEEKDAYS[weekdayIndex(d.date)]}</span></div>`;
    });

    return `<div class="bars" role="img" aria-label="Выполнено задач по дням за неделю">${cols.join('')}</div>`;
}

const f = (n: number): string => n.toFixed(1);
const clamp = (n: number, a: number, b: number): number => Math.min(Math.max(n, a), b);

/** Плавная линия оценок настроения с пунктирной отметкой на последней записи. */
export function renderLine(series: MoodSeries, today: string): string {
    if (series.points.length === 0) {
        return `<p class="viz__empty">Оценок за ${series.days} дней пока нет</p>`;
    }

    const W = 400;
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

    return `<svg class="line-viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Настроение за ${series.days} дней">
  <line x1="${padX}" y1="${baseline}" x2="${W - padX}" y2="${baseline}" stroke="currentColor" stroke-opacity=".18" />
  <path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  <line x1="${f(last.x)}" y1="${f(last.y + 8)}" x2="${f(last.x)}" y2="${baseline}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 4" stroke-opacity=".7" />
  <circle cx="${f(last.x)}" cy="${f(last.y)}" r="5.5" fill="currentColor" />
  <text x="${f(last.x)}" y="${f(last.y - 12)}" text-anchor="${last.x > W - 24 ? 'end' : 'middle'}" font-size="13" font-weight="800" fill="currentColor">${last.rating}</text>
  ${showFirstLabel ? `<text x="${padX}" y="${H - 8}" font-size="11" font-weight="600" fill="currentColor" fill-opacity=".6">${formatDateShort(first.date)}</text>` : ''}
  <text x="${f(last.x)}" y="${H - 8}" text-anchor="${lastAnchor}" font-size="11" font-weight="800" fill="currentColor">${lastLabel}</text>
</svg>`;
}
