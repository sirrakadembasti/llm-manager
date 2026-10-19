# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) ve
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler.

## [Unreleased]

### Eklendi
- SPA, masaüstü ve Node.js dışı uygulamaların API anahtarını görmeden model çağrısı yapabilmesi için `POST /chat` çalışma zamanı uç noktası (`src/core.js`), `mountLLMManagement` için `chatAccess` (`'authenticated' | 'admin' | false`) yetkilendirme seçeneği (`src/index.js`) ve bağımsız sunucu için `LLM_ALLOWED_ORIGINS` CORS beyaz listesi (`examples/server.js`) eklendi.
- Farklı mimariler (Express, SPA/Statik, Next.js/Full-Stack, Python/Go Sidecar, Electron/Tauri Masaüstü) için adım adım entegrasyon kılavuzu (`docs/ENTEGRASYON.md`) eklendi.
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
