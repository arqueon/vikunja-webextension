'use strict';
const fs = require('fs');
const path = require('path');
const { installI18nMock } = require('./lib/i18n-mock');

function fakeElement(id) {
  const el = {
    id,
    hidden: false,
    _text: '',
    title: '',
    value: '',
    disabled: false,
    checked: false,
    draggable: false,
    _className: '',
    style: {},
    childNodes: [],
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    appendChild(child) {
      this.childNodes.push(child);
      return child;
    },
    setAttribute(k, v) {
      this[k] = v;
    },
    getAttribute(k) {
      return this[k] !== undefined ? String(this[k]) : null;
    },
    removeAttribute(k) {
      delete this[k];
    },
    querySelector() {
      return fakeElement(id + ':query');
    },
    focus() {},
  };
  Object.defineProperty(el, 'textContent', {
    get() {
      return this._text;
    },
    set(v) {
      this._text = String(v);
      if (!this._text) this.childNodes = [];
    },
  });
  Object.defineProperty(el, 'className', {
    get() {
      return this._className;
    },
    set(v) {
      this._className = String(v);
    },
  });
  Object.defineProperty(el, 'classList', {
    get() {
      const self = this;
      return {
        add(...names) {
          const set = new Set(self._className.split(/\s+/).filter(Boolean));
          names.forEach((n) => set.add(n));
          self._className = [...set].join(' ');
        },
        remove(...names) {
          const set = new Set(self._className.split(/\s+/).filter(Boolean));
          names.forEach((n) => set.delete(n));
          self._className = [...set].join(' ');
        },
        toggle(name, force) {
          const has = self._className.split(/\s+/).includes(name);
          const want = force === undefined ? !has : Boolean(force);
          if (want) this.add(name);
          else this.remove(name);
          return want;
        },
        contains(name) {
          return self._className.split(/\s+/).includes(name);
        },
      };
    },
  });
  return el;
}

const ids = {};
function getById(id) {
  return (ids[id] = ids[id] || fakeElement(id));
}

const storage = new Map();
// Legacy kanbanGroupMode must be ignored in favor of kanbanState.
storage.set('kanbanGroupMode', 'projects');

const calls = {
  listProjectViews: [],
  listKanbanBuckets: [],
  moveTaskToBucket: [],
  listTasks: [],
  updateTask: [],
  completeTask: [],
};

// Trabajo (3) appears BEFORE Autos (4, child of Casa 2) to verify pre-order
// DFS tree sorting puts Autos directly after Casa, before Trabajo.
const projects = [
  { id: 1, title: 'Inbox' },
  { id: 2, title: 'Casa', is_archived: false },
  { id: 3, title: 'Trabajo' },
  { id: 4, title: 'Autos', parent_project_id: 2 },
  { id: 5, title: 'SinKanban' },
  { id: -1, title: 'Favorites', is_favorite: true },
  { id: -5, title: 'GTD · Casa', is_favorite: true },
  { id: -4, title: 'ANYTYPE · Pendientes', is_favorite: true },
  { id: -6, title: 'No favorito', is_favorite: false },
];

const viewsByProject = {
  1: [{ id: 10, title: 'Kanban', view_kind: 'kanban', bucket_configuration_mode: 'manual', default_bucket_id: 101, done_bucket_id: 103 }],
  2: [{ id: 12, title: 'Kanban', view_kind: 'kanban', bucket_configuration_mode: 'manual', default_bucket_id: 201, done_bucket_id: 203 }],
  4: [{ id: 14, title: 'Kanban', view_kind: 'kanban', bucket_configuration_mode: 'manual', default_bucket_id: 401, done_bucket_id: 403 }],
  5: [],
  '-5': [{ id: 20, title: 'GTD', view_kind: 'kanban', bucket_configuration_mode: 'manual', default_bucket_id: 642, done_bucket_id: 661 }],
  '-4': [
    { id: 30, title: 'Kanban', view_kind: 'kanban', bucket_configuration_mode: 'manual', default_bucket_id: 301, done_bucket_id: 303 },
    { id: 31, title: 'Casa', view_kind: 'kanban', bucket_configuration_mode: 'filter' },
  ],
};

const bucketsByView = {
  10: [
    {
      id: 101,
      title: 'To-Do',
      hex_color: '3a86ff',
      position: 100,
      count: 1,
      tasks: [{ id: 701, title: 'Clasificar correo', project_id: 1, bucket_id: 101, done: false, identifier: '#1', labels: [{ title: 'correo', hex_color: '0d9488' }] }],
    },
    {
      id: 102,
      title: 'Doing',
      hex_color: 'fd8a09',
      position: 200,
      count: 1,
      tasks: [{ id: 702, title: 'Podar rosas', project_id: 1, bucket_id: 102, done: false, priority: 3 }],
    },
    {
      id: 103,
      title: 'Done',
      hex_color: '0ead69',
      position: 300,
      count: 1,
      tasks: [{ id: 703, title: 'Ya resuelta', project_id: 1, bucket_id: 103, done: true }],
    },
  ],
  // Parent container project Casa (2) has 0 direct tasks (its task lives in Autos 4).
  12: [
    { id: 201, title: 'To-Do', position: 100, count: 0, tasks: [] },
    { id: 202, title: 'Doing', position: 200, count: 0, tasks: [] },
    { id: 203, title: 'Done', position: 300, count: 0, tasks: [] },
  ],
  20: [
    {
      id: 642,
      title: 'Por aclarar',
      position: 100,
      count: 1,
      tasks: [{ id: 801, title: 'Cambiar aceite', project_id: 4, bucket_id: 642, done: false, identifier: 'CASA-6' }],
    },
    {
      id: 643,
      title: 'Siguientes acciones',
      position: 200,
      count: 0,
      tasks: [],
    },
    {
      id: 661,
      title: 'Hecho',
      position: 300,
      count: 0,
      tasks: [],
    },
  ],
  30: [
    { id: 301, title: 'To-Do', position: 100, count: 0, tasks: [] },
  ],
  31: [
    {
      id: 0,
      title: 'Autos',
      position: 100,
      count: 1,
      tasks: [{ id: 801, title: 'Cambiar aceite', project_id: 4, bucket_id: 0, done: false, identifier: 'CASA-6' }],
    },
    {
      id: 1,
      title: 'Sin proyecto',
      position: 200,
      count: 0,
      tasks: [],
    },
  ],
};

const globalTasksFixture = [
  { id: 701, title: 'Clasificar correo', project_id: 1, done: false },
  { id: 705, title: 'Ficha del Vocho', project_id: 4, done: false },
  { id: 706, title: 'Turno de guardia', project_id: 3, done: false },
];

const clone = (v) => JSON.parse(JSON.stringify(v));

const VikunjaLib = {
  api: {
    storage: {
      local: {
        get: async (defaults) => {
          const out = {};
          Object.keys(defaults).forEach((k) => {
            out[k] = storage.has(k) ? storage.get(k) : defaults[k];
          });
          return out;
        },
        set: async (obj) => {
          Object.entries(obj).forEach(([k, v]) => storage.set(k, v));
        },
      },
    },
    runtime: { getURL: (p) => p },
  },
  getConfig: () => Promise.resolve({ baseUrl: 'https://vikunja.example' }),
  getPrefs: () => Promise.resolve({ defaultProjectId: null, dueToday: false, customFilter: '', theme: 'auto' }),
  listProjects: () => Promise.resolve(clone(projects)),
  listProjectViews: (projectId) => {
    calls.listProjectViews.push(Number(projectId));
    return Promise.resolve(clone(viewsByProject[String(projectId)] || []));
  },
  listKanbanBuckets: (projectId, viewId) => {
    calls.listKanbanBuckets.push({ projectId: Number(projectId), viewId: Number(viewId) });
    return Promise.resolve(clone(bucketsByView[Number(viewId)] || []));
  },
  moveTaskToBucket: (projectId, viewId, bucketId, taskId) => {
    calls.moveTaskToBucket.push({
      projectId: Number(projectId),
      viewId: Number(viewId),
      bucketId: Number(bucketId),
      taskId: Number(taskId),
    });
    const viewList = viewsByProject[String(projectId)] || [];
    const view = viewList.find((v) => Number(v.id) === Number(viewId));
    const isDone = view && Number(view.done_bucket_id) === Number(bucketId);
    return Promise.resolve({ task: { id: Number(taskId), done: Boolean(isDone) } });
  },
  listBuckets: () => Promise.resolve([]),
  listTasks: (opts) => {
    calls.listTasks.push(opts);
    return Promise.resolve(clone(globalTasksFixture));
  },
  updateTask: (id, patch) => {
    calls.updateTask.push({ id: Number(id), patch });
    const task = globalTasksFixture.find((t) => Number(t.id) === Number(id));
    if (task) Object.assign(task, patch);
    return Promise.resolve(Object.assign({}, task, patch));
  },
  completeTask: (id, done) => {
    calls.completeTask.push({ id: Number(id), done: Boolean(done) });
    return Promise.resolve();
  },
};

global.window = {
  open() {},
  I18n: null,
  VikunjaLib,
  UiLib: null,
};
global.document = {
  getElementById: getById,
  createElement: (tag) => fakeElement(`<${tag}>`),
  createElementNS: (ns, tag) => fakeElement(`<svg:${tag}>`),
  createTextNode: (text) => ({ textContent: String(text) }),
  querySelectorAll: () => [],
  documentElement: fakeElement('html'),
};

installI18nMock();
const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'lib/i18n.js'), 'utf8'));
global.window.I18n = globalThis.I18n;
eval(fs.readFileSync(path.join(root, 'lib/ui.js'), 'utf8'));
global.window.UiLib = globalThis.UiLib;

const errors = [];
const assert = (cond, msg) => {
  if (!cond) errors.push(msg);
};
const wait = () => new Promise((r) => { setTimeout(r, 25); });
const flush = () => new Promise((r) => { setTimeout(r, 0); });

const colTitle = (i) => {
  const head = ids['board'].childNodes[i].childNodes[0];
  const titleEl = head.childNodes.find((n) => String(n.className).includes('kcol-title'));
  return titleEl ? titleEl.textContent : '';
};
const cardsOf = (i) => {
  const col = ids['board'].childNodes[i];
  const body = col.childNodes[col.childNodes.length - 1];
  return body.childNodes.filter((c) => c.getAttribute && c.getAttribute('data-task-id') !== null);
};
const findCardMetaTexts = (card) => {
  const body = card.childNodes[1];
  const meta = body.childNodes.find((n) => String(n.className).includes('kcard-meta'));
  return meta ? meta.childNodes.map((n) => n.textContent) : [];
};

(async () => {
  eval(fs.readFileSync(path.join(root, 'kanban/kanban.js'), 'utf8'));
  await wait();

  // 1. Default open: projects mode on Inbox, real To-Do / Doing / Done columns, ignores legacy kanbanGroupMode.
  assert(ids['mode-projects'].classList.contains('active'), 'opens in projects mode (ignores legacy kanbanGroupMode)');
  assert(ids['project-select'].value === '1', 'board opens on Inbox, got ' + ids['project-select'].value);
  assert(calls.listKanbanBuckets.some((c) => c.projectId === 1 && c.viewId === 10), 'loads real buckets/tasks for Inbox view 10');
  assert(ids['board'].childNodes.length === 3, '3 real buckets, got ' + ids['board'].childNodes.length);
  assert(colTitle(0) === 'To-Do' && colTitle(1) === 'Doing' && colTitle(2) === 'Done', 'bucket titles as columns');
  assert(cardsOf(0).length === 1 && cardsOf(0)[0].getAttribute('data-task-id') === '701', '701 in To-Do');

  // 2. True pre-order tree order in #project-select (Autos right after Casa, before Trabajo).
  const projTexts = ids['project-select'].childNodes.map((o) => o.textContent);
  assert(
    projTexts.indexOf('Casa') !== -1 &&
    projTexts.indexOf('\u00A0\u00A0└ Autos') === projTexts.indexOf('Casa') + 1 &&
    projTexts.indexOf('Trabajo') > projTexts.indexOf('\u00A0\u00A0└ Autos'),
    'pre-order project tree in #project-select, got ' + JSON.stringify(projTexts),
  );

  // 3. → nudge and drag-drop in manual kanban call moveTaskToBucket; dropping into done_bucket_id marks done=true.
  const card701 = cardsOf(0)[0];
  const moveWrap701 = card701.childNodes[card701.childNodes.length - 1];
  const rightBtn = moveWrap701.childNodes.find((b) => b.textContent === '→');
  await rightBtn.listeners['click'][0]();
  await flush();
  assert(
    calls.moveTaskToBucket.length === 1 &&
    calls.moveTaskToBucket[0].projectId === 1 &&
    calls.moveTaskToBucket[0].viewId === 10 &&
    calls.moveTaskToBucket[0].bucketId === 102 &&
    calls.moveTaskToBucket[0].taskId === 701,
    '→ nudge calls moveTaskToBucket, got ' + JSON.stringify(calls.moveTaskToBucket[0]),
  );
  assert(cardsOf(1).some((c) => c.getAttribute('data-task-id') === '701'), '701 moved to Doing');

  const card702 = cardsOf(1).find((c) => c.getAttribute('data-task-id') === '702');
  card702.listeners['dragstart'][0]();
  const doneCol = ids['board'].childNodes[2];
  await doneCol.listeners['drop'][0]({ preventDefault() {} });
  await flush();
  const lastBucketMove = calls.moveTaskToBucket[calls.moveTaskToBucket.length - 1];
  assert(lastBucketMove.bucketId === 103 && lastBucketMove.taskId === 702, 'drop calls moveTaskToBucket for Done');
  const card702Done = cardsOf(2).find((c) => c.getAttribute('data-task-id') === '702');
  assert(card702Done && card702Done.classList.contains('done'), 'dropping into done_bucket_id marks card done');

  // 4. Checkbox completion calls completeTask and moves card to done_bucket_id.
  const card701Doing = cardsOf(1).find((c) => c.getAttribute('data-task-id') === '701');
  const check701 = card701Doing.childNodes[0].childNodes[0];
  check701.checked = true;
  await check701.listeners['change'][0](check701);
  assert(calls.completeTask.length === 1 && calls.completeTask[0].id === 701 && calls.completeTask[0].done === true, 'checkbox completes task');
  assert(cardsOf(2).some((c) => c.getAttribute('data-task-id') === '701'), 'completed card moved into Done bucket locally');

  // 5. Pending-only toggle hides completed cards without refetching.
  const fetchesBeforePending = calls.listKanbanBuckets.length;
  ids['pending-toggle'].listeners['click'][0]();
  assert(calls.listKanbanBuckets.length === fetchesBeforePending, 'pending toggle filters locally');
  assert(cardsOf(2).length === 0, 'completed cards hidden in Done when pending-only is active');
  ids['pending-toggle'].listeners['click'][0]();

  // 6. Switching to Vistas GTD (mode-gtd): saved filters only, identifier badge, moveTaskToBucket(-5, 20, ...).
  ids['mode-gtd'].listeners['click'][0]();
  await wait();
  const gtdOptions = ids['project-select'].childNodes.map((o) => o.value);
  assert(gtdOptions.includes('-5') && gtdOptions.includes('-4'), 'GTD mode lists saved filters');
  assert(!gtdOptions.includes('-1') && !gtdOptions.includes('-6') && !gtdOptions.includes('1'), 'excludes -1, non-favorite filters, and real projects');
  assert(ids['project-select'].value === '-5', 'GTD filter listed first');
  assert(colTitle(0) === 'Por aclarar' && colTitle(1) === 'Siguientes acciones', 'GTD buckets loaded');
  const gtdCard = cardsOf(0)[0];
  assert(findCardMetaTexts(gtdCard).includes('CASA-6'), 'identifier badge shown on GTD card');
  const gtdMoveRight = gtdCard.childNodes[gtdCard.childNodes.length - 1].childNodes.find((b) => b.textContent === '→');
  await gtdMoveRight.listeners['click'][0]();
  await flush();
  const gtdMove = calls.moveTaskToBucket[calls.moveTaskToBucket.length - 1];
  assert(gtdMove.projectId === -5 && gtdMove.viewId === 20 && gtdMove.bucketId === 643, 'GTD move uses negative filter id + view 20');

  // 7. Filter-based kanban view (bucket_configuration_mode: 'filter'): read-only notice, non-draggable, no arrows.
  ids['project-select'].listeners['change'][0]({ target: { value: '-4' } });
  await wait();
  assert(ids['view-control'].hidden === false, 'view selector shown for multi-kanban board ANYTYPE · Pendientes');
  ids['view-select'].listeners['change'][0]({ target: { value: '31' } });
  await wait();
  assert(ids['board-notice'].hidden === false, 'filter-based kanban shows read-only notice');
  const roCard = cardsOf(0)[0];
  assert(roCard.draggable === false && roCard.classList.contains('readonly'), 'filter-mode card is non-draggable/readonly');
  assert(!roCard.childNodes.some((c) => String(c.className).includes('kcard-move')), 'no move arrows on readonly card');
  const movesBeforeRoDrop = calls.moveTaskToBucket.length;
  const roCol1 = ids['board'].childNodes[1];
  assert(!roCol1.listeners['drop'], 'readonly columns do not bind drop handler');
  assert(calls.moveTaskToBucket.length === movesBeforeRoDrop, 'filter-mode view cannot move tasks');

  // 8. Parent container project with 0 direct tasks shows kanbanContainerEmptyNotice.
  ids['mode-projects'].listeners['click'][0]();
  await wait();
  ids['project-select'].listeners['change'][0]({ target: { value: '2' } });
  await wait();
  assert(ids['mode-projects'].classList.contains('active'), 'stays in projects mode on empty container project');
  assert(ids['board-notice'].hidden === false && ids['board-notice'].textContent.includes('parent project'), 'shows parent container notice, got ' + ids['board-notice'].textContent);

  // 9. Project with no kanban views shows kanbanNoKanbanView notice without switching to triage.
  ids['project-select'].listeners['change'][0]({ target: { value: '5' } });
  await wait();
  assert(ids['mode-projects'].classList.contains('active'), 'no kanban views stays in projects mode');
  assert(ids['board-notice'].hidden === false && ids['board-notice'].textContent.includes('no kanban view'), 'shows no-kanban notice, got ' + ids['board-notice'].textContent);

  // 10. Mover a proyecto (mode-triage): hides target/view controls, Inbox first, drop PATCHes project_id.
  ids['mode-triage'].listeners['click'][0]();
  await wait();
  assert(ids['target-control'].hidden === true && ids['view-control'].hidden === true, 'triage mode hides target and view controls');
  assert(colTitle(0) === 'Inbox' && colTitle(1) === 'Autos' && colTitle(2) === 'Trabajo', 'triage columns show Inbox + projects with tasks in pre-order');
  const triageInboxCard = cardsOf(0)[0];
  triageInboxCard.listeners['dragstart'][0]();
  const trabajoCol = ids['board'].childNodes[2];
  await trabajoCol.listeners['drop'][0]({ preventDefault() {} });
  await flush();
  assert(calls.updateTask.length === 1 && calls.updateTask[0].patch.project_id === 3, 'triage drop PATCHes project_id');

  // 11. Persists kanbanState.
  const persisted = storage.get('kanbanState');
  assert(persisted && persisted.mode === 'triage' && persisted.gtdId === -4 && persisted.projectId === 5, 'persists kanbanState, got ' + JSON.stringify(persisted));

  if (errors.length) {
    console.log('FAIL');
    errors.forEach((e) => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('KANBAN SMOKE: ALL PASS');
})();
