# LLM Manager — Kolay Entegrasyon Kılavuzu (Sıfır Ayar)

Bu kılavuz, `llm-manager` eklentisini farklı türdeki projelere **en az kod ve sıfır karmaşık ayar** ile nasıl bağlayacağınızı anlatır.

> **Temel Mantık Çok Basit:**
> 1. Eklentiyi başlatırsınız (şifreleme anahtarını ve `data/` klasörünü **kendisi otomatik oluşturur**).
> 2. Tarayıcıdan `/llm` sayfasına girip kullandığınız modeli (OpenAI, Gemini, Claude, DeepSeek, MiMo vb.) ve API anahtarınızı kaydedip **"Etkinleştir"** dersiniz.
> 3. Uygulamanızdan sadece **`await llm.ask("Sorunuz")`** (veya HTTP ile `{ prompt: "Sorunuz" }`) çağrısı yaparsınız. Modeli değiştirmek istediğinizde kodunuza dokunmazsınız; sadece `/llm` ekranından başka bir profili etkinleştirirsiniz!

---

## 1. Express.js Sunucu Uygulamaları (Sadece 2 Satır Kod)

Dosya yolu, şifreleme anahtarı veya depo (`store`) tanımlamanıza **gerek yoktur**; hepsi otomatik yapılır.

### Adım 1: Paketi Kurun
```sh
npm install github:sirrakadembasti/llm-manager
```

### Adım 2: `app.js` / `server.js` İçine Ekleyin
```js
import express from 'express';
import { mountLLMManagement } from 'llm-manager';

const app = express();
app.use(express.json());

// 1. Eklentiyi bağlayın (adminPassword verirseniz hazır giriş ekranı açılır;
//    kendi oturum sisteminiz varsa adminPassword yerine requireAuth verebilirsiniz):
const llm = mountLLMManagement(app, { adminPassword: 'gizli-parolam' });

// 2. Uygulamanızın herhangi bir yerinde tek satırla modele soru sorun:
app.post('/ozetle', async (req, res) => {
  const cevap = await llm.ask(req.body.metin, { system: 'Metni 3 maddede özetle.' });
  res.json({ cevap });
});

app.listen(3000);
```
* **Yönetim Ekranı:** `http://localhost:3000/llm` (Kullanıcı adı: `admin`, Şifre: `gizli-parolam`).

---

## 2. Tek Sayfalık (SPA) ve Statik Web Uygulamaları (React, Vue, Vite, HTML/JS)

Sadece HTML/JS, React veya Vue olan (kendi arka uç sunucusu olmayan) projelerde API anahtarını tarayıcıya koymak tehlikelidir. Bunun yerine `llm-manager` tek komutla hazır arka uç olarak çalıştırılır.

### Adım 1: Terminalde Tek Komutla Başlatın
```sh
npx github:sirrakadembasti/llm-manager --password 12345 --cors *
```
*(Bu komut `http://127.0.0.1:8010/llm` adresinde yönetim panelini açar ve SPA uygulamanızın bağlanmasına izin verir.)*

### Adım 2: Yönetim Ekranından Modelinizi Seçin
`http://127.0.0.1:8010/llm` adresine girin (`admin` / `12345`), API anahtarınızı kaydedip **Etkinleştir** butonuna tıklayın.

### Adım 3: Frontend (React / Vue / JS) Kodunuzdan Çağırın
```js
async function modeleSor(soru) {
  const res = await fetch('http://127.0.0.1:8010/api/llm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1',
      'Authorization': 'Basic ' + btoa('admin:12345')
    },
    body: JSON.stringify({ prompt: soru })
  });
  const veri = await res.json();
  return veri.content; // Modelin cevabı
}
```

---

## 3. Full-Stack Uygulamalar (Next.js, SvelteKit, Nuxt, Astro, Hono)

Modern full-stack framework'lerde standart Web `Request` / `Response` nesneleri kullanılır. `llm.fetch(request)` metodu hem `/llm` yönetim sayfasını hem de `/api/llm/*` uç noktalarını **tek satırda** sunar.

### Adım 1: Tek Dosyada Tanımlayın (`lib/llm.js`)
```js
import { createLLMManager } from 'llm-manager/core';

// Şifreleme anahtarı ve data/ klasörü otomatik yönetilir:
export const llm = createLLMManager();
```

### Adım 2: Sunucu İçinde (Server Action / API) Soru Sorun
```js
import { llm } from '@/lib/llm';

const cevap = await llm.ask('Bana bir proje planı çıkar.');
```

### Adım 3: Yönetim Panelini ve API'yi Bağlayın (Next.js App Router Örneği)
`app/api/llm/[...slug]/route.js` ve `app/llm/[[...slug]]/route.js` dosyalarına sadece şunu yazın:
```js
import { llm } from '@/lib/llm';

const handler = (request) => llm.fetch(request);
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
```

---

## 4. Diğer Sunucu Dilleri (Python, Go, C#, PHP) ve Diğer Node.js Çatıları

### 4A. Python (FastAPI / Django / Flask), Go, C#, PHP
Başka bir programlama dili kullanıyorsanız `llm-manager`'ı yan servis olarak başlatıp HTTP ile çağırın:

1. **Servisi Başlatın:**
   ```sh
   npx github:sirrakadembasti/llm-manager --password 12345
   ```
2. **Python'dan Tek Fonksiyonla Çağırın:**
   ```python
   import requests

   def modele_sor(soru: str) -> str:
       r = requests.post(
           "http://127.0.0.1:8010/api/llm/chat",
           auth=("admin", "12345"),
           headers={"X-LLM-CSRF": "1"},
           json={"prompt": soru},
       )
       return r.json()["content"]
   ```

### 4B. Fastify / Koa (Node.js)
```js
import { createLLMManager } from 'llm-manager/core';
const llm = createLLMManager();

// Herhangi bir route içinde doğrudan kullanın:
const cevap = await llm.ask('Merhaba!');
```

---

## 5. Masaüstü Uygulamaları (Electron ve Tauri)

Masaüstü uygulamalarında kullanıcının girdiği API anahtarları bilgisayardaki uygulama klasörüne (`AppData` / `~/.config`) şifreli kaydedilir.

### 5A. Electron (Sadece 3 Satır — Port Açmadan)
`electron/main.js` dosyasında `dataDir` olarak Electron'un kullanıcı klasörünü vermeniz yeterlidir:
```js
import { app, ipcMain } from 'electron';
import { createLLMManager } from 'llm-manager/core';

app.whenReady().then(() => {
  // 1. Kullanıcı klasöründe otomatik şifreli depo başlat:
  const llm = createLLMManager({ dataDir: app.getPath('userData') });

  // 2. Arayüzden gelen soruları yanıtla:
  ipcMain.handle('llm:sor', (_e, soru) => llm.ask(soru));
});
```

### 5B. Tauri (Rust) / C# WPF / PyQt Masaüstü Uygulamaları
1. Uygulama açılırken arka planda `npx llm-manager --password 12345 --cors *` komutunu alt süreç (sidecar) olarak başlatın.
2. Ayarlar penceresinde `http://127.0.0.1:8010/llm` adresini açın.
3. Uygulama içinden `http://127.0.0.1:8010/api/llm/chat` adresine `{ "prompt": "..." }` gönderip yanıtı alın.
