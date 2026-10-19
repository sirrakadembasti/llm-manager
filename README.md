# LLM Manager

Node.js 22.23.2+ ve Express için bağımsız sağlayıcı/profil yönetimi eklentisi.
Herhangi bir host uygulamaya, Docker, frontend framework veya veritabanı gerektirmeden eklenir. Node/npm gerekir.
Windows, Linux ve macOS üzerinde aynı kaynak kodu kullanır.

## Özellikler

> Sürüm geçmişi için [CHANGELOG.md](CHANGELOG.md) dosyasına bakın. Yazma isteklerinde CSRF başlığı
> `X-LLM-CSRF: 1` olmalıdır.

- 20 hazır sağlayıcı kataloğu (varsayılan model listeleri ve bölgesel uç noktalarla) + özel OpenAI uyumlu sağlayıcı; listeden model seçme, elle API adresi/model girme veya sağlayıcıdan model listesini getirme.
- Profil ekleme/düzenleme/silme ve tek etkin profil; mevcut API anahtarını koruma ve 3 durumlu şifreli anahtar rozeti/durum bildirimi.
- AES-256-GCM (12 bayt IV ve 16 bayt doğrulama etiketi zorunluluğu) ile şifreli anahtarlar, güvenli atomik dosya yazımı, revizyon denetimi.
- Yanıt süresi: 5–300 saniye, varsayılan 120 saniye. Token bütçesi: 256–32768,
  varsayılan 8192. Düşünme: otomatik/açık/kapalı (MiMo).
- Kısa bağlantı testi ve ayrı sohbet testi; süre, zaman, hata kodu ve iki testin
  ayrı tarihçesi (sağlayıcı, adres, model veya anahtar değişmediği sürece korunur). Başarı, test anını gösterir; uygulama üretim kabulü değildir.
- Yönetici yetkisi, CSRF başlığı, güvenlik ve önbellek başlıkları (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`), HTTPS sağlayıcı adresi, gerçek DNS/socket bağlantısında özel IPv4/IPv6 engelleme; sağlayıcı hata metinlerini/anahtarları gizleme.
- Çift gönderim/işlem kilidi, bekleme süresi, zaman aşımı ve model listesi getirirken bile korunan form durumu.

## Kurulum ve kendi başına çalıştırma

### CLI (`npx llm-manager`)

```sh
LLM_ADMIN_USER=kullanici LLM_ADMIN_PASSWORD=guclu-parola npx github:sirrakadembasti/llm-manager --port 8010
```

Seçenekler: `-p/--port`, `-h/--help`, `-v/--version`. Çalışma dizinindeki `.env`
otomatik okunur; veriler `./data/` altında tutulur.

### Kaynaktan


```sh
npm ci
npm test
```

Örnek sunucu için `LLM_ADMIN_USER` ve `LLM_ADMIN_PASSWORD` ortam değişkenlerini
kendiniz tanımlayıp `npm start` çalıştırın. Varsayılan kullanıcı/parola yoktur.
Sunucu yalnız `127.0.0.1:8010` adresini dinler; `/llm` sayfasını açın. Örnek Basic
authentication yerel deneme içindir; başka bilgisayarlara açmak için host
uygulamanızın session/rol sistemi ve HTTPS reverse proxy kullanın.

Windows PowerShell örneği (değerleri kendi seçiminizle değiştirin):

```powershell
$env:LLM_ADMIN_USER = 'kendi-kullanici-adiniz'
$env:LLM_ADMIN_PASSWORD = 'kendi-guclu-parolaniz'
npm start
```

Linux/macOS üzerinde aynı iki ortam değişkenini `export` ile tanımlayın.

API anahtarlarınızı yalnız arayüzden girin. `data/` altındaki profil ve şifreleme
anahtarı dosyalarını kaynak depoya eklemeyin. Profil dosyasını **ve şifreleme
anahtarını** birlikte yedekleyin. Anahtar kaybolursa mevcut şifreli profiller
çözülemez; eklenti otomatik anahtar değiştirerek kayıtları bozmaz.

## Başka uygulamaya entegrasyon

Bu klasörü uygulamanın yanına koyup uygulamanızda:

```sh
npm install ../llm-manager --install-links
# veya GitHub reposundan: npm install github:sirrakadembasti/llm-manager
```

Paket kopyalanır ve bağımlılıkları host tarafından çözülür; geliştirme symlink'ine
bağımlı değildir. Sürüm değişince yeniden kurun. npm registry'ye yayınlamak gerekmez.

```js
import express from 'express';
import path from 'node:path';
import { createLLMProfileStore, mountLLMManagement, generateProfileResponse }
  from 'llm-manager';
import { ensureLLMEncryptionKey } from 'llm-manager/setup';

const app = express();
app.use(express.json({ limit: '32kb' }));
const filePath = path.resolve('data/llm-profiles.json');
const encryptionKey = ensureLLMEncryptionKey({ profilePath: filePath,
  environment: { ...process.env, NODE_ENV: 'production' } });
const store = createLLMProfileStore({ filePath, encryptionKey });

// Host session middleware'iniz req.user bilgisini yüklemelidir.
const requireAuth = (req, res, next) => {
  if (!req.user) return res.sendStatus(401);
  req.user.isAdmin = req.user.roles?.includes('admin') === true;
  next();
};
mountLLMManagement(app, { store, requireAuth,
  pagePath: '/llm', apiPath: '/api/llm' });

// Model çağrısı yalnız backend'de yapılır; API anahtarı tarayıcıya verilmez.
async function askManager(messages, signal) {
  const profile = store.getActive();
  if (!profile) throw new Error('Etkin profil seçilmedi.');
  return generateProfileResponse(messages, profile, { purpose: 'manager', signal });
}
```

Mevcut `generate(messages, options)` adaptörünüz varsa `mountLLMManagement`
seçeneklerine `generate` verin. Adaptör `timeoutMs`, `maxOutputTokens`, `thinking`,
`purpose`, `provider`, `transport`, `baseURL`, `model`, `apiKey` alanlarını uygulamalı,
gerçek model metni döndürmeli; testte sahte başarı üretmemelidir.

Eklenti kendi yönetim sayfası ve API yanıtlarında `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` ve yönetim HTML sayfasında
`Content-Security-Policy` başlıklarını otomatik uygular; Express 4 üzerinde asenkron
depo/yönlendirici hatalarını `next(err)` ile host hata katmanına iletir. Host uygulama
session cookie ayarlarını, Origin/CORS politikasını, istek boyutu ve hız sınırlarını
uygulamalıdır. Eklenti kendi yazma API'lerinde `X-LLM-CSRF: 1` başlığını ister. Host
fetch istemcisi bu başlığı ve kendi session cookie'sini gönderir. `requireCsrf: false`
yalnız host eşdeğer CSRF denetimi uyguluyorsa kullanılmalıdır. Aynı profil dosyasında
tek yazıcı süreç çalıştırın; çok süreç/çok sunucu için host veritabanı deposu adaptörü
kullanın.

### Express dışı (framework-agnostik) ve çoklu platform entegrasyonları

Express kullanmayan projeler (Fastify, Koa, Next.js, Hono, Electron Main Process vb.)
`llm-manager/core` alt modülünü doğrudan import edebilir; SPA (React/Vue/Vite),
Tauri masaüstü veya Python/Go/C# sunucu uygulamaları ise `npx llm-manager` servisini
`POST /api/llm/chat` uç noktası üzerinden çağırabilir:

| Uygulama Türü | Önerilen Yöntem | Çağrı Noktası |
| --- | --- | --- |
| **Express.js Sunucu** | `mountLLMManagement(app, ...)` | `generateProfileResponse()` veya `POST /api/llm/chat` |
| **SPA / Statik Web (React, Vue, Vite)** | `npx llm-manager` + `LLM_ALLOWED_ORIGINS` | `POST /api/llm/chat` |
| **Full-Stack (Next.js, Nuxt, SvelteKit)** | `llm-manager/core` (`createLLMManager`) | Server Action / Route Handler |
| **Diğer Diller (Python, Go, C#, PHP)** | Yerel Sidecar (`npx llm-manager`) | `POST http://127.0.0.1:8010/api/llm/chat` |
| **Masaüstü (Electron / Tauri)** | Electron IPC (`llm-manager/core`) veya Sidecar | `ipcMain.handle` veya `POST /api/llm/chat` |

Tüm senaryoların adım adım kurulum ve kod örnekleri için **[docs/ENTEGRASYON.md](docs/ENTEGRASYON.md)** kılavuzuna bakın.

```js
import { createLLMManager, createLLMProfileStore, createUiAssets } from 'llm-manager/core';

const store = createLLMProfileStore({ filePath, encryptionKey });
const manager = createLLMManager({ store });
const { html, script } = createUiAssets({ apiPath: '/api/llm', pagePath: '/llm' });

// Kimlik doğrulama, yönetici yetkisi ve CSRF denetimi host sorumluluğundadır.
// Eşleşen yollarda { status, body }, eşleşmeyenlerde null döner:
const result = await manager.handle({ method: 'GET', path: '/profiles', body: null });
```

## API ve depo sözleşmesi

Varsayılan kök `/api/llm`:

| İşlem | Yol |
| --- | --- |
| Katalog/profiller | `GET /catalog`, `GET /profiles` |
| Ekle/düzenle/sil | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Etkinleştir | `POST /profiles/:id/activate` |
| Test | `POST /profiles/:id/test`, JSON `{ "mode": "quick" }` veya `conversation` |
| Model listesi | `GET /profiles/:id/models` |
| Model yanıtı (Runtime) | `POST /chat`, JSON `{ "messages": [...], "profileId"?, "purpose"? }` |

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

## Gecikme ve dış sebepler

MiMo otomatik ayarında `purpose: 'manager'` ve `purpose: 'quick'` derin düşünmeyi kapatır (`resolveRuntimeOptions` üzerinden hem yerleşik çağrılara hem özel `generate` adaptörlerine iletilir); üretim ajanları otomatikte modelin varsayılan davranışını korur. Açık düşünme seçiminiz korunur.
Bu, sağlayıcının hızını garanti etmez. Kota/429, sağlayıcı yoğunluğu/5xx, API
yetkisi/401–403, DNS/proxy/ağ ve modelin boş/kesilmiş yanıtı ayrı hata kodlarıyla
raporlanır. Gizli muhakeme kullanıcıya gösterilmez; yalnız son cevap kullanılır.

[Xiaomi düşünme ve gecikme sözleşmesi](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking).

## Dosya yapısı ve paket alt yolları

- `llm-manager` (`src/index.js`): Express adaptörü (`mountLLMManagement`) ve temel API'ler.
- `llm-manager/core` (`src/core.js`): Framework-bağımsız çekirdek (`createLLMManager`, `createUiAssets`).
- `llm-manager/setup` (`src/setup.js`): Şifreleme anahtarı üretimi ve doğrulaması (`ensureLLMEncryptionKey`).
- `llm-manager/runtime` (`src/runtime.js`): Sağlayıcı istek oluşturma, model çağrısı ve hata sınıflandırma.
- `llm-manager/transport` (`src/providerTransport.js`): SSRF ve DNS rebinding korumalı HTTPS taşıyıcısı (`providerFetch`, `createPublicLookup`).
- `bin/`: CLI girişi (`npx llm-manager`). `public/`: bağımsız yönetim sayfası.
- `examples/`: güvenli yerel başlatma örneği (SHA-256 sabit zamanlı Basic Auth). `tests/`: host projesini import etmeyen bağımsız kontroller.

Eklenti dağıtımı kullanıcı verilerini/anahtarlarını içermez.


## Sağlayıcı uyumluluğu ve revizyon sözleşmesi

Xiaomi için PAYG / Token Plan hizmet seçimi vardır; bilinen Xiaomi adreslerinde anahtar türü uyuşmazlığı reddedilir. 402 ödeme/bakiye, 403 erişim izni olarak ayrılır. Kısa test en çok 20 saniye ve 512 token kullanır. Her amaçta kesilmiş yanıt reddedilir; sağlayıcı yanıtı 2 MiB ile sınırlıdır. Yerel geliştirme için `allowLocalHttp: true` seçeneği (veya `LLM_ALLOW_LOCAL_HTTP=true`) `createLLMProfileStore`, `createLLMManager`, `generateProfileResponse` ve `providerFetch` katmanlarında desteklenir.

Profil güncellemede `revision`, silme ve etkinleştirmede JSON gövdesindeki `revision` zorunludur. Doğrudan depo çağrıları `store.activate(id, revision)` ve `store.remove(id, revision)` biçimindedir. Revizyonsuz eski kayıtlarda listeden gelen açık `null` değeri ilk değişiklik için geçerlidir; eksik alan kabul edilmez. Profilin HTTPS adresi veya sağlayıcısı değişirse yeni anahtar girilmelidir. Yalnız profil adı veya zaman/token sınırları değiştiğinde önceki test geçmişi (`lastTests` ve `lastTest`) korunur; sağlayıcı, adres, model veya API anahtarı değiştiğinde sıfırlanır. Yönetim arayüzü bu sözleşmeye uyar. Dosya deposu tek yazıcı/süreç içindir; çok süreçli CAS garantisi vermez.

`mountLLMManagement` için isteğe bağlı `testMessages(mode, profile)` ve `validateTestReply(reply, {mode, profile})` parametreleri host uygulamasına özgü test sağlar. Varsayılan sohbet örneği değiştirilmediyse Manager örneği kalır. Sır içeren iç profili loglamayın. Anahtarlar otomatik olarak başka hizmete taşınmaz.

## Lisans ve sürümleme

MIT lisansı ([LICENSE](LICENSE)). [Semantic Versioning](https://semver.org/lang/tr/) izlenir;
sürüm yayını için `npm run release:patch|minor|major` çalıştırın (test, sürüm artışı ve git etiketi).
