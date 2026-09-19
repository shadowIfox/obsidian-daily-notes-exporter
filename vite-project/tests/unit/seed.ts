// Заполнение localStorage в тестах: ключи те же, что использует store.ts.
export const seed = {
    tasks: (v: unknown) => localStorage.setItem('tasks', JSON.stringify(v)),
    habits: (v: unknown) => localStorage.setItem('habits', JSON.stringify(v)),
    mood: (v: unknown) => localStorage.setItem('moodData', JSON.stringify(v)),
    settings: (v: unknown) => localStorage.setItem('userSettings', JSON.stringify(v)),
};
