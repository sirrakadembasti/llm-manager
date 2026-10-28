import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(request) {
  let source = '';
  try {
    source = fs.readFileSync('public/project-ui.js', 'utf8');
  } catch {}
  const elements = new Map();
  function node() {
    return {
      textContent: '',
      value: '',
      checked: false,
      hidden: false,
      disabled: false,
      children: [],
      attributes: {},
      listeners: {},
      set innerHTML(_value) {
        throw new Error('unsafe HTML rendering');
      },
      append(...items) {
        this.children.push(...items);
      },
      replaceChildren(...items) {
        this.children = items;
      },
      setAttribute(k, v) {
        this.attributes[k] = v;
      },
      getAttribute(k) {
        return this.attributes[k];
      },
      addEventListener(k, v) {
        this.listeners[k] = v;
      },
      focus() {
        this.focused = true;
      }
    };
  }
  const element = id => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const notices = [];
  const context = vm.createContext({ document: { createElement: node }, AbortController });
  vm.runInContext(source.replace(/\nwindow\.llmProjectUI =[\s\S]*$/, ''), context);
  assert.equal(typeof context.createLLMProjectUI, 'function', 'project tab controller must exist');
  const ui = context.createLLMProjectUI({
    element,
    request,
    notify: (...v) => notices.push(v),
    translate: (_key, _values, fallback) => fallback
  });
  return { ui, element, notices };
}

const ready = {
  enabled: true,
  name: 'Örnek uygulama',
  activeProfile: { name: 'Etkin', model: 'fixture' },
  inventory: { revision: 'one', fileCount: 2, partial: false, scannedAt: '2026-10-28T10:00:00Z' },
  analysis: { stack: [], api: [], database: [], files: [] },
  graph: { status: 'unavailable', nodes: [], links: [] },
  capabilities: {}
};

test('project tabs preserve management as default and support keyboard navigation', async () => {
  const { ui, element } = fixture(async () => ready);
  await ui.init();
  assert.equal(element('management-panel').hidden, false);
  assert.equal(element('project-panel').hidden, true);
  assert.equal(element('management-tab').attributes['aria-selected'], 'true');
  await element('management-tab').listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
  assert.equal(element('management-panel').hidden, true);
  assert.equal(element('project-panel').hidden, false);
  assert.equal(element('project-tab').focused, true);
  assert.match(element('project-active-model').textContent, /fixture/);
});

test('project chat requires source consent and renders model output and citations as text', async () => {
  const calls = [];
  const { ui, element } = fixture(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/chat'))
      return {
        content: '<script>unsafe()</script>',
        sources: [{ path: 'src/app.js', startLine: 2, endLine: 4 }],
        revision: 'one'
      };
    return ready;
  });
  await ui.init();
  element('project-prompt').value = 'Uygulamayı açıkla';
  await element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.equal(calls.filter(c => c.url.endsWith('/chat')).length, 0);
  element('project-share').checked = true;
  await element('project-chat-form').listeners.submit({ preventDefault() {} });
  const call = calls.find(c => c.url.endsWith('/chat'));
  assert.equal(JSON.parse(call.options.body).shareSources, true);
  assert.equal(JSON.parse(call.options.body).revision, 'one');
  const transcript = element('project-conversation');
  assert.ok(transcript.children.some(n => n.textContent.includes('<script>unsafe()</script>')));
  assert.ok(element('project-sources').children.some(n => n.textContent.includes('src/app.js:2')));
});

test('project controller locks duplicate actions while allowing cancellation', async () => {
  let finish;
  const { ui, element } = fixture(async url => {
    if (url.endsWith('/scan'))
      return await new Promise(resolve => {
        finish = resolve;
      });
    if (url.endsWith('/cancel')) return { cancelled: true };
    return ready;
  });
  await ui.init();
  const scan = element('project-scan').listeners.click();
  assert.equal(element('project-scan').disabled, true);
  assert.equal(element('project-cancel').disabled, false);
  await element('project-cancel').listeners.click();
  finish(ready);
  await scan;
  assert.equal(element('project-scan').disabled, false);
});

test('unconfigured projects display setup guidance and disable source operations', async () => {
  const { ui, element } = fixture(async () => ({ enabled: false }));
  await ui.init();
  assert.equal(element('project-scan').disabled, true);
  assert.equal(element('project-send').disabled, true);
  assert.match(element('project-status').textContent, /yapılandır/);
});

test('project changes show file differences and require a separate approval before applying', async () => {
  const calls = [];
  const proposal = {
    id: 'task-one',
    revision: 'proposal-one',
    mode: 'change',
    state: 'proposed',
    content: 'Güncelleme hazır',
    files: [{ path: 'src/app.js', before: 'old', after: '<unsafe>new</unsafe>', kind: 'update' }]
  };
  const { ui, element } = fixture(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/apply')) return { ...proposal, state: 'applied', revision: 'applied-two' };
    if (url === '/project/tasks') return proposal;
    return { ...ready, capabilities: { changes: true } };
  });
  await ui.init();
  element('project-mode').value = 'change';
  element('project-share').checked = true;
  element('project-prompt').value = 'İyileştir';
  await element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.ok(!calls.some(c => c.url.endsWith('/apply')));
  assert.equal(element('project-review').hidden, false);
  assert.ok(element('project-diffs').children.length > 0);
  await element('project-apply').listeners.click();
  assert.ok(!calls.some(c => c.url.endsWith('/apply')));
  element('project-approve').checked = true;
  await element('project-apply').listeners.click();
  const call = calls.find(c => c.url.endsWith('/apply'));
  assert.deepEqual(JSON.parse(call.options.body), { approved: true, revision: 'proposal-one' });
  assert.equal(element('project-approve').checked, false);
  assert.equal(element('project-revert').disabled, false);
});
