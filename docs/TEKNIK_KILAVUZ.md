# Teknik kılavuz

Node.js **22.12+** için sağlayıcı, profil ve şifreli API anahtarı yönetimi. Bağımsız sunucu veya uygulama eklentisi olarak çalışır; Docker ve veritabanı isteğe bağlıdır.

Paket **`@sirrakadembasti/llm-manager`**, komut `llm-manager`. npm'deki kapsam adı olmayan paket başka projeye aittir. Yerel **2.0.0 / yayımlanmamış** durumu npm yayını veya Git etiketi kanıtı değildir.

[Kullanıcı kılavuzu](KULLANICI_KILAVUZU.md) · [Başlangıç](../README.md) · [Entegrasyon](ENTEGRASYON.md) · [Dağıtım](DAGITIM.md) · [Yol haritası](roadmap/YOL_HARITASI.md)

## Kaynaktan başlatma

Depoda PowerShell ile:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Mevcut ayarları koruyarak `.env` içinde `LLM_ADMIN_USER=admin` ve `LLM_ADMIN_PASSWORD=kendi-guclu-parolaniz` tanımlayın. `npm start` çalıştırın; **http://127.0.0.1:8010/llm** adresinde giriş yapın. Sağlayıcı profilini kaydedip test edin ve etkinleştirin. Durdurma: **Ctrl+C**. Linux/macOS aynı `.env` ayarlarını ve `npm ci` / `npm start` komutlarını kullanır.

Express kurulu Node uygulamasında GitHub üzerinden doğrudan çalıştırma:

```sh
npx github:sirrakadembasti/llm-manager --password kendi-guclu-parolaniz --port 8010
```

Express adaptörü ve CLI sunucusu isteğe bağlı eş bağımlılık Express **4.19.2+ veya 5.x** gerektirir. Kaynakta `npm ci` bunu kurar; yalnız çekirdek kullanımı Express gerektirmez. Sunucu adresi, veri dizini ve sohbet belirteci seçenekleri için `--help` kullanın. CLI ve `npm start`, çalışma dizininin `.env` dosyasını okur; süreç ortamı önceliklidir. Ortam atamaları dosyaya yazılmaz. Elle kütüphane entegrasyonunda ortam dosyasını ana uygulama yükler.

Windows PATH değeri [cmd.exe'nin 8191 karakter sınırını](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation) aşarsa npm betikleri kurulu Node'u bulamayabilir. Eski girdileri kaldırıp terminali yenileyin. .NET doğrulaması geçici SDK araç yollarını kalıcı PATH'e eklemez.

## Entegrasyon

Ana proje klasöründe:

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

Sihirbaz projeyi algılar, dosyaları değiştirmeden önce onay alır, kurulumu doğrular ve `/llm` sayfasını açar. Yalnız paket kurulduktan sonra yalın `npx llm-manager` kullanın. Windows'ta yayımlanmamış yerel kod `npm install "F:\projeler\llm-manager" express` ile kurulabilir.

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';
const app = express();
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD
});
app.listen(3000);
// Sunucuda: const cevap = await llm.ask('Merhaba');
```

Web Request kullanan uygulamada `/core` üzerinden yönetici oluşturup `llm.fetch(request)` çağırın. Doğrudan `ask()`/`handle()` güvenilir ana uygulama API'leridir; HTTP yetkilendirmesini adaptörde uygulayın.

## Desteklenen ortamlar

| Ortam | Tür | Dağıtım | Ayrı Node süreci | Kod ekleme |
| --- | --- | --- | --- | --- |
| Express | express | Kalıcı disk/ana uygulama deposu | Hayır | ESM/CJS/TypeScript |
| SPA | spa | Üretimde kendi sunucu uygulamanız | Evet | HTTP istemci yardımcısı |
| Next.js | nextjs | App Router, Node çalışma ortamı | Hayır | Yalnız sunucu bileşenleri |
| Nuxt | nuxt | Node sunucusu | Hayır | İstemci bileşenine sunucu modülü eklenmez |
| SvelteKit | sveltekit | Node adaptörü | Hayır | İstemci bileşenine sunucu modülü eklenmez |
| Electron | electron | Ana süreç, userData deposu | Hayır | Ana süreç/ön yükleme |
| Tauri | tauri | HTTP istemcisi | Evet | Rust/IPC kodu eklenmez |
| Fastify, Koa, Hono, NestJS | fastify/koa/hono/nestjs | Ana uygulama kimliği ve elle köprü | Hayır | Elle |
| Python | python | HTTP istemcisi | Evet | İstemci modülü |
| .NET / .NET Framework | dotnet | HTTP istemcisi | Evet | İstemci ad alanı |

Edge desteklenmez. Sunucusuz Node dağıtımları kalıcı ana uygulama deposu gerektirir; varsayılan yerel dosyalar geçici veya salt okunur olabilir. Gruplanmış çatılardan tek CLI türü seçin. Paketsiz statik SPA yalnız HTTP yardımcıları alır; Node yönetim sunucusu yine paket ve Express gerektirir.

## API ve sınırlar

Sayfa `/llm`, API kökü `/api/llm`. Değişiklik yapan istekler `X-LLM-CSRF: 1` gerektirir.

| İşlem | Göreli yol |
| --- | --- |
| Katalog / profiller | `GET /catalog`, `GET /profiles` |
| Oluştur / güncelle / sil | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Etkinleştir / test et | `POST /profiles/:id/activate`, `POST /profiles/:id/test` |
| Modeller / kaydedilmemiş önizleme | `GET /profiles/:id/models`, `POST /models/preview` |
| Sohbet | `POST /chat`: `{ prompt }` veya `{ messages }` |
| Sağlık / kullanım | `GET /health`, `GET /usage?month=YYYY-MM` |

`ask()` dize döndürür; `{ raw: true }` kullanım, `finishReason`, gerçek profil ve süre bilgisi döndürür. `stream()` bir AsyncIterable'dır; HTTP `{ stream: true }` SSE `delta`/`done`/`error` üretir. `done`, `profileId`/`fallbackUsed` içerir. İstemci bağlantısı kesilirse sağlayıcı işi iptal edilir; doğrudan çağrıda `signal` verilebilir. Gizli düşünce yanıta eklenmez; filtre/kesilme tipli hata üretir.

Yeniden deneme yalnız uygun hatalarda, ilk çıktıdan önce, bekleme süresi ve `Retry-After` gözetilerek yapılır. Çıktıdan sonra yeniden deneme/yedek profile geçiş yapılmaz. Tüm denemeler ve yedek profiller ilk profilin toplam zaman bütçesini paylaşır; `retry: false` yeniden denemeyi kapatır.

| Ayar | Varsayılan / aralık |
| --- | --- |
| `limits.maxMessages` | 100 |
| `limits.maxChars` / `maxSingleMessageChars` | Toplam 200000 / mesaj başına 100000 |
| `limits.maxBodyBytes` | 262144; Express `bodyLimit` önceliklidir |
| Mesaj rolleri | system/user/assistant; en az bir user mesajı |
| `timeoutMs` / `maxOutputTokens` | 120000 ms (5000–300000) / 8192 (256–32768) |
| Gelişmiş | temperature 0–2, topP 0–1, stop en çok 4 dize, responseFormat text/json |
| `thinking` | auto/enabled/disabled; modele bağlı |
| `chatAccess` / `chatOverrides` | authenticated/admin/false; admin/all/none (varsayılan admin) |
| Kotalar | Sohbet 30/dk; test 10/dk; model/önizleme 10/dk; hatalı giriş 10/dk |

Geçersiz mesaj: 400 `MESSAGES_INVALID`; geçersiz JSON: 400 `BODY_INVALID`; büyük gövde: 413 `BODY_TOO_LARGE`. Express kimlik doğrulamasından sonra ayrıştırır; daha önce çalışan ana uygulama ayrıştırıcısı daha küçük sınır koyabilir. Gelişmiş ayarlar seçilen modelin yetenekleriyle uyumlu olmalıdır.

Özel depolar `list`, `get`, `getActive`, `save`, `remove`, `activate`, `recordTest` uygular. Dosya deposu Promise, ana uygulama metotları `T | Promise<T>` döndürebilir. Yalnız iç `get`/`getActive` sonuçları anahtar içerir; genel sonuçlar sır içermez. Güncelleme/silme/etkinleştirme revizyon ister; uyuşmazlık `PROFILE_CONFLICT`/409, bulunamayan profil `PROFILE_NOT_FOUND`/404 olur. Atomik karşılaştırma/yazma ve eski revizyonlu test kaydında null dönüşü korunmalıdır. [Ayrıntılı sözleşme ve bellek örneği](ENTEGRASYON.md#özel-depo).

## Kimlik doğrulama ve gizlilik

Yönetim sayfası/betiği/API'si Basic yönetici veya ana uygulamanın yönetici kimliğini ister. Web yapılandırması eksikse `AUTH_NOT_CONFIGURED` ile erişim kapalıdır. Ana uygulama kimliği için `authorize(request)` verin; çağrı başına fetch seçenekleri varsayılanları geçersiz kılar. Bearer `chatTokens`/`LLM_CHAT_TOKENS` yalnız sohbet içindir; `chatAccess: 'admin'` bunları dışlar. `insecureNoAuth: true` açıkça seçilen güvensiz yerel kullanımdır.

Kotalar `clientKey` veya Web `getClientId(request)` (Express `req.ip`), sonra `principal.id`, sonra ortak anonim havuzu kullanır. Kararlı kimlik kullanın; profil değiştirmek model/test kotasını sıfırlamaz. Express ana uygulaması `trust proxy` ayarını yapar. 429 `Retry-After` içerir; `rateLimit: false` kotaları kapatır. Havuzlar süreç içidir, dağıtık değildir; kimlik doğrulama hataları kullanıcı kimliği oluşmadan sınırlandırılır.

Tarayıcı belirteçleri herkese açıktır; üretimde kendi sunucunuzu kullanın. Sihirbaz parolaları `.env`, SPA geliştirme belirteçleri `.env.local` içinde kalır; sır dosyaları Git dışında tutulur. Vite localhost:5173 kullanır; diğer projeler açık kaynak adresi ister. Adressiz `-y` CORS'u kapalı bırakır. Sihirbaz `*` kabul etmez; CLI jokeri yalnız sohbet içindir ve kimlik bilgisi taşımaz.

HTTPS ve DNS/soket SSRF filtresi varsayılan etkindir. `allowedPrivateHosts` LAN/Ollama adreslerine açık izin verir; `allowLocalHttp` yerel geliştirme istisnasıdır. `proxyUrl`/`LLM_HTTPS_PROXY` DNS'i vekile taşır; yerel IP filtresi uygulanamaz. Hedefler bilinen katalog alan adları ve açık `allowedHosts` listesiyle sınırlandırılır.

`logger` sırları/içeriği maskeler, istek kimliklerini ilişkilendirir. İçerik günlüğü `logContent: false` ile sabittir ve açılamaz. `chat.completed` başarı, hata, iptal ve erken yineleyici dönüşü dahil her mantıksal sohbet için kodu, güvenli kullanımı (bilinmiyorsa null) ve son adayı bir kez kaydeder. Eski başarılı `chat.stream.completed` olayı korunur. `usageLog: true` sayısal aylık JSONL yazar; `/usage` yalnız yöneticinindir. Herkese açık `/health` sır içermez; `health: false` kapatır.

Arayüz ve paket hata sözlüğü Türkçedir. `homeUrl` ana uygulamaya dönüş bağlantısını ayarlar. TypeScript seçeneklerinde `locale` yoktur; `MESSAGES` yalnız `tr` içerir. Eski JavaScript `locale: 'en'` seçeneği dikkate alınmaz; Türkçe kullanılır. `getErrorMessage` işlevinin kullanım dışı ikinci parametresi yalnız uyumluluk için kabul edilir ve dili değiştirmez.

## Depolama ve işletim

`llm-profiles.json` ve `llm-encryption.key` dosyalarını **birlikte** yedekleyin; kayıp anahtar profilleri çözemez. AES-256-GCM kayıtlı anahtarları korur. Windows servis hesabı ACL'lerini kullanın; POSIX 0600 Windows dosyalarını tek başına korumaz. Dosya deposunun sıralı yazmaları yerel süreç kilitleri kullanır; NFS/SMB garantisi yoktur.

```sh
npx llm-manager key rotate
npx llm-manager export --out yedek.json --password yedek-parolasi
npx llm-manager import yedek.json --password yedek-parolasi
```

Anahtar önceliği: açık `encryptionKey` > `LLM_CONFIG_ENCRYPTION_KEY` > anahtar dosyası. Varsayılan kurulum eski anahtarı kilit altında dosyaya taşır; `.env` değişmez. Kullanım dışı `writeEnv: true` eski yazma davranışını korur. Döndürme `llm-encryption.key.old-<tarih>-<kimlik>` yedeği oluşturur.

`STORE_DECRYPT_FAILED`, kayıtlı API anahtarının çözülemediğini bildirir. Eski `.env` anahtarı doğru dosyanın önüne geçebilir. Önce `.env`, profil ve anahtarı yedekleyin. Dosyadaki anahtarın mevcut profilleri çözdüğünü doğruladıktan sonra çakışan `.env` ayarını kaldırıp yeniden başlatın. Yeni anahtar eski şifreli veriyi kurtarmaz; bozuk şifreli veri aynı hatayı üretebilir.

`auth.failed`, eksik/yanlış yönetim kimlik bilgili istektir. Tarayıcının ilk Basic Auth sorgusu veya önbellekteki eski parola bunu tetikleyebilir; sağlayıcı erişiminden ayrıdır.

`STORE_CORRUPT` ve `STORE_VERSION_UNSUPPORTED` tipli 500 hataları ve kurtarma yönlendirmesi döndürür. Bozuk/yeni sürümlü dosyayı ve anahtarını koruyun; bozulmada eşleşen sağlam `.bak`, yeni veride uyumlu sürüm kullanın. Boş depoyla üzerine yazmayın.

CLI/örnek süreçleri SIGINT/SIGTERM kapanışını en çok 10 saniyede yönetir. Programatik oluşturucular, bağlantı yoklamaları ve kurulum varsayılan olarak ana uygulama sinyallerine karışmaz. Yalnız sahipli bağımsız süreçte `handleSignals: true`; gömülü kullanımda `await instance.close()` kullanın. [Docker, PM2, systemd, NSSM ve kurtarma](DAGITIM.md).

## Modeller ve tanılama

Öneri kataloğu **2026-10-24** tarihlidir; canlı hesap garantisi değildir. Hesap/bölge modelleri için **Modelleri getir** kullanın; [tarihli kaynaklar](roadmap/YOL_HARITASI.md#katalog-kaynakları) kesin kimlik ve protokol sınırlarını korur. Bazı modellerde düşünme kapatılamaz.

MiMo otomatik düşünmede `purpose: 'diagnostic'` ve `purpose: 'quick'` düşünmeyi kapatır; `purpose: 'default'` model varsayılanını korur. Açık tanılama/varsayılan seçimleri korunur, ancak MiMo hızlı testi açık düşünmeyi bile kapatır. Tanılamanın geçmesi sağlayıcı gecikmesi veya üretim davranışı garantisi değildir. Kota, izin, ağ, boş yanıt, filtre ve kesilme ayrı kodlardır. [Xiaomi sözleşmesi](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking).

## Paket alt yolları ve geçiş

| İçe aktarma | Amaç |
| --- | --- |
| `@sirrakadembasti/llm-manager` | Express ve çekirdek API'leri |
| `@sirrakadembasti/llm-manager/core` | Çatı bağımsız yönetici/depo |
| `@sirrakadembasti/llm-manager/server` | Bağımsız sunucu |
| `@sirrakadembasti/llm-manager/init` | Algılama, kod ekleme, doğrulama, geri alma |
| `@sirrakadembasti/llm-manager/setup` | Anahtar yönetimi |
| `@sirrakadembasti/llm-manager/runtime` | İstek, üretim, hatalar |
| `@sirrakadembasti/llm-manager/transport` | Güvenli sağlayıcı HTTP iletişimi |
| `@sirrakadembasti/llm-manager/errors` | Tipli hata kodları |

1.x'ten geçerken eski kapsam adsız paketi kaldırıp depoyu kurun; içe aktarmaları güncelleyin ve dosya deposu çağrılarını bekleyin. CLI/veri/anahtar dosyaları korunur. Aşağıdaki senkron işlevler kökten kaldırılmıştır:

```js
import { detectProjectType, detectEntryFile, formatVerificationReport } from '@sirrakadembasti/llm-manager/init';
```

Kökteki asenkron `runInteractiveInit`/`probeAndOpenBrowser`/`initLLMProject`/`verifyIntegration`/`injectIntoEntryFile` sarmalayıcıları bir uyumluluk sürümü için kullanım dışıdır; yeni kod `/init` kullanır. Eski `manager`, `diagnostic`; `production`, `default` olarak eşlenir ve her biri bir kez uyarır. Eski özel üretim bayrakları artık iletilmez.

MIT · [Lisans](../LICENSE) · [Değişiklikler](DEGISIKLIKLER.md) · [Güvenlik](GUVENLIK.md) · [Katkı](KATKI_REHBERI.md)
