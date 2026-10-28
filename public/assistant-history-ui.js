function createAssistantHistoryUI({
  element: el,
  request,
  notify,
  capture,
  restore,
  confirmAction,
  download,
  setBusy = () => {}
}) {
  let session = null,
    available = null,
    locked = false,
    working = false,
    unsaved = false,
    sessions = [],
    focusTarget = null;
  const controls = [
    'assistant-new',
    'assistant-title',
    'assistant-rename',
    'assistant-delete',
    'assistant-export',
    'assistant-retry-save'
  ];
  const report = text => {
    el('assistant-save-status').textContent = text;
  };
  function lock(value) {
    locked = value;
    for (const id of controls) el(id).disabled = locked || working;
    el('assistant-delete').disabled ||= !session;
    el('assistant-rename').disabled ||= available !== true;
    drawList();
  }
  function drawList() {
    const rows = sessions.map(s => {
      const row = document.createElement('div');
      row.className = 'assistant-session-row';
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'assistant-session-open';
      openButton.textContent = s.title;
      openButton.title = `${s.title} · ${new Date(s.updatedAt).toLocaleString('tr-TR')}`;
      openButton.setAttribute('aria-current', String(s.id === session?.id));
      openButton.disabled = locked || working;
      openButton.addEventListener('click', () => action(() => openConversation(s.id), 'assistant-new'));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'assistant-session-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${s.title} sohbetini sil`);
      remove.title = 'Sohbeti sil';
      remove.disabled = locked || working;
      remove.addEventListener('click', () => action(() => removeConversation(s.id), 'assistant-new'));
      row.append(openButton, remove);
      return row;
    });
    el('assistant-session-list').replaceChildren(...rows);
    el('assistant-list-empty').hidden = rows.length > 0;
    el('assistant-heading').textContent = session?.title || 'Yeni sohbet';
  }
  async function list() {
    const result = await request('/assistant/sessions');
    available = result.available === true;
    sessions = [...(result.sessions || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (!available)
      report(result.reason || 'Bu hostta kalıcı sohbet kaydı desteklenmiyor; sayfa kapanırsa mesajlar kaybolur.');
    lock(locked);
  }
  async function save() {
    if (available === false) return;
    const snapshot = capture();
    const title =
      el('assistant-title').value.trim() ||
      snapshot.messages.find(m => m.role === 'user')?.content.slice(0, 80) ||
      'Yeni sohbet';
    try {
      if (available === null) await list();
      if (available === false) return;
      report('Sohbet kaydediliyor…');
      session = await request('/assistant/sessions' + (session ? '/' + session.id : ''), {
        method: session ? 'PUT' : 'POST',
        body: JSON.stringify({ ...snapshot, title, revision: session?.revision })
      });
      unsaved = false;
      el('assistant-title').value = session.title;
      report('Kaydedildi · ' + new Date().toLocaleTimeString('tr-TR'));
      // A list refresh failure must not turn a successful save into a failed write/revision.
      await list().catch(() => {});
      return session;
    } catch (error) {
      unsaved = true;
      report('Kaydedilemedi. Mesajlar bu ekranda korunuyor. Kaydı tekrar deneyin veya dışa aktarın. ' + error.message);
      throw error;
    }
  }
  async function newConversation() {
    if (!(await canLeave())) return;
    session = null;
    const config = capture();
    restore({ ...config, messages: [], outputs: [], system: '' });
    focusTarget = 'project-prompt';
    el('assistant-nav').setAttribute?.('data-open', 'false');
    el('assistant-nav-toggle').setAttribute?.('aria-expanded', 'false');
    el('assistant-title').value = '';
    report(available ? 'Yeni sohbet; ilk mesajla birlikte kaydedilir.' : 'Bu hostta sohbet yalnız bu sayfada tutulur.');
    lock(locked);
  }
  async function openConversation(id) {
    if (!(await canLeave())) return;
    const next = await request('/assistant/sessions/' + encodeURIComponent(id));
    session = next;
    unsaved = false;
    restore(next);
    focusTarget = 'project-prompt';
    el('assistant-title').value = next.title;
    report('Kayıt açıldı. Önceki yanıtlar tarihseldir.');
    drawList();
    el('assistant-nav').setAttribute?.('data-open', 'false');
    el('assistant-nav-toggle').setAttribute?.('aria-expanded', 'false');
  }
  async function removeConversation(id) {
    const selected = id === session?.id ? session : await request('/assistant/sessions/' + encodeURIComponent(id));
    if (
      !(await confirmAction(
        `“${selected.title}” sohbet kaydı silinsin mi? Uygulanmış dosyalar değişmez; canlı görevler ve geri alma kayıtları ayrıca yönetilir.`
      ))
    )
      return;
    await request('/assistant/sessions/' + id, {
      method: 'DELETE',
      body: JSON.stringify({ revision: selected.revision })
    });
    if (session?.id === id) {
      unsaved = false;
      await newConversation();
    } else focusTarget = 'assistant-new';
    await list();
  }
  async function canLeave() {
    if (!unsaved) return true;
    try {
      await save();
      return true;
    } catch {
      if (
        !(await confirmAction(
          'Bu ekrandaki son değişiklikler kaydedilemiyor. Önce dışa aktarıp saklayabilirsiniz. Kaydedilmeyen kısmı bırakarak devam edilsin mi? Sunucudaki önceki kayıt korunur.'
        ))
      )
        return false;
      unsaved = false;
      return true;
    }
  }
  async function action(fn, fallbackFocus = null) {
    if (locked || working) return;
    focusTarget = fallbackFocus;
    working = true;
    setBusy(true);
    lock(locked);
    try {
      return await fn();
    } catch (error) {
      notify(error.message, true);
    } finally {
      working = false;
      setBusy(false);
      lock(locked);
      if (focusTarget) {
        el(focusTarget).focus?.();
        focusTarget = null;
      }
    }
  }
  async function init() {
    el('assistant-new').addEventListener('click', () => action(newConversation));
    el('assistant-rename').addEventListener('click', () => action(save));
    el('assistant-retry-save').addEventListener('click', () => action(save));
    el('assistant-delete').addEventListener('click', () =>
      action(async () => {
        if (session) await removeConversation(session.id);
      })
    );
    el('assistant-export').addEventListener('click', () =>
      action(async () => {
        download(
          JSON.stringify(
            {
              format: 'llm-manager-conversation-v1',
              title: el('assistant-title').value,
              exportedAt: new Date().toISOString(),
              ...capture()
            },
            null,
            2
          )
        );
      })
    );
    try {
      await list();
    } catch (error) {
      available = null;
      report('Geçmiş yüklenemedi. Yeni istekten önce kayıt yeniden denenecek. ' + error.message);
    }
  }
  return {
    init,
    save,
    newConversation: () => action(newConversation),
    open: id => action(() => openConversation(id), 'assistant-new'),
    lock,
    current: () => session,
    blocked: () => unsaved
  };
}
if (typeof window !== 'undefined') window.createAssistantHistoryUI = createAssistantHistoryUI;
