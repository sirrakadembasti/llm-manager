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
- Her commit/push öncesi README başta olmak üzere tüm Markdown belgeleri (`git ls-files "*.md"`: `README.md`,
  `docs/KULLANICI_KILAVUZU.md`, `CLAUDE.md`) değişiklikle karşılaştırılır: test sayıları, özellik açıklamaları,
  kurulum notları ve doğrulanmış durum satırları güncel değilse önce belge güncellenir, sonra commit/push yapılır.
  Yalnız kılavuzu güncellemek yetmez.

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
- `tests/auth-policy.test.js` içindeki init probe testi de yükte geçici `fetch failed` verebilir; tek başına
  tekrar koşturun.
- Yeni git worktree'de `node_modules` yoktur: lint/typecheck üst klasördekini bulup geçer, ama kurulum/derleme
  testleri (`init-*`, `real installed host`, CLI paketi) `MODULE_NOT_FOUND` ile düşer. Önce worktree'de `npm ci`.
- Prettier `*.md` dosyalarını denetlemez.
- Dağıtım kabulü (`.github/workflows/deploy-acceptance.yml`: Docker, systemd+Nginx/HTTPS, IIS) kullanıcı kararıyla
  **yalnız elle** çalışır; otomatik tetikleyici (schedule/tags/pull_request) eklenmez. `Dockerfile`, servis talimatı veya
  `scripts/acceptance/` değişince `gh workflow run deploy-acceptance.yml --ref <dal>` ile tetiklenir. Depo herkese açık olduğundan
  GitHub'ın standart makinelerinde Actions dakikası ücretlendirilmez; depo yeniden özel yapılırsa Windows dakikası 2,
  macOS dakikası 10 kat sayılır.
- İş akışlarında eylemler `@<40 hane SHA> # vX.Y.Z` biçiminde sabitlenir, izin `contents: read` kalır;
  `tests/supply-chain.test.js` etiketle (`@v4`) yazılan eylemi reddeder. SHA'yı `gh api repos/<eylem>/commits/<etiket>`
  ile bulun; güncellemeleri Dependabot PR'ları getirir. Dependabot `undici` ve `express` büyük sürümlerini yok sayar
  (undici 8 Node 22.19+ ister; `express` Express 4 testleri içindir). `engines.node` yükseltilmeden undici 8'e geçilmez.
- `package.json` `overrides.minimatch` eslint'in açıklı minimatch 10'unu 11'e çeker; eslint kendi bağımlılığını
  ≥11.0.1'e yükseltene kadar kaldırılmaz. Geliştirme açıklarını `npm audit` (`--omit=dev` olmadan) ile denetleyin.
- CI (`.github/workflows/ci.yml`): Ubuntu/Windows/macOS × Node 22/24; kapsam eşiği Ubuntu + Node 22 işinde
  denetlenir. macOS'ta geçici dizin bir symlink'tir (`/var` → `/private/var`); yol karşılaştırmalarında `realpath`
  kullanın.

## Canlı (ücretli) denemeler

Kullanıcı onay verdiğinde:

- Önce model çağırmadan seçilen kaynakları eski/yeni kodla karşılaştırın; sonra çağırın.
- Tekrar ve yedeği kapatın (`retry: false`), istek ve sağlayıcının bildirdiği token sayılarını raporlayın.
- OpenCode görevlerinde yalnız fark hazırlayın (apply yok). Hedefin `git status` çıktısını ve dosya özetlerini
  önce/sonra karşılaştırın, görev kaydını kapatın.
- `.env` yalnız süreç ortamına yüklenir; değerler, anahtarlar ve profil içerikleri yazdırılmaz (yalnız ad/sağlayıcı/model).

## Git akışı

- `main`'e doğrudan commit atılmaz; her iş ayrı dalda (`fix/...`, `feat/...`, `docs/...`) yapılır, PR ile
  birleştirilir. Commit ve push yalnız kullanıcı isteyince yapılır.
- Commit mesajı: Conventional Commits + Türkçe açıklama, ör. `fix(project): sır filtresindeki yanlış alarmları gider`.
- Birleştirilen dal yerelde ve GitHub'da silinir; yerel `main`, `origin/main` ile eşitlenir.
