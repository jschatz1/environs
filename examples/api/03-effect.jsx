import { signal, effect, mount } from "environs";

const count = signal(0);
const message = signal("");

// effect() runs immediately and re-runs when tracked signals change.
// It returns a dispose function to stop tracking.
const dispose = effect(() => {
  console.log("Count changed to:", count());
});

// Effects can return a cleanup function that runs before each re-execution
effect(() => {
  const value = count();
  const timer = setInterval(() => {
    console.log(`Timer for count=${value} is still running`);
  }, 5000);

  return () => clearInterval(timer);
});

// Effect that writes to another signal (derived side-effect)
effect(() => {
  const c = count();
  if (c > 0 && c % 5 === 0) {
    message.set(`${c} is a multiple of 5!`);
  }
});

function App() {
  return (
    <div>
      <h1>Effect Example</h1>
      <p>Count: {count}</p>
      <p>Message: {message}</p>
      <p><em>Open the console to see effect logs.</em></p>

      <button onClick={() => count.update((n) => n + 1)}>Increment</button>
      <button onClick={() => dispose()}>Dispose count logger</button>
    </div>
  );
}

mount(App, document.body);
