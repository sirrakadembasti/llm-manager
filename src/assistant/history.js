import crypto from 'node:crypto';
import path from 'node:path';
import { projectError } from '../project/policy.js';

const invalid = () => projectError('ASSISTANT_INVALID', 'Sohbet kaydı biçimi veya boyut sınırları geçersiz.');
function clean(input) {
  if (!input || !['model', 'chat', 'plan', 'change'].includes(input.mode)) throw invalid();
  const string = (v, max) => {
    if (typeof v !== 'string' || v.length > max) throw invalid();
    return v;
  };
  const messages = input.messages ?? [];
  const outputs = input.outputs ?? [];
  if (!Array.isArray(messages) || messages.length > 100 || !Array.isArray(outputs) || outputs.length > 20)
    throw invalid();
  const result = {
    title: string(input.title || 'Yeni sohbet', 120),
    mode: input.mode,
    profileId: string(input.profileId || '', 160),
    system: string(input.system || '', 10000),
    contextId: string(input.contextId || '', 80),
    modelContext: string(input.modelContext || '', 12000),
    messages: messages.map(m => {
      if (
        !['user', 'assistant'].includes(m?.role) ||
        !['pending', 'completed', 'failed', 'cancelled'].includes(m.status)
      )
        throw invalid();
      return {
        role: m.role,
        content: string(m.content, 32000),
        status: m.status,
        contextId: string(m.contextId || '', 80),
        at: string(m.at || '', 40),
        label: string(m.label || '', 240),
        meta: string(m.meta || '', 240),
        sources: string(m.sources || '', 12000)
      };
    }),
    outputs: outputs.map(o => ({
      taskId: string(o.taskId, 80),
      mode: string(o.mode, 20),
      state: string(o.state, 40),
      at: string(o.at || '', 40),
      content: string(o.content || '', 8000),
      files: string(o.files || '', 12000),
      result: string(o.result || '', 8000),
      events: string(o.events || '', 8000)
    }))
  };
  if (Buffer.byteLength(JSON.stringify(result)) > 220000) throw invalid();
  return result;
}

export function createAssistantHistory({ storage, project }) {
  const root = project?.root ? path.resolve(project.root) : 'model-only';
  const scopeFor = principal =>
    crypto
      .createHash('sha256')
      .update(
        JSON.stringify([
          process.platform === 'win32' ? root.toLowerCase() : root,
          principal?.kind || 'host',
          principal?.id || 'admin'
        ])
      )
      .digest('hex');
  return {
    async handle({ method, path: route, body, principal }) {
      if (!/^\/assistant\/sessions(?:\/|$)/.test(route)) return null;
      if (principal && principal.isAdmin !== true)
        return { status: 403, body: { code: 'FORBIDDEN', error: 'Yönetici yetkisi gerekli.' } };
      const match = /^\/assistant\/sessions(?:\/([\w-]{1,80}))?\/?$/.exec(route);
      if (!match) return { status: 404, body: { code: 'ASSISTANT_NOT_FOUND', error: 'Sohbet bulunamadı.' } };
      const id = match[1];
      if (!storage)
        return method === 'GET' && !id
          ? {
              status: 200,
              body: {
                available: false,
                sessions: [],
                reason:
                  'Özel profil deposu kalıcı sohbet depolamasını desteklemiyor. Bu sayfa kapanırsa mesajlar kaybolur.'
              }
            }
          : { status: 503, body: { code: 'ASSISTANT_UNAVAILABLE', error: 'Kalıcı sohbet deposu yapılandırılmadı.' } };
      const scope = scopeFor(principal);
      try {
        if (method === 'GET') {
          const sessions = await storage.read(scope);
          if (!id)
            return {
              status: 200,
              body: {
                available: true,
                sessions: sessions.map(({ id, title, updatedAt, mode }) => ({ id, title, updatedAt, mode }))
              }
            };
          const found = sessions.find(s => s.id === id);
          if (!found) throw projectError('ASSISTANT_NOT_FOUND', 'Sohbet bulunamadı.', 404);
          return { status: 200, body: found };
        }
        if (!['POST', 'PUT', 'DELETE'].includes(method) || (method === 'POST' ? Boolean(id) : !id))
          return { status: 405, body: { error: 'Bu sohbet işlemi desteklenmiyor.' } };
        const saved = await storage.update(scope, sessions => {
          const index = sessions.findIndex(s => s.id === id);
          if (method !== 'POST') {
            if (index < 0) throw projectError('ASSISTANT_NOT_FOUND', 'Sohbet bulunamadı.', 404);
            if (body?.revision !== sessions[index].revision)
              throw projectError(
                'ASSISTANT_CONFLICT',
                'Sohbet başka bir sekmede değişti. Kayıtlı sohbeti yeniden açın; bu ekrandaki yanıtı önce dışa aktarabilirsiniz.',
                409
              );
          }
          if (method === 'DELETE') {
            sessions.splice(index, 1);
            return { deleted: true };
          }
          if (method === 'POST' && sessions.length >= 50)
            throw projectError(
              'ASSISTANT_LIMIT',
              '50 sohbet sınırına ulaşıldı. Eski bir kaydı dışa aktarıp silin.',
              409
            );
          const now = new Date().toISOString();
          const next = {
            ...clean(body),
            id: id || crypto.randomUUID(),
            revision: crypto.randomUUID(),
            createdAt: index < 0 ? now : sessions[index].createdAt,
            updatedAt: now
          };
          if (index < 0) sessions.unshift(next);
          else sessions[index] = next;
          return next;
        });
        return { status: method === 'POST' ? 201 : 200, body: saved };
      } catch (error) {
        const known = error.code?.startsWith('ASSISTANT_');
        return {
          status: known ? error.status || 400 : 500,
          body: {
            code: known ? error.code : 'ASSISTANT_STORE_FAILED',
            error: known
              ? error.message
              : 'Sohbet deposu okunamadı veya yazılamadı. Eşleşen şifreleme anahtarını, dosyayı ve disk alanını kontrol edin; mevcut kayıt korunur.'
          }
        };
      }
    }
  };
}
