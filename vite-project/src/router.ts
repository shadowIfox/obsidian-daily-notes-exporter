// router.ts — навигация между разделами по адресу (#/tasks, #/habits …).
// Обновление страницы не сбрасывает раздел, работает кнопка «Назад».

import { renderAnalyticsPage } from './analytics';
import { renderDashboard } from './dashboard';

const ROUTES = {
    dashboard: { sectionId: 'dashboard-section', title: 'Главная' },
    tasks: { sectionId: 'todo-section', title: 'Задачи' },
    habits: { sectionId: 'habits-section', title: 'Привычки' },
    mood: { sectionId: 'mood-section', title: 'Настроение' },
    analytics: { sectionId: 'analytics-section', title: 'Аналитика' },
    settings: { sectionId: 'settings-section', title: 'Настройки' },
} as const;

export type Route = keyof typeof ROUTES;

const DEFAULT_ROUTE: Route = 'dashboard';

const listeners: Array<(route: Route) => void> = [];
let afterShow: (() => void) | null = null;

/** Подписка на смену раздела (например, чтобы закрыть всплывающие панели). */
export function onRouteChange(cb: (route: Route) => void): void {
    listeners.push(cb);
}

function currentRoute(): Route {
    const name = location.hash.replace(/^#\/?/, '');
    return name in ROUTES ? (name as Route) : DEFAULT_ROUTE;
}

function show(route: Route): void {
    for (const [name, { sectionId }] of Object.entries(ROUTES)) {
        document.getElementById(sectionId)?.classList.toggle('hidden', name !== route);
    }

    document.querySelectorAll<HTMLElement>('[data-route]').forEach((link) => {
        if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });

    document.title = `${ROUTES[route].title} — Мой день`;
    window.scrollTo(0, 0);

    if (route === 'dashboard') renderDashboard();
    if (route === 'analytics') renderAnalyticsPage();

    listeners.forEach((cb) => cb(route));
    const pending = afterShow;
    afterShow = null;
    pending?.();
}

/** Переходит в раздел и после отрисовки вызывает after (например, подсветить найденный элемент). */
export function navigate(route: Route, after?: () => void): void {
    if (currentRoute() === route) {
        afterShow = after ?? null;
        show(route);
        return;
    }
    afterShow = after ?? null;
    location.hash = `#/${route}`; // дальше сработает hashchange → show()
}

export function initRouter(): void {
    window.addEventListener('hashchange', () => show(currentRoute()));

    // Повторный клик по активному пункту хэш не меняет — обновляем раздел вручную (например, сброс аналитики к меню)
    document.querySelectorAll<HTMLElement>('[data-route]').forEach((link) => {
        link.addEventListener('click', () => {
            if (link.dataset.route === currentRoute()) show(currentRoute());
        });
    });

    show(currentRoute());
}
