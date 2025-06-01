// --- Тёмная тема ---
toggleThemeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

// --- Загрузка темы и данных ---
window.addEventListener('load', () => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') document.body.classList.add('dark');
    setToday();
    loadFromLocalStorage();
});