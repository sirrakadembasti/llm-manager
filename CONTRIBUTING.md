# Contributing

Node.js 22.12+ kullanın. Core framework bağımsız kalır; host uygulamaya özel varsayım eklemeyin.

## Zero Secret Leakage

API/şifreleme anahtarları, admin parolası, istem ve cevap içeriği loglara veya istemci paketine yazılmaz. İç profilleri HTTP DTO'su olarak döndürmeyin; log nesnelerini `redact()` ile maskeleyin.

## Quality Verification Commands

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm audit --omit=dev
```

Biçimlendirme: `npm run format`. Hata düzeltmesi/özellik için önce davranışı gösteren test yazın. Seri koşuda Node seçeneklerini dosya yollarından önce verin:

```sh
node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js
```

## Conventional Commits

Bir görev bir commit: `feat`, `fix`, `docs`, `test`, `refactor` veya `chore`; kısa ve amaca uygun başlık kullanın. Örnek: `fix(store): retry Windows rename`. Kırıcı değişikliği açıkça belirtin.

Davranış/API değişirse ilgili README, tipler ve kılavuzları güncelleyin. Her katkıda CHANGELOG `[Unreleased]` ve GEMINI güncel kalır. Yeni runtime bağımlılığı eklemeyin; zorunlu değişikliği gerekçelendirin. Dosya taşırken eski yolu bir uyumluluk sürümü boyunca re-export ile koruyun.

PR'da sorun, çözüm, test sonucu ve sınırları yazın. Testleri geçen commit yayın veya push yetkisi değildir. Görev/durum kaydı: [tek yol haritası](docs/roadmap/YOL_HARITASI.md).
