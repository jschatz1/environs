import { signal, computed, mount, Show, For } from "environs";

function TodoApp() {
  const todos = signal([]);
  const input = signal("");
  let nextId = 1;

  const total = computed(() => todos().length);
  const remaining = computed(() => todos().filter((t) => !t.done).length);

  function addTodo() {
    const text = input().trim();
    if (!text) return;
    todos.update((list) => [...list, { id: nextId++, text, done: false }]);
    input.set("");
  }

  function toggleTodo(id) {
    todos.update((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function removeTodo(id) {
    todos.update((list) => list.filter((t) => t.id !== id));
  }

  return (
    <div class="font-sans max-w-md mx-auto mt-12 px-4">
      <div class="bg-white shadow-lg rounded-2xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-6">Todo App</h1>

        <div class="flex gap-2 mb-6">
          <input
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            placeholder="What needs to be done?"
            value={input}
            onInput={(e) => input.set(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
          />
          <button
            class="px-5 py-2 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 active:bg-indigo-700 transition"
            onClick={addTodo}
          >
            Add
          </button>
        </div>

        <Show
          when={() => total() > 0}
          fallback={<p class="text-gray-400 text-center py-4">No todos yet. Add one above!</p>}
        >
          <div>
            <p class="text-sm text-gray-500 mb-3">{remaining} of {total} remaining</p>
            <ul class="divide-y divide-gray-100">
              <For each={todos}>
                {(todo) => (
                  <li class="flex items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span class={() => todo.done ? "flex-1 line-through text-gray-400" : "flex-1 text-gray-700"}>
                      {todo.text}
                    </span>
                    <button
                      class="ml-auto text-gray-400 hover:text-red-500 transition font-bold"
                      onClick={() => removeTodo(todo.id)}
                    >
                      ×
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>
      </div>
    </div>
  );
}

mount(TodoApp, document.body);
