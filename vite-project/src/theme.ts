// theme.js
// Смена темы и кастомизация внешнего вида

export function setupThemeSwitcher() {
    const toggleThemeBtn = document.getElementById('toggle-theme');
    const html = document.documentElement;

    // Восстановление выбранной темы из localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) html.setAttribute('data-theme', savedTheme);

    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            let currentTheme = html.getAttribute('data-theme') || 'light';
            let newTheme = currentTheme === 'light' ? 'dark' : 'light';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
}