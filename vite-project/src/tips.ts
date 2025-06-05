// tips.ts

// --- Советы по задачам ---
const taskAdvices = [
    "Планируйте задачи с вечера — начнёте день бодро!",
    "Сделайте сначала простое, чтобы не тянуть с началом.",
    "Празднуйте завершение даже маленьких дел — это мотивирует.",
    "Утром пройдитесь по списку — 5 минут экономят целый день."
];

// --- Советы по привычкам ---
const habitAdvices = [
    "Маленькие шаги каждый день дают большой результат.",
    "Поставьте напоминание для привычки.",
    "Стрик — это не давление, а весёлый челлендж!",
    "Вернитесь к привычке, если сбились — вы молодец!"
];

// --- Советы по настроению ---
const moodAdvices = [
    "Позаботьтесь о себе, если почувствуете спад.",
    "Запланируйте приятное для себя на завтра.",
    "Не забывайте отдыхать — мозг ценит это.",
    "Делитесь позитивом с близкими, настроение заразительно!"
];

// --- Гибридные генераторы советов ---
// Здесь параметры avg, streak и др. влияют на вывод

export function generateTaskAdvice(avg: number, streak: number): string {
    if (avg > 4) return "Вы очень продуктивны! Можно добавить новую цель.";
    if (streak > 3) return "Ваша серия выполненных задач вдохновляет — продолжайте!";
    return taskAdvices[Math.floor(Math.random() * taskAdvices.length)];
}

export function generateHabitAdvice(streak: number): string {
    if (streak >= 7) return "Неделя стабильности — гордимся вами!";
    if (streak <= 2) return "Начинайте с простых привычек, не давите на себя.";
    return habitAdvices[Math.floor(Math.random() * habitAdvices.length)];
}

export function generateMoodAdvice(avgScore: number, frequent: string): string {
    if (avgScore >= 4) return "У вас отличное настроение! Сохраните этот настрой.";
    if (avgScore <= 2) return "Попробуйте добавить маленькие радости каждый день.";
    if (frequent === "плохое" || frequent === "ужасное") return "Берегите себя, выделите время на отдых.";
    return moodAdvices[Math.floor(Math.random() * moodAdvices.length)];
}