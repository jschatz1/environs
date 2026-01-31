import { createStore, computed, mount } from "environs";

// createStore turns a plain object into an object of signals,
// one signal per key. Each property is independently reactive.
const user = createStore({
  name: "Alice",
  age: 30,
  email: "alice@example.com",
});

const summary = computed(
  () => `${user.name()}, age ${user.age()} — ${user.email()}`
);

function App() {
  return (
    <div>
      <h1>Store Example</h1>
      <p>{summary}</p>

      <label>
        Name:{" "}
        <input value={user.name} onInput={(e) => user.name.set(e.target.value)} />
      </label>
      <label>
        Age:{" "}
        <input type="number" value={user.age} onInput={(e) => user.age.set(Number(e.target.value))} />
      </label>
      <label>
        Email:{" "}
        <input value={user.email} onInput={(e) => user.email.set(e.target.value)} />
      </label>

      <button onClick={() => user.age.update((a) => a + 1)}>
        Birthday (+1 year)
      </button>
    </div>
  );
}

mount(App, document.body);
