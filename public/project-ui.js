/* global $, request, message, t */
function createLLMProjectUI({ element, request, notify, translate }) {
  const el = element;
  const tr = (key, fallback) => translate(`project.${key}`, {}, fallback);
  let state = { enabled: false },
    busy = false,
    sequence = 0,
    currentTask = null;
  const history = [];

  function textNode(tag, content, className) {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function lock(value) {
    busy = value;
    for (const id of ['project-scan', 'project-send']) el(id).disabled = busy || !state.enabled;
    el('project-cancel').disabled = !busy;
    el('project-prompt').disabled = busy || !state.enabled;
    el('project-chat-form').setAttribute('aria-busy', String(busy));
    el('project-mode').disabled = busy || !state.enabled;
    el('project-task-select').disabled = busy;
    el('project-apply').disabled =
      busy || currentTask?.state !== 'proposed' || currentTask?.mode !== 'change' || !currentTask?.files.length;
    el('project-revert').disabled = busy || currentTask?.state !== 'applied';
    el('project-run-command').disabled =
      busy || !currentTask || !(state.commands || []).length || currentTask.state === 'reverted';
    el('project-discard').disabled = busy || !currentTask;
    el('project-approve').disabled = busy;
  }

  function render(next) {
    state = next;
    el('project-review').hidden = !currentTask && !(next.tasks || []).length;
    el('project-name').textContent = next.name || tr('no_project', 'Proje bağlı değil');
    el('project-active-model').textContent = next.activeProfile
      ? `${next.activeProfile.name} · ${next.activeProfile.model}`
      : tr('no_model', 'Önce bir profil etkinleştirin');
    const inventory = next.inventory;
    el('project-status').textContent = !next.enabled
      ? tr(
          'setup',
          'Proje asistanı yapılandırılmadı. Sunucuda LLM_PROJECT_ROOT veya project.root seçeneğiyle kaynak dizinini bağlayın.'
        )
      : inventory
        ? `${inventory.fileCount} ${tr('files', 'kaynak dosyası')} · ${inventory.partial ? tr('partial', 'Tarama sınırlı') : tr('scanned', 'Tarama güncel')} · ${new Date(inventory.scannedAt).toLocaleString('tr-TR')}`
        : tr('scan_first', 'Mimari özeti oluşturmak için projeyi tarayın.');
    el('project-graph-status').textContent =
      {
        ready: tr('graph_ready', 'Yapısal harita hazır'),
        error: tr('graph_error', 'Harita aracı tamamlanamadı; kaynak analizi kullanılabilir')
      }[next.graph?.status] || tr('graph_optional', 'Yapısal harita isteğe bağlı');
    const analysis = next.analysis;
    el('project-stack').replaceChildren(
      ...(analysis?.stack || []).slice(0, 30).map(s => textNode('li', `${s.name} ${s.version} · ${s.path}`))
    );
    el('project-api-list').replaceChildren(
      ...(analysis?.api || [])
        .slice(0, 30)
        .map(a =>
          textNode(
            'li',
            `${a.kind === 'client' ? tr('client', 'İstemci') : a.method} ${a.endpoint} · ${a.path}:${a.line}`
          )
        )
    );
    el('project-database').replaceChildren(
      ...(analysis?.database || [])
        .slice(0, 30)
        .map(d =>
          textNode(
            'li',
            `${d.name}${d.columns.length ? ' · ' + d.columns.map(c => `${c.name} ${c.type}`).join(', ') : ''} · ${d.path}:${d.line}`
          )
        )
    );
    el('project-relationships').replaceChildren(
      ...(analysis?.relationships || [])
        .slice(0, 30)
        .map(r => textNode('li', `${r.from} → ${r.to} (${r.kind === 'http' ? 'HTTP' : tr('import', 'içe aktarma')})`))
    );
    el('project-inventory').replaceChildren(...(inventory?.files || []).slice(0, 100).map(f => textNode('li', f.path)));
    el('project-task-select').replaceChildren(
      textNode('option', tr('choose_task', 'Görev seçin')),
      ...(next.tasks || []).map(task => {
        const option = textNode(
          'option',
          `${task.mode === 'plan' ? tr('plan', 'Plan') : tr('change', 'Değişiklik')} · ${task.fileCount} ${tr('files', 'dosya')} · ${task.createdAt}`
        );
        option.value = task.id;
        return option;
      })
    );
    if (currentTask) el('project-task-select').value = currentTask.id;
    el('project-command').replaceChildren(
      ...(next.commands || []).map(command => {
        const option = textNode('option', `${command.name}: ${command.command} ${(command.args || []).join(' ')}`);
        option.value = command.name;
        return option;
      })
    );
    lock(busy);
  }

  function renderTask(task) {
    currentTask = task;
    el('project-review').hidden = !task && !(state.tasks || []).length;
    el('project-approve').checked = false;
    const labels = {
      proposed: tr('proposed', 'İncelemeye hazır'),
      planned: tr('planned', 'Plan hazır'),
      applied: tr('applied', 'Uygulandı'),
      reverted: tr('reverted', 'Geri alındı')
    };
    el('project-task-state').textContent = task
      ? `${labels[task.state] || task.state} · ${task.profile?.model || ''}`
      : '';
    el('project-task-output').textContent = task?.content || '';
    el('project-diffs').replaceChildren(
      ...(task?.files || []).map(file => {
        const detail = document.createElement('details');
        const columns = document.createElement('div');
        columns.className = 'project-diff-columns';
        for (const [label, content] of [
          [tr('before', 'Önce'), file.before],
          [tr('after', 'Sonra'), file.after]
        ]) {
          const side = document.createElement('div');
          side.append(
            textNode('strong', label),
            textNode('pre', content === null ? tr('absent', 'Dosya yok') : content, 'project-answer')
          );
          columns.append(side);
        }
        detail.append(
          textNode(
            'summary',
            `${file.path} · ${{ create: tr('create', 'Yeni dosya'), update: tr('update', 'Güncelleme'), delete: tr('delete', 'Silme') }[file.kind] || file.kind}`
          ),
          columns
        );
        return detail;
      })
    );
    if (task?.commandResult) renderCommand(task.commandResult);
    else el('project-command-output').textContent = '';
    lock(busy);
  }

  function renderCommand(result) {
    el('project-command-output').textContent =
      `${result.passed ? tr('check_passed', 'Doğrulama başarılı') : tr('check_failed', 'Doğrulama başarısız')} · ${tr('exit_code', 'Çıkış kodu')}: ${result.exitCode}\n${result.output || ''}`;
  }

  async function taskAction(action, name) {
    if (!currentTask || busy) return;
    if (!el('project-approve').checked) {
      notify(tr('review_required', 'Dosya farklarını ve seçili işlemi inceleyip onay kutusunu işaretleyin.'), true);
      return;
    }
    await perform(tr('processing', 'Onaylanan proje işlemi yürütülüyor…'), async () => {
      const result = await request(
        `/project/tasks/${encodeURIComponent(currentTask.id)}/${action}${name ? '/' + encodeURIComponent(name) : ''}`,
        {
          method: 'POST',
          body: JSON.stringify({ approved: true, revision: currentTask.revision })
        }
      );
      el('project-approve').checked = false;
      if (action === 'commands') {
        renderCommand(result);
        if (!result.passed) throw new Error(tr('check_failed', 'Doğrulama başarısız'));
      } else renderTask(action === 'discard' ? null : result);
      await refresh();
    });
  }

  async function refresh() {
    const current = ++sequence;
    try {
      const next = await request('/project');
      if (current === sequence) render(next);
    } catch (error) {
      if (current === sequence) notify(error.message, true);
    }
  }

  async function selectTab(name, focus = false) {
    for (const tab of ['management', 'project']) {
      const selected = tab === name;
      el(`${tab}-panel`).hidden = !selected;
      el(`${tab}-tab`).setAttribute('aria-selected', String(selected));
      el(`${tab}-tab`).tabIndex = selected ? 0 : -1;
    }
    if (focus) el(`${name}-tab`).focus();
    if (name === 'project' && !busy) await refresh();
  }

  async function perform(label, fn) {
    if (busy || !state.enabled) return;
    lock(true);
    notify(label, false, { state: 'loading' });
    try {
      await fn();
      notify(tr('completed', 'Proje işlemi tamamlandı.'), false, { state: 'success' });
    } catch (error) {
      notify(error.message, true, { code: error.code, supportId: error.supportId });
    } finally {
      lock(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    if (!el('project-share').checked) {
      notify(
        tr('consent_required', 'Devam etmek için seçili kaynakların etkin sağlayıcıya gönderilmesini onaylayın.'),
        true
      );
      return;
    }
    const prompt = el('project-prompt').value.trim();
    if (!prompt) return;
    const mode = el('project-mode').value || 'chat';
    if (mode !== 'chat') {
      await perform(tr('preparing', 'OpenCode geçici çalışma kopyasında hazırlanıyor…'), async () => {
        const task = await request('/project/tasks', {
          method: 'POST',
          body: JSON.stringify({ mode, prompt, revision: state.inventory?.revision, shareSources: true })
        });
        renderTask(task);
        await refresh();
      });
      return;
    }
    await perform(tr('answering', 'Proje kaynakları inceleniyor…'), async () => {
      const reply = await request('/project/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          history: history.slice(-10),
          revision: state.inventory?.revision,
          shareSources: true
        })
      });
      el('project-conversation').append(
        textNode('p', `${tr('you', 'Siz')}: ${prompt}`, 'project-user'),
        textNode('pre', reply.content || '', 'project-answer')
      );
      el('project-sources').replaceChildren(
        ...(reply.sources || []).map(s => textNode('li', `${s.path}:${s.startLine}–${s.endLine}`))
      );
      history.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: String(reply.content || '').slice(0, 10000) }
      );
      if (history.length > 12) history.splice(0, history.length - 12);
      el('project-prompt').value = '';
      el('project-context-status').textContent = reply.partial
        ? tr('context_partial', 'Yanıt, seçilmiş kaynak parçalarına dayanır; tüm proje bağlama sığmamış olabilir.')
        : tr('context_ready', 'Kullanılan kaynaklar aşağıda gösteriliyor.');
      await refresh();
    });
  }

  async function init() {
    for (const name of ['management', 'project']) {
      el(`${name}-tab`).addEventListener('click', () => selectTab(name));
      el(`${name}-tab`).addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        return selectTab(
          event.key === 'Home'
            ? 'management'
            : event.key === 'End'
              ? 'project'
              : name === 'management'
                ? 'project'
                : 'management',
          true
        );
      });
    }
    el('project-scan').addEventListener('click', () =>
      perform(tr('scanning', 'Proje yerel olarak taranıyor…'), async () => {
        render(await request('/project/scan', { method: 'POST', body: '{}' }));
      })
    );
    el('project-cancel').addEventListener('click', async () => {
      try {
        await request('/project/cancel', { method: 'POST', body: '{}' });
      } catch (error) {
        notify(error.message, true);
      }
    });
    el('project-clear').addEventListener('click', () => {
      if (busy) return;
      history.length = 0;
      el('project-conversation').replaceChildren();
      el('project-sources').replaceChildren();
      el('project-context-status').textContent = '';
    });
    el('project-chat-form').addEventListener('submit', send);
    el('project-apply').addEventListener('click', () => taskAction('apply'));
    el('project-revert').addEventListener('click', () => taskAction('revert'));
    el('project-discard').addEventListener('click', () => taskAction('discard'));
    el('project-run-command').addEventListener('click', () => taskAction('commands', el('project-command').value));
    el('project-command').addEventListener('change', () => {
      el('project-approve').checked = false;
    });
    el('project-task-select').addEventListener('change', () =>
      perform(tr('loading_task', 'Görev yükleniyor…'), async () => {
        if (el('project-task-select').value)
          renderTask(await request(`/project/tasks/${encodeURIComponent(el('project-task-select').value)}`));
      })
    );
    renderTask(null);
    await selectTab('management');
    await refresh();
  }
  return { init, refresh, selectTab };
}

window.llmProjectUI = createLLMProjectUI({ element: $, request, notify: message, translate: t });
window.llmProjectUI.init().catch(error => message(error.message, true));
