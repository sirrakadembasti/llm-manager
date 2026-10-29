// Tarihsel YH2 HTTP sözleşmeleri için küçük kabul betiği; tam testlerin yerine geçmez.
// Güncel kullanım ve sınırlar: docs/KULLANICI_KILAVUZU.md
// Çalıştırma (depo kökünden): node docs/roadmap/dogrulama.mjs
// YH2 Faz 0 + G08 + G11 tamamlandığında beklenen çıktı:
//   1) 404 CHAT_DISABLED  2a) profil listesi  2b) 409  3) 201  4) 401 veya 500 AUTH_NOT_CONFIGURED
import express from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { mountLLMManagement, createLLMManager } from '../../src/index.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llmv-'));
const auth = 'Basic ' + Buffer.from('admin:x').toString('base64');
const jsonHeaders = { Authorization: auth, 'X-LLM-CSRF': '1', 'content-type': 'application/json' };

try {
  // 1) chatAccess:false sohbeti kapatmalı (YH2-G03)
  {
    const app = express();
    app.use(express.json());
    mountLLMManagement(app, {
      dataDir: dir,
      adminPassword: 'x',
      chatAccess: false,
      generate: async () => 'GIZLI-CEVAP'
    });
    const srv = app.listen(0);
    const { port } = srv.address();
    const r = await fetch(`http://127.0.0.1:${port}/api/llm/chat`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ prompt: 'hi' })
    });
    console.log('1) chatAccess:false -> /chat', r.status, await r.text());
    srv.close();
  }

  // 2) Async host deposu desteklenmeli (YH2-G08)
  {
    const asyncStore = {
      async list() {
        return { activeId: null, profiles: [{ id: 'a' }] };
      },
      async get() {
        return null;
      },
      async getActive() {
        return null;
      },
      async save() {},
      async remove() {},
      async activate() {},
      async recordTest() {}
    };
    const m = createLLMManager({ store: asyncStore });
    const r1 = await m.handle({ method: 'GET', path: '/profiles' });
    console.log('2a) async store GET /profiles body:', JSON.stringify(r1.body));
    const r2 = await m.handle({ method: 'POST', path: '/chat', body: { prompt: 'x' } });
    console.log('2b) async store POST /chat (409 beklenir):', r2.status, JSON.stringify(r2.body));
  }

  // 3) express.json() eklentiden sonra bağlansa da gövde okunmalı (YH2-G11)
  {
    const app = express();
    mountLLMManagement(app, { dataDir: dir, adminPassword: 'x' });
    app.use(express.json());
    const srv = app.listen(0);
    const { port } = srv.address();
    const r = await fetch(`http://127.0.0.1:${port}/api/llm/profiles`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: 'n',
        provider: 'openai',
        model: 'm',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-1'
      })
    });
    console.log('3) body parser sonra -> POST /profiles', r.status, await r.text());
    srv.close();
  }

  // 4) Web fetch adaptörü kimlik doğrulamasız yazmaya izin vermemeli (YH2-G02)
  {
    const m = createLLMManager({ dataDir: dir });
    const res = await m.fetch(
      new Request('http://x/api/llm/profiles', {
        method: 'POST',
        headers: { 'X-LLM-CSRF': '1', 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'saldirgan',
          provider: 'custom',
          model: 'm',
          baseURL: 'https://evil.example.com/v1',
          apiKey: 'k'
        })
      })
    );
    console.log('4) fetch adaptörü, auth yok -> profil oluşturma', res.status);
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
