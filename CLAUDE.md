# LLM Manager — Claude için çalışma notları

Kullanıcıyla ve commit/PR metinlerinde **Türkçe** yazın. Ayrıntılı davranış için önce `README.md` ve
`docs/KULLANICI_KILAVUZU.md` okunur; bu dosya yalnız kodda/belgede kolayca görülmeyen çalışma kurallarını tutar.

## Proje

- Node.js 22.12+ ESM, Express isteğe bağlı. LLM sağlayıcı/profil yönetimi + **Proje Asistanı** (hedef uygulamayı
  tarayıp kaynaklı sohbet, Graphify ilişkileri, OpenCode görevleri).
- Çekirdek `src/core.js` (`createLLMManager`), Express bağlantısı `src/integration*`, sağlayıcılar `src/providers.js`
  ve `src/providerTransport.js`, Proje Asistanı `src/project/`, arayüz `public/`, CLI `bin/`, testler `tests/`.
- Modül haritası (kodla doğrulandı): `src/transports/{openai,anthropic,google}.js` istek gövdesi ve yanıt ayrıştırma;
  `src/catalog/providers.json` sağlayıcı listesi **ve** modele özel kurallar (`tokenField`, `streamUsage`,
  `thinkingStyle`, `modelFamilies`; arama `modelFamily()` ile `src/providers.js`'te) — taşımalarda model adı düzenli
  ifadesi yoktur, `tests/catalog-capabilities.test.js` bunu denetler; `src/authLimit.js` Express ve Web (`fetch`)
  adaptörünün ortak hatalı giriş politikası; `src/runtime.js` sağlayıcı çağrısı, hata sınıflama, SSE ayrıştırma;
  `src/profileStore.js` + `src/store/` şifreli profil ve yan dosyalar (`<profil-dosyası>.assistant.enc` sohbet geçmişi,
  `<profil-dosyası>.tasks.enc` uygulanmış görevlerin geri alma kaydı); anahtar döndürme/yedek `src/setup.js` üç dosyayı
  birlikte işler; `src/init/` kurulum sihirbazı; `src/project/{index,tasks,changes,files,policy,retrieval,...}.js`
  Proje Asistanı (kaynaklı sohbet `stream: true` ile `meta` → `delta` → `done` akar).
- İki HTTP adaptörü (`src/core.js` Web `fetch`, `src/index.js` Express) hâlâ yinelenen kod taşır (SSE yazıcıları, kimlik/CSRF/kota).
  Birinde değişiklik yapınca ötekini de güncelleyin ve iki adaptör için de test yazın (K19 bunu tekilleştirecek).
- Bakım kapsamı (kullanıcı kararı, 2026-11-21): Gemini 3 altı, Claude 4.x ve altı, OpenAI o-serisi ve genel olarak
  **1 yılı aşmış veya sağlayıcıca kapatılmış modeller** için kural/öneri eklenmez; katalogda olmayan modele ek istek alanı
  gönderilmez (güvenli varsayılan). Yeni model ailesi `modelFamilies`'e belge teyidiyle eklenir.
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
- Tam seri koşu bu makinede ~7–10 dk sürer (arka planda koşturun). Yük altında tek seferlik düşüşler görüldü
  (`project-api` içinde "development tasks…" testi bir kez 500 verdi, `server-lifecycle` zaman aşımı); tek başına
  ve ikinci tam koşuda geçiyorsa geçici sayılır, ama sessizce geçmeyin: sonuçta belirtin.
- Windows'ta dosya sistemi büyük/küçük harf duyarsızdır (`Views/` = `views/`): test fixture'larında yalnız harf
  farkıyla ayrışan dizin kurmayın. Git Bash `/tmp` ile Node'un çözdüğü `/tmp` farklıdır; geçici dosya için oturumun
  scratchpad dizinini kullanın.
- Betik/heredoc içinde ters eğik çizgili diziler (satır sonu, rakam sınıfı) kaybolabilir; `$&` gibi desenler
  `String.replace` ile yorumlanabilir: toplu düzenlemede Edit aracını ya da `replace(a, () => b)` biçimini kullanın.
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

## Açık işler ve devir

Ayrıntılı iş kalemleri yerel (takipsiz) `YOL_HARITASI.md` dosyasındadır (varsa önce onu okuyun: durum özeti, K16–K23
şartnameleri, kullanıcı kararları); dosya yoksa bu liste ve `docs/KULLANICI_KILAVUZU.md` "Doğrulanmış durum ve açık işler"
yeterlidir. **Tamamlanan:** K01–K15, K17, K18, K21, K22 (PR 29–48) ve bunların dışındaki küçük işler. **Açık:**

- **K16** Sohbet geçmişi her kayıtta tüm dosyayı yeniden şifreliyor (`src/store/assistantHistory.js`): önce ölçüm
  (50 sohbet × 200 KiB), kazanç küçükse yalnız `mtime+size` okuma önbelleği; kapsam kullanıcıya sunulur.
- **K19** İki HTTP adaptörünün politika kodunu tekilleştirme (`authorizeRequest` benzeri tek işlev, SSE yazıcısı,
  `chatCompletion`'ın iki yedek-profil döngüsü). Davranış değiştirmeyen yeniden düzenleme: önce/sonra tam seri geçmeli,
  iki adaptöre aynı istek tablosunu gönderen "adaptör eşdeğerliği" testi gerekir. Tasarım planı kullanıcıya sunulur.
- **K20** npm yayını (yayın iş akışı, köken kanıtı) — **kullanıcı kararı**; kendiliğinden başlatılmaz.
- **K23** Arayüz için gerçek tarayıcı testi — yeni geliştirme bağımlılığı **kullanıcı kararı**.
- Küçük: okunamayan görev arşivi sessizce yok sayılır (uyarı günlüğü yok); model listesi güncel değil
  (`claude-fable-5-2` yok; `scripts/check-catalog.js` anahtar ve onay ister); `deploy-acceptance.yml` Nginx/IIS adımlarında
  `LLM_TRUST_PROXY` yok (değişirse iş akışı elle tetiklenir).
- **Doğrulanmamış alanlar:** `src/init/` ve `public/` (proje arayüzü dışında) derin denetlenmedi; sağlayıcı davranışları
  (bitiş nedenleri, hata gövdeleri, bütçe alt sınırları) belge/arama özetiyle teyit edildi, canlı çağrıyla sınanmadı.
- Kullanıcının daha önce verdiği kararlar bu oturumda belgelendi (ör. `ask()`/`stream()` HTTP kotasından muaf, yedek parolası
  en az 12 karakter, `trustProxy` varsayılan kapalı); çelişen bir değişiklik yapmadan önce kılavuzun değişiklik özetine bakın.

## Git akışı

- `main`'e doğrudan commit atılmaz; her iş ayrı dalda (`fix/...`, `feat/...`, `docs/...`) yapılır, PR ile
  birleştirilir. Commit ve push yalnız kullanıcı isteyince yapılır. Yerel doğrulama (lint, typecheck, format,
  tam seri test) her iki iş sınıfında da commit öncesi yapılır; PR'ın ve CI'ın ne kadar bekleneceği iş sınıfına
  bağlıdır:
  - **Çekirdek iş** (`src/`, `bin/`, `types/`, `scripts/`, `.github/`, bağımlılıklar; güvenlik, gizlilik, yol,
    dosya sistemi, süreç ve CLI gibi platforma duyarlı kod): dal → push → PR → altı CI işinin bitmesi beklenir,
    sonuç (geçti/kaldı ve nedeni) raporlanır → kullanıcı onayıyla birleştirilir. Platform farklarını (ör. macOS
    `realpath`) yalnız CI yakalar.
  - **Küçük iş** (yalnız Markdown belge, yalnız test, kod davranışını değiştirmeyen yazım/yorum düzeltmesi):
    dal → push → PR yine açılır, ama CI'ın bitmesi beklenmez; kullanıcı onayıyla hemen birleştirilebilir, CI
    arka planda koşar ve düşerse bildirilir. Doğrudan `main`'e commit yine yapılmaz; yalnız kullanıcı o iş için
    açıkça isterse yapılır. Genel "PR sonrası CI takibi" kuralının bu depodaki istisnası budur.
  - İş sınıfından emin değilseniz çekirdek iş sayın. Bir iş hem kod hem belge içeriyorsa çekirdektir.
  - Push, iş bitince tek seferde yapılır (her commit'te değil); dal GitHub'a gitmeden CI, PR ve yedek olmaz.
- Commit mesajı: Conventional Commits + Türkçe açıklama, ör. `fix(project): sır filtresindeki yanlış alarmları gider`.
- Birleştirilen dal yerelde ve GitHub'da silinir; yerel `main`, `origin/main` ile eşitlenir.
