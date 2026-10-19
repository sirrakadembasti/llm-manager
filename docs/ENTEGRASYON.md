# LLM Manager — Uygulama Entegrasyon Kılavuzu

Bu kılavuz, `llm-manager` eklentisinin farklı mimarilerdeki GitHub repolarına, web uygulamalarına ve masaüstü uygulamalarına **API anahtarlarını hiçbir zaman istemciye (tarayıcıya) sızdırmadan** nasıl entegre edileceğini adım adım açıklar.

---

## Entegrasyon Senaryoları Özeti

| Senaryo | Uygulama Türü | Entegrasyon Yöntemi | Model Çağrısı Nasıl Yapılır? |
| :--- | :--- | :--- | :--- |
| **1. Node.js / Express Sunucu** | Express API, MVC, Monolit | `mountLLMManagement(app, ...)` | Sunucu içinde `generateProfileResponse()` veya istemciden `POST /api/llm/chat` |
| **2. Tek Sayfalık / Statik Web (SPA)** | React, Vue, Vite, Vanilla JS, GitHub Pages | `npx llm-manager` (Sidecar / BFF) + `LLM_ALLOWED_ORIGINS` | Tarayıcıdan `fetch('http://127.0.0.1:8010/api/llm/chat')` |
| **3. Full-Stack Framework** | Next.js (App Router), Nuxt, SvelteKit, Astro | `llm-manager/core` (`createLLMManager`, `createUiAssets`) | Server Action / Route Handler içinde `generateProfileResponse()` veya `/api/llm/chat` |
| **4. Diğer Sunucu Dilleri / Framework'ler** | Fastify, Koa, Hono veya Python (FastAPI/Django), Go, C#, PHP | Node içi `llm-manager/core` veya yerel `npx llm-manager` mikroservisi | `POST http://127.0.0.1:8010/api/llm/chat` |
| **5. Masaüstü Uygulamaları** | Electron, Tauri, C# WPF/MAUI, PyQt | Electron Main Process (`llm-manager/core` + IPC) veya Tauri Sidecar (`npx llm-manager`) | Electron `ipcMain.handle('llm:chat')` veya `POST http://127.0.0.1:8010/api/llm/chat` |

---

## Senaryo 1: Express.js Sunucu Uygulamaları (Doğrudan Gömülü)

Mevcut bir Express.js projesine tek komutla kurulur ve uygulamanın kendi oturum (session/JWT) yapısını kullanır.

### Adım 1: Kurulum
```sh
npm install github:sirrakadembasti/llm-manager
```

### Adım 2: Express Uygulamasına Bağlama (`server.js` / `app.js`)
```js
import express from 'express';
import path from 'node:path';
import { createLLMProfileStore, mountLLMManagement, generateProfileResponse } from 'llm-manager';
import { ensureLLMEncryptionKey } from 'llm-manager/setup';

const app = express();
app.use(express.json({ limit: '32kb' }));

const filePath = path.resolve('data/llm-profiles.json');
const encryptionKey = ensureLLMEncryptionKey({
  profilePath: filePath,
  environment: { ...process.env, NODE_ENV: 'production' }
});
const store = createLLMProfileStore({ filePath, encryptionKey });

// Host uygulamanın kimlik doğrulama middleware'i:
const requireAuth = (req, res, next) => {
  if (!req.user) return res.sendStatus(401);
  req.user.isAdmin = req.user.role === 'admin';
  next();
};

// Yönetim arayüzü (/llm) yalnız Admin'e; /api/llm/chat ise giriş yapmış kullanıcılara açılır:
mountLLMManagement(app, {
  store,
  requireAuth,
  pagePath: '/llm',
  apiPath: '/api/llm',
  chatAccess: 'authenticated' // 'authenticated' (varsayılan) | 'admin' | false
});

// Backend içinden doğrudan etkin profille çağrı:
export async function askActiveLLM(messages, signal) {
  const profile = store.getActive();
  if (!profile) throw new Error('Etkin LLM profili seçilmedi.');
  return generateProfileResponse(messages, profile, { purpose: 'production', signal });
}
```

---

## Senaryo 2: Tek Sayfalık (SPA) ve Statik Web Uygulamaları (React, Vue, Vite, HTML/JS)

Statik web uygulamalarında (tarayıcıda çalışan SPA'larda) API anahtarlarını `localStorage` veya frontend kodunda tutmak güvenlik açığı yaratır. Bunun yerine `llm-manager` yerel veya sunucu tarafında **hazır mikroservis (BFF)** olarak çalıştırılır.

### Adım 1: LLM Manager Servisini CORS İzinleriyle Başlatma
Projenizin yanında veya sunucuda `.env` oluşturun ya da doğrudan CLI ile başlatın:
```sh
LLM_ADMIN_USER=admin \
LLM_ADMIN_PASSWORD=guclu-parola \
LLM_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 \
npx github:sirrakadembasti/llm-manager --port 8010
```
> **Not:** Geliştirme sırasında Vite (`vite.config.js`) içinde `/api/llm` ve `/llm` yollarını `http://127.0.0.1:8010` adresine proxy'lerseniz CORS ayarına dahi gerek kalmaz.

### Adım 2: Yönetim Sayfasından Profil Tanımlama
Tarayıcıda `http://127.0.0.1:8010/llm` adresini açın, sağlayıcı ve API anahtarınızı girip **Etkinleştir** butonuna basın.

### Adım 3: SPA (React / Vue / Vanilla JS) İçinden Çağrı Yapma
```js
export async function sendChatToLLM(userPrompt) {
  const response = await fetch('http://127.0.0.1:8010/api/llm/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1',
      // Standalone sunucu kullanılıyorsa Basic Auth; reverse proxy/host session varsa cookie kullanılır:
      'Authorization': 'Basic ' + btoa('admin:guclu-parola')
    },
    body: JSON.stringify({
      purpose: 'production',
      messages: [
        { role: 'system', content: 'Yardımcı bir asistansın.' },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'LLM çağrısı başarısız.');
  return data.content; // API anahtarı hiçbir zaman tarayıcıya dönmez
}
```

---

## Senaryo 3: Full-Stack Uygulamalar (Next.js App Router, Nuxt, SvelteKit)

Express kullanmayan full-stack Node.js framework'lerinde `llm-manager/core` doğrudan Route Handler / API Route içine bağlanır.

### Adım 1: Kurulum ve Singleton Oluşturma (`lib/llm.js`)
```js
import path from 'node:path';
import { createLLMManager, createLLMProfileStore, createUiAssets, generateProfileResponse } from 'llm-manager/core';
import { ensureLLMEncryptionKey } from 'llm-manager/setup';

const filePath = path.resolve(process.cwd(), 'data/llm-profiles.json');
const encryptionKey = ensureLLMEncryptionKey({
  profilePath: filePath,
  environment: { ...process.env, NODE_ENV: 'production' }
});

export const llmStore = createLLMProfileStore({ filePath, encryptionKey });
export const llmManager = createLLMManager({ store: llmStore });
export const llmUi = createUiAssets({ apiPath: '/api/llm', pagePath: '/llm' });

// Server Action veya RSC içinden doğrudan kullanım:
export async function generateServerReply(messages) {
  const profile = llmStore.getActive();
  if (!profile) throw new Error('Etkin LLM profili yok.');
  return generateProfileResponse(messages, profile);
}
```

### Adım 2: Next.js Catch-All API Route (`app/api/llm/[...slug]/route.js`)
```js
import { NextResponse } from 'next/server';
import { llmManager } from '@/lib/llm';

async function handler(request, { params }) {
  // 1. Kendi session/auth kontrolünüzü yapın (ör. NextAuth / Lucia / Clerk)
  const { slug = [] } = await params;
  const subPath = '/' + slug.join('/');

  // 2. Yazma isteklerinde CSRF başlığını doğrulayın
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('x-llm-csrf') !== '1') {
    return NextResponse.json({ error: 'CSRF başlığı eksik.' }, { status: 403 });
  }

  const body = ['POST', 'PUT', 'DELETE'].includes(request.method)
    ? await request.json().catch(() => ({}))
    : null;

  const result = await llmManager.handle({ method: request.method, path: subPath, body });
  if (!result) return new NextResponse(null, { status: 404 });
  if (result.body === undefined) return new NextResponse(null, { status: result.status });
  return NextResponse.json(result.body, { status: result.status });
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
```

### Adım 3: Next.js Yönetim Sayfası (`app/llm/route.js` ve `app/llm/llm-ui.js/route.js`)
- `app/llm/route.js` içinde `new Response(llmUi.html, { headers: { 'content-type': 'text/html; charset=utf-8' } })`
- `app/llm/llm-ui.js/route.js` içinde `new Response(llmUi.script, { headers: { 'content-type': 'text/javascript; charset=utf-8' } })` döndürün.

---

## Senaryo 4: Diğer Sunucu Uygulamaları (Fastify/Koa veya Python, Go, C#, PHP)

### 4A. Fastify / Koa / Hono (Node.js Sunucuları)
`llm-manager/core` içindeki `manager.handle({ method, path, body })` fonksiyonunu doğrudan kendi framework yönlendiricinize sarın:
```js
// Fastify örneği:
fastify.all('/api/llm/*', async (request, reply) => {
  const subPath = request.url.replace(/^\/api\/llm/, '').split('?')[0] || '/';
  const result = await manager.handle({ method: request.method, path: subPath, body: request.body });
  if (!result) return reply.code(404).send();
  return reply.code(result.status).send(result.body ?? '');
});
```

### 4B. Python (FastAPI / Django), Go, C# (.NET) veya PHP Sunucuları (Sidecar Modeli)
Node.js dışı bir backend kullanıyorsanız `llm-manager`'ı `127.0.0.1:8010` üzerinde yerel bir **Sidecar servisi** olarak çalıştırın:

1. **Başlatma (systemd / supervisor / PM2 / Docker Compose):**
   ```sh
   LLM_ADMIN_USER=internal LLM_ADMIN_PASSWORD=gizli-token npx llm-manager --port 8010
   ```
2. **Python (FastAPI / Requests) İçinden Çağrı:**
   ```python
   import requests

   def ask_llm(messages: list[dict]) -> str:
       resp = requests.post(
           "http://127.0.0.1:8010/api/llm/chat",
           auth=("internal", "gizli-token"),
           headers={"X-LLM-CSRF": "1"},
           json={"messages": messages, "purpose": "production"},
           timeout=125,
       )
       resp.raise_for_status()
       return resp.json()["content"]
   ```

---

## Senaryo 5: Masaüstü Uygulamaları (Electron, Tauri, .NET MAUI/WPF)

Masaüstü uygulamalarında kullanıcıların kendi API anahtarlarını işletim sistemi kullanıcı dizininde (`AppData` / `~/.config`) şifreli saklaması ve yönetmesi için iki yöntem kullanılır:

### 5A. Electron Uygulamaları (Main Process + IPC — Sıfır Port Açma)
Electron'un **Main** süreci tam Node.js ortamına sahip olduğu için HTTP portu açmaya gerek kalmadan doğrudan `llm-manager/core` kullanılır:

```js
// electron/main.js
import { app, ipcMain } from 'electron';
import path from 'node:path';
import { createLLMManager, createLLMProfileStore, generateProfileResponse } from 'llm-manager/core';
import { ensureLLMEncryptionKey } from 'llm-manager/setup';

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  const filePath = path.join(userDataDir, 'llm-profiles.json');
  const keyPath = path.join(userDataDir, 'llm-encryption.key');

  const encryptionKey = ensureLLMEncryptionKey({
    profilePath: filePath,
    keyPath,
    environment: { ...process.env, NODE_ENV: 'production' }
  });

  const store = createLLMProfileStore({ filePath, encryptionKey });
  const manager = createLLMManager({ store });

  // Yönetim işlemleri için IPC köprüsü:
  ipcMain.handle('llm:manage', (_event, { method, path: routePath, body }) =>
    manager.handle({ method, path: routePath, body })
  );

  // Sohbet çağrıları için IPC köprüsü:
  ipcMain.handle('llm:chat', async (_event, messages) => {
    const profile = store.getActive();
    if (!profile) throw new Error('Etkin LLM profili seçilmedi.');
    return generateProfileResponse(messages, profile);
  });
});
```

### 5B. Tauri (Rust) / PyQt / C# Masaüstü Uygulamaları (Yerel Sidecar)
1. Uygulama başlarken arka planda `127.0.0.1` üzerinde rastgele veya sabit bir portta `llm-manager` alt sürecini (child process) rastgele üretilen tek kullanımlık `LLM_ADMIN_PASSWORD` ve `LLM_ALLOWED_ORIGINS=tauri://localhost,http://localhost:1420` ile başlatın.
2. Ayarlar penceresinde `/llm` arayüzünü bir WebView sekmesinde açın.
3. Uygulama içi LLM isteklerini `POST http://127.0.0.1:8010/api/llm/chat` uç noktasına gönderin. Uygulama kapanırken alt süreci (`SIGTERM`) sonlandırın.
