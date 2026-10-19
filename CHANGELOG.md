# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) ve
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler.

## [Unreleased]

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
