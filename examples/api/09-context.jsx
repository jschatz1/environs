import { signal, createContext, useContext, mount } from "environs";

// Create a typed context with a default value
const ThemeContext = createContext("light");

// Child component reads context via useContext
function ThemedBox() {
  const theme = useContext(ThemeContext);
  return (
    <div
      style={`
        padding: 20px;
        background: ${theme === "dark" ? "#333" : "#eee"};
        color: ${theme === "dark" ? "#fff" : "#000"};
        border-radius: 8px;
        margin-top: 12px;
      `}
    >
      Current theme: <strong>{theme}</strong>
    </div>
  );
}

function App() {
  const theme = signal("light");

  return (
    <div>
      <h1>Context Example</h1>

      <button onClick={() => theme.update((t) => (t === "light" ? "dark" : "light"))}>
        Toggle Theme
      </button>

      {/* Provide context to children — children as function so they run inside provider scope */}
      <ThemeContext.Provider value={theme()}>
        {() => <ThemedBox />}
      </ThemeContext.Provider>
    </div>
  );
}

mount(App, document.body);
