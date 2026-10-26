# LLM Manager

> npm'deki `llm-manager` paketi bu projeyle ilgili değildir. Bu projenin paket adı `@sirrakadembasti/llm-manager` olur. Çıplak `npx llm-manager` komutlarını yalnız bu paket projeye kurulduktan sonra kullanın.

Node.js 22.12+ ve Express için bağımsız sağlayıcı/profil yönetimi eklentisi.
Herhangi bir host uygulamaya, Docker, frontend framework veya veritabanı gerektirmeden eklenir. Node/npm gerekir.
Windows, Linux ve macOS üzerinde aynı kaynak kodu kullanır.

## Özellikler

> Sürüm geçmişi için [CHANGELOG.md](CHANGELOG.md) dosyasına bakın. Yazma isteklerinde CSRF başlığı
> `X-LLM-CSRF: 1` olmalıdır.

- Hazır sağlayıcı kataloğu (varsayılan model listeleri ve bölgesel uç noktalarla; katalog tarihi: 2026-10; güncel liste için **Modelleri getir** kullanın) + özel OpenAI uyumlu sağlayıcı; listeden model seçme, elle API adresi/model girme veya sağlayıcıdan model listesini getirme.
- Profil ekleme/düzenleme/silme ve tek etkin profil; mevcut API anahtarını koruma ve 3 durumlu şifreli anahtar rozeti/durum bildirimi.
- AES-256-GCM (12 bayt IV ve 16 bayt doğrulama etiketi zorunluluğu) ile şifreli anahtarlar, güvenli atomik dosya yazımı, revizyon denetimi.
- Yanıt süresi: 5–300 saniye, varsayılan 120 saniye. Token bütçesi: 256–32768,
  varsayılan 8192. Düşünme: otomatik/açık/kapalı (destekleyen sağlayıcılarda).
- Kısa bağlantı testi ve ayrı sohbet testi; süre, zaman, hata kodu ve iki testin
  ayrı tarihçesi (sağlayıcı, adres, model veya anahtar değişmediği sürece korunur). Başarı, test anını gösterir; uygulama üretim kabulü değildir.
- Yönetici yetkisi, CSRF başlığı, güvenlik ve önbellek başlıkları (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`), HTTPS sağlayıcı adresi, gerçek DNS/socket bağlantısında özel IPv4/IPv6 engelleme; sağlayıcı hata metinlerini/anahtarları gizleme.
- Çift gönderim/işlem kilidi, bekleme süresi, zaman aşımı ve model listesi getirirken bile korunan form durumu.

## Kurulum ve kendi başına çalıştırma

### CLI (`npx llm-manager`)

```sh
# Etkileşimli kurulum sihirbazı (algılama -> otomatik kod ekleme -> iç doğrulama -> canlı /llm + tarayıcı açma)
npx github:sirrakadembasti/llm-manager init --password guclu-parola

# Doğrudan yönetim sunucusunu başlatma
npx github:sirrakadembasti/llm-manager --password guclu-parola --port 8010
```

Seçenekler: `init`, `-t/--type` (`express | spa | nextjs | nuxt | sveltekit | electron | dotnet | python | fastify | koa | hono | nestjs | tauri`), `-f/--force`, `-y/--yes` (otomatik onay), `--no-open` (tarayıcı açmama), `-w/--password`, `-u/--user` (varsayılan: `admin`), `-c/--cors` (ör. `http://localhost:5173` veya `*`), `-p/--port`, `-h/--help`, `-v/--version`. Çalışma dizinindeki `.env` otomatik okunur; şifreleme anahtarı ve veriler `./data/` altında otomatik oluşturulur.

### Kaynaktan

```sh
npm ci
npm test
```

Örnek sunucu için `LLM_ADMIN_PASSWORD` ortam değişkenini tanımlayıp (`LLM_ADMIN_USER`
verilmezse varsayılan `admin` kullanılır) `npm start` çalıştırın. Sunucu yalnız
`127.0.0.1:8010` adresini dinler; `/llm` sayfasını açın.

Windows PowerShell örneği:

```powershell
$env:LLM_ADMIN_PASSWORD = 'kendi-guclu-parolaniz'
npm start
```

API anahtarlarınızı yalnız arayüzden girin. `data/` altındaki profil ve şifreleme
anahtarı dosyalarını kaynak depoya eklemeyin. Profil dosyasını **ve şifreleme
anahtarını** birlikte yedekleyin.

Dosya izinleri (0600) Windows'ta uygulanmaz; `data/` klasörünü yalnız uygulama kullanıcısının erişebileceği bir konuma koyun.

### Anahtar Yönetimi, Döndürme ve Şifreli Yedekleme

> [!WARNING]
> **Anahtar kaybedilirse profiller kurtarılamaz!** `data/` altındaki `llm-encryption.key` dosyasını `llm-profiles.json` ile birlikte mutlaka yedekleyin.

Eski kurulumlarda anahtar yalnız `.env` içindeyse, `ensureLLMEncryptionKey` varsayılan çağrısı bu anahtarı profil kilidi altında anahtar dosyasına taşır; `.env` ve şifreli profiller değiştirilmez. Açık ortam anahtarı ve mevcut anahtar dosyası eski `.env` değerinden önceliklidir. Taşımadan sonra `.env` yüklemeyen gömülü süreçler aynı profilleri okuyabilir. Eski `.env` yazımı yalnız deprecated `{ writeEnv: true }` ile korunur. Döndürme yedeği tarih ve benzersiz ek içeren `llm-encryption.key.old-<tarih>-<kimlik>` adıyla saklanır.

```sh
# 1. Şifreleme anahtarını döndürme (yeni anahtar üretir, tüm kayıtlı API anahtarlarını yeni anahtarla yeniden şifreler, eski anahtarı yedekler):
npx llm-manager key rotate

# 2. Profilleri şifreli taşınabilir yedek dosyası olarak dışa aktarma (belirlediğiniz parola ile scrypt/AES-GCM):
npx llm-manager export --out yedek.json --password yedek-parolasi

# 3. Şifreli yedekten profilleri içe aktarma:
npx llm-manager import yedek.json --password yedek-parolasi
```

## Başka uygulamaya entegrasyon (Sıfır Ayar)

Paketi kurun:

```sh
npm install github:sirrakadembasti/llm-manager
```

Şifreleme anahtarı ve `data/` klasörü otomatik oluşturulur; yalnızca eklentiyi bağlayıp `llm.ask()` çağırın:

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';

const app = express();
app.use(express.json({ limit: '32kb' }));

// 1. Eklentiyi bağlayın (hazır giriş için adminPassword veya kendi session middleware'iniz için requireAuth verin):
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD // veya requireAuth: (req, res, next) => ...
});

// 2. Tek satırla etkin modele soru sorun (API anahtarı tarayıcıya asla verilmez):
const cevap = await llm.ask('Bana kısa bir özet çıkar.', {
  system: 'Yardımcı bir asistansın.'
});
```

Mevcut `generate(messages, options)` adaptörünüz varsa `mountLLMManagement`
seçeneklerine `generate` verin. İsteğe bağlı olarak `dataDir` (ör. Electron'da `app.getPath('userData')`)
veya özel `store` verebilirsiniz.

Eklenti kendi yönetim sayfası ve API yanıtlarında `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` ve yönetim HTML sayfasında
`Content-Security-Policy` başlıklarını otomatik uygular; Express 4 üzerinde asenkron
depo/yönlendirici hatalarını `next(err)` ile host hata katmanına iletir. Eklenti kendi
yazma API'lerinde `X-LLM-CSRF: 1` başlığını ister.

### Express dışı (Next.js, Nuxt, SvelteKit, Vue/React SPA, C#/.NET, Python, Masaüstü) entegrasyonlar

Paket projeye kurulduktan sonra projenizin klasöründe `npx llm-manager init` komutunu çalıştırdığınızda sihirbaz projenizin mimarisini ve ana dosyasını otomatik algılar, onayınızla bağlantı kodlarını ilgili dosyalara yazar, iç doğrulama (syntax & bağlantı kontrolü) yapar ve `/llm` yönetim ekranını tarayıcıda otomatik açar. Parola verilmezse güçlü rastgele parola üretilir ve yalnız `.env` dosyasına kaydedilir:

| Uygulama Türü | Algılama (`--type`) | Otomatik Oluşturulan Dosya | Otomatik Eklendiği Ana Dosya | Nasıl Soru Sorulur? |
| --- | --- | --- | --- | --- |
| Express | `express` | `llm.js` | `server.js` / `app.js` / `index.js` | `await askLLM('Merhaba')` |
| SPA | `spa` | `src/llm.js` | `src/App.vue` / `src/App.jsx` / `src/main.ts` | `await askLLM('Merhaba')` |
| Next.js | `nextjs` | `llm.js` + `app/llm` & `app/api/llm` | `app/page.js` / `src/app/page.tsx` | `await askLLM('Merhaba')` |
| Nuxt | `nuxt` | `server/utils/llm.js` + `server/api/llm` & `server/routes/llm` | Sunucu rotaları; istemci bileşenine eklenmez | `askLLM` yalnız sunucuda; istemci: HTTP |
| SvelteKit | `sveltekit` | `src/lib/server/llm.js` + `+server.js` rotaları | Sunucu rotaları; istemci bileşenine eklenmez | `askLLM` yalnız sunucuda; istemci: HTTP |
| Electron | `electron` | `llm.js` + `preload.cjs` | `main.js` / `electron/main.js` | `await window.llm.ask('Merhaba')` (preload ile) |
| Tauri | `tauri` | `llm.js` | SPA istemcisi | `await askLLM('Merhaba')`; sunucu: `npm run llm` |
| Fastify, Koa, Hono ve NestJS | `fastify/koa/hono/nestjs` | `llm.js` | Elle bağlantı; otomatik framework enjeksiyonu yok | Sunucuda `llm.fetch(request)` / `llm.handle(...)` |
| Python | `python` | `llm_client.py` | `main.py` / `app.py` / `manage.py` | `ask_llm("Merhaba")` |
| .NET ve .NET Framework | `dotnet` | `LlmClient.cs` | `Program.cs` / `Startup.cs` / `HomeController.cs` / `Form1.cs` | `await LlmClient.AskAsync("Merhaba")` |

Express ESM/CommonJS ve TypeScript, SPA React/Vue/Vite/Angular/Svelte, Next.js App Router, Nuxt 3; Python Flask/FastAPI/Django ve .NET web/masaüstü hostları için kullanılır. `fastify/koa/hono/nestjs` grubunda CLI için tek tipi seçin (ör. `--type hono`).

.NET 4.0 çağıranları `Task` devamlarını (`ContinueWith`) kullanır; tablodaki `await` örneği modern/4.5+ hedefler içindir. Hedefe göre istemci seçimi [entegrasyon kılavuzunda](docs/ENTEGRASYON.md#net-ve-net-framework) açıklanır.

Tüm senaryoların sade ve adım adım açıklamaları için **[docs/ENTEGRASYON.md](docs/ENTEGRASYON.md)** kılavuzuna bakın.

```js
import { createLLMManager } from '@sirrakadembasti/llm-manager/core';

const llm = createLLMManager({ adminPassword: process.env.LLM_ADMIN_PASSWORD }); // data/ ve anahtar otomatik hazırlanır

// Doğrudan soru sorma:
const cevap = await llm.ask('Merhaba!');

// Next.js / SvelteKit / Hono standart Web Request -> Response adaptörü:
const response = await llm.fetch(request);
```

## Desteklenen ortamlar matrisi

| Ortam | Tip | Üretimde kullanım | Ayrı Node süreci | Otomatik enjeksiyon |
| --- | --- | --- | --- | --- |
| Express | express | Kalıcı disk/host store ile | Hayır | Evet |
| SPA | spa | Kendi backend'iniz üzerinden önerilir | Evet | Evet; HTTP istemci yardımcısı |
| Next.js | nextjs | Node runtime + kalıcı disk/host store | Hayır | Yalnız sunucu bileşeni |
| Nuxt | nuxt | Node sunucusunda | Hayır | İstemci bileşenine yapılmaz |
| SvelteKit | sveltekit | Node adaptörü + kalıcı store | Hayır | İstemci bileşenine yapılmaz |
| Electron | electron | Ana süreç, userData deposu | Hayır | Ana süreç |
| Tauri | tauri | HTTP istemcisi | Evet | Hayır |
| Fastify, Koa, Hono ve NestJS | fastify/koa/hono/nestjs | Host auth adaptörüyle | Hayır | Hayır; elle bağlantı |
| Python | python | HTTP istemcisi | Evet | Yardımcı import |
| .NET ve .NET Framework | dotnet | HTTP istemcisi | Evet | Yardımcı namespace |

Sunucusuz dağıtım için Node runtime ve kalıcı host deposu gerekir; Edge desteklenmez. SPA/Tauri/Python/.NET istemcileri ayrı çalışan yönetim sunucusuna HTTP ile bağlanır. Express 4.19+ ve 5.x desteklenir (peer aralığı: `^4.19.2 || ^5.0.0`; 4.x için minimum 4.19.2). Express isteğe bağlı peer bağımlılıktır; Express adaptörü veya CLI yönetim sunucusu için ayrıca kurulu olmalıdır. Paketsiz statik SPA yalnız HTTP istemcisi üretir; `npm run llm` için Node hostunda paket ve Express kurulumu gerekir.

## API ve depo sözleşmesi

Varsayılan kök `/api/llm`:

| İşlem | Yol |
| --- | --- |
| Katalog/profiller | `GET /catalog`, `GET /profiles` |
| Ekle/düzenle/sil | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Etkinleştir | `POST /profiles/:id/activate` |
| Test | `POST /profiles/:id/test`, JSON `{ "mode": "quick" }` veya `conversation` |
| Model listesi | `GET /profiles/:id/models` |
| Model yanıtı (Runtime) | `POST /chat`, JSON `{ "prompt": "..." }` veya `{ "messages": [...] }` |

`POST /chat` uç noktası etkin profili (veya isteğe bağlı `profileId` değerini) kullanarak
model çağrısını sunucu tarafında yürütür ve yalnız `{ ok: true, content, profileId, profileName, provider, model, durationMs }`
döndürür; API anahtarını asla açığa çıkarmaz. `mountLLMManagement` içinde `chatAccess`
seçeneği ile erişim düzeyi `'authenticated'` (varsayılan: giriş yapmış tüm kullanıcılar),
`'admin'` (yalnız yöneticiler) veya `false` (kapalı) olarak ayarlanabilir.

`createLLMProfileStore` yerine host deposu da verilebilir: `list`, `get`, `getActive`,
`save`, `remove`, `activate`, `recordTest(id,status,expectedRevision,details)`.
`get` yalnız sunucu tarafında çözülen `apiKey` içerir; `list`/`save` anahtarı
asla açığa çıkarmamalıdır. Bulunamayan profillerde `code: 'PROFILE_NOT_FOUND'` (`HTTP 404`),
revizyon uyuşmazlığında `code: 'PROFILE_CONFLICT'` (`HTTP 409`) döndürülür. Başka depo
kullanıyorsanız aynı güvenlik ve revizyon sözleşmesini uygulayın.

Tüm metotlar aşağıdaki değeri doğrudan veya `Promise<T>` olarak döndürebilir;
çekirdek sonuçları bekler ve reddedilen yazma işlemlerinin hata kodlarını korur.
`Public` sır içermeyen profil DTO'su, `Internal` sunucuya özel `apiKey` ve `transport`
içeren profil, `List` ise `{ version: 1, activeId, profiles: Public[] }` anlamındadır.

| Metot | Parametreler | Dönüş (`T` veya `Promise<T>`) | Fırlatılan hata kodları |
| --- | --- | --- | --- |
| `list` | — | `List` | Depoya özgü I/O hataları |
| `get` | `id` | `Internal` veya `null` | Depoya özgü I/O hataları |
| `getActive` | — | `Internal` veya `null` | Depoya özgü I/O hataları |
| `save` | Yeni profil veya `id` ve `revision` içeren güncelleme | `Public` | `PROFILE_INVALID`, `RUNTIME_OPTIONS_INVALID`, `AI_CREDENTIAL_ENDPOINT_MISMATCH`, `PROFILE_NOT_FOUND`, `PROFILE_CONFLICT` |
| `remove` | `id, revision` | `List` (veya `{ ok: true }`) | `PROFILE_NOT_FOUND`, `PROFILE_CONFLICT` |
| `activate` | `id, revision` | `List` | `PROFILE_NOT_FOUND`, `PROFILE_CONFLICT` |
| `recordTest` | `id, status, expectedRevision?, details?` | `Public` veya eski revizyonda `null` | `PROFILE_NOT_FOUND`, `PROFILE_INVALID` |

Hatalar sır içermeyen mesaj ve `code` taşır; tercihen `LLMError` kullanın.
Yeni profil `name`, `provider`, `model`, `baseURL` ve `apiKey` gerektirir.
Güncellemede `id` ve güncel `revision` zorunludur; boş/eksik `apiKey` mevcut
anahtarı korur, ancak sağlayıcı/adres değişikliğinde yeni anahtar gerekir.
`get`/`getActive` sonuçlarını istemciye veya loga göndermeyin. `save`, `remove`,
`activate`, `recordTest` ve `list` sonuçları anahtar içermemelidir. `status`
`passed | failed`, `details` ise `mode`, `durationMs` ve isteğe bağlı `code` içerir.
Test kaydı revizyonu değiştirmez; profil test sırasında değişmişse `recordTest`
sonucu `null` olmalıdır. Revizyon denetimi ve yazma aynı atomik işlemde yapılmalıdır.

Bağımlılıksız async Map örneği: [`examples/memory-store.js`](examples/memory-store.js).
`createMemoryStore()` sonucunu `createLLMManager({ store })` veya
`mountLLMManagement(app, { store })` ile kullanın. Bu tek süreçli geçici örnek,
`apiKey` değerini açık bellekte tutar ve yeniden başlatmada veriyi kaybeder;
kalıcı depolama ve şifreleme hostun sorumluluğundadır.

## Gecikme ve dış sebepler

MiMo otomatik ayarında `purpose: 'diagnostic'` ve `purpose: 'quick'` derin düşünmeyi kapatır (`resolveRuntimeOptions` üzerinden hem yerleşik çağrılara hem özel `generate` adaptörlerine iletilir); `purpose: 'default'` uygulama çağrıları otomatikte modelin varsayılan davranışını korur. Açık düşünme seçiminiz diagnostic/default çağrılarında korunur; MiMo quick testi açık seçimde de düşünmeyi kapatır.
Bu, sağlayıcının hızını garanti etmez. Kota/429, sağlayıcı yoğunluğu/5xx, API
yetkisi/401–403, DNS/proxy/ağ ve modelin boş/kesilmiş yanıtı ayrı hata kodlarıyla
raporlanır. Gizli muhakeme kullanıcıya gösterilmez; yalnız son cevap kullanılır.

[Xiaomi düşünme ve gecikme sözleşmesi](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking).

## Dosya yapısı ve paket alt yolları

- `llm-manager` (`src/index.js`): Express adaptörü (`mountLLMManagement`) ve temel API'ler.
- `@sirrakadembasti/llm-manager/core` (`src/core.js`): Framework-bağımsız çekirdek (`createLLMManager`, `createUiAssets`).
- `@sirrakadembasti/llm-manager/init` (`src/init.js`): Etkileşimli kurulum sihirbazı, otomatik kod enjeksiyonu, iç doğrulama ve canlı `/llm` yoklaması (`runInteractiveInit`, `initLLMProject`, `detectProjectType`, `detectEntryFile`, `injectIntoEntryFile`, `verifyIntegration`, `formatVerificationReport`, `probeAndOpenBrowser`).
- `@sirrakadembasti/llm-manager/setup` (`src/setup.js`): Şifreleme anahtarı üretimi ve doğrulaması (`ensureLLMEncryptionKey`).
- `@sirrakadembasti/llm-manager/runtime` (`src/runtime.js`): Sağlayıcı istek oluşturma, model çağrısı ve hata sınıflandırma.
- `@sirrakadembasti/llm-manager/transport` (`src/providerTransport.js`): SSRF ve DNS rebinding korumalı HTTPS taşıyıcısı (`providerFetch`, `createPublicLookup`).
- `bin/`: CLI girişi (`npx llm-manager`). `public/`: bağımsız yönetim sayfası.
- `examples/`: güvenli yerel başlatma örneği (SHA-256 sabit zamanlı Basic Auth). `tests/`: host projesini import etmeyen bağımsız kontroller.

Eklenti dağıtımı kullanıcı verilerini/anahtarlarını içermez.


## Sağlayıcı uyumluluğu ve revizyon sözleşmesi

Xiaomi için PAYG / Token Plan hizmet seçimi vardır; bilinen Xiaomi adreslerinde anahtar türü uyuşmazlığı reddedilir. 402 ödeme/bakiye, 403 erişim izni olarak ayrılır. Kısa test en çok 20 saniye ve 512 token kullanır. Her amaçta kesilmiş yanıt reddedilir; sağlayıcı yanıtı 2 MiB ile sınırlıdır. Yerel geliştirme için `allowLocalHttp: true` seçeneği (veya `LLM_ALLOW_LOCAL_HTTP=true`) `createLLMProfileStore`, `createLLMManager`, `generateProfileResponse` ve `providerFetch` katmanlarında desteklenir.

Profil güncellemede `revision`, silme ve etkinleştirmede JSON gövdesindeki `revision` zorunludur. Doğrudan depo çağrıları `store.activate(id, revision)` ve `store.remove(id, revision)` biçimindedir. Revizyonsuz eski kayıtlarda listeden gelen açık `null` değeri ilk değişiklik için geçerlidir; eksik alan kabul edilmez. Profilin HTTPS adresi veya sağlayıcısı değişirse yeni anahtar girilmelidir. Yalnız profil adı veya zaman/token sınırları değiştiğinde önceki test geçmişi (`lastTests` ve `lastTest`) korunur; sağlayıcı, adres, model veya API anahtarı değiştiğinde sıfırlanır. Yönetim arayüzü bu sözleşmeye uyar. Çok süreçli kullanım dosya kilidiyle desteklenir; ağ dosya sistemlerinde (NFS/SMB) garanti verilmez.

### Kurumsal Proxy ve LAN Modelleri (SSRF Güvenliği)

- **Kurumsal Proxy (`proxyUrl` / `LLM_HTTPS_PROXY`):** Şirket içi ağlarda dış API isteklerini bir HTTPS vekili üzerinden geçirmek için `proxyUrl` seçeneği desteklenir. Proxy kullanıldığında DNS çözümü vekil sunucuda yapıldığı için yerel soket düzeyindeki DNS filtresi devre dışı kalır. Bu güvenlik ödünleşimini dengelemek adına eklenti, proxy üzerinden çıkış yapılacak hedef adresleri katalogdaki **bilinen resmi sağlayıcı alan adları** ve açıkça izin verilen `allowedHosts` listesiyle sınırlandırır (`LLM_DNS_BLOCKED`).
- **Yerel / LAN Model Sunucuları (`allowedPrivateHosts` / `LLM_ALLOWED_PRIVATE_HOSTS`):** Yerel ağdaki Ollama, LM Studio veya vLLM sunucularına (`http://192.168.1.50:11434`, `http://ollama.lan`) bağlanmak için `allowedPrivateHosts: ['192.168.1.50:11434', 'ollama.lan']` seçeneği kullanılır. Yalnızca bu açık listedeki adresler için özel IP ve HTTP protokolüne izin verilir; diğer tüm hedeflerde genel HTTPS zorunluluğu ve SSRF koruması aktif kalır.

`mountLLMManagement` için isteğe bağlı `testMessages(mode, profile)` ve `validateTestReply(reply, {mode, profile})` parametreleri host uygulamasına özgü test sağlar. Varsayılan sohbet testi, web uygulamalarında kimlik doğrulama güvenliğini soran nötr bir örnek kullanır. Sır içeren iç profili loglamayın. Anahtarlar otomatik olarak başka hizmete taşınmaz.

## Lisans ve sürümleme

MIT lisansı ([LICENSE](LICENSE)). [Semantic Versioning](https://semver.org/lang/tr/) izlenir;
sürüm yayını için `npm run release:patch|minor|major` çalıştırın (test, sürüm artışı ve git etiketi).

### Web ve sohbet kimlik doğrulaması

`createLLMManager({ adminPassword: process.env.LLM_ADMIN_PASSWORD, chatTokens: process.env.LLM_CHAT_TOKENS })` Web adaptörünü korur. `/llm`, betik ve yönetim API'si admin kimliği gerektirir. Yapılandırma yoksa `AUTH_NOT_CONFIGURED` ile kapalı kalır. `authorize: async request => principal | null` ile host kimliği kullanılabilir; `fetch(request, options)` çağrısındaki seçenekler varsayılanları ezer.

İstek kotası önce hostun `clientKey` / Web `getClientId(request)` değerini (Express'te `req.ip`), ardından `principal.id` değerini kullanır. Web'de farklı kullanıcıları ayırmak için host kararlı bir `principal.id` sağlamalıdır; kimlik yoksa ortak anonim kota uygulanır. Profil değiştirmek test/model kotasını yenilemez; model önizleme ve profil model listesi aynı kotayı paylaşır. Sohbet kotası ayrıdır. Express IP tespitinde host `trust proxy` ayarından sorumludur. `rateLimit: false` kotaları kapatır.

| Kimlik | Erişim | Saklama |
|---|---|---|
| Basic admin veya host principal (`isAdmin: true`) | Yönetim ve sohbet | Sunucuda ortam değişkeni/session |
| Bearer sohbet belirteci (`LLM_CHAT_TOKENS`) | Yalnız POST /chat; admin override alanları uygulanmaz | Üretimde kendi backend'inizde |

SPA/Tauri kurulumunda Vite algılanırsa geliştirme origin'i `http://localhost:5173` olur. Diğer projelerde sihirbaz origin adresini sorar; `-y` modunda açık adres verilmediyse CORS kapalı kalır. `LLM_ALLOWED_ORIGINS` veya init API'sindeki `allowedOrigins` ile açık http/https origin listesi verin. Sihirbaz `*` kabul etmez.

Tarayıcıya gönderilen değerler herkese açıktır. SPA geliştirme belirteci yalnız sohbet içindir. `chatAccess: 'admin'` Bearer sohbet erişimini de engeller. `insecureNoAuth: true` yalnız açıkça istenen güvensiz yerel kullanım içindir. `ask()` ve `handle()` host koduna yönelik güvenilir API'lerdir; HTTP erişim kontrolü adaptörlerde yapılır.

Kurulum parolayı `.env` içinde, SPA sohbet belirtecini `.env.local` içinde saklar; `.gitignore` gerekli sır dosyalarını dışlar. Parola kaynak koda veya npm script'ine yazılmaz. Tekrarlanan kurulum mevcut üretilmiş kimlik bilgilerini korur.

## 1.x'ten 2.0'a geçiş

npm üzerindeki `llm-manager` paketi bu projeyle ilgili değildir. Yukarıdaki çıplak `npx llm-manager` komutları yalnız bu proje hosta kurulduktan sonra yerel bin için kullanılır. Çalışma ağacındaki 2.0 sürümü, bir npm yayını veya Git etiketi yayımlandığı anlamına gelmez.

```bash
npm uninstall llm-manager
npm install github:sirrakadembasti/llm-manager
```

Importları `@sirrakadembasti/llm-manager` adına taşıyın. CLI adı ve `data/`/anahtar dosyaları değişmez. Dosya deposunun tüm metotlarını `await` edin. Sihirbaz senkron API'sini `/init` alt yolundan alın; kökteki eski async sarmalayıcılar deprecated olarak kalır. Host depoları senkron veya Promise döndürebilir.

| Depo metodu | Dönüş |
|---|---|
| `list()` | `{ version, activeId, profiles }` |
| `get(id)`, `getActive()` | İç profil veya null; yalnız sunucu tarafı anahtar |
| `save(input)` | Sır içermeyen genel profil |
| `remove(id, revision)`, `activate(id, revision)` | Güncel liste |
| `recordTest(id, status, expectedRevision, details)` | Genel profil veya revizyon değiştiyse null |

Dosya deposu her dönüşü Promise ile sağlar; host deposu `T | Promise<T>` kullanabilir. Güncelleme/silme/etkinleştirme revizyon denetimi yapar; `PROFILE_CONFLICT` 409 ve `PROFILE_NOT_FOUND` 404 hataları aynı sözleşmeyle korunmalıdır. Yerel diskte çok süreçli kullanım dosya kilidiyle desteklenir; NFS/SMB için garanti verilmez. Anahtar önceliği açık `encryptionKey` > `LLM_CONFIG_ENCRYPTION_KEY` > anahtar dosyasıdır. `ensureLLMEncryptionKey` varsayılan olarak `.env` yazmaz; eski davranış yalnız deprecated `writeEnv: true` seçeneğidir.

`purpose` artık `quick | diagnostic | default` kullanır; eski `manager` ve `production` değerleri her eski ad için bir kez uyarılarak eşlenir. Kaldırılan eski seçenek alanları artık custom generate adaptörlerine aktarılmaz. `ask()` varsayılan olarak string; `{ raw: true }` ile kullanım ve finishReason içeren sonuç döndürür. HTTP sohbeti SSE için `{ stream: true }` kabul eder.

Katalog tarihi **2026-10-24**; resmi kaynaklarla doğrulanmayan model önerileri kaldırıldı. Güncel hesap listeniz için **Modelleri getir** kullanın; [kaynak kayıtları](docs/roadmap/CATALOG_SOURCES_2026-10-24.md) model/transport sınırlarını açıklar. Düşünme ayarı destekleyen sağlayıcılarda görünür; her model düşünmeyi kapatmayı desteklemez. Güncel Claude Opus/Fable modellerinde kapatma isteği açık doğrulama hatası verir.

Arayüz `locale: 'tr' | 'en'` ve `homeUrl` seçeneklerini destekler. Yedek profil seçimi sırasını korur; geçiş yalnız retryable hatalarda gerçekleşir. Toplam retry/fallback bütçesi profil timeout'unu aşmaz. İsteğe bağlı `usageLog: true` içerik kaydetmeden aylık JSONL istatistiği tutar; `/usage?month=YYYY-MM` admin erişimi ister. `logger` kancası request-id ile ilişkilidir ve içerik/sırları maskeler. `/health` sır içermez, `health: false` ile kapatılır.

Tüm yeni entegrasyon ayrıntıları ve desteklenen ortamlar [entegrasyon kılavuzundadır](docs/ENTEGRASYON.md). Docker, PM2, systemd ve Windows hizmet örnekleri [dağıtım kılavuzundadır](docs/DEPLOY.md).
