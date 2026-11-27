# Vikunja Companion

Manage [Vikunja](https://vikunja.io) tasks from your browser toolbar with full task management, 1-click URL capture, inline task editing, and official Vikunja dark/light themes.

> **Note:** Vikunja Companion is an independent, enhanced fork of [dasJ/vikunja-webextension](https://github.com/dasJ/vikunja-webextension) by Janne Heß, maintained by [arqueon](https://github.com/arqueon).

## Companion Enhancements

- **Direct 1-Click URL Capture**: Dedicated capture bar with a *Save now* button that files the current tab into your capture defaults (project and labels), configurable in the options.
- **Native Firefox (Proton) design**: The popup, capture form and options page follow Firefox's Proton design language — panel-matched backgrounds, 4px radii, menu-like task rows, ghost toolbar buttons — in both light and dark, keeping Vikunja blue as the accent.
- **Persistent drafts**: Anything typed into the quick-add or the capture form is mirrored to session storage on every keystroke and restored when the popup reopens, so losing the popup's focus never loses your text. A successful submit (or an explicit cancel) clears the draft.
- **Capture defaults for pipelines**: A dedicated options section sets the project and the automatic labels for pages captured from the browser (toolbar button, context menu, `Alt+Shift+V`). Labels are created on demand, and the labels you use most surface first in the capture form.
- **Visible, editable link field**: Captured URLs now show in their own field instead of being buried in the description; the markdown link Vikunja expects is rebuilt at submit time.
- **Hierarchical Project Tree & Scope Filter**: Visual indenting and pre-order hierarchy support for nested projects, plus a compact project/subproject filter dropdown in the popup header that automatically includes subprojects when selecting a parent project.
- **Quick Preset Filters**: Direct toolbar filter chips for *All*, *Inbox*,
  *Due Today*, *Starred/Favorites*, and a toggle for completed tasks. The
  Inbox chip appears automatically when a project named "Inbox" exists (its
  label mirrors the project's own title) and scopes the whole list to that
  project, so it slots straight into an Inbox-first pipeline.
- **Inline Task Card Editor**: Click the card edit icon to expand a rich inline editor with title, description, priority, dates, and safe 3-second countdown deletion.
- **Official Vikunja Theme**: Full support for Vikunja's official dark and light palettes with accent (`#196aff`) and appearance switcher (Auto / Dark / Light).
- **AMO-Ready Packaging**: Clean Manifest V3 compliant package (`vikunja-companion@arqueonautis.org`) with zero linter errors.

## Core Features

- **Toolbar popup** — a searchable task list (480px wide) with complete/reopen checkboxes,
  two-line entries (title on the first line; project, due date, priority,
  labels and a preview of the body on the second) and rendered HTML
  descriptions: list rows show the flattened body text, and the inline
  editor renders a sanitized preview of the HTML above the raw source. The
  Vikunja logo opens your instance, and
  the settings gear opens the options page.
- **Quick Add Magic** — type a task like `+Home Water plants !3 *focus @alice
  tomorrow` in the popup and it is parsed exactly like the Vikunja web app:
  projects (`+`/`#`), labels (`*`/`@`), priorities (`!`), assignees
  (`@`/`+`), natural-language dates and `every X` repeats. Both the Vikunja and
  Todoist prefix modes are supported, and the active mode is read from your
  Vikunja frontend settings (never from the extension). While you type, a row
  of select-backed chips (Project, Priority, Labels, Assignee, Date, Repeat)
  appears below the input; picking a value writes the matching magic token into
  the text, so you can fill every field without remembering the syntax. Chips
  turn gray when a field is unset and color-coded once it is set. Once you
  start typing, a compact Add button appears below the chips.
- **Capture current page** — add the current tab, a selection or a link as a
  task via the plus button, the right-click menu ("Add to Vikunja…") or the
  `Alt+Shift+V` shortcut, then refine it right in the popup before saving. The
  link shows in its own field (still written to the description as a markdown
  link), the project and labels default to your capture settings, and the
  labels you use most appear first as one-click chips. `Ctrl+Enter` saves,
  `Esc` goes back.
- **Options page** — configure your instance URL, API token (with the required
  permissions documented on the page), default project, "due today" default, a
  custom filter for the task list, the default sort order and whether to
  remember your last sort choice, plus a dedicated *Captures from the
  browser* section (project and automatic labels for captured pages).
- **Kanban triage board** — a button in the popup header opens a floating
  ~900px panel with your tasks as cards. Three modes, switchable from the
  header: **Views** loads your favorited saved filters with their real Vikunja
  kanban view and columns (supporting both manual drag-and-drop views and
  read-only filter-based views, plus task identifier badges); **Projects**
  displays your nested project tree in true parent → child order with each
  project's own kanban view; and **Move to project** shows cross-project
  columns (Inbox + projects carrying tasks) so dragging a card moves it to
  that project. Powered by Vikunja API v2 (`buckets/tasks` and view-scoped
  `PUT .../buckets/{bucket}/tasks`), opening on *Inbox* by default and
  supporting native drag & drop, ←/→ nudges, a complete checkbox, a link to
  the web view, and a pending-only toggle.
- **Sorting** — a sort button in the popup header opens a menu to order the
  task list by Vikunja's manual position, title, created, updated, due date or
  priority, each of which can be reversed (ascending/descending). Newly added
  tasks are placed according to the active sort. Manual sorting uses Vikunja's
  per-view position and therefore needs a default project; otherwise the list
  falls back to newest first. The default sort is set in the options; with
  "remember last sort choice" enabled, the popup stores your last pick in the
  browser's local storage and it takes precedence.
- **Saved filters** — filters you starred in Vikunja appear as chips at the
  top of the popup, next to an *All tasks* chip. Click a chip to show exactly
  that saved filter, with the choice remembered for the next time you open the
  popup. Unstar a filter in the web app and its chip disappears.
- **Keyboard shortcuts** — `Alt+Shift+K` opens the popup, `Alt+Shift+V` adds
  the current website as a task. Inside the popup, `Ctrl+F` / `⌘F` focuses the
  search bar and `Ctrl+N` / `⌘N` the quick-add insertion bar (on macOS the
  `⌘` variants replace `Ctrl`). In Firefox `Ctrl+N` is reserved for a new
  browser window, so there the quick-add bar is focused with `Alt+Shift+N`
  instead.

## Language

The extension ships in **English**, **German**, **Spanish** and **Russian**. The language is chosen from
your browser's UI language (English is the fallback), so no in-extension setting
is needed. The Quick Add Magic syntax stays English by design: its project,
label, priority, date and repeat tokens (`+`, `*`, `!`, `@`, `tomorrow`,
`every X`, …) are parsed identically to the Vikunja web app, which only
understands English tokens. Add or edit a language by creating an entry in
[`_locales/<locale>/messages.json`](_locales/).

## Inspirations

The extension is inspired by the **Todoist extension for Chrome** (quick task
capture from the toolbar) and borrows its signature *Quick Add Magic* text
parsing, which is implemented as a plain-JavaScript port of the official
Vikunja frontend so behaviour stays in lock-step with the web app.

## Disclaimer

This extension is an **independent, unofficial project**. It is **not
affiliated with, endorsed by, or connected to** the Vikunja project
([vikunja.io](https://vikunja.io) / `go-vikunja/vikunja`) or its maintainers.
The **Vikunja name and logo** are the property of their respective owners (the
Vikunja project) and are used here only to identify the service this extension
works with.

## Development

This project was built with **heavy use of an AI coding assistant**
(opencode / "big-pickle" model): the Quick Add Magic port, the extension
refactor, and most of the code in this repository were produced with its help
and verified against the upstream Vikunja parser.

### Caching

The popup opens far more often than a project/filter list changes, so the
`/projects` response (which also carries the saved filters used by the view
switcher) is cached per instance in session storage. The cache is tagged with
the instance base URL and reused for 5 minutes, so opening the popup twice in a
row performs the task fetch but not another `/projects` request. Options page
connection tests pass `forceRefresh` and always read fresh data. Session
storage is volatile (cleared when the browser restarts), so the cache never
stales across sessions.

### Smoke tests

The repository ships a set of plain-Node smoke tests (no dependencies, no build
step). Run them from the repository root:

```sh
node smoketests/vikunja_lib_test.js        # API client (pagination, tasks, labels, users)
node smoketests/vikunja_popup_test.js      # popup UI + Quick Add Magic flow
node smoketests/vikunja_kanban_test.js     # kanban board: groupings, moves, fallback
node smoketests/vikunja_extra_test.js      # options window
node smoketests/vikunja_element_test.js    # background: Element instances, content-script hooks
node smoketests/vikunja_content_test.js    # Element page: injected buttons + toasts
node smoketests/quickadd_harness.js        # 933 Quick Add Magic parity assertions
```

Each suite prints a summary and exits non-zero on any failure, so the tests can
also be run together:

```sh
for f in smoketests/*.js; do node "$f" || break; done
```

The Quick Add Magic parser is validated against the official
`go-vikunja/vikunja` frontend test suite, so a green harness means the popup
parses task text identically to the web app.

## Loading the extension

- **Firefox:** `about:debugging` → *This Firefox* → *Load Temporary Add-on* →
  select `manifest.json`.
- **Chrome:** `chrome://extensions` → enable *Developer mode* → *Load unpacked*
  → select this folder.

Then open the options page, enter your Vikunja URL and an API token with the
permissions listed on the page, and you are ready to go.

## Packaging & AMO Validation

### Validate for Firefox Add-ons (AMO)

Verify that the staged build passes Mozilla's `web-ext lint` with zero errors:

```sh
npm run lint:amo
```

### Build for Firefox

Build `dist/vikunja-companion-<version>.xpi` and `dist/vikunja-companion-<version>.zip`:

```sh
npm run pack:firefox
```

The pack script stages only the shipped files, strips Chrome-specific fields from `manifest.json`, and outputs packages ready for upload to [addons.mozilla.org](https://addons.mozilla.org/).

### Build for Chrome

Build `dist/vikunja-chrome-<version>.zip`:

```sh
npm run pack:chrome
```

The Chrome pack stages only the shipped files and drops Firefox-only `background.scripts` and `browser_specific_settings` keys from the manifest.

## Publishing to Firefox Add-ons (AMO)

1. Run `npm run lint:amo` (must report 0 errors and 0 warnings) and `npm run pack:firefox`.
2. Open the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/addon/vikunja-companion/edit) (choose **"On this site"** for listed distribution).
3. Upload `dist/vikunja-companion-<version>.zip` (or `.xpi`).
4. Use the store assets in [`store/`](store/) (`icon-amo-256.png`, `screenshots/*.png`) and AMO subset Markdown listing copy in [`store/LISTING.md`](store/LISTING.md) (avoid 4-space indents and `###` headings).
5. Select categories (**Bookmarks**, **Alerts & Updates**, **Tabs**) and configure the privacy policy from [`PRIVACY.md`](PRIVACY.md) (`data_collection_permissions: { required: ["none"] }`).
6. Submit for review.

## Publishing to Chrome Web Store

1. Run `npm run pack:chrome` to build `dist/vikunja-chrome-<version>.zip`.
2. Open the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
3. Upload `dist/vikunja-chrome-<version>.zip`.
4. Fill **Store Listing** and **Privacy Practices** using [`store/LISTING.md`](store/LISTING.md), `store/icon-cws-128.png`, `store/promo-cws-440x280.png`, `store/screenshots/*.png`, and [`PRIVACY.md`](PRIVACY.md).
5. Submit for review.
