import { signal, mount, Switch, Match } from "environs";

const tab = signal("home");

function App() {
  return (
    <div>
      <h1>Switch / Match Example</h1>

      <nav>
        <button onClick={() => tab.set("home")}>Home</button>
        <button onClick={() => tab.set("about")}>About</button>
        <button onClick={() => tab.set("contact")}>Contact</button>
      </nav>

      <Switch fallback={<p>Unknown tab.</p>}>
        <Match when={() => tab() === "home"}>
          <section>
            <h2>Home</h2>
            <p>Welcome to the home page.</p>
          </section>
        </Match>
        <Match when={() => tab() === "about"}>
          <section>
            <h2>About</h2>
            <p>This is the about page.</p>
          </section>
        </Match>
        <Match when={() => tab() === "contact"}>
          <section>
            <h2>Contact</h2>
            <p>Get in touch at hello@example.com.</p>
          </section>
        </Match>
      </Switch>
    </div>
  );
}

mount(App, document.body);
