const $ = id => document.getElementById(id);
const apiBase = (document.body.dataset.apiBase || '/api/llm').replace(/\/$/, '');
let catalog = [], profiles = [], activeId = null;
let pending = false, loadSequence = 0, stateVersion = 0;
let editingRevision;
const disabledBefore = new Map();

function message(text, error = false) {
  $('message').textContent = text;
  $('message').className = error ? 'error' : 'success';
}

async function request(path, options = {}) {
  const { timeoutMs = 330000, ...fetchOptions } = options;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('İstek zaman aşımına uğradı. Profil zaman sınırını ve bağlantıyı kontrol edin.')); }, Math.min(330000, Math.max(1000, Number(timeoutMs) || 330000)));
  });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetch(`${apiBase}${path}`, {
        credentials: 'same-origin', ...fetchOptions, signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-LLM-CSRF': '1' } : {}), ...fetchOptions.headers }
      });
      let body;
      try { body = await response.json(); } catch { body = null; }
      const supportId = body?.requestId || response.headers?.get?.('x-request-id');
      if (!response.ok) {
        const fallback = response.status === 401 ? 'Oturum sona erdi. Yeniden giriş yapın.' : `Sunucu isteği başarısız (HTTP ${response.status}).`;
        const detail = typeof body?.error === 'string' ? body.error : fallback;
        throw new Error(`${detail}${body?.code ? ` · Kod: ${body.code}` : ''}${supportId ? ` · Destek kimliği: ${supportId}` : ''}`);
      }
      if (!body || typeof body !== 'object') throw new Error('Sunucu geçerli JSON yanıtı döndürmedi.');
      return body;
    })()]);
  } finally { clearTimeout(timer); }
}

function lockControls() {
  for (const control of document.querySelectorAll('button, input, select')) {
    if (!disabledBefore.has(control)) disabledBefore.set(control, control.disabled);
    control.disabled = true;
  }
  $('profile-form').setAttribute('aria-busy', 'true');
}

async function operation(label, action) {
  if (pending) return;
  pending = true; stateVersion++; lockControls();
  const started = Date.now();
  const progress = () => message(`${label}… ${((Date.now() - started) / 1000).toFixed(1)} sn`);
  progress();
  const timer = setInterval(progress, 1000);
  try {
    const result = await action();
    clearInterval(timer);
    if (result) message(`${result} · Süre: ${((Date.now() - started) / 1000).toFixed(1)} sn`);
    else message('');
  } catch (error) {
    clearInterval(timer);
    message(`${error.message} · Süre: ${((Date.now() - started) / 1000).toFixed(1)} sn`, true);
  } finally {
    clearInterval(timer); pending = false;
    for (const [control, disabled] of disabledBefore) control.disabled = disabled;
    disabledBefore.clear(); $('profile-form').removeAttribute('aria-busy');
  }
}

function button(label, className, action, immediate = false) {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = label; element.className = className;
  element.addEventListener('click', () => {
    if (pending) return;
    if (immediate) { try { action(); } catch (error) { message(error.message, true); } }
    else operation(label, action);
  });
  return element;
}

function populateModels(models) {
  const list = $('known-models'); list.replaceChildren();
  for (const model of models || []) { const option = document.createElement('option'); option.value = model; list.append(option); }
}

function updateThinking() { $('thinking-field').hidden = $('provider').value !== 'xiaomi_mimo'; }

function serviceChoices() {
  let select=document.getElementById('llm-service');
  if(!select){select=document.createElement('select');select.id='llm-service';select.setAttribute('aria-label','Hizmet / bölge');$('base-url').after(select);select.addEventListener('change',()=>{$('base-url').value=select.value;});}
  const endpoints=catalog.find(p=>p.id===$('provider').value)?.endpoints||[];
  select.replaceChildren();select.hidden=!endpoints.length;
  for(const item of [...endpoints,{name:'Özel adres / konsoldaki adres',baseURL:''}]){const option=document.createElement('option');option.value=item.baseURL;option.textContent=item.name;select.append(option);}
  select.value=endpoints.some(e=>e.baseURL===$('base-url').value)?$('base-url').value:'';
}
function providerDefaults() {
  const provider = catalog.find(item => item.id === $('provider').value);
  populateModels(provider?.models);
  $('base-url').value = provider?.baseURL || '';
  $('model').value = provider?.models?.[0] || '';
  updateThinking(); serviceChoices();
}

function clearForm() {
  editingRevision = undefined;
  $('profile-form').reset(); $('profile-id').value = ''; $('api-key').required = true;
  $('form-title').textContent = 'Yeni profil'; providerDefaults();
}

function editProfile(profile) {
  editingRevision = profile.revision;
  if (![...$('provider').options].some(option => option.value === profile.provider)) {
    const option = document.createElement('option'); option.value = profile.provider; option.textContent = profile.provider; $('provider').append(option);
  }
  $('profile-id').value = profile.id; $('name').value = profile.name; $('provider').value = profile.provider;
  populateModels(catalog.find(item => item.id === profile.provider)?.models);
  $('base-url').value = profile.baseURL; $('model').value = profile.model;
  $('timeout-ms').value = profile.timeoutMs ?? 120000;
  $('max-output-tokens').value = profile.maxOutputTokens ?? 8192;
  $('thinking').value = profile.thinking || 'auto'; updateThinking();
  $('api-key').value = ''; $('api-key').required = false; $('api-key').placeholder='Kayıtlı anahtar korunur; değiştirmek için yeni anahtar girin';
  $('form-title').textContent = `Profili düzenle: ${profile.name}`; serviceChoices();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function lastTestText(profile, mode) {
  const label = mode === 'quick' ? 'Bağlantı testi' : mode === 'conversation' ? 'Sohbet testi' : 'Son test';
  const test = mode ? profile.lastTests?.[mode] ?? ((profile.lastTest?.mode || 'quick') === mode ? profile.lastTest : null) : profile.lastTest;
  if (!test) return `${label}: Yapılmadı`;
  const at = new Date(test.at);
  const parts = [`${label}: ${test.status === 'passed' ? 'Başarılı' : 'Başarısız'}`];
  if (!mode && test.mode) parts.push(test.mode === 'conversation' ? 'Sohbet' : 'Hızlı bağlantı');
  if (Number.isFinite(test.durationMs)) parts.push(`${(test.durationMs / 1000).toFixed(1)} sn`);
  if (!Number.isNaN(at.getTime())) parts.push(at.toLocaleString('tr-TR'));
  if (test.code) parts.push(`Kod: ${test.code}`);
  return `${parts.join(' · ')}. Bu geçmiş sonuç güncel sağlık durumu değildir.`;
}

async function testProfile(profile, mode) {
  let result, failure;
  try { result = await request(`/profiles/${encodeURIComponent(profile.id)}/test`, { method: 'POST', body: JSON.stringify({ mode }), timeoutMs: Math.min(330000, (profile.timeoutMs || 120000) + 30000) }); }
  catch (error) { failure = error; }
  try { await loadProfiles(); } catch (error) { if (!failure) failure = error; }
  if (failure) throw failure;
  return result.message || 'Test tamamlandı.';
}

function render() {
  const active = profiles.find(profile => profile.id === activeId);
  $('profile-count').textContent = String(profiles.length);
  $('active-name').textContent = active?.name || 'Seçilmedi';
  $('active-summary').textContent = active ? `Etkin profil: ${active.name} · ${active.model}. ${lastTestText(active)}` : 'Etkin profil yok. Manager ve ajanların kullanması için bir profili etkinleştirin.';
  const container = $('profiles'); container.replaceChildren();
  if (!profiles.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Henüz profil yok. İlk profilinizi soldaki formdan ekleyin.'; container.append(empty); }
  for (const profile of profiles) {
    const isActive = profile.id === activeId, path = `/profiles/${encodeURIComponent(profile.id)}`;
    const card = document.createElement('article'); card.className = `card ${isActive ? 'active' : ''}`;
    const title = document.createElement('h3'); title.textContent = `${profile.name} · ${isActive ? 'Etkin' : 'Pasif'}`;
    const details = document.createElement('div'); details.className = 'muted'; details.textContent = `${profile.provider} · ${profile.model} · ${profile.baseURL} · Anahtar: ${profile.hasApiKey ? 'kayıtlı' : 'eksik'}`;
    const settings = document.createElement('p'); settings.className = 'muted'; settings.textContent = `Zaman sınırı: ${(profile.timeoutMs ?? 120000) / 1000} sn · Çıktı sınırı: ${profile.maxOutputTokens ?? 8192} token${profile.provider === 'xiaomi_mimo' ? ` · Düşünme: ${profile.thinking || 'auto'}` : ''}`;
    const testStatus = document.createElement('div'); testStatus.className = 'muted';
    for (const mode of ['quick', 'conversation']) {
      const result = document.createElement('p'); result.textContent = lastTestText(profile, mode); testStatus.append(result);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    const activate = button(isActive ? 'Etkin' : 'Etkinleştir', '', async () => { await request(`${path}/activate`, { method: 'POST', body:JSON.stringify({revision:profile.revision}) }); await loadProfiles(); return `${profile.name} etkin.`; });
    activate.disabled = isActive;
    actions.append(
      button('Düzenle', 'secondary', () => { editProfile(profile); }, true),
      button('Bağlantıyı sına', 'secondary', () => testProfile(profile, 'quick')),
      button('Sohbeti sına', 'secondary', () => testProfile(profile, 'conversation')),
      button('Modelleri getir', 'secondary', async () => {
        const result = await request(`${path}/models`, { timeoutMs: Math.min(330000, (profile.timeoutMs || 120000) + 30000) });
        editProfile(profile); populateModels(result.models); $('model').focus();
        return result.models.length ? `${result.models.length} model seçeneklere eklendi. Model alanından seçebilirsiniz.` : 'Model bulunamadı; kimliği elle girebilirsiniz.';
      }), activate,
      button('Sil', 'danger', async () => {
        if (!window.confirm(isActive ? `${profile.name} etkin profil. Silinirse etkin profil kalmayacak. Silinsin mi?` : `${profile.name} profili silinsin mi?`)) return;
        await request(path, { method: 'DELETE', body:JSON.stringify({revision:profile.revision}) }); if ($('profile-id').value === profile.id) clearForm(); await loadProfiles(); return 'Profil silindi.';
      })
    );
    card.append(title, details, settings, testStatus, actions); container.append(card);
  }
  if (pending) lockControls();
}

async function loadProfiles() {
  const sequence = ++loadSequence, version = stateVersion;
  const result = await request('/profiles', { timeoutMs: 30000 });
  if (sequence !== loadSequence || version !== stateVersion) return;
  profiles = result.profiles; activeId = result.activeId; render();
}

async function init() {
  $('home-link').href = document.body.dataset.homeUrl || '/';
  const result = await request('/catalog', { timeoutMs: 30000 }); catalog = result.providers;
  for (const provider of catalog) { const option = document.createElement('option'); option.value = provider.id; option.textContent = `${provider.name}${provider.region ? ` (${provider.region})` : ''}`; $('provider').append(option); }
  $('provider').addEventListener('change', providerDefaults);
  $('clear-form').addEventListener('click', () => { if (!pending) clearForm(); });
  $('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    operation('Profil kaydediliyor', async () => {
      const id = $('profile-id').value;
      const input = { name: $('name').value, provider: $('provider').value, model: $('model').value, baseURL: $('base-url').value, timeoutMs: Number($('timeout-ms').value), maxOutputTokens: Number($('max-output-tokens').value), thinking: $('provider').value === 'xiaomi_mimo' ? $('thinking').value : 'auto' };
      if (id && editingRevision !== undefined) input.revision = editingRevision;
      if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 5000 || input.timeoutMs > 300000) throw new Error('Zaman sınırı 5000–300000 ms arasında olmalı.');
      if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 256 || input.maxOutputTokens > 32768) throw new Error('Çıktı sınırı 256–32768 token arasında olmalı.');
      if ($('api-key').value) input.apiKey = $('api-key').value;
      await request(id ? `/profiles/${encodeURIComponent(id)}` : '/profiles', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input), timeoutMs: 30000 });
      clearForm(); await loadProfiles(); return 'Profil kaydedildi. Bağlantıyı sınayıp etkinleştirin.';
    });
  });
  clearForm(); await loadProfiles();
}
init().catch(error => message(error.message, true));
