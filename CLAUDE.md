# LLM Manager — Claude için çalışma notları

Kullanıcıyla ve commit/PR metinlerinde **Türkçe** yazın. Ayrıntılı davranış için önce `README.md` ve
`docs/KULLANICI_KILAVUZU.md` okunur; bu dosya yalnız kodda/belgede kolayca görülmeyen çalışma kurallarını tutar.

## Proje

- Node.js 22.12+ ESM, Express isteğe bağlı. LLM sağlayıcı/profil yönetimi + **Proje Asistanı** (hedef uygulamayı
  tarayıp kaynaklı sohbet, Graphify ilişkileri, OpenCode görevleri).
- Çekirdek `src/core.js` (`createLLMManager`), Express bağlantısı `src/integration*`, sağlayıcılar `src/providers.js`
  ve `src/providerTransport.js`, Proje Asistanı `src/project/`, arayüz `public/`, CLI `bin/`, testler `tests/`.
- Gizlilik filtresi `src/project/policy.js` (`projectPath`, `hasProjectSecret`, `skipDirectory`): gevşetmek gizlilik
  değişikliğidir; "gerçek sır hâlâ yakalanıyor" testleri eklenmeden değiştirilmez.

## Kurallar

- `.env`, `data/` altındaki profil/anahtar dosyaları ve sırlar **görüntülenmez**, çıktıya yazılmaz.
- Kullanıcı açıkça istemedikçe **ücretli model çağrısı** yapılmaz (canlı sağlayıcı testi dahil).
- Belgedeki iddia kodla doğrulanır. Arşivler güncel davranış, planlar tamamlanmış iş, statik analiz çalışma kanıtı
  sayılmaz.
- Hata düzeltme ve özelliklerde önce **başarısız test** yazılır, sonra kod.
- Davranış değişince `docs/KULLANICI_KILAVUZU.md` (ve gerekiyorsa `README.md`) aynı değişiklikte güncellenir;
  test sayıları/kapsam değerleri yalnız gerçekten koşturulan sonuçtan yazılır.

## Doğrulama komutları

```sh
node --test --test-concurrency=1 "tests/*.test.js" "tests/**/*.test.js"  # tam seri koşu (önerilen)
node --test tests/project-policy.test.js                                  # tek dosya
npm run lint
npm run typecheck
npm run format:check      # düzeltmek için: npx prettier --write <dosya>
npm run test:coverage     # eşik: satır 80, dal 70
```

- Bu Windows makinesinde paralel koşuda (`npm test`) `npm-start` ve `project-startup` testleri, makinede başka
  süreçler çalışırken zaman aşımına düşebilir. Önce seri koşuyla ya da tek başına doğrulayın; gerçek hata sanmayın.
- Prettier `*.md` dosyalarını denetlemez.
- CI (`.github/workflows/ci.yml`): Ubuntu/Windows/macOS × Node 22/24; kapsam eşiği Ubuntu + Node 22 işinde
  denetlenir. macOS'ta geçici dizin bir symlink'tir (`/var` → `/private/var`); yol karşılaştırmalarında `realpath`
  kullanın.

## Git akışı

- `main`'e doğrudan commit atılmaz; her iş ayrı dalda (`fix/...`, `feat/...`, `docs/...`) yapılır, PR ile
  birleştirilir. Commit ve push yalnız kullanıcı isteyince yapılır.
- Commit mesajı: Conventional Commits + Türkçe açıklama, ör. `fix(project): sır filtresindeki yanlış alarmları gider`.
- Birleştirilen dal yerelde ve GitHub'da silinir; yerel `main`, `origin/main` ile eşitlenir.
