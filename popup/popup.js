(() => {
  'use strict';

  window.I18n.applyPage();

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  if (window.VikunjaLib?.api?.storage?.sync?.get) {
    window.VikunjaLib.api.storage.sync.get({ theme: 'auto' }).then((st) => {
      if (st && st.theme) applyTheme(st.theme);
    }).catch(() => {});
  }

  const {
    api,
    getConfig,
    getPrefs,
    listProjects,
    listTasks,
    listProjectViews,
    createTask,
    completeTask,
    updateTask,
    deleteTask,
    setTaskLabels,
    closePopup,
    isFirefox,
    getQuickAddMagicMode,
    searchProjectUsers,
    listLabels,
    createLabel,
    addLabelToTask,
    findOrCreateLabel,
    addAssigneeToTask,
    buildTaskContent,
    getActiveTab,
    loadCaptureContent,
    dueTodayISO,
    hostPermissionPatterns,
    hasHostPermissions,
    requestHostPermissions,
  } = window.VikunjaLib;

  const { parseTaskText, PrefixMode, PREFIXES, cleanupItemText, analyzeTaskText, removeSpan, repeatTaskFields } = window.QuickAdd;
  const {
    openOptions: uiOpenOptions,
    showToast: uiShowToast,
    fillProjectSelect: uiFillProjectSelect,
    projectOptions: uiProjectOptions,
    projectPath: uiProjectPath,
    priorityLabel: uiPriorityLabel,
    duePresetDate: uiDuePresetDate,
    formatDateTimeLocal: uiFormatDateTimeLocal,
  } = window.UiLib;
  const { t } = window.I18n;

  const configPrompt = document.getElementById('config-prompt');
  const loading = document.getElementById('loading');
  const list = document.getElementById('list');
  const searchInput = document.getElementById('search');
  const quickForm = document.getElementById('quick-add');
  const quickTitle = document.getElementById('quick-title');
  const quickChips = document.getElementById('quick-chips');
  const quickAddBtn = document.getElementById('quick-add-btn');
  const quickError = document.getElementById('quick-error');
  const sortBtn = document.getElementById('sort-btn');
  const sortMenu = document.getElementById('sort-menu');
  const viewSwitcher = document.getElementById('view-switcher');
  const addSiteBtn = document.getElementById('add-site');
  const taskList = document.getElementById('task-list');
  const taskEmpty = document.getElementById('task-empty');
  const toastEl = document.getElementById('toast');
  const logo = document.getElementById('logo');
  const openSettingsBtn = document.getElementById('open-settings');
  const goSettingsBtn = document.getElementById('go-settings');
  const grantAccessBtn = document.getElementById('grant-access');
  const capture = document.getElementById('capture');
  const captureForm = document.getElementById('capture-form');
  const captureTitle = document.getElementById('capture-title');
  const captureProject = document.getElementById('capture-project');
  const captureDueToday = document.getElementById('capture-due-today');
  const capturePriority = document.getElementById('capture-priority');
  const captureDue = document.getElementById('capture-due');
  const captureLabelsInput = document.getElementById('capture-labels-input');
  const captureLabelsChips = document.getElementById('capture-labels-chips');
  const captureDescription = document.getElementById('capture-description');
  const captureCancel = document.getElementById('capture-cancel');
  const captureAdd = document.getElementById('capture-add');
  const captureDirectAdd = document.getElementById('capture-direct-add');
  const captureError = document.getElementById('capture-error');
  const toggleCompletedBtn = document.getElementById('toggle-completed');

  const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || '');
  searchInput.placeholder = `${t('searchPlaceholder', 'Search tasks…')} (${isMac ? '⌘F' : 'Ctrl+F'})`;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let baseUrl = '';
  let hostPatterns = [];
  let projectsById = new Map();
  let prefs = { defaultProjectId: null, dueToday: false, customFilter: '' };
  let tasks = [];
  let quickAddMode = PrefixMode.Default;
  let currentProjectId = null;
  let currentViewId = null;
  let activePreset = 'all'; // 'all' | 'due' | 'favorites'
  let showCompletedTasks = false;
  let expandedTaskId = null;
  let labelOptions = null;
  const usersByProject = new Map();
  let currentSort = { mode: 'created', orderBy: 'desc' };
  let projectViews = null;
  let lastCapturedTabInfo = null;

  const SORT_MODES = {
    position: { label: t('sortManually', 'Manually sorted'), sortBy: 'position', orderBy: 'asc', needsView: true },
    title: { label: t('sortByTitle', 'Title'), sortBy: 'title', orderBy: 'asc' },
    created: { label: t('sortByCreated', 'Created'), sortBy: 'created', orderBy: 'desc' },
    updated: { label: t('sortByUpdated', 'Updated'), sortBy: 'updated', orderBy: 'desc' },
    due_date: { label: t('sortByDueDate', 'Due date'), sortBy: 'due_date', orderBy: 'asc' },
    priority: { label: t('sortByPriority', 'Priority'), sortBy: 'priority', orderBy: 'desc' },
  };

  const PLACEHOLDERS = {
    [PrefixMode.Default]: t('quickAddPlaceholderVikunja', 'Add a task: +Project *label !1 @user tomorrow'),
    [PrefixMode.Todoist]: t('quickAddPlaceholderTodoist', 'Add a task: #Project @label !1 +user tomorrow'),
    [PrefixMode.Disabled]: t('quickAddPlaceholder', 'Add a task…'),
  };

  const DATE_PRESETS = ['today', 'tomorrow', 'in 2 days', 'in 3 days', 'in 1 week', 'next monday', 'next week'];
  const REPEAT_PRESETS = ['every day', 'every 2 days', 'every week', 'every 2 weeks', 'every month'];

  function showView(view) {
    [configPrompt, loading, list, capture].forEach((v) => {
      v.hidden = v !== view;
    });
    // If we are in the config stage, also disable the top bar. In the capture
    // stage only the settings and logo stay, so the form gets the room.
    const headerHidden = view === configPrompt || view === capture;
    searchInput.hidden = headerHidden;
    sortBtn.hidden = headerHidden;
    addSiteBtn.hidden = headerHidden;
    openSettingsBtn.hidden = view === configPrompt;
  }

  function setQuickError(message) {
    quickError.textContent = message || '';
    quickError.hidden = !message;
  }

  function autosize() {
    const el = quickTitle;
    el.style.height = 'auto';
    if (typeof el.scrollHeight === 'number') {
      el.style.height = Math.min(el.scrollHeight, 92) + 'px';
    }
  }

  function afterTokenChange() {
    renderChips();
    autosize();
    quickTitle.focus();
  }

  // Writes `newToken` into the input, replacing an existing token of the same
  // type when one is present (project/priority/date/repeat). The text stays the
  // single source of truth; parseTaskText computes everything at submit.
  function setToken(analyzed, type, newToken) {
    const span =
      type === 'project'
        ? analyzed.project
        : type === 'priority'
          ? analyzed.priority
          : type === 'date'
            ? analyzed.date
            : analyzed.repeats;
    let text = quickTitle.value;
    if (span !== null) {
      const hadTrailingSpace = /\s$/.test(text.slice(span.start, span.end));
      text = removeSpan(text, span.start, span.end);
      const sepBefore = span.start > 0 && text[span.start - 1] !== ' ' ? ' ' : '';
      const sepAfter = hadTrailingSpace ? ' ' : '';
      text = text.slice(0, span.start) + sepBefore + newToken + sepAfter + text.slice(span.start);
    } else {
      const sep = text === '' || /\s$/.test(text) ? '' : ' ';
      text = text + sep + newToken;
    }
    quickTitle.value = text;
  }

  function appendToken(newToken) {
    const text = quickTitle.value;
    const sep = text === '' || /\s$/.test(text) ? '' : ' ';
    quickTitle.value = text + sep + newToken;
  }

  function makeChip(type) {
    const sel = document.createElement('select');
    sel.className = `chip chip-select${type ? ` chip--${type}` : ''}`;
    quickChips.appendChild(sel);
    return sel;
  }

  // Sizes a chip select to its currently displayed text (not its widest
  // option), so the pill hugs the label. No-op without a real layout (e.g. the
  // smoke-test fake DOM).
  function sizeSelectToContent(sel) {
    if (!document.body || typeof document.body.appendChild !== 'function') return;
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;' +
      'font:600 0.75rem system-ui,sans-serif;' +
      'padding-left:0.4rem;padding-right:1.05rem;border:1px solid transparent;';
    probe.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
    document.body.appendChild(probe);
    const width = probe.offsetWidth;
    probe.remove();
    if (width > 0) sel.style.width = width + 'px';
  }

  function chipOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  }

  function buildProjectChip(tokens) {
    const P = PREFIXES[quickAddMode];
    const projId = effectiveProjectId(tokens);
    const sel = makeChip('project');
    sel.title = t('chipProject', 'Project');
    for (const p of realProjectList()) {
      sel.appendChild(chipOption(String(p.id), P && P.project ? `${P.project}${p.title}` : p.title));
    }
    sel.value = String(projId);
    sel.addEventListener('change', (e) => {
      const id = Number((e.target && e.target.value) ?? sel.value);
      if (!projectsById.has(id) || id === projId) return;
      if (P && P.project) {
        setToken(tokens, 'project', P.project + projectsById.get(id).title);
      } else {
        currentProjectId = id;
      }
      afterTokenChange();
    });
  }

  function buildPriorityChip(tokens, P) {
    const has = tokens.priority !== null;
    const sel = makeChip(has ? 'priority' : '');
    sel.title = t('chipPriority', 'Priority');
    sel.appendChild(chipOption('', has ? tokens.priority.text : t('chipPriorityDefault', 'Priority')));
    for (let n = 1; n <= 5; n++) {
      sel.appendChild(chipOption(String(n), `${P.priority}${n}`));
    }
    sel.value = has ? tokens.priority.text.slice(P.priority.length) : '';
    sel.addEventListener('change', (e) => {
      const v = (e.target && e.target.value) ?? sel.value;
      if (!v) return;
      setToken(tokens, 'priority', P.priority + v);
      afterTokenChange();
    });
  }

  function buildLabelChip(tokens, P) {
    if (labelOptions === null) {
      labelOptions = [];
      listLabels()
        .then((labels) => {
          labelOptions = labels || [];
          renderChips();
        })
        .catch(() => {
          labelOptions = [];
        });
    }
    const names = tokens.labels.map((l) => l.text);
    const sel = makeChip(names.length > 0 ? 'label' : '');
    sel.title = t('chipLabel', 'Label');
    sel.appendChild(chipOption('', names.length > 0 ? t('chipLabelCount', 'Labels · $1', [names.length]) : t('chipLabel', 'Label')));
    for (const lb of labelOptions) {
      sel.appendChild(chipOption(String(lb.id), P.label + (lb.title || lb.name || lb.id)));
    }
    sel.value = '';
    sel.addEventListener('change', (e) => {
      const v = (e.target && e.target.value) ?? sel.value;
      const lb = labelOptions.find((x) => String(x.id) === String(v));
      if (!lb) return;
      const token = P.label + (lb.title || lb.name || lb.id);
      if (names.includes(token)) return;
      appendToken(token);
      afterTokenChange();
    });
  }

  function buildAssigneeChip(tokens, P) {
    const projId = effectiveProjectId(tokens);
    let users;
    if (!usersByProject.has(projId)) {
      usersByProject.set(projId, null);
      searchProjectUsers(projId, '')
        .then((list) => {
          usersByProject.set(projId, list || []);
          renderChips();
        })
        .catch(() => {
          usersByProject.set(projId, []);
        });
      users = null;
    } else {
      users = usersByProject.get(projId);
    }
    const tokensUsed = tokens.assignees.map((a) => a.text);
    const sel = makeChip(tokensUsed.length > 0 ? 'assignee' : '');
    sel.title = t('chipAssignee', 'Assignee');
    sel.appendChild(
      chipOption(
        '',
        tokensUsed.length > 0
          ? t('chipAssigneeCount', 'Assignees · $1', [tokensUsed.length])
          : users === null
            ? t('chipAssigneeLoading', 'Assignees…')
            : t('chipAssignee', 'Assignee'),
      ),
    );
    if (users !== null) {
      for (const u of users) {
        const name = u.username || u.name || u.email;
        if (!name) continue;
        sel.appendChild(chipOption(String(u.id), P.assignee + name));
      }
      sel.disabled = users.length === 0;
    } else {
      sel.disabled = true;
    }
    sel.value = '';
    sel.addEventListener('change', (e) => {
      const v = (e.target && e.target.value) ?? sel.value;
      const u = (users || []).find((x) => String(x.id) === String(v));
      if (!u) return;
      const token = P.assignee + (u.username || u.name || u.email);
      if (tokensUsed.includes(token)) return;
      appendToken(token);
      afterTokenChange();
    });
  }

  function buildDateChip(tokens) {
    const has = tokens.date !== null;
    const sel = makeChip(has || prefs.dueToday ? 'date' : '');
    sel.title = t('chipDueDate', 'Due Date');
    const placeholder = has ? tokens.date.text : prefs.dueToday ? 'today' : t('chipDueDefault', 'Due');
    sel.appendChild(chipOption('', placeholder));
    for (const preset of DATE_PRESETS) {
      // The placeholder already shows the current value (or the dueToday
      // default "today"); don't repeat it as a selectable preset.
      if (preset.toLowerCase() === placeholder.toLowerCase()) continue;
      sel.appendChild(chipOption(preset, preset));
    }
    sel.value = '';
    sel.addEventListener('change', (e) => {
      const v = (e.target && e.target.value) ?? sel.value;
      if (!v) return;
      setToken(tokens, 'date', v);
      afterTokenChange();
    });
  }

  function buildRepeatChip(tokens) {
    const has = tokens.repeats !== null;
    const sel = makeChip(has ? 'repeat' : '');
    sel.title = t('chipRepeat', 'Repeat');
    sel.appendChild(chipOption('', has ? tokens.repeats.text : t('chipRepeatDefault', 'Repeat')));
    for (const preset of REPEAT_PRESETS) {
      sel.appendChild(chipOption(preset, preset));
    }
    sel.value = '';
    sel.addEventListener('change', (e) => {
      const v = (e.target && e.target.value) ?? sel.value;
      if (!v) return;
      setToken(tokens, 'repeat', v);
      afterTokenChange();
    });
  }

  function renderChips() {
    quickChips.textContent = '';
    const hasText = Boolean(quickTitle.value.trim());
    if (!hasText) {
      quickChips.classList.remove('show');
      quickAddBtn.classList.remove('show');
      return;
    }
    const tokens = analyzeTaskText(quickTitle.value, quickAddMode);
    buildProjectChip(tokens);
    const P = PREFIXES[quickAddMode];
    if (P) {
      buildPriorityChip(tokens, P);
      buildLabelChip(tokens, P);
      buildAssigneeChip(tokens, P);
      buildDateChip(tokens);
      buildRepeatChip(tokens);
    }
    quickChips.childNodes.forEach(sizeSelectToContent);
    quickChips.classList.add('show');
    quickAddBtn.classList.add('show');
  }

  async function resolveCurrentProject() {
    let id = prefs.defaultProjectId;
    if (!id) {
      const { lastProjectId } = await api.storage.local.get({ lastProjectId: null });
      id = lastProjectId;
    }
    // The create target must be a real project (positive id); saved-filter
    // pseudo-projects are views, not places to create tasks.
    if (id && id > 0 && projectsById.has(id)) {
      currentProjectId = id;
    } else {
      const first = realProjectList()[0];
      currentProjectId = first ? first.id : null;
    }
  }

  function hasDueDate(dateStr) {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    if (isNaN(due.getTime())) return false;
    if (due.getFullYear() < 1000) return false;
    return true;
  }

  function formatDue(dateStr) {
    if (!hasDueDate(dateStr)) return '';
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    const dueDay = new Date(due.getTime());
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay >= today && dueDay < end) return t('todayLabel', 'Today');
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Vikunja-style checkbox: a visually hidden input + a drawn rounded-square
  // SVG (mirrors the frontend's FancyCheckbox/checkbox.svg).
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

  function filterTasksByPreset(taskList) {
    const now = Date.now();
    return taskList.filter((task) => {
      if (activePreset === 'due') {
        if (!hasDueDate(task.due_date)) return false;
        const dueTime = new Date(task.due_date).getTime();
        const isOverdue = dueTime < now;
        const isToday = formatDue(task.due_date) === t('todayLabel', 'Today');
        if (!isOverdue && !isToday) return false;
      } else if (activePreset === 'favorites') {
        if (task.is_favorite !== true) return false;
      }
      return true;
    });
  }

  function renderTasks() {
    taskList.textContent = '';
    const query = searchInput.value.trim().toLowerCase();
    let visible = filterTasksByPreset(tasks);
    if (query) {
      visible = visible.filter((t) => {
        const hay = `${t.title || ''} ${t.description || ''}`.toLowerCase();
        return hay.includes(query);
      });
    }
    taskEmpty.hidden = visible.length > 0;
    taskEmpty.textContent = query ? t('noMatchingTasks', 'No matching tasks.') : t('noTasks', 'No tasks here yet.');

    const now = Date.now();
    const showProject = currentViewId === null ? !prefs.defaultProjectId : true;
    visible.forEach((task) => {
      const isExpanded = expandedTaskId === task.id;
      const li = document.createElement('li');
      li.className = 'task' + (isExpanded ? ' expanded' : '');
      li.setAttribute('data-task-id', task.id);
      li.setAttribute('data-priority', task.priority || 0);
      if (task.done) {
        li.classList.add('done');
      }

      li.appendChild(makeCheckbox(task, (input) => toggleTask(task, input)));

      const body = document.createElement('div');
      body.className = 'task-body';

      const top = document.createElement('div');
      top.className = 'task-top';

      const title = document.createElement('span');
      title.className = 'task-title';
      title.textContent = task.title || t('untitledLabel', 'Untitled');
      title.title = task.title || t('untitledLabel', 'Untitled');
      title.addEventListener('click', () => {
        window.open(`${baseUrl}/tasks/${task.id}`, '_blank');
        closePopup();
      });
      top.appendChild(title);

      if (showProject && projectsById.has(task.project_id)) {
        const project = document.createElement('span');
        project.className = 'task-project';
        project.textContent = projectsById.get(task.project_id).title;
        project.title = project.textContent;
        top.appendChild(project);
      }
      body.appendChild(top);

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const due = formatDue(task.due_date);
      if (due) {
        const dueEl = document.createElement('span');
        dueEl.className = 'task-due';
        if (!task.done && new Date(task.due_date).getTime() < now) {
          dueEl.classList.add('overdue');
          dueEl.textContent = t('overdueLabel', 'Overdue');
        } else if (due === t('todayLabel', 'Today')) {
          dueEl.classList.add('today');
          dueEl.textContent = t('todayLabel', 'Today');
        } else {
          dueEl.textContent = due;
        }
        meta.appendChild(dueEl);
      }

      if (task.priority > 0) {
        const prioEl = document.createElement('span');
        prioEl.className = 'task-due';
        prioEl.style.color = task.priority >= 4 ? 'var(--err)' : 'var(--orange)';
        prioEl.textContent = uiPriorityLabel(task.priority);
        meta.appendChild(prioEl);
      }

      (Array.isArray(task.labels) ? task.labels : []).forEach((label) => {
        const tag = document.createElement('span');
        tag.className = 'task-tag';
        tag.textContent = label.title || 'tag';
        tag.title = tag.textContent;
        if (label.hex_color) {
          tag.style.background = `#${label.hex_color}26`;
          tag.style.color = `#${label.hex_color}`;
        }
        meta.appendChild(tag);
      });

      if (meta.childNodes.length) {
        body.appendChild(meta);
      }

      li.appendChild(body);

      // Expand / collapse action button
      const expandBtn = document.createElement('button');
      expandBtn.type = 'button';
      expandBtn.className = 'task-expand-btn';
      expandBtn.title = isExpanded ? 'Collapse' : 'Edit task details';
      expandBtn.textContent = isExpanded ? '▲' : '▼';
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        expandedTaskId = isExpanded ? null : task.id;
        renderTasks();
      });
      li.appendChild(expandBtn);

      // Inline Task Editor when expanded
      if (isExpanded) {
        const editor = document.createElement('div');
        editor.className = 'task-editor';

        // Title edit input
        const editTitleInput = document.createElement('input');
        editTitleInput.type = 'text';
        editTitleInput.value = task.title || '';
        editTitleInput.placeholder = 'Task title';
        editor.appendChild(editTitleInput);

        // Row with Project and Priority
        const projPrioRow = document.createElement('div');
        projPrioRow.className = 'editor-row';

        const projSelect = document.createElement('select');
        projSelect.style.flex = '1';
        uiFillProjectSelect(projSelect, realProjectList(), {
          selectedId: task.project_id,
          placeholder: t('selectProject', 'Select project'),
          fallbackToFirst: true,
        });
        projPrioRow.appendChild(projSelect);

        const prioSelect = document.createElement('select');
        prioSelect.style.width = '120px';
        [0, 1, 2, 3, 4, 5].forEach((p) => {
          const opt = document.createElement('option');
          opt.value = String(p);
          opt.textContent = uiPriorityLabel(p);
          if (p === (Number(task.priority) || 0)) opt.selected = true;
          prioSelect.appendChild(opt);
        });
        projPrioRow.appendChild(prioSelect);
        editor.appendChild(projPrioRow);

        // Due date input
        const dueRow = document.createElement('div');
        dueRow.className = 'editor-row';
        const dueInput = document.createElement('input');
        dueInput.type = 'datetime-local';
        dueInput.style.flex = '1';
        if (hasDueDate(task.due_date)) {
          dueInput.value = uiFormatDateTimeLocal(new Date(task.due_date));
        }
        dueRow.appendChild(dueInput);
        editor.appendChild(dueRow);

        // Description textarea
        const descInput = document.createElement('textarea');
        descInput.rows = 3;
        descInput.placeholder = 'Description (optional)';
        descInput.value = task.description || '';
        editor.appendChild(descInput);

        // Actions: Save, Open Web, Delete (two-step)
        const actRow = document.createElement('div');
        actRow.className = 'task-editor-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'primary';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          try {
            const patch = {
              title: editTitleInput.value.trim() || task.title,
              project_id: Number(projSelect.value) || task.project_id,
              priority: Number(prioSelect.value) || 0,
              description: descInput.value.trim(),
            };
            if (dueInput.value) {
              patch.due_date = new Date(dueInput.value).toISOString();
            } else {
              patch.due_date = '0001-01-01T00:00:00Z';
            }
            await updateTask(task.id, patch);
            uiShowToast(toastEl, 'Task updated.');
            expandedTaskId = null;
            await refreshTasks();
          } catch (err) {
            uiShowToast(toastEl, `Save failed: ${err.message}`, { error: true });
          } finally {
            saveBtn.disabled = false;
          }
        });
        actRow.appendChild(saveBtn);

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'secondary';
        openBtn.textContent = 'Open ↗';
        openBtn.addEventListener('click', () => {
          window.open(`${baseUrl}/tasks/${task.id}`, '_blank');
          closePopup();
        });
        actRow.appendChild(openBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-danger';
        deleteBtn.textContent = 'Delete';
        let deleteTimer = null;
        deleteBtn.addEventListener('click', async () => {
          if (!deleteBtn.classList.contains('armed')) {
            deleteBtn.classList.add('armed');
            deleteBtn.textContent = 'Confirm? (3s)';
            deleteTimer = setTimeout(() => {
              deleteBtn.classList.remove('armed');
              deleteBtn.textContent = 'Delete';
            }, 3500);
            return;
          }
          clearTimeout(deleteTimer);
          deleteBtn.disabled = true;
          try {
            await deleteTask(task.id);
            uiShowToast(toastEl, 'Task deleted.');
            expandedTaskId = null;
            await refreshTasks();
          } catch (err) {
            uiShowToast(toastEl, `Delete failed: ${err.message}`, { error: true });
            deleteBtn.classList.remove('armed');
            deleteBtn.textContent = 'Delete';
            deleteBtn.disabled = false;
          }
        });
        actRow.appendChild(deleteBtn);

        editor.appendChild(actRow);
        li.appendChild(editor);
      }

      taskList.appendChild(li);
    });
  }

  // Resolve the sort to use: a remembered local choice wins over the options
  // default, but only when "remember last sort" is enabled.
  async function resolveSort() {
    let mode = prefs.sortBy && SORT_MODES[prefs.sortBy] ? prefs.sortBy : 'position';
    let orderBy = SORT_MODES[mode].orderBy;
    if (prefs.rememberLastSort) {
      try {
        const { lastSort } = await api.storage.local.get({ lastSort: null });
        if (lastSort && SORT_MODES[lastSort.mode]) {
          mode = lastSort.mode;
          orderBy = lastSort.orderBy === 'asc' || lastSort.orderBy === 'desc' ? lastSort.orderBy : SORT_MODES[mode].orderBy;
        }
      } catch (e) {
        // Ignore local-storage failures and use the default.
      }
    }
    currentSort = { mode, orderBy };
  }

  // Vikunja only orders by position through a project view, so manual sorting
  // needs a project or filter context; otherwise fall back to newest first.
  function projectContext() {
    return currentViewId !== null ? currentViewId : prefs.defaultProjectId;
  }

  function effectiveSortParams() {
    const mode = SORT_MODES[currentSort.mode];
    if (!mode.needsView) {
      return { sortBy: mode.sortBy, orderBy: currentSort.orderBy };
    }
    if (!projectContext()) {
      return { sortBy: 'created', orderBy: 'desc' };
    }
    return { sortBy: 'position', orderBy: currentSort.orderBy, needsView: true };
  }

  async function resolveManualView(projectId) {
    if (!projectId) return null;
    if (projectViews !== null) return projectViews;
    try {
      const views = await listProjectViews(projectId);
      const listView = views.find((v) => v.type === 'list') || views[0];
      projectViews = listView ? listView.id : null;
    } catch (e) {
      projectViews = null;
    }
    return projectViews;
  }

  async function loadTasks() {
    const opts = {};
    // A selected filter view scopes the fetch to the filter's pseudo-project
    // and must not carry the extension's own filter param — the API ANDs it
    // with the saved filter's filter string, which would restrict it.
    if (currentViewId !== null) {
      opts.projectId = currentViewId;
    } else {
      opts.filter = showCompletedTasks
        ? (prefs.customFilter || '')
        : (prefs.customFilter || 'done = false');
      if (prefs.defaultProjectId) {
        opts.projectId = prefs.defaultProjectId;
      }
    }
    const sort = effectiveSortParams();
    opts.sortBy = sort.sortBy;
    opts.orderBy = sort.orderBy;
    if (sort.needsView) {
      const viewId = await resolveManualView(projectContext());
      if (viewId) {
        opts.viewId = viewId;
      } else {
        opts.sortBy = 'created';
        opts.orderBy = 'desc';
      }
    }
    return listTasks(opts);
  }

  async function refreshTasks() {
    tasks = await loadTasks();
    renderTasks();
  }

  // Adds a one-shot entrance animation to the row of the just-created task and
  // scrolls it into view if it landed outside the visible area.
  function flashNewTask(taskId) {
    const li = Array.from(taskList.childNodes).find(
      (c) =>
        typeof c.getAttribute === 'function' &&
        String(c.getAttribute('data-task-id')) === String(taskId),
    );
    if (!li) return;
    li.classList.add('task--new');
    if (typeof li.scrollIntoView === 'function') {
      li.scrollIntoView({ block: 'nearest' });
    }
  }

  function sortLabel() {
    const def = SORT_MODES[currentSort.mode];
    const dir = currentSort.orderBy === 'asc' ? t('sortAscending', 'ascending') : t('sortDescending', 'descending');
    return t('sortLabel', 'Sort: $1 ($2)', [def.label, dir]);
  }

  function renderSortMenu() {
    sortMenu.textContent = '';
    for (const [key, def] of Object.entries(SORT_MODES)) {
      const li = document.createElement('li');
      li.textContent = def.label;
      if (currentSort.mode === key) {
        li.classList.add('active');
      }
      li.addEventListener('click', () => {
        return setSort(key, SORT_MODES[key].orderBy);
      });
      sortMenu.appendChild(li);
    }
    const divider = document.createElement('li');
    divider.className = 'menu-divider';
    sortMenu.appendChild(divider);
    const dir = document.createElement('li');
    dir.textContent = currentSort.orderBy === 'asc' ? t('sortAscendingItem', 'Ascending ▲') : t('sortDescendingItem', 'Descending ▼');
    dir.addEventListener('click', () => {
      return setSort(currentSort.mode, currentSort.orderBy === 'asc' ? 'desc' : 'asc');
    });
    sortMenu.appendChild(dir);
  }

  async function setSort(mode, orderBy) {
    if (currentSort.mode === mode && currentSort.orderBy === orderBy) {
      closeSortMenu();
      return;
    }
    currentSort = { mode, orderBy };
    if (prefs.rememberLastSort) {
      try {
        await api.storage.local.set({ lastSort: { mode, orderBy } });
      } catch (e) {
        // Ignore storage failures; the choice still applies for this session.
      }
    }
    sortBtn.title = sortLabel();
    sortBtn.setAttribute('aria-label', sortLabel());
    closeSortMenu();
    try {
      await refreshTasks();
    } catch (e) {
      uiShowToast(toastEl, t('couldNotReloadTasks', 'Could not reload tasks: $1', [e.message]), { error: true });
    }
  }

  function closeSortMenu() {
    sortMenu.hidden = true;
    sortBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleSortMenu() {
    renderSortMenu();
    sortMenu.hidden = !sortMenu.hidden;
    sortBtn.setAttribute('aria-expanded', String(!sortMenu.hidden));
  }

  // Saved filters show up in the /projects listing as pseudo-projects with
  // negative ids (id = filterID * -1 - 1). Real projects are always positive.
  const realProjectList = () => [...projectsById.values()].filter((p) => p.id > 0);
  const filterViews = () => [...projectsById.values()].filter((p) => p.id < -1);

  // Renders the view switcher row: an "All tasks" chip plus one chip per
  // favorited saved filter (server order). Hidden entirely when there are
  // none, so the bar never takes up space for filters the user did not star.
  function renderViewSwitcher() {
    const views = filterViews().filter((p) => p.is_favorite);
    viewSwitcher.textContent = '';
    if (views.length === 0) {
      viewSwitcher.hidden = true;
      return;
    }
    const addChip = (id, label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'view-chip';
      if (id === currentViewId) {
        chip.classList.add('active');
      }
      chip.textContent = label;
      chip.title = label;
      chip.addEventListener('click', () => setView(id));
      viewSwitcher.appendChild(chip);
    };
    addChip(null, t('viewAll', 'All tasks'));
    views.forEach((v) => addChip(v.id, v.title));
    viewSwitcher.hidden = false;
  }

  async function setView(id) {
    const next = id === null ? null : Number(id);
    if (next === currentViewId) return;
    currentViewId = next;
    try {
      await api.storage.local.set({ lastViewId: next });
    } catch (e) {
      // Ignore storage failures; the choice still applies for this session.
    }
    renderViewSwitcher();
    try {
      await refreshTasks();
    } catch (e) {
      uiShowToast(toastEl, t('couldNotReloadTasks', 'Could not reload tasks: $1', [e.message]), { error: true });
    }
  }

  async function load() {
    const config = await getConfig();
    baseUrl = config.baseUrl;
    if (!baseUrl) {
      showView(configPrompt);
      return;
    }
    hostPatterns = hostPermissionPatterns(config);
    if (!await hasHostPermissions(hostPatterns)) {
      configPrompt.querySelector('.empty').textContent = t('configNoAccess', 'Vikunja is configured, but access to your Vikunja server is not granted yet.');
      grantAccessBtn.hidden = false;
      showView(configPrompt);
      return;
    }
    showView(loading);
    try {
      const [projects, p, mode] = await Promise.all([
        listProjects(),
        getPrefs(),
        getQuickAddMagicMode().catch(() => PrefixMode.Default),
      ]);
      prefs = p;
      if (prefs && prefs.theme) {
        applyTheme(prefs.theme);
      }
      quickAddMode = mode;
      projectsById = new Map(projects.map((pr) => [pr.id, pr]));
      const { lastViewId } = await api.storage.local.get({ lastViewId: null });
      if (lastViewId && projectsById.has(Number(lastViewId)) && Number(lastViewId) < -1) {
        currentViewId = Number(lastViewId);
      }
      renderViewSwitcher();
      quickTitle.placeholder = PLACEHOLDERS[quickAddMode] || t('quickAddPlaceholder', 'Add a task…');
      await resolveCurrentProject();
      await resolveSort();
      sortBtn.title = sortLabel();
      sortBtn.setAttribute('aria-label', sortLabel());
      tasks = await loadTasks();
      renderTasks();
      renderChips();
      autosize();
      showView(list);
      const pending = await loadCaptureContent().catch(() => null);
      if (pending) {
        showCaptureForm(pending);
      } else {
        quickTitle.focus();
      }
    } catch (e) {
      if (!await hasHostPermissions(hostPatterns)) {
        configPrompt.querySelector('.empty').textContent = t('configNoAccess', 'Vikunja is configured, but access to your Vikunja server is not granted yet.');
        grantAccessBtn.hidden = false;
      } else {
        configPrompt.querySelector('.empty').textContent = t('couldNotLoadTasks', 'Could not load tasks: $1', [e.message]);
      }
      showView(configPrompt);
    }
  }

  async function toggleTask(task, input) {
    input.disabled = true;
    const next = input.checked;
    try {
      await completeTask(task.id, next);
      task.done = next;
      uiShowToast(toastEl, next ? t('taskCompleted', 'Task completed.') : t('taskReopened', 'Task reopened.'));
      renderTasks();
    } catch (e) {
      input.checked = !next;
      uiShowToast(toastEl, t('couldNotUpdateTask', 'Could not update task: $1', [e.message]), { error: true });
    } finally {
      input.disabled = false;
    }
  }

  function effectiveProjectId(tokens) {
    if (tokens.project) {
      const P = PREFIXES[quickAddMode];
      const name = P && P.project ? tokens.project.text.slice(P.project.length) : tokens.project.text;
      const resolved = resolveProject(name);
      if (resolved) return resolved;
    }
    return currentProjectId;
  }

  function resolveProject(parsedProject) {
    if (parsedProject) {
      const exact = realProjectList().find(
        (p) => p.title.toLowerCase() === parsedProject.toLowerCase(),
      );
      if (exact) return exact.id;
      const byIdentifier = realProjectList().find(
        (p) =>
          p.identifier && p.identifier.toLowerCase() === parsedProject.toLowerCase(),
      );
      if (byIdentifier) return byIdentifier.id;
    }
    return currentProjectId;
  }

  // Mirrors the frontend's validateUser: with a single search result use a
  // fuzzy match, otherwise an exact match, against username/name/email.
  function matchProjectUser(users, query) {
    const match = (fuzzy) => {
      for (const key of ['username', 'name', 'email']) {
        const found = users.find((u) => {
          const value = u && u[key];
          if (value === undefined || value === null) return false;
          const hay = String(value).toLowerCase();
          const needle = String(query).toLowerCase();
          return fuzzy ? hay.includes(needle) : hay === needle;
        });
        if (found) return found;
      }
      return undefined;
    };
    return users.length === 1 ? match(true) : match(false);
  }

  async function findAssignees(parsedAssignees, projectId) {
    if (!Array.isArray(parsedAssignees) || parsedAssignees.length === 0) {
      return [];
    }
    const results = [];
    for (const a of parsedAssignees) {
      try {
        const users = await searchProjectUsers(projectId, a);
        const matched = matchProjectUser(users, a);
        if (matched) {
          results.push({ id: matched.id, match: a });
        }
      } catch (e) {
        // Ignore assignee lookup failures; the @mention stays in the title.
      }
    }
    return results;
  }

  async function addLabelsToTask(taskId, parsedLabels) {
    if (!Array.isArray(parsedLabels) || parsedLabels.length === 0) {
      return;
    }
    const uniqueLabels = Array.from(new Set(parsedLabels));
    const existing = await listLabels();
    for (const title of uniqueLabels) {
      let label = existing.find(
        (l) => l.title && l.title.toLowerCase() === title.toLowerCase(),
      );
      if (!label) {
        try {
          label = await createLabel({ title, hexColor: randomLabelColor() });
        } catch (e) {
          // Token may lack label permissions; skip instead of failing the add.
          continue;
        }
      }
      if (label && label.id) {
        try {
          await addLabelToTask(taskId, label.id);
        } catch (e) {
          // Skip if attaching failed (e.g. missing tasks_labels permission).
        }
      }
    }
  }

  function randomLabelColor() {
    const colors = [
      '#ffbe0b', '#fd8a09', '#fb5607', '#ff006e', '#efbdeb', '#8338ec',
      '#5f5ff6', '#3a86ff', '#4c91ff', '#0ead69', '#25be8b', '#073b4c', '#373f47',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async function quickAdd(e) {
    e.preventDefault();
    const rawTitle = quickTitle.value.trim();
    if (!rawTitle) {
      setQuickError(t('pleaseEnterTitle', 'Please enter a task title.'));
      quickTitle.focus();
      return;
    }
    setQuickError('');
    quickAddBtn.disabled = true;
    try {
      const parsed = parseTaskText(rawTitle, quickAddMode);

      // If the whole input was magic, the frontend creates the task with the
      // raw title instead (no intents to act on).
      if (parsed.text === '') {
        if (!currentProjectId) {
          setQuickError(t('pleaseSelectProject', 'Please select a project.'));
          quickTitle.focus();
          return;
        }
        const body = { title: rawTitle };
        if (parsed.date === null && prefs.dueToday) {
          body.due_date = dueTodayISO();
        }
        const created = await createTask(currentProjectId, body);
        uiShowToast(toastEl, t('taskAdded', 'Task added.'), { link: { id: created.id, href: `${baseUrl}/tasks/${created.id}` } });
        quickTitle.value = '';
        renderChips();
        await refreshTasks();
        flashNewTask(created.id);
        quickTitle.focus();
        return;
      }

      const projectId = resolveProject(parsed.project);
      if (!projectId) {
        setQuickError(t('pleaseSelectProject', 'Please select a project.'));
        quickTitle.focus();
        return;
      }

      const assignees = await findAssignees(parsed.assignees, projectId);

      // Only clean up those assignees from the task title which actually exist
      let cleanedTitle = parsed.text;
      if (assignees.length > 0) {
        const assigneePrefix = PREFIXES[quickAddMode]?.assignee;
        if (assigneePrefix) {
          cleanedTitle = cleanupItemText(
            cleanedTitle,
            assignees.map((a) => a.match),
            assigneePrefix,
          );
        }
      }

      const body = { title: cleanedTitle, project_id: projectId };
      if (parsed.date !== null) {
        body.due_date = new Date(parsed.date).toISOString();
      } else if (prefs.dueToday) {
        body.due_date = dueTodayISO();
      }
      if (parsed.priority !== null) {
        body.priority = parsed.priority;
      }
      const repeatFields = repeatTaskFields(parsed.repeats);
      if (repeatFields) {
        body.repeat_after = repeatFields.repeat_after;
        body.repeat_mode = repeatFields.repeat_mode;
      }

      const created = await createTask(projectId, body);
      // Assignees are set after creation: the v2 create body does not accept
      // them (read-only), they go to their own sub-resource.
      for (const user of assignees) {
        await addAssigneeToTask(created.id, user.id);
      }
      await addLabelsToTask(created.id, parsed.labels);
      uiShowToast(toastEl, t('taskAdded', 'Task added.'), { link: { id: created.id, href: `${baseUrl}/tasks/${created.id}` } });
      quickTitle.value = '';
      await api.storage.local.set({ lastProjectId: projectId });
      currentProjectId = projectId;
      renderChips();
      await refreshTasks();
      flashNewTask(created.id);
      quickTitle.focus();
    } catch (err) {
      setQuickError(err.message);
    } finally {
      quickAddBtn.disabled = false;
    }
  }

  function setCaptureError(message) {
    captureError.textContent = message || '';
    captureError.hidden = !message;
  }

  function showCaptureForm(content) {
    lastCapturedTabInfo = content;
    captureTitle.value = content.title || '';
    captureDescription.value = content.description || '';
    uiFillProjectSelect(captureProject, realProjectList(), {
      selectedId: prefs.defaultProjectId,
      placeholder: t('selectProject', 'Select a project'),
      fallbackToFirst: true,
    });
    if (capturePriority) capturePriority.value = '0';
    if (captureDue) {
      if (prefs.dueToday) {
        captureDue.value = uiFormatDateTimeLocal(uiDuePresetDate('today'));
      } else {
        captureDue.value = '';
      }
    }
    if (captureLabelsInput) captureLabelsInput.value = '';
    renderCaptureLabelChips();

    setCaptureError('');
    showView(capture);
    captureTitle.focus();
    if (typeof captureTitle.select === 'function') {
      captureTitle.select();
    }
  }

  function renderCaptureLabelChips() {
    if (!captureLabelsChips) return;
    captureLabelsChips.textContent = '';
    const currentLabels = parseLabelNames(captureLabelsInput ? captureLabelsInput.value : '');
    (labelOptions || []).slice(0, 15).forEach((lb) => {
      const chip = document.createElement('span');
      const isSelected = currentLabels.includes(lb.title.toLowerCase());
      chip.className = 'label-chip-clickable' + (isSelected ? ' selected' : '');
      chip.textContent = lb.title;
      chip.addEventListener('click', () => {
        toggleCaptureLabel(lb.title);
      });
      captureLabelsChips.appendChild(chip);
    });
  }

  function parseLabelNames(str) {
    return String(str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  }

  function toggleCaptureLabel(name) {
    if (!captureLabelsInput) return;
    const current = parseLabelNames(captureLabelsInput.value);
    const lower = name.toLowerCase();
    const idx = current.indexOf(lower);
    if (idx !== -1) {
      current.splice(idx, 1);
    } else {
      current.push(lower);
    }
    captureLabelsInput.value = current.join(', ');
    renderCaptureLabelChips();
  }

  async function directSaveUrl() {
    const info = lastCapturedTabInfo || await buildTaskContent({}, (await getActiveTab()) || {});
    const projId = prefs.defaultProjectId || (realProjectList()[0] && realProjectList()[0].id);
    if (!projId) {
      uiShowToast(toastEl, t('pleaseSelectProject', 'Please configure a default project in settings.'), { error: true });
      return;
    }
    const body = {
      title: info.title || 'Saved Webpage',
      description: info.description || info.url || '',
    };
    if (prefs.dueToday) {
      body.due_date = dueTodayISO();
    }
    try {
      if (captureDirectAdd) captureDirectAdd.disabled = true;
      const created = await createTask(projId, body);
      showView(list);
      uiShowToast(toastEl, t('taskAdded', 'Task added.'), {
        link: { id: created.id, href: `${baseUrl}/tasks/${created.id}` },
      });
      await refreshTasks();
      flashNewTask(created.id);
      quickTitle.focus();
    } catch (err) {
      uiShowToast(toastEl, `Direct save failed: ${err.message}`, { error: true });
    } finally {
      if (captureDirectAdd) captureDirectAdd.disabled = false;
    }
  }

  async function addCurrentSite() {
    addSiteBtn.disabled = true;
    try {
      const tab = await getActiveTab();
      showCaptureForm(buildTaskContent({}, tab || {}));
    } catch (err) {
      uiShowToast(toastEl, t('couldNotOpenCapture', 'Could not open capture: $1', [err.message]), { error: true });
    } finally {
      addSiteBtn.disabled = false;
    }
  }

  async function submitCapture(e) {
    e.preventDefault();
    const title = captureTitle.value.trim();
    if (!title) {
      setCaptureError(t('pleaseEnterTitle', 'Please enter a task title.'));
      captureTitle.focus();
      return;
    }
    if (!captureProject.value) {
      setCaptureError(t('pleaseSelectProject', 'Please select a project.'));
      captureProject.focus();
      return;
    }
    setCaptureError('');
    captureAdd.disabled = true;
    try {
      const body = { title };
      const description = captureDescription.value.trim();
      if (description) {
        body.description = description;
      }
      if (capturePriority && Number(capturePriority.value) > 0) {
        body.priority = Number(capturePriority.value);
      }
      if (captureDue && captureDue.value) {
        body.due_date = new Date(captureDue.value).toISOString();
      } else if (captureDueToday && captureDueToday.checked) {
        body.due_date = dueTodayISO();
      }
      const created = await createTask(captureProject.value, body);

      // Add labels if specified
      if (captureLabelsInput && captureLabelsInput.value.trim()) {
        const rawLabels = captureLabelsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        await addLabelsToTask(created.id, rawLabels);
      }

      await api.storage.local.set({ lastProjectId: Number(captureProject.value) });
      showView(list);
      uiShowToast(toastEl, t('taskAdded', 'Task added.'), {
        link: { id: created.id, href: `${baseUrl}/tasks/${created.id}` },
      });
      await refreshTasks();
      flashNewTask(created.id);
      quickTitle.focus();
    } catch (err) {
      setCaptureError(err.message);
    } finally {
      captureAdd.disabled = false;
    }
  }

  function closeCaptureForm() {
    showView(list);
  }

  openSettingsBtn.addEventListener('click', () => {
    uiOpenOptions(api);
    closePopup();
  });
  goSettingsBtn.addEventListener('click', () => {
    uiOpenOptions(api);
    closePopup();
  });
  grantAccessBtn.addEventListener('click', async () => {
    grantAccessBtn.disabled = true;
    try {
      if (await requestHostPermissions(hostPatterns)) {
        grantAccessBtn.hidden = true;
        configPrompt.querySelector('.empty').textContent = t('notConfigured', 'Vikunja is not configured yet.');
        load();
      } else {
        configPrompt.querySelector('.empty').textContent = t('accessNotGranted', 'Access to your Vikunja server was not granted. You can try again or open the settings.');
      }
    } finally {
      grantAccessBtn.disabled = false;
    }
  });
  function openVikunja() {
    if (baseUrl) {
      window.open(baseUrl, '_blank');
      closePopup();
    }
  }
  logo.addEventListener('click', openVikunja);
  logo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openVikunja();
    }
  });
  addSiteBtn.addEventListener('click', addCurrentSite);
  if (captureDirectAdd) {
    captureDirectAdd.addEventListener('click', directSaveUrl);
  }
  captureForm.addEventListener('submit', submitCapture);
  captureCancel.addEventListener('click', closeCaptureForm);
  captureTitle.addEventListener('input', () => setCaptureError(''));
  if (captureLabelsInput) {
    captureLabelsInput.addEventListener('input', renderCaptureLabelChips);
  }

  // Due date preset buttons in capture form
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      if (!captureDue) return;
      if (preset === 'clear') {
        captureDue.value = '';
      } else {
        captureDue.value = uiFormatDateTimeLocal(uiDuePresetDate(preset));
      }
    });
  });

  // Preset filter bar (All / Today+Overdue / Favorites)
  document.querySelectorAll('.preset-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      activePreset = btn.getAttribute('data-preset') || 'all';
      renderTasks();
    });
  });

  // Toggle completed tasks button
  if (toggleCompletedBtn) {
    toggleCompletedBtn.addEventListener('click', async () => {
      showCompletedTasks = !showCompletedTasks;
      toggleCompletedBtn.setAttribute('aria-pressed', String(showCompletedTasks));
      try {
        await refreshTasks();
      } catch (err) {
        uiShowToast(toastEl, `Reload failed: ${err.message}`, { error: true });
      }
    });
  }

  const openWebBtn = document.getElementById('open-web');
  if (openWebBtn) {
    openWebBtn.addEventListener('click', () => {
      const url = baseUrl || 'https://try.vikunja.io';
      window.open(url, '_blank');
      closePopup();
    });
  }

  sortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSortMenu();
  });
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('click', (e) => {
      if (!sortBtn.contains(e.target) && !sortMenu.contains(e.target)) {
        closeSortMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      // Ctrl+N is a reserved Firefox shortcut (new window) that never reaches
      // this page, so Firefox falls back to Alt+Shift+N; Chrome keeps Ctrl+N.
      if (isFirefox() && e.key.toLowerCase() === 'n') {
        if (e.altKey && e.shiftKey) {
          e.preventDefault();
          quickTitle.focus();
        }
        return;
      }
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        quickTitle.focus();
      } else if (key === 'f') {
        e.preventDefault();
        searchInput.focus();
        if (typeof searchInput.select === 'function') {
          searchInput.select();
        }
      }
    });
  }
  sortBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSortMenu();
    }
  });
  // Mouse wheels only scroll vertically, so route the wheel to horizontal
  // scrolling when the chip row overflows (no-op otherwise).
  if (typeof viewSwitcher.addEventListener === 'function') {
    viewSwitcher.addEventListener(
      'wheel',
      (e) => {
        if (viewSwitcher.scrollWidth <= viewSwitcher.clientWidth) return;
        e.preventDefault();
        viewSwitcher.scrollLeft += e.deltaY + e.deltaX;
      },
      { passive: false },
    );
  }
  quickForm.addEventListener('submit', quickAdd);
  quickTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (typeof quickForm.requestSubmit === 'function') {
        quickForm.requestSubmit();
      } else if (typeof quickForm.submit === 'function') {
        quickForm.submit();
      }
    }
  });
  quickTitle.addEventListener('input', () => {
    setQuickError('');
    autosize();
    renderChips();
  });
  searchInput.addEventListener('input', renderTasks);

  load();
})();
