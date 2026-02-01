import {
  signal,
  computed,
  effect,
  batch,
  mount,
  Show,
  For,
  Switch,
  Match,
  createContext,
  useContext,
  onMount,
  onCleanup,
} from "environs";

// ---------------------------------------------------------------------------
// Context — demonstrate createContext / useContext with current user info
// ---------------------------------------------------------------------------
const UserContext = createContext("Guest");

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ theme, toggleTheme, activePage, notifications }) {
  const unreadCount = computed(() => notifications().filter((n) => !n.read).length);
  const currentUser = useContext(UserContext);

  return (
    <header class={() =>
      theme() === "dark"
        ? "h-16 flex items-center justify-between px-6 border-b border-gray-700 bg-gray-800"
        : "h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white"
    }>
      <h1 class="text-lg font-bold tracking-tight">Environs Dashboard</h1>
      <div class="flex items-center gap-4">
        <span class={() =>
          theme() === "dark"
            ? "text-sm text-gray-400"
            : "text-sm text-gray-500"
        }>
          {currentUser}
        </span>

        {/* Notification bell */}
        <button class={() =>
          theme() === "dark"
            ? "relative p-2 rounded-lg hover:bg-gray-700 transition"
            : "relative p-2 rounded-lg hover:bg-gray-100 transition"
        }>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <Show when={() => unreadCount() > 0}>
            {() => (
              <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Show>
        </button>

        {/* Theme toggle */}
        <button
          class={() =>
            theme() === "dark"
              ? "px-4 py-1.5 text-sm font-medium rounded-lg bg-yellow-400 text-gray-900 hover:bg-yellow-300 transition"
              : "px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition"
          }
          onClick={toggleTheme}
        >
          {() => (theme() === "dark" ? "Light" : "Dark")}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({ theme, activePage }) {
  const pages = ["overview", "users", "settings"];

  return (
    <aside class={() =>
      theme() === "dark"
        ? "w-56 shrink-0 border-r border-gray-700 bg-gray-800 p-4"
        : "w-56 shrink-0 border-r border-gray-200 bg-white p-4"
    }>
      <nav class="space-y-1">
        <For each={() => pages}>
          {(page) => (
            <button
              class={() => {
                const active = activePage() === page;
                if (theme() === "dark") {
                  return active
                    ? "w-full text-left px-3 py-2 rounded-lg bg-indigo-600 text-white font-medium transition"
                    : "w-full text-left px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition";
                }
                return active
                  ? "w-full text-left px-3 py-2 rounded-lg bg-indigo-500 text-white font-medium transition"
                  : "w-full text-left px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition";
              }}
              onClick={() => activePage.set(page)}
            >
              {page.charAt(0).toUpperCase() + page.slice(1)}
            </button>
          )}
        </For>
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Stats Cards (Overview)
// ---------------------------------------------------------------------------
function StatsCards({ theme, stats }) {
  const cards = computed(() => {
    const s = stats();
    return [
      { label: "Users", value: s.users.toLocaleString(), accent: "indigo" },
      { label: "Revenue", value: "$" + s.revenue.toLocaleString(), accent: "emerald" },
      { label: "Orders", value: s.orders.toLocaleString(), accent: "amber" },
      { label: "Conversion", value: (s.orders / Math.max(s.users, 1) * 100).toFixed(1) + "%", accent: "rose" },
    ];
  });

  return (
    <div class="grid grid-cols-2 gap-4 mb-6">
      <For each={cards}>
        {(card) => (
          <div class={() => {
            const dark = theme() === "dark";
            const colors = {
              indigo: dark ? "border-indigo-500 bg-indigo-900/40 text-indigo-300" : "border-indigo-400 bg-indigo-50 text-indigo-700",
              emerald: dark ? "border-emerald-500 bg-emerald-900/40 text-emerald-300" : "border-emerald-400 bg-emerald-50 text-emerald-700",
              amber: dark ? "border-amber-500 bg-amber-900/40 text-amber-300" : "border-amber-400 bg-amber-50 text-amber-700",
              rose: dark ? "border-rose-500 bg-rose-900/40 text-rose-300" : "border-rose-400 bg-rose-50 text-rose-700",
            };
            return (colors[card.accent] || "") + " border-l-4 rounded-2xl shadow-lg p-5";
          }}>
            <p class="text-sm font-medium opacity-75">{card.label}</p>
            <p class="text-2xl font-extrabold mt-1">{card.value}</p>
          </div>
        )}
      </For>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Feed (Overview)
// ---------------------------------------------------------------------------
function ActivityFeed({ theme, activities }) {
  return (
    <div class={() =>
      theme() === "dark"
        ? "rounded-2xl shadow-lg p-5 bg-gray-800 border border-gray-700"
        : "rounded-2xl shadow-lg p-5 bg-white border border-gray-200"
    }>
      <h3 class="font-bold text-lg mb-3">Recent Activity</h3>
      <Show
        when={() => activities().length > 0}
        fallback={<p class="text-gray-400 text-center py-4">No recent activity.</p>}
      >
        {() => (
          <ul class="space-y-3">
            <For each={activities}>
              {(item) => (
                <li class="flex items-start gap-3">
                  <span class="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <div>
                    <p class="text-sm">{item.message}</p>
                    <p class="text-xs opacity-50">{item.time}</p>
                  </div>
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Panel (Overview) — uses Switch/Match
// ---------------------------------------------------------------------------
function StatusPanel({ theme, systemStatus }) {
  return (
    <div class={() =>
      theme() === "dark"
        ? "rounded-2xl shadow-lg p-5 bg-gray-800 border border-gray-700"
        : "rounded-2xl shadow-lg p-5 bg-white border border-gray-200"
    }>
      <h3 class="font-bold text-lg mb-3">System Status</h3>
      <Switch fallback={<p class="text-gray-400">Unknown status</p>}>
        <Match when={() => systemStatus() === "operational"}>
          {() => (
            <div class="flex items-center gap-2 text-emerald-500">
              <span class="w-3 h-3 rounded-full bg-emerald-500" />
              <span class="font-semibold">All Systems Operational</span>
            </div>
          )}
        </Match>
        <Match when={() => systemStatus() === "degraded"}>
          {() => (
            <div class="flex items-center gap-2 text-amber-500">
              <span class="w-3 h-3 rounded-full bg-amber-500" />
              <span class="font-semibold">Degraded Performance</span>
            </div>
          )}
        </Match>
        <Match when={() => systemStatus() === "outage"}>
          {() => (
            <div class="flex items-center gap-2 text-red-500">
              <span class="w-3 h-3 rounded-full bg-red-500" />
              <span class="font-semibold">Major Outage</span>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Page
// ---------------------------------------------------------------------------
function OverviewPage({ theme, stats, activities, systemStatus }) {
  return (
    <div>
      <h2 class="text-2xl font-bold mb-4">Overview</h2>
      <StatsCards theme={theme} stats={stats} />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeed theme={theme} activities={activities} />
        <StatusPanel theme={theme} systemStatus={systemStatus} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users Page
// ---------------------------------------------------------------------------
function UsersPage({ theme }) {
  const search = signal("");
  const users = signal([
    { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", role: "Editor" },
    { id: 3, name: "Carol Williams", email: "carol@example.com", role: "Viewer" },
    { id: 4, name: "Dan Brown", email: "dan@example.com", role: "Editor" },
    { id: 5, name: "Eve Davis", email: "eve@example.com", role: "Admin" },
  ]);

  const filtered = computed(() => {
    const q = search().toLowerCase();
    if (!q) return users();
    return users().filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <h2 class="text-2xl font-bold mb-4">Users</h2>
      <input
        class={() =>
          theme() === "dark"
            ? "w-full mb-4 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            : "w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
        }
        placeholder="Search users..."
        value={search}
        onInput={(e) => search.set(e.target.value)}
      />
      <div class={() =>
        theme() === "dark"
          ? "rounded-2xl shadow-lg overflow-hidden border border-gray-700"
          : "rounded-2xl shadow-lg overflow-hidden border border-gray-200"
      }>
        <table class="w-full text-sm">
          <thead>
            <tr class={() => theme() === "dark" ? "bg-gray-800" : "bg-gray-50"}>
              <th class="text-left px-4 py-3 font-semibold">Name</th>
              <th class="text-left px-4 py-3 font-semibold">Email</th>
              <th class="text-left px-4 py-3 font-semibold">Role</th>
            </tr>
          </thead>
          <tbody>
            <For each={filtered}>
              {(user) => (
                <tr class={() =>
                  theme() === "dark"
                    ? "border-t border-gray-700 hover:bg-gray-800/50"
                    : "border-t border-gray-100 hover:bg-gray-50"
                }>
                  <td class="px-4 py-3">{user.name}</td>
                  <td class="px-4 py-3 opacity-75">{user.email}</td>
                  <td class="px-4 py-3">
                    <span class={() => {
                      const base = "px-2 py-0.5 text-xs font-medium rounded-full";
                      if (user.role === "Admin") return base + " bg-indigo-100 text-indigo-700";
                      if (user.role === "Editor") return base + " bg-amber-100 text-amber-700";
                      return base + " bg-gray-100 text-gray-600";
                    }}>
                      {user.role}
                    </span>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={() => filtered().length === 0}>
          {() => (
            <p class="text-center py-6 text-gray-400">No users match your search.</p>
          )}
        </Show>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------
function SettingsPage({ theme }) {
  const name = signal("Admin User");
  const email = signal("admin@example.com");
  const saved = signal(false);

  const nameError = computed(() =>
    name().trim().length < 2 ? "Name must be at least 2 characters" : ""
  );
  const emailError = computed(() => {
    const v = email();
    if (!v) return "Email is required";
    if (!v.includes("@")) return "Must be a valid email";
    return "";
  });
  const isValid = computed(() => !nameError() && !emailError());

  function handleSave(e) {
    e.preventDefault();
    if (isValid()) saved.set(true);
  }

  return (
    <div>
      <h2 class="text-2xl font-bold mb-4">Settings</h2>
      <div class={() =>
        theme() === "dark"
          ? "rounded-2xl shadow-lg p-6 bg-gray-800 border border-gray-700 max-w-md"
          : "rounded-2xl shadow-lg p-6 bg-white border border-gray-200 max-w-md"
      }>
        <Show
          when={saved}
          fallback={
            <form onSubmit={handleSave} class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Display Name</label>
                <input
                  class={() =>
                    (nameError()
                      ? "border-red-400 focus:ring-red-300"
                      : theme() === "dark"
                        ? "border-gray-600 focus:ring-indigo-500"
                        : "border-gray-300 focus:ring-indigo-400"
                    ) + " w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition"
                    + (theme() === "dark" ? " bg-gray-700 text-gray-100" : "")
                  }
                  value={name}
                  onInput={(e) => name.set(e.target.value)}
                />
                <Show when={nameError}>
                  {() => <small class="text-red-500 text-sm mt-1 block">{nameError}</small>}
                </Show>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  class={() =>
                    (emailError()
                      ? "border-red-400 focus:ring-red-300"
                      : theme() === "dark"
                        ? "border-gray-600 focus:ring-indigo-500"
                        : "border-gray-300 focus:ring-indigo-400"
                    ) + " w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition"
                    + (theme() === "dark" ? " bg-gray-700 text-gray-100" : "")
                  }
                  value={email}
                  onInput={(e) => email.set(e.target.value)}
                />
                <Show when={emailError}>
                  {() => <small class="text-red-500 text-sm mt-1 block">{emailError}</small>}
                </Show>
              </div>
              <button
                type="submit"
                disabled={() => !isValid()}
                class="w-full py-2.5 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Save Settings
              </button>
            </form>
          }
        >
          {() => (
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
              <p class="text-emerald-700 font-semibold text-lg mb-4">Settings saved!</p>
              <button
                class="px-5 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 active:bg-emerald-700 transition"
                onClick={() => saved.set(false)}
              >
                Edit Again
              </button>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App (root)
// ---------------------------------------------------------------------------
function App() {
  const theme = signal("light");
  const activePage = signal("overview");
  const stats = signal({ users: 0, revenue: 0, orders: 0 });
  const activities = signal([]);
  const systemStatus = signal("operational");
  const notifications = signal([
    { id: 1, text: "New user signed up", read: false },
    { id: 2, text: "Server restarted", read: true },
    { id: 3, text: "Revenue milestone hit", read: false },
  ]);

  const toggleTheme = () => theme.update((t) => (t === "light" ? "dark" : "light"));

  // Update document title based on active page
  effect(() => {
    document.title = activePage().charAt(0).toUpperCase() + activePage().slice(1) + " — Dashboard";
  });

  // Simulate data loading on mount + periodic refresh
  onMount(() => {
    batch(() => {
      stats.set({ users: 1284, revenue: 48250, orders: 356 });
      activities.set([
        { message: "Alice created a new project", time: "2 min ago" },
        { message: "Bob updated billing info", time: "15 min ago" },
        { message: "Carol joined the team", time: "1 hr ago" },
        { message: "System backup completed", time: "3 hr ago" },
      ]);
    });

    const interval = setInterval(() => {
      batch(() => {
        stats.update((s) => ({
          users: s.users + Math.floor(Math.random() * 3),
          revenue: s.revenue + Math.floor(Math.random() * 500),
          orders: s.orders + Math.floor(Math.random() * 5),
        }));
      });
    }, 5000);

    const statuses = ["operational", "degraded", "operational", "outage", "operational"];
    let idx = 0;
    const statusInterval = setInterval(() => {
      idx = (idx + 1) % statuses.length;
      systemStatus.set(statuses[idx]);
    }, 8000);

    return () => {
      clearInterval(interval);
      clearInterval(statusInterval);
    };
  });

  // onCleanup demo — log when the app is torn down
  onCleanup(() => {
    console.log("Dashboard app cleaned up");
  });

  return (
    <UserContext.Provider value="Admin">
      <div class={() =>
        theme() === "dark"
          ? "bg-gray-900 text-gray-100 transition-colors duration-300"
          : "bg-gray-50 text-gray-900 transition-colors duration-300"
      }>
        <div class="flex flex-col h-screen">
          <Header
            theme={theme}
            toggleTheme={toggleTheme}
            activePage={activePage}
            notifications={notifications}
          />
          <div class="flex flex-1 overflow-hidden">
            <Sidebar theme={theme} activePage={activePage} />
            <main class="flex-1 overflow-y-auto p-6">
              <Switch>
                <Match when={() => activePage() === "overview"}>
                  {() => (
                    <OverviewPage
                      theme={theme}
                      stats={stats}
                      activities={activities}
                      systemStatus={systemStatus}
                    />
                  )}
                </Match>
                <Match when={() => activePage() === "users"}>
                  {() => <UsersPage theme={theme} />}
                </Match>
                <Match when={() => activePage() === "settings"}>
                  {() => <SettingsPage theme={theme} />}
                </Match>
              </Switch>
            </main>
          </div>
        </div>
      </div>
    </UserContext.Provider>
  );
}

mount(App, document.body);
