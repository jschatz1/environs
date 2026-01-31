import { signal, effect, mount } from "environs";

function Counter() {
  const count = signal(0);

  effect(() => {
    document.title = `Count: ${count()}`;
  });

  return (
    <div class="font-sans max-w-sm mx-auto mt-16 text-center">
      <div class="bg-white shadow-lg rounded-2xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Counter</h1>
        <p class="text-7xl font-extrabold text-indigo-600 my-6">{count}</p>
        <div class="flex gap-3 justify-center">
          <button
            class="px-5 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 active:bg-red-700 transition"
            onClick={() => count.update((n) => n - 1)}
          >
            -1
          </button>
          <button
            class="px-5 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition"
            onClick={() => count.set(0)}
          >
            Reset
          </button>
          <button
            class="px-5 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 active:bg-emerald-700 transition"
            onClick={() => count.update((n) => n + 1)}
          >
            +1
          </button>
        </div>
      </div>
    </div>
  );
}

mount(Counter, document.body);
