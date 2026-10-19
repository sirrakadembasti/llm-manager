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
- Düzeltme listesi 1-6 TAMAMLANDI. Sürüm: **v1.0.0** (etiket 3bfcaab+), paket adı `llm-manager`, lisans MIT.
- GitHub: https://github.com/sirrakadembasti/llm-manager (branch `main`, remote `origin`).
- Sürümleme: SemVer + CHANGELOG.md (Keep a Changelog). Yayın: değişiklikleri `[Unreleased]` altına yaz, commit et, `npm run release:patch|minor|major`, `git push origin main --follow-tags`.
- CSRF başlığı `X-LLM-CSRF: 1`. Git kimliği (yerel): llm-yonetimi <noreply@users.noreply.github.com>.
- Klasör `llm-yonetimi` -> `llm-manager` olarak kullanıcı tarafından elle yeniden adlandırılacak.

## Tamamlanan ek geliştirmeler (2026-10-19)
- `index.js` / `profileStore.js` sıkıştırılmış kodun okunabilir hale getirilmesi.
- `bin/llm-manager.js` ile CLI başlatma (`npx llm-manager`).
- Framework-agnostik çekirdek API (`src/core.js`, `llm-manager/core` export'u; Express adaptörü `src/index.js` içinde).
- README'de kalan eski (geçmişe dönük) notların sadeleştirilmesi.

