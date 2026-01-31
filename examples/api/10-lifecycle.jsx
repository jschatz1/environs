import { signal, onMount, onCleanup, mount } from "environs";

const showChild = signal(true);

function Timer() {
  const elapsed = signal(0);

  // onMount runs after the component's DOM is inserted
  onMount(() => {
    console.log("Timer mounted");
    const id = setInterval(() => elapsed.update((n) => n + 1), 1000);

    // Returning a function from onMount registers it as cleanup
    return () => {
      console.log("Timer mount-cleanup");
      clearInterval(id);
    };
  });

  // onCleanup registers a function that runs when the component is disposed
  onCleanup(() => {
    console.log("Timer cleaned up, final elapsed:", elapsed());
  });

  return <p>Elapsed: {elapsed}s</p>;
}

function App() {
  return (
    <div>
      <h1>Lifecycle Example</h1>
      <p><em>Open the console to see lifecycle logs.</em></p>

      <button onClick={() => showChild.update((v) => !v)}>
        {() => (showChild() ? "Unmount Timer" : "Mount Timer")}
      </button>

      {() => (showChild() ? <Timer /> : <p>Timer is unmounted.</p>)}
    </div>
  );
}

mount(App, document.body);
