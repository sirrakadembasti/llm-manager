# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) ve
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler.

## [Unreleased]

### Eklendi
- Bağımsız sunucu fonksiyonu `createStandaloneServer` (`src/server.js`, `llm-manager/server`) eklendi; `--host`, `--data-dir` ve `--chat-token` CLI seçenekleri, graceful shutdown ve ağa açık sunucu parola uzunluğu (en az 12 karakter) doğrulaması sağlandı (YH1-A2).
- Geliştirme ve CI altyapısı eklendi: ESLint flat config (`eslint.config.js`), Prettier yapılandırması (`.prettierrc`, `.prettierignore`), `.editorconfig`, `.gitattributes` ve GitHub Actions çoklu işletim sistemi / Node matrisi iş akışı (`.github/workflows/ci.yml`). `npm run lint` ve `npm run format:check` komutları tanımlandı (YH1-F1).

### Değişti
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
