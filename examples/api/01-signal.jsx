import { signal, mount } from "environs";

// signal(value) creates reactive state
const count = signal(0);
const name = signal("World");

// Read by calling: count()
// Write with .set(): count.set(5)
// Update with a function: count.update(n => n + 1)

function App() {
  return (
    <div>
      <h1>Signal Example</h1>

      {/* Reading a signal in a template makes it reactive */}
      <p>Count: {count}</p>
      <p>Hello, {name}!</p>

      <button onClick={() => count.update((n) => n + 1)}>Increment</button>
      <button onClick={() => count.set(0)}>Reset</button>

      <label>
        Name:{" "}
        <input
          value={name}
          onInput={(e) => name.set(e.target.value)}
        />
      </label>
    </div>
  );
}

mount(App, document.body);
