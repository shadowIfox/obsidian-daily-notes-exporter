// src/analytics.ts

import Chart from 'chart.js/auto';

export function renderAnalyticsPage() {
    // 1. Получаем контейнер раздела аналитики
    const container = document.getElementById('analytics-section');
    if (!container) return;

    // 2. Вставляем разметку секции с тремя графиками
    container.innerHTML = `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Аналитика и отчёты</h1>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Раздел "Задачи" -->
        <section>
          <h2 class="text-xl font-semibold mb-2">Задачи</h2>
          <canvas id="analytics-tasks-chart" class="bg-white rounded-2xl shadow p-4"></canvas>
        </section>
        <!-- Раздел "Привычки" -->
        <section>
          <h2 class="text-xl font-semibold mb-2">Привычки</h2>
          <canvas id="analytics-habits-chart" class="bg-white rounded-2xl shadow p-4"></canvas>
        </section>
        <!-- Раздел "Настроение" -->
        <section>
          <h2 class="text-xl font-semibold mb-2">Настроение</h2>
          <canvas id="analytics-mood-chart" class="bg-white rounded-2xl shadow p-4"></canvas>
        </section>
      </div>
    </div>
    `;

    // 3. График задач (Bar Chart)
    const ctxTasks = document.getElementById('analytics-tasks-chart') as HTMLCanvasElement;
    if (ctxTasks) {
        new Chart(ctxTasks, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Выполнено задач',
                    data: [3, 5, 2, 4, 1, 0, 6],
                    backgroundColor: '#60A5FA',
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 4. График привычек (Line Chart)
    const ctxHabits = document.getElementById('analytics-habits-chart') as HTMLCanvasElement;
    if (ctxHabits) {
        new Chart(ctxHabits, {
            type: 'line',
            data: {
                labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
                datasets: [{
                    label: 'Серии привычек',
                    data: [2, 3, 1, 4],
                    backgroundColor: '#A3E635',
                    borderColor: '#84CC16',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 5. График настроения (Doughnut Chart)
    const ctxMood = document.getElementById('analytics-mood-chart') as HTMLCanvasElement;
    if (ctxMood) {
        new Chart(ctxMood, {
            type: 'doughnut',
            data: {
                labels: ['Отлично', 'Хорошо', 'Нормально', 'Плохо', 'Ужасно'],
                datasets: [{
                    label: 'Оценки',
                    data: [5, 8, 3, 2, 1],
                    backgroundColor: ['#F472B6', '#FB7185', '#FBCFE8', '#C026D3', '#A21CAF'],
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}