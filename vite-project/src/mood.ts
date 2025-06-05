import Chart from 'chart.js/auto';

type MoodEntry = {
    date: string;   // YYYY-MM-DD
    rating: number;
    note: string;
};

let moodData: MoodEntry[] = [];

function saveMoodData() {
    localStorage.setItem('moodData', JSON.stringify(moodData));
}
function loadMoodData(): MoodEntry[] {
    const data = localStorage.getItem('moodData');
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
}

// --- Обновить историю за неделю ---
function renderMoodHistory() {
    const history = document.getElementById('mood-history');
    if (!history) return;
    history.innerHTML = '';
    // последние 7 дней
    const last7 = moodData.slice(-7).reverse();
    for (const entry of last7) {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-2';
        li.innerHTML = `<span class="w-8 text-center font-bold">${entry.rating}</span>
    <span class="text-xs text-gray-500">${entry.date}</span>
    <span class="flex-1">${entry.note}</span>`;
        history.appendChild(li);
    }
}

// --- Рендер Chart.js ---
function renderMoodChart() {
    const ctx = document.getElementById('mood-chart') as HTMLCanvasElement | null;
    if (!ctx) return;
    const data7 = moodData.slice(-7);
    const labels = data7.map(e => e.date);
    const ratings = data7.map(e => e.rating);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).moodChart) (window as any).moodChart.destroy();
    // @ts-ignore
    (window as any).moodChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Настроение',
                data: ratings,
                backgroundColor: [
                    '#f87171', '#fb923c', '#fde047', '#bef264', '#4ade80'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } }
        }
    });
}

// --- Основная функция ---
export function setupMood() {
    moodData = loadMoodData();
    renderMoodHistory();
    renderMoodChart();

    const form = document.getElementById('mood-form') as HTMLFormElement | null;
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const ratingInput = form.querySelector('input[name="rating"]:checked') as HTMLInputElement | null;
        const noteInput = form.querySelector('#mood-note') as HTMLTextAreaElement | null;
        if (!ratingInput) return;
        const rating = parseInt(ratingInput.value, 10);
        const note = noteInput?.value || '';
        const date = new Date().toISOString().slice(0, 10);
        // Перезаписать за сегодня
        moodData = moodData.filter(entry => entry.date !== date);
        moodData.push({ date, rating, note });
        saveMoodData();
        renderMoodHistory();
        renderMoodChart();
        form.reset();
    });
}