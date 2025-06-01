// script.js

const navButtons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('.app-section');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-section');
        sections.forEach(sec => {
            sec.hidden = !(sec.id === `${target}-section`);
        });
    });
});

// Дальше будем подключать остальные модули по мере реализации