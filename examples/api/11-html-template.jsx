import { signal, mount } from "environs";

const color = signal("royalblue");
const size = signal(24);
const items = signal(["One", "Two", "Three"]);

function App() {
  return (
    <div>
      <h1>JSX Template Example</h1>

      {/* Dynamic attributes */}
      <p style={() => `color: ${color()}; font-size: ${size()}px;`}>
        Styled text
      </p>

      <label>
        Color:{" "}
        <input value={color} onInput={(e) => color.set(e.target.value)} />
      </label>
      <label>
        Size:{" "}
        <input type="range" min="12" max="48" value={size}
          onInput={(e) => size.set(Number(e.target.value))} />
        {size}px
      </label>

      <hr />

      {/* Children: arrays, nested templates, reactive text */}
      <ul>
        {() => items().map((item) => <li>{item}</li>)}
      </ul>

      {/* Event handling */}
      <button onClick={(e) => {
        console.log("Clicked at", e.clientX, e.clientY);
        items.update((list) => [...list, `Item ${list.length + 1}`]);
      }}>
        Add Item
      </button>

      {/* Boolean / conditional attributes */}
      <button disabled={() => items().length === 0}
        onClick={() => items.update((list) => list.slice(0, -1))}>
        Remove Last
      </button>
    </div>
  );
}

mount(App, document.body);
