# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) ve
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler.

## [Unreleased]

## [1.0.0] - 2026-10-19

İlk bağımsız sürüm.

### Değişti
- **Kırıcı:** Paket adı `llm-yonetimi`; CSRF başlığı `X-LLM-CSRF` (eski `X-XFactor-CSRF` kabul edilmez).
- Yönetim HTML/JS dosyaları mount sırasında önbelleğe alınır.
- `setup.js` artık `.env.example` dosyasına bağımlı değildir.
- Lisans MIT olarak belirlendi.

### Eklendi
- `.env.example`, `LICENSE`, `CHANGELOG.md`, `release:*` betikleri.

### Kaldırıldı
- Önceki host uygulamaya (XFactor) ait tüm adlandırma ve bağımlılıklar.

[Unreleased]: https://github.com/sirrakadembasti/llm-manager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sirrakadembasti/llm-manager/releases/tag/v1.0.0
