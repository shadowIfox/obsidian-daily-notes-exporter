// Chart.js plugin: fill chartArea with theme background color from CSS variable --card
const chartAreaBgPlugin = {
    id: 'chartAreaBgPlugin',
    beforeDraw: (chart: any) => {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const styles = getComputedStyle(document.documentElement);
        const bg = (styles.getPropertyValue('--card') || '#ffffff').trim();
        ctx.save();
        ctx.fillStyle = bg;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.restore();
    }
};
// src/utils/chartTheme.ts — эталонная версия
// Поддержка светлой/тёмной темы для Chart.js (TS-friendly)

import type { ChartConfiguration, ChartDataset, Chart as ChartJS, ChartType } from 'chart.js';
import Chart from 'chart.js/auto';
Chart.register(chartAreaBgPlugin);

// Шрифт приложения и размер по контейнеру (высоту задаёт .chart-box в CSS)
Chart.defaults.font.family = "'Manrope Variable', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.maintainAspectRatio = false;

/** Цвета темы из CSS-переменных */
export function getThemeColors() {
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim();
    const text = styles.getPropertyValue('--text').trim();
    const border = styles.getPropertyValue('--border').trim();
    return { text, border, accent };
}

/**
 * Разбор градиента из CSS-строки → CanvasGradient | строка-цвет
 * Поддерживает hex, rgb/rgba внутри linear-gradient(...).
 */
export function getAccentPaint(ctx: CanvasRenderingContext2D) {
    const { accent } = getThemeColors();
    if (accent.startsWith('linear-gradient')) {
        // Пытаемся вытащить цвета из градиента (hex или rgb(a))
        const hexMatches = [...accent.matchAll(/#([0-9a-fA-F]{3,8})/g)].map(m => `#${m[1]}`);
        const rgbMatches = [...accent.matchAll(/rgba?\(([^)]+)\)/g)].map(m => `rgba(${m[1]})`);
        const colors = hexMatches.length ? hexMatches : rgbMatches;

        const g = ctx.createLinearGradient(0, 0, 0, 180);
        if (colors.length >= 2) {
            g.addColorStop(0, colors[0]);
            g.addColorStop(1, colors[1]);
            return g;
        }
        return colors[0] ?? '#8b5cf6';
    }
    return accent || '#8b5cf6';
}

/** Ось с цветами темы; всё, что задано в конфиге явно (stepSize, min…), сохраняется, в том числе внутри ticks/grid. */
function themedAxis(axis: any, text: string, border: string, showGrid = true) {
    return {
        ...axis,
        grid: { color: border, display: showGrid, ...axis?.grid },
        ticks: { color: text, ...axis?.ticks },
    };
}

/** Круговые диаграммы без осей: навязанные x/y рисовали бы на них лишние шкалы. */
const RADIAL_TYPES: string[] = ['doughnut', 'pie', 'polarArea'];

/** Применяет тему к конфигу осей/легенды */
function withThemedOptions<T extends ChartType>(config: ChartConfiguration<T>): ChartConfiguration<T> {
    const { text, border } = getThemeColors();
    const scales = RADIAL_TYPES.includes(config.type as string)
        ? config.options?.scales
        : {
            ...(config.options?.scales as any),
            x: themedAxis((config.options?.scales as any)?.x, text, border, false),
            y: themedAxis((config.options?.scales as any)?.y, text, border),
        };
    return {
        ...config,
        options: {
            responsive: true,
            ...config.options,
            scales,
            plugins: {
                ...config.options?.plugins,
                legend: {
                    labels: { color: text },
                    ...config.options?.plugins?.legend,
                },
                tooltip: {
                    titleColor: text,
                    bodyColor: text,
                    footerColor: text,
                    ...config.options?.plugins?.tooltip,
                },
            },
        },
    } as ChartConfiguration<T>;
}

/** Если у датасетов нет цветов — подставим акцент */
function ensureDatasetColors<T extends ChartType>(ctx: CanvasRenderingContext2D, cfg: ChartConfiguration<T>) {
    const paint = getAccentPaint(ctx);
    const ds = (cfg.data?.datasets as ChartDataset<T, unknown>[]) ?? [];
    ds.forEach(d => {
        if (d.backgroundColor == null) d.backgroundColor = paint;
        if (d.borderColor == null) d.borderColor = typeof paint === 'string' ? paint : '#8b5cf6';
        if ((d as any).pointBackgroundColor == null) (d as any).pointBackgroundColor = d.borderColor as any;
        if (d.borderWidth == null) d.borderWidth = 2;
    });
}

/** Палитра настроения из CSS-переменных: индекс 0 — оценка 1 (плохо), индекс 4 — оценка 5 (отлично). */
export function getMoodColors(): string[] {
    const styles = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return [
        v('--mood-1', '#fca5a5'),
        v('--mood-2', '#fdba74'),
        v('--mood-3', '#fde68a'),
        v('--mood-4', '#86efac'),
        v('--mood-5', '#a78bfa'),
    ];
}

// --- Реестр живых графиков (для перекраски при смене темы) ---
const _charts = new Set<ChartJS<any>>();
const _unsubscribe = new WeakMap<object, () => void>();

/** Универсальное создание графика с учётом темы */
export function createThemedChart<T extends ChartType>(ctx: CanvasRenderingContext2D, config: ChartConfiguration<T>): ChartJS<T> {
    const themed = withThemedOptions(config);
    ensureDatasetColors(ctx, themed);
    try { (ctx.canvas as HTMLCanvasElement).style.backgroundColor = 'transparent'; } catch {}
    const chart = new Chart(ctx, themed);
    _charts.add(chart);
    _unsubscribe.set(chart, attachThemeListener(chart));
    return chart;
}

/** Уничтожает график и убирает его из реестра, чтобы смена темы не трогала мёртвый canvas. */
export function destroyThemedChart<T extends ChartType>(chart: ChartJS<T>) {
    _unsubscribe.get(chart)?.();
    _unsubscribe.delete(chart);
    _charts.delete(chart);
    chart.destroy();
}

/**
 * Перерисовка существующего графика при смене темы.
 * Правим chart.config.options — обычные объекты. chart.options — это Proxy-резолвер Chart.js:
 * копирование его частей через {...spread} падает («name.startsWith is not a function»),
 * а присваивания в нём не переживают update().
 */
export function rethemeChart<T extends ChartType>(chart: ChartJS<T>) {
    if (!chart.canvas) return; // график уже уничтожен
    const { text, border } = getThemeColors();
    const cfg: any = chart.config;
    const opts: any = (cfg.options ??= {});
    const scales: any = (opts.scales ??= {});

    for (const axis of ['x', 'y']) {
        const s = scales[axis];
        if (!s) continue;
        s.grid = { ...s.grid, color: border };
        s.ticks = { ...s.ticks, color: text };
    }

    const plugins: any = (opts.plugins ??= {});
    plugins.legend = { ...plugins.legend, labels: { ...plugins.legend?.labels, color: text } };
    plugins.tooltip = { ...plugins.tooltip, titleColor: text, bodyColor: text, footerColor: text };

    chart.update('none'); // без анимации: цвета меняются сразу
}

/**
 * Подписывает график на событие смены темы и автоматически перекрашивает его.
 * Возвращает функцию для отписки.
 */
export function attachThemeListener<T extends ChartType>(chart: ChartJS<T>) {
    const handler = () => rethemeChart(chart);
    window.addEventListener('themechange', handler as EventListener);
    return () => window.removeEventListener('themechange', handler as EventListener);
}
export function rethemeAllCharts() {
    _charts.forEach((c) => {
        try { rethemeChart(c); } catch {} // ошибка одного графика не должна прерывать остальные
    });
}