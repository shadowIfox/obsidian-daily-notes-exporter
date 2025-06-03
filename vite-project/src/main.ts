import './style.css';
import { setupTodo } from './todo';

// Вставляем разметку в #app
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <section id="todo-section" class="app-section">
    <h2 class="text-xl font-semibold mb-4">Список задач</h2>
    <form id="add-task-form" class="flex flex-wrap gap-2 mb-4 items-end">
      <div>
        <label for="task-text" class="block text-sm">Текст задачи</label>
        <input
          id="task-text"
          name="task-text"
          type="text"
          class="border rounded px-2 py-1"
          placeholder="Введите задачу..."
          required
          maxlength="100"
        />
      </div>
      <div>
        <label for="task-date" class="block text-sm">Дедлайн</label>
        <input
          id="task-date"
          name="task-date"
          type="date"
          class="border rounded px-2 py-1"
          required
        />
      </div>
      <div>
        <label for="task-category" class="block text-sm">Категория</label>
        <input
          id="task-category"
          name="task-category"
          type="text"
          class="border rounded px-2 py-1"
          placeholder="Категория (например, Учёба, Личное)"
        />
      </div>
      <button
        type="submit"
        class="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Добавить
      </button>
    </form>
    <!-- Фильтры задач -->
    <div id="todo-filters" class="flex gap-2 mb-4 justify-center">
      <button data-filter="all" class="px-2 py-1 rounded border bg-blue-500 text-white">Все</button>
      <button data-filter="active" class="px-2 py-1 rounded border bg-blue-500 text-white">Активные</button>
      <button data-filter="completed" class="px-2 py-1 rounded border bg-blue-500 text-white">Выполненные</button>
    </div>
    <ul id="task-list" class="space-y-2"></ul>
  </section>
`;

// Запуск логики todo
setupTodo();