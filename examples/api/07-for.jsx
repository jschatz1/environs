import { signal, mount, For } from "environs";

const items = signal(["Apple", "Banana", "Cherry"]);
const newItem = signal("");

function App() {
  return (
    <div>
      <h1>For Example</h1>

      <ul>
        <For each={items}>
          {(item, index) => <li>{() => index() + 1}. {item}</li>}
        </For>
      </ul>

      <label>
        New item:{" "}
        <input
          value={newItem}
          onInput={(e) => newItem.set(e.target.value)}
        />
      </label>

      <button onClick={() => {
        const val = newItem().trim();
        if (val) {
          items.update((list) => [...list, val]);
          newItem.set("");
        }
      }}>Add</button>

      <button onClick={() => items.update((list) => list.slice(0, -1))}>
        Remove Last
      </button>

      <button onClick={() => items.set([])}>Clear All</button>
    </div>
  );
}

mount(App, document.body);
