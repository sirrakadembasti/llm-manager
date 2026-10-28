# LLM Manager — tek yol haritası

## Birleşik sohbet ve sade yerleşim — uygulama planı

Kullanıcı üst alanın inceltilmesini, ana sayfa bağlantısının ve birinci sekmedeki profil sayısı/etkin profil özetlerinin kaldırılmasını istedi. Playground ayrı ekran olmaktan çıkarılıp Proje Asistanı'ndaki tek sohbetle birleştirilir. Masaüstünde sohbet solda geniş sütun; bağlı proje, etkin profil/model ve mimari özeti sağda tek bilgi bloğudur. Mobilde sohbet önce, bilgi bloğu sonra gelir.

Mimari: mevcut yönetim API'leri korunur. Ortak sohbet formunda model denemesi `/chat` (profil seçimi, sistem talimatı, SSE/JSON, süre/token, yerel iptal), kaynaklı sohbet `/project/chat`, plan/değişiklik `/project/tasks` kullanır. Kaynak modu ve model denemesi geçmişleri ayrılır; proje modları etkin profile sabitlenir. Kaynak bağlantısı kapalıyken model denemesi çalışır. Türkçe metin, güvenli textContent, kaynak paylaşım onayı ve dosya işlem onayları korunur. `.env.example` kullanıcı değişikliği olarak kalır; bu görev commit/push talimatı içermez.

- [x] `tests/playground.test.js`, `tests/project-ui.test.js`, yeni sohbet taşıma testleri: kaldırılan alanlar, tek form/sol-sağ sıra, projesiz model denemesi, profil/sistem/akış, geçmiş ayrımı, iptal ve kesilmiş/hatalı SSE için önce başarısız testleri doğrula.
- [x] `public/llm.html`, `public/llm-ui.js`: ince üst başlık/sekme düzeni, özet/ayrı Playground kaldırma, sağda tek bilgi bloğu ve solda tek sohbet; mevcut profil işlemlerini koru.
- [x] `public/chat-client.js`, `public/project-ui.js`, `src/core.js`: ortak sohbet taşıması ve görünüm durumları, güvenli SSE, süre/token, iptal, profil güncelleme köprüsü; mevcut kimlik korumalı betik içinde sun.
- [x] `public/i18n/tr.json`, kullanıcı/teknik/değişiklik belgeleri: birleşik akışı ve modlara göre kullanılabilen seçenekleri açıkla; API sözleşmesi değişmez.
- [x] İlgili testler, tam seri, lint/tip/biçim ve gerçek tarayıcıda masaüstü/mobil/açık-koyu/klavye akışını doğrula; tarihli sonuçları burada kaydet.

### Uygulama sonucu — 2026-10-28

İnce başlık ve aynı satırdaki sekmeler uygulandı; ana sayfa bağlantısı, birinci sekmedeki profil özetleri ve ayrı Playground kaldırıldı. Tek sohbet formunda model denemesi, kaynaklı sohbet, geliştirme planı ve değişiklik hazırlama birleştirildi. Sohbet solda, üç bilgi grubu sağda tek kartta; mobilde sohbet önce gelir. Mevcut API, profil kaydetme, kaynak paylaşımı ve dosya değişikliği onayları korundu. Belgeler güncellendi; başlangıçtaki `.env.example` değişikliği korunur. Commit/push yapılmadı.

- Test önce yaklaşımıyla projesiz model kullanımı, profil/sistem/akış, geçmiş ayrımı, yerel iptal, UTF-8/SSE tamamlanması ve Türkçe ağ/JSON/zaman sınırı hataları doğrulandı. Tam seri: **453 test; 452 geçti, 0 başarısız, 1 POSIX testi Windows'ta atlandı**. Bu turdan sonraki küçük Türkçe hata/bitiriş metni düzeltmeleri ve ek regresyon dahil son arayüz seçkisi **51/51** geçti; bu son düzeltmelerden sonra tam seri yeniden çalıştırılmadı.
- Son kaynaklarda ESLint ve TypeScript geçti; Prettier kontrolü geçti. `git diff --check` görev dosyalarında temiz; kullanıcıya ait `.env.example` içindeki mevcut satır sonu boşluğuna dokunulmadı. Bağımsız kod incelemesinde doğrulanmış ek bulgu yok.
- İzole yerel önizlemede gerçek tarayıcıyla model SSE ve ikinci profille JSON yanıtı, sistem talimatı, süre/token, sohbet temizleme, kaynaklı sohbette onaysız ret/onaylı yanıt, tarama, profil düzenleme ve klavye sekme geçişi doğrulandı. 1440px masaüstü ve 390px mobilde yatay taşma yok; mobilde bilgi kartı sohbetin altında. Koyu tema sistemden, açık palet yalnız geçici önizleme dönüşümüyle incelendi. Kontrollü sahte sağlayıcı kullanıldı; gerçek anahtar, aktif veri veya ücretli sağlayıcı çağrısı kullanılmadı.
- Bu görev statik Graphify çıktısını yenilemez; önceki harita tarihsel kaynak anlık görüntüsü olarak kalır.

## Belge, kod haritası ve Git teslimi — 2026-10-28

Kullanıcı ilgili Markdown ve Graphify çıktılarının güncellenmesini, tamamlanan çalışmanın commit edilip push yapılmasını açıkça istedi. Bu yetki aşağıdaki önceki oturumların commit/push yapılmadığını belirten tarihsel kayıtlarını değiştirmez. Sürüm artırma veya paket yayını yapılmaz. Başlangıçtaki kullanıcı değişikliği `.env.example` dosyasında korunur ve commit kapsamı dışında kalır.

- README, kullanıcı/teknik/entegrasyon/değişiklik belgeleri Proje Asistanı'nı kapsar. Katkı, dağıtım, güvenlik, tehdit modeli ve klasör belgeleri kaynak erişimi, motor/komut yetkileri, Graphify üretimi ve bellekte tutulan geri alma sınırlarıyla tamamlandı. Dağıtım belgesinde `npm start` için çalışma dizinindeki `.env` yüklemesi düzeltildi.
- Commit öncesi güncel kaynaklarla tam seri + kapsam: **446 test; 445 geçti, 0 başarısız, 1 POSIX testi Windows'ta atlandı**. Satır **%94,16**, dal **%85,96**, fonksiyon **%90,41**; 80/70 eşikleri geçti. Önceki 504 düzeltmesi dahil edildi. ESLint, TypeScript ve tüm eşleşen dosyalarda Prettier yeniden geçti. Kalıcı PATH/ortam ayarı değiştirilmedi.
- Graphify **0.9.97**, temiz Git indeks kaynağı üzerinde `extract --code-only --max-workers 1` ve `cluster-only --no-label`, `GRAPHIFY_BACKEND=none` ile çalıştırıldı. 173 paylaşılabilir kaynak dosyası seçildi; araç 172 kod dosyasını işledi, 1 dosyayı belge olarak atladı. **898 düğüm, 2499 ilişki, 62 topluluk** üretildi; 32 dosya sembol vermedi. Harici/import belirteçleri de düğüm olabilir. Ana çekirdek ve OpenCode kaynakları kapsamda; uygulamadaki daha sıkı içerik filtresinin ilk seçkisi yerine, yayınlanacak onaylı koddan ayrı harita üretildi.
- Çıktılar `docs/graphify-out/` altında: `graph.json`, `graph.html`, `GRAPH_REPORT.md`, `.graphify_analysis.json`, `manifest.json`, `source-manifest.json` ve Türkçe README. Kaynak özetleri depoya göre SHA-256 ile kaydedildi. Cache, `.graphify_root`, `.env*`, `data`, anahtarlar, kurulu bağımlılıklar ve kilit dosyası dışarıda tutuldu. LLM çağrısı ve gerçek DB bağlantısı yapılmadı.

- Çıktı denetimi: düğüm kimlikleri ve 2499 ilişkinin uçları tutarlı; 173 kaynak SHA-256 özeti güncel; Markdown dosyalarında kırık yerel bağlantı yok. Yayınlanacak 60 dosyada bilinen yerel sır değeri eşleşmesi 0; `.env.example` indeks dışında. `npm pack --dry-run --json`: **108 dosya**, 7 harita çıktısı, yasak veri/cache/sır/geçici kök dosyası 0.

Git teslim kapsamı, bu görevdeki kaynak/test/tip/belge/harita değişiklikleridir; kullanıcıya ait `.env.example` hariçtir. Hedef `origin/codex/yh1-completion`; commit kimliği ve gönderim sonucu Git geçmişi ve uzak dal ucu karşılaştırılarak doğrulanır.

## YH3 — onaylı tasarım ve uygulama planı

2026-10-28: Kullanıcı üç teslimi ve birinci sekmeyle uyumlu ikinci sekmeyi onayladı. Amaç, hedef uygulamayı kaynaklarıyla tanıyan ve etkin profille geliştirme yapılabilen Türkçe Proje Asistanı'dır. OpenCode geliştirme motoru, Graphify isteğe bağlı yapısal hafıza olarak kullanılır. Çekirdek Express bağımsız kalır; yeni zorunlu runtime bağımlılığı eklenmez. Mevcut `.env.example` kullanıcı değişikliğidir; değiştirilmez. Commit/push/yayın/sürüm artışı yapılmaz.

### Ekran ve işlem sözleşmesi

Mevcut 1200px kapsayıcı, renk değişkenleri, kartlar, butonlar, bildirimler ve mobil kırılım ortak kullanılır. Ana içerikte klavyeyle kullanılabilen `LLM Yönetimi` / `Proje Asistanı` sekmeleri; varsayılan ilk sekmedir. Bildirim paneli iki sekmede ortaktır. İkinci sekmede üstte bağlı proje/etkin model/tarama durumu, ardından mimari-API-veri özeti, kaynaklı sohbet ve değişiklik inceleme kartı bulunur. Bekleme/iptal/hata/başarı ayrılır; model metni HTML olarak işlenmez. Kaynak aktarımı öncesi kullanıcıya kapsam açıklanır. Arayüzden keyfi sunucu dizini seçilmez; kaynak kökü host seçeneği veya açık ortam ayarıdır.

Akış: bağlan → yerel tara → ilgili kaynakları seç → etkin modelle analiz/plan → ayrı geçici kopyada OpenCode değişikliği → dosya farklarını incele → açık onayla uygula → yapılandırılmış doğrulamayı çalıştır → yalnız sürüm eşleşiyorsa geri al. Yerleşik OpenCode `session.revert` hedef projede kullanılmaz. Kullanıcı dosyaları değişmişse uygulama/geri alma `PROJECT_CONFLICT` ile durur.

### Teslim 1 — bağlantı, güvenli tarama, kaynaklı sohbet

- [x] **YH3-T1 / kaynak sınırı:** `src/project/files.js`, `tests/project-files.test.js`. `createProjectFiles({ root, maxFiles, maxFileBytes, maxTotalBytes })` → `scan()`, `read(relativePath)`. Test önce: kök dışı yol/Windows yol biçimleri, symlink/junction, `.env`/anahtar/data/çıktı dışlaması, Git ignore, ikili/büyük dosya, dosya silme ve açık tarama sınırı. Dosya ağacı gerçekpath/lstat ile kontrol edilir; içerikte sır işareti olan dosya tümüyle dışlanır.
- [x] **YH3-T2 / envanter ve bağlam:** `src/project/analyze.js`, `src/project/context.js`, `tests/project-analysis.test.js`. `analyzeProject(files)` → teknoloji, bileşen, API, veri dosyaları ve kanıtlar; `selectProjectContext(files, question, budget)` → satır referanslı sınırlandırılmış kaynak. Manifest/config çalıştırılmaz. Test önce: frontend/backend/API/SQL örneği, eksik veya bozuk manifest, monorepo ve değişen kaynakların tazeliği. Kısmi tarama açıkça işaretlenir; desteklenmeyen ilişki uydurulmaz.
- [x] **YH3-T3 / Graphify adaptörü:** `src/project/graphify.js`, `tests/project-graphify.test.js`. İsteğe bağlı açık Python yolu ile `extract --code-only`; yalnız temiz kaynak kopyası, yalıtılmış HOME/env, shell yok, süre/çıktı sınırı ve iptal. Düğüm/ilişki dosyaları kaynak sınırında doğrulanır. Eksik araç anlaşılır durumdur; saf dosya bağlamı çalışır. Test önce: gerçek süreç protokolü, JSON şema reddi, timeout/abort ve kaynak dosyalarının değişmemesi.
- [x] **YH3-T4 / API:** `src/project/index.js`, `src/core.js`, `src/index.js`, `types/project.d.ts`, ilgili core/index tipleri, `tests/project-api.test.js`. `project: { root, graphifyPython?, opencodePath?, commands? }` seçeneği; `/project`, `/project/scan`, `/project/chat`, `/project/cancel` yolları. Yalnız admin; chat Bearer erişemez. Var olan CSRF/kota/mesaj sınırları korunur. Sohbet `ask` üzerinden etkin profili ve ağ politikasını kullanır; sırlar/günlükler bağlama dahil olmaz. Test önce: kapalı özellik, anonim/Bearer ret, gerçek Web/Express auth+CSRF, aktif profil değişimi, kaynak sınırı ve iptal.
- [x] **YH3-T5 / arayüz:** `public/llm.html`, `public/project-ui.js`, `public/llm-ui.js`, `public/i18n/tr.json`, `tests/project-ui.test.js`. Ortak tasarım, sekme/focus/aria, proje özeti, tarama, kaynaklar, sohbet ve iptal. Yeni betik mevcut kimlik korumalı UI asset akışında sunulur. Test önce: sekmelerin gösterme/gizleme ve klavye davranışı, kaynaklı yanıtın güvenli metin renderı, tekrar istek kilidi, iptal, devre dışı özellik ve eski profil işlemleriyle birlikte çalışma.

### Teslim 2 — OpenCode ile değişiklik hazırlama

- [x] **YH3-T6 / anahtar saklamayan köprü:** `src/project/relay.js`, `tests/project-relay.test.js`. Ephemeral oturum belirteciyle yalnız loopback üzerinde; aktif profilin native Google/Anthropic/OpenAI protokolü, model/işlem allowlist'i, sınırlı body/istek/süre ve `providerFetch` ağ filtresi. Gerçek key OpenCode env/config/diskine aktarılmaz. Test önce: yetkisiz ret, yanlış model/rota ret, araç alanlarının korunması, abort ve redaction. Desteksiz protokol açık hatadır.
- [x] **YH3-T7 / motor ve iş durumu:** `src/project/opencode.js`, `src/project/tasks.js`, `tests/project-opencode.test.js`. Güvenli kaynak kopyası üzerinde yalıtılmış OpenCode süreç/API adaptörü, `plan/change` görevleri, olay/sonuç/diff/iptal. Global veya hedef proje plugin/skill/config'i otomatik çalıştırılmaz. Shell varsayılan kapalıdır; hedef dosyada doğrudan düzenleme yoktur. Test önce: gerçek sahte sağlayıcıyla araç akışı, oturum ayrımı, sınırlı diff, iptal ve çocuk süreç kapanışı. Mevcut yerel 1.18.33 sürümüyle gerçek smoke testi ayrıca yapılır.

### Teslim 3 — onay, uygulama, doğrulama ve geri alma

- [x] **YH3-T8 / değişiklik işlemi:** `src/project/changes.js`, `tests/project-changes.test.js`. Dosya bazlı önce/sonra digest, açık görev revizyonu, oluşturma/güncelleme/silme, işlem kuyruğu ve yalnız eşleşen yazıyı geri alan hata kurtarma. Test önce: onaysız yazmama, kök dışı/symlink/secret ret, önceden var olan kullanıcı düzenlemesini koruma, sonradan değişmiş dosyada uygulama ve geri almayı reddetme, kısmi yazma hatası. Sistem hiçbir kullanıcı dalında commit/reset/checkout çalıştırmaz.
- [x] **YH3-T9 / komut ve inceleme ekranı:** `src/project/commands.js`, `public/project-ui.js`, `tests/project-commands.test.js`, arayüz testleri. Hostun adlandırdığı `command/args` listesinden seçim; her çalıştırma açık onaylı ve geçici proje kopyasında, shell yok. Süre/çıktı sınırı, iptal, gerçek exit code; sır içeren çıktı maskelenir. Ekranda dosya farkı, onay/uygula/geri al ve test sonucu. İşlem sırasında farklı görev/proje revizyonu reddedilir.
- [x] **YH3-T10 / girişler ve kapanış:** `bin/llm-manager.js`, `examples/server.js`, `src/server.js`, `types/*.d.ts`, README/kullanıcı/teknik/entegrasyon/değişiklik belgeleri. CLI `--project-root`, `LLM_PROJECT_ROOT`, isteğe bağlı motor yolları; kapalı özellik eski davranışı korur. `close()` devam eden görevleri ve motor/köprüyü kapatır. Hedefli testler, tam seri testler, lint/typecheck/format/kapsam ve tarayıcıda masaüstü/mobil/açık-koyu/klavye akışı doğrulanır. Paket çıktısına sır, geçici proje veya kurulu motorlar girmez.

Her kart önce davranış testi → beklenen başarısızlık → uygulama → ilgili test döngüsüyle yürütülür. Uzak/canlı kontroller yalnız gerçekten çalıştırıldığı kapsamda raporlanır. Tamamlanma için üç teslimin tamamı ve ilgili doğrulama kanıtları gerekir; yalnız ilk sekme tasarımı veya bir önizleme kapanış sayılmaz.

### YH3 uygulama sonucu ve doğrulama — 2026-10-28

Üç teslim uygulandı. Birinci sekme varsayılan kaldı; ikinci sekme aynı kapsayıcı, tema, kart ve bildirimleri kullanır. Kaynak kökü açık host seçeneğidir. Kaynaklı sohbet, OpenCode plan/değişiklik, isteğe bağlı Graphify, onaylı dosya uygulama/geri alma, adlandırılmış komutlar, iptal ve kapanış temizliği eklendi. API, tipler ve Türkçe kullanım/entegrasyon/teknik belgeleri güncellendi. `.env.example` başlangıçtaki kullanıcı değişikliği olarak korundu; `.env`, aktif `data` ve şifreleme anahtarları değiştirilmedi. Commit/push/yayın/sürüm artışı yoktur.

- Tam seri + kapsam komutu: `node --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include=src/** --test-coverage-lines=80 --test-coverage-branches=70 tests/*.test.js tests/**/*.test.js`. **445 test: 444 geçti, 0 başarısız, 1 atlandı**; atlanan, Windows'ta çalışmayan POSIX SIGTERM eskalasyon testidir. Son tam kapsam raporu: satır **%93,98**, dal **%85,46**, fonksiyon **%90,41**. Bu rapordan sonra eklenen native `TimeoutError` → 504 sınıflaması ve regresyonu, API/motor/giriş seçkisinde **13/13** ile doğrulandı; bu küçük son değişiklikten sonra tam seri/kapsam yeniden çalıştırılmadı.
- İlk tam turda çekirdek import izolasyonu yeni statik `node:child_process` importlarını yakaladı. Süreç modülü yalnız araç kullanılırken yüklenir hale getirildi. Mimari/dosya/Graphify/OpenCode/komut seçkisi **24/24**, ardından yukarıdaki tam tur geçti. Başlangıçtaki uzun Windows PATH, npm'nin `node` bulamamasına yol açıyordu; yalnız kontrol süreçlerinin PATH'i mevcut dizinlere indirildi, kalıcı sistem ayarı değiştirilmedi.
- Son kaynaklarda **ESLint, TypeScript ve Prettier geçti**. `npm pack --dry-run --json`: 101 dosya, 15 proje modülü; yasak veri/sır dizini veya geçici çalışma kopyası yok. Yeni zorunlu runtime bağımlılığı yoktur. Kökte tek Markdown dosyası README'dir.
- Gerçek kurulu **OpenCode 1.18.33** ile kontrollü yerel sağlayıcı: 3 istekle kaynak okuma ve düzenleme geçti; özgün sentetik anahtar motor çalışma dizinine yazılmadı. Aynı kabul betiğinde gerçek **Graphify 0.9.97**: 4 düğüm/2 ilişki, SQL kaynak referansı bulundu. Bir ara tekrar OpenCode zaman bütçesine takıldı; takip eden tekrar geçti. Bu son kabul, ücretli canlı sağlayıcı veya gerçek DB bağlantısı değildir; önceki canlı profil ön değerlendirmesi aşağıda ayrı kayıtlıdır.
- Gerçek tarayıcı: 1440px masaüstü ve 390px mobilde yatay taşma yok; başlık/içerik sol kenarı eşit. Home/End ile sekme geçişi, tarama, SQL özeti, dosya farkı, onaysız ret, onaylı uygulama, örnek komutta gerçek exit 0, geri alma ve sayfa yenilendikten sonra görev seçimi doğrulandı. Koyu görünüm sistem temasıyla; açık palet yalnız geçici önizlemede dark media kuralı devre dışı bırakılarak incelendi. Arayüz akışındaki motor kontrollü sahte motordur; gerçek motor kabulü ayrı betiktedir.
- Bağımsız incelemenin Git ignore karakter sınıfı/globstar, UTF-8 BOM, POSIX süreç iptali ve kota bulguları kapatıldı. Çift kota regresyonu önce 429 ile kaldı, iç çağrı kabul bağlamıyla düzeltildikten sonra ilk istek 200/sonraki 429 geçti. Son incelemede ek P1/P2 bulgu bildirilmedi.

Sınırlar: analiz tam LSP veya canlı SQL introspection değildir; motor izinleri OS sandbox değildir. Kaynaklar filtrelenir fakat sır algılayıcı kusursuz değildir. Geri alma kayıtları yalnız bellektedir; çöküş sonrası kalıcı günlük/çok dosyalı ACID garantisi yoktur. Kaynak kopyasında bağımlılıklar ve sırlar bulunmaz; çalışmayan doğrulama başarılı sayılmaz. Motor araç çağrıları eski sohbet usage sayacına eklenmez.

Önizleme görev kopyası görev kapatma akışıyla temizlendi ve önizleme sunucuları kapatıldı. Otomatik onay denetimi iki sahipli sentetik önizleme klasörünün dosya sistemi üzerinden silinmesini `blocked by policy` gerekçesiyle reddetti; `%TEMP%/llm-project-preview-final-ZFXVIc` ve `%TEMP%/llm-project-preview-vjp85b` kaldı. Kaynak depoda değiller ve gerçek sır içermezler.

## YH3 — Proje Asistanı motor ön değerlendirmesi

2026-10-28: Kullanıcı OpenCode'un önce denenmesini istedi. Bu tarihsel kayıt ön değerlendirme anına aittir; o aşamada ikinci sekme ve ürün entegrasyonu henüz uygulanmamıştı. Sonraki uygulama sonucu yukarıdadır. Mevcut tamamlanmış YH1/YH2 işleri yeniden açılmadı. Üretim bağımlılığı veya ayar değişmedi. Başlangıçtaki kullanıcı değişikliği `.env.example` içinde korundu.

Deneme: Windows, Node.js 22.23.2, kurulu OpenCode 1.18.33 ve aynı sürüm JS SDK. Paketler/sunucu ayarları kullanıcı profilinden ayrılmış geçici ortamda; hedef, frontend/API/backend/SQL dosyaları bulunan yapay bir projeydi. Gerçek veritabanı bağlantısı yoktu. [Makine tarafından okunabilen kanıt](evidence/2026-10-28-opencode-graphify.json).

| Ölçüt | Gözlenen sonuç |
| --- | --- |
| Mimariyi kaynaklarıyla açıklama | Aktif Google/Gemini profiliyle canlı deneme geçti: 9 tamamlanan dosya okuması, 4 sağlayıcı isteği/4 HTTP 200. Frontend, `/api/orders`, backend servis, tablo sabiti ve SQL kolonları doğru dosya/satır referanslarıyla açıklandı. Yanıt ayrıca elle incelendi. |
| Aktif model ve özel endpoint | Aktif `gemini-3.8-flash`, bellek içi yerel köprü üzerinden çalıştı. Ayrı kontrollü OpenAI-compatible endpoint ile gerçek OpenCode dosya okuma aracı yürütüldü. Bu, tüm sağlayıcıların veya mevcut `/chat` API'sinin araç çağrısıyla uyumlu olduğunu kanıtlamaz. |
| Sırları ikinci depoya kopyalamama | Anahtar OpenCode'a verilmedi; köprü mevcut anahtarı yalnız bellekte kullandı. Son taramada 3241 geçici dosyada aktif API/şifreleme anahtarı eşleşmesi 0. `.env`, `.env.example`, profil ve anahtar dosyalarının içerik hash'leri değişmedi. |
| Dosya/komut onayı | API izin kapıları denendi: onay öncesi dosya değişmedi; ret sonrası değişmedi; tek seferlik onay sonrası değişti. Komut ret halinde çalışmadı, tek seferlik onay sonrası çalıştı. LLM Manager onay ekranı henüz yok. |
| Geri alma ve kullanıcı değişiklikleri | Başka dosyadaki mevcut değişiklik ve aynı dosyadaki işlem öncesi değişiklik korundu. **Başarısız:** aynı dosyaya asistan işleminden sonra eklenen kullanıcı satırı yerleşik `session.revert` tarafından kaldırıldı. Bu davranış ürün kabulünü karşılamıyor. |
| Windows, SDK ve iptal | Sunucu/JS SDK çalıştı; anonim sunucu isteği 401. Sağlayıcı bağlantısı kurulduktan sonraki abort akışı 1368 ms'de kapattı. Deneme sunucusu durduruldu. Tam Node 22.12.0, diğer OS'ler ve native sinyal teslimi denenmedi. |

Graphify 0.9.97 (`graphifyy[sql]`, Python 3.11.16) aynı yapay projenin temiz kaynak kopyasında `extract --code-only` ile sınandı. 8 kod dosyasından 25 düğüm/29 ilişki; çağrı/import bağlantıları, SQL tablo düğümü ve dosya/satır referansları çıkarıldı. Sorgu çalıştı; aynı adlı frontend/backend sembolleri için belirsizlik açıkça exit 3 ile bildirildi ve sembol kimliğiyle çözüldü. Artımlı koşuda 7 dosya değişmeden korundu, 1 dosya yeniden çıkarıldı; yeni sembol eklendi (26 düğüm/30 ilişki). İlk geniş taramanın üretilmiş OpenCode ayarlarını da indekslemesi, araç çıktıları için açık dışlama gerektiğini gösterdi.

Graphify sınırları: bu örnekte frontend HTTP çağrısından backend rotasına bağlantı oluşmadı; SQL kolonları ayrı düğüm değildi. Bir test dosyası sembol üretmedi. Yerel AST koşusu LLM çağırmadı; belge/medya semantik geçişi, silme senaryosu ve OpenCode MCP/eklenti bağlantısı denenmedi. Küçük örnek, büyük proje doğruluk/performans garantisi değildir.

Canlı model yalnız analizde kullanıldı; dosya/komut araçlarının izin/geri alma denemeleri kontrollü sahte sağlayıcıyla yürütüldü. Yerel anahtar köprüsü bir PoC'dir; üretim için oturuma özel kimlik doğrulaması, istek kapsamı ve profil seçeneklerini koruma katmanı gerekir. Bu oturumda uygulamanın tam test/lint/typecheck/kapsam paketi çalıştırılmadı; ürün kodu değişmedi. Belge kapsamındaki diff ve kanıt JSON biçimi denetlendi. Genel diff kontrolü mevcut kullanıcı `.env.example` değişikliğinde satır sonu boşluğu bildirir; bu kullanıcı değişikliği düzeltilmedi.

Karar önerisi: OpenCode isteğe bağlı geliştirme motoru, Graphify isteğe bağlı yapısal proje hafızası adayıdır. Aider alternatif kodlama motoru ve token bütçeli repo haritası referansıdır; bu oturumda çalıştırılmadı. Graphify, tüm LSP/refactoring yeteneklerinin yerine geçmiş sayılmaz. Graphify'ın Apache-2.0 lisansı ve Python çalışma ortamı gereksinimi dikkate alınır. Bu değerlendirmede Cline/Repomix/DBHub çalıştırılmadı.

- [x] OpenCode canlı profil, özel endpoint, izin, geri alma ve iptal ön değerlendirmesi; başarısız ölçüt yukarıda açıkça kayıtlı.
- [x] Graphify yerel kod/SQL haritası, sorgu ve artımlı güncelleme ön değerlendirmesi.
- [x] Ürün tasarımında uygulama/geri alma öncesi içerik sürümü karşılaştırması; eşzamanlı değişiklikte yazmadan durma ve çakışma gösterme.
- [x] İkinci sekme, araç protokolü, proje erişim sınırları, anahtar saklamayan köprü ve Graphify adaptörü için uygulama planını bu bulgularla güncelleme.

Kaynaklar: [OpenCode SDK](https://opencode.ai/docs/sdk/), [izinler](https://opencode.ai/docs/permissions/), [Graphify güncel kaynak dalı](https://github.com/Graphify-Labs/graphify/tree/v8), [lisans](https://github.com/Graphify-Labs/graphify/blob/v8/LICENSE), [Aider repo haritası](https://aider.chat/docs/repomap.html). OpenCode 1.19.5 veya V2 belgelerindeki sözleşmeler bu 1.18.33 denemesinin sonucu sayılmaz. Bu çalışma commit/push/yayın/sürüm artışı içermez.

## Arayüz iyileştirmesi — onaylı tasarım ve uygulama planı

2026-10-27: Kullanıcı tasarımı onayladı. Amaç: başlık/içerik hizası, görünür bildirimler ve profil kartında kalıcı test sonucu. HTML/CSS ve mevcut tarayıcı JS'i kullanıldı; yeni bağımlılık ve API değişikliği yok. Klavye erişimi ve mobil ekran korundu; ilk teslimdeki İngilizce destek sonraki kullanıcı kararıyla kaldırıldı.

- [x] `tests/ui-completion.test.js`: yükleniyor/hata/bilgi ayrımı, teknik ayrıntıların ayrılması ve kartta test sonucunun korunması için davranış testlerini ekle; eksik davranış nedeniyle başarısızlığı doğrula.
- [x] `public/llm.html`: başlık ve içerikte ortak 1200px kapsayıcı; masaüstünde görünür yapışkan bildirim, mobilde daralmayan düzen, açık/koyu tema ve odak stilleri.
- [x] `public/llm-ui.js`: durum başlığı, güvenli metin renderı, kapatma; hata kodu/destek kimliği/süreyi ayrı göster. Test sırasında ve sonrasında ilgili kartta sonuç göster; sayfa yenilendiğinde sunucunun kayıtlı test geçmişini kullan.
- [x] `public/i18n/tr.json`: bildirim başlıkları ve ayrıntı etiketleri eklendi. İlk teslimdeki İngilizce sözlük daha sonra kaldırıldı. İlgili UI/i18n testleri, lint/typecheck/format ve gerçek tarayıcıda masaüstü/mobil görünüm ile hata/başarı durumları doğrulandı; kılavuz ve değişiklik günlüğü güncellendi.

Kabul: hata kaybolmaz, sonraki işlem veya kapatma ile değişir; test sonucu yalnız test edilen kartta kalır; uzun destek kimliği taşmaz; yükleniyor başarı gibi görünmez; başlık ve içerik sol/sağ kenarları eşittir. Geçici toast yerine kalıcı durum paneli seçildi.

Doğrulama: UI/sohbet/kurtarma/i18n/hardening seçkisinde 50/50 test, lint/typecheck/format geçti. Gerçek tarayıcıda 1600px masaüstü ve 390px mobilde yatay taşma yok; başlık ve kartın sol kenarı eşit. Örnek API ile bekleme/hata/başarı ve kapatma kontrol edildi; üst bildirim kapanınca kart sonucu kaldı. Açık/koyu görünüm incelendi. Bağımsız incelemenin eski revizyon ve İngilizce başarı metni bulguları testlerle kapatıldı; açık bulgu yok.

Güncelleme: **2026-10-27** · Paket: `@sirrakadembasti/llm-manager` · Yerel sürüm: **2.0.0 / yayımlanmamış**.

**Durum:** YH1'in 32 mimari kartı ve YH2'nin G01–G26 kapsamı tamamlandı. YH2 yalnız FAZ 0/1/2 içerir; FAZ 3 yoktur. Aşağıdaki kimlikler önceki belgelerle izlenebilirlik için korunur. G13 ayrı görev kartı değildi; gerçek derleyici doğrulaması kapsamında kapatıldı.

Bu dosya eski iki yol haritasını, uygulama planını, denetim ve katalog kaynak kayıtlarını birleştirir. Ayrıntılı tarihçe Git'te `6efbe32` ve önceki commitlerdedir; eski dosyalardaki başlangıç bulguları güncel açıklar değildir. Kullanım: [README](../../README.md), [entegrasyon](../ENTEGRASYON.md), [dağıtım](../DAGITIM.md).

## Uygulama sırası ve kurallar

Sıra: güvenlik P0 → mimari temel → entegrasyon/depo P1 → runtime/arayüz/kalite P2. YH2 FAZ0 önce, FAZ1 çalışan senaryolar, FAZ2 belge/bağımsızlık uyumudur. Aşağıdaki bütün zorunlu işler kapalıdır; yeni işleri bu dosyada ayrı açık madde olarak kaydedin.

- Önce davranış testi, sonra düzeltme; bir görev bir commit. Kabul, tüm testler ve ilgili kalite kontrolleri geçmeli.
- API uyumu korunur; değişen API için tipler/README/değişiklik günlüğü güncellenir, ilgili görev kaydına kısa durum yazılır.
- Yeni runtime bağımlılığı eklenmez; dosya taşınırsa eski yol bir uyumluluk sürümü re-export sağlar.
- Anahtar/parola/istem/cevap loglanmaz. HTTP kimlik denetimi adaptörde, doğrudan ask/handle güvenilir host sınırındadır.
- Yayın, push, etiket veya sürüm artışı ayrıca yetki gerektirir. Tamamlanmış yerel çalışma yayımlanmış paket değildir.

## YH1 — mimari ve ürün

Tüm satırlar tamamlandı. Kanıtlar `tests/` altında, aksi belirtilmedikçe `.test.js` dosyasıdır.

| Kart | Sonuç / kısa kabul | Başlıca kanıt |
| --- | --- | --- |
| YH1-A1 | Core Express'siz yüklenir; init tembel/ayrı alt yol, eski async köprü ve senkron export geçişi belgeli. | architecture, package-metadata |
| YH1-A2 | `src/server.js` CLI/örnek/probe için ortak sunucu; ağ parolası ≥12, sahipli sinyal kapanışı ≤10 sn, örneksiz CLI çalışır. | server-lifecycle, server-options |
| YH1-A3 | Tüm alt yollar tipli; sync/async store örneği typecheck'ten geçer, CI testten önce tipleri denetler. | `types/test.ts`, CI |
| YH1-A4 | Tipli hata/cause; zaman aşımı 504, iptal 499; filtre/kesilme ayrımı. Türkçe regex yalnız classifier yedeğinde. | errors, final-stream-regressions |
| YH1-A5 | OpenAI/Anthropic/Google stratejileri; mesaj/usage normalizasyonu, cevap ve düşünce ayrımı. | transports, thinking |
| YH1-A6 | Init sorumluluklara bölündü; eski giriş köprü, modüller ≤300 satır (kapanışta en büyük 239). | init-safety, architecture |
| YH1-B1 | Stat/anahtar cache ve clone izolasyonu; 1000 okumada gereksiz disk okuması yok. B2 ile async hale geldi. | store-cache |
| YH1-B2 | FIFO, async I/O, 5 sn süreç kilidi ve Windows retry; iki süreç 50'şer save → 100 profil. Eski kilit için >10 sn ve ölü PID gerekir. | store-concurrency, lock-access-retry |
| YH1-B3 | Şema v1/migration, önceki sürüm .bak, bozuk/yeni sürümde yazmama ve UI kurtarma mesajı. HTTP 500 yanında tipli kod korunur. | store-recovery, store-async |
| YH1-B4 | Anahtar önceliği/legacy.env geçişi, kilitli rotate ve şifreli export/import; eski anahtar yeni veriyi çözemez. | key-management, store-async |
| YH1-C1 | Rol/user/mesaj/karakter ve 256 KiB gövde sınırı; gerçek 300 KiB → 413, Content-Length okumadan ret, sınırda iptal. | runtime-controls, final-http-acceptance |
| YH1-C2 | Varsayılan admin override; Bearer profil/süre/token/thinking değiştiremez. Trusted doğrudan handle uyumu korunur. | auth-policy, runtime-controls |
| YH1-C3 | Token bucket en çok 10000 kimlik; auth 10/chat 30/test-model 10 istek/dk. 429 + Retry-After, kararlı kişi kimliği ve reset. | runtime-controls, auth-policy |
| YH1-C4 | Üç SSE protokolü, delta/done/error, 8 MiB sınır ve kopmada iptal; düşünce sızmaz, filtre başarı sayılmaz. | streaming, stream-cleanup, final-stream-regressions |
| YH1-C5 | temperature/topP/stop/responseFormat; raw usage/finishReason, gelişmiş UI; varsayılan ask string kalır. | production-params, ui-completion |
| YH1-C6 | Yalnız retryable hata; jitter/Retry-After, 503/503/200 kabulü, 401'de tekrar yok. Tek bütçe ve gerçek fallback kimliği; çıktı sonrası tekrar yok. | retry-fallback, final-stream-regressions |
| YH1-C7 | Modele göre reasoning eşlemeleri/kapama sınırları ve yetenek temelli UI; eski kart örneği güncel model kısıtını ezmez. | thinking |
| YH1-C8 | ProxyAgent ve bilinen/açık hedef listesi; proxy DNS güvenlik ödünleşimi belgeli. Pozitif CONNECT smoke ayrı. | network-proxy-lan |
| YH1-C9 | Açık host/port ile LAN HTTP; liste dışı ret, Ollama notu; gerçek varsayılan depoda save/reload/çağrı. | network-proxy-lan, final-http-acceptance |
| YH1-C10 | Donmuş JSON katalog/tarih, güvenli admin önizleme ve hesap bazlı checker; tarihlenmiş resmi kaynaklar aşağıda. | catalog-preview, catalog-docs |
| YH1-D1 | Request-id, derin redaction, false-only içerik politikası; her mantıksal sohbet için tek completion ve son aday. | observability, chat-completion-lifecycle |
| YH1-D2 | Public health sır/profil ayrıntısı göstermez; health:false kapatır. | health |
| YH1-D3 | node:22-alpine, non-root, volume, host, healthcheck ve dockerignore/dağıtım kılavuzu. Gerçek imaj çalıştırılmadı. | docker |
| YH1-D4 | Async içeriksiz JSONL, admin aylık özet/UI; hata/iptal/erken dönüş dahil tek güvenli usage kaydı. | usage, usage-lifecycle, ui-completion |
| YH1-E1 | Etkin profil varsayılan playground; textContent, SSE, süre/token gösterimi. | playground, streaming |
| YH1-E2 | Tarihsel iki dilli arayüz görevi tamamlandı; sonraki kararla İngilizce sözlük/dil ayarı kaldırıldı, arayüz ve belgeler Türkçeleştirildi. Kart kimliği izlenebilirlik için korunur. | i18n, turkce-docs, ui-completion |
| YH1-E3 | homeUrl, sırsız klon, erişilebilir onay/Escape, form kilidi ve katalog tarihi. | ui-enhancements, ui-completion |
| YH1-F1 | ESLint/Prettier/LF, üç OS×Node 22/24 CI. Node 20, düşük engine seçilmediği için matris dışında. | kalite komutları, CI |
| YH1-F2 | Gerçek Express 4 ESM/CJS/5 host+junction+HTTP; Node Request köprüsü ve üç mock SSE sağlayıcısı. Framework iskelet E2E opsiyonel. | integration/, helpers/mockProvider.js |
| YH1-F3 | src kapsam eşikleri ≥%80 satır/%70 dal; beş temel modül hedefi ≥%85 satır. | test:coverage |
| YH1-F4 | Scoped kimlik, Node ≥22.12, optional Express, metadata/types; paket test/data/gerçek .env içermez. Funding opsiyonel. | package-identity, package-metadata |
| YH1-F5 | Güvenlik/katkı rehberi/tehdit modeli, mevcut-planlanan ayrımı ve CI üretim audit. | security-docs |

## YH2 — vaat ve gerçek uyumu

| Faz / kart | Kapatılan iş / kabul | Başlıca kanıt |
| --- | --- | --- |
| 0 · YH2-G01 | SPA admin parolası taşımaz; sohbet Bearer yalnız chat'e erişir. | phase0-security, init-security |
| 0 · YH2-G02 | Web sayfa/API auth; anonim 401, admin yazma 201, eksik yapılandırma 500 AUTH_NOT_CONFIGURED. | auth-policy |
| 0 · YH2-G03 | chatAccess:false→404 CHAT_DISABLED; generate çağrılmaz. | plugin, phase0-security |
| 0 · YH2-G04 | Rastgele parola yalnız .env; kod/script/log sır içermez, env biçimi korunur. | init-security, env-roundtrip |
| 0 · YH2-G05 | data/.env/.env.local/*.key gitignore'a güvenle eklenir. | init-wizard, init-security |
| 0 · YH2-G06 | Wildcard yönetim CORS'u açmaz; Vite dışı açık origin, boş seçimde eski izin silinir. | phase0-security, architecture |
| 0 · YH2-G07 | Scoped paket uyarısı ve gerçek çevrimdışı yerel kurulum/import/sürüm/bin kabulü. | package-identity, package-metadata |
| 1 · YH2-G08 | Tüm async host/Map ve dosya store çağrıları await; CRUD/test/chat güvenli. | store-async, host-store |
| 1 · YH2-G09 | Nuxt/SvelteKit/Next sunucu kodu istemciye eklenmez; action/ask örnekleri auth'a delege eder. | init-g09 |
| 1 · YH2-G10 | CJS setup senkron; rota 404'ten önce, kurulum hatası senkron iletilir. | init-safety |
| 1 · YH2-G11 | Eklenti parser'ı auth sonrası; host parser sırasından bağımsız 201, bozuk 400/büyük 413. | express-body-parser |
| 1 · YH2-G12 | Dosya ağacı/byte/izin/env/config/script rollback; -y hatada otomatik geri alır. Bağımlılık önkoşulu ayrı. | init-rollback-snapshot |
| 1 · YH2-G13 | Gerçek araç varsa derleme/sözdizimi kontrolü, yoksa açık atlama; host proje build garantisi verilmez. | init-g17, init-python, init-g14 |
| 1 · YH2-G14 | .NET 4.0/modern ayrımı, NuGet'siz JSON, 330 sn/iptal, assembly ve örtük kaynak uyumu. | init-g14, init-g14-legacy |
| 1 · YH2-G15 | Tauri Electron sanılmaz; ayrı Node sunucusuna HTTP istemcisi. | init-electron, init-g17 |
| 1 · YH2-G16 | Electron userData/preload/IPC ve kendi loopback yönetim penceresi; parola renderer'a verilmez. | init-electron |
| 1 · YH2-G17 | TS/giriş algılama; çıktı dizinine veya desteklenmeyen framework girişine kod yazılmaz. | init-g17 |
| 1 · YH2-G18 | Next göreli import, Node runtime/Edge uyarısı, konservatif serverExternalPackages düzenleme. | init-g18 |
| 1 · YH2-G19 | Python/C# URL/token ortamdan; Türkçe tipli hata/timeout ve sürekli servis kılavuzu. | init-python, init-g14 |
| 1 · YH2-G20 | Fiziksel host paket/Express kurulumu onayla ve yeniden kontrolle tamamlanır; cache host yerine geçmez. | init-package |
| 1 · YH2-G21 | Quick reasoning/boş token-kesilme tanısı yanlış negatif sayılmaz; sohbet kesilme hatası ve düşünce gizliliği korunur. | runtime-diagnostics, thinking |
| 2 · YH2-G22 | Nötr UI/test mesajları, legacy purpose başına tek uyarı, eski generate bayraklarını iletmeme. | purpose-compat, ui-completion |
| 2 · YH2-G23 | Varsayılan liste tarihi gerçek katalogdan; canlı liste talimatı görünür. | catalog-docs |
| 0 · YH2-G24 | Admin ve sohbet kimliği ayrıldı; Bearer yönetimde 403, chat 200. | phase0-security, auth-policy |
| 2 · YH2-G25 | Aynı 10 senaryo, üretim/auth/serverless/süreç sınırları ve Windows ACL notu. | integration-docs, turkce-docs |
| 2 · YH2-G26 | Optional peer Express 4/5; gerçek ESM/CJS/5 auth/parser HTTP uyumu. | integration/hosts, integration/express5-errors |

## Kabul ve doğrulama

| Tarih / baş | Yerel sonuç |
| --- | --- |
| 2026-10-25 · YH2 FAZ0 | 195/195; sır/auth/CORS ve gerçek scoped npm kabulü |
| 2026-10-25 · YH2 FAZ1 | 276/276; src %92,94 satır/%85,13 dal; C#/TS/Python gerçek araç kabulü |
| 2026-10-26 · YH2 FAZ2, `588c793` | 283/283; src %93,03/%85,33; dört genel inceleme bulgusu kapalı |
| 2026-10-27 · YH1 ürün `7297204`, kayıt `46551a1` | 386/386; src %94,78 satır/%87,70 dal/%93,02 fonksiyon; lint/typecheck/format yeşil |
| 2026-10-27 · PATH düzeltmesi `6efbe32` | 388/388; sıfır hata/atlama/iptal,234588 ms; standart npm kalite komutları ve gerçek npm start health/auth geçti; kalıcı PATH sabit |

Son kapsam ölçümü 386 testlik koşuya aittir: auth %100, core %93,89, profileStore %91,64, providerTransport %94,33, runtime %99,16 satır. 388 testlik koşuda yeni kapsam ölçülmedi. Önceki paket denetimi 89 dosya/yasak içerik 0 ve üretim audit 0 kendi kapanış tarihinin kanıtıdır. Belge birleşmesi sonrası paket 80 dosya, yasak içerik yok; tek roadmap Markdown içerir. Belge düzenlemesi 13 hedefli ve 388/388 tam testle doğrulandı; 58 kimlik ve 37 yerel bağlantı denetimi, kalite ve bağımsız inceleme geçti.

YH1'in on tamamlama commiti: `f2c4b0a` A4, `9f189f0` B4, `7078c1c` C3, `ff711ec` D1, `f10ef20` D4, `a836033` B3, `873f94c` A2, `9c3c12a` F5, `4cd807a` A1, `44024fa` E2. Genel inceleme `51978fc..44024fa`; beş LAN/akış bulgusu ve C1 kabul boşluğu `7297204` ile kapandı. Dar incelemede yedi madde kapalı, yeni kritik/önemli/küçük bulgu yok. PATH düzeltmesi ayrı bağımsız incelemeden geçti.

Tekrar doğrulama:

```sh
node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
node docs/roadmap/dogrulama.mjs
npm pack --dry-run --json
npm audit --omit=dev
```

Seri kapsam için Node seçeneklerini dosya yollarından önce verin: `node --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include=src/** --test-coverage-lines=80 --test-coverage-branches=70 tests/*.test.js tests/**/*.test.js`. Doğrulama betiği 404 / profil listesi / 409 / 201 / 500 bekler; tam test paketinin yerine geçmez.

**Sınırlar:** Docker dosya sözleşmesi testlidir; motor başlatılamadığı için gerçek imaj build/run yapılmadı. Uzak OS×Node CI, paketli Electron/Tauri/framework E2E, canlı ücretli sağlayıcı/katalog hesabı ve pozitif proxy CONNECT çalıştırılmadı. Sinyal testleri gerçek alt süreç/HTTP ile Windows IPC callback ve kontrollü saat kullandı; native konsol/POSIX teslimi doğrulanmadı. .NET 4.0 referans derlemesi kurulu CLR 4.8.1'de çalıştı; özgün4.0 runtime/net48 targeting-pack build kanıtı değildir.

PATH sorununun nedeni geçici .NET SDK evlerinin kullanıcı PATH'ine eklenmesiydi. Üretim ve test SDK çağrıları `DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=false` kullanır. Bu makinede yalnız106 silinmiş test girdisi yedeklenerek temizlendi; yeni testler kalıcı ortamı değiştirmedi. Bu düzeltme diğer zaman aşımı gözlemlerinin tüm nedenlerini açıklamış sayılmaz.

## Sonraki isteğe bağlı işler

Güncel dil düzenlemesi: İngilizce arayüz ve etkin dil ayarı kaldırıldı; eski JavaScript `locale` değeri yok sayılır. Teknik kılavuz ve politika dosyaları Türkçe adlara taşındı, yerel bağlantılar güncellendi. Tam seri test paketi 395/395 geçti; hata/atlama/iptal yok (282395 ms). Lint, tip ve biçim kontrolleri, paket içeriği, 59 yerel bağlantı ve 58 görev kimliği doğrulandı; bağımsız incelemede açık bulgu yok. Bu çalışma yayın veya yeni canlı sağlayıcı doğrulaması içermez.

Zorunlu eski kartlarda açık iş yok. Aşağıdakiler henüz uygulanmış/çalıştırılmış sayılmaz:

- [ ] Uygun ortamda Docker build/run, kalıcı volume ve auth smoke testi.
- [ ] Uzak üç OS×Node 22/24 matrisi ve native sinyal teslimi kabulü.
- [ ] Haftalık/elle Next/Nuxt/SvelteKit iskelet build ve paketli masaüstü E2E.
- [ ] Pozitif proxy CONNECT ve izinli canlı sağlayıcı/hesap kontrolleri.
- [ ] Tedarik zinciri: dependency/lockfile inceleme süreci, immutable action pinleri, yayın kaynağı politikası/provenance/imza.

Yayın bu listeyle otomatik yetkilendirilmez. Katalog güncellemesinde resmi kesin kimlik doğrulanamazsa öneriyi kaldırın; boş liste kabul edilir. [Tehdit modeli](../TEHDIT_MODELI.md).

## Katalog kaynakları

**2026-10-24 tarihli kaynak denetimi**; bu belge düzenlemesi yeni canlı doğrulama değildir. Kesin ID'ler [providers.json](../../src/catalog/providers.json) içindedir. Bu, tüm modellerin listesi veya hesap/bölge/üretim erişim garantisi değildir. Ücretli/kimlik bilgili üretim çağrısı yapılmadı.

| Sağlayıcı | Tutulan kesin öneriler | Resmi kaynak / sınır |
| --- | --- | --- |
| OpenAI | gpt-6-astra, gpt-6.1-sol, gpt-6-luna | [Katalog](https://developers.openai.com/api/docs/models), [GPT-6](https://developers.openai.com/api/docs/guides/latest-model); text Chat Completions. Astra/Sol araç çağrısı Responses ister; paket araç çağırmaz. |
| Anthropic | claude-fable-5-1, claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5 | [Modeller](https://platform.claude.com/docs/en/models/overview), [thinking](https://platform.claude.com/docs/en/build-with-claude/thinking). |
| Google | gemini-4-argon, gemini-3.8-flash, gemini-3.5-flash-lite | [Modeller](https://ai.google.dev/gemini-api/docs/models?hl=en), [thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking.md); ses/video/görüntü üretim kapsam dışı. |
| xAI | grok-4.7 | [Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions); desteklenen legacy uç. |
| OpenRouter | moonshotai/kimi-k3.1-pro | [Public model API](https://openrouter.ai/api/v1/models); küçük text-output alt kümesi. |
| Groq | openai/gpt-oss-120b, openai/gpt-oss-20b, llama-3.3-70b-versatile, llama-3.1-8b-instant | [Modeller](https://console.groq.com/docs/models); Llama için enterprise onayı gerekebilir. |
| Together | deepseek-ai/DeepSeek-V4-Pro-0813, deepseek-ai/DeepSeek-V4.1-Flash-1017, Qwen/Qwen3.8-Flash | [Serverless](https://docs.together.ai/docs/serverless/models). |
| Fireworks | accounts/fireworks/models/glm-5p3-flash | [Quickstart](https://docs.fireworks.ai/getting-started/quickstart). |
| Cohere | command-a-plus-05-2026, command-a-03-2025, command-r-plus-08-2024, command-r-08-2024 | [Modeller](https://docs.cohere.com/docs/models), [OpenAI uyumu](https://docs.cohere.com/docs/compatibility-api). |
| DeepSeek | deepseek-flash, deepseek-v4-pro | [Modeller](https://api-docs.deepseek.com/quick_start/pricing/); eski alias yerine güncel Flash. |
| Qwen | qwen3.8-max, qwen3.7-plus, qwen3.8-flash | [Modeller](https://www.alibabacloud.com/help/en/model-studio/models), [kimlikler](https://www.alibabacloud.com/help/en/model-studio/text-generation-model); bölgesel izin gerekir. |
| Kimi | kimi-k3.1-pro, kimi-k3.1-pro-highspeed | [Quickstart](https://platform.kimi.ai/docs/get-your-api-key). |
| MiniMax | MiniMax-M3.1-Flash, MiniMax-M3 | [Modeller](https://platform.minimax.io/docs/guides/models-intro), [OpenAI uyumu](https://platform.minimax.io/docs/api-reference/text-openai-api). |
| Xiaomi MiMo | mimo-v2.6-pro, mimo-v2.6-flash | [Liste](https://mimo.mi.com/docs/en-US/quick-start/model), [Pro](https://mimo.mi.com/models/en-US/mimo-v2-6-pro), [iki ID örneği](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/batch-api); V2.5 önerileri kaldırıldı. |
| Ollama | gpt-oss:20b | [Yerel OpenAI uyumu](https://docs.ollama.com/api/openai-compatibility); modelin yerelde kurulu olması gerekir. |

Doğrulanamayan öneriler kaldırıldı; sağlayıcı/uç önayarları korundu. Boş liste sağlayıcının modeli olmadığı veya kaldırılan her modelin emekli olduğu anlamına gelmez:

| Boş liste | Tarihli gerekçe / kaynak |
| --- | --- |
| Perplexity | [Sonar geçişi](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview), [yeni modeller](https://docs.perplexity.ai/docs/agent-api/models): Responses/Agent ID'leri mevcut Chat Completions için doğrulanmadı. |
| Zhipu GLM | [Global Z.ai](https://docs.z.ai/api-reference/llm/chat-completion), varsayılan BigModel China envanterini kanıtlamaz. |
| SiliconFlow | [Quickstart](https://docs.siliconflow.com/en/userguide/quickstart), [global chat](https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions): China hesabı doğrulanmadı. |
| Baidu | [Qianfan](https://cloud.baidu.com/doc/qianfan/index.html): kesin güncel ID kurulamadı. |
| Doubao | [Ark](https://docs.volcengine.com/docs/ark/model-list?lang=zh): araç yalnız JS kabuğu gördü. |
| Hunyuan | [Tencent](https://cloud.tencent.com/document/product/1729/104753): kaynak isteği timeout oldu. |
| Custom | Kullanıcı ucu; ortak envanter yok. |

Thinking yeteneği her modelde aç/kapat garantisi değildir: Claude 5.5/5.1 adaptive kullanır; Fable/Opus full-off reddeder, Sonnet between_tools ve Haiku disabled destekleri effort'a bağlıdır. Gemini 3/4 enabled için thinkingLevel medium, auto için ayar yok, full-off ret; Gemini 2.5 Flash sayısal budget destekler, Pro off reddeder. GPT-6 aktif reasoning'de desteklenmeyen sampling alanlarını kullanmaz, disabled için effort none uygular.

Hesap bazlı kontrol: sağlayıcıya özel `OPENAI_API_KEY` veya `PROVIDER_KEY_OPENAI` tanımlayıp `node scripts/check-catalog.js --provider openai` çalıştırın. Genel `LLM_API_KEY`/komut satırı anahtarı yalnız tek açık provider seçimiyle kullanılır; hiçbir anahtar tüm sağlayıcılara yayılmaz veya yazdırılmaz. Checker yalnız model-listesi GET yapar; eşleşme hesap bazlıdır, tüm parametre/region desteğinin kanıtı değildir. Bazı servislerde liste ucu yoktur. Yerel Ollama için `--allow-local-http`, kurulu model ve dummy anahtar gerekir. Atlanmış/anonim koşu canlı doğrulama sayılmaz.

## Kalıcı sohbet ve iş çıktısı takibi — 2026-10-28 uygulama planı

Amaç: Proje Asistanı sohbetlerini yenileme/yeniden başlatma sonrasında açabilmek; tamamlanmamış yanıtları, kaynak bağlamını ve üretilen işlerin uygulama etkisini açıkça ayırmak. Mevcut kod ve önceki görev değişiklikleri korunur; `.env.example` kullanıcıya aittir. Commit/push yok.

Mimari: `src/assistant/history.js` yönetici ve proje kökü kapsamlı, revizyon denetimli oturum API'si sağlar (`/assistant/sessions`, `/:id`). Varsayılan profil deposu aynı anahtarla ayrı şifreli dosyaya, atomik yazım ve dosya kilidiyle kaydeder; özel depolarda destek yoksa kalıcılık kullanılamadığı açıkça bildirilir, gizli bir tarayıcı deposuna geçilmez. Sohbet içeriği loglanmaz. Kayıtlar yetki vermez; geçmiş görevler yalnız hâlâ sunucudaki canlı görevle eşleşirse mevcut onay ekranında açılır. Sunucu yeniden başlarsa eski çıktılar okunabilir, otomatik uygulanamaz/geri alınamaz.

- [x] Depolama/API: `tests/assistant-history.test.js` ile önce yenileme, şifreli dosya, anahtar kaybı/bozuk dosya, yönetici/proje ayrımı, eşzamanlı revizyon, sınırlar ve özel depo davranışını başarısız doğrula; `src/assistant/history.js`, `src/store/assistantHistory.js`, `src/profileStore.js`, `src/core.js` uygula.
- [x] Arayüz: `public/assistant-history-ui.js` kayıtlı sohbet seçme/yeni/adlandırma/silme/dışa aktarma ve kayıt durumunu yönetir. `public/project-ui.js` tamamlanan/yarım/başarısız mesajları, sınırlı model bağlamını ve görev çıktılarını bu kayda bağlar; başarısız kayıtta tekrar ücretli istek öncesi durur. Önce `tests/assistant-history-ui.test.js` ve proje arayüz regresyonları, sonra kod.
- [x] İş yaşam döngüsü: plan/öneri dosyaya yazmaz; uygula/geri al/doğrulama/kayıt kapatma sonrası etkiler ve göreve ait çıktılar izlenir. Eksik canlı görev eski diff'i uygulanabilir göstermez. SQL migration ve çalışan servisler otomatik yürütülmez. Kayıt silme dosya değişikliklerini geri almaz. Kaynak revizyonu değişirse kullanıcı yeniden tarar; geçmiş cevap tarihsel kalır.
- [x] Tipleri ve Türkçe README/kullanıcı/teknik/entegrasyon/değişiklik belgelerini güncelle; hedefli testler, tam seri, lint/typecheck/format ve tarayıcıda kayıt-yenileme-devam/yerleşim akışını doğrula. Gerçek sağlayıcı veya aktif veri kullanma; sonuçları bu bölümde kaydet.

### Uygulama ve doğrulama sonucu — 2026-10-28

Şifreli oturum API'si, kayıtlı sohbet seçimi/devam, başlık, JSON dışa aktarma, revizyon kontrollü silme, kayıt durumu/yeniden deneme ve açık onaylı kaydedilmeyen taslak bırakma akışı eklendi. Mesajlar mod değişiminde görünür kalır; modele gönderilen sınırlı bağlam ayrı tutulur. Tamamlanmış eşleşen soru/yanıt çiftleri kullanılır; yarım/başarısız çiftler dışlanır. Kaynak sohbeti → plan/değişiklik devam bağlamı OpenCode'a tarihsel veri olarak aktarılır.

İş çıktıları son bilinen etki, dosya listesi, doğrulama sonucu ve işlem iziyle kaydedilir. Mutasyondan önce sonuç belirsiz niyet yazılır; yanıtla durum güncellenir. Kayıt hatası uygulanmış dosyaları öneri durumuna geri göstermez. Canlı görevi açma API'den denetlenir; sunucu kapanmışsa arşivden otomatik uygulama/geri alma yapılamaz. Çıktı özeti kalıcıdır; tam diff, geçici çalışma kopyası ve geri alma kaydı halen canlı sunucu oturumuna bağlıdır. Gerçek migration, servis yeniden başlatma veya dağıtım otomatik yürütülmez.

- Tam seri: `node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js` — **467 test: 466 geçti, 0 başarısız, 1 POSIX testi Windows'ta atlandı**. Sonradan genişletilen anahtar kaybı koruması (profil kaydetme üzerinden de yeni anahtar üretmeme), arşivlenmiş görev salt okunur regresyonu ve son Türkçe metinler dahil kabul seçkisi **77/77** geçti. Bu son küçük düzeltmelerden sonra tam seri tekrar çalıştırılmadı; kapsam ölçümü bu görevde çalıştırılmadı.
- Şifreli disk/yeniden manager açma, yönetici/proje ayrımı, iki manager eşzamanlı yazımı, eski revizyonla yazma/silme ret, bozuk depo ve anahtar kaybında kaydı/anahtarı koruma, CSRF/yönetici kontrolleri doğrulandı. Geçici kopyada çalışan kontrollü sahte OpenCode API motoruyla önceki plan/sohbet metninin yeni göreve aktarılması doğrulandı.
- Bağımsız incelemede bulunan gezinme/üretim yarışı, başarısız yanıt bağlam sızıntısı ve boyut sınırında çıkış kilidi regresyonlarla düzeltildi; tekrar incelemede ek P1/P2 bildirilmedi. Son kaynaklarda ESLint, TypeScript ve Prettier kontrolleri geçti; görev dosyalarında `git diff --check` temiz.
- İzole yerel tarayıcı: kontrollü SSE model cevabı kaydı, başlık kaydetme, sayfa yenileme, kayıt listesinden açma ve önceki mesajlarla devam; aynı arşivde kaynaklı cevabın kaynak/süre/token metninin saklanması doğrulandı. 390px mobilde yatay taşma yok ve sağ bilgi bloğu sohbetin altında. Görsel kanıt dış çalışma alanındaki `kalici-sohbet.png` / `kalici-sohbet-mobil.png`. Gerçek ücretli sağlayıcı, aktif `.env`/data veya gerçek DB kullanılmadı. Sahipli önizleme sunucuları ve sentetik geçici verileri kapanış uç noktasıyla temizlendi.
- README, kullanıcı/teknik/entegrasyon/değişiklik belgeleri ve `types/core.d.ts` güncellendi. Yeni zorunlu bağımlılık yok. Kullanıcı `.env.example` değişikliği ve önceki UI görevi dosyaları korunur; commit/push/yayın yapılmadı. Önceki Graphify çıktısı bu görevde yenilenmedi.

Sınırlar: başlangıç/pending ve sonuç ayrı kayıt yazılarıdır; tarayıcı çöküşünde son akış parçaları kaybolabilir. Arşiv, değiştirilemez audit günlüğü veya kaynak yazılarıyla ACID işlem değildir. Host özel deposunda history desteği yoksa sayfa belleği kullanımı açıkça bildirilir. Kayıt/model bağlamı boyutları kullanıcı ve teknik kılavuzda belirtilmiştir; JSON dışa aktarma şifresizdir.
## Sohbet çalışma alanı düzeni — 2026-10-28 uygulama planı

Kullanıcı sohbet sonrası başarı panelinin kaldırılmasını ve tanıdık yan sohbet listesi + merkez mesaj alanı düzenini istedi. Önceki görev değişiklikleri ve kullanıcı `.env.example` dosyası korunur. API/veri formatı değişmez; commit/push yok. Plan `writing-plans` yaklaşımıyla tek yol haritasında tutulur.

- [x] Önce arayüz testleri: sohbet cevabı için başarı bildirimi üretmeme, hata bildirimini koruma; listeden açma/silme, seçili satır, yeni sohbetin eskisini silmemesi ve gezinme kilidi. `tests/assistant-history-ui.test.js`, `tests/project-ui.test.js`, `tests/playground.test.js`.
- [x] `public/assistant-history-ui.js`: açılır seçici yerine satır düğmeleri ve her satırda açık onaylı silme; kararlı kayıt kimliği/revizyon, mevcut kaydı açma/yenileme/başlık/dışa aktarma/kurtarma korunur.
- [x] `public/llm.html`, `public/project-ui.js`: solda sohbet çerçevesi, merkezde başlık ve çalışma türü/profil araç çubuğu, bağımsız kayan mesajlar ve altta yazma alanı. Mesaj gövdesi/kimlik/durum ayrılır; ayrıntılar katlanır. Proje bilgileri yan panelden erişilir. Mobilde sohbet listesi düğmeyle açılır; kayıt ve görev onayları korunur. Sohbet ilerlemesi satır içi gösterilir, yanıt bitişinde yeşil panel üretilmez; hata ve önemli dosya işlemi bildirimleri kalır.
- [x] Türkçe belgeleri güncelle; hedefli arayüz ve koruma testleri, lint/typecheck/format, izole tarayıcıda masaüstü/mobil sohbet açma/silme/devam, kaydırma ve görünür sonuç kanıtını doğrula. Sonuçları buraya ekle.

### Sonuç ve doğrulama — 2026-10-28

Açılır sohbet seçicisi kaldırıldı. Solda isimli sohbet satırları ve her satırda onaylı silme, merkezde mesaj alanı, üstte çalışma türü/profil ve altta composer uygulanmıştır. Başlık, dışa aktarma, etkin kaydı silme ve kayıt kurtarma Sohbet menüsündedir. Proje bilgileri düğmeyle yan panel açar; geniş ekranda üçüncü sütun, dar ekranda kapanabilir paneldir. Mobil liste düğmeyle açılır ve dokunarak kapatılır. Mesaj ayrıntıları/bağlam katlanır; mevcut kalıcı kayıt, paylaşım izni, iş çıktıları, diff inceleme ve dosya/komut onayları korunur. API ve veri formatı değişmez.

Model/kaynak/plan/değişiklik composer sonuçları artık genel yeşil başarı paneli üretmez. Bekleme/iptal satır içinde, hatalar mevcut bildirimde gösterilir. Dosya/komut/tarama bildirimleri korunur. Enter gönderir, Shift+Enter yeni satır ekler; IME kompozisyonu gönderilmez. Akış alt sınırı takip eder, kullanıcı eski mesajları okurken kaydırma ve tamamlanma konumunu korur. Sohbet açma/silme/iptal/hata ve Escape sonrasında odak görünür denetime döner.

- Son kaynaklarla hedefli seçki **64/64** geçti: `tests/assistant-history-ui.test.js`, `tests/project-ui.test.js`, `tests/playground.test.js`, `tests/i18n.test.js`, `tests/ui-completion.test.js`, `tests/ui-enhancements.test.js`, `tests/assistant-history.test.js`, `tests/chat-client.test.js`, `tests/project-api.test.js`. Başarı bildirimi, hata, satır silme/revizyon, seçili sohbet, kayıt/devam, kilitler, klavye/IME, iptal, odak ve akış kaydırma regresyonları dahil. Bu UI görevinde tam seri/kapsam yeniden çalıştırılmadı; önceki kayıtlar tarihseldir.
- ESLint, TypeScript ve Prettier geçti; görev dosyalarında `git diff --check` temiz. Kullanıcı `.env.example` dosyasına dokunulmadı. README dışı kök Markdown dosyası eklenmedi; bağımlılık/API/tip değişikliği yok.
- İzole tarayıcı: Enter ile kontrollü SSE yanıtı, iki sohbet arasında geçiş, seçim işareti, yazma alanına odak, uzun akışın alt sınırda kalması ve yazma alanının görünür olması doğrulandı. Yanıt sonrasında notification hidden=true. Proje bilgileri açma/kapama; mobil liste açma/kapama ve sohbet seçimi; silme onayından vazgeçince iki kaydın korunması ve assistant-new odağı doğrulandı. 390px mobilde sayfa genişliği 390px, yazma alanı alt sınırı viewport içinde. Açık palet yalnız sahipli önizleme dönüşümüyle incelendi; sistem tercihi değiştirilmedi.
- Bağımsız incelemenin odak ve akış kaydırma bulguları test önce yaklaşımıyla düzeltildi. Son iptal/hata odağı için ayrıca RED/GREEN regresyon ve gerçek tarayıcı doğrulaması yapıldı.
- Görsel kanıt dış çalışma alanında `sohbet-cercevesi.png` ve `sohbet-cercevesi-mobil.png`. Kontrollü sahte sağlayıcı/sentetik kayıtlar kullanıldı; gerçek sağlayıcı, aktif veri veya sır kullanılmadı. Sahipli önizleme sunucuları kapatılıp geçici verileri temizlendi. Kullanıcı/teknik/değişiklik belgeleri güncellendi. Commit/push/yayın yapılmadı; Graphify çıktısı yenilenmedi.
## Graphify, belge bağlamı ve dikey sohbet — 2026-10-28

Amaç: Kurulum rehberi ve güvenilir host PATH keşfi; güncel Graphify ilişkilerini sohbet kaynak seçimine katma; README/kılavuz/metin belgelerine sınırlı bağlam payı; daha dikey sohbet. Mevcut değişiklikler korunur, commit/push yok.

- [x] `src/project/graphify.js`, `index.js`: açık yapılandırma öncelikli, mutlak host PATH dizinlerinden CLI keşfi; her taramada yeniden deneme, eski grafiği kullanmama. Gerçek Graphify yoksa açık durum, sessiz kurulum yok.
- [x] `files.js`, `context.js`: belgeler ve manifestler taramada öncelikli, soru ve ilişkili dosyalar bağlamda; bütçe/sır/ignore kontrolleri korunur. API kapsam bilgileri ve tipleri güncellenir.
- [x] `public/llm.html`, `project-ui.js`: repo/kurulum/kullanım rehberi, tarama kapsamı ve Graphify durumu; daha uzun sohbet ve daraltılmış okuma sütunu.
- [x] RED/GREEN testleri, API regresyonları, lint/typecheck/format, izole görsel kontrol ve Türkçe belgeler. Repomix/Cline/Aider alternatif, DBHub ertelenmiş; gereksiz zorunlu bağımlılık eklenmez.

### Graphify/belge bağlamı doğrulama — 2026-10-28

Yeni testlerde önce eksikler görüldü: belge önceliği, grafikle komşu kaynak seçimi ve host PATH keşfi için 3 RED; uygulama sonrası ilgili 20/20 test geçti. Proje seçkisi 67 test: 66 geçti, platforma özgü 1 atlandı. Son uyumluluk düzeltmesinden sonra API/OpenCode/analiz/Graphify/UI seçkisi 39/39 geçti. Bağımsız incelemenin açık komut ile legacy Python bağımsız değişkenleri uyumluluk bulgusu düzeltildi; eski Python varsayılanı korundu. Açık CLI için `graphify: { command: '/absolute/graphify', args: [] }` kullanılır.

Gerçek kurulu Graphify yalnız sentetik örnek proje üzerinde denendi: 7 öğe ve 7 ilişki; arayüzde algılandı durumu görüldü. Kontrollü sağlayıcıyla kaynaklı sohbet kaydı/yanıtı ve Graphify kullanım açıklaması doğrulandı. Masaüstü/dar görünüm ve 390px mobilde taşma denetlendi; mobil girdi görünür. Görseller dış çalışma alanında `graphify-dikey-sohbet.png`, `dikey-sohbet.png`, `dikey-sohbet-mobil.png`. Gerçek sırlar/aktif data kullanılmadı. Yeni paket kurulmadı ve bağımlılık eklenmedi. Graphify kurulu ve çalışır bulundu; diğer adaylar unutulmuş zorunlu bileşen sayılmaz.

ESLint, TypeScript ve Prettier tüm proje kontrolleri geçti. Son kaynaklarla tam test serisi: **470 test; 469 geçti, 0 başarısız, 1 platform testi atlandı** (`node --test tests/*.test.js`). Görev dosyalarında `git diff --check` temiz; kullanıcı `.env.example` korunur. Canlı sağlayıcı/deployment/DB davranışı bu doğrulamanın kapsamında değildir. Commit/push yapılmadı.


## Daha uzun sohbet ve solda kayıt işlemleri — 2026-10-28

Kullanıcı mesajlara daha fazla dikey alan, sohbet menüsü işlemlerinin solda toplanması ve Sohbet bağlamı ve kaynaklar panelinin kaldırılmasını istedi. Mevcut kullanıcı/önceki görev değişiklikleri korunur; commit/push yok. Planlama ve test odaklı geliştirme yaklaşımı uygulanır.

- [x] `public/llm.html`: merkez menü yerine sol listenin altında Seçili sohbet alanı; başlık/kayıt/dışa aktar/silme korunur, yinelenen yeni sohbet düğmesi kaldırılır. Masaüstünde en az 940px, mobilde en az 800px sohbet; mesaj alanına daha fazla pay, boş durumlar kompakt.
- [x] `public/project-ui.js`: kaldırılan bağlam panelinin DOM bağımlılıkları temizlenir; yanıt metrikleri ve kaynak referansları mesaj verisinde korunur. Model/kaynak sohbeti, iptal, yeni sohbet ve kayıt tekrar deneme testlerle denetlenir. Panelden bağımsız test önce RED/GREEN.
- [x] İlgili Türkçe belgeler, odaklı test seçkisi, lint/tip/biçim ve izole masaüstü/mobil tarayıcı doğrulaması. Gerçek sır veya aktif data kullanılmaz.


### Uzun sohbet görünümü sonucu ve doğrulama — 2026-10-28

Sohbet çerçevesi masaüstünde en az 940px, mobilde 800px yüksekliğe çıkarıldı; başlık ve boş karşılama alanları sıkılaştırıldı. Mesajlar kendi alanında kayar, kısa ekranda sayfa da aşağı kaydırılır. Ayrı merkez sohbet menüsü kaldırıldı. Başlık, JSON dışa aktarma, etkin kaydı silme ve kaydı yeniden deneme sol listenin altındaki Seçili sohbet alanına taşındı. Mobilde aynı alan Sohbetler düğmesiyle açılır. Yinelenen yeni sohbet düğmesi kaldırıldı; + Yeni sohbet korunur.

Sohbet bağlamı ve kaynaklar paneli DOM'dan kaldırıldı. Bağlam sayacı/kaynak listesi DOM bağımlılıkları temizlendi; süre/token metrikleri yerel durumdan mesaja kaydedilir. Kaynak referansları mesaj ayrıntılarında, gerçek kaynak seçimi/Graphify ve paylaşım izni mevcut akışta korunur. API/veri formatı değişmedi. Kullanıcı/teknik/değişiklik belgeleri güncellendi.

- Önce paneli kaldırılmış sayan sıkı DOM testinde 17/17 RED gözlendi; kaldırılan denetimlere erişimler temizlendikten sonra ilk seçki 24/24 GREEN. Son kaynaklarda arayüz/kayıt/taşıma/i18n seçkisi 57/57 geçti: project-ui, assistant-history-ui, playground, i18n, ui-completion, ui-enhancements, assistant-history, chat-client. Metriklerin önceki yanıttan iptal yanıtına sızmaması da gerçek iki turla doğrulandı.
- İzole sunucu, sentetik şifreleme anahtarı ve kontrollü sağlayıcıyla uzun SSE yanıtı, kaynaklı sohbet, soldan başlık kaydetme; yeni sohbet sonrası eskisinin korunması ve dört mesajın geri yüklenmesi doğrulandı. Kaldırılan panel/menü yok; kaynaklı yanıt kaydediliyor. Masaüstü çerçeve 940px, mesaj alanı yaklaşık 577–612px; 390px mobilde çerçeve 800px ve yatay taşma yok. Mobil kayıt işlemleri aynı çekmecede, seçimden sonra kapanma korunur.
- Görseller dış çalışma alanında uzun-sohbet-sol-islemler.png ve uzun-sohbet-mobil-islemler.png. Bu UI görevinde tam test serisi yeniden çalıştırılmadı; önceki 470-test sonucu tarihseldir. Kullanıcı değişiklikleri ve .env.example korunur; commit/push/yayın yok.

Son kaynaklarda ESLint, TypeScript ve tüm proje Prettier kontrolü geçti; görev diff kontrolü temiz. İzole önizleme kapatıldı ve kendisine ait sentetik geçici veriler temizlendi.


## Belge eşitleme ve commit — 2026-10-28

Kullanıcı mevcut Markdown belgelerinin güncellenmesini, docs/graphify-out üretim kaynağının açıklanmasını ve commit atılmasını istedi. Push/yayın/sürüm artırma yetkisi verilmedi. Önceki geliştirmeler ve bu belgeler aynı commit kapsamına alınır; başlangıçtaki kullanıcı .env.example değişikliği dışarıda korunur.

README, kullanıcı/teknik/entegrasyon, dağıtım, katkı, klasör, güvenlik ve tehdit modeli belgeleri güncel sohbet düzeni, şifreli geçmişin yedeklenmesi, kayıt API'si ve Graphify keşfiyle eşitlendi. Değişiklik günlüğünün son ekleri Yayımlanmamış bölümünde toplandı; kaldırılmış menü/düğme adları güncellendi.

Graphify üretim kökeni denetlendi: kaynak manifestindeki 173/173 SHA-256 özeti mevcut 29066dc HEAD kaynaklarıyla eşleşiyor; graphify-out çıktıları bu HEAD'de değişmemiş. Graphify 0.9.97, extract --code-only --max-workers 1 ve cluster-only --no-label kayıtları mevcut. Grafik JSON'unda 898 düğüm ve 2499 ilişki var. Grafik/HTML/analiz/rapor araç çıktısı, Türkçe README ve source-manifest yardımcı belgelerdir. Bu turda harita yeniden üretilmedi; README'ye tarihsel kapsam ve güncel kaynaklardan farkı açıkça eklendi. Araç raporu elle değiştirilmedi.

Commit öncesi tam test serisi, lint/tip/biçim ve belge bağlantıları doğrulanır; sonuç bu kayda eklenir. Commit mesajı caveman-commit biçiminde kısa Conventional Commits olur. Tamamlanma doğrulaması verification-before-completion yaklaşımıyla yapılır.


### Commit öncesi doğrulama — 2026-10-28

Son kaynaklarda `node --test tests/*.test.js tests/**/*.test.js` (npm test ile aynı seçki): **479 test; 478 geçti, 0 başarısız, 1 platform testi atlandı**. ESLint, TypeScript ve Prettier geçti. Elle düzenlenen README/docs belgelerindeki 63 yerel dosya bağlantısı denetlendi; eksik hedef yok. Markdown/HTML Prettier ignore listesinde olduğundan belge kontrolü ayrıca yerel bağlantı ve diff boşluk denetimiyle yapıldı; otomatik Graphify raporu yeniden biçimlendirilmedi. Graphify kaynak manifestindeki 173 hash eski HEAD ile eşleşir; grafik yeniden üretilmedi.

Commit kapsamı güncel sohbet, şifreli geçmiş, grafik/belge bağlamı ve bunları açıklayan belgelerden oluşur. Kullanıcı .env.example değişikliği stage dışında kaldı. Commit ayrıcalığı bu görevden alınmıştır; push, yayın ve sürüm artırma yapılmaz.
