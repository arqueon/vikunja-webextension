// Shared helpers for the extension pages (popup, options, capture). Loaded
// after lib/vikunja.js in page HTML, never in the service worker.
(() => {
  'use strict';

  function openOptions(api) {
    if (api.runtime && api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    } else {
      window.open(api.runtime.getURL('options/options.html'));
    }
  }

  // Native-app feel: suppress the browser context menu except inside editable
  // text fields, where the usual cut/copy/paste menu is still useful.
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('contextmenu', (e) => {
      const target = e.target;
      const tag = target && target.tagName;
      const editable =
        tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable);
      if (!editable) {
        e.preventDefault();
      }
    });
  }

  let toastTimer = null;
  const { t } = globalThis.I18n || { t: (key, englishDefault) => englishDefault };
  function showToast(el, message, { duration = 2000, link, error = false } = {}) {
    el.textContent = '';
    if (error) {
      el.classList.add('toast-error');
    } else {
      el.classList.remove('toast-error');
    }
    if (link && link.href) {
      const idStr = String(link.id);
      const text = t('toastTaskAdded', 'Task $1 added', [idStr]);
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.textContent = idStr;
      const at = text.indexOf(idStr);
      if (at !== -1) {
        el.appendChild(document.createTextNode(text.slice(0, at)));
        el.appendChild(anchor);
        el.appendChild(document.createTextNode(text.slice(at + idStr.length)));
      } else {
        el.appendChild(anchor);
        el.appendChild(document.createTextNode(text));
      }
      duration = 4000;
    } else {
      el.textContent = message;
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, duration);
  }

  // Build project hierarchy with parent paths and indentation
  function projectPath(project, projects) {
    if (!project) return 'Unknown project';
    const byId = new Map(projects.map((p) => [String(p.id), p]));
    const seen = new Set();
    const parts = [];
    let current = project;
    while (current) {
      const cid = String(current.id);
      if (seen.has(cid)) {
        parts.unshift('…');
        break;
      }
      seen.add(cid);
      parts.unshift(String(current.title || 'Untitled'));
      const pid = current.parent_project_id ? String(current.parent_project_id) : '0';
      current = pid !== '0' && byId.has(pid) ? byId.get(pid) : null;
    }
    return parts.join(' › ');
  }

  function projectDepth(project, projects) {
    if (!project) return 0;
    const byId = new Map(projects.map((p) => [String(p.id), p]));
    const seen = new Set();
    let depth = 0;
    let pid = project.parent_project_id ? String(project.parent_project_id) : '0';
    while (pid !== '0' && byId.has(pid) && !seen.has(pid)) {
      seen.add(pid);
      depth++;
      pid = byId.get(pid).parent_project_id ? String(byId.get(pid).parent_project_id) : '0';
    }
    return depth;
  }

  function projectOptions(projects) {
    return (projects || [])
      .filter((p) => p && Number(p.id) > 0 && !p.is_archived)
      .map((p) => ({
        id: Number(p.id),
        title: String(p.title || 'Untitled'),
        path: projectPath(p, projects),
        depth: projectDepth(p, projects),
      }));
  }

  // Fill a <select> with project options and restore a selection. Returns the
  // effective value: the requested one when it exists, otherwise the first
  // real project (when fallbackToFirst), otherwise the placeholder.
  function fillProjectSelect(
    select,
    projects,
    { selectedId = null, placeholder = 'Select a project', placeholderDisabled = true, fallbackToFirst = true } = {},
  ) {
    select.textContent = '';
    const addOption = (value, label, disabled = false) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.disabled = disabled;
      select.appendChild(option);
    };
    addOption('', placeholder, placeholderDisabled);
    const opts = projectOptions(projects);
    for (const p of opts) {
      const indent = p.depth > 0 ? '\u00A0\u00A0'.repeat(p.depth) + '└ ' : '';
      addOption(String(p.id), indent + p.title + (p.depth > 0 ? ` (${p.path})` : ''));
    }
    const options = [...select.options];
    let value =
      selectedId && options.some((o) => o.value === String(selectedId))
        ? String(selectedId)
        : '';
    if (!value && fallbackToFirst) {
      const first = options.find((o) => o.value !== '');
      if (first) value = first.value;
    }
    select.value = value;
    return value;
  }

  const PRIORITY_LABELS = [
    'No priority',
    'Low (1)',
    'Medium (2)',
    'High (3)',
    'Urgent (4)',
    'Do now (5)',
  ];

  function priorityLabel(val) {
    const p = Math.max(0, Math.min(5, Number(val) || 0));
    return PRIORITY_LABELS[p] || PRIORITY_LABELS[0];
  }

  function duePresetDate(kind, base = new Date()) {
    const d = new Date(base);
    d.setSeconds(0, 0);
    if (kind === 'today') {
      d.setHours(23, 59, 0, 0);
    } else if (kind === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 0, 0);
    } else if (kind === 'weekend') {
      d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
      d.setHours(23, 59, 0, 0);
    } else if (kind === 'nextweek') {
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
      d.setHours(23, 59, 0, 0);
    }
    return d;
  }

  function formatDateTimeLocal(d) {
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  globalThis.UiLib = {
    openOptions,
    showToast,
    projectPath,
    projectDepth,
    projectOptions,
    fillProjectSelect,
    PRIORITY_LABELS,
    priorityLabel,
    duePresetDate,
    formatDateTimeLocal,
  };
})();
