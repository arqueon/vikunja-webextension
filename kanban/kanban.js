// Kanban triage panel. Two groupings (gate 2026-11-25):
//   - "views": columns are the buckets of the project's own kanban view
//     (To-Do / Doing / Done…); dropping a card PATCHes bucket_id.
//   - "projects": columns are the destination projects; dropping a card
//     PATCHes project_id. Used as the fallback when the project has no
//     kanban view.
// The panel opens on the Inbox project by default, shows every task (with a
// pending-only toggle), and each card can be completed, dragged, nudged with
// ←/→ and opened in the web app.
(() => {
  'use strict';

  window.I18n.applyPage();

  const {
    api,
    getConfig,
    getPrefs,
    listProjects,
    listProjectViews,
    listBuckets,
    listTasks,
    completeTask,
    updateTask,
  } = window.VikunjaLib;
  const { t } = window.I18n;
  const uiShowToast = window.UiLib ? window.UiLib.showToast : () => {};
  const uiProjectOptions = window.UiLib ? window.UiLib.projectOptions : null;

  const projectSelect = document.getElementById('project-select');
  const viewSelect = document.getElementById('view-select');
  const viewControl = document.getElementById('view-control');
  const groupViewsBtn = document.getElementById('group-views');
  const groupProjectsBtn = document.getElementById('group-projects');
  const pendingToggle = document.getElementById('pending-toggle');
  const refreshBtn = document.getElementById('refresh');
  const boardEl = document.getElementById('board');
  const noticeEl = document.getElementById('board-notice');
  const errorEl = document.getElementById('board-error');
  const toastEl = document.getElementById('toast');

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let baseUrl = '';
  let projects = [];
  let currentProjectId = null;
  let kanbanViews = [];
  let currentViewId = null;
  let buckets = [];
  let tasks = [];
  let groupMode = 'views'; // 'views' | 'projects'
  let pendingOnly = false;
  let busy = false;
  let draggingTaskId = null;

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function setError(message) {
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function setNotice(message) {
    noticeEl.textContent = message || '';
    noticeEl.hidden = !message;
  }

  function realProjects() {
    return projects.filter((p) => p && Number(p.id) > 0 && !p.is_archived);
  }

  // Q3: the board opens on the Inbox project, wherever it lives.
  function initialProjectId(prefs) {
    const inbox = realProjects().find(
      (p) => (p.title || '').trim().toLowerCase() === 'inbox',
    );
    if (inbox) return inbox.id;
    if (prefs && prefs.defaultProjectId) return Number(prefs.defaultProjectId);
    const first = realProjects()[0];
    return first ? first.id : null;
  }

  // Vikunja's view model calls the kind `view_kind` (list/gantt/table/
  // kanban); older payloads and mocks may carry `type`, so match both.
  function isKanbanView(v) {
    const kind = String((v && (v.view_kind || v.view_mode || v.type)) || '').toLowerCase();
    return kind === 'kanban';
  }

  function fillProjectSelect(selectedId) {
    projectSelect.textContent = '';
    const opts = uiProjectOptions ? uiProjectOptions(projects) : null;
    if (opts) {
      // Hierarchy-aware: children indent under their parents like the
      // popup's project selects, and the full path disambiguates equal
      // leaf titles (ANYTYPE › Our Space › Autos).
      for (const p of opts) {
        const option = document.createElement('option');
        option.value = String(p.id);
        const indent = p.depth > 0 ? '\u00A0\u00A0'.repeat(p.depth) + '└ ' : '';
        option.textContent = indent + p.title + (p.depth > 0 ? ` (${p.path})` : '');
        projectSelect.appendChild(option);
      }
    } else {
      for (const p of realProjects()) {
        const option = document.createElement('option');
        option.value = String(p.id);
        option.textContent = p.title || 'Untitled';
        projectSelect.appendChild(option);
      }
    }
    projectSelect.value = String(selectedId);
  }

  function fillViewSelect() {
    viewSelect.textContent = '';
    for (const v of kanbanViews) {
      const opt = document.createElement('option');
      opt.value = String(v.id);
      opt.textContent = v.title || t('kanbanViewFallback', 'Kanban');
      viewSelect.appendChild(opt);
    }
    viewControl.hidden = kanbanViews.length < 2;
    viewSelect.value = String(currentViewId);
  }

  function setGroupMode(mode, { silent = false } = {}) {
    groupMode = mode === 'projects' ? 'projects' : 'views';
    groupViewsBtn.classList.toggle('active', groupMode === 'views');
    groupProjectsBtn.classList.toggle('active', groupMode === 'projects');
    groupViewsBtn.setAttribute('aria-pressed', String(groupMode === 'views'));
    groupProjectsBtn.setAttribute('aria-pressed', String(groupMode === 'projects'));
    if (!silent) {
      api.storage.local
        .set({ kanbanGroupMode: groupMode })
        .catch(() => {});
    }
  }

  // --- Task helpers (shared shape with the popup rows) ---

  function hasDueDate(dateStr) {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    return !isNaN(due.getTime()) && due.getFullYear() >= 1000;
  }

  function formatDue(dateStr) {
    if (!hasDueDate(dateStr)) return '';
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due.getTime());
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay.getTime() === today.getTime()) return t('todayLabel', 'Today');
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function makeCheckbox(task, onChange) {
    const label = document.createElement('label');
    label.className = 'task-check';
    label.title = task.done ? t('markNotDone', 'Mark as not done') : t('markDone', 'Mark as done');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(task.done);
    input.addEventListener('change', () => onChange(input));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute(
      'd',
      'M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z',
    );
    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', '1 9 7 14 15 4');
    svg.appendChild(path);
    svg.appendChild(polyline);
    label.appendChild(input);
    label.appendChild(svg);
    return label;
  }

  // --- Board model ---

  function visibleTasks() {
    return pendingOnly ? tasks.filter((task) => !task.done) : tasks;
  }

  // Views mode: one column per bucket. Tasks carry bucket_id only inside a
  // kanban view, which is exactly how we fetched them.
  function columnsForViews() {
    const byBucket = new Map();
    for (const task of visibleTasks()) {
      const key = task.bucket_id !== undefined ? Number(task.bucket_id) : null;
      if (!byBucket.has(key)) byBucket.set(key, []);
      byBucket.get(key).push(task);
    }
    const columns = buckets.map((b) => ({
      key: `b-${b.id}`,
      id: b.id,
      kind: 'bucket',
      title: b.title || t('kanbanColumnFallback', 'Column'),
      hexColor: b.hex_color,
      tasks: byBucket.get(Number(b.id)) || [],
    }));
    // Tasks that somehow lost their bucket: keep them visible in a trailing
    // column so they are never silently dropped.
    const orphans = byBucket.get(null) || [];
    if (orphans.length) {
      columns.push({
        key: 'b-none',
        id: null,
        kind: 'bucket',
        title: t('kanbanNoBucket', 'No column'),
        hexColor: '',
        tasks: orphans,
      });
    }
    return columns;
  }

  // Projects mode: one column per project (Inbox first, then grouped by
  // their hierarchical path), move = reassign the task's project. The
  // column title carries the full path so equal leaf names (Autos under
  // different parents) stay distinguishable.
  function columnsForProjects() {
    const byProject = new Map();
    for (const task of visibleTasks()) {
      const key = Number(task.project_id);
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key).push(task);
    }
    let ordered;
    if (uiProjectOptions) {
      ordered = uiProjectOptions(projects).slice().sort((a, b) => {
        const ai = a.title.trim().toLowerCase() === 'inbox' ? 0 : 1;
        const bi = b.title.trim().toLowerCase() === 'inbox' ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return String(a.path).localeCompare(String(b.path));
      });
    } else {
      ordered = realProjects().slice().sort((a, b) => {
        const ai = (a.title || '').trim().toLowerCase() === 'inbox' ? 0 : 1;
        const bi = (b.title || '').trim().toLowerCase() === 'inbox' ? 0 : 1;
        return ai - bi;
      });
    }
    return ordered.map((p) => ({
      key: `p-${p.id}`,
      id: p.id,
      kind: 'project',
      title: ordered.length && p.path && p.depth > 0 ? p.path : (p.title || 'Untitled'),
      hexColor: '',
      tasks: byProject.get(Number(p.id)) || [],
    }));
  }

  // --- Rendering ---

  function renderBoard() {
    boardEl.textContent = '';
    const columns = groupMode === 'views' ? columnsForViews() : columnsForProjects();
    if (columns.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent =
        groupMode === 'views'
          ? t('kanbanNoBuckets', 'This kanban view has no columns yet.')
          : t('kanbanNoProjects', 'No projects found — create one in Vikunja first.');
      boardEl.appendChild(empty);
      return;
    }
    columns.forEach((col, index) => {
      boardEl.appendChild(renderColumn(col, index, columns.length));
    });
  }

  function renderColumn(col, index, total) {
    const el = document.createElement('section');
    el.className = 'kcol';
    el.setAttribute('data-col-key', col.key);
    el.setAttribute('data-col-kind', col.kind);

    const head = document.createElement('div');
    head.className = 'kcol-head';
    if (col.hexColor) {
      const dot = document.createElement('span');
      dot.className = 'kcol-dot';
      dot.style.background = `#${col.hexColor}`;
      head.appendChild(dot);
    }
    const title = document.createElement('span');
    title.className = 'kcol-title';
    title.textContent = col.title;
    title.title = col.title;
    head.appendChild(title);
    const count = document.createElement('span');
    count.className = 'kcol-count';
    count.textContent = String(col.tasks.length);
    head.appendChild(count);
    el.appendChild(head);

    const body = document.createElement('div');
    body.className = 'kcol-body';
    if (col.tasks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'kcol-empty';
      empty.textContent = t('kanbanEmpty', 'Nothing here');
      body.appendChild(empty);
    } else {
      col.tasks.forEach((task) => body.appendChild(renderCard(task, index, total)));
    }
    el.appendChild(body);

    // Drop target
    el.addEventListener('dragover', (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      el.classList.remove('drag-over');
      const id = draggingTaskId;
      draggingTaskId = null;
      const task = id === null ? null : tasks.find((tk) => Number(tk.id) === Number(id));
      if (!task) return;
      dropTaskOnColumn(task, col);
    });
    return el;
  }

  function renderCard(task, colIndex, total) {
    const card = document.createElement('article');
    card.className = 'kcard' + (task.done ? ' done' : '');
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-col-index', colIndex);
    card.draggable = true;

    card.appendChild(
      makeCheckbox(task, (input) => toggleDone(task, input)),
    );

    const cardBody = document.createElement('div');
    cardBody.className = 'kcard-body';

    const title = document.createElement('div');
    title.className = 'kcard-title';
    title.textContent = task.title || t('untitledLabel', 'Untitled');
    title.title = task.title || t('untitledLabel', 'Untitled');
    title.addEventListener('click', () => {
      window.open(`${baseUrl}/tasks/${task.id}`, '_blank');
    });
    cardBody.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'kcard-meta';
    const due = formatDue(task.due_date);
    if (due) {
      const dueEl = document.createElement('span');
      dueEl.className = 'task-due';
      if (!task.done && hasDueDate(task.due_date) && new Date(task.due_date).getTime() < Date.now()) {
        dueEl.classList.add('overdue');
      } else if (due === t('todayLabel', 'Today')) {
        dueEl.classList.add('today');
      }
      dueEl.textContent = due;
      meta.appendChild(dueEl);
    }
    if (Number(task.priority) > 0) {
      const prio = document.createElement('span');
      prio.className = 'task-due';
      prio.textContent = `!${Number(task.priority)}`;
      meta.appendChild(prio);
    }
    (Array.isArray(task.labels) ? task.labels : []).forEach((label) => {
      const tag = document.createElement('span');
      tag.className = 'task-tag';
      tag.textContent = label.title || 'tag';
      if (label.hex_color) {
        tag.style.background = `#${label.hex_color}26`;
        tag.style.color = `#${label.hex_color}`;
      }
      meta.appendChild(tag);
    });
    if (meta.childNodes.length) {
      cardBody.appendChild(meta);
    }
    card.appendChild(cardBody);

    // ←/→ nudges (keyboard-precise alternative to dragging)
    const moveWrap = document.createElement('div');
    moveWrap.className = 'kcard-move';
    if (colIndex > 0) {
      moveWrap.appendChild(moveButton(task, -1));
    }
    if (colIndex < total - 1) {
      moveWrap.appendChild(moveButton(task, 1));
    }
    card.appendChild(moveWrap);

    card.addEventListener('dragstart', () => {
      draggingTaskId = task.id;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
    return card;
  }

  function moveButton(task, direction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = direction < 0 ? '←' : '→';
    btn.title =
      direction < 0
        ? t('kanbanMovePrev', 'Move to the previous column')
        : t('kanbanMoveNext', 'Move to the next column');
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', () => nudgeTask(task, direction));
    return btn;
  }

  // --- Actions ---

  function columnList() {
    return groupMode === 'views' ? columnsForViews() : columnsForProjects();
  }

  function findTaskColumnIndex(task) {
    const columns = columnList();
    if (groupMode === 'views') {
      const key = task.bucket_id !== undefined ? Number(task.bucket_id) : null;
      const idx = columns.findIndex((c) => Number(c.id) === key && c.kind === 'bucket');
      return idx === -1 ? 0 : idx;
    }
    const idx = columns.findIndex((c) => Number(c.id) === Number(task.project_id));
    return idx === -1 ? 0 : idx;
  }

  function applyPatch(task, patch) {
    if (patch.bucket_id !== undefined) task.bucket_id = patch.bucket_id;
    if (patch.project_id !== undefined) task.project_id = patch.project_id;
    if (patch.done !== undefined) task.done = patch.done;
  }

  async function moveTask(task, patch) {
    const before = {};
    if (patch.bucket_id !== undefined) before.bucket_id = task.bucket_id;
    if (patch.project_id !== undefined) before.project_id = task.project_id;
    applyPatch(task, patch);
    renderBoard();
    try {
      await updateTask(task.id, patch);
    } catch (err) {
      applyPatch(task, before);
      renderBoard();
      uiShowToast(toastEl, t('kanbanMoveFailed', 'Could not move the task: $1', [err.message]), { error: true });
    }
  }

  function dropTaskOnColumn(task, col) {
    if (col.kind === 'bucket') {
      if (col.id === null) return; // the trailing "no column" is not a target
      if (Number(task.bucket_id) === Number(col.id)) return;
      moveTask(task, { bucket_id: Number(col.id) });
    } else if (Number(task.project_id) !== Number(col.id)) {
      moveTask(task, { project_id: Number(col.id) });
    }
  }

  function nudgeTask(task, direction) {
    const columns = columnList();
    const idx = findTaskColumnIndex(task);
    const target = columns[idx + direction];
    if (!target) return;
    dropTaskOnColumn(task, target);
  }

  async function toggleDone(task, input) {
    input.disabled = true;
    const next = input.checked;
    try {
      await completeTask(task.id, next);
      applyPatch(task, { done: next });
      renderBoard();
    } catch (err) {
      input.checked = !next;
      uiShowToast(toastEl, t('couldNotUpdateTask', 'Could not update task: $1', [err.message]), { error: true });
    } finally {
      input.disabled = false;
    }
  }

  // --- Data loading ---

  async function loadBoard() {
    if (busy) return;
    busy = true;
    setError('');
    try {
      buckets = [];
      kanbanViews = [];
      if (groupMode === 'views') {
        const views = await listProjectViews(currentProjectId).catch(() => []);
        kanbanViews = views.filter(isKanbanView);
        if (kanbanViews.length === 0) {
          // The project has no kanban view: fall back to project columns and
          // say so (the user can still switch modes manually).
          setGroupMode('projects', { silent: true });
          setNotice(t('kanbanNoViewFallback', 'This project has no kanban view — showing projects as columns instead.'));
        } else {
          setNotice('');
          if (currentViewId === null || !kanbanViews.some((v) => Number(v.id) === Number(currentViewId))) {
            currentViewId = Number(kanbanViews[0].id);
          }
          buckets = await listBuckets(currentProjectId, currentViewId);
          fillViewSelect();
        }
      } else {
        setNotice('');
      }

      if (groupMode === 'views') {
        // A kanban view scopes the fetch and fills bucket_id per task. No
        // filter: the board shows every task (pending toggle is local).
        tasks = await listTasks({ projectId: currentProjectId, viewId: currentViewId });
      } else {
        tasks = await listTasks({});
      }
      renderBoard();
    } catch (err) {
      setError(t('kanbanLoadFailed', 'Could not load the board: $1', [err.message]));
      boardEl.textContent = '';
    } finally {
      busy = false;
    }
  }

  async function load() {
    try {
      const [config, prefs] = await Promise.all([getConfig(), getPrefs()]);
      baseUrl = config.baseUrl;
      if (!baseUrl) {
        setError(t('notConfigured', 'Vikunja is not configured yet.'));
        return;
      }
      if (prefs && prefs.theme) applyTheme(prefs.theme);
      projects = await listProjects();
      currentProjectId = initialProjectId(prefs);
      fillProjectSelect(currentProjectId);
      // Restore the last grouping choice; views mode auto-falls back per
      // project, so a stale "views" choice is harmless.
      try {
        const stored = await api.storage.local.get({ kanbanGroupMode: null });
        setGroupMode(stored && stored.kanbanGroupMode ? stored.kanbanGroupMode : 'views', { silent: true });
      } catch (e) {
        setGroupMode('views', { silent: true });
      }
      await loadBoard();
    } catch (err) {
      setError(t('kanbanLoadFailed', 'Could not load the board: $1', [err.message]));
    }
  }

  // --- Wiring ---

  projectSelect.addEventListener('change', (e) => {
    const value = e.target && e.target.value !== undefined ? e.target.value : projectSelect.value;
    currentProjectId = Number(value) || null;
    currentViewId = null;
    loadBoard();
  });

  viewSelect.addEventListener('change', (e) => {
    const value = e.target && e.target.value !== undefined ? e.target.value : viewSelect.value;
    currentViewId = Number(value) || null;
    loadBoard();
  });

  groupViewsBtn.addEventListener('click', () => {
    if (groupMode === 'views') return;
    setGroupMode('views');
    currentViewId = null;
    loadBoard();
  });

  groupProjectsBtn.addEventListener('click', () => {
    if (groupMode === 'projects') return;
    setGroupMode('projects');
    loadBoard();
  });

  pendingToggle.addEventListener('click', () => {
    pendingOnly = !pendingOnly;
    pendingToggle.setAttribute('aria-pressed', String(pendingOnly));
    renderBoard();
  });

  refreshBtn.addEventListener('click', loadBoard);

  load();
})();
