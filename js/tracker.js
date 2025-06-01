// tracker.js — отвечает за фильтрацию и трекер задач

const filterButtons = document.querySelectorAll('.filter-btn');
const progressTracker = document.getElementById('progress-tracker');
let currentFilter = 'all';

function updateProgress() {
    const items = Array.from(document.querySelectorAll('.task-item'));
    const total = items.length;
    const done = items.filter(item => item.querySelector('input[type="checkbox"]').checked).length;
    progressTracker.textContent = `Выполнено: ${done} из ${total}`;
}

function filterTasks() {
    const items = Array.from(document.querySelectorAll('.task-item'));
    items.forEach(item => {
        const checked = item.querySelector('input[type="checkbox"]').checked;
        if (currentFilter === 'all') item.style.display = '';
        else if (currentFilter === 'active') item.style.display = checked ? 'none' : '';
        else if (currentFilter === 'done') item.style.display = checked ? '' : 'none';
    });
}

filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        filterTasks();
    });
});