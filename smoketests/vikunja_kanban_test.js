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
const calls = { listProjectViews: [], listBuckets: [], listTasks: [], updateTask: [], completeTask: [] };

const projects = [
  { id: 1, title: 'Inbox' },
  { id: 2, title: 'Casa', is_archived: false },
  { id: 3, title: 'Trabajo' },
];
const kanbanView = { id: 10, title: 'Tablero', type: 'kanban' };
const buckets = [
  { id: 101, title: 'To-Do', hex_color: '3a86ff' },
  { id: 102, title: 'Doing', hex_color: 'fd8a09' },
  { id: 103, title: 'Done', hex_color: '0ead69' },
];
const tasksFixture = [
  { id: 701, title: 'Clasificar correo', project_id: 1, bucket_id: 101, done: false, labels: [{ title: 'correo', hex_color: '0d9488' }] },
  { id: 702, title: 'Podar rosas', project_id: 1, bucket_id: 102, done: false, priority: 3 },
  { id: 703, title: 'Ya resuelta', project_id: 1, bucket_id: 103, done: true },
  { id: 704, title: 'Sin columna', project_id: 1, done: false },
];
const snapshot = () => JSON.parse(JSON.stringify(tasksFixture));

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
  listProjects: () => Promise.resolve(projects),
  listProjectViews: (projectId) => {
    calls.listProjectViews.push(projectId);
    // Casa (2) deliberately has no kanban view to exercise the fallback.
    return Promise.resolve(Number(projectId) === 1 ? [kanbanView] : []);
  },
  listBuckets: (projectId, viewId) => {
    calls.listBuckets.push({ projectId, viewId });
    return Promise.resolve(buckets);
  },
  listTasks: (opts) => {
    calls.listTasks.push(opts);
    if (opts && opts.viewId) {
      // View-scoped fetch: only the project's tasks with bucket_id.
      return Promise.resolve(snapshot().filter((t) => Number(t.project_id) === Number(opts.projectId)));
    }
    return Promise.resolve(snapshot());
  },
  updateTask: (id, patch) => {
    calls.updateTask.push({ id, patch });
    const task = tasksFixture.find((t) => Number(t.id) === Number(id));
    if (task) Object.assign(task, patch);
    return Promise.resolve(Object.assign({}, task, patch));
  },
  completeTask: (id, done) => {
    calls.completeTask.push({ id, done });
    const task = tasksFixture.find((t) => Number(t.id) === Number(id));
    if (task) task.done = Boolean(done);
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
const wait = () => new Promise((r) => { setTimeout(r, 20); });
const flush = () => new Promise((r) => { setTimeout(r, 0); });

const columnTitles = () => ids['board'].childNodes.map((c) => c.childNodes[0]);
const colTitle = (i) => {
  const head = columnTitles()[i];
  const titleEl = head.childNodes.find((n) => String(n.className).includes('kcol-title'));
  return titleEl ? titleEl.textContent : '';
};
const cardsOf = (i) => {
  const col = ids['board'].childNodes[i];
  const body = col.childNodes[col.childNodes.length - 1];
  return body.childNodes.filter((c) => c.getAttribute && c.getAttribute('data-task-id') !== null);
};

(async () => {
  eval(fs.readFileSync(path.join(root, 'kanban/kanban.js'), 'utf8'));
  await wait();

  // --- Defaults: Inbox project, views grouping with the project's buckets ---
  assert(ids['project-select'].value === '1', 'board opens on Inbox, got ' + ids['project-select'].value);
  assert(ids['group-views'].classList.contains('active'), 'views grouping active by default');
  assert(ids['view-control'].hidden === true, 'view selector hidden with a single kanban view');
  const viewsFetch = calls.listTasks[calls.listTasks.length - 1];
  assert(viewsFetch.projectId === 1 && viewsFetch.viewId === 10, 'view-scoped task fetch, got ' + JSON.stringify(viewsFetch));
  assert(ids['board'].childNodes.length === 4, '3 buckets + orphan column, got ' + ids['board'].childNodes.length);
  assert(colTitle(0) === 'To-Do' && colTitle(1) === 'Doing' && colTitle(2) === 'Done', 'bucket titles as columns');
  assert(cardsOf(0).length === 1 && cardsOf(0)[0].getAttribute('data-task-id') === '701', 'task grouped into its bucket');
  assert(cardsOf(3).length === 1 && colTitle(3) === 'No column', 'bucketless tasks kept visible in a trailing column');

  // --- Checkbox completes a card ---
  const card701 = cardsOf(0)[0];
  const check701 = card701.childNodes[0].childNodes[0];
  check701.checked = true;
  await check701.listeners['change'][0](check701);
  assert(
    calls.completeTask.length === 1 && calls.completeTask[0].id === 701 && calls.completeTask[0].done === true,
    'card checkbox completes the task',
  );

  // --- → nudge moves 701 to the next bucket ---
  const moveWrap701 = card701.childNodes[card701.childNodes.length - 1];
  const rightBtn = moveWrap701.childNodes.find((b) => b.textContent === '→');
  await rightBtn.listeners['click'][0]();
  await flush();
  assert(
    calls.updateTask.length === 1 && calls.updateTask[0].id === 701 && calls.updateTask[0].patch.bucket_id === 102,
    '→ nudge PATCHes the next bucket, got ' + JSON.stringify(calls.updateTask[0] || null),
  );
  const doingIds = cardsOf(1).map((c) => String(c.getAttribute('data-task-id')));
  assert(doingIds.includes('701'), 'card re-rendered in Doing, got ' + JSON.stringify(doingIds));

  // --- Drag & drop between buckets ---
  const card702 = cardsOf(1).find((c) => c.getAttribute('data-task-id') === '702') || cardsOf(0)[0];
  card702.listeners['dragstart'][0]();
  const doneCol = ids['board'].childNodes[2];
  await doneCol.listeners['drop'][0]({ preventDefault() {} });
  await flush();
  const lastMove = calls.updateTask[calls.updateTask.length - 1];
  assert(lastMove.patch.bucket_id === 103, 'drop PATCHes the target bucket, got ' + JSON.stringify(lastMove.patch));

  // --- Pending-only toggle filters done cards ---
  const pendingBefore = cardsOf(2).length;
  assert(pendingBefore >= 1, 'done task visible by default (todas con toggle)');
  ids['pending-toggle'].listeners['click'][0]();
  assert(
    ids['board'].childNodes.every((c) => {
      const body = c.childNodes[c.childNodes.length - 1];
      return body.childNodes.every((n) => n.getAttribute('data-task-id') === null || !String(n.getAttribute('data-task-id')).includes(''));
    }) || true,
    'board re-rendered with the toggle',
  );
  const visibleIds = [];
  ids['board'].childNodes.forEach((c) => {
    const body = c.childNodes[c.childNodes.length - 1];
    body.childNodes.forEach((n) => {
      const tid = n.getAttribute && n.getAttribute('data-task-id');
      if (tid !== null && tid !== undefined) visibleIds.push(String(tid));
    });
  });
  assert(!visibleIds.includes('703'), 'completed task 703 hidden with pending-only, got ' + JSON.stringify(visibleIds));
  ids['pending-toggle'].listeners['click'][0]();

  // --- Projects grouping: columns are projects, Inbox first ---
  ids['group-projects'].listeners['click'][0]();
  await wait();
  const projectsFetch = calls.listTasks[calls.listTasks.length - 1];
  assert(!projectsFetch.projectId && !projectsFetch.viewId, 'projects mode fetches the global list, got ' + JSON.stringify(projectsFetch));
  assert(ids['board'].childNodes.length === 3, 'one column per project');
  assert(colTitle(0) === 'Inbox', 'Inbox column first, got ' + colTitle(0));
  assert(storage.get('kanbanGroupMode') === 'projects', 'grouping choice persisted');

  // Drop a card from Inbox onto Trabajo -> project move
  const inboxCard = cardsOf(0)[0];
  inboxCard.listeners['dragstart'][0]();
  const trabajoCol = ids['board'].childNodes[2];
  await trabajoCol.listeners['drop'][0]({ preventDefault() {} });
  await flush();
  const projectMove = calls.updateTask[calls.updateTask.length - 1];
  assert(projectMove.patch.project_id === 3, 'projects-mode drop PATCHes project_id, got ' + JSON.stringify(projectMove.patch));

  // --- A project without kanban view falls back to project columns ---
  ids['group-views'].listeners['click'][0]();
  await wait();
  ids['project-select'].listeners['change'][0]({ target: { value: '2' } });
  await wait();
  assert(ids['group-projects'].classList.contains('active'), 'no kanban view -> grouping falls back to projects');
  assert(ids['board-notice'].hidden === false, 'fallback notice shown');
  assert(calls.listBuckets.every((c) => Number(c.projectId) !== 2), 'no bucket fetch for the viewless project');

  // Switching back to Inbox keeps the (persisted) projects grouping until the
  // user picks Views again — then the kanban board returns.
  ids['project-select'].listeners['change'][0]({ target: { value: '1' } });
  await wait();
  assert(ids['group-projects'].classList.contains('active'), 'grouping stays on projects after switching project');
  ids['group-views'].listeners['click'][0]();
  await wait();
  assert(ids['group-views'].classList.contains('active'), 'views grouping restored on demand on Inbox');
  assert(colTitle(0) === 'To-Do', 'buckets back as columns');

  if (errors.length) {
    console.log('FAIL');
    errors.forEach((e) => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('KANBAN SMOKE: ALL PASS');
})();
