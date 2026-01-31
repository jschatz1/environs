import { signal, mount, Show } from "environs";

const loggedIn = signal(false);
const count = signal(0);

function App() {
  return (
    <div>
      <h1>Show Example</h1>

      {/* Basic Show with fallback */}
      <Show when={loggedIn} fallback={<p>Please log in.</p>}>
        <p>Welcome back!</p>
      </Show>

      <button onClick={() => loggedIn.update((v) => !v)}>
        Toggle Login
      </button>

      <hr />

      {/* Show with a reactive condition */}
      <button onClick={() => count.update((n) => n + 1)}>
        Count: {count}
      </button>

      <Show when={() => count() > 3} fallback={<p>Click more than 3 times to reveal content.</p>}>
        <p>Count is greater than 3!</p>
      </Show>
    </div>
  );
}

mount(App, document.body);
