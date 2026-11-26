// Kanban triage panel. Three modes:
//   - "gtd": saved filters (GTD · …, ANYTYPE · Pendientes…) loaded with their
//     real Vikunja kanban view (buckets/tasks + PUT .../buckets/{bucket}/tasks).
//   - "projects": nested projects in pre-order hierarchy loaded with their own
//     real kanban view (To-Do / Doing / Done…).
//   - "triage": cross-project columns (Inbox + projects with tasks); dropping
//     a card PATCHes project_id.
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
    listKanbanBuckets,
    moveTaskToBucket,
    listTasks,
    completeTask,
    updateTask,
  } = window.VikunjaLib;
  const { t } = window.I18n;
  const uiShowToast = window.UiLib ? window.UiLib.showToast : () => {};
  const uiProjectOptions = window.UiLib ? window.UiLib.projectOptions : null;

  const targetControl = document.getElementById('target-control');
  const targetLabel = document.getElementById('target-label');
  const projectSelect = document.getElementById('project-select');
  const viewSelect = document.getElementById('view-select');
  const viewControl = document.getElementById('view-control');
  const modeGtdBtn = document.getElementById('mode-gtd');
  const modeProjectsBtn = document.getElementById('mode-projects');
  const modeTriageBtn = document.getElementById('mode-triage');
  const pendingToggle = document.getElementById('pending-toggle');
  const refreshBtn = document.getElementById('refresh');
  const boardEl = document.getElementById('board');
  const noticeEl = document.getElementById('board-notice');
  const errorEl = document.getElementById('board-error');
  const toastEl = document.getElementById('toast');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STATE_KEY = 'kanbanState';

  let baseUrl = '';
  let projects = [];
  let mode = 'projects'; // 'gtd' | 'projects' | 'triage'
  let currentGtdId = null;
  let currentProjectId = null;
  let kanbanViews = [];
  let currentViewId = null;
  let currentView = null;
  let bucketColumns = [];
  let triageTasks = [];
  let pendingOnly = false;
  let loadSeq = 0;
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

  function nestedProjects() {
    if (uiProjectOptions) {
      return uiProjectOptions(projects);
    }
    return realProjects().map((p) => ({
      id: Number(p.id),
      title: String(p.title || 'Untitled'),
      path: String(p.title || 'Untitled'),
      depth: 0,
      parentId: Number(p.parent_project_id) || 0,
      hasChildren: false,
    }));
  }

  function savedFilters() {
    const all = projects.filter((p) => p && Number(p.id) < -1);
    const favs = all.filter((p) => p.is_favorite);
    const list = favs.length ? favs : all;
    return list.slice().sort((a, b) => {
      const ag = String(a.title || '').startsWith('GTD') ? 0 : 1;
      const bg = String(b.title || '').startsWith('GTD') ? 0 : 1;
      return ag - bg;
    });
  }

  function inboxProjectId() {
    const inbox = realProjects().find(
      (p) => (p.title || '').trim().toLowerCase() === 'inbox',
    );
    return inbox ? Number(inbox.id) : null;
  }

  function initialGtdId() {
    const first = savedFilters()[0];
    return first ? Number(first.id) : null;
  }

  function initialProjectId(prefs) {
    const inbox = inboxProjectId();
    if (inbox) return inbox;
    if (prefs && prefs.defaultProjectId) {
      const def = Number(prefs.defaultProjectId);
      if (realProjects().some((p) => Number(p.id) === def)) return def;
    }
    const first = nestedProjects()[0];
    return first ? Number(first.id) : null;
  }

  function isKanbanView(v) {
    const kind = String((v && (v.view_kind || v.view_mode || v.type)) || '').toLowerCase();
    return kind === 'kanban';
  }

  function isFilterModeView() {
    return String((currentView && currentView.bucket_configuration_mode) || '').toLowerCase() === 'filter';
  }

  function persistState() {
    api.storage.local
      .set({
        [STATE_KEY]: {
          mode,
          gtdId: currentGtdId,
          projectId: currentProjectId,
        },
      })
      .catch(() => {});
  }

  function setMode(nextMode, { silent = false } = {}) {
    if (nextMode === 'gtd' || nextMode === 'triage') {
      mode = nextMode;
    } else {
      mode = 'projects';
    }
    modeGtdBtn.classList.toggle('active', mode === 'gtd');
    modeProjectsBtn.classList.toggle('active', mode === 'projects');
    modeTriageBtn.classList.toggle('active', mode === 'triage');
    modeGtdBtn.setAttribute('aria-pressed', String(mode === 'gtd'));
    modeProjectsBtn.setAttribute('aria-pressed', String(mode === 'projects'));
    modeTriageBtn.setAttribute('aria-pressed', String(mode === 'triage'));
    if (!silent) {
      persistState();
    }
  }

  function fillTargetSelect() {
    if (mode === 'triage') {
      targetControl.hidden = true;
      viewControl.hidden = true;
      return;
    }
    targetControl.hidden = false;
    projectSelect.textContent = '';

    if (mode === 'gtd') {
      targetLabel.textContent = t('fieldBoard', 'Board');
      const filters = savedFilters();
      for (const f of filters) {
        const option = document.createElement('option');
        option.value = String(f.id);
        option.textContent = f.title || 'Filter';
        projectSelect.appendChild(option);
      }
      if (currentGtdId === null || !filters.some((f) => Number(f.id) === Number(currentGtdId))) {
        currentGtdId = filters[0] ? Number(filters[0].id) : null;
      }
      projectSelect.value = currentGtdId !== null ? String(currentGtdId) : '';
      return;
    }

    targetLabel.textContent = t('fieldProject', 'Project');
    const opts = nestedProjects();
    for (const p of opts) {
      const option = document.createElement('option');
      option.value = String(p.id);
      const indent = p.depth > 0 ? '\u00A0\u00A0'.repeat(p.depth) + '└ ' : '';
      option.textContent = indent + p.title;
      projectSelect.appendChild(option);
    }
    if (currentProjectId === null || !opts.some((p) => Number(p.id) === Number(currentProjectId))) {
      currentProjectId = opts[0] ? Number(opts[0].id) : null;
    }
    projectSelect.value = currentProjectId !== null ? String(currentProjectId) : '';
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
    viewSelect.value = currentViewId !== null ? String(currentViewId) : '';
  }

  // --- Task helpers ---

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

  function projectTitleForTask(task) {
    const proj = projects.find((p) => Number(p.id) === Number(task.project_id));
    return proj && proj.title ? String(proj.title) : '';
  }

  function cardIdentifierText(task) {
    const raw = task && task.identifier ? String(task.identifier).trim() : '';
    if (raw && !raw.startsWith('#')) {
      return raw;
    }
    if (mode === 'gtd') {
      return projectTitleForTask(task) || raw;
    }
    return '';
  }

  // --- Board model ---

  function columnsForViews() {
    const readOnly = isFilterModeView();
    return bucketColumns.map((b) => {
      const list = Array.isArray(b.tasks) ? b.tasks : [];
      return {
        key: `b-${b.id}`,
        id: b.id,
        kind: 'bucket',
        title: b.title || t('kanbanColumnFallback', 'Column'),
        hexColor: b.hex_color,
        readOnly,
        tasks: pendingOnly ? list.filter((tk) => !tk.done) : list,
      };
    });
  }

  function columnsForProjects() {
    const visible = pendingOnly ? triageTasks.filter((tk) => !tk.done) : triageTasks;
    const byProject = new Map();
    for (const task of visible) {
      const key = Number(task.project_id);
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key).push(task);
    }
    const inboxId = inboxProjectId();
    const ordered = nestedProjects()
      .filter((p) => Number(p.id) === Number(inboxId) || byProject.has(Number(p.id)))
      .slice()
      .sort((a, b) => {
        const ai = Number(a.id) === Number(inboxId) ? 0 : 1;
        const bi = Number(b.id) === Number(inboxId) ? 0 : 1;
        return ai - bi;
      });

    const leaves = ordered.map((p) => String(p.title || '').trim().toLowerCase());
    return ordered.map((p) => {
      const leaf = String(p.title || 'Untitled');
      const duplicated = leaves.filter((l) => l === leaf.trim().toLowerCase()).length > 1;
      let title = leaf;
      if (duplicated && p.depth > 0) {
        const parts = String(p.path).split('›');
        const parent = parts.length > 1 ? parts[parts.length - 2].trim() : '';
        if (parent) title = `${leaf} (${parent})`;
      }
      return {
        key: `p-${p.id}`,
        id: p.id,
        kind: 'project',
        title,
        path: p.path || leaf,
        hexColor: '',
        readOnly: false,
        tasks: byProject.get(Number(p.id)) || [],
      };
    });
  }

  function columnList() {
    return mode === 'triage' ? columnsForProjects() : columnsForViews();
  }

  // --- Rendering ---

  function emptyMessage() {
    if (mode === 'triage') {
      return t('kanbanNoProjects', 'No projects found — create one in Vikunja first.');
    }
    if (mode === 'gtd' && currentGtdId === null) {
      return t('kanbanNoSavedViews', 'No saved filters found — create or favorite a filter in Vikunja.');
    }
    if (mode === 'projects' && currentProjectId === null) {
      return t('kanbanNoProjects', 'No projects found — create one in Vikunja first.');
    }
    if (kanbanViews.length === 0) {
      return t('kanbanNoKanbanView', 'This board has no kanban view configured in Vikunja.');
    }
    return t('kanbanNoBuckets', 'This kanban view has no columns yet.');
  }

  function renderBoard() {
    boardEl.textContent = '';
    const columns = columnList();
    if (columns.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = emptyMessage();
      boardEl.appendChild(empty);
      return;
    }
    columns.forEach((col, index) => {
      boardEl.appendChild(renderColumn(col, index, columns.length));
    });
  }

  function findTaskById(id) {
    if (id === null || id === undefined) return null;
    if (mode === 'triage') {
      return triageTasks.find((tk) => Number(tk.id) === Number(id)) || null;
    }
    for (const b of bucketColumns) {
      const match = (b.tasks || []).find((tk) => Number(tk.id) === Number(id));
      if (match) return match;
    }
    return null;
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
    title.title = col.path || col.title;
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
      col.tasks.forEach((task) => body.appendChild(renderCard(task, col, index, total)));
    }
    el.appendChild(body);

    if (!col.readOnly) {
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
        const task = findTaskById(id);
        if (!task) return;
        dropTaskOnColumn(task, col);
      });
    }
    return el;
  }

  function renderCard(task, col, colIndex, total) {
    const card = document.createElement('article');
    card.className = 'kcard' + (task.done ? ' done' : '') + (col.readOnly ? ' readonly' : '');
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-col-index', colIndex);
    card.draggable = !col.readOnly;

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
    const ident = cardIdentifierText(task);
    if (ident) {
      const identEl = document.createElement('span');
      identEl.className = 'kcard-ident';
      identEl.textContent = ident;
      meta.appendChild(identEl);
    }
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

    if (!col.readOnly) {
      const moveWrap = document.createElement('div');
      moveWrap.className = 'kcard-move';
      if (colIndex > 0) {
        moveWrap.appendChild(moveButton(task, colIndex, -1));
      }
      if (colIndex < total - 1) {
        moveWrap.appendChild(moveButton(task, colIndex, 1));
      }
      card.appendChild(moveWrap);

      card.addEventListener('dragstart', () => {
        draggingTaskId = task.id;
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    }
    return card;
  }

  function moveButton(task, colIndex, direction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = direction < 0 ? '←' : '→';
    btn.title =
      direction < 0
        ? t('kanbanMovePrev', 'Move to the previous column')
        : t('kanbanMoveNext', 'Move to the next column');
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', () => nudgeTask(task, colIndex, direction));
    return btn;
  }

  // --- Actions ---

  function moveTaskBetweenLocalBuckets(task, targetBucketId) {
    let sourceBucket = null;
    let sourceIndex = -1;
    for (const b of bucketColumns) {
      const idx = (b.tasks || []).findIndex((tk) => Number(tk.id) === Number(task.id));
      if (idx !== -1) {
        sourceBucket = b;
        sourceIndex = idx;
        break;
      }
    }
    const targetBucket = bucketColumns.find((b) => Number(b.id) === Number(targetBucketId));
    if (!targetBucket) return null;
    if (sourceBucket && Number(sourceBucket.id) === Number(targetBucket.id)) return null;

    if (sourceBucket && sourceIndex !== -1) {
      sourceBucket.tasks.splice(sourceIndex, 1);
    }
    if (!Array.isArray(targetBucket.tasks)) {
      targetBucket.tasks = [];
    }
    targetBucket.tasks.push(task);

    return {
      sourceBucket,
      sourceIndex,
      targetBucket,
    };
  }

  function rollbackLocalBucketMove(task, moveInfo, prevBucketId, prevDone) {
    if (!moveInfo) return;
    const { sourceBucket, sourceIndex, targetBucket } = moveInfo;
    const targetIdx = (targetBucket.tasks || []).findIndex((tk) => Number(tk.id) === Number(task.id));
    if (targetIdx !== -1) {
      targetBucket.tasks.splice(targetIdx, 1);
    }
    if (sourceBucket) {
      if (!Array.isArray(sourceBucket.tasks)) sourceBucket.tasks = [];
      const insertAt = Math.min(Math.max(0, sourceIndex), sourceBucket.tasks.length);
      sourceBucket.tasks.splice(insertAt, 0, task);
    }
    task.bucket_id = prevBucketId;
    task.done = prevDone;
  }

  async function moveCardToBucket(task, targetBucketId) {
    const targetId = mode === 'gtd' ? currentGtdId : currentProjectId;
    if (targetId === null || currentViewId === null) return;
    if (Number(task.bucket_id) === Number(targetBucketId)) return;

    const prevBucketId = task.bucket_id;
    const prevDone = Boolean(task.done);
    const moveInfo = moveTaskBetweenLocalBuckets(task, targetBucketId);
    if (!moveInfo) return;

    task.bucket_id = targetBucketId;
    const doneBucketId = currentView && Number(currentView.done_bucket_id);
    if (doneBucketId) {
      if (Number(targetBucketId) === doneBucketId) {
        task.done = true;
      } else if (moveInfo.sourceBucket && Number(moveInfo.sourceBucket.id) === doneBucketId) {
        task.done = false;
      }
    }
    renderBoard();

    try {
      const res = await moveTaskToBucket(targetId, currentViewId, targetBucketId, task.id);
      if (res && res.task && typeof res.task.done === 'boolean') {
        task.done = res.task.done;
        renderBoard();
      }
    } catch (err) {
      rollbackLocalBucketMove(task, moveInfo, prevBucketId, prevDone);
      renderBoard();
      uiShowToast(toastEl, t('kanbanMoveFailed', 'Could not move the task: $1', [err.message]), { error: true });
    }
  }

  async function moveCardToProject(task, targetProjectId) {
    const nextProjectId = Number(targetProjectId);
    if (Number(task.project_id) === nextProjectId) return;
    const prevProjectId = task.project_id;
    task.project_id = nextProjectId;
    renderBoard();
    try {
      await updateTask(task.id, { project_id: nextProjectId });
    } catch (err) {
      task.project_id = prevProjectId;
      renderBoard();
      uiShowToast(toastEl, t('kanbanMoveFailed', 'Could not move the task: $1', [err.message]), { error: true });
    }
  }

  function dropTaskOnColumn(task, col) {
    if (!col || col.readOnly) return;
    if (col.kind === 'bucket') {
      if (col.id === null || col.id === undefined) return;
      moveCardToBucket(task, col.id);
    } else {
      moveCardToProject(task, col.id);
    }
  }

  function nudgeTask(task, colIndex, direction) {
    const columns = columnList();
    const target = columns[colIndex + direction];
    if (!target) return;
    dropTaskOnColumn(task, target);
  }

  async function toggleDone(task, input) {
    input.disabled = true;
    const next = input.checked;
    try {
      await completeTask(task.id, next);
      task.done = next;
      if (mode !== 'triage' && !isFilterModeView() && currentView) {
        const doneBucketId = Number(currentView.done_bucket_id) || 0;
        const defaultBucketId = Number(currentView.default_bucket_id) || 0;
        if (doneBucketId && next === true) {
          if (moveTaskBetweenLocalBuckets(task, doneBucketId)) {
            task.bucket_id = doneBucketId;
          }
        } else if (doneBucketId && next === false && Number(task.bucket_id) === doneBucketId && defaultBucketId) {
          if (moveTaskBetweenLocalBuckets(task, defaultBucketId)) {
            task.bucket_id = defaultBucketId;
          }
        }
      }
      renderBoard();
    } catch (err) {
      input.checked = !next;
      uiShowToast(toastEl, t('couldNotUpdateTask', 'Could not update task: $1', [err.message]), { error: true });
    } finally {
      input.disabled = false;
    }
  }

  // --- Data loading ---

  async function fetchViewBuckets(targetId, viewId) {
    if (typeof listKanbanBuckets === 'function') {
      return listKanbanBuckets(targetId, viewId);
    }
    const [bkts, tks] = await Promise.all([
      listBuckets(targetId, viewId),
      listTasks({ projectId: targetId, viewId }),
    ]);
    return bkts.map((b) => ({
      ...b,
      tasks: tks.filter((tk) => Number(tk.bucket_id) === Number(b.id)),
    }));
  }

  async function loadBoard() {
    const seq = ++loadSeq;
    setError('');
    fillTargetSelect();
    try {
      if (mode === 'triage') {
        viewControl.hidden = true;
        setNotice('');
        const fetched = await listTasks({});
        if (seq !== loadSeq) return;
        triageTasks = Array.isArray(fetched) ? fetched : [];
        bucketColumns = [];
        renderBoard();
        return;
      }

      const targetId = mode === 'gtd' ? currentGtdId : currentProjectId;
      if (targetId === null) {
        bucketColumns = [];
        kanbanViews = [];
        currentViewId = null;
        currentView = null;
        viewControl.hidden = true;
        setNotice('');
        renderBoard();
        return;
      }

      const views = await listProjectViews(targetId).catch(() => []);
      if (seq !== loadSeq) return;
      kanbanViews = (Array.isArray(views) ? views : []).filter(isKanbanView);
      if (kanbanViews.length === 0) {
        bucketColumns = [];
        currentViewId = null;
        currentView = null;
        viewControl.hidden = true;
        setNotice(t('kanbanNoKanbanView', 'This board has no kanban view configured in Vikunja.'));
        renderBoard();
        return;
      }

      currentView =
        kanbanViews.find((v) => Number(v.id) === Number(currentViewId)) ||
        kanbanViews[0];
      currentViewId = Number(currentView.id);
      fillViewSelect();

      const loadedBuckets = await fetchViewBuckets(targetId, currentViewId);
      if (seq !== loadSeq) return;
      bucketColumns = Array.isArray(loadedBuckets) ? loadedBuckets : [];

      if (isFilterModeView()) {
        setNotice(t('kanbanFilterBucketsNotice', 'Filter-based kanban view — columns are automatic and read-only.'));
      } else if (mode === 'projects') {
        const selected = nestedProjects().find((p) => Number(p.id) === Number(targetId));
        const totalTasks = bucketColumns.reduce((sum, b) => sum + ((b.tasks && b.tasks.length) || 0), 0);
        if (selected && selected.hasChildren && totalTasks === 0) {
          setNotice(t('kanbanContainerEmptyNotice', 'This parent project has no direct tasks — check its subprojects or the GTD views tab.'));
        } else {
          setNotice('');
        }
      } else {
        setNotice('');
      }
      renderBoard();
    } catch (err) {
      if (seq !== loadSeq) return;
      setError(t('kanbanLoadFailed', 'Could not load the board: $1', [err.message]));
      boardEl.textContent = '';
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

      let saved = null;
      try {
        const stored = await api.storage.local.get({ [STATE_KEY]: null });
        saved = stored && stored[STATE_KEY] ? stored[STATE_KEY] : null;
      } catch (e) {
        saved = null;
      }

      const filters = savedFilters();
      const reals = realProjects();
      currentGtdId =
        saved && saved.gtdId !== null && saved.gtdId !== undefined && filters.some((f) => Number(f.id) === Number(saved.gtdId))
          ? Number(saved.gtdId)
          : initialGtdId();
      currentProjectId =
        saved && saved.projectId !== null && saved.projectId !== undefined && reals.some((p) => Number(p.id) === Number(saved.projectId))
          ? Number(saved.projectId)
          : initialProjectId(prefs);

      setMode(saved && saved.mode ? saved.mode : 'projects', { silent: true });
      await loadBoard();
    } catch (err) {
      setError(t('kanbanLoadFailed', 'Could not load the board: $1', [err.message]));
    }
  }

  // --- Wiring ---

  projectSelect.addEventListener('change', (e) => {
    const value = e.target && e.target.value !== undefined ? e.target.value : projectSelect.value;
    const id = Number(value) || null;
    if (mode === 'gtd') {
      currentGtdId = id;
    } else if (mode === 'projects') {
      currentProjectId = id;
    }
    currentViewId = null;
    currentView = null;
    persistState();
    loadBoard();
  });

  viewSelect.addEventListener('change', (e) => {
    const value = e.target && e.target.value !== undefined ? e.target.value : viewSelect.value;
    currentViewId = Number(value) || null;
    loadBoard();
  });

  modeGtdBtn.addEventListener('click', () => {
    if (mode === 'gtd') return;
    setMode('gtd');
    currentViewId = null;
    currentView = null;
    loadBoard();
  });

  modeProjectsBtn.addEventListener('click', () => {
    if (mode === 'projects') return;
    setMode('projects');
    currentViewId = null;
    currentView = null;
    loadBoard();
  });

  modeTriageBtn.addEventListener('click', () => {
    if (mode === 'triage') return;
    setMode('triage');
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
