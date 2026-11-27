# Store Listing Copy (Firefox AMO & Chrome Web Store)

> Important: Firefox AMO does **not** render Markdown — paste the HTML-only blocks below (plain text + `<strong>`, `<ul>`, `<li>`, `<code>`, `<a href="...">`).

---

## Firefox Add-ons (AMO)

- **Upload file:** `dist/vikunja-companion-1.2.1.zip`
- **Store icon (`Edit Listing → Images`):** `store/icon-amo-256.png`
- **Screenshots (`Edit Listing → Images`):** `store/screenshots/01-popup-dark-1280x800.png`, `02-kanban-board-1280x800.png`, `03-popup-light-capture-1280x800.png`
- **Categories:** Bookmarks, Alerts & Updates, Tabs
- **Tags:** `vikunja`, `tasks`, `kanban`, `todo`, `productivity`, `self-hosted`
- **Homepage URL:** `https://github.com/arqueon/vikunja-webextension`
- **Support URL:** `https://github.com/arqueon/vikunja-webextension/issues`

### AMO Description (`en-US`)

```html
Manage your Vikunja tasks directly from your browser toolbar with quick URL capture, a floating Kanban triage board, hierarchical project filtering, inline editing, and native light/dark themes.

Vikunja Companion is an independent, open-source extension for the <a href="https://vikunja.io">Vikunja</a> task manager.

<strong>Features</strong>
<ul>
  <li><strong>Floating Kanban triage board:</strong> Open a Kanban panel from the popup with three modes — <strong>Views</strong> (saved filters with their configured Kanban columns), <strong>Projects</strong> (nested project tree with each project's own Kanban view), and <strong>Move to project</strong> (cross-project columns). Supports drag &amp; drop, keyboard ←/→ moves, completion checkboxes, and a pending-only toggle.</li>
  <li><strong>Nested project &amp; subproject filter:</strong> Filter the popup task list by any project or subproject alongside your starred saved filters. Selecting a parent project automatically includes its subprojects.</li>
  <li><strong>1-click URL capture:</strong> Save the active tab, link, or selected text via the toolbar button, context menu, or <code>Alt+Shift+V</code>, with configurable capture defaults for project and automatic labels.</li>
  <li><strong>Inline task editor:</strong> Expand any task to edit title, description (with safe HTML preview), project, priority, due date, and labels, plus a 3-second countdown delete confirmation.</li>
  <li><strong>Quick Add Magic:</strong> Full support for Vikunja and Todoist syntax (<code>+Project</code>, <code>*label</code>, <code>!priority</code>, <code>@assignee</code>, natural dates, and repeats) with interactive chips.</li>
  <li><strong>Persistent drafts &amp; native themes:</strong> Unsaved text survives popup closes; supports light, dark, and automatic system themes.</li>
  <li><strong>Optional Matrix Element integration:</strong> Add tasks directly from Element web messages on user-configured instances.</li>
</ul>

<strong>Privacy &amp; Independence</strong>
<ul>
  <li>Open source under AGPL-3.0 (<a href="https://github.com/arqueon/vikunja-webextension">source code on GitHub</a>).</li>
  <li>Zero telemetry, tracking, or third-party analytics.</li>
  <li>Connects directly and exclusively to the Vikunja instance you configure.</li>
  <li>Independent project, not affiliated with the official Vikunja project.</li>
</ul>
```

### AMO Descripción (`es-ES`)

```html
Gestiona tus tareas de Vikunja desde la barra del navegador con captura de URL en un clic, tablero Kanban flotante, filtro jerárquico de proyectos y subproyectos, editor inline y temas claro/oscuro.

Vikunja Companion es una extensión libre e independiente para el gestor de tareas <a href="https://vikunja.io">Vikunja</a>.

<strong>Funciones</strong>
<ul>
  <li><strong>Tablero Kanban flotante:</strong> Tres modos — <strong>Vistas</strong> (filtros guardados con sus columnas Kanban reales), <strong>Proyectos</strong> (árbol anidado con la vista Kanban de cada proyecto) y <strong>Mover a proyecto</strong>. Incluye arrastrar y soltar, botones ←/→, casilla de completado y filtro de solo pendientes.</li>
  <li><strong>Filtro de proyectos y subproyectos:</strong> Selecciona cualquier proyecto o subproyecto en la barra superior del popup; elegir un proyecto padre incluye automáticamente sus subproyectos.</li>
  <li><strong>Captura de URL en un clic:</strong> Guarda la pestaña activa, un enlace o texto seleccionado desde el popup, el menú contextual o <code>Alt+Shift+V</code>, con proyecto y etiquetas por defecto.</li>
  <li><strong>Editor inline y Quick Add Magic:</strong> Edita tareas con vista previa HTML segura, borrado protegido de 3 segundos, sintaxis mágica de Vikunja/Todoist, borradores persistentes y temas claro/oscuro/automático.</li>
</ul>

<strong>Privacidad</strong>
<ul>
  <li>Código abierto bajo AGPL-3.0 (<a href="https://github.com/arqueon/vikunja-webextension">GitHub</a>), sin telemetría ni rastreo; solo se comunica con tu propia instancia de Vikunja.</li>
</ul>
```

### AMO Release Notes (`1.2.1`)

```html
<strong>New in 1.2.1</strong>
<ul>
  <li><strong>Zero linter warnings:</strong> Replaced innerHTML in localized options strings with a safe DOM node sanitizer.</li>
  <li><strong>Complete API token scope docs:</strong> Options now document the scopes required for Kanban boards, manual sort, and task deletion.</li>
  <li><strong>HiDPI icon &amp; cleaner packaging:</strong> Added 96×96 extension icon and excluded development metadata from release archives.</li>
</ul>
```

### AMO Privacy Policy (`en-US`)

```html
Vikunja Companion does not collect, store, transmit, or sell any personal data or telemetry.

<ul>
  <li>Your Vikunja server URL, API token, preferences, and temporary unsaved drafts are stored locally in your browser's extension storage (<code>browser.storage</code>).</li>
  <li>Network requests are made exclusively to the Vikunja instance (and optional Matrix Element instance) that you explicitly configure and grant permission for.</li>
  <li>No analytics, crash reporting, ads, or third-party services are used.</li>
</ul>
```

### AMO Notes to Reviewer (`1.2.1`)

```text
No build step, bundler, or minification is used: all HTML, CSS, and ES2022 JavaScript files in the uploaded archive match https://github.com/arqueon/vikunja-webextension (tag v1.2.1).

Changes since 1.2.0:
- Replaced the innerHTML assignment in lib/i18n.js with DOMParser + explicit node/tag allowlist (`strong`, `code`, `em`, `b`, and `https?://` links) so `web-ext lint` passes with 0 errors and 0 warnings.
- Added 96x96 PNG icon in manifest.json and documented Kanban/delete token scopes in options/options.html.
- Excluded repo-only metadata (.revision, .github, store/, PRIVACY.md) from staging in scripts/_stage.sh.

No permission changes. No telemetry, analytics, or remote code execution.
```

---

## Chrome Web Store

- **Upload package:** `dist/vikunja-chrome-1.2.1.zip`
- **Store icon (`128×128`):** `store/icon-cws-128.png`
- **Small promo tile (`440×280`):** `store/promo-cws-440x280.png`
- **Screenshots (`1280×800`, 24-bit PNG, no alpha):** `store/screenshots/01-popup-dark-1280x800.png`, `02-kanban-board-1280x800.png`, `03-popup-light-capture-1280x800.png`
- **Category:** Productivity
- **Privacy Policy URL:** `https://github.com/arqueon/vikunja-webextension/blob/master/PRIVACY.md`
- **Homepage / Support URL:** `https://github.com/arqueon/vikunja-webextension` / `https://github.com/arqueon/vikunja-webextension/issues`

### Chrome Web Store Description (Plain text)

```text
Manage your Vikunja tasks directly from your browser toolbar with quick URL capture, a floating Kanban triage board, hierarchical project filtering, inline editing, and light/dark themes.

Vikunja Companion is an independent, open-source extension for the Vikunja task manager (https://vikunja.io).

KEY FEATURES
• Floating Kanban Triage Board: Open a ~900px Kanban board with three modes — Views (starred saved filters with their Vikunja columns), Projects (nested project tree with each project's Kanban view), and Move to project (cross-project columns). Drag & drop cards, use keyboard ←/→ moves, complete tasks, and toggle pending-only.
• Nested Project & Subproject Filter: Filter the popup task list by any project or subproject alongside your starred saved filters. Selecting a parent project automatically includes all of its non-archived subprojects.
• 1-Click URL Capture: Save the active tab, link, or selected text via the toolbar popup, right-click menu, or Alt+Shift+V, with configurable capture defaults for project and labels.
• Inline Task Editor: Expand any task to edit title, description (safe HTML preview), project, priority, due date, and labels, with a 3-second countdown delete confirmation.
• Quick Add Magic: Full support for Vikunja and Todoist magic syntax (+Project, *label, !priority, @assignee, dates, repeats) with interactive chips.
• Persistent Drafts & Themes: Unsaved text survives popup closes; supports light, dark, and automatic system themes.
• Optional Matrix Element Integration: Add tasks directly from Element web messages on user-configured instances.

PRIVACY & INDEPENDENCE
• Open source under AGPL-3.0: https://github.com/arqueon/vikunja-webextension
• Zero tracking, telemetry, or third-party analytics.
• Direct connections only between your browser and the Vikunja instance you configure.
• Independent project, not affiliated with the official Vikunja project.
```

### Chrome Web Store Privacy Practices

- **Single purpose description:**
  `Manage tasks, triage Kanban boards, and capture web pages into a user-configured Vikunja instance from the browser toolbar.`
- **Permission justifications:**
  - `storage`: `Stores the user's Vikunja instance URL, API token, display/capture preferences, and temporary unsaved task drafts locally in browser storage.`
  - `activeTab`: `Reads the current tab's URL and title only when the user explicitly triggers page capture via the toolbar button, context menu, or Alt+Shift+V shortcut.`
  - `contextMenus`: `Adds an "Add to Vikunja…" context menu entry so users can save a page, link, or text selection as a task.`
  - `scripting`: `Registers an optional content script only on user-configured Matrix Element web origins (added explicitly in Options) to place an "Add to Vikunja" button on messages.`
  - `optional_host_permissions` (`http://*/*`, `https://*/*`): `Vikunja and Matrix Element are self-hosted applications running on arbitrary user-owned domains. Host access is optional and requested at runtime strictly for the specific origin the user configures in Options.`
- **Remote code:** `No, I am not using remote code`
- **Data usage:** No user data collected, sold, or shared.
