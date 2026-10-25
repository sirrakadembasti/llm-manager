# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) ve
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler.

## [Unreleased]

### Added
- Kısa model testinde boş `length` ve yalnız reasoning içeren `stop` yanıtları ayrı regresyonlarla doğrulandı; kalıcı `passed` kaydı, sohbet hatası ve özel düşünce içeriğinin sızmaması korundu (YH2-G21).
- Transaction rollback için dosya ağacı, SHA-256 bayt özeti ve izin anlık görüntüsü regresyonları eklendi; kullanıcı reddi, başarısız doğrulama, zorunlu üzerine yazma ve host kurulumunun korunması doğrulandı (YH2-G12).
- Üretilen CommonJS yardımcısının geçişli ESM grafiğini senkron yüklemesi, kurulum hatalarını senkron iletmesi ve hatadan sonra yeniden kurulabilmesi gerçek CJS süreç testiyle güvenceye alındı (YH2-G10).
- Express eklentisinin kendi JSON ayrıştırıcısı gerçek HTTP kabul testleriyle doğrulandı: geç bağlanan host ayrıştırıcısı, önceden ayrıştırılmış gövde, 400/413 JSON hataları, auth sırası ve özel gövde sınırı (YH2-G11).
- Async host deposu sözleşmesi metot/dönüş/hata tablosuyla belgelendi; güvenli DTO ve revizyon denetimli Map örneği ile async CRUD, test ve sohbet regresyonları eklendi (YH2-G08).

### Security
- YH2 Faz 0 denetimi: geçerli sohbet Bearer belirteci Express yönetim sayfası/betiğinde 403 ile reddedilir (G01/G24). Wildcard CORS yalnız yapılandırılmış API sohbet rotasına uygulanır; Vite dışı SPA/Tauri kurulumları origin sorar, etkileşimsiz kurulum açık izin verilmeden CORS açmaz (G06).

### Fixed
- .NET hedef ailesi modern/netfx olarak gösterilir; Web Forms hedefi algılanır. Ortak NuGet gerektirmeyen C# 7.3 istemcisi geçersiz/boş JSON için Türkçe hata verir; kurulu SDK ile yardımcı dosya yalıtılmış çevrimdışı projede derlenir, host dosyalarının proje bağlamı gereksinimi açıkça belirtilir (YH2-G14).
- Node tabanlı SPA/Tauri hostlarında fiziksel paket kurulumu doğrulanır; sürüme sabitlenmiş komut ve isteğe bağlı Express önkoşulu onayla kurulur, başarı yeniden kontrol edilir. Önbellekten CLI/yoklama gerçek host sunucu kopyasını kullanır; paketsiz statik istemciler HTTP istemcisi olarak kalır (YH2-G20).
- Electron TypeScript girişleri algılanır; TypeScript hostlarına açık `.js` uzantılı yardımcı importu eklenir. Karma Node/.NET ve bilinmeyen çatı hataları Türkçeleştirildi; CLI yardımındaki desteklenmeyen `manual` seçeneği kaldırıldı (YH2-G17).
- Next Server Action ve SvelteKit ask örnekleri zorunlu dosya doğrulamasına eklendi; kurulu host `server-only` paketi Next yardımcısında kullanılır. Yorum sonrası istemci direktifi ve kimlik doğrulamalı ask delegasyonu regresyonlarla korundu (YH2-G09).
- Windows üzerinde özel dosya kilidi oluştururken geçici `EPERM`/`EACCES` hataları senkron ve async yollarda kısa, sınırlı yeniden denemeyle karşılanır; kalıcı erişim hatası ilk hata nesnesini ve mevcut kilit sahibini korur (YH2-G08, YH1-B2).
- FAZ 0 kabul kapsamı Express CommonJS/Tauri sır kontrolleri, Web yazma yetkisi ve gerçek yerel scoped npm kurulumu/CLI sürümü testleriyle genişletildi (G02/G04/G05/G07). Paket adı uyarısı README ve CLI başına taşındı; geçiş adımları entegrasyon kılavuzuna eklendi.

### 2.0 mimari tamamlama
- **BREAKING:** Paket kimliği `@sirrakadembasti/llm-manager`, yerel hedef sürüm 2.0.0; CLI adı korunur. Bu değişiklik npm yayını veya Git etiketi oluşturmaz.
- **BREAKING:** Dosya deposu tüm metotlarda Promise döndürür; FIFO yazma kuyruğu, async I/O, 5 saniyelik süreç kilidi, Windows rename retry ve zorunlu önceki sürüm yedeği kullanır. Host depoları senkron/async uyumunu korur.
- Web fetch adaptörü varsayılan olarak kapalı auth politikası, ortak Basic/Bearer principal ve auth hız sınırı kullanır; Express kendi JSON ayrıştırıcısını auth ardından bağlar. Sırlar kod/log/istemci paketine yazılmaz.
- Init sorumluluklara göre <=300 satırlık modüllere bölündü; eski yol re-export köprüsü, transaction rollback, sunucu tarafı framework sınırları ve gerçek derleyici/atlanan kontrol raporu eklendi.
- Tipler gerçek API ile hizalandı; Express 4 ESM/CJS ve Express 5 gerçek host/junction testleri eklendi. Node alt sınırı roadmap'te izin verilen >=22.12 seçeneğine alındı; undici 7'nin >=20.18.1 gereksinimi karşılanır ve CJS require(esm) desteklenir.
- Katalog 2026-10-24 tarihinde resmî kaynaklarla doğrulandı; doğrulanamayan öneriler kaldırıldı. Güncel reasoning modellerinin desteklenen eşlemeleri ve kısa test truncation kabulü eklendi.
- Yedek profil sıralı çoklu seçimi, tüm dinamik arayüz çevirileri, kullanılabilir silme onayı ve gelişmiş seçenekleri temizleme düzeltildi. Loglar yalnız sayısal usage alanlarını kabul eder; içerik/sırlar maskelenir. Usage I/O asenkron oldu.
- Retry-After ve toplam timeout/iptal bütçesi uygulanır; eski domain purpose değerleri deprecated eşlemelerle korunur, kullanılmayan özel generate bayrakları kaldırılır.
- Node dotenv ayrıştırıcısıyla uyumlu parola yazımı, yinelenen env anahtarlarını güncelleme ve SSE okuyucu/Web yanıt iptalinde üst akış temizliği düzeltildi.


### Düzeltildi
- Anahtar yönetimi testlerinin proje .env dosyasından etkilenmesi önlendi; CLI testleri geçici çalışma dizininde ve shell içermeyen argüman dizileriyle çalışıyor. Son tam test paketi 182/182 geçti.

### Denetim
- YH1'in 32 görev kartının kaynak/test karşılaştırması ve tamamlanan kabul kriterleri docs/roadmap/YH1_DENETIM_2026-10-24.md dosyasına kaydedildi. B4 test izolasyonu ve anahtar yönetimi kabul kriterleri tamamlandı.

### Eklendi
- Güvenlik süreç dokümantasyonu (`SECURITY.md`, `CONTRIBUTING.md`, `docs/THREAT_MODEL.md`, `.github/workflows/ci.yml`): Güvenlik açığı bildirme süreci (`SECURITY.md`), katkı ve kod kalitesi kuralları (`CONTRIBUTING.md`), kapsamlı tehdit modeli (`docs/THREAT_MODEL.md`: korunan varlıklar, SSRF, CSRF, sır sızıntısı, rate limit ve maliyet kontrolü) ve CI iş akışında `npm audit --omit=dev` denetimi eklendi; `undici` 7.30.1 sürümüne güncellenerek 0 zafiyet doğrulandı (YH1-F5).
- Paket metaverisi ve uyumluluk (`package.json`, `.github/workflows/ci.yml`, `tests/package-metadata.test.js`): `engines.node` `>=22.12.0`; CJS require(esm) ve undici gereksinimleri karşılanır. `keywords`, `author`, `sideEffects: false`, `publishConfig: { access: 'public' }` ve CI paket içerik kontrolü eklendi; tests/, data/ ve gerçek .env paketlenmez (YH1-F4).
- Test kapsam ölçümü (`package.json`): yalnız src dosyaları ölçülür; %80 satır/%70 dal kapıları uygulanır. Son sonuç %91,44 satır/%81,27 dal; hedef çekirdek modüllerin her biri %85 satırı aşar (YH1-F3).
- Kullanıcı arayüzü geliştirmeleri (`public/llm.html`, `public/llm-ui.js`, `src/core.js`, `src/index.js`, `public/i18n/`): `homeUrl` seçeneği ile ana sayfaya dön bağlantısı özelleştirme (`data-home-url`); profil çoğaltma / klonlama işlevi (`cloneProfile`, "Klonla" düğmesi); silme işleminde erişilebilir onay modalı (`<dialog id="confirm-dialog">` ve `showConfirm`); form alanlarına `aria-describedby` doğrulama/ipucu bağları (`timeout-hint`, `max-tokens-hint`, `api-key-status`, `provider-note`, `message`) eklendi (YH1-E3).
- Çoklu dil desteği ve mesaj sözlüğü (`src/messages.js`, `public/i18n/tr.json`, `public/i18n/en.json`, `README.en.md`, `src/core.js`, `src/index.js`, `types/`): Türkçe ve İngilizce UI sözlükleri (`public/i18n/`); standart tipli hata mesajları için `MESSAGES` ve `getErrorMessage(code, locale)` fonksiyonu; `createUiAssets({ locale: 'tr' | 'en' })` ile sunucu tarafı HTML `<html lang="...">`, `data-locale`, `data-i18n` ve `data-i18n-placeholder` etiket ön oluşturma; `public/llm-ui.js` istemci tarafı dinamik çeviri fonksiyonları (`t`, `translateDom`); `mountLLMManagement({ locale })` ve Web standart `fetchHandler({ locale })` desteği; tam İngilizce dokümantasyon (`README.en.md`) eklendi (YH1-E2).
- Deneme sohbeti (Playground) paneli (`public/llm.html`, `public/llm-ui.js`): Yönetim arayüzüne model deneme kartı eklendi; profil seçimi (varsayılan etkin profil), isteğe bağlı sistem talimatı, kullanıcı mesajı alanı, SSE akışlı (streaming) veya standart yanıt görüntüleme (`textContent`), yanıt süresi, token kullanımı ve durma nedeni gösterimi; temizleme ve form güvenliği (YH1-E1).
- Kullanım kaydı ve aylık istatistik (`src/usageLogger.js`, `src/core.js`, `src/index.js`, `public/llm-ui.js`, `types/`): `usageLog: true` (`LLM_USAGE_LOG=true`) ile istek başına token ve süre kullanım kaydı (`data/usage-YYYY-MM.jsonl`); içerik/istem/yanıt ve sır kaydetmeyen gizlilik odaklı yapı (`{ at, profileId, model, durationMs, inputTokens, outputTokens, code }`); yönetici yetkili `GET /usage?month=YYYY-MM` özet uç noktası (`totalRequests`, `totalTokens`, `byProfile`); yönetim arayüzünde her profil kartında dinamik "Bu ay: N istek · X token" rozeti eklendi (YH1-D4).
- Docker ve üretim dağıtımı (`Dockerfile`, `.dockerignore`, `docs/DEPLOY.md`, `bin/llm-manager.js`): Üretim için `node:22-alpine` tabanlı hafif Dockerfile; `node` non-root kullanıcısı ile güvenlik sıkılaştırması; kalıcı anahtar ve profil saklama için `VOLUME ["/data"]`; `/api/llm/health` üzerinden `HEALTHCHECK` denetimi; CLI ve ortam değişkeni uyumu (`LLM_DATA_DIR`, `HOST=0.0.0.0`); `.dockerignore` ve Docker, Docker Compose, Kubernetes ve PM2 dağıtım kılavuzu (`docs/DEPLOY.md`) eklendi (YH1-D3).
- Sağlık uç noktası (`src/core.js`, `src/index.js`, `types/`): `GET /health` (`GET {apiPath}/health`) rotası eklendi; kimlik doğrulama gerektirmeyen, ancak hiçbir sır veya profil kimliği/adı içermeyen (`{ ok: true, version, hasActiveProfile }`) yanıt modeli; `health: false` seçeneğiyle tamamen kapatılabilme özelliği; Express, Web standart (`llm.fetch`) ve çekirdek seviyelerinde doğrudan entegrasyon (YH1-D2).
- Model kataloğu veri dosyası ve canlı model listeleme (`src/catalog/providers.json`, `src/providers.js`, `src/core.js`, `scripts/check-catalog.js`, `public/llm.html`, `public/llm-ui.js`): Sağlayıcı tanımları ve güncel modeller JSON formatına taşındı; `CATALOG_VERSION` ("2026.10") ve `CATALOG_UPDATED_AT` ("2026-10-24") metaverileri ve derin dondurma (`Object.freeze`) eklendi; `GET /catalog` ile güncelleme tarihi yayını ve arayüz rozeti; kaydedilmemiş formlar için güvenli `POST /models/preview` canlı model getirme uç noktası (yönetici korumalı, rate limitli ve API anahtarını yanıtta asla ifşa etmeyen); katalog modellerinin geçerliliğini doğrulayan `scripts/check-catalog.js` CLI aracı eklendi (YH1-C10).
- Kurumsal proxy ve LAN model desteği (`src/providerTransport.js`, `src/providers.js`, `src/runtime.js`, `src/core.js`): `proxyUrl` (`LLM_HTTPS_PROXY`) ile Undici `ProxyAgent` entegrasyonu; vekil sunucu kullanımında SSRF riskini önleyen bilinen resmi sağlayıcı alan adları ve `allowedHosts` doğrulaması; yerel ağdaki model sunucuları (Ollama, LM Studio, vLLM) için `allowedPrivateHosts` (`LLM_ALLOWED_PRIVATE_HOSTS`) beyaz listesi; kataloğa yerleşik `ollama` sağlayıcısı ve arayüzde dinamik rehberlik notu eklendi (YH1-C8, YH1-C9).
- Düşünme (Reasoning) ayarı genelleştirmesi (`src/providers.js`, `src/transports/`, `public/llm.html`, `public/llm-ui.js`): Sağlayıcı kataloğunda `capabilities.thinking: true` yetenek tanımı; OpenAI o-serisi ve mantıksal modeller için `reasoning_effort` ('medium' | 'low'); Anthropic için `thinking: { type: 'enabled', budget_tokens }` (token sınırından küçük bütçe ve sıcaklık koruması); Google Gemini için `generationConfig.thinkingConfig.thinkingBudget`; Alibaba Qwen için `enable_thinking`; Xiaomi MiMo düşünme modu koruması; yönetim arayüzünde düşünme yeteneğine sahip tüm sağlayıcılar için form görünürlüğü ve profil ayar desteği (YH1-C7).
- Akış (Streaming SSE) desteği (`src/transports/`, `src/providerTransport.js`, `src/runtime.js`, `src/core.js`, `src/index.js`): OpenAI, Anthropic ve Google sağlayıcıları için `parseStreamEvent` ve SSE uç nokta desteği; `providerFetch` içine bellek korumalı (8 MiB sınır) sayaçlı `stream: true` desteği; `llm.stream(promptOrMessages, options)` ile `AsyncIterable` çekirdek API'si; `POST /chat` ile `{ stream: true }` üzerinden `text/event-stream` (`event: delta`, `event: done`, `event: error`) SSE yayını; Web standart `llm.fetch` ve Express adaptörlerinde istemci bağlantıyı kapattığında üst akışı iptal eden abort yönetimi (YH1-C4).
- Yeniden deneme ve yedek profil aktarımı (`src/runtime.js`, `src/core.js`, `src/profileStore.js`): Üstel geri çekilme ve jitter (tam rastgele) ile otomatik yeniden deneme mekanizması (`executeWithRetry`); 429 ve 5xx gibi yeniden denenebilir (`retryable: true`) hatalarda `Retry-After` başlığına uyum; birincil profil başarısız olduğunda yedek profillere şeffaf geçiş (`fallbackProfileIds`, `fallbackUsed`) (YH1-C6).
- Üretim parametreleri ve kullanım bilgisi (`src/runtime.js`, `src/core.js`, `public/llm.html`, `public/llm-ui.js`): Profil ve çağrı düzeyinde `temperature` (0.0–2.0), `topP` (0.0–1.0), `stop` (≤ 4 dize) ve `responseFormat` ('text' | 'json') desteği eklendi; `/chat` yanıtına `usage` ve `finishReason` alanları eklendi; `ask(prompt, { raw: true })` ile tam yanıt nesnesi desteği sağlandı; yönetim arayüzü formuna `<details>` gelişmiş parametreler alanı eklendi (YH1-C5).
- Sağlayıcı dönüşümleri strateji deseni (`src/transports/`): `openai`, `anthropic`, `google` sağlayıcı adaptörleri ayrı strateji modüllerine bölündü; ardışık aynı rol birleştirme, Anthropic ilk mesaj denetimi, Perplexity rol alternasyonu ve normalize `usage` (`{ inputTokens, outputTokens, totalTokens }`) desteği eklendi (YH1-A5).
- TypeScript tip tanımları (`types/*.d.ts`, `types/tsconfig.json`, `types/test.ts`): `LLMProfilePublic`, `LLMProfileInternal`, `LLMMessage`, `LLMStore`, `LLMManager`, `MountOptions`, `ChatResult`, `LLMErrorCode` ve tüm modül alt yolları için tam tip bildirimleri eklendi; `package.json#exports` içine koşullu `"types"` alanları tanımlandı, `npm run typecheck` komutu ve CI iş akışına eklendi (YH1-A3).
- Gerçek entegrasyon testleri ve mock sağlayıcı sunucusu (`tests/helpers/mockProvider.js`, `tests/integration/`): Express 4 ESM, Express 4 CommonJS (`app.cjs` dinamik import) ve Web standart `llm.fetch(Request)` yerel Node HTTP sunucu köprüsü testleri eklendi; `npm test` betiği alt dizinleri kapsayacak şekilde güncellendi (YH1-F2).
- Mesaj ve istek sınırları (`src/core.js`): `maxMessages` (100), `maxChars` (200000), `maxSingleMessageChars` (100000), rol beyaz listesi (`system`, `user`, `assistant`) ve en az bir `user` mesajı doğrulama kontrolleri eklendi; kural dışı durumlarda 400 `MESSAGES_INVALID` hatası sağlandı (YH1-C1).
- Akışlı gövde ve JSON denetimi (`src/core.js`): `maxBodyBytes` (varsayılan 256 KB) aşımında 413 `BODY_TOO_LARGE`, geçersiz JSON gövdesi durumunda 400 `BODY_INVALID` döndürme eklendi (YH1-C1).
- Maliyet kontrolü ve override izinleri (`src/core.js`): `chatOverrides` seçeneği (`'admin'` | `'all'`) eklendi; yönetici olmayan kullanıcıların `profileId`, `timeoutMs`, `maxOutputTokens` ve `thinking` değerlerini ezmesi engellendi (YH1-C2).
- İstek hız sınırlayıcısı (`src/rateLimit.js`): Token bucket algoritması ile bellek dostu hız sınırlama mekanizması (`createRateLimiter`), `/chat`, `/test`, `/models` ve Express Basic Auth kaba kuvvet (brute-force) koruması eklendi; aşımda 429 `RATE_LIMITED` ve `Retry-After` başlığı sağlandı (YH1-C3).
- Yapılandırılmış loglama ve istek izleme (`src/logger.js`): `x-request-id` başlığı doğrulama ve yanıtlara yayma (`sanitizeRequestId`), hassas alanları (`apiKey`, `password`, `secret`, `authorization`, `bearer`) otomatik maskeleyen `redact()` fonksiyonu ve yapılandırılmış loglayıcı (`createStructuredLogger`) eklendi (YH1-D1).
- Çok süreçli dosya kilidi (`src/store/fileLock.js`): `withFileLockSync` ve `withFileLock` ile atomik kilit alma, eski kilit (stale lock > 10s ve ölü PID) tespiti ve temizliği, `robustRenameSync` ile Windows `EBUSY`/`EPERM` hatalarında otomatik üstel gecikmeli yeniden deneme eklendi (YH1-B2).
- Şema sürümü ve tek kuşak otomatik yedekleme (`src/profileStore.js`): depolama formatı `{ version: 1, activeId, profiles }` olarak standartlaştırıldı; v0 formatı otomatik taşındı (`migrate`), gelecekteki sürümler için `STORE_VERSION_UNSUPPORTED` hatası verildi; bozuk JSON durumunda `.bak` kurtarma yönergeli `STORE_CORRUPT` hatası sağlandı ve her başarılı yazım öncesinde mevcut dosya `llm-profiles.json.bak` olarak yedeklendi (YH1-B3).
- Tipli hata modeli eklendi: `src/errors.js` (`llm-manager/errors`) içinde `LLMError`, `ErrorCodes` ve `isLLMError`; `RUNTIME_OPTIONS_INVALID`, `PROFILE_INVALID`, `PROFILE_NOT_FOUND`, `PROFILE_CONFLICT`, `LLM_NETWORK`, `LLM_DNS_BLOCKED`, `LLM_RESPONSE_TOO_LARGE`, `LLM_TIMEOUT`, `LLM_ABORTED`, `LLM_CONTENT_FILTERED`, `LLM_UPSTREAM_UNAVAILABLE` gibi standart tipli hata kodları tanımlandı (YH1-A4).
- Bağımsız sunucu fonksiyonu `createStandaloneServer` (`src/server.js`, `llm-manager/server`) eklendi; `--host`, `--data-dir` ve `--chat-token` CLI seçenekleri, graceful shutdown ve ağa açık sunucu parola uzunluğu (en az 12 karakter) doğrulaması sağlandı (YH1-A2).
- Geliştirme ve CI altyapısı eklendi: ESLint flat config (`eslint.config.js`), Prettier yapılandırması (`.prettierrc`, `.prettierignore`), `.editorconfig`, `.gitattributes` ve GitHub Actions çoklu işletim sistemi / Node matrisi iş akışı (`.github/workflows/ci.yml`). `npm run lint` ve `npm run format:check` komutları tanımlandı (YH1-F1).

### Değişti
- `src/core.js` içindeki tüm `store.*` çağrıları `await` ile asenkronlaştırıldı; hem senkron dosya deposu hem de veritabanı/özel asenkron host depoları tam uyumlu hale getirildi (YH2-G08, YH1-B2).
- `src/profileStore.js` içine dosya stat kontrolü (`mtimeMs`, `size`) tabanlı okuma önbelleği ve closure tabanlı şifreleme anahtarı önbelleği eklendi; dönen nesneler `structuredClone` ile izole edilerek çağrıcı mutasyonlarının önbelleği bozması engellendi (YH1-B1).
- Hata sınıflandırması ve yönetimi metin regex kontrolü yerine birincil olarak `error.code` tablosuna bağlandı; kullanıcı abort (`LLM_ABORTED`) ile zaman aşımı (`LLM_TIMEOUT`) ayrıştırıldı; sağlayıcı 5xx yanıtları `LLM_UPSTREAM_UNAVAILABLE`, içerik filtreleri `LLM_CONTENT_FILTERED`, aşırı büyük yanıtlar `LLM_RESPONSE_TOO_LARGE` kodlarıyla tiplendirildi (YH1-A4).
- `src/profileStore.js` doğrulama ve durum hataları ile `src/runtime.js` seçenek denetimleri `LLMError` fırlatacak şekilde güncellendi (YH1-A4).
- `src/index.js` içinden `init.js` statik bağımlılığı kaldırıldı; `src/init.js` içerisindeki statik `express` bağımlılığı temizlendi. `src/index.js` üzerinden `init` fonksiyonlarına erişim asenkron lazy sarmalayıcılarla geriye dönük uyumlu tutuldu (`@deprecated`, YH1-A1).
- `package.json` içinde `express` doğrudan bağımlılıktan `peerDependencies` (`^4.19.2 || ^5.0.0`, isteğe bağlı) ve geliştirme bağımlılığına (`devDependencies`) dönüştürüldü; `dotenv` çalışma zamanı bağımlılığı tamamen kaldırılarak yerleşik Node ortam dosyası yüklemesi ve güvenli ayrıştırıcıya geçildi (YH1-A1).
- `examples/server.js` `src/server.js` üzerindeki ince bir kullanım örneğine dönüştürüldü (YH1-A2).
- Etkileşimli 4 aşamalı kurulum sihirbazı (`npx llm-manager init`, `runInteractiveInit`), Express (ESM/CommonJS), React/Vue (`.vue` SFC)/Vite (`spa`), Next.js (`nextjs`), Nuxt 3 (`nuxt`), SvelteKit (`sveltekit`), C# / .NET Core / ASP.NET MVC / .NET MVP / WinForms / WPF (`dotnet` -> `LlmClient.cs`), Python (`python` -> `llm_client.py`) ve Electron (`electron`) projelerinde hedef ana dosyayı bulup güvenli/geri alınabilir (`rollback`) kod ekleme (`detectEntryFile`, `injectIntoEntryFile`), Türkçe çözümlü otomatik iç doğrulama motoru (`verifyIntegration`, `formatVerificationReport`) ve canlı `/llm` yoklaması ile varsayılan tarayıcıyı otomatik açma (`probeAndOpenBrowser`, `-y/--yes`, `--no-open`) özellikleri eklendi (`src/init.js`, `bin/llm-manager.js`).
- Sıfır konfigürasyonlu entegrasyon yardımcıları eklendi: `dataDir` ile otomatik şifreleme anahtarı (`llm-encryption.key`), tek satırlık `await llm.ask(prompt)`, Web standart `await llm.fetch(request)` adaptörü (Next.js, SvelteKit, Nuxt, Astro, Hono), Express için yerleşik `adminPassword` seçeneği ve CLI için `--password` / `--cors` bayrakları.
- SPA, masaüstü ve Node.js dışı uygulamaların API anahtarını görmeden model çağrısı yapabilmesi için `POST /chat` çalışma zamanı uç noktası (`{ prompt }` veya `{ messages }`), `mountLLMManagement` için `chatAccess` (`'authenticated' | 'admin' | false`) yetkilendirme seçeneği (`src/index.js`) ve bağımsız sunucu için `LLM_ALLOWED_ORIGINS` CORS beyaz listesi (`examples/server.js`) eklendi.
- Farklı mimariler (Express, SPA/Statik, Next.js/Full-Stack, Python/Go Sidecar, Electron/Tauri Masaüstü) için sadeleştirilmiş entegrasyon kılavuzu (`docs/ENTEGRASYON.md`) eklendi.
- Sağlayıcı kataloğuna (`src/providers.js`) tüm sağlayıcılar için varsayılan model listeleri ve bölgesel uç nokta seçenekleri eklendi.
- Yönetim arayüzüne (`public/llm.html`, `public/llm-ui.js`) önerilen model seçici (`#model-select`) ve 3 durumlu şifreli API anahtarı rozeti/durum bildirimi eklendi.

### Değişti
- Sağlayıcı uç noktası, kimlik doğrulama başlıkları ve hızlı test sınırları (`resolveRuntimeOptions`, `providerEndpoint`, `providerAuthHeaders`) `src/runtime.js` ve `src/core.js` arasında birleştirildi.
- Şifreleme anahtarı doğrulaması (`parseEncryptionKey`) `src/profileStore.js` ve `src/setup.js` arasında ortaklaştırıldı.
- `public/llm.html` içindeki mükerrer `<style>` blokları birleştirildi; `public/llm-ui.js`, `examples/server.js` ve test dosyaları okunabilir biçime getirildi.

### Düzeltildi
- Express `mountLLMManagement` içinde `chatAccess: false` yapılandırmasının isteği sonrakilere paslamak yerine 404 `CHAT_DISABLED` döndürmesi sağlandı (YH2-G03).
- Express 4 üzerinde asenkron yönlendirici hatalarının `next(err)` ile hata katmanına iletilmesi sağlandı; yönetim sayfası ve API yanıtlarına güvenlik başlıkları (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, yönetim sayfası için `Content-Security-Policy`) eklendi.
- Örnek sunucuda (`examples/server.js`) Basic Auth karşılaştırması SHA-256 özeti ve kısa devresiz kontrol ile sabit zamanlı (constant-time) hale getirildi.
- `createUiAssets` içinde `apiPath` ve `pagePath` parametrelerine mount yolu doğrulaması (`isValidMountPath`) eklendi.
- `src/profileStore.js` içinde AES-256-GCM şifre çözme işlemine 12 bayt IV, 16 bayt kimlik doğrulama etiketi (`authTagLength: 16`) ve 3 parçalı format doğrulaması eklendi.
- Profil kaydedilirken kimlik bilgisi, sağlayıcı, temel adres veya model değişmediğinde geçmiş test sonuçlarının (`lastTests` ve `lastTest`) korunması sağlandı.
- Bulunamayan profil kimlikleri için `PUT`, `DELETE` ve `POST /activate` uç noktalarının `400` yerine `404` (`PROFILE_NOT_FOUND`) döndürmesi sağlandı.
- `allowLocalHttp` seçeneğinin `createLLMProfileStore`, `createLLMManager`, `buildProviderRequest`, `generateProfileResponse` ve `providerFetch` katmanları boyunca ortam değişkenine gerek kalmadan iletilmesi sağlandı.
- `src/setup.js` içinde geliştirme ortamında `.env.example` kopyalama davranışı kaldırıldı; boş `LLM_CONFIG_ENCRYPTION_KEY=` satırlarının yerinde güncellenmesi sağlandı.
- `src/core.js` içindeki sohbet testi (`mode: 'conversation'`) akışında özel `generate` adaptörlerine `resolveRuntimeOptions(profile, { purpose })` çıktısının (Xiaomi MiMo `auto` profillerinde `thinking: 'disabled'` dahil) iletilmesi sağlandı.
- Anthropic isteklerinde sistem mesajı olmadığında boş `system` alanı gönderilmemesi ve Google Gemini model adlarında mükerrer `models/` önekinin temizlenmesi sağlandı.
- Ön yüzde (`public/llm-ui.js`) "Modelleri getir" eyleminin açık olan profil formundaki kaydedilmemiş değişiklikleri sıfırlamaması ve boş model listesi döndüğünde mevcut model seçeneklerini silmemesi sağlandı.
- `createPublicLookup`, `GET /profiles/:id/models`, UI form korunumu ve diğer sertleştirme senaryoları için birim/entegrasyon testleri eklendi.

## [1.0.0] - 2026-10-19

İlk bağımsız sürüm.

### Değişti
- **Kırıcı:** Paket adı `llm-manager`; import yolları `llm-manager`, `llm-manager/core` ve `llm-manager/setup`.
- **Kırıcı:** CSRF başlığı `X-LLM-CSRF` (eski `X-XFactor-CSRF` kabul edilmez).
- Yönetim HTML/JS dosyaları mount sırasında önbelleğe alınır.
- `setup.js` artık `.env.example` dosyasına bağımlı değildir.
- `src/index.js` artık `src/core.js` üzerinde ince bir Express adaptörüdür; `src/profileStore.js` ile birlikte okunabilir hale getirildi.
- README'deki geçmişe dönük notlar sadeleştirildi.
- Lisans MIT olarak belirlendi.

### Eklendi
- Framework-agnostik çekirdek API (`llm-manager/core`: `createLLMManager`, `createUiAssets`).
- `npx llm-manager` CLI girişi (`--port`, `--help`, `--version`).
- `.env.example`, `LICENSE`, `CHANGELOG.md`, `release:*` betikleri.

### Kaldırıldı
- Önceki host uygulamaya (XFactor) ait tüm adlandırma ve bağımlılıklar.

[Unreleased]: https://github.com/sirrakadembasti/llm-manager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sirrakadembasti/llm-manager/releases/tag/v1.0.0
