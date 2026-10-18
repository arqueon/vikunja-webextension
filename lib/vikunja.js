(() => {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;
  const { t } = globalThis.I18n || { t: (key, englishDefault) => englishDefault };

  function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  async function getConfig() {
    const stored = await api.storage.sync.get({ baseUrl: '', token: '' });
    return {
      baseUrl: normalizeBaseUrl(stored.baseUrl),
      token: String(stored.token || '').trim(),
    };
  }

  async function getPrefs() {
    const stored = await api.storage.sync.get({
      defaultProjectId: null,
      dueToday: false,
      customFilter: '',
      sortBy: 'position',
      rememberLastSort: false,
      elementReactAfterAdd: false,
      elementTag: '',
      theme: 'auto',
    });
    return {
      defaultProjectId: stored.defaultProjectId || null,
      dueToday: Boolean(stored.dueToday),
      customFilter: String(stored.customFilter || '').trim(),
      sortBy: String(stored.sortBy || 'position'),
      rememberLastSort: Boolean(stored.rememberLastSort),
      elementReactAfterAdd: Boolean(stored.elementReactAfterAdd),
      elementTag: String(stored.elementTag || '').trim(),
      theme: String(stored.theme || 'auto'),
    };
  }

  // baseUrl -> "https://example.com/*", or null for an invalid/empty URL.
  function originPattern(baseUrl) {
    try {
      const origin = new URL(baseUrl).origin;
      return origin ? origin + '/*' : null;
    } catch {
      return null;
    }
  }

  // Matrix Element web instances the user hooked into, each stored as { url }.
  async function getElementInstances() {
    const stored = await api.storage.sync.get({ elementInstances: [] });
    const list = Array.isArray(stored.elementInstances) ? stored.elementInstances : [];
    return list
      .map((inst) => ({ url: normalizeBaseUrl(inst && inst.url) }))
      .filter((inst) => inst.url !== '');
  }

  // Origin match patterns ("https://example.com/*") for the given instances.
  // Used to request permissions, check the granted state and register content
  // scripts. Deliberately kept out of hostPermissionPatterns so the popup and
  // capture window only gate on the Vikunja origin.
  function elementInstancePatterns(instances) {
    return (Array.isArray(instances) ? instances : [])
      .map((inst) => originPattern(inst && inst.url))
      .filter(Boolean);
  }

  // Single source of truth for every host origin the extension needs. Popup,
  // capture and options all derive their permission checks/requests from here,
  // so future hosts (extra instances, a sync server, ...) only need to be
  // appended to this list and every entry point requests them together.
  function hostPermissionPatterns(config) {
    return [originPattern(config && config.baseUrl)].filter(Boolean);
  }

  function hasHostPermissions(patterns) {
    if (!api.permissions || !patterns || patterns.length === 0) {
      return Promise.resolve(true);
    }
    return api.permissions.contains({ origins: patterns });
  }

  // One prompt for all patterns; the browser grants all or none.
  function requestHostPermissions(patterns) {
    if (!api.permissions || !patterns || patterns.length === 0) {
      return Promise.resolve(true);
    }
    return api.permissions.request({ origins: patterns });
  }

  function apiError(url, status, body) {
    const msg = (body && body.detail)
      ? body.detail
      : ((body && body.message) ? body.message : t('errRequestFailed', 'Request failed with status $1', [status]));
    const err = new Error(msg);
    err.status = status;
    err.url = url;
    return err;
  }

  async function rawRequest(path, { method = 'GET', body, token, baseUrl, contentType } = {}) {
    const url = `${baseUrl}/api/v2/${path}`;
    const headers = { Accept: 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = contentType || 'application/json';
    }
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(t('errUnreachable', 'Could not reach Vikunja at $1: $2', [baseUrl, e.message]), { cause: e });
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!res.ok) {
      throw apiError(url, res.status, data);
    }
    return { data, headers: res.headers };
  }

  async function request(path, opts = {}) {
    const { data } = await rawRequest(path, opts);
    return data;
  }

  function parseItems(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    if (data && Array.isArray(data.projects)) {
      return data.projects;
    }
    if (data && Array.isArray(data.result)) {
      return data.result;
    }
    return [];
  }

  async function paginate(path, { token, baseUrl, baseParams = new URLSearchParams() } = {}) {
    const items = [];
    let page = 1;
    let totalPages = 1;
    do {
      const params = new URLSearchParams(baseParams);
      params.set('page', String(page));
      const { data, headers } = await rawRequest(`${path}?${params}`, { token, baseUrl });
      items.push(...parseItems(data));
      if (data && typeof data.total_pages === 'number') {
        totalPages = data.total_pages;
      } else {
        const headerPages = headers.get('x-pagination-total-pages');
        if (headerPages !== null) {
          totalPages = parseInt(headerPages, 10) || 1;
        }
      }
      page += 1;
    } while (page <= totalPages && page <= 50);
    return items;
  }

  // Saved filters surface in the /projects response as pseudo-projects, so the
  // popup's view switcher needs the same list as its project/chip data. The
  // popup opens far more often than the list changes, so the response is cached
  // per instance in session storage and reused until it ages out. Callers that
  // must see fresh state (the options connection test) pass forceRefresh.
  const PROJECTS_CACHE_KEY = 'vikunjaProjects';
  const PROJECTS_CACHE_TTL_MS = 5 * 60 * 1000;

  async function listProjects({ forceRefresh = false } = {}) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    const fetchProjects = () =>
      paginate('projects', {
        token,
        baseUrl,
        baseParams: new URLSearchParams({ per_page: '50' }),
      });
    if (!forceRefresh) {
      try {
        const area = api.storage.session || api.storage.local;
        const stored = await area.get([PROJECTS_CACHE_KEY]);
        const cached = stored && stored[PROJECTS_CACHE_KEY];
        if (
          cached &&
          Array.isArray(cached.items) &&
          cached.baseUrl === baseUrl &&
          Date.now() - cached.ts < PROJECTS_CACHE_TTL_MS
        ) {
          return cached.items;
        }
      } catch (e) {
        // Storage failure falls through to a fresh fetch.
      }
    }
    const projects = await fetchProjects();
    try {
      const area = api.storage.session || api.storage.local;
      await area.set({
        [PROJECTS_CACHE_KEY]: { items: projects, baseUrl, ts: Date.now() },
      });
    } catch (e) {
      // A failed cache write is harmless; the fetch result still stands.
    }
    return projects;
  }

  async function listTasks({ projectId = null, viewId = null, filter = '', sortBy = 'id', orderBy = 'desc' } = {}) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    const baseParams = new URLSearchParams({ per_page: '50' });
    if (sortBy) {
      baseParams.set('sort_by', sortBy);
      baseParams.set('order_by', orderBy || 'asc');
    }
    if (filter) {
      baseParams.set('filter', filter);
    }

    // Position ("manually sorted") is only valid through a project view, so
    // the call switches to the views/tasks endpoint when a view is supplied.
    if (projectId && viewId) {
      return paginate(`projects/${projectId}/views/${viewId}/tasks`, { token, baseUrl, baseParams });
    }
    if (projectId) {
      return paginate(`projects/${projectId}/tasks`, { token, baseUrl, baseParams });
    }
    return paginate('tasks', { token, baseUrl, baseParams });
  }

  async function listProjectViews(projectId) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return paginate(`projects/${projectId}/views`, {
      token,
      baseUrl,
      baseParams: new URLSearchParams({ per_page: '50' }),
    });
  }

  async function createTask(projectId, task) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    // The extension always writes descriptions as markdown (capture and
    // Element permalinks), so the v2 API is asked to interpret them as such
    // instead of its HTML default.
    return request(`projects/${projectId}/tasks?format=markdown`, {
      method: 'POST',
      body: task,
      token,
      baseUrl,
    });
  }

  async function completeTask(id, done = true) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    // v2 PUT is a full replace, so a partial update goes through PATCH with a
    // JSON Merge Patch body (only the fields present are changed).
    return request(`tasks/${id}`, {
      method: 'PATCH',
      contentType: 'application/merge-patch+json',
      body: { done: Boolean(done) },
      token,
      baseUrl,
    });
  }

  async function updateTask(id, patch = {}) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request(`tasks/${id}`, {
      method: 'PATCH',
      contentType: 'application/merge-patch+json',
      body: patch,
      token,
      baseUrl,
    });
  }

  async function deleteTask(id) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request(`tasks/${id}`, {
      method: 'DELETE',
      token,
      baseUrl,
    });
  }

  async function setTaskLabels(taskId, labelIds = []) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request(`tasks/${taskId}/labels/bulk`, {
      method: 'PUT',
      body: { labels: labelIds.map((id) => ({ id: Number(id) })) },
      token,
      baseUrl,
    });
  }

  async function getCurrentUser() {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request('user', { token, baseUrl });
  }

  // The prefix mode the frontend uses for Quick Add Magic, read from the
  // user's frontend settings on the server (no extension setting needed).
  // Values: 'vikunja' | 'todoist' | 'disabled'; anything else → 'vikunja'.
  async function getQuickAddMagicMode() {
    const user = await getCurrentUser();
    const settings = (user && user.settings) || {};
    const frontend = settings.frontend_settings || {};
    const mode = frontend.quick_add_magic_mode;
    if (mode === 'todoist' || mode === 'disabled') {
      return mode;
    }
    return 'vikunja';
  }

  async function listLabels() {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return paginate('labels', {
      token,
      baseUrl,
      baseParams: new URLSearchParams({ per_page: '50' }),
    });
  }

  async function createLabel({ title, hexColor } = {}) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request('labels', {
      method: 'POST',
      body: { title, hex_color: hexColor },
      token,
      baseUrl,
    });
  }

  async function addLabelToTask(taskId, labelId) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request(`tasks/${taskId}/labels`, {
      method: 'POST',
      body: { label_id: labelId },
      token,
      baseUrl,
    });
  }

  // Resolve a label by title, creating it when it does not exist yet. The
  // match is case-insensitive, mirroring the popup's Quick Add Magic handling,
  // so repeated calls never pile up duplicates.
  async function findOrCreateLabel(title) {
    const name = String(title || '').trim();
    if (!name) {
      throw new Error(t('errNoLabelTitle', 'No label title given.'));
    }
    const existing = await listLabels();
    const match = existing.find(
      (l) => l.title && l.title.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      return match;
    }
    return createLabel({ title: name });
  }

  async function addAssigneeToTask(taskId, userId) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    return request(`tasks/${taskId}/assignees`, {
      method: 'POST',
      body: { user_id: userId },
      token,
      baseUrl,
    });
  }

  async function searchProjectUsers(projectId, query) {
    const { baseUrl, token } = await getConfig();
    if (!baseUrl || !token) {
      throw new Error(t('errNotConfigured', 'Vikunja is not configured yet.'));
    }
    const params = new URLSearchParams();
    if (query) {
      params.set('q', query);
    }
    const { data } = await rawRequest(`projects/${projectId}/users?${params}`, {
      token,
      baseUrl,
    });
    return parseItems(data);
  }

  // Build a task from a context menu click and/or tab, Todoist-style:
  // selected text or the page title becomes the title, the URL goes into the
  // description as `[title](url)` markdown.
  function buildTaskContent(info = {}, tab = {}) {
    const selectionText = info.selectionText ? String(info.selectionText) : '';
    const tabUrl = info.linkUrl || tab.url || '';
    const url = String(tabUrl || '').trim();
    let title = selectionText || tab.title || '';
    title = title
      .replace(/(?:https?:\/\/)?(?:www\.)?[^\s]+\.[a-z]{2,}(?:\/[^\s]*)?/gi, '')
      .replace(/\(/g, '[')
      .replace(/\)/g, ']')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) {
      title = String(tab.title || '').trim();
    }
    if (!title) {
      title = t('addTaskFallback', 'Add task');
    }
    const description = url ? `[${title}](${url})` : '';
    return { title, description, url };
  }

  // Mirror the Vikunja frontend's "nearest hour" behaviour so a "today" due
  // date lands on the same rounded time the web app would produce.
  // Shared with lib/quick-add.js so the "due today" default rounds to the same
  // hour as a date the user types explicitly (e.g. "today").
  function calculateNearestHours(currentDate = new Date()) {
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    const isBeforeOrAt = (breakpoint) =>
      hours < breakpoint || (hours === breakpoint && minutes === 0);

    if (isBeforeOrAt(9) || hours > 21) return 9;
    if (isBeforeOrAt(12)) return 12;
    if (isBeforeOrAt(15)) return 15;
    if (isBeforeOrAt(18)) return 18;
    if (isBeforeOrAt(21)) return 21;
    return 9;
  }

  function dueTodayISO(now = new Date()) {
    const date = new Date(now);
    date.setHours(calculateNearestHours(date), 0, 0, 0);
    return date.toISOString();
  }

  function getActiveTab() {
    return api.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => tabs && tabs[0])
      .catch(() => null);
  }

  // The captured content travels to the popup through session storage so it
  // never ends up in a window URL (titles/descriptions can be long). The
  // context-menu and keyboard-shortcut flows open the toolbar popup via
  // action.openPopup; the popup consumes the content on load and switches to
  // its inline capture form.
  const CAPTURE_KEY = 'vikunjaCapture';

  async function storeCaptureContent(content = {}) {
    const area = api.storage.session || api.storage.local;
    await area.set({ [CAPTURE_KEY]: content });
  }

  // Reads the pending capture content and clears it, so a capture is consumed
  // exactly once. Returns null when there is none.
  async function loadCaptureContent() {
    const area = api.storage.session || api.storage.local;
    const stored = await area.get([CAPTURE_KEY]);
    const content = stored && stored[CAPTURE_KEY] ? stored[CAPTURE_KEY] : null;
    if (content) {
      await area.remove(CAPTURE_KEY).catch(() => {});
    }
    return content;
  }

  // Firefox keeps the toolbar popup open when a tab, a window or the options
  // page is opened from it, whereas Chrome closes the popup by itself. Close it
  // explicitly so it does not linger; Chrome's native behavior is left alone.
  // Only ever called from popup/popup.js: calling window.close() from a content
  // script would close the host page.
  function isFirefox() {
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    return /Firefox\//.test(ua);
  }
  function closePopup() {
    if (
      isFirefox() &&
      typeof window !== 'undefined' &&
      typeof window.close === 'function'
    ) {
      window.close();
    }
  }

  // Opens the real toolbar popup with the captured content already filled in.
  // action.openPopup exists on every supported engine (Firefox and Chrome >=
  // 127), so there is no window fallback; the manifest minimum versions
  // guarantee its presence.
  function openCapture(content = {}) {
    return storeCaptureContent(content).then(() => api.action.openPopup());
  }

  globalThis.VikunjaLib = {
    api,
    normalizeBaseUrl,
    getConfig,
    getPrefs,
    getElementInstances,
    elementInstancePatterns,
    hostPermissionPatterns,
    hasHostPermissions,
    requestHostPermissions,
    request,
    listProjects,
    listTasks,
    listProjectViews,
    createTask,
    completeTask,
    updateTask,
    deleteTask,
    setTaskLabels,
    getCurrentUser,
    getQuickAddMagicMode,
    listLabels,
    createLabel,
    addLabelToTask,
    findOrCreateLabel,
    addAssigneeToTask,
    searchProjectUsers,
    buildTaskContent,
    calculateNearestHours,
    dueTodayISO,
    getActiveTab,
    storeCaptureContent,
    loadCaptureContent,
    openCapture,
    closePopup,
    isFirefox,
  };
})();
