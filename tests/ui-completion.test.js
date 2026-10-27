import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('public/llm-ui.js', 'utf8').replace(/init\(\)\.catch[\s\S]*$/, '');
function ui(locale = 'en') {
  const elements = new Map();
  const translatedElements = [];
  const element = id => {
    if (!elements.has(id))
      elements.set(id, {
        value: '',
        textContent: '',
        options: [],
        setAttribute() {},
        removeAttribute() {},
        append(...children) {
          this.options.push(...children);
        },
        replaceChildren() {
          this.options = [];
        },
        reset() {},
        addEventListener() {},
        focus() {}
      });
    return elements.get(id);
  };
  element('llm-i18n').textContent = fs.readFileSync(`public/i18n/${locale}.json`, 'utf8');
  const html = fs.readFileSync('public/llm.html', 'utf8');
  for (const [index, match] of [...html.matchAll(/<([\w-]+)\b([^>]*\bdata-i18n="([^"]+)"[^>]*)>([^<]*)/g)].entries()) {
    const [, , attributes, key, text] = match;
    const el = element(attributes.match(/\bid="([^"]+)"/)?.[1] || `translation-${index}`);
    el.hidden = /\bhidden\b/.test(attributes);
    el.textContent = text;
    el.getAttribute = name => (name === 'data-i18n' ? key : null);
    translatedElements.push(el);
  }
  const context = vm.createContext({
    document: {
      body: { dataset: { locale } },
      getElementById: element,
      createElement: () => element(Symbol()),
      querySelectorAll: selector => (selector === '[data-i18n]' ? translatedElements : [])
    },
    window: { scrollTo() {} }
  });
  vm.runInContext(source, context);
  return {
    element,
    translated: key => translatedElements.find(el => el.getAttribute('data-i18n') === key),
    run: code => vm.runInContext(code, context)
  };
}

test('notifications distinguish progress, information and errors while separating technical details', () => {
  const { element, run } = ui('en');
  run("message('Checking', false, { state: 'loading' })");
  assert.equal(element('notification').className, 'notification loading');
  assert.equal(element('notification-title').textContent, 'In progress');
  run(
    "message('<unsafe text>', true, { detail: 'Check billing.', code: 'LLM_BILLING', supportId: 'support-123', durationMs: 1200 })"
  );
  assert.equal(element('message').textContent, 'Check billing.');
  assert.equal(element('notification-title').textContent, 'Action failed');
  assert.match(element('notification-meta').textContent, /LLM_BILLING/);
  assert.match(element('notification-meta').textContent, /support-123/);
  assert.match(element('notification-meta').textContent, /1\.2/);
  run("message('<unsafe text>')");
  assert.equal(element('message').textContent, '<unsafe text>');
  assert.equal(element('notification').className, 'notification info');
  run("message('')");
  assert.equal(element('notification').hidden, true);
});

test('failed test stays on the affected profile card after profiles refresh', async () => {
  const { element, run } = ui('en');
  await run(`
    profiles = [{ id: 'a', name: 'A', provider: 'google', model: 'm' }, { id: 'b', name: 'B', provider: 'google', model: 'n' }];
    request = async () => { const error = new Error('Check billing.'); error.code = 'LLM_BILLING'; error.supportId = 'support-123'; throw error; };
    loadProfiles = async () => render();
    testProfile(profiles[0], 'quick').catch(() => {});
  `);
  const cards = element('profiles').options;
  const result = cards[0].options.find(child => child.className === 'profile-result error');
  assert.ok(result, 'the tested card must retain its result');
  assert.ok(result.options.some(child => child.textContent.includes('Check billing.')));
  assert.equal(
    cards[1].options.some(child => child.className === 'profile-result error'),
    false
  );
  run('render()');
  assert.ok(element('profiles').options[0].options.some(child => child.className === 'profile-result error'));
});

test('English success uses translated copy instead of the server Turkish message', async () => {
  const { element, run } = ui('en');
  await run(`
    profiles = [{ id: 'a', name: 'A', provider: 'google', model: 'm', revision: 'one' }];
    request = async () => ({ message: 'Kısa bağlantı ve model yanıtı doğrulandı.', durationMs: 1200 });
    loadProfiles = async () => render();
    testProfile(profiles[0], 'quick');
  `);
  const result = element('profiles').options[0].options.find(child => child.className === 'profile-result success');
  assert.ok(result.options.some(child => child.textContent === 'Connection and model response verified.'));
});

test('an external profile revision change clears the old test result', async () => {
  const { element, run } = ui('en');
  await run(`
    profiles = [{ id: 'a', name: 'A', provider: 'google', model: 'm', revision: 'one' }];
    request = async () => ({ ok: true, durationMs: 1200 });
    loadProfiles = async () => render();
    testProfile(profiles[0], 'quick');
  `);
  assert.ok(element('profiles').options[0].options.some(child => child.className === 'profile-result success'));
  run("profiles[0] = { ...profiles[0], model: 'changed-model', revision: 'two' }; render()");
  assert.equal(
    element('profiles').options[0].options.some(child => child.className === 'profile-result success'),
    false
  );
});

test('MiMo test-policy hint follows provider switches and remains scoped after Turkish/English translation', () => {
  for (const locale of ['tr', 'en']) {
    const { element, translated, run } = ui(locale);
    const hint = translated('form.thinking_hint');
    for (const provider of [
      'xiaomi_mimo',
      'google',
      'openai',
      'anthropic',
      'qwen',
      'deepseek',
      'openrouter',
      'groq',
      'custom',
      'xiaomi_mimo'
    ]) {
      element('provider').value = provider;
      run('updateThinking(); translateDom();');
      assert.equal(element('thinking-field').hidden, provider === 'custom', `${locale}/${provider}: reasoning control`);
      assert.equal(hint.hidden, provider !== 'xiaomi_mimo', `${locale}/${provider}: MiMo-only policy hint`);
      assert.equal(
        hint.textContent,
        locale === 'tr'
          ? 'Otomatik mod; testlerde düşünmeyi kapatır, normal çağrılarda modelin varsayılanını kullanır.'
          : 'Automatic mode disables reasoning in tests and uses the model default for normal calls.'
      );
    }
    run("catalog = [{id: 'custom', capabilities: {thinking: true}}]");
    element('provider').value = 'custom';
    run('updateThinking(); translateDom();');
    assert.equal(element('thinking-field').hidden, false, 'catalog reasoning capability remains supported');
    assert.equal(hint.hidden, true);
  }
});
test('fallback selector restores edit selection, excludes self, and preserves clone configuration without secrets', () => {
  const { element, run } = ui();
  run(`profiles = [{id:'a', name:'A'}, {id:'b', name:'B'}, {id:'c', name:'C'}]; catalog = [];`);
  run(
    `editProfile({id:'a', name:'A', provider:'x', model:'m', baseURL:'https://example.com', fallbackProfileIds:['c','b'], hasApiKey:true})`
  );
  assert.deepEqual(
    element('fallback-profiles').options.map(o => o.value),
    ['b', 'c']
  );
  assert.deepEqual(Array.from(run('selectedFallbackIds()')), ['c', 'b']);
  run(
    `cloneProfile({id:'a', name:'A', provider:'x', model:'m', baseURL:'https://example.com', fallbackProfileIds:['c','b'], hasApiKey:true})`
  );
  assert.deepEqual(Array.from(run('selectedFallbackIds()')), ['c', 'b']);
  assert.equal(element('api-key').value, '');
  assert.equal(element('api-key').required, true);
  run('clearForm()');
  assert.deepEqual(Array.from(run('selectedFallbackIds()')), []);
});
test('dynamic English UI messages and historical status are translated', () => {
  const { element, run } = ui();
  run('updateApiKeyFieldState()');
  assert.equal(element('api-key').placeholder, 'Enter API key');
  assert.equal(run(`lastTestText({}, 'quick')`), 'Connection test: Not run');
  assert.match(run(`lastTestText({lastTest:{status:'passed',code:'OK',at:'2026-01-01'} })`), /Passed.*Code: OK/);
});
test('every literal translation key has matching tr/en dictionary entries', () => {
  const tr = JSON.parse(fs.readFileSync('public/i18n/tr.json'));
  const en = JSON.parse(fs.readFileSync('public/i18n/en.json'));
  for (const [, key] of source.matchAll(/\bt\('([^']+)'/g)) {
    assert.ok(tr[key], `missing Turkish ${key}`);
    assert.ok(en[key], `missing English ${key}`);
  }
});

test('confirmation Escape resolves cancellation and removes dialog listeners', async () => {
  const { element, run } = ui();
  const dialog = element('confirm-dialog');
  const listeners = new Map();
  dialog.addEventListener = (event, fn) => listeners.set(event, fn);
  dialog.removeEventListener = event => listeners.delete(event);
  dialog.showModal = () => {};
  dialog.close = () => {};
  const cancel = element('confirm-dialog-cancel');
  cancel.addEventListener = () => {};
  cancel.removeEventListener = () => {};
  const result = run("showConfirm('Delete?')");
  listeners.get('cancel')({ preventDefault() {} });
  assert.equal(await result, false);
  assert.equal(listeners.size, 0);
});

test('confirmation remains usable while an operation locks other form controls', async () => {
  const { element, run } = ui();
  const dialog = element('confirm-dialog');
  const confirm = element('confirm-dialog-confirm');
  const cancel = element('confirm-dialog-cancel');
  const other = element('name');
  for (const button of [confirm, cancel]) {
    button.disabled = false;
    button.closest = () => dialog;
  }
  other.closest = () => null;
  run(
    "document.querySelectorAll = () => [document.getElementById('confirm-dialog-confirm'), document.getElementById('confirm-dialog-cancel'), document.getElementById('name')]; pending = true; lockControls();"
  );
  assert.equal(other.disabled, true);
  assert.equal(confirm.disabled, false);
  assert.equal(cancel.disabled, false);
  const listeners = new Map();
  dialog.addEventListener = (event, fn) => listeners.set(event, fn);
  dialog.removeEventListener = event => listeners.delete(event);
  cancel.addEventListener = () => {};
  cancel.removeEventListener = () => {};
  dialog.showModal = () => {};
  dialog.close = () => {};
  const result = run("showConfirm('Delete?')");
  listeners.get('submit')({ preventDefault() {} });
  assert.equal(await result, true);
});

test('monthly usage response renders nonzero per-profile request and token counts in both locales', async () => {
  for (const locale of ['tr', 'en']) {
    const { element, run } = ui(locale);
    await run(`
      request = async path => path === '/usage'
        ? { byProfile: { a: { requests: 7, totalTokens: 83 }, b: { requests: 2, totalTokens: 19 } } }
        : { profiles: [{id:'a',name:'A',provider:'openai',model:'m'}, {id:'b',name:'B',provider:'openai',model:'n'}, {id:'c',name:'C',provider:'openai',model:'o'}], activeId:'a' };
      loadProfiles();
    `);
    const labels = element('profiles').options.map(
      card => card.options.find(child => child.className === 'muted usage-stat').textContent
    );
    assert.deepEqual(
      labels,
      locale === 'tr'
        ? ['📊 Bu ay: 7 istek · 83 token', '📊 Bu ay: 2 istek · 19 token', '📊 Bu ay: Henüz istek yok']
        : [
            '📊 This month: 7 requests · 83 tokens',
            '📊 This month: 2 requests · 19 tokens',
            '📊 This month: No requests yet'
          ]
    );
  }
});
