# Teknik kılavuz

## Proje Asistanı mimarisi

Arayüzde `public/llm-ui.js` profil yönetimini, `public/project-ui.js` tek sohbet formu ve mod durumunu, `public/chat-client.js` normal JSON/akışlı model denemesi taşımasını yönetir. Bu betikler mevcut kimlik korumalı UI betiğinde birleştirilir; yeni açık asset yolu eklenmez. Model denemesi `/chat` uç noktasını, kaynaklı sohbet `/project/chat`, plan/değişiklik `/project/tasks` yollarını kullanır. Kaynak özelliği kapalıyken model denemesi açık kalır. Model geçmişi profil/sistem talimatı bağlamından, proje geçmişinden ayrı tutulur; mod/profil değişimi kayıtlı mesajları silmez; gönderilecek bağlamı ayırır. SSE okuyucu parçalanmış UTF-8 ve son satırı işler; tamamlanma olayı gelmeden biten bağlantıyı başarılı saymaz. Yerel AbortController model denemesini, mevcut iptal API'si proje işlemlerini durdurur.

Depoya ait statik kaynak haritası ve tarama sınırları [Graphify çıktılarında](graphify-out/README.md) bulunur. Bu çıktılar uygulamadaki çalışma anı haritasından ayrıdır; envanterin yerine kullanılmaz ve yeni kaynak değişikliklerinden sonra yeniden üretilmelidir.

`src/project` isteğe bağlı, Express bağımsız alt sistemdir. `files/policy/ignore` gerçek kaynak sınırını, `analyze/context` kanıtlı statik analizi ve bütçeli bağlamı, `graphify` harita adaptörünü, `workspace/process` geçici kopya ve çocuk süreç ömrünü sağlar. `relay/opencode/tasks` etkin profile bağlı araç oturumunu; `changes/commands` onay, sürüm kontrolü, kurtarma ve doğrulamayı yönetir. `index` tek aktif işlem kuyruğunu, yönetici API'sini ve iptali birleştirir. Yeni zorunlu npm bağımlılığı yoktur.

Tarama manifestleri çalıştırmaz. JS/TS importları, bazı JS/Python route işaretleri, fetch çağrıları ve SQL CREATE TABLE kolonları kaynak örüntülerinden çıkarılır. Bu tam derleyici/LSP veya canlı DB introspection değildir. Graphify temiz kopyada `extract --code-only` ile çalışır; referansları envanterde doğrulanır. Kaynak bütçesi veya dil desteği eksikse sonuç kısmi olabilir. Her sohbet/görev kaynakları yeniden okur; eski revizyonla istek 409 döner.

OpenCode ayrı loopback portunda, rastgele sunucu parolası ve temiz HOME/env ile başlatılır. Proje/global plugin ve skill yüklemesi, LSP, otomatik güncelleme, paylaşım ve yerleşik snapshot kapalıdır. Okuma yalnız kopyaya, edit yalnız değişiklik moduna açıktır; bash ve harici dizin erişimi kapalıdır. Bunlar motor izinleridir, işletim sistemi sandbox'ı değildir. Güvenilir motor kurulumu gereklidir.

Gerçek API anahtarı yalnız ana süreçte kalır. OpenCode, tek oturumluk loopback köprüsünün geçici belirtecini kullanır; köprü `providerFetch` üzerinden mevcut DNS/SSRF/proxy politikasını uygular. Google, Anthropic ve OpenAI uyumlu araç protokolleri korunur; model ve yollar sınırlandırılır. Görev başına 40 sağlayıcı isteği, 1 MiB istek, 8 MiB yanıt ve profil süre bütçesi vardır. Sağlayıcının araç desteği ayrıca gereklidir. Araç maliyeti/usage değerleri mevcut sohbet kullanım sayacına eklenmez; sağlayıcı raporlaması esas alınmalıdır.

Değişiklikler bellekteki önce/sonra UTF-8 içerik ve revizyonlarla tutulur; UTF-8 BOM korunur. Tüm dosyalar ön kontrolden, yazılan her dosya yeniden digest kontrolünden geçer. Geçici kardeş dosya ve rename kullanılır. Hata halinde yalnız hâlâ beklenen içeriğe sahip yazılar geri alınır. Eşzamanlı değişiklikte 409, kurtarma çakışmasında `PROJECT_PARTIAL_APPLY` döner. Bu çok dosyalı ACID işlem veya başka süreçlerle atomik compare-and-swap garantisi değildir; aktif eşzamanlı yazarlardan kaçının. Sunucu kapanışı/çöküşü sonrası kalıcı geri alma günlüğü bulunmaz.

`close()` aktif işlemi iptal eder; motor/köprü ve sahipli geçici kopyaları temizler. POSIX araç grubuna SIGTERM sonrası SIGKILL; Windows'ta `taskkill /T /F` uygulanır. POSIX'e özgü süreç testi Windows'ta atlanır. Yeni testler `tests/project-*.test.js`, kontrollü gerçek motor/harita kabul betiği `scripts/check-project-assistant.mjs` altındadır. Tamamlanmış görev ve tarihli doğrulama sonuçları yalnız yol haritasında tutulur.

Node.js **22.12+** için sağlayıcı, profil ve şifreli API anahtarı yönetimi. Bağımsız sunucu veya uygulama eklentisi olarak çalışır; Docker ve veritabanı isteğe bağlıdır.

Paket **`@sirrakadembasti/llm-manager`**, komut `llm-manager`. npm'deki kapsam adı olmayan paket başka projeye aittir. Yerel **2.0.0 / yayımlanmamış** durumu npm yayını veya Git etiketi kanıtı değildir.

[Kullanıcı kılavuzu](KULLANICI_KILAVUZU.md) · [Başlangıç](../README.md) · [Entegrasyon](ENTEGRASYON.md) · [Dağıtım](DAGITIM.md) · [Yol haritası](roadmap/YOL_HARITASI.md)


### Kalıcı sohbet deposu ve oturum API'si

`src/assistant/history.js`, `/assistant/sessions` yönetici API'sini sağlar. `public/assistant-history-ui.js` sol çerçevedeki sohbet satırlarını, revizyon kontrollü satır silmeyi, kayıt durumu/hata kurtarmayı ve dışa aktarmayı; `project-ui.js` mesaj/iş çıktılarını ve canlı görev bağlantısını yönetir. Geçmiş açma işlemi boyunca sohbet/görev kontrolleri de kilitlidir. Merkez sohbet panelinde araç çubuğu üstte, ayrı kaydırılan mesajlar ortada ve composer alttadır. Çalışma türü/profil aynı form ile ilişkilidir. Mobil sohbet listesi ve proje bilgileri paneli ayrı düğmelerle açılır; Escape odağı açan düğmeye döndürür. Liste açma/silme sonrasında klavye odağı güvenli hedefe taşınır. Akışta yalnız alt sınırı takip eden kullanıcı otomatik kaydırılır; manuel yukarı kaydırma tamamlanmada da korunur. Composer işlemleri `perform(..., quiet=true)` ile küçük durum satırını kullanır; cevap sonu başarı paneli üretmez. Hata ve dosya/komut işlemi bildirimleri korunur. Görev çıktıları yetki veren komutlar değildir; yalnız canlı sunucu görevi yeniden açılarak mevcut onaylar kullanılabilir.

Varsayılan `store.assistantHistory`, profil dosyasının yanında `<profil-dosyası>.assistant.enc` kullanır. İçerik AES-256-GCM ile mevcut profil anahtarı üzerinden şifrelenir; anahtar dışarı verilmez. Yazılar süreç kuyruğu + `withFileLock` altında okuma/değiştirme, 0600 geçici dosya ve `robustRename` ile yapılır. Bozuk veya çözülemeyen dosya boş geçmişe çevrilmez. Profil deposunun anahtar çözümlemesi paylaşılır; eşleşen anahtar kaybedilirse geri yüklenmelidir. Ayrı `.bak` otomatik üretilmez; host yedekleme yapmalıdır. `close()` kalıcı arşivi silmez; geçici motor ve geri alma kayıtları önceki gibi kapanır.

Kapsam SHA-256 ile sunucu proje kökü + principal kind/id üzerinden ayrılır. Aynı yönetici kimliği aynı kapsamı paylaşır; host farklı yöneticilere kararlı ve farklı `principal.id` sağlamalıdır. Kök yolunun değiştirilmesi ayrı arşivdir. `handle()` host sözleşmesi gereği principal verilmeden güvenilir sunucu çağrısı yapılabilir; HTTP adaptörleri yönetici ve CSRF denetimini uygular.

| API (API köküne göre) | Sözleşme |
| --- | --- |
| `GET /assistant/sessions` | `{available, sessions:[{id,title,updatedAt,mode}], reason?}`; metinler listede yok. |
| `POST /assistant/sessions` | Yeni kayıt; `mode` zorunlu, `title/profileId/system/contextId/modelContext/messages/outputs` isteğe bağlı. 201 ve tam `AssistantSession`. |
| `GET /assistant/sessions/:id` | Tam kayıt; kapsam dışında/yoksa 404. |
| `PUT /assistant/sessions/:id` | Tam içerik + güncel `revision`; eski revizyon 409 `ASSISTANT_CONFLICT`. |
| `DELETE /assistant/sessions/:id` | `{revision}`; yalnız arşiv silinir. |

Tipler `AssistantSession`, `AssistantMessage`, `AssistantOutput`, `AssistantHistoryStorage` olarak `types/core.d.ts` içindedir. Şema: mesaj rolü user/assistant; durum pending/completed/failed/cancelled; tarih, profil etiketi, kaynak referansı, metrik ve bağlam kimliği. Çıktı kaydı taskId, mod, son bilinen durum, metin/dosya özeti, doğrulama sonucu ve sınırlı işlem izi içerir. Bunlar istemci kaynaklı tarihsel kayıtlardır; yetkilendirme veya denetim açısından değiştirilemez bir audit log değildir.

Sınırlar: kapsam başına 50 sohbet, kayıt başına 100 mesaj/20 çıktı ve 220000 UTF-8 bayt; tüm dosya şifrelenmeden önce 40 MiB, diskten okuma 64 MiB. Model yanıt arşivi 32000 karakterle, model bağlamı son 10 tamamlanmış mesaj ve mesaj başına 10000 karakterle sınırlıdır. Listeleme/okuma sınırlı dosyayı tamamen çözer; çok kullanıcılı/yüksek hacimli hostlar özel depo sağlamalıdır. Kullanılmayan kayıtlar otomatik silinmez. Başlangıç sorusu/pending yanıt ve sonuç ayrı yazılardır: tarayıcı çöküşünde son akış parçaları kaybolabilir; kayıt pending kalır. Görev mutasyonundan önce belirsiz işlem niyeti kaydedilir, cevapla durum güncellenir; yanıt alınamazsa kendiliğinden tekrar yapılmaz. Bu, kaynak dosya yazılarıyla aynı ACID işlem veya çöküş sonrası geri alma günlüğü değildir.

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


### Graphify ve belge destekli proje bağlamı (2026-10-28)

Proje bilgileri → Bağlı proje → **Graphify ile daha güçlü proje analizi** alanında resmî depo, kurulum ve kullanım rehberi bulunur. Graphify hedef uygulamaya JavaScript bağımlılığı olarak değil, LLM Manager sürecinin çalıştığı sunucuya kurulur. Python 3.10+ gerekir; resmî paket `graphifyy`, CLI `graphify` adındadır: `uv tool install graphifyy` veya ayrı ortamda `python -m pip install graphifyy`. Kaynak: https://github.com/Graphify-Labs/graphify . Bu backend entegrasyonunda `graphify install` ve sohbette `/graphify` gerekmez.

Kurulumdan sonra **Projeyi tara** seçilir. Mutlak host PATH dizinlerindeki CLI yeniden aranır; açık `graphify.command` veya `LLM_GRAPHIFY_PYTHON` / `project.graphifyPython` ayarı önceliklidir. PATH değişikliği çalışan servise yansımıyorsa servis yeniden başlatılır. `project.graphifyAutoDetect: false` otomatik keşfi kapatır. Projeden araç veya kurulum betiği otomatik çalıştırılmaz. Kurulu araç doğrulanmış tarama çıktısı üretirse algılandı, bulunamazsa eksik, çalışmazsa hata durumu gösterilir. Kurulum/çalıştırma birbirinden farklıdır; keşif tek başına başarılı analiz sayılmaz.

Graphify yalnız filtrelenmiş geçici kaynak kopyasında `--code-only` çalışır. Güncel kaynak revizyonuyla eşleşen ilişkiler kaynaklı sohbetin dosya seçimini destekler; kaynak değişince eski harita kullanılmaz ve yeniden tarama istenir. README, kılavuz, `.md` ve `.txt` belgeleri ayrıca yerel okuyucuyla okunur; ilk üç uygun belge için bağlam payı ayrılır. Belgeler ve geçmiş mesajlar talimat/yetki sayılmaz. Seçili kaynaklar yalnız paylaşım onayı verilen kaynaklı sohbette etkin sağlayıcıya gönderilir. Model denemesi proje kaynaklarını kullanmaz.

Tarama kaynak/belge/dışlanan dosya sayılarını ve kısmi taramayı gösterir. Varsayılan sınırlar 2500 dosya, dosya başına 256 KiB, toplam 4 MiB; sohbet bağlamı 40000 karakterdir. Bu nedenle her belge veya bütün proje her istekte modele gönderilmez. Canlı DB, dış servis ve çalışma zamanı davranışları bu analizle doğrulanmış sayılmaz. Geliştirme motoru güncel filtrelenmiş çalışma kopyasını okuyabilir; dosya uygulama ve komut onayları korunur.

Repomix yeniden incelendi (https://repomix.com/guide/); mevcut güvenli okuyucu ve sınırlı kaynak seçimi korunarak zorunlu bağımlılık eklenmedi. Cline/Aider alternatif motor adayları; DBHub veritabanı bağlantısı ertelendiği için eklenmedi. Bunlar kurulmuş veya aktifmiş gibi gösterilmez.

Sohbet arayüzünde merkez menü ve bağlam/kaynaklar paneli kaldırılmıştır. Kayıt işlemleri sol listede Seçili sohbet bölümündedir. Yanıt metrikleri kaldırılan DOM düğümüne bağlı değildir; yerel durumdan mesaj kaydına aktarılır. Kaynak referansları mesaj ayrıntıları ve kayıt formatında korunur. Dikey çerçeve masaüstünde en az 940px, mobilde 800px; kısa ekranlarda sayfa kaydırması kullanılır.
