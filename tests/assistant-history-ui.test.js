import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(request, confirmAction = async () => true) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id))
      elements.set(id, {
        value: '',
        textContent: '',
        disabled: false,
        children: [],
        listeners: {},
        focus() {
          this.focused = true;
        },
        addEventListener(k, v) {
          this.listeners[k] = v;
        },
        replaceChildren(...v) {
          this.children = v;
        }
      });
    return elements.get(id);
  };
  const node = () => ({
    textContent: '',
    children: [],
    attributes: {},
    listeners: {},
    append(...v) {
      this.children.push(...v);
    },
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
    addEventListener(k, v) {
      this.listeners[k] = v;
    }
  });
  const context = vm.createContext({ document: { createElement: node } });
  let source = '';
  try {
    source = fs.readFileSync('public/assistant-history-ui.js', 'utf8');
  } catch {}
  vm.runInContext(source, context);
  assert.equal(typeof context.createAssistantHistoryUI, 'function');
  let state = { mode: 'model', profileId: 'p', system: '', messages: [], outputs: [] };
  const ui = context.createAssistantHistoryUI({
    element,
    request,
    notify: () => {},
    capture: () => state,
    restore: v => {
      state = v;
    },
    confirmAction,
    download: () => {}
  });
  return {
    ui,
    element,
    get: () => state,
    set: v => {
      state = v;
    }
  };
}

test('saved conversations restore messages and outputs and a new conversation does not delete the old one', async () => {
  let stored;
  const requests = [];
  const f = fixture(async (route, options = {}) => {
    requests.push([route, options.method]);
    if (route === '/assistant/sessions' && !options.method)
      return { available: true, sessions: stored ? [stored] : [] };
    if (options.method === 'POST' || options.method === 'PUT')
      return (stored = { ...JSON.parse(options.body), id: 'saved', revision: 'r', updatedAt: 'now' });
    return stored;
  });
  await f.ui.init();
  f.set({
    mode: 'chat',
    profileId: 'p',
    system: '',
    messages: [{ role: 'user', content: 'Sipariş?', status: 'completed' }],
    outputs: [{ taskId: 't', state: 'proposed' }]
  });
  await f.ui.save();
  await f.ui.newConversation();
  assert.equal(f.get().messages.length, 0);
  await f.ui.open('saved');
  assert.equal(f.get().messages[0].content, 'Sipariş?');
  assert.equal(f.get().outputs[0].taskId, 't');
  assert.ok(!requests.some(([, method]) => method === 'DELETE'));
});

test('failed history saves retain the draft and retry only storage without sending another model request', async () => {
  let fail = true;
  const f = fixture(async (route, options = {}) => {
    if (!options.method) return { available: true, sessions: [] };
    if (fail) throw new Error('Disk dolu');
    return { ...JSON.parse(options.body), id: 'saved', revision: 'r' };
  });
  await f.ui.init();
  f.get().messages.push({ role: 'assistant', content: 'Korunacak çıktı', status: 'completed' });
  await assert.rejects(f.ui.save(), /Disk dolu/);
  assert.equal(f.get().messages[0].content, 'Korunacak çıktı');
  assert.match(f.element('assistant-save-status').textContent, /kaydedilemedi/i);
  fail = false;
  await f.element('assistant-retry-save').listeners.click();
  assert.equal(f.ui.current().id, 'saved');
});

test('an oversized unsaved record can be explicitly abandoned after export instead of trapping New', async () => {
  const f = fixture(async (_url, options = {}) => {
    if (!options.method) return { available: true, sessions: [] };
    throw new Error('Kayıt sınırı');
  });
  await f.ui.init();
  f.get().messages.push({ role: 'assistant', content: 'Çok uzun', status: 'completed' });
  await assert.rejects(f.ui.save());
  await f.ui.newConversation();
  assert.equal(f.get().messages.length, 0);
});

test('conversation frame opens named rows and deletes only the confirmed row with its revision', async () => {
  const a = {
    id: 'a',
    revision: 'ra',
    title: 'Birinci',
    updatedAt: '2026-10-28T10:00:00Z',
    messages: [],
    outputs: [],
    mode: 'model'
  };
  const b = { ...a, id: 'b', revision: 'rb', title: 'İkinci' };
  let sessions = [a, b];
  const deleted = [];
  const f = fixture(async (url, options = {}) => {
    if (url === '/assistant/sessions') return { available: true, sessions };
    if (options.method === 'DELETE') {
      deleted.push(JSON.parse(options.body));
      sessions = sessions.filter(s => !url.endsWith('/' + s.id));
      return { deleted: true };
    }
    return sessions.find(s => url.endsWith('/' + s.id));
  });
  await f.ui.init();
  let rows = f.element('assistant-session-list').children;
  assert.equal(rows.length, 2);
  await rows[0].children[0].listeners.click();
  assert.equal(f.ui.current().id, 'a');
  assert.equal(f.element('project-prompt').focused, true);
  rows = f.element('assistant-session-list').children;
  assert.equal(rows[0].children[0].attributes['aria-current'], 'true');
  await rows[1].children[1].listeners.click();
  assert.deepEqual(deleted, [{ revision: 'rb' }]);
  assert.equal(f.ui.current().id, 'a');
  assert.equal(f.element('assistant-session-list').children.length, 1);
  assert.equal(f.element('assistant-new').focused, true);
});

test('cancelled row deletion and failed opening return focus to a visible sidebar control', async () => {
  const saved = { id: 'a', title: 'Sohbet', revision: 'r', updatedAt: '2026-10-28' };
  let fail = false;
  const f = fixture(
    async url => {
      if (url === '/assistant/sessions') return { available: true, sessions: [saved] };
      if (fail) throw new Error('Yüklenemedi');
      return saved;
    },
    async () => false
  );
  await f.ui.init();
  await f.element('assistant-session-list').children[0].children[1].listeners.click();
  assert.equal(f.element('assistant-new').focused, true);
  f.element('assistant-new').focused = false;
  fail = true;
  await f.element('assistant-session-list').children[0].children[0].listeners.click();
  assert.equal(f.element('assistant-new').focused, true);
});
