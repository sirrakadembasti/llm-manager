const $ = id => document.getElementById(id);
const apiBase = (document.body.dataset.apiBase || '/api/llm').replace(/\/$/, '');
const i18n = (() => {
  try {
    return JSON.parse(document.getElementById('llm-i18n')?.textContent || '{}');
  } catch {
    return {};
  }
})();

function t(key, params = {}, fallback = key) {
  let val = i18n[key] || fallback;
  for (const [k, v] of Object.entries(params)) {
    val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return val;
}

function translateDom() {
  if (typeof document.querySelectorAll !== 'function') return;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = typeof el.getAttribute === 'function' ? el.getAttribute('data-i18n') : null;
    if (key && i18n[key]) {
      el.textContent = i18n[key];
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key && i18n[key]) el.setAttribute('aria-label', t(key));
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = typeof el.getAttribute === 'function' ? el.getAttribute('data-i18n-placeholder') : null;
    if (key && i18n[key]) {
      el.placeholder = i18n[key];
    }
  }
}

let catalog = [],
  profiles = [],
  activeId = null,
  monthlyUsage = null;
let pending = false,
  loadSequence = 0,
  stateVersion = 0;
let editingRevision;
let editingProfile = null;
const disabledBefore = new Map();

const profileTestResults = new Map();

function resultMeta({ code, supportId, durationMs } = {}) {
  return [
    code ? t('dynamic.error_code', { code }) : '',
    supportId ? t('dynamic.support', { id: supportId }) : '',
    Number.isFinite(durationMs) ? t('dynamic.elapsed', { seconds: (durationMs / 1000).toFixed(1) }) : ''
  ]
    .filter(Boolean)
    .join(' · ');
}

function message(text, error = false, details = {}) {
  const state = error ? 'error' : details.state || 'info';
  const panel = $('notification');
  panel.hidden = !text;
  panel.className = `notification ${state}`;
  panel.setAttribute?.('role', error ? 'alert' : 'status');
  panel.setAttribute?.('aria-live', error ? 'assertive' : 'polite');
  $('notification-title').textContent = t(`notice.${state}`);
  $('notification-icon').textContent = { error: '!', success: '✓', loading: '◌', info: 'i' }[state];
  $('notification-meta').textContent = resultMeta(details);
  $('notification-close').hidden = state === 'loading';
  $('message').textContent = details.detail || text;
  $('message').className = error ? 'error' : 'success';
}

async function request(path, options = {}) {
  const { timeoutMs = 330000, signal: callerSignal, ...fetchOptions } = options;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => {
        controller.abort();
        reject(
          new Error(
            t('dynamic.timeout', {}, 'İstek zaman aşımına uğradı. Profil zaman sınırını ve bağlantıyı kontrol edin.')
          )
        );
      },
      Math.min(330000, Math.max(1000, Number(timeoutMs) || 330000))
    );
  });
  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await fetch(`${apiBase}${path}`, {
          credentials: 'same-origin',
          ...fetchOptions,
          signal: callerSignal ? AbortSignal.any([controller.signal, callerSignal]) : controller.signal,
          headers: {
            'content-type': 'application/json',
            ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-LLM-CSRF': '1' } : {}),
            ...fetchOptions.headers
          }
        });
        let body;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        const supportId = body?.requestId || response.headers?.get?.('x-request-id');
        if (!response.ok) {
          const fallback =
            response.status === 401
              ? t('dynamic.session_expired', {}, 'Oturum sona erdi. Yeniden giriş yapın.')
              : t('dynamic.http_error', { status: response.status });
          const detail = typeof body?.error === 'string' ? body.error : fallback;
          const error = new Error(
            `${detail}${body?.code ? ` · ${t('dynamic.error_code', { code: body.code })}` : ''}${supportId ? ` · ${t('dynamic.support', { id: supportId })}` : ''}`
          );
          error.detail = detail;
          error.code = body?.code;
          error.supportId = supportId;
          throw error;
        }
        if (!body || typeof body !== 'object')
          throw new Error(t('dynamic.invalid_json', {}, 'Sunucu geçerli JSON yanıtı döndürmedi.'));
        return body;
      })()
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function lockControls() {
  for (const control of document.querySelectorAll('button, input, select, textarea')) {
    if (control.closest?.('#confirm-dialog') || control.closest?.('#notification')) continue;
    if (!disabledBefore.has(control)) disabledBefore.set(control, control.disabled);
    control.disabled = true;
  }
  $('profile-form').setAttribute('aria-busy', 'true');
}

async function operation(label, action) {
  if (pending) return;
  pending = true;
  stateVersion++;
  lockControls();
  const started = Date.now();
  const progress = () => message(`${label}…`, false, { state: 'loading', durationMs: Date.now() - started });
  progress();
  const timer = setInterval(progress, 1000);
  try {
    const result = await action();
    clearInterval(timer);
    if (result) message(result, false, { state: 'success', durationMs: Date.now() - started });
    else message('');
  } catch (error) {
    clearInterval(timer);
    message(error.message, true, {
      detail: error.detail,
      code: error.code,
      supportId: error.supportId,
      durationMs: Date.now() - started
    });
  } finally {
    clearInterval(timer);
    pending = false;
    for (const [control, disabled] of disabledBefore) control.disabled = disabled;
    disabledBefore.clear();
    $('profile-form').removeAttribute('aria-busy');
  }
}

function button(label, className, action, immediate = false) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  element.addEventListener('click', () => {
    if (pending) return;
    if (immediate) {
      try {
        action();
      } catch (error) {
        message(error.message, true);
      }
    } else operation(label, action);
  });
  return element;
}

function syncModelSelect() {
  const select = $('model-select');
  if (!select) return;
  const current = $('model').value.trim();
  const matches = [...select.options].some(opt => opt.value !== '' && opt.value === current);
  select.value = matches ? current : '';
}

function populateModels(models) {
  const uniqueModels = [...new Set((models || []).filter(Boolean))];
  const list = $('known-models');
  list.replaceChildren();
  for (const model of uniqueModels) {
    const option = document.createElement('option');
    option.value = model;
    list.append(option);
  }

  const select = $('model-select');
  if (!select) return;
  select.replaceChildren();
  select.hidden = uniqueModels.length === 0;
  for (const model of uniqueModels) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = `Model: ${model}`;
    select.append(option);
  }
  const customOption = document.createElement('option');
  customOption.value = '';
  customOption.textContent = t('dynamic.custom_model', {}, 'Özel model kimliği (elle ekleyin / düzenleyin)');
  select.append(customOption);
  syncModelSelect();
}

function updateThinking() {
  const providerId = $('provider').value;
  const providerDef = catalog.find(p => p.id === providerId);
  const canThink =
    providerDef?.capabilities?.thinking === true ||
    ['openai', 'anthropic', 'google', 'qwen', 'xiaomi_mimo', 'deepseek', 'openrouter', 'groq'].includes(providerId);
  $('thinking-field').hidden = !canThink;
  $('thinking-hint').hidden = providerId !== 'xiaomi_mimo';
}

function updateApiKeyFieldState() {
  const input = $('api-key');
  const badge = $('api-key-badge');
  const status = $('api-key-status');
  if (!editingProfile || !editingProfile.hasApiKey) {
    input.required = true;
    input.className = '';
    input.placeholder = t('dynamic.key_placeholder', {}, 'API anahtarını girin');
    if (badge) badge.hidden = true;
    if (status) status.hidden = true;
    return;
  }

  const normalizeUrl = val =>
    String(val || '')
      .trim()
      .replace(/\/+$/, '');
  const targetChanged =
    $('provider').value !== editingProfile.provider ||
    normalizeUrl($('base-url').value) !== normalizeUrl(editingProfile.baseURL);
  const hasNewInput = input.value.trim().length > 0;

  if (hasNewInput) {
    input.required = false;
    input.className = 'updating-key';
    if (badge) {
      badge.hidden = false;
      badge.className = 'key-badge updating';
      badge.textContent = t('dynamic.key_new_badge', {}, '↻ Yeni Anahtar Girildi');
    }
    if (status) {
      status.hidden = false;
      status.className = 'key-status updating';
      status.textContent = t(
        'dynamic.key_new_info',
        {},
        'Yeni API anahtarı girildi. Profili kaydettiğinizde önceki anahtarın üzerine yazılır ve en son girilen bu anahtar şifrelenerek saklanır.'
      );
    }
  } else if (targetChanged) {
    input.required = true;
    input.className = 'warning-key';
    input.placeholder = t('dynamic.key_required_placeholder', {}, 'Yeni sağlayıcı/adres için API anahtarını girin');
    if (badge) {
      badge.hidden = false;
      badge.className = 'key-badge warning';
      badge.textContent = t('dynamic.key_required_badge', {}, '! Yeni Anahtar Gerekli');
    }
    if (status) {
      status.hidden = false;
      status.className = 'key-status warning';
      status.textContent = t(
        'dynamic.key_required_info',
        {},
        'Sağlayıcı veya API temel adresi değiştirildiği için güvenlik gereği yeni API anahtarı girilmelidir.'
      );
    }
  } else {
    input.required = false;
    input.className = 'has-saved-key';
    input.placeholder = t(
      'dynamic.key_saved_placeholder',
      {},
      'Kayıtlı anahtar korunur — değiştirmek için yeni anahtar yazın'
    );
    if (badge) {
      badge.hidden = false;
      badge.className = 'key-badge saved';
      badge.textContent = t('dynamic.key_saved_badge', {}, '✓ Anahtar Kayıtlı (Şifreli)');
    }
    if (status) {
      status.hidden = false;
      status.className = 'key-status saved';
      status.textContent = t(
        'dynamic.key_saved_info',
        {},
        'Bu profilde önceden kaydedilmiş şifreli bir API anahtarı var. Boş bırakırsanız mevcut anahtar korunur; yeni bir anahtar yazarsanız en son girilen anahtar kaydedilir.'
      );
    }
  }
}

function serviceChoices() {
  let select = document.getElementById('llm-service');
  if (!select) {
    select = document.createElement('select');
    select.id = 'llm-service';
    select.className = 'sub-select';
    select.setAttribute('aria-label', t('dynamic.service_label', {}, 'Hizmet / bölge'));
    $('base-url').before(select);
    select.addEventListener('change', () => {
      if (select.value) {
        $('base-url').value = select.value;
      } else {
        $('base-url').focus();
      }
      updateApiKeyFieldState();
    });
  }
  const endpoints = catalog.find(p => p.id === $('provider').value)?.endpoints || [];
  select.replaceChildren();
  select.hidden = !endpoints.length;
  for (const item of [
    ...endpoints,
    { name: t('dynamic.custom_endpoint', {}, 'Özel adres / konsoldaki adres (elle düzenleyin)'), baseURL: '' }
  ]) {
    const option = document.createElement('option');
    option.value = item.baseURL;
    option.textContent = item.name;
    select.append(option);
  }
  select.value = endpoints.some(e => e.baseURL === $('base-url').value) ? $('base-url').value : '';
}

function providerDefaults() {
  const provider = catalog.find(item => item.id === $('provider').value);
  $('base-url').value = provider?.baseURL || '';
  $('model').value = provider?.models?.[0] || '';
  populateModels(provider?.models);
  updateThinking();
  serviceChoices();

  const noteEl = $('provider-note');
  if (noteEl) {
    noteEl.textContent = provider?.note || '';
    noteEl.hidden = !provider?.note;
  }

  updateApiKeyFieldState();
}

let fallbackOrder = [];
function selectedFallbackIds() {
  const selected = [...($('fallback-profiles')?.options || [])].filter(o => o.selected).map(o => o.value);
  return [...fallbackOrder.filter(id => selected.includes(id)), ...selected.filter(id => !fallbackOrder.includes(id))];
}
function populateFallbacks(selected = [], excludeId = $('profile-id').value) {
  const select = $('fallback-profiles');
  if (!select) return;
  fallbackOrder = selected.filter(id => id !== excludeId && profiles.some(p => p.id === id));
  select.replaceChildren();
  for (const profile of profiles.filter(p => p.id !== excludeId)) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = fallbackOrder.includes(profile.id);
    select.append(option);
  }
}

function clearForm() {
  editingRevision = undefined;
  editingProfile = null;
  populateFallbacks([], '');
  $('profile-form').reset();
  $('profile-id').value = '';
  $('api-key').value = '';
  if ($('temperature')) $('temperature').value = '';
  if ($('top-p')) $('top-p').value = '';
  if ($('response-format')) $('response-format').value = '';
  if ($('stop')) $('stop').value = '';
  $('form-title').textContent = t('form.new_title', {}, 'Yeni profil');
  providerDefaults();
}

function editProfile(profile) {
  editingRevision = profile.revision;
  editingProfile = profile;
  if (![...$('provider').options].some(option => option.value === profile.provider)) {
    const option = document.createElement('option');
    option.value = profile.provider;
    option.textContent = profile.provider;
    $('provider').append(option);
  }
  $('profile-id').value = profile.id;
  populateFallbacks(profile.fallbackProfileIds || [], profile.id);
  $('name').value = profile.name;
  $('provider').value = profile.provider;
  $('base-url').value = profile.baseURL;
  $('model').value = profile.model;
  const known = catalog.find(item => item.id === profile.provider)?.models || [];
  populateModels(profile.model && !known.includes(profile.model) ? [profile.model, ...known] : known);
  $('timeout-ms').value = profile.timeoutMs ?? 120000;
  $('max-output-tokens').value = profile.maxOutputTokens ?? 8192;
  $('thinking').value = profile.thinking || 'auto';
  if ($('temperature')) $('temperature').value = profile.temperature ?? '';
  if ($('top-p')) $('top-p').value = profile.topP ?? '';
  if ($('response-format')) $('response-format').value = profile.responseFormat ?? '';
  if ($('stop')) $('stop').value = Array.isArray(profile.stop) ? profile.stop.join(', ') : profile.stop || '';
  updateThinking();
  $('api-key').value = '';
  $('form-title').textContent = t('form.edit_title', { name: profile.name }, `Profili düzenle: ${profile.name}`);
  serviceChoices();
  updateApiKeyFieldState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cloneProfile(profile) {
  clearForm();
  if (![...$('provider').options].some(option => option.value === profile.provider)) {
    const option = document.createElement('option');
    option.value = profile.provider;
    option.textContent = profile.provider;
    $('provider').append(option);
  }
  $('profile-id').value = '';
  editingRevision = undefined;
  editingProfile = null;
  populateFallbacks(profile.fallbackProfileIds || [], '');
  const suffix = t('profiles.clone_suffix', { name: profile.name }, `${profile.name} (Kopya)`);
  $('name').value = suffix;
  $('provider').value = profile.provider;
  $('base-url').value = profile.baseURL;
  $('model').value = profile.model;
  const known = catalog.find(item => item.id === profile.provider)?.models || [];
  populateModels(profile.model && !known.includes(profile.model) ? [profile.model, ...known] : known);
  $('timeout-ms').value = profile.timeoutMs ?? 120000;
  $('max-output-tokens').value = profile.maxOutputTokens ?? 8192;
  $('thinking').value = profile.thinking || 'auto';
  if ($('temperature')) $('temperature').value = profile.temperature ?? '';
  if ($('top-p')) $('top-p').value = profile.topP ?? '';
  if ($('response-format')) $('response-format').value = profile.responseFormat ?? '';
  if ($('stop')) $('stop').value = Array.isArray(profile.stop) ? profile.stop.join(', ') : profile.stop || '';
  updateThinking();
  $('api-key').value = '';
  $('form-title').textContent = t('form.clone_title', { name: profile.name }, `Yeni profil (${profile.name} kopyası)`);
  serviceChoices();
  updateApiKeyFieldState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  message(t('profiles.cloned_msg', {}, 'Profil kopyalandı; yeni bir ad ve API anahtarı girerek kaydedebilirsiniz.'));
}

async function showConfirm(promptText) {
  const dialog = $('confirm-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    return new Promise(resolve => {
      const msgEl = $('confirm-dialog-msg');
      if (msgEl) msgEl.textContent = promptText;
      const cancelBtn = $('confirm-dialog-cancel');
      const onCancel = () => {
        cleanup();
        dialog.close();
        resolve(false);
      };
      const onConfirm = e => {
        e.preventDefault();
        cleanup();
        dialog.close();
        resolve(true);
      };
      const onEscape = e => {
        e.preventDefault();
        onCancel();
      };
      const cleanup = () => {
        dialog.removeEventListener('cancel', onEscape);
        cancelBtn?.removeEventListener('click', onCancel);
        dialog.removeEventListener('submit', onConfirm);
      };
      cancelBtn?.addEventListener('click', onCancel, { once: true });
      dialog.addEventListener('submit', onConfirm, { once: true });
      dialog.addEventListener('cancel', onEscape);
      dialog.showModal();
    });
  }
  return typeof window.confirm === 'function' ? window.confirm(promptText) : true;
}

function lastTestText(profile, mode) {
  const label =
    mode === 'quick'
      ? t('dynamic.test_quick', {}, 'Bağlantı testi')
      : mode === 'conversation'
        ? t('dynamic.test_chat', {}, 'Sohbet testi')
        : t('dynamic.test_last', {}, 'Son test');
  const test = mode
    ? (profile.lastTests?.[mode] ?? ((profile.lastTest?.mode || 'quick') === mode ? profile.lastTest : null))
    : profile.lastTest;
  if (!test) return t('dynamic.not_run', { label });
  const at = new Date(test.at);
  const parts = [
    `${label}: ${test.status === 'passed' ? t('dynamic.test_passed', {}, 'Başarılı') : t('dynamic.test_failed', {}, 'Başarısız')}`
  ];
  if (!mode && test.mode)
    parts.push(
      test.mode === 'conversation'
        ? t('dynamic.test_chat_short', {}, 'Sohbet')
        : t('dynamic.test_quick_short', {}, 'Hızlı bağlantı')
    );
  if (Number.isFinite(test.durationMs)) parts.push(`${(test.durationMs / 1000).toFixed(1)} ${t('dynamic.seconds')}`);
  if (!Number.isNaN(at.getTime())) parts.push(at.toLocaleString('tr-TR'));
  if (test.code) parts.push(t('dynamic.error_code', { code: test.code }));
  return `${parts.join(' · ')}. ${t('dynamic.history')}`;
}

async function testProfile(profile, mode) {
  const started = Date.now();
  const label = t(mode === 'quick' ? 'dynamic.test_quick' : 'dynamic.test_chat');
  profileTestResults.set(profile.id, { state: 'loading', text: `${label}…`, revision: profile.revision ?? null });
  render();
  let failure;
  try {
    const result = await request(`/profiles/${encodeURIComponent(profile.id)}/test`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
      timeoutMs: Math.min(330000, (profile.timeoutMs || 120000) + 30000)
    });
    profileTestResults.set(profile.id, {
      state: 'success',
      text: result.truncated
        ? t('notice.test_truncated')
        : t(mode === 'quick' ? 'notice.test_quick_success' : 'notice.test_chat_success'),
      revision: profile.revision ?? null,
      supportId: result.requestId,
      durationMs: result.durationMs ?? Date.now() - started
    });
  } catch (error) {
    failure = error;
    profileTestResults.set(profile.id, {
      state: 'error',
      revision: profile.revision ?? null,
      text: error.detail || error.message,
      code: error.code,
      supportId: error.supportId,
      durationMs: Date.now() - started
    });
  }
  try {
    await loadProfiles();
  } catch (error) {
    render();
    if (!failure) failure = error;
  }
  if (failure) throw failure;
  return t('dynamic.test_complete', {}, 'Test tamamlandı.');
}

function render() {
  const container = $('profiles');
  container.replaceChildren();
  if (!profiles.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t('profiles.empty', {}, 'Henüz profil yok. İlk profilinizi soldaki formdan ekleyin.');
    container.append(empty);
  }
  for (const profile of profiles) {
    const isActive = profile.id === activeId;
    const path = `/profiles/${encodeURIComponent(profile.id)}`;
    const card = document.createElement('article');
    card.className = `card ${isActive ? 'active' : ''}`;

    const title = document.createElement('h3');
    title.textContent = `${profile.name} · ${isActive ? t('profiles.status_active', {}, 'Etkin') : t('profiles.status_passive', {}, 'Pasif')}`;

    const details = document.createElement('div');
    details.className = 'muted';
    details.textContent = `${profile.provider} · ${profile.model} · ${profile.baseURL} · ${t('form.api_key', {}, 'API anahtarı')}: ${profile.hasApiKey ? t('profiles.key_saved', {}, '✓ kayıtlı (şifreli)') : t('profiles.key_missing', {}, 'eksik')}`;

    const settings = document.createElement('p');
    settings.className = 'muted';
    settings.textContent = `${t('profiles.timeout_prefix', {}, 'Zaman sınırı')}: ${(profile.timeoutMs ?? 120000) / 1000} ${t('dynamic.seconds')} · ${t('profiles.max_tokens_prefix', {}, 'Çıktı sınırı')}: ${profile.maxOutputTokens ?? 8192} token${profile.thinking && profile.thinking !== 'auto' ? ` · ${t('profiles.thinking_prefix', {}, 'Düşünme')}: ${profile.thinking}` : ''}`;

    const testStatus = document.createElement('div');
    testStatus.className = 'muted';
    for (const mode of ['quick', 'conversation']) {
      const result = document.createElement('p');
      result.textContent = lastTestText(profile, mode);
      testStatus.append(result);
    }

    let latestResult = profileTestResults.get(profile.id);
    if (latestResult && latestResult.revision !== (profile.revision ?? null)) {
      profileTestResults.delete(profile.id);
      latestResult = null;
    }
    let resultPanel;
    if (latestResult) {
      const result = document.createElement('div');
      result.className = `profile-result ${latestResult.state}`;
      result.setAttribute('role', 'status');
      const heading = document.createElement('strong');
      heading.textContent = t(`notice.${latestResult.state}`);
      const description = document.createElement('p');
      description.textContent = latestResult.text;
      const metadata = document.createElement('div');
      metadata.className = 'result-meta';
      metadata.textContent = resultMeta(latestResult);
      result.append(heading, description, metadata);
      resultPanel = result;
    }

    const usageStat = document.createElement('p');
    usageStat.className = 'muted usage-stat';
    const profUsage = monthlyUsage?.byProfile?.[profile.id];
    if (profUsage && profUsage.requests > 0) {
      usageStat.textContent = t(
        'profiles.this_month',
        { requests: profUsage.requests.toLocaleString('tr-TR'), tokens: profUsage.totalTokens.toLocaleString('tr-TR') },
        `📊 Bu ay: ${profUsage.requests} istek · ${profUsage.totalTokens} token`
      );
    } else {
      usageStat.textContent = t('profiles.this_month_empty', {}, '📊 Bu ay: Henüz istek yok');
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const activate = button(
      isActive ? t('profiles.btn_activated', {}, 'Etkin') : t('profiles.btn_activate', {}, 'Etkinleştir'),
      '',
      async () => {
        await request(`${path}/activate`, { method: 'POST', body: JSON.stringify({ revision: profile.revision }) });
        await loadProfiles();
        return t('dynamic.activated', { name: profile.name });
      }
    );
    activate.disabled = isActive;

    actions.append(
      button(
        t('profiles.btn_edit', {}, 'Düzenle'),
        'secondary',
        () => {
          editProfile(profile);
        },
        true
      ),
      button(
        t('profiles.btn_clone', {}, 'Klonla'),
        'secondary',
        () => {
          cloneProfile(profile);
        },
        true
      ),
      button(t('profiles.btn_test_quick', {}, 'Bağlantıyı sına'), 'secondary', () => testProfile(profile, 'quick')),
      button(t('profiles.btn_test_conv', {}, 'Sohbeti sına'), 'secondary', () => testProfile(profile, 'conversation')),
      button(t('profiles.btn_fetch_models', {}, 'Modelleri getir'), 'secondary', async () => {
        const result = await request(`${path}/models`, {
          timeoutMs: Math.min(330000, (profile.timeoutMs || 120000) + 30000)
        });
        if ($('profile-id').value !== profile.id) editProfile(profile);
        if (result.models?.length) {
          const current = $('model').value.trim();
          populateModels(current && !result.models.includes(current) ? [current, ...result.models] : result.models);
        }
        $('model').focus();
        return result.models?.length
          ? t('dynamic.models_added', { count: result.models.length })
          : t('dynamic.models_missing', {}, 'Model bulunamadı; kimliği elle girebilirsiniz.');
      }),
      activate,
      button(t('profiles.btn_delete', {}, 'Sil'), 'danger', async () => {
        const promptText = isActive
          ? t(
              'profiles.delete_active_confirm',
              { name: profile.name },
              `${profile.name} etkin profil. Silinirse etkin profil kalmayacak. Silinsin mi?`
            )
          : t('profiles.delete_confirm', { name: profile.name }, `${profile.name} profili silinsin mi?`);
        const confirmed = await showConfirm(promptText);
        if (!confirmed) return;
        await request(path, { method: 'DELETE', body: JSON.stringify({ revision: profile.revision }) });
        if ($('profile-id').value === profile.id) clearForm();
        await loadProfiles();
        return t('profiles.deleted', {}, 'Profil silindi.');
      })
    );
    card.append(title, details, settings);
    if (resultPanel) card.append(resultPanel);
    card.append(usageStat, testStatus, actions);
    container.append(card);
  }

  globalThis.window?.llmProjectUI?.setProfiles(profiles, activeId);
  if (pending) lockControls();
}

async function loadProfiles() {
  const sequence = ++loadSequence;
  const version = stateVersion;
  const [usageRes, result] = await Promise.all([
    request('/usage', { timeoutMs: 15000 }).catch(() => null),
    request('/profiles', { timeoutMs: 30000 })
  ]);
  monthlyUsage = usageRes;
  if (sequence !== loadSequence || version !== stateVersion) return;
  profiles = result.profiles;
  activeId = result.activeId;
  if (editingProfile) {
    const updated = profiles.find(p => p.id === editingProfile.id);
    if (updated) {
      editingProfile = updated;
      editingRevision = updated.revision;
      updateApiKeyFieldState();
    }
  }
  populateFallbacks(selectedFallbackIds());
  render();
}

async function init() {
  $('notification-close')?.addEventListener('click', () => message(''));
  for (const control of document.querySelectorAll('input, select, textarea')) {
    control.addEventListener('invalid', () => {
      control.setAttribute('aria-invalid', 'true');
      message(control.validationMessage, true);
    });
    control.addEventListener('input', () => control.removeAttribute('aria-invalid'));
  }
  translateDom();
  const result = await request('/catalog', { timeoutMs: 30000 });
  catalog = result.providers;
  if ($('catalog-badge') && result.updatedAt) {
    $('catalog-badge').textContent = t(
      'app.catalog_badge',
      { date: result.updatedAt },
      `· Katalog: ${result.updatedAt}`
    );
  }
  for (const provider of catalog) {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = `${provider.name}${provider.region ? ` (${provider.region})` : ''}`;
    $('provider').append(option);
  }
  $('provider').addEventListener('change', providerDefaults);
  $('base-url').addEventListener('input', () => {
    serviceChoices();
    updateApiKeyFieldState();
  });
  $('preview-models-btn')?.addEventListener('click', () => {
    operation(t('dynamic.models_fetching', {}, 'Modeller getiriliyor'), async () => {
      const provider = $('provider').value;
      const baseURL = $('base-url').value;
      const apiKey = $('api-key').value;
      const profileId = $('profile-id').value;
      const res = await request('/models/preview', {
        method: 'POST',
        body: JSON.stringify({ provider, baseURL, apiKey, profileId }),
        timeoutMs: 30000
      });
      if (res.models?.length) {
        populateModels(res.models);
        return t('dynamic.models_listed', { count: res.models.length });
      }
      return t('dynamic.models_empty', {}, 'Model listesi boş döndü.');
    });
  });
  $('model-select')?.addEventListener('change', () => {
    const selected = $('model-select').value;
    if (selected) {
      $('model').value = selected;
    } else {
      $('model').focus();
    }
  });
  $('model').addEventListener('input', syncModelSelect);
  $('api-key').addEventListener('input', updateApiKeyFieldState);
  $('clear-form').addEventListener('click', () => {
    if (!pending) clearForm();
  });

  $('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    operation(t('dynamic.profile_saving', {}, 'Profil kaydediliyor'), async () => {
      const id = $('profile-id').value;
      const input = {
        name: $('name').value,
        provider: $('provider').value,
        model: $('model').value,
        baseURL: $('base-url').value,
        timeoutMs: Number($('timeout-ms').value),
        maxOutputTokens: Number($('max-output-tokens').value),
        thinking: $('thinking').value || 'auto',
        fallbackProfileIds: selectedFallbackIds(),
        temperature: null,
        topP: null,
        responseFormat: null,
        stop: null
      };
      if ($('temperature')?.value !== '') input.temperature = Number($('temperature').value);
      if ($('top-p')?.value !== '') input.topP = Number($('top-p').value);
      if ($('response-format')?.value) input.responseFormat = $('response-format').value;
      if ($('stop')?.value.trim()) {
        input.stop = $('stop')
          .value.split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
      if (id && editingRevision !== undefined) input.revision = editingRevision;
      if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 5000 || input.timeoutMs > 300000) {
        throw new Error(t('dynamic.timeout_invalid', {}, 'Zaman sınırı 5000–300000 ms arasında olmalı.'));
      }
      if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 256 || input.maxOutputTokens > 32768) {
        throw new Error(t('dynamic.tokens_invalid', {}, 'Çıktı sınırı 256–32768 token arasında olmalı.'));
      }
      if ($('api-key').value.trim()) input.apiKey = $('api-key').value.trim();
      const saved = await request(id ? `/profiles/${encodeURIComponent(id)}` : '/profiles', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
        timeoutMs: 30000
      });
      profileTestResults.delete(saved.id);
      await loadProfiles();
      const latestProfile = profiles.find(p => p.id === saved.id) || saved;
      editProfile(latestProfile);
      return input.apiKey
        ? t(
            'dynamic.profile_key_saved',
            {},
            'Profil ve yeni API anahtarı şifrelenerek kaydedildi. Bağlantıyı sınayıp etkinleştirin.'
          )
        : t('dynamic.profile_updated', {}, 'Profil güncellendi (mevcut şifreli API anahtarı korundu).');
    });
  });
  clearForm();
  await loadProfiles();
}
init().catch(error => message(error.message, true));
