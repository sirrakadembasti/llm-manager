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
- Programatik `allowLocalHttp` seçeneğinin tüm katmanlara iletilmesi, `resolveRuntimeOptions` içinde Xiaomi MiMo `purpose: 'manager'` düşünme tutarlılığı, Anthropic boş `system` alanının çıkarılması, Google `models/` önekinin temizlenmesi, ön yüzde "Modelleri getir" form durumu korunumu ve 22 birim/entegrasyon testi.

