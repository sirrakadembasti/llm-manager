/* global $, request, message, t, apiBase, createLLMChatClient, createAssistantHistoryUI, showConfirm */
function createLLMProjectUI({
  element,
  request,
  notify,
  translate,
  chatClient,
  confirmAction = async () => false,
  download = () => {}
}) {
  const el = element;
  const tr = (key, fallback) => translate(`project.${key}`, {}, fallback);
  let state = { enabled: false },
    busy = false,
    sequence = 0,
    currentTask = null,
    profiles = [],
    activeId = null,
    controller = null,
    runningModel = false,
    modelSession = '';
  const history = [];
  const modelHistory = [];
  let transcript = [],
    outputs = [],
    contextId = `${Date.now()}-${Math.random()}`,
    lastMessageBody = null,
    responseMeta = '';
  const historyUI = createAssistantHistoryUI({
    element: el,
    request,
    notify,
    confirmAction,
    download,
    setBusy: value => lock(value),
    capture: () => ({
      mode: el('project-mode').value || 'model',
      profileId: el('project-profile').value || '',
      system: el('project-system').value,
      contextId,
      modelContext: modelSession,
      messages: transcript,
      outputs
    }),
    restore: restoreConversation
  });
  const modelMode = () => (el('project-mode').value || 'model') === 'model';
  function completedContext() {
    const result = [];
    for (let i = 0; i < transcript.length - 1; i++) {
      const user = transcript[i],
        answer = transcript[i + 1];
      if (
        user.role === 'user' &&
        answer.role === 'assistant' &&
        user.status === 'completed' &&
        answer.status === 'completed' &&
        user.contextId === contextId &&
        answer.contextId === contextId
      )
        result.push(
          { role: 'user', content: user.content.slice(0, 10000) },
          { role: 'assistant', content: answer.content.slice(0, 10000) }
        );
    }
    return result.slice(-10);
  }

  function nearBottom() {
    const scroll = el('assistant-messages');
    return (scroll.scrollHeight || 0) - (scroll.scrollTop || 0) - (scroll.clientHeight || 0) < 80;
  }
  function renderTranscript(forceScroll = true) {
    const scroll = el('assistant-messages'),
      previousTop = scroll.scrollTop || 0,
      follow = forceScroll || nearBottom();
    lastMessageBody = null;
    el('assistant-empty').hidden = transcript.length > 0;
    el('project-conversation').replaceChildren(
      ...transcript.map(m => {
        const label = m.role === 'user' ? tr('you', 'Siz') : m.label || 'Asistan';
        const status = {
          pending: 'Yanıt sürüyor veya bağlantı kesildi; tamamlanmış sayılmaz',
          failed: 'Başarısız',
          cancelled: 'Durduruldu',
          completed: 'Tamamlandı'
        }[m.status];
        const article = document.createElement('article');
        article.className = `assistant-message ${m.role}`;
        article.append(
          textNode('div', `${label}${m.status !== 'completed' ? ' · ' + status : ''}`, 'assistant-message-header')
        );
        const body = textNode('pre', m.content, m.role === 'user' ? 'project-user' : 'project-answer');
        article.append(body);
        lastMessageBody = body;
        const details = document.createElement('details');
        details.append(
          textNode('summary', 'Yanıt ayrıntıları'),
          textNode(
            'p',
            `${m.at ? new Date(m.at).toLocaleString('tr-TR') : ''} · ${status}${m.meta ? '\n' + m.meta : ''}${m.sources ? '\nKaynaklar: ' + m.sources : ''}`
          )
        );
        article.append(details);
        return article;
      })
    );
    scroll.scrollTop = follow ? scroll.scrollHeight : previousTop;
  }
  function restoreConversation(value) {
    clearConversation();
    transcript = value.messages || [];
    outputs = value.outputs || [];
    contextId = value.contextId || `${Date.now()}-${Math.random()}`;
    el('project-mode').value = value.mode || 'model';
    el('project-profile').value = value.profileId || activeId || '';
    el('project-system').value = value.system || '';
    el('project-prompt').value = '';
    el('project-share').checked = false;
    modelSession = value.modelContext || '';
    const completed = completedContext();
    (modelMode() ? modelHistory : history).push(...completed.slice(-10));
    renderTask(null);
    renderTranscript();
    renderOutputs();
    modeControls();
  }
  function renderOutputs() {
    el('assistant-outputs').hidden = !outputs.length;
    el('assistant-output-list').replaceChildren(
      ...outputs.map(output => {
        const card = document.createElement('div');
        const effect =
          {
            planned: 'Plan hazır; hedef dosyalar değişmedi.',
            proposed: 'Öneri hazır; hedef dosyalar değişmedi.',
            applied: 'Dosyalara uygulandı. Çalışan servis/DB ayrıca doğrulanmalı.',
            reverted: 'Dosya farkı geri alındı.',
            discarded: 'Canlı görev kapatıldı. Uygulanmış dosyalar olduğu gibi kaldı.',
            unknown: 'İşlemin etkisi doğrulanamadı; hedef dosyaları kontrol edin.'
          }[output.state] || 'Tarihsel iş kaydı';
        card.append(
          textNode('h3', `${output.mode === 'plan' ? 'Plan' : 'Değişiklik'} · ${output.at}`),
          textNode('p', effect),
          textNode('pre', output.content, 'project-answer'),
          textNode('pre', output.files, 'project-answer'),
          textNode('pre', output.result, 'project-answer'),
          textNode('pre', output.events || '', 'project-answer'),
          textNode(
            'p',
            'Bu kayıt tarihseldir. Canlı görev yoksa uygulanamaz, test edilemez veya geri alınamaz.',
            'muted'
          )
        );
        const button = textNode('button', 'Canlı görevi aç', 'secondary');
        button.type = 'button';
        button.disabled = busy;
        button.addEventListener('click', () =>
          perform('Canlı görev durumu denetleniyor…', async () => {
            renderTask(null);
            try {
              renderTask(await request('/project/tasks/' + encodeURIComponent(output.taskId)));
            } catch (error) {
              if (error.code === 'PROJECT_TASK_NOT_FOUND')
                throw new Error(
                  'Bu görev artık sunucu belleğinde değil. Kayıt yalnız okunabilir; yeni değişiklik için güncel kaynaklardan yeniden hazırlayın.',
                  { cause: error }
                );
              throw error;
            }
          })
        );
        card.append(button);
        return card;
      })
    );
  }
  async function recordOutput(task, state = task.state, event = state) {
    const item = {
      taskId: task.id,
      mode: task.mode,
      state,
      at: new Date().toISOString(),
      content: (task.content || '').slice(0, 8000),
      files: (task.files || [])
        .map(f => `${f.kind} · ${f.path}`)
        .join('\n')
        .slice(0, 12000),
      result: el('project-command-output').textContent.slice(0, 8000)
    };
    const index = outputs.findIndex(o => o.taskId === task.id);
    item.events = `${index < 0 ? '' : outputs[index].events || ''}\n${item.at} · ${event}`.slice(-8000);
    if (index < 0) outputs.push(item);
    else outputs[index] = item;
    renderOutputs();
    await historyUI.save();
  }
  async function beginTurn(prompt, label) {
    if (transcript.length > 96 || outputs.length >= 20)
      throw new Error('Bu sohbet kayıt sınırına yaklaştı. Yeni sohbet açın; mevcut kayıt korunur.');
    if (historyUI.blocked()) await historyUI.save();
    responseMeta = '';
    const at = new Date().toISOString();
    transcript.push({ role: 'user', content: prompt, status: 'completed', at, contextId });
    const answer = { role: 'assistant', content: '', status: 'pending', at, contextId, label };
    transcript.push(answer);
    renderTranscript();
    await historyUI.save();
    return answer;
  }
  async function endTurn(answer, error) {
    answer.status = error
      ? error.name === 'AbortError' || error.code === 'LLM_ABORTED'
        ? 'cancelled'
        : 'failed'
      : 'completed';
    answer.meta = responseMeta;
    if (error && !answer.content) answer.content = error.message;
    renderTranscript(false);
    await historyUI.save();
  }

  function textNode(tag, content, className) {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function lock(value) {
    busy = value;
    historyUI.lock(value);
    el('project-scan').disabled = busy || !state.enabled;
    el('project-send').disabled = busy || (modelMode() ? !el('project-profile').value : !state.enabled);
    el('project-cancel').disabled = !busy || !controller;
    el('project-prompt').disabled = busy || (!modelMode() && !state.enabled);
    el('project-chat-form').setAttribute('aria-busy', String(busy));
    el('project-mode').disabled = busy;
    el('project-profile').disabled = busy || !modelMode();
    el('project-system').disabled = busy;
    el('project-stream').disabled = busy;
    el('project-share').disabled = busy;
    el('project-task-select').disabled = busy;
    el('project-apply').disabled =
      busy || currentTask?.state !== 'proposed' || currentTask?.mode !== 'change' || !currentTask?.files.length;
    el('project-revert').disabled = busy || currentTask?.state !== 'applied';
    el('project-run-command').disabled =
      busy || !currentTask || !(state.commands || []).length || currentTask.state === 'reverted';
    el('project-discard').disabled = busy || !currentTask;
    el('project-approve').disabled = busy;
    renderOutputs();
  }

  function modeControls() {
    const plain = modelMode();
    el('project-model-options').hidden = !plain;
    el('project-sharing').hidden = plain;
    if (!plain) el('project-profile').value = activeId || state.activeProfile?.id || '';
    el('project-mode-hint').textContent = plain
      ? tr(
          'model_hint',
          'Projeyi bağlamadan model deneyebilirsiniz. Proje kaynakları gönderilmez; seçili profil ve yanıt ayarları kullanılır.'
        )
      : el('project-mode').value === 'chat'
        ? tr(
            'source_hint',
            'Etkin profille, seçili proje kaynaklarına dayanarak sohbet edin. Yanıtta kullanılan kaynaklar gösterilir.'
          )
        : tr(
            'mode_hint',
            'OpenCode görevleri geçici kopyada hazırlanır. Hedefe yazmadan önce dosya farklarını ayrıca onaylarsınız.'
          );
    lock(busy);
  }

  function setProfiles(next, active) {
    profiles = next;
    activeId = active;
    const selected = el('project-profile').value;
    const choices = profiles.map(profile => {
      const option = textNode(
        'option',
        `${profile.name} · ${profile.model}${profile.id === active ? ' · ' + tr('active_badge', 'Etkin') : ''}`
      );
      option.value = profile.id;
      return option;
    });
    if (!choices.length) {
      const option = textNode('option', tr('no_profiles', 'Önce LLM Yönetimi sekmesinde bir profil ekleyin.'));
      option.value = '';
      choices.push(option);
    }
    el('project-profile').replaceChildren(...choices);
    el('project-profile').value = profiles.some(p => p.id === selected) ? selected : active || profiles[0]?.id || '';
    const current = profiles.find(p => p.id === active);
    el('project-active-model').textContent = current
      ? `${current.name} · ${current.model}`
      : tr('no_model', 'Önce bir profil etkinleştirin');
    modeControls();
  }

  function render(next) {
    state = next;
    el('project-review').hidden = !currentTask && !(next.tasks || []).length;
    el('project-name').textContent = next.name || tr('no_project', 'Proje bağlı değil');
    const active = profiles.find(p => p.id === activeId) || next.activeProfile;
    el('project-active-model').textContent = active
      ? `${active.name} · ${active.model}`
      : tr('no_model', 'Önce bir profil etkinleştirin');
    const inventory = next.inventory;
    el('project-status').textContent = !next.enabled
      ? tr(
          'setup',
          'Proje asistanı yapılandırılmadı. Sunucuda LLM_PROJECT_ROOT veya project.root seçeneğiyle kaynak dizinini bağlayın.'
        )
      : inventory
        ? `${inventory.fileCount} kaynak dosyası · ${inventory.documentCount || 0} belge · ${inventory.excluded || 0} dosya dışlandı · ${inventory.partial ? 'Tarama sınırlı' : 'İzin verilen kaynaklar tarandı'} · ${new Date(inventory.scannedAt).toLocaleString('tr-TR')}`
        : tr('scan_first', 'Mimari özeti oluşturmak için projeyi tarayın.');
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
    modeControls();
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
      await recordOutput(
        currentTask,
        'unknown',
        `${{ apply: 'Uygulama', revert: 'Geri alma', commands: 'Doğrulama', discard: 'Görev kapatma' }[action]} istendi; sonuç henüz doğrulanmadı.`
      );
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
        await recordOutput(currentTask);
        if (!result.passed) throw new Error(tr('check_failed', 'Doğrulama başarısız'));
      } else {
        const previous = currentTask;
        renderTask(action === 'discard' ? null : result);
        await recordOutput(action === 'discard' ? previous : result, action === 'discard' ? 'discarded' : result.state);
      }
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

  async function perform(label, fn, requiresProject = true, quiet = false) {
    if (busy || (requiresProject && !state.enabled)) return;
    controller = new AbortController();
    lock(true);
    if (quiet) {
      notify('', false);
      el('assistant-run-status').textContent = label;
    } else notify(label, false, { state: 'loading' });
    try {
      await fn(controller.signal);
      if (!quiet) notify(tr('completed', 'Proje işlemi tamamlandı.'), false, { state: 'success' });
      el('assistant-run-status').textContent = '';
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'LLM_ABORTED') {
        const text = tr('cancelled', 'İşlem durduruldu. Alınan kısmi yanıt sohbet alanında korunur.');
        if (quiet) el('assistant-run-status').textContent = text;
        else notify(text, false);
      } else {
        el('assistant-run-status').textContent = 'İşlem tamamlanamadı.';
        notify(error.message, true, { code: error.code, supportId: error.supportId });
      }
    } finally {
      controller = null;
      runningModel = false;
      lock(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    if (busy) return;
    const prompt = el('project-prompt').value.trim();
    if (!prompt) return;
    if (modelMode()) {
      await sendModel(prompt);
      return;
    }
    if (!el('project-share').checked) {
      notify(
        tr('consent_required', 'Devam etmek için seçili kaynakların etkin sağlayıcıya gönderilmesini onaylayın.'),
        true
      );
      return;
    }
    const mode = el('project-mode').value || 'chat';
    if (mode !== 'chat') {
      await perform(
        tr('preparing', 'OpenCode geçici çalışma kopyasında hazırlanıyor…'),
        async signal => {
          const answer = await beginTurn(prompt, mode === 'plan' ? 'Geliştirme planı' : 'Değişiklik önerisi');
          let failure;
          try {
            signal.throwIfAborted();
            const task = await request('/project/tasks', {
              method: 'POST',
              body: JSON.stringify({
                mode,
                prompt,
                history: completedContext(),
                revision: state.inventory?.revision,
                shareSources: true
              })
            });
            answer.content = task.content || 'Görev çıktısı hazır.';
            history.push(
              { role: 'user', content: prompt },
              { role: 'assistant', content: answer.content.slice(0, 10000) }
            );
            renderTask(task);
            await recordOutput(task);
            el('project-prompt').value = '';
            await refresh();
          } catch (error) {
            failure = error;
            throw error;
          } finally {
            await endTurn(answer, failure);
          }
        },
        true,
        true
      );
      return;
    }
    await perform(
      tr('answering', 'Proje kaynakları inceleniyor…'),
      async signal => {
        const answer = await beginTurn(prompt, 'Kaynaklı sohbet');
        let failure;
        try {
          signal.throwIfAborted();
          const reply = await request('/project/chat', {
            method: 'POST',
            body: JSON.stringify({
              prompt,
              history: completedContext(),
              revision: state.inventory?.revision,
              shareSources: true
            })
          });
          answer.content = reply.content || '';
          answer.sources = (reply.sources || [])
            .map(s => `${s.path}:${s.startLine}–${s.endLine}`)
            .join(', ')
            .slice(0, 12000);
          history.push(
            { role: 'user', content: prompt },
            { role: 'assistant', content: String(reply.content || '').slice(0, 10000) }
          );
          if (history.length > 12) history.splice(0, history.length - 12);
          el('project-prompt').value = '';
          metrics(reply);
          await refresh();
        } catch (error) {
          failure = error;
          throw error;
        } finally {
          await endTurn(answer, failure);
        }
      },
      true,
      true
    );
  }

  function metrics(reply) {
    const usage = reply.usage;
    const tokens =
      usage?.totalTokens ??
      (typeof usage?.inputTokens === 'number' && typeof usage?.outputTokens === 'number'
        ? usage.inputTokens + usage.outputTokens
        : null);
    const reason =
      { length: tr('output_limit', 'Çıktı sınırına ulaşıldı'), content_filter: tr('filtered', 'Yanıt filtrelendi') }[
        reply.finishReason
      ] || tr('finished', 'Tamamlandı');
    responseMeta = `${reply.durationMs ?? 0} ms · ${tokens === null ? '—' : tokens.toLocaleString('tr-TR')} token · ${reason}`;
  }

  async function sendModel(prompt) {
    const profileId = el('project-profile').value;
    if (!profileId) {
      notify(tr('profile_required', 'Önce bir profil ekleyin veya seçin.'), true);
      return;
    }
    const system = el('project-system').value.trim();
    const selectedProfile = profiles.find(p => p.id === profileId);
    const session = JSON.stringify([profileId, selectedProfile?.model, selectedProfile?.revision, system]);
    if (modelSession && modelSession !== session) {
      modelHistory.length = 0;
      contextId = `${Date.now()}-${Math.random()}`;
    }
    modelSession = session;
    await perform(
      tr('model_waiting', 'Model yanıtı bekleniyor…'),
      async signal => {
        runningModel = true;
        const entry = await beginTurn(
          prompt,
          `${profiles.find(p => p.id === profileId)?.name || profileId} · ${profiles.find(p => p.id === profileId)?.model || ''}`
        );
        const answer = lastMessageBody;
        answer.textContent = '';
        responseMeta = tr('model_waiting', 'Model yanıtı bekleniyor…');
        let failure;
        try {
          signal.throwIfAborted();
          const reply = await chatClient.send({
            profileId,
            messages: [
              ...(system ? [{ role: 'system', content: system }] : []),
              ...modelHistory.slice(-10),
              { role: 'user', content: prompt }
            ],
            stream: el('project-stream').checked,
            signal,
            onDelta: text => {
              const follow = nearBottom();
              answer.textContent += text;
              entry.content = answer.textContent.slice(0, 32000);
              if (follow) el('assistant-messages').scrollTop = el('assistant-messages').scrollHeight;
            }
          });
          answer.textContent = reply.content || reply.text || '';
          entry.content = answer.textContent.slice(0, 32000);
          metrics(reply);
          modelHistory.push(
            { role: 'user', content: prompt },
            { role: 'assistant', content: answer.textContent.slice(0, 10000) }
          );
          if (modelHistory.length > 12) modelHistory.splice(0, modelHistory.length - 12);
          el('project-prompt').value = '';
        } catch (error) {
          failure = error;
          responseMeta =
            error.name === 'AbortError'
              ? tr('stopped', 'Durduruldu · yanıt tamamlanmadı')
              : tr('model_failed', 'Yanıt tamamlanamadı.');
          if (!answer.textContent) answer.textContent = responseMeta;
          throw error;
        } finally {
          await endTurn(entry, failure);
        }
      },
      false,
      true
    );
  }

  function clearConversation() {
    history.length = 0;
    modelHistory.length = 0;
    el('project-conversation').replaceChildren();
    responseMeta = '';
    transcript = [];
    outputs = [];
    contextId = `${Date.now()}-${Math.random()}`;
  }

  async function init() {
    el('assistant-nav-toggle').addEventListener('click', () => {
      const open = el('assistant-nav-toggle').getAttribute('aria-expanded') !== 'true';
      el('assistant-nav-toggle').setAttribute('aria-expanded', String(open));
      el('assistant-nav').setAttribute('data-open', String(open));
    });
    el('assistant-nav-close').addEventListener('click', () => {
      el('assistant-nav').setAttribute('data-open', 'false');
      el('assistant-nav-toggle').setAttribute('aria-expanded', 'false');
      el('assistant-nav-toggle').focus();
    });
    const showInfo = open => {
      el('project-sidebar').hidden = !open;
      el('assistant-info-toggle').setAttribute('aria-expanded', String(open));
    };
    showInfo(false);
    el('assistant-info-toggle').addEventListener('click', () => showInfo(el('project-sidebar').hidden));
    el('assistant-info-close').addEventListener('click', () => {
      showInfo(false);
      el('assistant-info-toggle').focus();
    });
    el('project-panel').addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const infoOpen = !el('project-sidebar').hidden,
        navOpen = el('assistant-nav-toggle').getAttribute('aria-expanded') === 'true';
      el('assistant-nav').setAttribute('data-open', 'false');
      el('assistant-nav-toggle').setAttribute('aria-expanded', 'false');
      showInfo(false);
      if (infoOpen) el('assistant-info-toggle').focus();
      else if (navOpen) el('assistant-nav-toggle').focus();
    });
    el('project-prompt').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!busy && !el('project-send').disabled) el('project-chat-form').requestSubmit();
      }
    });
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
        controller?.abort();
        if (runningModel) {
          return;
        }
        await request('/project/cancel', { method: 'POST', body: '{}' });
      } catch (error) {
        notify(error.message, true);
      }
    });
    el('project-mode').addEventListener('change', () => {
      if (modelMode() || modelSession) {
        modelHistory.length = 0;
        history.length = 0;
        contextId = `${Date.now()}-${Math.random()}`;
      }
      modelSession = '';
      el('project-share').checked = false;
      modeControls();
      renderTranscript();
    });
    el('project-profile').addEventListener('change', () => {
      modelHistory.length = 0;
      history.length = 0;
      contextId = `${Date.now()}-${Math.random()}`;
      lock(busy);
      renderTranscript();
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
    await historyUI.init();
  }
  return { init, refresh, selectTab, setProfiles, openConversation: historyUI.open };
}

window.llmProjectUI = createLLMProjectUI({
  element: $,
  request,
  notify: message,
  translate: t,
  chatClient: createLLMChatClient({ baseURL: apiBase }),
  confirmAction: showConfirm,
  download: text => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'llm-manager-sohbet.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
window.llmProjectUI.init().catch(error => message(error.message, true));
