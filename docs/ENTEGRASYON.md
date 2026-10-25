# Entegrasyon Kılavuzu

Paket: `@sirrakadembasti/llm-manager`; komut adı: `llm-manager`. Node.js >=22.12 gerekir. npm üzerindeki başka sahipli `llm-manager` paketi bu proje değildir. Depodan kurduktan sonra yerel komutu kullanın:

```bash
npm install github:sirrakadembasti/llm-manager
npx llm-manager init
```

Henüz yayımlanmamış bir sürüm etiketini varmış gibi kullanmayın. `init -y` doğrulama başarısızsa scaffold değişikliklerini geri alır. Eksik paket kurulumu ayrı bir onaylı önkoşuldur; kurulumun `node_modules` ve lockfile değişiklikleri daha sonraki scaffold geri alımına dahil değildir.

1.x'ten 2.0'a geçerken önce `npm uninstall llm-manager`, ardından yukarıdaki yeni paket kurulumunu çalıştırın. Import ve require yollarını `@sirrakadembasti/llm-manager` (alt modüller için `/core`, `/init` vb.) olarak güncelleyin. CLI komutu, `data/`, şifreleme anahtarı ve kayıtlı profiller korunur. Yerel 2.0.0 sürümü henüz bir npm yayını veya Git etiketi olduğu anlamına gelmez.

SPA/Tauri sihirbazı yalnız Vite algıladığında `http://localhost:5173` origin'ini seçer. Diğer projelerde açık origin sorulur; `-y` ile adres verilmezse CORS kapalıdır. `LLM_ALLOWED_ORIGINS` veya `--cors https://uygulamaniz.example` ile adres verin. Init API'si `allowedOrigins` seçeneğini kabul eder; sihirbaz wildcard origin üretmez veya kabul etmez.

## Desteklenen ortamlar

| Ortam | Tip | Üretimde kullanım | Ayrı Node süreci | Otomatik enjeksiyon |
|---|---|---|---|---|
| Express 4/5 ESM/CJS, TypeScript | express | Kalıcı disk/host store ile | Hayır | Evet |
| React/Vue/Vite/Angular/Svelte SPA | spa | Kendi backend'iniz üzerinden önerilir | Evet | HTTP istemcisi |
| Next.js App Router | nextjs | Node runtime + kalıcı disk/host store | Hayır | Yalnız sunucu bileşeni |
| Nuxt | nuxt | Node sunucusunda | Hayır | İstemci bileşenine yapılmaz |
| SvelteKit | sveltekit | Node adaptörü + kalıcı store | Hayır | İstemci bileşenine yapılmaz |
| Electron | electron | Ana süreç, userData deposu | Hayır | Ana süreç |
| Tauri | tauri | HTTP istemcisi | Evet | Hayır |
| Fastify/Koa/Hono/NestJS | fastify/koa/hono/nestjs | Host auth adaptörüyle | Hayır | Hayır; elle bağlantı |
| Python | python | HTTP istemcisi | Evet | Yardımcı import |
| .NET/.NET Framework | dotnet | HTTP istemcisi | Evet | Yardımcı namespace |

Tanımlanamayan projede `--type` açıkça seçilmelidir. `dist/`, `build/`, `out/`, `.next/` ve `lib/` derleme çıktıları enjeksiyon hedefi değildir.

## Kimlikler ve veri deposu

| Kimlik | Yetki | Saklama |
|---|---|---|
| Basic admin veya host principal `{ isAdmin: true }` | Yönetim + sohbet | Sunucu ortamı/session |
| Bearer `LLM_CHAT_TOKEN` | Yalnız `POST /api/llm/chat` | Sunucu veya yalnız geliştirme amaçlı tarayıcı |

Kurulum güçlü rastgele admin parolası üretir; `.env` içinde `LLM_ADMIN_PASSWORD` olarak saklar. Sohbet belirteçleri sunucuda `LLM_CHAT_TOKENS`, istemcide `LLM_CHAT_TOKEN` üzerinden okunur. SPA geliştirmesi `.env.local` içindeki `VITE_LLM_CHAT_TOKEN` değerini kullanır. Tarayıcıya giden tüm değerler herkese açıktır; üretimde kendi backend'inizi kullanın. Kaynak koda admin parolası koymayın.

Tüm dosya deposu metotları Promise döndürür; çağrılarda `await` kullanın. Host deposu aynı metotlarda senkron değer veya Promise döndürebilir. Yerel diskte süreç kilidi desteklenir; NFS/SMB için güvence verilmez. Windows'ta 0600 POSIX izinleri yeterli erişim sınırı değildir; veri ve anahtarı yalnız servis hesabının eriştiği klasörde saklayın. Anahtar kaybedilirse şifreli profiller kurtarılamaz.

## Express

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';
const app = express();
const llm = mountLLMManagement(app, {
  dataDir: './data',
  adminPassword: process.env.LLM_ADMIN_PASSWORD,
  chatTokens: process.env.LLM_CHAT_TOKENS
});
app.listen(3000);
// Sunucu kodunda: await llm.ask('Merhaba');
```

> [!WARNING]
> `requireAuth` host session middleware'iyle de verilebilir. Yönetim için `req.user.isAdmin === true` gerekir. Eklenti kendi JSON ayrıştırıcısını auth sonrasında bağlar. `trust proxy` ve `req.ip` doğruluğu hostun sorumluluğudur. CJS şablonu Node >=22.12 üzerinde senkron `require(esm)` kullanır ve rotaları host 404 katmanından önce bağlar.

## SPA ve Tauri

```js
const response = await fetch('http://127.0.0.1:8010/api/llm/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-LLM-CSRF': '1',
    Authorization: `Bearer ${import.meta.env.VITE_LLM_CHAT_TOKEN}`
  },
  body: JSON.stringify({ prompt: 'Merhaba' })
});
const result = await response.json();
```

> [!WARNING]
> Ayrı yönetim sunucusunu paket kurulduktan sonra `npm run llm` (veya `npx llm-manager`) ile ayrı süreçte çalıştırın; parola `.env` veya servis ortamından okunur. Açık origin listesi (`LLM_ALLOWED_ORIGINS`) kullanın. `--cors *` yalnız sohbet rotası için, credentials olmadan çalışır. Tauri'nin Rust arka ucuna Node modülü eklenmez; Tauri Electron IPC kullanmaz, HTTP istemcisidir. Masaüstü paketine gömülü belirteç de herkese açıktır.

## Next.js

Üretilen yardımcı ve route handler dosyaları sunucuda çalışır. `app/actions/llm.js` örnek Server Action sağlar. Host projede `server-only` paketi kuruluysa yardımcının ilk satırına `import 'server-only';` eklenir; sihirbaz bu bağımlılığı kurmaz. Doğrulama örnek action dosyasının da var ve dolu olmasını denetler. Yardımcı hiçbir `'use client'` bileşenine eklenmez. `@/*` alias'ı varsayılmaz; rota importları göreli yoldur. `next.config` içinde `serverExternalPackages: ['@sirrakadembasti/llm-manager']` gerekir; uygun nesne biçimlerinde sihirbaz onayınızla ekler, aksi halde talimat verir.

> [!WARNING]
> Node runtime gerekir; Edge desteklenmez. Vercel/Netlify gibi ortamlarda varsayılan dosya deposu kalıcı değildir veya yazılamaz. Kalıcı disk ya da async host deposu kullanın. `llm.fetch(request)` için admin kimliği/`authorize` yapılandırılmamışsa yönetim kapalı kalır.

## Nuxt ve SvelteKit

Nuxt yardımcısı `server/utils/llm.js`; SvelteKit yardımcısı `src/lib/server/llm.js` altındadır. Yönetim route handler'ları bu modülleri kullanır. `.vue` ve `.svelte` sayfalarına sunucu importu eklenmez. SvelteKit `src/routes/api/ask/+server.js` örneği POST isteğini, gövdesini ve kimlik bilgilerini koruyarak `llm.fetch` üzerinden kimlik doğrulamalı `/api/llm/chat` politikasına iletir; doğrudan ücretli üretim çağrısı açmaz. Doğrulama bu örnek dosyanın da var ve dolu olmasını denetler. Next Server Action örneği host kullanıcı yetkilendirmesi yapılandırılana kadar kapalıdır.

> [!WARNING]
> Node sunucu adaptörü, admin auth ve kalıcı store gerekir. İstemciye sunucu modülü veya admin parolası taşımayın. Serverless dağıtımda host deposu kullanın.

## Fastify, Koa, Hono ve NestJS

Bu tipler tanınır ve yardımcı dosya hazırlanır; host girişine otomatik framework kodu yazılmaz. Web `Request` sağlayan hostlarda `llm.fetch(request)` kullanın. Diğerlerinde method/path/body ve doğrulanmış principal ile `llm.handle(...)` çağırıp status/body sonucunu framework yanıtına aktarın.

> [!WARNING]
> `handle()` güvenilir host API'sidir; kendi başına HTTP kimliği doğrulamaz. Session/token doğrulamasını ve admin/sohbet yetki ayrımını host adaptöründe uygulayın. Doğrulanmamış istekleri doğrudan `handle()` veya `ask()` içine vermeyin.

## Electron

Ana süreç yardımcısı `app.getPath('userData')/llm` deposunu kullanır; `app.whenReady()` sonrasında çağrılır. `registerLLMIpc(ipcMain)` sohbet çağrılarını kaydeder. Üretilen `preload.cjs` dosyasını BrowserWindow `webPreferences.preload` olarak bağlayın; renderer `window.llm.ask(prompt)` kullanır. Ana süreçte `openLLMPanel()` yerel yönetim penceresi açar.

Yönetim sunucusu yalnız `127.0.0.1` üzerinde rastgele port dinler. Oturumluk parola yalnız bu pencerenin aynı HTTP origin'ine ait, proxy olmayan Basic challenge için ana süreçten sağlanır; URL'ye veya renderer koduna yazılmaz. Dış navigasyon/yönlendirme ve yeni pencere açma engellenir. Mevcut `preload.cjs` zorla üretimde de korunur; sohbet IPC seçeneklerinden yalnız metin `system` aktarılır.

> [!WARNING]
> `contextIsolation: true`, `nodeIntegration: false` korunmalıdır. Uzak/güvenilmeyen sayfalara sohbet IPC yetkisi vermeyin. Yönetim penceresinin rastgele admin parolası ana süreçte kalır; preload yalnız sınırlı sohbet arayüzü sunar.

## Python

Üretilen `llm_client.py`, `LLM_MANAGER_URL` ve `LLM_CHAT_TOKEN` ortam değişkenlerini okur. `ask_llm('Merhaba')` çağrısı 330 saniyelik istemci zaman aşımı kullanır. HTTP hataları `LLMError` içinde `status` ve `code` ile iletilir. Süreç ortamını servis yöneticinizden sağlayın; Python standart kütüphanesi `.env` dosyasını otomatik yüklemez.

> [!WARNING]
> Ayrı sürekli Node sunucusu gerekir; [dağıtım kılavuzunu](DEPLOY.md) kullanın. Admin parolasını Python istemcisine vermeyin. Python varsa doğrulama `py_compile` kullanır; yoksa derleme kontrolü atlandı diye raporlanır.

## .NET ve .NET Framework

`LlmClient.cs`, `LLM_MANAGER_URL` ve `LLM_CHAT_TOKEN` kullanır. JSON için framework ile uyumlu serializer ve C# 7.3 sözdizimi üretir. Eski csproj'larda gerekli Compile ve framework referansları journal üzerinden eklenir. `await LlmClient.AskAsync("Merhaba")` ile çağrılır.

> [!WARNING]
> Ayrı sürekli Node sunucusu ve sohbet belirteci gerekir. İstemcinin `.env` yüklemesini beklemeyin; servis ortamını yapılandırın. .NET SDK/derleyici yoksa doğrulama derleme başarısı iddia etmez; atlanan kontrolü açıkça gösterir.

## Doğrulama ve geri alma

Dosya yazımları journal ile izlenir. Kullanıcı kod ekleme adımını reddederse ya da doğrulama başarısızken geri almayı seçerse env, gitignore, package script, oluşturulan yardımcılar ve değiştirilen giriş/config dosyaları eski içerik/izinlerine döner; yalnız bu işlemde oluşan boş klasörler kaldırılır. `-y` doğrulama başarısızlığında otomatik geri alır.

Gerçek derleyici varsa kullanılır. Derleyici bulunmadığında kontrol atlanmış olarak gösterilir; bu derleme/üretim uyumluluğu kanıtı değildir. Canlı probe yönetim sayfası ve katalog yanıtını doğrular, sağlayıcının ücretli üretim API'sini çağırmaz.
