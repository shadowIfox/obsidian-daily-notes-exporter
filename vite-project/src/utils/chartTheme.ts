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

/** Применяет тему к конфигу осей/легенды */
function withThemedOptions<T extends ChartType>(config: ChartConfiguration<T>): ChartConfiguration<T> {
    const { text, border } = getThemeColors();
    return {
        ...config,
        options: {
            responsive: true,
            ...config.options,
            scales: {
                ...(config.options?.scales as any),
                x: {
                    grid: { color: border },
                    ticks: { color: text },
                    ...(config.options?.scales as any)?.x,
                },
                y: {
                    grid: { color: border },
                    ticks: { color: text },
                    ...(config.options?.scales as any)?.y,
                },
            },
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

/** Универсальное создание графика с учётом темы */
export function createThemedChart<T extends ChartType>(ctx: CanvasRenderingContext2D, config: ChartConfiguration<T>): ChartJS<T> {
    const themed = withThemedOptions(config);
    ensureDatasetColors(ctx, themed);
    try { (ctx.canvas as HTMLCanvasElement).style.backgroundColor = 'transparent'; } catch {}
    const chart = new Chart(ctx, themed);
    try { _charts.push(chart as any); } catch {}
    attachThemeListener(chart);
    return chart;
}

/** Перерисовка существующего графика при смене темы */
export function rethemeChart<T extends ChartType>(chart: ChartJS<T>) {
    const { text, border } = getThemeColors();
    const opts: any = chart.options || {};
    opts.scales = opts.scales || {};
    const s: any = opts.scales;

    if (s.x) { s.x.grid = { ...(s.x.grid || {}), color: border }; s.x.ticks = { ...(s.x.ticks || {}), color: text }; }
    if (s.y) { s.y.grid = { ...(s.y.grid || {}), color: border }; s.y.ticks = { ...(s.y.ticks || {}), color: text }; }

    // Безопасно обновляем plugins с учётом возможного отсутствия полей
    opts.plugins = opts.plugins || {};

    // Legend labels color
    const legend: any = opts.plugins.legend || {};
    const legendLabels = { ...(legend.labels || {}), color: text };
    opts.plugins.legend = { ...legend, labels: legendLabels };

    // Tooltip colors
    const tooltip: any = opts.plugins.tooltip || {};
    opts.plugins.tooltip = {
      ...tooltip,
      titleColor: text,
      bodyColor: text,
      footerColor: text,
    };

    chart.update();
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
// --- Глобальный реестр графиков для удобной перетемизации ---
const _charts: ChartJS<any>[] = [];
export function registerChart<T extends ChartType>(chart: ChartJS<T>) { _charts.push(chart as any); }
export function rethemeAllCharts() { _charts.forEach((c) => rethemeChart(c as any)); }