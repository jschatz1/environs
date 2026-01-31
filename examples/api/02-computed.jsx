import { signal, computed, mount } from "environs";

const firstName = signal("Jane");
const lastName = signal("Doe");

// computed() derives a value from other signals.
// It auto-tracks dependencies and only recomputes when they change.
const fullName = computed(() => `${firstName()} ${lastName()}`);

// Computeds can depend on other computeds
const greeting = computed(() => `Hello, ${fullName()}!`);

// Computed for a numeric derivation
const price = signal(10);
const quantity = signal(3);
const total = computed(() => price() * quantity());
const withTax = computed(() => (total() * 1.08).toFixed(2));

function App() {
  return (
    <div>
      <h1>Computed Example</h1>

      <label>
        First:{" "}
        <input value={firstName} onInput={(e) => firstName.set(e.target.value)} />
      </label>
      <label>
        Last:{" "}
        <input value={lastName} onInput={(e) => lastName.set(e.target.value)} />
      </label>

      <p>Full name: {fullName}</p>
      <p>{greeting}</p>

      <hr />
      <h2>Chained Computed</h2>
      <label>
        Price:{" "}
        <input type="number" value={price} onInput={(e) => price.set(Number(e.target.value))} />
      </label>
      <label>
        Qty:{" "}
        <input type="number" value={quantity} onInput={(e) => quantity.set(Number(e.target.value))} />
      </label>
      <p>Subtotal: ${total}</p>
      <p>With tax (8%): ${withTax}</p>
    </div>
  );
}

mount(App, document.body);
