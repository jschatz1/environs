import { signal, computed, effect, batch, mount } from "environs";

const first = signal("John");
const last = signal("Smith");
const full = computed(() => `${first()} ${last()}`);

let effectRuns = 0;

// Without batch, changing first and last would trigger this effect twice.
// With batch, it runs once after both updates.
effect(() => {
  console.log(`Effect run #${++effectRuns}: ${full()}`);
});

function App() {
  return (
    <div>
      <h1>Batch Example</h1>
      <p>Name: {full}</p>
      <p><em>Open the console to see effect runs.</em></p>

      {/* Without batching: two effect runs */}
      <button onClick={() => {
        first.set("Jane");
        last.set("Doe");
      }}>Set "Jane Doe" (unbatched)</button>

      {/* With batching: one effect run */}
      <button onClick={() => {
        batch(() => {
          first.set("Alice");
          last.set("Wonder");
        });
      }}>Set "Alice Wonder" (batched)</button>

      <button onClick={() => {
        batch(() => {
          first.set("John");
          last.set("Smith");
        });
      }}>Reset</button>
    </div>
  );
}

mount(App, document.body);
