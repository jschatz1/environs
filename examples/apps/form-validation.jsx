import { signal, computed, effect, mount, Show } from "environs";

function FormValidation() {
  const email = signal("");
  const password = signal("");
  const confirmPassword = signal("");
  const submitted = signal(false);

  const emailError = computed(() => {
    const val = email();
    if (!val) return "Email is required";
    if (!val.includes("@")) return "Must be a valid email";
    return "";
  });

  const passwordError = computed(() => {
    const val = password();
    if (!val) return "Password is required";
    if (val.length < 8) return "Must be at least 8 characters";
    return "";
  });

  const confirmError = computed(() => {
    if (!confirmPassword()) return "Please confirm password";
    if (confirmPassword() !== password()) return "Passwords do not match";
    return "";
  });

  const isValid = computed(
    () => !emailError() && !passwordError() && !confirmError()
  );

  effect(() => {
    if (submitted()) {
      console.log("Form submitted with:", { email: email(), password: password() });
    }
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (isValid()) submitted.set(true);
  }

  return (
    <div class="font-sans max-w-sm mx-auto mt-12 px-4">
      <div class="bg-white shadow-lg rounded-2xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-6">Form Validation</h1>

        <Show
          when={submitted}
          fallback={
            <form onSubmit={handleSubmit} class="space-y-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  class={() => emailError()
                    ? "w-full px-4 py-2 border-2 border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 transition"
                    : "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  }
                  value={email}
                  onInput={(e) => email.set(e.target.value)}
                />
                <Show when={emailError}>
                  {() => <small class="text-red-500 text-sm mt-1 block">{emailError}</small>}
                </Show>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  class={() => passwordError()
                    ? "w-full px-4 py-2 border-2 border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 transition"
                    : "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  }
                  value={password}
                  onInput={(e) => password.set(e.target.value)}
                />
                <Show when={passwordError}>
                  {() => <small class="text-red-500 text-sm mt-1 block">{passwordError}</small>}
                </Show>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  class={() => confirmError()
                    ? "w-full px-4 py-2 border-2 border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 transition"
                    : "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  }
                  value={confirmPassword}
                  onInput={(e) => confirmPassword.set(e.target.value)}
                />
                <Show when={confirmError}>
                  {() => <small class="text-red-500 text-sm mt-1 block">{confirmError}</small>}
                </Show>
              </div>

              <button
                type="submit"
                disabled={() => !isValid()}
                class="w-full py-2.5 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Submit
              </button>
            </form>
          }
        >
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <p class="text-emerald-700 font-semibold text-lg mb-4">Form submitted successfully!</p>
            <button
              class="px-5 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 active:bg-emerald-700 transition"
              onClick={() => {
                submitted.set(false);
                email.set("");
                password.set("");
                confirmPassword.set("");
              }}
            >
              Reset
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}

mount(FormValidation, document.body);
