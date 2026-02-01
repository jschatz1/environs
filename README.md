# Environs

A fine-grained reactive UI framework with zero ceremony.

Inspired by [SolidJS](https://www.solidjs.com/). Components are setup functions that run once — reactivity is handled by signals and effects at a granular level below the component boundary. No virtual DOM, no diffing, no re-execution of component functions. The idea has older roots in Knockout (2010) and Meteor's Tracker, but Solid formalized the "components are just setup functions" framing and proved it could work with JSX.

## What Environs fixes from React

### Components run once, not on every state change

In React, a component function re-executes from top to bottom whenever any piece of its state changes. Every local variable is recreated, every closure is reallocated, and every child expression is re-evaluated — even the parts that have nothing to do with what changed. React then diffs a virtual DOM tree to figure out what actually needs to update in the real DOM.

In Environs, a component function runs **once**. It sets up signals, effects, and DOM structure, then exits. When state changes, only the specific effects that read that signal re-run. There is no re-execution of the component, no virtual DOM, and no diffing. A signal change updates the exact DOM text node or attribute that depends on it and nothing else.

```jsx
// This function runs once. The <span> updates directly when count changes.
function Counter() {
  const count = signal(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </div>
  );
}
```

### No hooks, no rules of hooks

React hooks have constraints that exist purely because of the re-execution model: don't call hooks conditionally, don't call them in loops, always keep the same order. These rules exist because React identifies hooks by call index across re-renders.

Environs has no hooks. Signals are plain values you create, store, and pass anywhere. Effects are subscriptions you set up in any scope. `onMount` and `onCleanup` register callbacks on the current owner — they work wherever they're called, inside conditionals, loops, or helper functions.

```jsx
function Search({ enabled }) {
  const query = signal("");

  if (enabled) {
    onMount(() => {
      document.getElementById("search-input").focus();
    });
  }

  effect(() => {
    console.log("Query:", query());
  });

  return <input id="search-input" value={query} onInput={e => query.set(e.target.value)} />;
}
```

### No `useMemo`, `useCallback`, or dependency arrays

In React, because components re-run entirely, you need `useMemo` to avoid recomputing derived values, `useCallback` to stabilize function references for child props, and both require manual dependency arrays that are easy to get wrong (stale closures).

Environs has none of this. A `computed()` automatically tracks which signals it reads and only recalculates when those specific signals change. Functions created in a component body are created once and never go stale because the component doesn't re-run.

```jsx
// React — manual dependency tracking, easy to miss one
const filtered = useMemo(() => items.filter(i => i.name.includes(query)), [items, query]);
const handleClick = useCallback(() => setSelected(id), [id]);

// Environs — automatic dependency tracking, no arrays
const filtered = computed(() => items().filter(i => i.name.includes(query())));
const handleClick = () => selected.set(id);
```

### No `useRef` for mutable values

In React, `useRef` exists because you need a stable container that survives re-renders without triggering them. It's the escape hatch for "I need a variable that doesn't cause a re-render."

In Environs, there are no re-renders. A plain `let` variable in a component body persists for the component's lifetime because the function only runs once. Use a signal when you want reactivity, use a plain variable when you don't.

```jsx
function Timer() {
  let intervalId = null; // plain variable, stable for the component's lifetime
  const seconds = signal(0);

  onMount(() => {
    intervalId = setInterval(() => seconds.update(s => s + 1), 1000);
    return () => clearInterval(intervalId);
  });

  return <span>{seconds}</span>;
}
```

### Lists update in O(1), not O(n)

React's `key` prop during reconciliation still diffs the entire list to determine what changed. Even with keys, React re-renders every list item component to check if its output changed.

Environs' `For` component with a `key` prop does keyed reconciliation — it maintains a map of key to DOM nodes and owners. Appending an item creates one new DOM node. Removing an item disposes one owner. Reordering moves existing DOM nodes without recreating or re-running anything. Each item's index is a reactive signal, so only items whose position actually changed get an index update.

```jsx
<For each={items} key={item => item.id}>
  {(item, index) => (
    <div>
      <span>{item.name}</span>
      <span>Position: {index}</span> {/* reactive — updates only when position changes */}
    </div>
  )}
</For>
```

### No `useEffect` cleanup footguns

React's `useEffect` runs after paint, has a dependency array that's easy to get wrong, and the cleanup function runs at a non-obvious time (before the next effect run or on unmount, but not synchronously). The dependency array is the single largest source of bugs in React applications.

Environs effects track dependencies automatically and run synchronously when a signal changes. Cleanup functions returned from an effect run before the next execution and on disposal. There is no dependency array to get wrong.

```jsx
// React — manual deps, cleanup timing confusion
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => setMessages(m => [...m, e.data]);
  return () => ws.close();
}, [url]); // forget url and you get a stale closure

// Environs — automatic tracking, predictable cleanup
effect(() => {
  const ws = new WebSocket(url());
  ws.onmessage = (e) => messages.update(m => [...m, e.data]);
  return () => ws.close(); // runs before next execution or on dispose
});
```

### No `React.memo`, `shouldComponentUpdate`, or `PureComponent`

In React, every component re-renders when its parent re-renders unless you opt out with `React.memo`, `shouldComponentUpdate`, or `PureComponent`. This means the default is wasteful and you need to manually add optimization boundaries.

In Environs, there is nothing to opt out of because components don't re-render. A parent's signal change only triggers effects that read that signal. A child component that doesn't read the signal is not touched in any way.

### Batching is explicit, not magical

React 18 automatically batches all state updates in event handlers, promises, and timeouts. This is usually helpful but occasionally surprising when you need an intermediate state to be visible.

Environs is synchronous by default — each `signal.set()` immediately triggers its dependents. When you want batching, you say so with `batch()`. The behavior is always predictable.

```jsx
// Both updates trigger effects independently
count.set(1);
name.set("Alice");

// One combined update — dependents run once at the end
batch(() => {
  count.set(1);
  name.set("Alice");
});
```

### Ownership replaces garbage collection guesswork

React has no explicit ownership model for subscriptions, timers, or resources. You manage cleanup manually in `useEffect` return functions and hope you covered every case.

Environs has an ownership tree. Every `createOwner()` tracks its cleanup functions and child owners. When a component is disposed, the entire subtree is cleaned up depth-first — effects are unsubscribed, timers are cleared, and child components are disposed. Control flow components (`Show`, `For`, `Switch`) manage this automatically.

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
- **Dashboard** — full layout with sidebar, stats, activity feed, and system status using all major APIs
- **Kanban Board** — drag/reorder cards across columns with createStore and batch
- **User Explorer** — network requests with fetch, loading/error states, abort on unmount, and keyed list reconciliation
- **Composer** — command-driven UI builder (see below)

Run them locally:

```bash
pnpm dev:examples
```

## Composer

Environs includes a visual Composer — a command-driven UI builder that lets you create, layout, and style component trees interactively. It has autocomplete, undo/redo, and compiles a live preview as you work.

```jsx
import { mountComposer } from "environs/composer";
mountComposer(document.body);
```

### Command Reference

| Command | Description |
|---------|-------------|
| `add <kind> as <name> style <tokens>` | Create a node |
| `layout <type> as <name>` | Create a layout container |
| `style <target> <tokens...>` | Apply style tokens |
| `place <node> in <parent/slot>` | Place a node in a slot |
| `move <node> to <parent/slot>` | Move a node |
| `select <name>` | Select a node on the stage |
| `enter <name>` / `exit` | Navigate scope |
| `delete <name>` | Remove a node |
| `rename <old> <new>` | Rename a node |
| `dup <name> as <newName>` | Duplicate a node |
| `show <name>` | Inspect a node |
| `list nodes` / `list children` / `list slots` | List items |
| `undo` / `redo` | History navigation |
| `help <command>` | Show help for a command |

### Node Kinds

`button`, `card`, `text`, `input`, `image`, `divider`, `container`, `menu`, `menuItem`

### Layout Types

`stack`, `grid`, `sidebar`, `center`, `split`, `tabs`

### Style Tokens

Tokens are shorthand names that compile to Tailwind classes:

```
pad-xs pad-sm pad-md pad-lg pad-xl     → padding
gap-xs gap-sm gap-md gap-lg            → gap
shadow shadow-sm shadow-md shadow-lg   → elevation
rounded rounded-lg rounded-full        → border radius
text-sm text-lg text-xl text-2xl       → font size
bold semibold medium italic            → font weight
tone:primary tone:muted tone:danger    → color intent
bg:surface bg:muted bg:primary         → backgrounds
border border:muted border:strong      → borders
card panel chip link                   → presets
center centerX centerY                 → centering
w-full h-full maxw:xl                  → sizing
```

### Example Session

Build a pricing card with a CTA button:

```
layout stack as page style pad-lg gap-md
add card as pricing style shadow-md pad-lg rounded-xl
place pricing in page/content
add text as title style text-2xl bold
place title in pricing/content
add text as price style text-3xl bold tone:primary
place price in pricing/content
add button as cta style tone:primary pad-md rounded-lg
place cta in pricing/content
```

Build a sidebar layout:

```
layout sidebar as shell
add text as logo style text-xl bold pad-md
place logo in shell/left
layout stack as main-content style pad-lg gap-md
place main-content in shell/main
add card as welcome style pad-lg shadow-sm
place welcome in main-content/content
```

Style an existing node with multiple tokens:

```
style pricing border bg:surface pad-xl shadow-lg
style cta bg:success rounded-full pad-lg text-lg bold
```

### Demos

Type `demo` to list prebuilt example layouts, or `demo <N>` to load one instantly:

| Demo | Description |
|------|-------------|
| `demo 1` | **Hero Landing** — full-width hero with headline, subtext, and CTA buttons |
| `demo 2` | **Pricing Cards** — 3-column grid of styled cards with prices and buy buttons |
| `demo 3` | **Dashboard** — sidebar layout with nav menu and stat cards in a grid |
| `demo 4` | **Blog Post** — centered readable layout with title, meta, body, and divider |
| `demo 5` | **Feature Grid** — 2x2 grid of icon-cards with descriptions |
| `demo 6` | **Settings Panel** — sidebar + form inputs with labels and save button |
| `demo 7` | **E-commerce Product** — split layout: image left, details + buy button right |
| `demo 8` | **Team Gallery** — grid of profile cards with images and names |
| `demo 9` | **Navbar + Content** — horizontal nav bar on top, centered content below |
| `demo 10` | **Kanban Board** — 3-column split with task cards in each column |

### Autocomplete

The command input provides autocomplete suggestions as you type:

- Type `ad` → suggests `add`
- Type `add ` → suggests node kinds (`button`, `card`, `text`, ...)
- Type `layout ` → suggests layout types (`stack`, `grid`, `sidebar`, ...)
- Type `style ` → suggests node names and style tokens
- Type `style pricing pa` → suggests `pad-xs`, `pad-sm`, `pad-md`, ...
- Type `place cta in ` → suggests slot paths (`page/content`, `pricing/content`, ...)

Use **Arrow keys** to navigate suggestions, **Tab** or **Enter** to accept, **Escape** to dismiss.

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
