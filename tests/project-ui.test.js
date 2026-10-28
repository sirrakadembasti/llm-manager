import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(request, chatClient) {
  let source = '';
  try {
    source = fs.readFileSync('public/project-ui.js', 'utf8');
  } catch {}
  const elements = new Map();
  function node() {
    return {
      _text: '',
      get textContent() {
        return this._text + this.children.map(n => n.textContent || '').join('');
      },
      set textContent(value) {
        this._text = value;
        this.children = [];
      },
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
    if (
      [
        'assistant-context',
        'project-sources',
        'project-meta',
        'project-context-status',
        'project-source-details',
        'project-clear'
      ].includes(id)
    )
      throw new Error(`Removed chat control accessed: ${id}`);
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  element('project-mode').value = 'chat';
  const notices = [];
  const context = vm.createContext({ document: { createElement: node }, AbortController });
  vm.runInContext(
    fs.readFileSync('public/assistant-history-ui.js', 'utf8') +
      '\n' +
      source.replace(/\nwindow\.llmProjectUI =[\s\S]*$/, ''),
    context
  );
  assert.equal(typeof context.createLLMProjectUI, 'function', 'project tab controller must exist');
  const ui = context.createLLMProjectUI({
    element,
    request,
    chatClient,
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

test('scan information explains Graphify installation, readiness and stale results', async () => {
  let report = ready;
  const { ui, element } = fixture(async () => report);
  await ui.init();
  assert.match(element('project-graph-status').textContent, /kurduktan sonra/);
  report = {
    ...ready,
    graph: { status: 'ready', nodes: [{}], links: [] },
    inventory: { ...ready.inventory, documentCount: 1 }
  };
  await ui.refresh();
  assert.match(element('project-graph-status').textContent, /Graphify algılandı/);
  assert.match(element('project-status').textContent, /1 belge/);
  report = { ...report, graph: { status: 'stale' } };
  await ui.refresh();
  assert.match(element('project-graph-status').textContent, /tekrar tarayın/);
});

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

test('model testing works without a project and keeps profile, system, history and metrics in one composer', async () => {
  const calls = [];
  const { ui, element } = fixture(async () => ({ enabled: false }), {
    send: async input => {
      calls.push(input);
      input.onDelta('<unsafe>');
      return { content: '<unsafe>', usage: { inputTokens: 3, outputTokens: 2 }, durationMs: 10, finishReason: 'stop' };
    }
  });
  await ui.init();
  assert.equal(typeof ui.setProfiles, 'function');
  ui.setProfiles(
    [
      { id: 'a', name: 'A', model: 'one' },
      { id: 'b', name: 'B', model: 'two' }
    ],
    'a'
  );
  element('project-mode').value = 'model';
  element('project-mode').listeners.change();
  element('project-profile').value = 'a';
  element('project-system').value = 'Türkçe yanıtla';
  element('project-prompt').value = 'Merhaba';
  element('project-stream').checked = true;
  assert.equal(element('project-send').disabled, false);
  await element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.equal(calls[0].profileId, 'a');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].messages)), [
    { role: 'system', content: 'Türkçe yanıtla' },
    { role: 'user', content: 'Merhaba' }
  ]);
  assert.equal(calls[0].stream, true);
  assert.match(element('project-conversation').textContent, /5.*token/);
  assert.ok(element('project-conversation').children.some(n => n.textContent.includes('<unsafe>')));
  element('project-profile').value = 'b';
  element('project-profile').listeners.change();
  element('project-prompt').value = 'Yeni profil';
  await element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.ok(!JSON.stringify(calls[1].messages).includes('Merhaba'));
  await element('assistant-new').listeners.click();
  assert.equal(element('project-system').value, '');
  assert.equal(element('project-conversation').textContent, '');
});

test('model stream cancellation aborts locally and never sends a project cancellation request', async () => {
  const paths = [];
  let modelSignal;
  let started;
  const modelStarted = new Promise(resolve => {
    started = resolve;
  });
  const { ui, element } = fixture(
    async url => {
      paths.push(url);
      return { enabled: false };
    },
    {
      send: input =>
        new Promise((resolve, reject) => {
          modelSignal = input.signal;
          started();
          input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
        })
    }
  );
  await ui.init();
  ui.setProfiles([{ id: 'a', name: 'A', model: 'one' }], 'a');
  element('project-mode').value = 'model';
  element('project-mode').listeners.change();
  element('project-prompt').value = 'Yanıtla';
  const pending = element('project-chat-form').listeners.submit({ preventDefault() {} });
  await modelStarted;
  await element('project-cancel').listeners.click();
  await pending;
  assert.equal(modelSignal.aborted, true);
  assert.ok(!paths.includes('/project/cancel'));
  assert.equal(element('project-send').disabled, false);
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
  assert.match(transcript.textContent, /src\/app.js:2/);
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

test('persisted conversations resume after reload and failed or pending answers are excluded from model context', async () => {
  let stored;
  const request = async (url, options = {}) => {
    if (url === '/assistant/sessions' && !options.method) return { available: true, sessions: stored ? [stored] : [] };
    if (url.startsWith('/assistant/sessions') && options.method)
      return (stored = {
        ...JSON.parse(options.body),
        id: 'saved',
        revision: 'one',
        updatedAt: new Date().toISOString()
      });
    if (url === '/assistant/sessions/saved') return stored;
    return { enabled: false };
  };
  const calls = [];
  const client = {
    send: async input => {
      calls.push(input);
      return { content: 'İlk yanıt', usage: null };
    }
  };
  const first = fixture(request, client);
  await first.ui.init();
  first.ui.setProfiles([{ id: 'p', name: 'P', model: 'M' }], 'p');
  first.element('project-mode').value = 'model';
  first.element('project-mode').listeners.change();
  first.element('project-profile').value = 'p';
  first.element('project-prompt').value = 'İlk soru';
  await first.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.equal(stored.messages.length, 2);
  stored.messages.push({ role: 'assistant', content: 'Yarım yanıt', status: 'pending', contextId: stored.contextId });
  const second = fixture(request, client);
  await second.ui.init();
  second.ui.setProfiles([{ id: 'p', name: 'P', model: 'M' }], 'p');
  await second.ui.openConversation('saved');
  assert.ok(second.element('project-conversation').children.some(n => n.textContent.includes('İlk soru')));
  second.element('project-prompt').value = 'Devam';
  await second.element('project-chat-form').listeners.submit({ preventDefault() {} });
  const messages = JSON.stringify(calls.at(-1).messages);
  assert.match(messages, /İlk soru/);
  assert.match(messages, /İlk yanıt/);
  assert.ok(!messages.includes('Yarım yanıt'));
});

test('an applied task stays applied in the UI when the conversation save fails afterwards', async () => {
  let stored,
    fail = false;
  const proposal = {
    id: 't',
    revision: 'one',
    mode: 'change',
    state: 'proposed',
    content: 'Öneri',
    files: [{ path: 'app.js', before: 'a', after: 'b', kind: 'update' }]
  };
  const f = fixture(async (url, options = {}) => {
    if (url === '/assistant/sessions' && !options.method) return { available: true, sessions: stored ? [stored] : [] };
    if (url.startsWith('/assistant/sessions') && options.method) {
      if (fail) throw new Error('Disk dolu');
      return (stored = { ...JSON.parse(options.body), id: 'saved', revision: 'r' });
    }
    if (url.endsWith('/apply')) {
      fail = true;
      return { ...proposal, state: 'applied', revision: 'two' };
    }
    if (url === '/project/tasks') return proposal;
    return ready;
  });
  await f.ui.init();
  f.element('project-mode').value = 'change';
  f.element('project-share').checked = true;
  f.element('project-prompt').value = 'Güncelle';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  f.element('project-approve').checked = true;
  await f.element('project-apply').listeners.click();
  assert.match(f.element('project-task-state').textContent, /Uygulandı/);
  assert.equal(f.element('project-apply').disabled, true);
  assert.equal(f.element('project-revert').disabled, false);
});

test('history navigation locks the composer until the restored session is installed', async () => {
  let resolveOpen, signalOpen;
  const opened = new Promise(resolve => {
    signalOpen = resolve;
  });
  const f = fixture(async url => {
    if (url === '/assistant/sessions')
      return { available: true, sessions: [{ id: 'old', title: 'Old', updatedAt: new Date().toISOString() }] };
    if (url === '/assistant/sessions/old')
      return new Promise(resolve => {
        resolveOpen = resolve;
        signalOpen();
      });
    return ready;
  });
  await f.ui.init();
  f.ui.setProfiles([{ id: 'p', name: 'P', model: 'M' }], 'p');
  f.element('project-mode').value = 'model';
  f.element('project-mode').listeners.change();
  const pending = f.ui.openConversation('old');
  await opened;
  assert.equal(f.element('project-send').disabled, true);
  resolveOpen({ id: 'old', revision: 'r', mode: 'model', profileId: 'p', messages: [], outputs: [], system: '' });
  await pending;
  assert.equal(f.element('project-send').disabled, false);
});

test('a task whose recording failed never supplies a failed answer to the next source request', async () => {
  let stored,
    failOnce = false,
    observed;
  const proposal = {
    id: 't',
    revision: 'r',
    mode: 'plan',
    state: 'planned',
    content: 'Başarısız kaydın cevabı',
    files: []
  };
  const f = fixture(async (url, options = {}) => {
    if (url === '/assistant/sessions' && !options.method) return { available: true, sessions: stored ? [stored] : [] };
    if (url.startsWith('/assistant/sessions') && options.method) {
      if (failOnce) {
        failOnce = false;
        throw new Error('Disk');
      }
      return (stored = { ...JSON.parse(options.body), id: 's', revision: 'r' });
    }
    if (url === '/project/tasks') {
      failOnce = true;
      return proposal;
    }
    if (url === '/project/chat') {
      observed = JSON.parse(options.body).history;
      return { content: 'Yeni cevap' };
    }
    return ready;
  });
  await f.ui.init();
  f.element('project-mode').value = 'plan';
  f.element('project-share').checked = true;
  f.element('project-prompt').value = 'Planla';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  f.element('project-mode').value = 'chat';
  f.element('project-mode').listeners.change();
  f.element('project-share').checked = true;
  f.element('project-prompt').value = 'Devam';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(observed)), []);
});

test('archived outputs after a server restart remain read-only when the live task is missing', async () => {
  const calls = [];
  const archived = {
    id: 'saved',
    title: 'Eski görev',
    mode: 'change',
    profileId: 'p',
    system: '',
    messages: [],
    outputs: [
      {
        taskId: 'gone',
        mode: 'change',
        state: 'applied',
        at: '2026-10-28',
        content: 'Eski öneri',
        files: 'app.js',
        result: ''
      }
    ]
  };
  const f = fixture(async (url, options = {}) => {
    calls.push([url, options.method]);
    if (url === '/assistant/sessions') return { available: true, sessions: [archived] };
    if (url === '/assistant/sessions/saved') return archived;
    if (url === '/project/tasks/gone') throw Object.assign(new Error('Yok'), { code: 'PROJECT_TASK_NOT_FOUND' });
    return ready;
  });
  await f.ui.init();
  await f.ui.openConversation('saved');
  const card = f.element('assistant-output-list').children[0];
  await card.children.at(-1).listeners.click();
  assert.equal(f.element('project-apply').disabled, true);
  assert.equal(f.element('project-revert').disabled, true);
  assert.ok(f.notices.some(n => n[0].includes('yalnız okunabilir')));
  assert.ok(!calls.some(([, method]) => method === 'POST'));
});

test('a server-confirmed source cancellation is archived as cancelled rather than completed or failed', async () => {
  let stored;
  let cancel = false;
  const f = fixture(async (url, options = {}) => {
    if (url === '/assistant/sessions' && !options.method) return { available: true, sessions: stored ? [stored] : [] };
    if (url.startsWith('/assistant/sessions') && options.method)
      return (stored = { ...JSON.parse(options.body), id: 's', revision: 'r' });
    if (url === '/project/chat') {
      if (cancel) throw Object.assign(new Error('İptal edildi'), { code: 'LLM_ABORTED' });
      return { content: 'İlk yanıt', usage: { totalTokens: 99 } };
    }
    return ready;
  });
  await f.ui.init();
  f.element('project-share').checked = true;
  f.element('project-prompt').value = 'Soru';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.match(stored.messages.at(-1).meta, /99 token/);
  cancel = true;
  f.element('project-prompt').value = 'Sonraki soru';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.equal(stored.messages.at(-1).status, 'cancelled');
  assert.equal(stored.messages.at(-1).meta, '');
});

test('assistant replies finish inline without a success banner while provider errors remain visible', async () => {
  let fail = false;
  const f = fixture(async () => ({ enabled: false }), {
    send: async () => {
      if (fail) throw new Error('Sağlayıcı erişilemiyor');
      return { content: 'Yanıt' };
    }
  });
  await f.ui.init();
  f.ui.setProfiles([{ id: 'p', name: 'P', model: 'M' }], 'p');
  f.element('project-mode').value = 'model';
  f.element('project-mode').listeners.change();
  f.element('project-prompt').value = 'Merhaba';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.ok(!f.notices.some(n => n[2]?.state === 'success'));
  fail = true;
  f.element('project-prompt').value = 'Tekrar';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.ok(f.notices.some(n => n[1] === true && n[0].includes('Sağlayıcı')));
});

test('sidebar panels toggle and Escape closes them; Enter respects Shift and IME composition', async () => {
  const f = fixture(async () => ready);
  await f.ui.init();
  f.element('assistant-nav-toggle').listeners.click();
  assert.equal(f.element('assistant-nav').attributes['data-open'], 'true');
  f.element('assistant-nav-close').listeners.click();
  assert.equal(f.element('assistant-nav').attributes['data-open'], 'false');
  assert.equal(f.element('assistant-nav-toggle').focused, true);
  f.element('assistant-info-toggle').listeners.click();
  assert.equal(f.element('project-sidebar').hidden, false);
  f.element('project-panel').listeners.keydown({ key: 'Escape' });
  assert.equal(f.element('project-sidebar').hidden, true);
  assert.equal(f.element('assistant-info-toggle').focused, true);
  assert.equal(f.element('assistant-nav').attributes['data-open'], 'false');
  let submitted = 0;
  f.element('project-chat-form').requestSubmit = () => {
    submitted++;
  };
  const event = { key: 'Enter', preventDefault() {} };
  f.element('project-prompt').listeners.keydown({ ...event, shiftKey: true });
  f.element('project-prompt').listeners.keydown({ ...event, isComposing: true });
  assert.equal(submitted, 0);
  f.element('project-prompt').listeners.keydown(event);
  assert.equal(submitted, 1);
});

test('streaming follows the bottom and preserves manual reading position through completion', async () => {
  let f;
  const client = {
    send: async input => {
      const scroll = f.element('assistant-messages');
      scroll.scrollHeight = 500;
      scroll.clientHeight = 200;
      scroll.scrollTop = 300;
      input.onDelta('Birinci bölüm');
      assert.equal(scroll.scrollTop, 500);
      scroll.scrollHeight = 700;
      scroll.scrollTop = 0;
      input.onDelta(' İkinci bölüm');
      assert.equal(scroll.scrollTop, 0);
      return { content: 'Birinci bölüm İkinci bölüm' };
    }
  };
  f = fixture(async () => ({ enabled: false }), client);
  await f.ui.init();
  f.ui.setProfiles([{ id: 'p', name: 'P', model: 'M' }], 'p');
  f.element('project-mode').value = 'model';
  f.element('project-mode').listeners.change();
  f.element('project-prompt').value = 'Yaz';
  await f.element('project-chat-form').listeners.submit({ preventDefault() {} });
  assert.equal(f.element('assistant-messages').scrollTop, 0);
  assert.ok(!f.notices.some(n => n[1]));
});
