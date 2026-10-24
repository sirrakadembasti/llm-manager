# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) ve
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler.

## [Unreleased]

### Eklendi
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
