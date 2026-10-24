# Proje Hafızası: llm-manager

## Ana hedef (kullanıcı kararı, 2026-10-19)
- Bu uygulama **bağımsız bir API / eklenti** olacak. Önceden türetildiği uygulamanın (XFactor) tüm bağımlılıkları, adlandırmaları ve varsayımları koparılacak.
- **Her GitHub reposundaki uygulamaya** (Express tabanlı) entegre edilebilir ve tek başına çalıştırılabilir olacak.
- **Basit ama çalışır** bir eklenti: az kurulum, net README, sıfır host-proje bağımlılığı.
- Sıra: önce kendi tespit ettiğim gözlemlerin düzeltilmesi, adım adım.

## Çalışma kuralları
- Her değişiklikten sonra `npm test` ile doğrula.
- Mevcut yorum ve dokümantasyon, değişiklikle ilgisi yoksa korunur.
- API anahtarı hiçbir zaman tarayıcıya/listeye/loglara dönmez.

## Düzeltme listesi (sırayla)
1. XFactor izlerini kaldır (paket adı, CSRF başlığı, README, yorumlar).
2. `index.js` gereksiz koşul (`'models' : 'models'`) temizliği.
3. Yönetim HTML/JS dosyalarını her istekte okumak yerine önbelleğe al.
4. `setup.js` `.env.example` ve `.env` zorunluluğunu kaldır; bağımsız anahtar dosyası.
5. Bağımsız paket metaverisi (isim, lisans, .env.example, .gitignore, bin/start).
6. README'yi bağımsız kullanıma göre güncelle, testleri çalıştır.

## Durum (2026-10-19)
- Düzeltme listesi 1-6 ve ek geliştirmeler TAMAMLANDI. Sürüm: **v1.0.0** (etiket `33de7d7`), paket adı `llm-manager`, lisans MIT.
- GitHub: https://github.com/sirrakadembasti/llm-manager (branch `main`, remote `origin`).
- Sürümleme: SemVer + CHANGELOG.md (Keep a Changelog). Yayın: değişiklikleri `[Unreleased]` altına yaz, commit et, `npm run release:patch|minor|major`, `git push origin main --follow-tags`.
- CSRF başlığı `X-LLM-CSRF: 1`. Git kimliği (yerel): llm-yonetimi <noreply@users.noreply.github.com>.
- Klasör adı `llm-yonetimi` -> `llm-manager` olarak güncellendi.

## Mimari inceleme ve yol haritaları (2026-10-22)
- `docs/roadmap/` altında iki yol haritası var: YH1 (teknik/mimari, A–F fazları) ve YH2 (vaat ↔ gerçek, G01–G26). Uygulama sırası YH2 §5'te.
- Doğrulanmış kritik bulgular (`node docs/roadmap/dogrulama.mjs`): `chatAccess:false` sohbeti kapatmıyor, `llm.fetch` kimlik doğrulamasız (Next/Nuxt/SvelteKit rotaları açık), async store bozuk, gövde ayrıştırıcı sırası, SPA şablonu admin parolasını tarayıcıya gömüyor, init parolayı koda/package.json'a yazıyor ve `.gitignore` güncellemiyor, `--cors *` + credentials, npm'de `llm-manager` adı başkasına ait.
- Sonraki iş: YH2 Faz 0 (G03 → G02 → G04+G05 → G06 → G01+G24 → G07).
- **Karar (kullanıcı onayı, 2026-10-23):** Paket adı `@sirrakadembasti/llm-manager` olacak; kırıcı değişiklik → **v2.0.0** (Faz 0 + Faz 1 sonunda yayımlanır). CLI komutu `llm-manager` ve GitHub deposu değişmez. Uygulama: YH2-G07. G07 uygulanana kadar `package.json#name` hâlâ `llm-manager`.

## Tamamlanan ek geliştirmeler (2026-10-19)
- Tüm kaynak (`src/*`), arayüz (`public/*`), örnek (`examples/*`) ve test (`tests/*`) dosyalarındaki sıkıştırılmış kodların okunabilir hale getirilmesi ve `public/llm.html` içindeki mükerrer stil bloklarının birleştirilmesi.
- `src/runtime.js` ile `src/core.js` arasındaki ortak sağlayıcı adresi, yetki başlığı ve çalışma zamanı seçenek çözümlemesinin (`providerEndpoint`, `providerAuthHeaders`, `resolveRuntimeOptions`) tekilleştirilmesi.
- `src/profileStore.js` ile `src/setup.js` arasındaki şifreleme anahtarı doğrulamasının (`parseEncryptionKey`) ortaklaştırılması.
- `bin/llm-manager.js` ile CLI başlatma (`npx llm-manager`).
- Framework-agnostik çekirdek API (`src/core.js`, `llm-manager/core` export'u; Express adaptörü `src/index.js` içinde).
- README'de kalan eski (geçmişe dönük) notların sadeleştirilmesi ve alt modül export'larının belgelenmesi.
- Sağlayıcı kataloğuna varsayılan model listeleri/bölgesel uç noktalar ve yönetim arayüzüne model seçici + 3 durumlu şifreli API anahtarı rozeti eklenmesi.
- Express 4 async hata yakalama (`next(err)`), yönetim sayfası/API güvenlik başlıkları (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`), `createUiAssets` yol doğrulaması ve örnek sunucuda SHA-256 sabit zamanlı Basic Auth.
- AES-256-GCM şifre çözmede 12 bayt IV ve 16 bayt doğrulama etiketi (`authTagLength: 16`) zorunluluğu, hedef/model/anahtar değişmeyen profil düzenlemelerinde `lastTests` korunumu, bulunamayan profiller için `404 PROFILE_NOT_FOUND` durum kodu ve `setup.js` `.env` iyileştirmesi.
- Programatik `allowLocalHttp` seçeneğinin tüm katmanlara iletilmesi, `resolveRuntimeOptions` içinde Xiaomi MiMo `purpose: 'manager'` düşünme tutarlılığı, Anthropic boş `system` alanının çıkarılması, Google `models/` önekinin temizlenmesi, ön yüzde "Modelleri getir" form durumu korunumu ve 23 birim/entegrasyon testi.
- SPA, masaüstü ve diğer dillerden güvenli çağrı için `POST /chat` uç noktası (`{ prompt }` ve `{ messages }` desteği), `chatAccess` (`'authenticated' | 'admin' | false`) yetkilendirme ayarı, `LLM_ALLOWED_ORIGINS` / `--cors` desteği ve `docs/ENTEGRASYON.md` çoklu platform entegrasyon kılavuzu.
- Sıfır konfigürasyonlu entegrasyon: `dataDir` ile otomatik şifreleme anahtarı (`llm-encryption.key`), `await llm.ask(prompt)` tek satır çağrısı, `await llm.fetch(request)` Web standart adaptörü, Express `adminPassword` yerleşik Basic Auth ve CLI `--password` / `--cors` parametreleri.
- Etkileşimli otomatik kurulum ve doğrulama sihirbazı (`src/init.js`, `npx llm-manager init`): Express (ESM/CJS), React/Vue (`.vue`)/Vite (`spa`), Next.js (`nextjs`), Nuxt 3 (`nuxt`), SvelteKit (`sveltekit`), C# / .NET Core / ASP.NET MVC / .NET MVP / Desktop (`dotnet`), Python (`python`) ve Electron (`electron`) projelerinde otomatik mimari ve hedef dosya algılama (`detectEntryFile`), kullanıcı onaylı otomatik kod enjeksiyonu ve geri alma (`injectIntoEntryFile` + `rollback`), sözdizimi/entegrasyon iç kontrolü ve Türkçe hata rehberi (`verifyIntegration`), canlı `/llm` yoklaması ve varsayılan tarayıcıda otomatik açma (`probeAndOpenBrowser`, `runInteractiveInit` — toplam 33 test).
- YH1-A4: Tipli hata modeli (`src/errors.js`, `LLMError`, `ErrorCodes`, `isLLMError`); `classifyLLMError`, `profileStore` ve `runtime` hatalarının tipli kodlara bağlanması, abort/timeout ayrımı, upstream 5xx, content filter ve payload boyutu tipleri (46 test).
- YH1-B1: Okuma ve anahtar önbelleği (`src/profileStore.js`); `mtimeMs` + `size` stat önbelleği, `structuredClone` izolasyonu, closure anahtar önbelleği ve 1000 okumada tek disk erişimi doğrulaması (49 test).
- YH1-B2 & B3: Çok süreçli dosya kilidi (`src/store/fileLock.js`, `withFileLockSync`, `withFileLock`), Windows EBUSY/EPERM yeniden deneme (`robustRenameSync`), şema sürümü `{ version: 1 }`, v0 migration, tek kuşak yedek (`.bak`), bozuk JSON kurtarma rehberi ve asenkron store uyumluluğu (56 test).
- YH1-C1, C2, C3, D1: Mesaj/karakter sınırları ve rol doğrulaması (`limits`), override izinleri (`chatOverrides`), akışlı gövde boyutu sınırı (413) ve geçersiz JSON (400), token bucket hız sınırlayıcı (`src/rateLimit.js`, `createRateLimiter`), Basic Auth brute-force koruması, `x-request-id` yayılımı (`src/logger.js`, `sanitizeRequestId`), hassas veri maskeleme (`redact`) ve yapılandırılmış loglayıcı (`createStructuredLogger`, 61 test).

- YH1-B2 & YH1-B3: Çok süreçli dosya kilidi (`src/store/fileLock.js`), stale lock kurtarma, Windows rename retry, şema sürümü (v1), `.bak` tek kuşak yedekleme, bozuk JSON kurtarma rehberi ve çekirdekte async store desteği (56 test).

