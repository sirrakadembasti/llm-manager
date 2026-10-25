import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('YH1-E1: public/llm.html contains all playground UI components', () => {
  const html = fs.readFileSync(path.resolve('public/llm.html'), 'utf8');

  assert.ok(html.includes('id="playground-section"'), 'Playground section exists');
  assert.ok(html.includes('id="playground-profile"'), 'Profile select exists');
  assert.ok(html.includes('id="playground-system"'), 'System textarea exists');
  assert.ok(html.includes('id="playground-user"'), 'User textarea exists');
  assert.ok(html.includes('id="playground-send-btn"'), 'Send button exists');
  assert.ok(html.includes('id="playground-clear-btn"'), 'Clear button exists');
  assert.ok(html.includes('id="playground-stream"'), 'Streaming checkbox exists');
  assert.ok(html.includes('id="playground-output"'), 'Output container exists');
  assert.ok(html.includes('id="playground-meta"'), 'Metadata container exists');
});

test('YH1-E1: public/llm-ui.js playground interactions work and populate profile dropdown', async () => {
  const elements = new Map();
  const listeners = new Map();

  const makeElement = (tag, id = null) => {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className: '',
      textContent: '',
      value: '',
      disabled: false,
      hidden: false,
      checked: true,
      children: [],
      attributes: new Map(),
      get options() {
        return this.children.filter(c => c.tagName === 'OPTION');
      },
      append(...nodes) {
        for (const n of nodes) {
          if (n && typeof n === 'object') {
            if (n.id) elements.set(n.id, n);
            this.children.push(n);
          }
        }
      },
      replaceChildren(...nodes) {
        this.children = [];
        this.append(...nodes);
      },
      before(node) {
        if (node?.id) elements.set(node.id, node);
      },
      setAttribute(k, v) {
        this.attributes.set(k, v);
      },
      removeAttribute(k) {
        this.attributes.delete(k);
      },
      addEventListener(type, fn) {
        listeners.set(`${id || tag}:${type}`, fn);
      },
      trigger(type, event = { preventDefault() {} }) {
        return listeners.get(`${id || tag}:${type}`)?.(event);
      },
      focus() {},
      reset() {}
    };
    if (id) elements.set(id, el);
    return el;
  };

  // Setup DOM fixture
  for (const [id, tag] of [
    ['profiles', 'div'],
    ['fallback-profiles', 'select'],
    ['temperature', 'input'],
    ['top-p', 'input'],
    ['response-format', 'select'],
    ['stop', 'input'],
    ['playground-profile', 'select'],
    ['playground-system', 'textarea'],
    ['playground-user', 'textarea'],
    ['playground-send-btn', 'button'],
    ['playground-clear-btn', 'button'],
    ['playground-stream', 'input'],
    ['playground-output', 'pre'],
    ['playground-meta', 'span'],
    ['message', 'div'],
    ['home-link', 'a'],
    ['profile-count', 'strong'],
    ['active-name', 'strong'],
    ['active-summary', 'section'],
    ['name', 'input'],
    ['provider', 'select'],
    ['base-url', 'input'],
    ['model', 'input'],
    ['model-select', 'select'],
    ['known-models', 'datalist'],
    ['api-key', 'input'],
    ['timeout-ms', 'input'],
    ['max-output-tokens', 'input'],
    ['thinking', 'select'],
    ['profile-form', 'form'],
    ['profile-id', 'input'],
    ['form-title', 'h2'],
    ['api-key-badge', 'span'],
    ['api-key-status', 'div'],
    ['thinking-field', 'div'],
    ['clear-form', 'button']
  ]) {
    makeElement(tag, id);
  }

  let savedInput;
  const fakeFetch = async (url, options = {}) => {
    if (options.method === 'POST' && String(url).endsWith('/profiles')) {
      savedInput = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ id: 'p-1', ...savedInput }) };
    }
    const u = String(url);
    if (u.endsWith('/catalog')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) };
    }
    if (u.endsWith('/profiles')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          activeId: 'p-1',
          profiles: [
            { id: 'p-1', name: 'Profile One', model: 'gpt-4o' },
            { id: 'p-2', name: 'Profile Two', model: 'claude-3-7' }
          ]
        })
      };
    }
    if (u.endsWith('/usage')) {
      return { ok: true, status: 200, json: async () => ({ byProfile: {} }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const context = {
    document: {
      body: { dataset: { apiBase: '/api/llm', homeUrl: '/' } },
      getElementById: id => elements.get(id) || null,
      createElement: tag => makeElement(tag),
      querySelectorAll: () => []
    },
    window: { scrollTo() {}, confirm: () => true },
    fetch: fakeFetch,
    AbortController,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {}
  };

  const script = fs.readFileSync(path.resolve('public/llm-ui.js'), 'utf8');
  vm.runInNewContext(script, context);

  await new Promise(r => setTimeout(r, 40));

  // Verify playground dropdown has been populated
  const pgSelect = elements.get('playground-profile');
  assert.equal(pgSelect.options.length, 2);
  assert.equal(pgSelect.value, 'p-1');

  // Verify clear button works
  elements.get('playground-user').value = 'Test prompt';
  elements.get('playground-system').value = 'Test system';
  elements.get('playground-output').textContent = 'Some output';
  elements.get('playground-meta').textContent = 'Meta';

  elements.get('playground-clear-btn').trigger('click');
  assert.equal(elements.get('playground-user').value, '');
  assert.equal(elements.get('playground-system').value, '');
  assert.equal(elements.get('playground-output').textContent, '');
  assert.equal(elements.get('playground-meta').textContent, '');

  // Saving serializes selected fallback IDs, including an explicit empty list to clear them.
  elements.get('fallback-profiles').options[1].selected = true;
  elements.get('timeout-ms').value = '120000';
  elements.get('max-output-tokens').value = '8192';
  elements.get('thinking').value = 'auto';
  elements.get('api-key').value = 'test-secret';
  elements.get('profile-form').trigger('submit');
  await new Promise(r => setTimeout(r, 40));
  assert.ok(savedInput, elements.get('message').textContent);
  assert.deepEqual(savedInput.fallbackProfileIds, ['p-2']);
  for (const key of ['temperature', 'topP', 'responseFormat', 'stop'])
    assert.equal(savedInput[key], null, 'Blank advanced option must clear ' + key);
  assert.equal(elements.get('api-key').value, '');
  for (const option of elements.get('fallback-profiles').options) option.selected = false;
  elements.get('profile-id').value = '';
  elements.get('profile-form').trigger('submit');
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(savedInput.fallbackProfileIds, []);
});
