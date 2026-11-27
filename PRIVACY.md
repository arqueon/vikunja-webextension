# Privacy Policy — Vikunja Companion

**Effective date:** 2026-11-26

Vikunja Companion is an independent, open-source browser extension for [Vikunja](https://vikunja.io). It is designed to operate strictly between your browser and the Vikunja (and optional Matrix Element) server you configure.

## Data Collection & Storage

- **No telemetry or analytics:** Vikunja Companion does not collect, log, sell, or transmit any usage analytics, crash reports, advertising identifiers, or personal data to the developer or any third party.
- **Local browser storage only:** Your Vikunja instance URL, API token, display/capture preferences, and temporary unsaved task drafts are stored solely in your browser's extension storage (`browser.storage.sync` / `browser.storage.local` / `browser.storage.session`).

## Network Connections & Permissions

- **Direct connections only:** All network requests go exclusively from your browser to the Vikunja instance URL (and optional Matrix Element web origins) that you explicitly configure and approve via browser host permissions.
- **`activeTab` & `contextMenus`:** Page title, URL, or selected text are read only when you explicitly invoke capture (popup capture button, context menu `"Add to Vikunja…"`, or `Alt+Shift+V`).
- **`scripting`:** Used exclusively on Matrix Element web origins that you explicitly add in Options so the extension can place an `"Add to Vikunja"` button on messages and optionally trigger a reaction through your active Element session.

## Source Code & Contact

- Source code (AGPL-3.0): <https://github.com/arqueon/vikunja-webextension>
- Support & issues: <https://github.com/arqueon/vikunja-webextension/issues>
- Contact: `arqueonautis@gmail.com`

---

*Resumen en español:* Vikunja Companion no recopila telemetría ni envía datos a terceros. Tu URL de Vikunja, token de API y preferencias se guardan únicamente en el almacenamiento local de tu navegador, y la extensión solo se conecta con la instancia de Vikunja (y opcionalmente Element) que tú configures.
