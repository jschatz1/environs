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
  onMount,
  onCleanup,
} from "environs";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
const API = "https://jsonplaceholder.typicode.com";

async function fetchJSON(url, { signal: abortSignal } = {}) {
  const res = await fetch(url, { signal: abortSignal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Async resource pattern — reusable fetch-into-signal helper
// ---------------------------------------------------------------------------
function createResource(fetcher) {
  const data = signal(null);
  const error = signal(null);
  const loading = signal(true);

  let controller = null;

  function load(...args) {
    if (controller) controller.abort();
    controller = new AbortController();
    batch(() => {
      loading.set(true);
      error.set(null);
    });

    fetcher(...args, { signal: controller.signal })
      .then((result) => {
        batch(() => {
          data.set(result);
          loading.set(false);
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        batch(() => {
          error.set(err.message);
          loading.set(false);
        });
      });
  }

  function cancel() {
    if (controller) controller.abort();
  }

  return { data, error, loading, load, cancel };
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner({ size }) {
  const s = size || "w-6 h-6";
  return (
    <div class="flex items-center justify-center py-8">
      <div class={s + " border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBox
// ---------------------------------------------------------------------------
function ErrorBox({ message, onRetry }) {
  return (
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
      <p class="text-red-700 text-sm font-medium mb-2">{message}</p>
      <Show when={() => !!onRetry}>
        {() => (
          <button
            class="px-4 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserCard
// ---------------------------------------------------------------------------
function UserCard({ user, isSelected, onSelect }) {
  return (
    <button
      class={() =>
        isSelected()
          ? "w-full text-left p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 transition"
          : "w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md transition"
      }
      onClick={() => onSelect(user)}
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
          {user.name.charAt(0)}
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-sm text-gray-900 truncate">{user.name}</p>
          <p class="text-xs text-gray-500 truncate">{user.email.toLowerCase()}</p>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <span>@{user.username.toLowerCase()}</span>
        <span class="opacity-40">|</span>
        <span>{user.company.name}</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// UserList (sidebar)
// ---------------------------------------------------------------------------
function UserList({ users, selectedUser, onSelect, search }) {
  const filtered = computed(() => {
    const q = search().toLowerCase();
    const list = users.data();
    if (!list) return [];
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  });

  return (
    <aside class="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      <div class="p-4 border-b border-gray-100">
        <div class="relative">
          <input
            class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition placeholder-gray-400"
            placeholder="Search users..."
            value={search}
            onInput={(e) => search.set(e.target.value)}
          />
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        <Switch>
          <Match when={users.loading}>
            {() => <Spinner />}
          </Match>
          <Match when={users.error}>
            {() => (
              <ErrorBox
                message={() => "Failed to load users: " + users.error()}
                onRetry={() => users.load()}
              />
            )}
          </Match>
          <Match when={() => filtered().length === 0 && !users.loading()}>
            {() => (
              <p class="text-center text-sm text-gray-400 py-8">No users found.</p>
            )}
          </Match>
          <Match when={() => filtered().length > 0}>
            {() => (
              <For each={filtered} key={(u) => u.id}>
                {(user) => (
                  <UserCard
                    user={user}
                    isSelected={() => selectedUser() && selectedUser().id === user.id}
                    onSelect={onSelect}
                  />
                )}
              </For>
            )}
          </Match>
        </Switch>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------
function PostCard({ post, isExpanded, onToggle }) {
  return (
    <div class="rounded-xl border border-gray-200 bg-white overflow-hidden transition hover:shadow-md">
      <button
        class="w-full text-left p-4"
        onClick={() => onToggle(post.id)}
      >
        <h4 class="font-semibold text-sm text-gray-900 leading-snug capitalize">
          {post.title}
        </h4>
        <p class="text-xs text-gray-500 mt-1 line-clamp-2 capitalize">{post.body}</p>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-xs text-indigo-500 font-medium">
            {() => isExpanded() ? "Hide comments" : "Show comments"}
          </span>
          <span class={() =>
            "text-xs text-indigo-500 transition-transform inline-block " +
            (isExpanded() ? "rotate-180" : "")
          }>
            ▼
          </span>
        </div>
      </button>
      <Show when={isExpanded}>
        {() => <CommentsSection postId={post.id} />}
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentsSection — fetches comments when mounted
// ---------------------------------------------------------------------------
function CommentsSection({ postId }) {
  const comments = createResource((opts) =>
    fetchJSON(`${API}/posts/${postId}/comments`, opts)
  );

  onMount(() => {
    comments.load();
    return () => comments.cancel();
  });

  onCleanup(() => comments.cancel());

  return (
    <div class="border-t border-gray-100 bg-gray-50 p-4">
      <Switch>
        <Match when={comments.loading}>
          {() => <Spinner size="w-4 h-4" />}
        </Match>
        <Match when={comments.error}>
          {() => (
            <ErrorBox
              message={() => "Failed to load comments: " + comments.error()}
              onRetry={() => comments.load()}
            />
          )}
        </Match>
        <Match when={() => comments.data() && comments.data().length === 0}>
          {() => <p class="text-xs text-gray-400 text-center py-2">No comments.</p>}
        </Match>
        <Match when={() => comments.data() && comments.data().length > 0}>
          {() => (
            <div class="space-y-3">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {() => comments.data().length} Comments
              </p>
              <For each={() => comments.data()} key={(c) => c.id}>
                {(comment) => (
                  <div class="rounded-lg bg-white border border-gray-100 p-3">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {comment.name.charAt(0).toUpperCase()}
                      </span>
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-gray-700 truncate capitalize">{comment.name}</p>
                        <p class="text-[10px] text-gray-400 truncate">{comment.email.toLowerCase()}</p>
                      </div>
                    </div>
                    <p class="text-xs text-gray-600 leading-relaxed capitalize">{comment.body}</p>
                  </div>
                )}
              </For>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserDetail — shows user info + their posts
// ---------------------------------------------------------------------------
function UserDetail({ selectedUser }) {
  const posts = createResource((userId, opts) =>
    fetchJSON(`${API}/users/${userId}/posts`, opts)
  );
  const expandedPost = signal(null);

  // Fetch posts when selected user changes
  effect(() => {
    const user = selectedUser();
    if (!user) return;
    expandedPost.set(null);
    posts.load(user.id);
  });

  onCleanup(() => posts.cancel());

  function togglePost(postId) {
    expandedPost.update((cur) => (cur === postId ? null : postId));
  }

  return (
    <Show
      when={() => !!selectedUser()}
      fallback={
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p class="text-gray-400 text-sm">Select a user to view their profile and posts</p>
          </div>
        </div>
      }
    >
      {() => {
        const user = selectedUser();
        return (
          <div class="flex-1 overflow-y-auto">
            {/* User profile header */}
            <div class="bg-white border-b border-gray-200 p-6">
              <div class="flex items-start gap-4">
                <div class="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div class="min-w-0 flex-1">
                  <h2 class="text-xl font-bold text-gray-900">{user.name}</h2>
                  <p class="text-sm text-gray-500">@{user.username.toLowerCase()}</p>
                  <div class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div class="flex items-center gap-2 text-gray-600">
                      <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span class="truncate">{user.email.toLowerCase()}</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-600">
                      <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{user.phone}</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-600">
                      <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                      </svg>
                      <span>{user.website}</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-600">
                      <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{user.company.name}</span>
                    </div>
                  </div>
                  <div class="mt-2 flex gap-2">
                    <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                      {user.address.city}
                    </span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {user.company.bs}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts section */}
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-900">Posts</h3>
                <Show when={() => posts.data() && posts.data().length > 0}>
                  {() => (
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {() => posts.data().length} posts
                    </span>
                  )}
                </Show>
              </div>

              <Switch>
                <Match when={posts.loading}>
                  {() => <Spinner />}
                </Match>
                <Match when={posts.error}>
                  {() => (
                    <ErrorBox
                      message={() => "Failed to load posts: " + posts.error()}
                      onRetry={() => posts.load(selectedUser().id)}
                    />
                  )}
                </Match>
                <Match when={() => posts.data() && posts.data().length === 0}>
                  {() => (
                    <p class="text-center text-sm text-gray-400 py-8">
                      This user hasn't published any posts.
                    </p>
                  )}
                </Match>
                <Match when={() => posts.data() && posts.data().length > 0}>
                  {() => (
                    <div class="space-y-3">
                      <For each={() => posts.data()} key={(p) => p.id}>
                        {(post) => (
                          <PostCard
                            post={post}
                            isExpanded={() => expandedPost() === post.id}
                            onToggle={togglePost}
                          />
                        )}
                      </For>
                    </div>
                  )}
                </Match>
              </Switch>
            </div>
          </div>
        );
      }}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ userCount }) {
  return (
    <header class="h-14 flex items-center justify-between px-6 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-bold text-gray-900 tracking-tight">User Explorer</h1>
        <Show when={() => userCount() > 0}>
          {() => (
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
              {userCount} users
            </span>
          )}
        </Show>
      </div>
      <span class="text-xs text-gray-400">Powered by JSONPlaceholder</span>
    </header>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  const search = signal("");
  const selectedUser = signal(null);

  const users = createResource((opts) =>
    fetchJSON(`${API}/users`, opts)
  );

  const userCount = computed(() => {
    const d = users.data();
    return d ? d.length : 0;
  });

  function selectUser(user) {
    selectedUser.set(user);
  }

  // Fetch users on mount
  onMount(() => {
    users.load();
    return () => users.cancel();
  });

  // Update document title
  effect(() => {
    const user = selectedUser();
    document.title = user
      ? `${user.name} — User Explorer`
      : "User Explorer — Environs";
  });

  onCleanup(() => {
    users.cancel();
    console.log("User Explorer cleaned up");
  });

  return (
    <div class="flex flex-col h-screen bg-gray-50">
      <Header userCount={userCount} />
      <div class="flex flex-1 overflow-hidden">
        <UserList
          users={users}
          selectedUser={selectedUser}
          onSelect={selectUser}
          search={search}
        />
        <UserDetail selectedUser={selectedUser} />
      </div>
    </div>
  );
}

mount(App, document.body);
