# Environs

A fine-grained reactive UI framework with zero ceremony.

## Install

```bash
npm install environs
```

## Quick Start

```jsx
import { signal, mount } from "environs";

function Counter() {
  const count = signal(0);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => count.update((n) => n + 1)}>+1</button>
    </div>
  );
}

mount(Counter, document.body);
```

Signals are reactive — when their value changes, the DOM updates automatically.

## API

### Reactivity

#### `signal(initialValue)`

Creates a reactive value. Call it to read, use `.set()` or `.update()` to write.

```js
const name = signal("world");
name();                      // "world"
name.set("Environs");        // set directly
name.update((n) => n + "!"); // update with function
```

#### `computed(fn)`

Derives a value from other reactive sources. Re-evaluates only when dependencies change.

```js
const first = signal("Jane");
const last = signal("Doe");
const full = computed(() => `${first()} ${last()}`);
full(); // "Jane Doe"
```

#### `effect(fn)`

Runs a side effect whenever its dependencies change. Returns a dispose function. Optionally return a cleanup function from the callback.

```js
const count = signal(0);

const dispose = effect(() => {
  console.log("Count is", count());
  return () => console.log("cleaning up");
});
```

#### `batch(fn)`

Batches multiple signal writes so effects and computeds only run once.

```js
batch(() => {
  first.set("John");
  last.set("Smith");
  // computed/effects run once after batch completes
});
```

#### `createStore(initial)`

Creates a reactive object where each property is independently tracked.

```js
const user = createStore({ name: "Alice", age: 30 });
user.name;         // "Alice"
user.name = "Bob"; // triggers only effects that read .name
```

### Rendering

#### `mount(component, container)`

Mounts a component into a DOM element. Returns a dispose function.

```js
const dispose = mount(App, document.getElementById("app"));
```

#### `html` (template tag)

An alternative to JSX using tagged template literals.

```js
import { html } from "environs";

function Greeting() {
  const name = signal("world");
  return html`<h1>Hello, ${name}!</h1>`;
}
```

### Control Flow

#### `Show`

Conditionally renders children.

```jsx
<Show when={() => loggedIn()} fallback={<p>Please log in</p>}>
  <Dashboard />
</Show>
```

#### `For`

Renders a list from a reactive array.

```jsx
<For each={items}>
  {(item) => <li>{item.text}</li>}
</For>
```

#### `Switch` / `Match`

Pattern matching for rendering.

```jsx
<Switch fallback={<p>Not found</p>}>
  <Match when={() => state() === "loading"}>Loading...</Match>
  <Match when={() => state() === "error"}>Error!</Match>
</Switch>
```

### Lifecycle

#### `onMount(fn)`

Runs after the component is mounted to the DOM.

```js
onMount(() => {
  console.log("mounted");
  return () => console.log("unmounted"); // optional cleanup
});
```

#### `onCleanup(fn)`

Registers a cleanup function that runs when the component is disposed.

```js
onCleanup(() => clearInterval(id));
```

#### `createContext(defaultValue)` / `useContext(context)`

Share values through the component tree without prop drilling.

```jsx
const Theme = createContext("light");

function App() {
  return (
    <Theme.Provider value="dark">
      <Child />
    </Theme.Provider>
  );
}

function Child() {
  const theme = useContext(Theme); // "dark"
  return <p>{theme}</p>;
}
```

## JSX Setup

Configure your `tsconfig.json` (or `jsconfig.json`):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "environs"
  }
}
```

## Examples

The `examples/` directory contains interactive demos:

**API demos** — one per concept (signal, computed, effect, batch, store, Show, For, Switch, context, lifecycle, html templates)

**App demos** — small applications showing how the pieces fit together:
- **Counter** — signals and effects
- **Todo** — signals, computed, Show, For
- **Form Validation** — computed validators with reactive class switching
- **Theme Switcher** — context-based dark/light mode

Run them locally:

```bash
pnpm dev:examples
```

## Development

```bash
pnpm install
pnpm build        # build to dist/
pnpm test         # run tests
pnpm test:watch   # tests in watch mode
pnpm typecheck    # type-check without emitting
```

## License

MIT
