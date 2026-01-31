import { signal, computed, createContext, useContext, mount } from "environs";

const ThemeContext = createContext("light");

function ThemeProvider(props) {
  const theme = signal("light");

  const toggle = () => theme.update((t) => (t === "light" ? "dark" : "light"));

  return (
    <div class={() =>
      theme() === "dark"
        ? "bg-gray-900 text-gray-100 min-h-screen p-6 transition-colors duration-300"
        : "bg-white text-gray-900 min-h-screen p-6 transition-colors duration-300"
    }>
      <button
        class={() =>
          theme() === "dark"
            ? "px-5 py-2 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-300 active:bg-yellow-500 transition"
            : "px-5 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 active:bg-gray-900 transition"
        }
        onClick={toggle}
      >
        Switch to {() => (theme() === "light" ? "dark" : "light")} mode
      </button>
      <ThemeContext.Provider value={theme()}>
        {props.children}
      </ThemeContext.Provider>
    </div>
  );
}

function Card() {
  const theme = useContext(ThemeContext);
  const isDark = computed(() => theme === "dark");

  return (
    <div class={() =>
      isDark()
        ? "p-6 mt-4 rounded-2xl border border-gray-700 bg-gray-800 shadow-lg"
        : "p-6 mt-4 rounded-2xl border border-gray-200 bg-gray-50 shadow-lg"
    }>
      <h2 class="text-xl font-bold mb-2">Themed Card</h2>
      <p>This card reads the theme from context: <strong>{theme}</strong></p>
    </div>
  );
}

function App() {
  return (
    <div class="font-sans max-w-lg mx-auto">
      <h1 class="text-3xl font-bold pt-10 mb-6">Theme Switcher</h1>
      <ThemeProvider>
        {() => (
          <div>
            <Card />
            <Card />
          </div>
        )}
      </ThemeProvider>
    </div>
  );
}

mount(App, document.body);
