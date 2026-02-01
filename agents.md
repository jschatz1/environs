# Environs Composer — Command Reference for AI Agents

This document describes the command language used by the Environs Composer. Use it to generate valid instruction scripts that build UI layouts and components.

**Read this entire document before writing any commands.** Many syntax errors come from confusing style tokens (colon syntax) with layout options (equals syntax), or from trying to nest children inside non-layout nodes.

## Critical Rules

1. **Only layout nodes can have children.** Nodes created with `add` (button, text, card, input, etc.) are leaf nodes. They CANNOT contain children. If you need a container with children, use `layout stack` (or another layout type) and apply visual styles to it. For example, don't `add card` and then put things inside it — use `layout stack as "myCard" style card` instead.

2. **Layout options use `=` (equals). Style tokens use `:` (colon).** These are two completely different systems:
   - Layout options: `layout stack as "x" gap=4 axis=x` (equals sign, on the `layout` command)
   - Style tokens: `style x pad:4 tone:primary` (colon, on the `style` command or after `style` keyword in `add`/`layout`)
   - NEVER write `gap:4` as a layout option. NEVER write `gap=4` as a style token.

3. **Style tokens are bare words, never quoted.** Write `style x bold rounded`, not `style x "bold rounded"`. Each token is a separate space-separated word.

4. **Only use tokens that exist.** There is no `my:4`, `mt:8`, `mb:2`, `text:4xl`, or `text:center`. Check the token tables below. For anything not listed, use the `tw:` escape hatch: `tw:mt-8`, `tw:mb-2`, `tw:text-4xl`.

5. **End every command with a semicolon (`;`) AND a newline.** Each command must be on its own line AND end with `;`. The `;` is the actual command boundary for the parser — the `style` keyword consumes ALL tokens until it hits `;` or end-of-input, so without `;` the next command gets swallowed as style tokens. The newline keeps output readable.
   ```
   # WRONG — no semicolons, style parser eats across commands:
   layout stack as "hero" style pad:8 rounded-xl border
   in hero/content: add text "Hello"

   # WRONG — semicolons but all on one line (unreadable):
   layout stack as "hero" style pad:8 rounded-xl border; in hero/content: add text "Hello"

   # CORRECT — semicolon AND newline after each command:
   layout stack as "hero" style pad:8 rounded-xl border;
   in hero/content: add text "Hello";
   ```

## Core Concepts

- The document is a tree of **nodes** connected by **edges** (parent/slot/child).
- Every document starts with a **root** node: a stack layout named "Root" with a single `content` slot.
- Nodes are referenced by **name** (bare word) or **ID** (`#node-id`). Names are case-sensitive.
- IDs are auto-generated as `kind-N` (e.g. `button-1`, `layout-2`). Use `as "name"` to set a human-friendly name.
- Every command must end with `;` (semicolon) AND be on its own line. The `;` is the parser boundary; the newline is for readability.
- Lines starting with `#` or `//` are comments.

## Node Kinds

These are leaf nodes. They CANNOT contain children.

| Kind        | HTML tag   | Default behavior |
|-------------|------------|------------------|
| `button`    | `<button>` | Styled button with border, rounded corners |
| `text`      | `<span>`   | Plain text display |
| `input`     | `<input>`  | Text input field |
| `card`      | `<div>`    | Rounded, bordered, white bg with shadow (LEAF — no children) |
| `container` | `<div>`    | Generic div wrapper (LEAF — no children) |
| `image`     | `<img>`    | Image element |
| `divider`   | `<hr>`     | Horizontal rule |
| `menu`      | `<nav>`    | Flex column with gap |
| `menuItem`  | `<button>` | Menu row with hover state |
| `link`      | `<a>`      | Blue text with underline on hover (LEAF) |

**To create a container that holds children**, use a `layout` command instead:
```
# WRONG — card cannot hold children:
add card as "myCard";
in myCard/content: add text "Hello";    # THIS WILL NOT RENDER

# CORRECT — use a layout with card styling:
layout stack as "myCard" style card pad-md;
in myCard/content: add text "Hello";    # This works
```

## Layout Types

Layouts are the ONLY nodes that can contain children. Each layout type has named **slots** where children are placed.

| Type      | Slots            | Options (use `=` syntax) |
|-----------|------------------|--------------------------|
| `stack`   | `content`        | `axis=x\|y` (default y), `gap=N` (default 4), `align=start\|center\|end\|stretch`, `justify=start\|center\|end\|between`, `wrap=true` |
| `grid`    | `content`        | `cols=N` (default 1), `gap=N` (default 4) |
| `sidebar` | `left`, `main`   | `leftWidth=N` (default 72), `pad=N` (default 6), `divider=true\|false` |
| `center`  | `content`        | `maxW=sm\|md\|lg\|xl\|2xl\|3xl\|4xl\|5xl\|6xl\|7xl` (default 5xl), `pad=N` (default 6) |
| `split`   | `left`, `right`  | `gap=N` (default 4) |
| `tabs`    | `content`        | (none) |
| `paragraph` | `content`      | (none) — inline flow container, renders as `<p>`. Children (text, link) wrap naturally as inline content. |
| `repeat`    | `content`      | `items=<ref>` (signal reference, e.g. `app.todos`), `key=<field>` (identity field on each item), `template=<macroName>` (row template macro), `empty=<macroName>` (optional empty-state macro) — reactive list rendering from a signal array |

**Options use equals signs:** `layout grid as "g" cols=3 gap=6` — NOT `cols:3` or `gap:6`.

## Commands

### Adding Layouts (containers for children)

```
layout <type> [as "name"] [<option>=<value> ...] [style <tokens...>]
```

Creates a layout node and places it in the current scope's default slot. Options come BEFORE `style`.

```
layout stack as "mainStack";
layout stack as "row" axis=x gap=2;
layout sidebar as "appShell" leftWidth=64;
layout grid as "gallery" cols=3 gap=6;
layout center as "page" maxW=2xl;
layout stack as "myCard" style card pad-md;
```

### Adding Leaf Nodes

```
add <kind> ["label"] [as "name"] [style <tokens...>]
```

Creates a leaf node and places it in the current scope's default slot. The label sets the `text` prop. Without `as`, the name defaults to the auto-generated ID (e.g. `button-1`).

```
add button "Submit" as "submitBtn" style tone:primary rounded;
add text "Hello World";
add input as "emailField";
add divider;
```

### Styling Nodes

```
style <target> <token> [<token> ...]
```

Apply style tokens. Tokens are space-separated bare words — no quotes, no commas.

```
style submitBtn tone:primary rounded shadow;
style mainStack pad-md;
style root h:screen bg:surface;
```

### Setting Props

```
set <target> <prop>=<value> [<prop>=<value> ...]
```

Update properties on a node. This is for data props (text, placeholder, src, etc.), NOT for styling.

```
set #button-1 text="Click Me";
set emailField placeholder="Enter email";
set myImage src="https://example.com/photo.jpg" alt="Photo";
set myLink href="https://google.com";
set myLink href="https://google.com" target="_blank";
set visitBtn href="https://example.com";
```

**`href` on buttons:** Setting `href` on a button upgrades it to render as `<a>` while keeping button styling. Buttons without `href` remain `<button>` elements.

### Rich Text (inline links in text)

Text nodes support markdown-style `[text](url)` link syntax within the `text` prop. Links render as inline `<a>` tags inside the text node.

```
add text "Visit [Google](https://google.com) today" as "intro";
set myText text="Read the [docs](https://docs.example.com) for more info.";
```

Renders: `<span class="text-slate-900">Visit <a href="https://google.com" class="text-blue-700 hover:underline cursor-pointer">Google</a> today</span>`

### Paragraph Layout (inline flow container)

Use `layout paragraph` to create an inline-flow `<p>` container where children (text, link nodes) wrap naturally as inline content. This is useful for composing paragraphs with mixed text and link nodes.

```
layout paragraph as "intro";
in intro/content: add text "Read more at ";
in intro/content: add link "our website" as "siteLink";
in intro/content: add text " for details.";
set siteLink href="https://example.com";
```

Renders: `<p>Read more at <a href="https://example.com" class="text-blue-700 hover:underline cursor-pointer">our website</a> for details.</p>`

**Both approaches can be combined:**

```
layout paragraph as "bio";
in bio/content: add text "I work at [Acme Corp](https://acme.com) building tools.";
in bio/content: add text " Also see [my blog](https://blog.me).";
```

### Scoped Commands

Prefix any command with `in <parent>/<slot>:` to place into a specific slot without entering it:

```
in appShell/main: add button "Save";
in root/content: layout stack as "footer" axis=x;
in shell/left: add text "Logo" style bold text:lg;
```

### Placing and Moving Nodes

```
place <target> in <parent>/<slot> [order <n>]
move <target> to <parent>/<slot> [order <n>]
```

`add` and `layout` already place the node in the current scope. Only use `place`/`move` to relocate a node after creation.

### Other Commands

```
rename <target> "new-name"
delete <target>
dup <target> [as "name"] [--deep]
select <target>
enter [<target>]          # enter scope of a node
exit [<count>]            # exit scope
show [<target>]           # inspect a node
list [nodes|children|slots]
undo [<count>]
redo [<count>]
```

### File Operations

```
export log                   # show command list in transcript
export log file              # download as .txt
export log clipboard         # copy to clipboard
import log file              # import from file picker (resets document)
history compact              # preview compacted history
history compact --apply      # replace history with minimal form
```

## Style Token Reference

Tokens are the ONLY way to style nodes. They use colon syntax (`key:value`) or bare names. Each token maps to one or more Tailwind classes.

**These are NOT layout options.** Do not put them on the `layout` command before `style`.

### Spacing

| Token | CSS | Notes |
|-------|-----|-------|
| `pad:0` through `pad:12` | `p-0` through `p-12` | Exact values: 0,1,2,3,4,5,6,8,10,12 |
| `pad-xs`, `pad-sm`, `pad-md`, `pad-lg`, `pad-xl` | `p-1`, `p-2`, `p-4`, `p-6`, `p-8` | Named sizes |
| `px:0` through `px:12` | `px-0` through `px-12` | Horizontal padding |
| `py:0` through `py:12` | `py-0` through `py-12` | Vertical padding |
| `m:0` through `m:8` | `m-0` through `m-8` | Exact values: 0,2,3,4,6,8 |
| `mx:auto` | `mx-auto` | Center horizontally |
| `gap:0` through `gap:12` | `gap-0` through `gap-12` | Exact values: 0,1,2,3,4,6,8,10,12 |
| `gap-xs`, `gap-sm`, `gap-md`, `gap-lg` | `gap-1`, `gap-2`, `gap-4`, `gap-6` | Named sizes |

**There is no `my:N`, `mt:N`, `mb:N`, `ml:N`, `mr:N`.** Use `tw:` escape hatch for these: `tw:mt-4`, `tw:mb-8`.

### Borders & Radius

| Token | CSS |
|-------|-----|
| `border` | `border border-slate-200` |
| `border-2` | `border-2 border-slate-200` |
| `border:muted` | `border border-slate-100` |
| `border:strong` | `border border-slate-300` |
| `divider` | `border-b border-slate-200` |
| `ring` | `ring-1 ring-slate-200` |
| `rounded` | `rounded-md` |
| `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full` | As named |
| `radius:none` through `radius:full` | `rounded-none` through `rounded-full` |

### Elevation

| Token | CSS |
|-------|-----|
| `shadow` | `shadow` |
| `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` | As named |
| `elev:0` through `elev:4` | `shadow-none` through `shadow-lg` |

### Typography

| Token | CSS | Notes |
|-------|-----|-------|
| `text:xs`, `text:sm`, `text:base`, `text:lg`, `text:xl`, `text:2xl`, `text:3xl` | `text-xs` through `text-3xl` | **Max is `text:3xl`**. For larger, use `tw:text-4xl` etc. |
| `bold` | `font-bold` | |
| `semibold` | `font-semibold` | |
| `medium` | `font-medium` | |
| `light` | `font-light` | |
| `italic` | `italic` | |
| `uppercase` | `uppercase` | |
| `tracking-wide` | `tracking-wide` | |
| `leading-tight`, `leading-relaxed` | As named | |
| `align:left`, `align:center`, `align:right` | `text-left`, `text-center`, `text-right` | **Use `align:center` not `text:center`** |

### Color Intent

| Token | Default CSS | On buttons |
|-------|-------------|------------|
| `tone:primary` | `text-blue-700` | `bg-blue-600 text-white hover:bg-blue-700` |
| `tone:danger` | `text-red-700` | `bg-red-600 text-white hover:bg-red-700` |
| `tone:success` | `text-emerald-700` | `bg-emerald-600 text-white hover:bg-emerald-700` |
| `tone:muted` | `text-slate-600` | `bg-slate-100 text-slate-900 hover:bg-slate-200` |
| `tone:neutral` | `text-slate-900` | `bg-slate-900 text-white hover:bg-slate-800` |

### Backgrounds

| Token | CSS |
|-------|-----|
| `bg:surface` | `bg-white` |
| `bg:muted` | `bg-slate-50` |
| `bg:primary` | `bg-blue-600` |
| `bg:danger` | `bg-red-600` |
| `bg:success` | `bg-emerald-600` |

### Sizing

| Token | CSS |
|-------|-----|
| `w:full` / `w-full` | `w-full` |
| `w-auto`, `w-screen` | As named |
| `w:64`, `w:72`, `w:80`, `w:96` | `w-64` through `w-96` |
| `h:full` / `h-full` | `h-full` (requires parent height) |
| `h:screen` / `h-screen` | `h-screen` (viewport height — use this for full-height layouts) |
| `maxw:sm` through `maxw:7xl` | `max-w-sm` through `max-w-7xl` |

### Flex Utilities

| Token | CSS |
|-------|-----|
| `flex` | `flex` |
| `flex-col` | `flex flex-col` |
| `flex-row` | `flex flex-row` |
| `flex-wrap` | `flex-wrap` |
| `items-center` | `items-center` |
| `justify-center` | `justify-center` |
| `justify-between` | `justify-between` |
| `self-center`, `self-end` | As named |
| `grow`, `nogrow` | `grow`, `grow-0` |
| `shrink`, `noshrink` / `shrink-0` | `shrink`, `shrink-0` |
| `center` | `flex items-center justify-center` |
| `centerX` | `flex justify-center` |
| `centerY` | `flex items-center` |

### Presets (macro tokens)

| Token | Expands to |
|-------|-----------|
| `card` | `rounded-xl border border-slate-200 bg-white shadow-sm` |
| `panel` | `rounded-lg border border-slate-200 bg-white` |
| `muted` | `text-slate-600` |
| `chip` | `inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-sm` |
| `link` | `text-blue-700 hover:underline` |
| `focusable` | `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` |

### Raw Tailwind Escape Hatch

Any Tailwind class not in the token tables above MUST use the `tw:` prefix:

```
style myNode tw:bg-indigo-500 tw:text-white tw:mt-8 tw:mb-4 tw:text-4xl;
```

Common cases requiring `tw:`:
- Margin directions: `tw:mt-4`, `tw:mb-8`, `tw:ml-2`, `tw:mr-2`
- Text sizes above 3xl: `tw:text-4xl`, `tw:text-5xl`
- Specific colors: `tw:bg-blue-50`, `tw:text-gray-400`, `tw:border-blue-500`
- Gradients: `tw:bg-gradient-to-b tw:from-blue-50 tw:to-white`
- Hover/focus states: `tw:hover:bg-blue-100`

## Targeting Nodes

- `#id` — by generated ID: `#button-1`, `#layout-2`
- `name` — by assigned name: `submitBtn`, `appShell`
- `selected` — currently selected node
- `scope` — current scope node
- `root` — the root node

## Complete Example: Personal Homepage

This demonstrates correct usage of all major features. **Note: every command ends with `;` and is on its own line.**

```
style root h:screen bg:surface;
layout center as "page" maxW=2xl pad=8;
layout stack as "hero" style pad:8 tw:bg-gradient-to-b tw:from-blue-50 tw:to-white rounded-xl border;
in hero/content: add text "Alex Turner" style tw:text-4xl semibold;
in hero/content: add text "Senior Software Engineer" style text:xl muted;
in hero/content: add text "Building scalable systems and elegant UIs." style align:center;
place hero in page/content;
layout stack as "skills" style tw:mt-8;
in skills/content: add text "Core Expertise" style text:2xl semibold;
in skills/content: layout stack as "skillTags" axis=x wrap=true gap=2;
in skillTags/content: add text "TypeScript" style chip;
in skillTags/content: add text "React" style chip;
in skillTags/content: add text "Node.js" style chip;
in skillTags/content: add text "Python" style chip;
place skills in page/content;
layout stack as "experience" style tw:mt-8;
in experience/content: add text "Experience" style text:2xl semibold;
in experience/content: layout stack as "job1" gap=1;
in job1/content: add text "Apple" style semibold;
in job1/content: add text "Senior Software Engineer, 2022-Present" style text:sm muted;
in job1/content: add text "Led iOS performance features with Swift and SwiftUI." style text:sm;
in experience/content: layout stack as "job2" gap=1;
in job2/content: add text "Google" style semibold;
in job2/content: add text "Software Engineer, 2019-2022" style text:sm muted;
in job2/content: add text "Built core infrastructure for Google Workspace." style text:sm;
place experience in page/content;
layout stack as "projects" style tw:mt-8;
in projects/content: add text "Featured Projects" style text:2xl semibold;
in projects/content: layout grid as "projectGrid" cols=3 gap=4;
in projectGrid/content: layout stack as "proj1" gap=2 style card pad-md;
in proj1/content: add text "Architect UI" style text:lg semibold;
in proj1/content: add text "A design system framework." style text:sm muted;
in proj1/content: add button "View" style tone:primary;
in projectGrid/content: layout stack as "proj2" gap=2 style card pad-md;
in proj2/content: add text "ScaleFlow" style text:lg semibold;
in proj2/content: add text "Serverless workflow orchestrator." style text:sm muted;
in proj2/content: add button "View" style tone:primary;
in projectGrid/content: layout stack as "proj3" gap=2 style card pad-md;
in proj3/content: add text "TypeSafe API" style text:lg semibold;
in proj3/content: add text "End-to-end type safety." style text:sm muted;
in proj3/content: add button "View" style tone:primary;
place projects in page/content;
layout stack as "contact" style bg:muted pad:6 rounded-lg tw:mt-8;
in contact/content: add text "Get in Touch" style text:xl semibold;
in contact/content: layout stack as "contactBtns" axis=x gap=3;
in contactBtns/content: add button "Email" style tone:neutral;
in contactBtns/content: add button "LinkedIn" style tone:neutral;
in contactBtns/content: add button "GitHub" style tone:neutral;
place contact in page/content;
in page/content: add text "2026 Alex Turner" style text:xs muted align:center tw:mt-8;
```

## Macros

Macros let you capture a node subtree as a reusable template and instantiate copies with overridable properties. Expansion is eager — `use` emits concrete `CreateNode`/`PlaceChild` commands, so undo/redo works automatically.

### Defining a Macro

Select or target a node, then capture it as a macro:

```
add button "Click me" as "myBtn" style tone:primary;
select myBtn;
macro define "PrimaryButton" from selected;
```

The `from` argument accepts any valid target: `selected`, a node name, or `#id`.

### Declaring Parameters

Params are prop key names that can be overridden when instantiating:

```
macro params "PrimaryButton" text href;
```

### Instantiating a Macro

```
use "PrimaryButton" text="Save" href="/save";
use "PrimaryButton" text="Cancel";
```

Each `use` creates independent concrete nodes. Param bindings apply to the root template node only — children keep their template defaults.

Passing an undeclared param key produces a warning but still applies.

### Multi-Node Macros

Macros can capture entire subtrees:

```
layout stack as "card" style card pad-md;
in card/content: add text "Title" style text:lg bold;
in card/content: add text "Description" style text:sm muted;
select card;
macro define "InfoCard" from selected;
macro params "InfoCard" text;
use "InfoCard" text="New Title";
```

### Other Macro Commands

```
macro show "PrimaryButton";    # display definition details
macro list;                     # list all defined macros
macro delete "PrimaryButton";  # remove a macro
```

### Scoped Instantiation

Like other commands, `use` respects scope prefixes:

```
in page/content: use "PrimaryButton" text="Go";
```

## Compile-Time Repeat

The `repeat` command expands a block of commands N times before parsing. It's a text-level preprocessor — the expanded commands are what the parser sees.

### Syntax

```
repeat <N> [as <ident>] {
  <commands with {ident} interpolation>;
}
```

- `N` is an integer literal (how many copies to generate)
- `as <ident>` names the loop variable (default is `i`)
- `{ident}` inside the block is replaced with the loop index (0-based)
- Works in both quoted strings and bare identifiers

### Examples

```
# Create 3 buttons named btn-0, btn-1, btn-2:
repeat 3 as i {
  in list/content: add button "Item {i}" as "btn-{i}";
}

# Expands to:
in list/content: add button "Item 0" as "btn-0";
in list/content: add button "Item 1" as "btn-1";
in list/content: add button "Item 2" as "btn-2";
```

```
# Default variable is "i":
repeat 2 {
  layout stack as "row-{i}";
}

# Expands to:
layout stack as "row-0";
layout stack as "row-1";
```

```
# Create a pool of 10 hidden rows for a dynamic list:
repeat 10 as n {
  in list/content: layout stack as "row{n}" axis=x gap=3 align=center style tw:hidden;
  in row{n}/content: add text "" as "title{n}" style tw:flex-1;
  in row{n}/content: add button "X" as "del{n}";
}
```

### Notes

- The expansion happens before parsing, so the transcript shows the original `repeat` syntax
- Nested braces in JSON literals and triple-quote strings are handled correctly (brace depth counting)
- `{i}` only replaces the exact variable name — `{"key": "value"}` in JSON is not affected
- Multiple sequential `repeat` blocks in the same input are expanded left-to-right

## Runtime Repeat Layout

The `layout repeat` type creates a reactive list container that renders items from a signal array using a macro as the row template. Unlike compile-time `repeat`, this responds to data changes at runtime.

### Syntax

```
layout repeat as "name" items=<signalRef> key=<field> template=<macroName> [empty=<macroName>];
```

### Options

| Option | Description |
|--------|-------------|
| `items=<ref>` | Reference to a reactive array signal (e.g. `app.todos` → reads `window.__app.todos`) |
| `key=<field>` | Property name on each item used as stable identity for efficient diffing |
| `template=<macroName>` | Name of a macro defined with `macro define` — used as the row template |
| `empty=<macroName>` | (Optional) Macro to render when the list is empty |

### How It Works

1. Define a macro for the row template (using `macro define`)
2. Create a `layout repeat` node with `items`, `key`, and `template` options
3. A script on a parent/controller node creates the items signal on `window.__app`
4. When the signal changes, the repeat node automatically re-renders rows from the template macro
5. Item data fields are interpolated into `{field}` placeholders in the template's text props

### Example

```
# 1. Create the row template
layout stack as "todoRowTemplate" axis=x gap=3 align=center;
in todoRowTemplate/content: add text "{text}" as "rowText";
in todoRowTemplate/content: add button "X" as "rowDel";
select todoRowTemplate;
macro define "TodoRow" from selected;
delete todoRowTemplate;

# 2. Create the repeat container
layout repeat as "todoList" items=app.todos key=id template=TodoRow;

# 3. Controller script creates the signal
script set appContainer """
if (!window.__app) {
  const todos = ctx.signal([
    { id: '1', text: 'Buy groceries' },
    { id: '2', text: 'Write tests' },
  ]);
  window.__app = { todos };
}
""";
```

When `window.__app.todos` updates, the repeat node automatically adds/removes/reorders rows. Each row gets a stable IR identity based on the `key` field, so DOM nodes are reused efficiently.

## Scripts

Scripts attach JavaScript behavior to individual nodes. Each script runs inside a reactive root and has access to **only its own node's** DOM element, reactive primitives, FSM controllers, and the router.

### Key Principle: Scripts Do NOT Generate HTML

Scripts are for **behavior**, not structure. All UI structure must be created with composer commands (`add`, `layout`, `place`, etc.). Scripts then attach interactivity to those pre-existing nodes.

**NEVER do any of the following in scripts:**
- `document.getElementById()` or any DOM query (`querySelector`, `getElementsByClassName`, etc.)
- `document.createElement()` or `innerHTML` / `insertAdjacentHTML`
- `set myNode id="some-id"` — the `id` prop is not rendered as an HTML attribute; this does nothing useful
- Reach outside `self.el` to modify other elements

**The correct pattern:** Build all nodes with commands first. Then attach a small script to each node that needs behavior. Scripts communicate with each other through **FSMs** (`ctx.global.fsm()`) and **signals on `ctx.scope`**, not by querying the DOM.

### How to Build Interactive UIs

1. **Create all nodes and layouts with commands.** Every piece of UI — every button, text label, list container — must exist as a composer node.
2. **Use FSMs for shared state.** Define state machines for app-level state (filters, toggles, visibility). Multiple scripts can read/write the same FSM.
3. **Attach one script per node that needs behavior.** Each script only touches `self` (its own element) and reads/writes shared state via FSMs or `ctx.scope`.
4. **Use `self.text()` to update text content.** A text node's display can be changed reactively by its own script.
5. **Use `self.class_()` and `self.style()` for visual changes.** Toggle classes or set styles on the node's own element.
6. **Use `self.onClick()` / `self.on()` for events.** Handle user interaction on the node the script is attached to.

### Commands

```
script set [<target>]       # enter script capture mode (opens textarea; Cmd+Enter to save)
script set [<target>] """   # inline script block (no capture mode needed)
<source>
""";
script show [<target>]      # display the script source for a node
script clear [<target>]     # remove the script from a node
```

If no target is given, the currently selected node is used.

### Inline Script Blocks

Use triple-quoted strings (`"""..."""`) to embed script source directly in the command, without entering capture mode. This lets you paste an entire app (commands + scripts) in one shot.

```
script set myButton """
const lamp = ctx.global.fsm('lamp');
self.onClick(() => lamp.send('TOGGLE'));
""";
```

One leading newline and one trailing newline are stripped automatically, so the source content starts and ends cleanly. The only disallowed sequence inside the triple-quoted block is `"""` itself (which is not valid JS anyway).

Empty triple-quote blocks (`""" """`) produce an error.

### Script Capture Mode

`script set myBtn` (without `"""`) opens a multi-line textarea. Write JavaScript in it and press **Cmd+Enter** (or click Save) to attach the script. Press **Escape** to cancel. If the node already has a script, its source is pre-filled for editing.

### Script Environment

Scripts receive two arguments: `self` (DOM facade for **this node only**) and `ctx` (reactive context).

**`self` — this node's DOM element API:**

| Method | Description |
|--------|-------------|
| `self.el` | The raw `HTMLElement` (this node only) |
| `self.on(event, handler)` | Add event listener (auto-cleaned on dispose) |
| `self.onClick(handler)` | Shorthand for `self.on('click', handler)` |
| `self.onInput(handler)` | Shorthand for `self.on('input', handler)` |
| `self.text(value)` | Set `textContent` |
| `self.prop(name, value)` | Set a DOM property |
| `self.class_(name, active?)` | Add/remove a CSS class |
| `self.style(prop, value)` | Set an inline style property |

**`ctx` — reactive context:**

| Member | Description |
|--------|-------------|
| `ctx.signal(initial)` | Create a reactive signal |
| `ctx.effect(fn)` | Create a reactive effect (re-runs when signals it reads change) |
| `ctx.memo(fn)` | Create a computed/memoized value |
| `ctx.batch(fn)` | Batch multiple signal updates |
| `ctx.onMount(fn)` | Run after script body executes; return a cleanup function |
| `ctx.log(...args)` | Console log prefixed with `[script:nodeId]` |
| `ctx.props` | Copy of the node's props at script init time |
| `ctx.scope` | **Per-node only** — private to this node, NOT shared with other nodes. Use `window.__app` for cross-node state. |

**`ctx.global` — global systems:**

| Member | Description |
|--------|-------------|
| `ctx.global.fsm(name)` | Get an FSM controller (`.state()` reads, `.send(event)` transitions) |
| `ctx.global.router.pathname()` | Current path |
| `ctx.global.router.params()` | Route params |
| `ctx.global.router.query()` | Query string params |
| `ctx.global.router.push(path)` | Navigate to a path |
| `ctx.global.router.replace(path)` | Replace current path |
| `ctx.global.router.back()` | Go back |
| `ctx.global.router.forward()` | Go forward |

### Example: Counter Button

```
add button "Count: 0" as "counter";
script set counter """
const count = ctx.signal(0);
self.onClick(() => count.set(count() + 1));
ctx.effect(() => self.text(`Count: ${count()}`));
""";
```

### Example: Tab Switching with FSMs

This is the correct pattern for multi-node interactivity. Define an FSM, then each node reads/writes it independently. With inline scripts, the entire app can be pasted in one shot:

```
fsm define tabs initial tab1;
fsm state tabs tab1 on TAB2 tab2 on TAB3 tab3;
fsm state tabs tab2 on TAB1 tab1 on TAB3 tab3;
fsm state tabs tab3 on TAB1 tab1 on TAB2 tab2;

layout stack as "tabBar" axis=x gap=2;
in tabBar/content: add button "Tab 1" as "tab1Btn";
in tabBar/content: add button "Tab 2" as "tab2Btn";
in tabBar/content: add button "Tab 3" as "tab3Btn";

layout stack as "panels";
in panels/content: add text "Content for tab 1" as "panel1";
in panels/content: add text "Content for tab 2" as "panel2";
in panels/content: add text "Content for tab 3" as "panel3";

script set tab1Btn """
const tabs = ctx.global.fsm('tabs');
self.onClick(() => tabs.send('TAB1'));
ctx.effect(() => {
  const active = tabs.state() === 'tab1';
  self.class_('bg-blue-600', active);
  self.class_('text-white', active);
});
""";

script set tab2Btn """
const tabs = ctx.global.fsm('tabs');
self.onClick(() => tabs.send('TAB2'));
ctx.effect(() => {
  const active = tabs.state() === 'tab2';
  self.class_('bg-blue-600', active);
  self.class_('text-white', active);
});
""";

script set panel1 """
const tabs = ctx.global.fsm('tabs');
ctx.effect(() => {
  self.class_('hidden', tabs.state() !== 'tab1');
});
""";

script set panel2 """
const tabs = ctx.global.fsm('tabs');
ctx.effect(() => {
  self.class_('hidden', tabs.state() !== 'tab2');
});
""";
```

**Pattern:** Each script is small (3-5 lines), touches only `self`, and coordinates through the shared FSM. No script needs to know about other nodes' DOM elements.

### Example: Router Navigation

```
script set navSettings """
const router = ctx.global.router;
self.onClick(() => router.push('/settings'));
ctx.effect(() => {
  const active = router.routeName() === 'settings';
  self.class_('bg-slate-200', active);
  self.class_('text-slate-800', active);
});
""";
```

### Anti-Patterns to Avoid

| Wrong | Right | Why |
|-------|-------|-----|
| `document.getElementById('foo')` | Use `self` API on each node's own script | Scripts must not query the DOM |
| `self.el.innerHTML = '<div>...'` | Create nodes with `add`/`layout` commands | Scripts must not generate HTML |
| `set myNode id="x"` | Don't — `id` prop isn't rendered | The `id` prop does nothing; use node names |
| One giant script on root that controls everything | Small script per node, coordinate via FSM | Each script owns only its own node |
| `document.createElement('li')` in a loop | Use `layout repeat` with a template macro, or pre-create rows with commands | Structure is commands, behavior is scripts |
| Storing state in plain global variables | Use `window.__app` with `ctx.signal`, or FSMs | Proper lifecycle and reactivity |
| `ctx.scope.x` to share state between nodes | `window.__app.x` | `ctx.scope` is per-node, NOT shared across nodes |

### Lifecycle

- Scripts run after each document change when the DOM has been patched.
- If a node's script source changes, the old instance is disposed and the new one runs fresh.
- If a node is deleted, its script is disposed automatically.
- Event listeners registered via `self.on()` are cleaned up on dispose.
- `ctx.onMount` cleanup functions are called on dispose.

## Interactive App Patterns

This section covers the patterns needed to build apps with dynamic behavior (todo lists, forms, filtered lists, etc.). Read this before writing any app with scripts.

### Pattern 1: Shared State via `window.__app`

**`ctx.scope` is PER-NODE.** Each node's script gets its own isolated `ctx.scope = {}`. Scripts on different nodes CANNOT share state through `ctx.scope`. Do NOT use `ctx.scope` for cross-node communication.

To share state across nodes, use **`window.__app`** (or any `window.__yourAppName` key). Attach one "app controller" script to a top-level container that initializes shared signals on `window`. All other scripts read from `window.__app`.

```
# App controller script (attached to a container node):
script set appContainer """
if (!window.__app) {
  const todos = ctx.signal([]);
  const draft = ctx.signal('');
  const editingId = ctx.signal(null);
  window.__app = { todos, draft, editingId };
}
""";

# In any other node's script:
script set someNode """
const app = window.__app;
ctx.effect(() => {
  const items = app.todos();
  // react to changes...
});
""";
```

**Use `window.__app`** for data lists, draft text, editing state, and any data shared between nodes. Use **FSMs** (`ctx.global.fsm()`) for simple enumerated state (filters, tabs, toggles). Use **`ctx.scope`** only for state private to a single node's script (e.g., internal counters or flags that no other node needs).

### Pattern 2: Dynamic Lists (Row Pool)

> **Tip:** For simpler cases, consider using `layout repeat` (see "Runtime Repeat Layout" above) instead of a manual row pool. The repeat layout automatically creates/destroys rows from a template macro when the items signal changes.

Scripts cannot create or delete nodes. For a variable-length list (todo items, search results, etc.), **pre-create a fixed pool of row nodes** and show/hide them reactively.

Create N identical rows with inline scripts — all pasteable in one shot:
```
layout stack as "list" gap=2;

# Row 0
in list/content: layout stack as "row0" axis=x gap=3 align=center style tw:hidden;
in row0/content: add button "O" as "tog0";
in row0/content: add text "" as "title0" style tw:flex-1;
in row0/content: add button "X" as "del0";

# Row 1
in list/content: layout stack as "row1" axis=x gap=3 align=center style tw:hidden;
in row1/content: add button "O" as "tog1";
in row1/content: add text "" as "title1" style tw:flex-1;
in row1/content: add button "X" as "del1";

# ... repeat for row2 through rowN

script set row0 """
const app = window.__app;
const INDEX = 0;
ctx.effect(() => {
  const visible = app.visibleTodos();
  const item = visible[INDEX];
  if (!item) {
    self.class_('hidden', true);
    return;
  }
  self.class_('hidden', false);
});
""";

script set title0 """
const app = window.__app;
const INDEX = 0;
ctx.effect(() => {
  const visible = app.visibleTodos();
  const item = visible[INDEX];
  self.text(item ? item.text : '');
});
""";

script set tog0 """
const app = window.__app;
const INDEX = 0;
self.onClick(() => {
  const item = app.visibleTodos()[INDEX];
  if (item) app.toggle(item.id);
});
ctx.effect(() => {
  const item = app.visibleTodos()[INDEX];
  self.text(item?.done ? '✓' : 'O');
});
""";
```

Each row starts with `tw:hidden`. The row script shows/hides itself and updates its content based on its index into the visible data.

**How many rows?** Pre-create enough for the expected max. 10-20 rows is typical. Unused rows stay hidden and cost nothing visually.

### Pattern 3: Input Value Sharing

An input node's script can read its own value, but a button node's script cannot read the input. Solution: the input script writes to a shared signal, and the button script reads it.

```
layout stack as "inputRow" axis=x gap=3;
in inputRow/content: add input as "todoInput";
set todoInput placeholder="Add a task...";
in inputRow/content: add button "Add" as "addBtn";

script set todoInput """
const app = window.__app;
self.on('input', () => {
  app.draft.set(self.el.value);
});
self.on('keydown', (e) => {
  if (e.key === 'Enter') {
    app.add(app.draft());
    app.draft.set('');
    self.el.value = '';
  }
});
// Clear input when draft is externally reset (e.g., by add button)
ctx.effect(() => {
  const d = app.draft();
  if (d === '' && self.el.value !== '') {
    self.el.value = '';
  }
});
""";

script set addBtn """
const app = window.__app;
self.onClick(() => {
  app.add(app.draft());
  app.draft.set('');
});
""";
```

### Pattern 4: Filters with FSMs

For toggling between views (all/active/done), use an FSM. Each filter button sends an event; each row reads the FSM state to decide visibility.

```
fsm define todoFilter initial all;
fsm state todoFilter all on ACTIVE active on DONE done;
fsm state todoFilter active on ALL all on DONE done;
fsm state todoFilter done on ALL all on ACTIVE active;

layout stack as "filters" axis=x gap=2;
in filters/content: add button "All" as "filterAll";
in filters/content: add button "Active" as "filterActive";
in filters/content: add button "Done" as "filterDone";

script set filterAll """
const filter = ctx.global.fsm('todoFilter');
self.onClick(() => filter.send('ALL'));
ctx.effect(() => {
  const active = filter.state() === 'all';
  self.class_('bg-blue-600', active);
  self.class_('text-white', active);
});
""";
```

The app controller script uses the FSM to compute visible items:
```
script set appContainer """
const filter = ctx.global.fsm('todoFilter');
window.__app.visibleTodos = ctx.memo(() => {
  const all = window.__app.todos();
  const f = filter.state();
  if (f === 'active') return all.filter(t => !t.done);
  if (f === 'done') return all.filter(t => t.done);
  return all;
});
""";
```

### Pattern 5: Stat Counters

Text nodes that display computed values (counts, labels) each have their own script that reads shared state:

```
layout stack as "stats" axis=x gap=2;
in stats/content: add text "Total: 0" as "statTotal" style chip;
in stats/content: add text "Active: 0" as "statActive" style chip;
in stats/content: add text "Done: 0" as "statDone" style chip;

script set statTotal """
const app = window.__app;
ctx.effect(() => {
  self.text(`Total: ${app.todos().length}`);
});
""";

script set statActive """
const app = window.__app;
ctx.effect(() => {
  self.text(`Active: ${app.todos().filter(t => !t.done).length}`);
});
""";
```

### Pattern 6: Inline Editing

For editable text, place both a text node and an input in the same row. Toggle visibility based on editing state.

```
# Inside each row:
in row0/content: add text "" as "title0" style tw:flex-1;
in row0/content: add input as "edit0" style tw:flex-1 tw:hidden;

script set title0 """
const app = window.__app;
const INDEX = 0;
self.onClick(() => {
  const item = app.visibleTodos()[INDEX];
  if (item) app.editingId.set(item.id);
});
ctx.effect(() => {
  const item = app.visibleTodos()[INDEX];
  const editing = item && app.editingId() === item.id;
  self.class_('hidden', !!editing);
  self.text(item ? item.text : '');
});
""";

script set edit0 """
const app = window.__app;
const INDEX = 0;
ctx.effect(() => {
  const item = app.visibleTodos()[INDEX];
  const editing = item && app.editingId() === item.id;
  self.class_('hidden', !editing);
  if (editing) {
    self.el.value = item.text;
    self.el.focus();
  }
});
self.on('keydown', (e) => {
  const item = app.visibleTodos()[INDEX];
  if (!item) return;
  if (e.key === 'Enter') {
    app.editCommit(item.id, self.el.value);
  }
  if (e.key === 'Escape') {
    app.editingId.set(null);
  }
});
""";
```

### Putting It All Together: App Controller Script

Attach one "bootstrap" script to the top-level app container that initializes all shared state and helper functions. This runs first and sets up `window.__app` for all other scripts to use.

```
script set app """
if (!window.__app) {
  const STORAGE_KEY = 'myapp.todos.v1';
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const todos = ctx.signal(load());
  const draft = ctx.signal('');
  const editingId = ctx.signal(null);
  const filter = ctx.global.fsm('todoFilter');

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos())); } catch {}
  };

  const visibleTodos = ctx.memo(() => {
    const all = todos();
    const f = filter.state();
    if (f === 'active') return all.filter(t => !t.done);
    if (f === 'done') return all.filter(t => t.done);
    return all;
  });

  window.__app = {
    todos, draft, editingId, visibleTodos,
    add(text) {
      const v = String(text || '').trim();
      if (!v) return;
      todos.set([{ id: uid(), text: v, done: false }, ...todos()]);
    },
    toggle(id) {
      todos.set(todos().map(t => t.id === id ? { ...t, done: !t.done } : t));
    },
    remove(id) {
      todos.set(todos().filter(t => t.id !== id));
    },
    editCommit(id, text) {
      const v = String(text || '').trim();
      if (!v) { window.__app.remove(id); return; }
      todos.set(todos().map(t => t.id === id ? { ...t, text: v } : t));
      editingId.set(null);
    },
    markAllDone() {
      todos.set(todos().map(t => ({ ...t, done: true })));
    },
    clearDone() {
      todos.set(todos().filter(t => !t.done));
      editingId.set(null);
    },
  };

  // Auto-persist
  ctx.effect(() => { todos(); persist(); });
}
""";
```

Then every other script is 3-8 lines, reading from `window.__app`.

## Common Mistakes to Avoid

| Wrong | Right | Why |
|-------|-------|-----|
| `layout stack style border` *(next line)* `add text "hi"` | `layout stack style border;\nadd text "hi";` | Missing `;` — `style` eats all tokens until `;`, so without it the next command gets consumed as style tokens |
| `layout stack gap:4` | `layout stack gap=4` | Layout options use `=`, not `:` |
| `layout stack pad:8` | `layout stack style pad:8` | `pad:8` is a style token, must come after `style` keyword |
| `add card as "c";\nin c/content: add text "hi";` | `layout stack as "c" style card;\nin c/content: add text "hi";` | Cards are leaf nodes, can't hold children |
| `style x "bold rounded"` | `style x bold rounded` | Tokens are never quoted |
| `style x text:center` | `style x align:center` | `text:center` doesn't exist |
| `style x my:4` | `style x tw:my-4` | `my:N` doesn't exist, use `tw:` |
| `style x text:4xl` | `style x tw:text-4xl` | Max built-in is `text:3xl` |
| `set x style bold` | `style x bold` | `set` is for props, `style` is for tokens |
| `in x: add text` (x is a button) | Create a layout instead | Only layouts can hold children |
