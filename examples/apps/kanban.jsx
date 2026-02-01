import {
  signal,
  computed,
  effect,
  batch,
  createStore,
  mount,
  Show,
  For,
  Switch,
  Match,
  onMount,
  onCleanup,
} from "environs";

// ---------------------------------------------------------------------------
// Store — the primary showcase for createStore
// ---------------------------------------------------------------------------
const board = createStore({
  cards: [],
  nextId: 1,
  modalOpen: false,
});

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columns = [
  { id: "todo", label: "Todo", accent: "indigo" },
  { id: "progress", label: "In Progress", accent: "amber" },
  { id: "done", label: "Done", accent: "emerald" },
];

// ---------------------------------------------------------------------------
// Priority Badge — Switch/Match showcase
// ---------------------------------------------------------------------------
function PriorityBadge({ priority }) {
  return (
    <Switch fallback={<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">unknown</span>}>
      <Match when={() => priority === "low"}>
        {() => (
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">low</span>
        )}
      </Match>
      <Match when={() => priority === "medium"}>
        {() => (
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">medium</span>
        )}
      </Match>
      <Match when={() => priority === "high"}>
        {() => (
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">high</span>
        )}
      </Match>
    </Switch>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
function Card({ card, indexInColumn, columnCards }) {
  const colIndex = () => columns.findIndex((c) => c.id === card.column);
  const canMoveLeft = () => colIndex() > 0;
  const canMoveRight = () => colIndex() < columns.length - 1;
  const canMoveUp = () => indexInColumn() > 0;
  const canMoveDown = () => indexInColumn() < columnCards().length - 1;

  function moveCard(direction) {
    const idx = colIndex();
    const targetCol = columns[idx + direction];
    if (!targetCol) return;
    batch(() => {
      board.cards.update((cards) =>
        cards.map((c) => (c.id === card.id ? { ...c, column: targetCol.id } : c))
      );
    });
  }

  function reorder(direction) {
    const colCards = columnCards();
    const neighborIndex = indexInColumn() + direction;
    if (neighborIndex < 0 || neighborIndex >= colCards.length) return;
    const neighborId = colCards[neighborIndex].id;
    board.cards.update((cards) => {
      const arr = [...cards];
      const myPos = arr.findIndex((c) => c.id === card.id);
      const neighborPos = arr.findIndex((c) => c.id === neighborId);
      [arr[myPos], arr[neighborPos]] = [arr[neighborPos], arr[myPos]];
      return arr;
    });
  }

  function deleteCard() {
    board.cards.update((cards) => cards.filter((c) => c.id !== card.id));
  }

  return (
    <div class="bg-white rounded-xl shadow p-4 border border-gray-100 space-y-2">
      <div class="flex items-start justify-between gap-2">
        <h4 class="font-semibold text-sm text-gray-900 leading-snug">{card.title}</h4>
        <div class="flex items-center gap-1 shrink-0">
          <div class="flex flex-col">
            <Show when={canMoveUp}>
              {() => (
                <button
                  class="px-1 py-0 text-[10px] leading-tight rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                  onClick={() => reorder(-1)}
                  title="Move up"
                >
                  ▲
                </button>
              )}
            </Show>
            <Show when={canMoveDown}>
              {() => (
                <button
                  class="px-1 py-0 text-[10px] leading-tight rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                  onClick={() => reorder(1)}
                  title="Move down"
                >
                  ▼
                </button>
              )}
            </Show>
          </div>
          <PriorityBadge priority={card.priority} />
        </div>
      </div>

      {/* Show for optional description */}
      <Show when={() => !!card.description}>
        {() => (
          <p class="text-xs text-gray-500 leading-relaxed">{card.description}</p>
        )}
      </Show>

      <div class="flex items-center gap-1 pt-1">
        <Show when={canMoveLeft}>
          {() => (
            <button
              class="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
              onClick={() => moveCard(-1)}
            >
              ← Move
            </button>
          )}
        </Show>
        <Show when={canMoveRight}>
          {() => (
            <button
              class="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
              onClick={() => moveCard(1)}
            >
              Move →
            </button>
          )}
        </Show>
        <button
          class="ml-auto px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-600 transition"
          onClick={deleteCard}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------
function Column({ columnDef, cards }) {
  const accentColors = {
    indigo: "border-indigo-400 bg-indigo-50",
    amber: "border-amber-400 bg-amber-50",
    emerald: "border-emerald-400 bg-emerald-50",
  };

  const headerColors = {
    indigo: "text-indigo-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
  };

  const countColors = {
    indigo: "bg-indigo-100 text-indigo-600",
    amber: "bg-amber-100 text-amber-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };

  const count = computed(() => cards().length);

  return (
    <div class={"flex flex-col rounded-2xl shadow-lg border-t-4 bg-gray-50/50 " + (accentColors[columnDef.accent] || "")}>
      <div class="flex items-center justify-between px-4 py-3">
        <h3 class={"font-bold text-sm " + (headerColors[columnDef.accent] || "")}>{columnDef.label}</h3>
        <span class={"text-xs font-semibold px-2 py-0.5 rounded-full " + (countColors[columnDef.accent] || "")}>
          {count}
        </span>
      </div>
      <div class="flex-1 px-3 pb-3 space-y-2 min-h-[120px]">
        <Show
          when={() => cards().length > 0}
          fallback={
            <p class="text-center text-xs text-gray-400 py-8">No cards</p>
          }
        >
          {() => (
            <For each={cards}>
              {(card, index) => <Card card={card} indexInColumn={index} columnCards={cards} />}
            </For>
          )}
        </Show>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Card Modal
// ---------------------------------------------------------------------------
function AddCardModal() {
  const title = signal("");
  const description = signal("");
  const priority = signal("medium");

  const titleError = computed(() =>
    title().trim().length === 0 ? "Title is required" : ""
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (titleError()) return;

    batch(() => {
      const id = board.nextId();
      board.cards.update((cards) => [
        ...cards,
        {
          id,
          title: title().trim(),
          description: description().trim(),
          priority: priority(),
          column: "todo",
        },
      ]);
      board.nextId.update((n) => n + 1);
      board.modalOpen.set(false);
    });

    // Reset form
    title.set("");
    description.set("");
    priority.set("medium");
  }

  function handleClose() {
    board.modalOpen.set(false);
  }

  return (
    <Show when={board.modalOpen}>
      {() => (
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">Add New Card</h2>
            <form onSubmit={handleSubmit} class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  class={() =>
                    (titleError() && title().length > 0
                      ? "border-red-400 focus:ring-red-300"
                      : "border-gray-300 focus:ring-indigo-400"
                    ) + " w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition text-sm"
                  }
                  placeholder="Card title..."
                  value={title}
                  onInput={(e) => title.set(e.target.value)}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-sm"
                  rows="3"
                  placeholder="Add details..."
                  value={description}
                  onInput={(e) => description.set(e.target.value)}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-sm"
                  value={priority}
                  onChange={(e) => priority.set(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  class="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition text-sm"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={() => !!titleError()}
                  class="flex-1 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ totalCount, search }) {
  return (
    <header class="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-gray-900 tracking-tight">Kanban Board</h1>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
            {totalCount} {() => totalCount() === 1 ? "card" : "cards"}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <div class="relative">
            <input
              class="px-3 py-1.5 pl-8 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-sm w-48"
              placeholder="Filter cards..."
              value={search}
              onInput={(e) => search.set(e.target.value)}
            />
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* Show for search clear button */}
            <Show when={() => search().length > 0}>
              {() => (
                <button
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  onClick={() => search.set("")}
                >
                  ✕
                </button>
              )}
            </Show>
          </div>
          <button
            class="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 active:bg-indigo-700 transition"
            onClick={() => board.modalOpen.set(true)}
          >
            + Add Card
          </button>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
function Board({ columnCards }) {
  return (
    <div class="flex-1 overflow-auto p-6">
      <div class="grid grid-cols-3 gap-5 min-h-full">
        <For each={() => columns}>
          {(col) => <Column columnDef={col} cards={columnCards[col.id]} />}
        </For>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  const search = signal("");

  // Computed: total card count
  const totalCount = computed(() => board.cards().length);

  // Computed: filtered cards per column (filtered by search)
  const filteredCards = computed(() => {
    const q = search().toLowerCase();
    const all = board.cards();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  });

  const columnCards = {
    todo: computed(() => filteredCards().filter((c) => c.column === "todo")),
    progress: computed(() => filteredCards().filter((c) => c.column === "progress")),
    done: computed(() => filteredCards().filter((c) => c.column === "done")),
  };

  // Effect: update document title with total card count
  effect(() => {
    document.title = `Kanban Board (${totalCount()} cards) — Environs`;
  });

  // onMount: load initial sample cards
  onMount(() => {
    batch(() => {
      board.cards.set([
        { id: 1, title: "Set up project structure", description: "Initialize repo, add linter and formatter config", priority: "high", column: "done" },
        { id: 2, title: "Design database schema", description: "Define tables for users, posts, and comments", priority: "high", column: "progress" },
        { id: 3, title: "Build authentication flow", description: "", priority: "medium", column: "progress" },
        { id: 4, title: "Create landing page", description: "Hero section, features list, CTA", priority: "medium", column: "todo" },
        { id: 5, title: "Write API documentation", description: "", priority: "low", column: "todo" },
        { id: 6, title: "Add unit tests", description: "Cover core business logic with tests", priority: "high", column: "todo" },
      ]);
      board.nextId.set(7);
    });
  });

  // onCleanup demo
  onCleanup(() => {
    console.log("Kanban board cleaned up");
  });

  return (
    <div class="flex flex-col h-screen bg-gray-50">
      <Header totalCount={totalCount} search={search} />
      <Board columnCards={columnCards} />
      <AddCardModal />
    </div>
  );
}

mount(App, document.body);
