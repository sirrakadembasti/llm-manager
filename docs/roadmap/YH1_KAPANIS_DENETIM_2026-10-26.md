# YH1 teknik mimari kapanış denetimi — 2026-10-26

Durum: **tamamlandı — 2026-10-27**. Başlangıç `51978fc`, doğrulanan ürün başı `7297204`, `codex/yh1-completion` dalı. Bu kayıt, 32 kartın her numaralı gereksiniminin mevcut kaynak ve kabul testleriyle yeniden karşılaştırılmasına dayanır. Son tam paket **386/386**, sıfır hata/atlama/iptal; görev, genel ve düzeltme incelemeleri onaylı. Zorunlu kartlarda açık iş kalmadı; çalıştırılmamış ortamların sınırları aşağıda korunur.

| İş | Kart | Yeni denetim bulgusu | Durum |
|---|---|---|---|
| 1 | A4 | Sınıflandırıcı dışındaki Türkçe hata regex'i; hata kodu davranış kabul kapsamı | Tamam: `f2c4b0a`, 13 hedefli / 286 tam test; spec/kalite incelemesi onaylı |
| 2 | B4 | Eski `.env` anahtarını varsayılan anahtar dosyasına güvenli taşıma | Tamam: `9f189f0`, 28 hedefli / 290 tam test; spec/kalite incelemesi onaylı |
| 3 | C3 | Web adaptöründe profil değiştirerek kişi bazlı kota aşılabiliyor | Tamam: `7078c1c`, Retry-After dahil 18 hedefli / 296 tam test; spec/kalite incelemesi onaylı |
| 4 | D1 | Akış tamamlanma/hata olayları ortak log sözleşmesini tamamlamıyor | Tamam: `ff711ec`, 33 hedefli / 309 tam test; spec/kalite incelemesi onaylı |
| 5 | D4 | Başarısız/iptal akışlarının kullanım kaydı ve görünen aylık sayaç kabulü | Tamam: `f10ef20`, 49 hedefli / 324 tam test; spec/kalite incelemesi onaylı |
| 6 | B3 | Korumasız profil okumasında bozuk depo hatası HTTP kodunu/kurtarma mesajını gizleyebiliyor | Tamam: `a836033`, 30 hedefli / 338 tam test; spec/kalite incelemesi onaylı |
| 7 | A2 | Sahipli sunucu süreçlerinde sinyal/kapanış yaşam döngüsü kabulü | Tamam: `873f94c`, 38 hedefli / 355 tam test; spec/kalite onaylı, bir küçük uyarı son incelemeye kayıtlı |
| 8 | F5 | Tedarik zinciri/planlanan önlemler ve sürüm destek bağlamı | Tamam: `9c3c12a`, 6 hedefli / 357 tam test; spec/kalite incelemesi onaylı |
| 9 | A1 | Kaldırılmış senkron kök export'ları için açık geçiş duyurusu | Tamam: `4cd807a`, 5 hedefli / 358 tam test; spec/kalite incelemesi onaylı |
| 10 | E2 | İngilizce README'nin güncel kritik kullanım bilgileriyle hizalanması | Tamam: `44024fa`, 6 hedefli / 361 tam test; spec/kalite incelemesi onaylı |

32 kartın genel incelemesi, görev incelemelerinden sonra beş ek ürün açığını doğruladı. Bunlar ilişkili kabul testleriyle `7297204` commitinde düzeltildi; dar kapsamlı yeniden inceleme tamamını kapattı. İsteğe bağlı framework iskelet E2E işi ve funding alanı zorunlu iş olarak sunulmaz.

| Genel inceleme | Kart | Doğrulanan açık / gereken kanıt | Durum |
|---|---|---|---|
| 1 | C9 | Varsayılan dosya deposu `allowedPrivateHosts` seçeneğini kayıtta kullanmıyor; izinli LAN profili 400 ile reddediliyor | Uygulandı: `profileStore.js`; gerçek kayıt/yeniden açma/yerel çağrı ve olumsuz hedef kabulü 4 testlik HTTP paketinde geçti |
| 2 | C4/A5 | OpenAI `reasoning_content` ve Google `thought:true` parçaları yanıt metnine karışıyor | Uygulandı: OpenAI/Google transport ayrıştırıcıları; karışık ve yalnız düşünce içeriği regresyonları geçti |
| 3 | A4/C4 | Başlık beklerken toplam bütçe zaman aşımı `LLM_ABORTED` olarak dönüyor; gövde okuma sınırı da hizalanmalı | Uygulandı: başlık/gövde tipli hata sınırı ve gerçek retry sinyali; aktif iptal/iterator temizliği 2/2 geçti |
| 4 | A4/C4 | `content_filter` / `SAFETY` akışları başarılı `done` ve OK kullanım kaydı üretiyor | Uygulandı: filtre/kesilme terminal sınıflandırması; HTTP hata ve tek kullanım/tamamlanma kaydı regresyonları geçti |
| 5 | C6/C4 | Akışta yapılandırılmış retry uygulanmıyor; terminal metadatada gerçek profil/fallback bilgisi yok | Uygulandı: ilk çıktıdan önce retry, ortak bütçe ve iterator/Web/Express gerçek profil bilgisi; 57 testlik hedefli pakette doğrulandı |
| Kabul kanıtı | C1 | Varsayılan sınırla gerçek 300 KB gövde → 413; okumadan önce Content-Length ve sınır aşımında iptal kabulü | Eklendi: `final-http-acceptance.test.js`, 4/4 paket geçti |

Bu bulgular mevcut kaynak üzerinden izlendi ve sağlayıcı ağına çıkmayan hedefli problarla doğrulandı. Önceki yeşil test sayısı eksik vakaların kanıtı sayılmadı; kapanış, düzeltmelerden sonraki tam paket ve dar kapsamlı incelemeye dayanır. Küçük bulgu: sıradan plugin testlerindeki eski `manager` amaçları kanonik amaçla değiştirildi; özel geriye uyum/uyarı testi korundu. Pozitif proxy CONNECT tüneli çalıştırılmış değildir; C8 kartında zorunlu kabul olarak istenmez ve bu sınır açıkça korunur.

## Genel inceleme kapanışı

Bağımsız genel inceleme `51978fc..44024fa` aralığında 32 kartın tamamını kaynak/testlerle karşılaştırdı. Tek toplu düzeltme görevinin ardından bağımsız dar kapsamlı inceleme `44024fa..7297204` aralığını denetledi. Beş önemli bulgu, C1 kabul kanıtı ve küçük fixture bulgusu **ADDRESSED**; düzeltme farkında yeni kritik/önemli/küçük hata, açık veya ertelenmiş zorunlu bulgu yok.

İnceleme, gerçek npm çağrılarını ve temizlik hatası korumasını, değişmeyen TypeScript/Python/CommonJS/lifecycle sınırlarını ve normal .NET yanıt beklemesiyle gerçek iptal beklemesinin ayrılmasını da kapsadı. Tam test/kapsam kanıtını kaynak ve iddialarla karşılaştırdı; aynı paketi tekrar çalıştırmadı. Kapanışta genel API/README/tip uyumu, sır/içerik sınırları, Unreleased notları ve her görev için GEMINI kaydı ayrıca kontrol edildi. Son belge commiti ürün/test dosyalarını değiştirmez; yayın/push yapılmaz.

## Güncel doğrulama — 2026-10-27, ürün başı `7297204`

| Kontrol | Sonuç |
|---|---|
| Tam seri test ve kaynak kapsamı | 386/386; hata/atlama/iptal 0; 215157 ms |
| Kaynak kapsamı | %94,78 satır / %87,70 dal / %93,02 fonksiyon; zorunlu %80/%70 eşikleri geçti |
| Beş temel modülün satır kapsamı | auth %100; core %93,89; profileStore %91,64; providerTransport %94,33; runtime %99,16; her biri ≥ %85 |
| ESLint / TypeScript / Prettier | Üçü de exit 0; yerel kurulu araçların Node giriş noktaları çalıştırıldı |
| Yol haritası doğrulaması | Beklenen 404 / liste / 409 / 201 / 500 |
| Gerçek npm kurulum ve paket kabulü | Tam pakette geçti; scoped core importu, CLI sürümü/bağlantısı, dahil/dışlanmış dosyalar doğrulandı |
| Paket kuru koşusu | 89 dosya; test/veri/gerçek `.env` ve özel çalışma dosyaları yok |
| Üretim bağımlılık audit'i | exit 0; bilinen açık 0 |
| Kaynak ve test sabitliği | 144 dosyanın SHA-256 özeti tam koşu öncesi/sonrası aynı |

Tam komut: `node --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include=src/** --test-coverage-lines=80 --test-coverage-branches=70 tests/*.test.js tests/**/*.test.js`. Bu, npm test betiğinin aynı iki dosya kümesini seri ve kapsam eşikleriyle çalıştırır; seçenekler dosya yollarından öncedir. Kalite komutları: `node node_modules/eslint/bin/eslint.js .`, `node node_modules/typescript/bin/tsc -p types/tsconfig.json --noEmit`, `node node_modules/prettier/bin/prettier.cjs --check .`. Windows alt kabuğundaki komut çözümleme sorunu nedeniyle kontroller atlanmadı; gerçek yerel araçlar doğrudan çalıştırıldı.

Sır/içerik denetimi: `src/logger.js` derin nesnelerde kimlik bilgisi ve içerik alanlarını maskeler; `usageLogger.js` yalnız izinli kimlik/model/süre/sayısal token/kod metadatasını yazar. Akış terminal kullanım verisi `safeUsage` ile sayısal alanlara indirgenir. `observability`, `chat-completion-lifecycle`, `usage-lifecycle`, `auth-policy`, init güvenlik ve son akış regresyonları tam pakette geçti; özel test anahtarı/mesaj içeriğinin loglara veya genel yanıtlara taşınmadığına ilişkin açık olumsuz iddialar korunur. Yeni transport düzeltmeleri düşünce parçalarını yanıt metninden çıkarır. Tanı çıktıları kontrollü fixture aşamalarına aittir; lifecycle testleri fixture parolasını maskeler. Gerçek sağlayıcı anahtarı bu turda kullanılmadı; `logContent` içerik açan bir seçeneğe dönüştürülmedi.

## Tanı ve doğrulama geçmişi (kapanış öncesi)

`44024fa` üzerindeki önceki doğrulama: 361/361 test, hata/atlama/iptal yok; src %94,26 satır / %87,36 dal. Lint/typecheck/format ve yol haritası doğrulama betiği geçti. `npm pack --dry-run --json`: 89 dosya, test/veri/gerçek `.env` yok; üretim audit: 0 açık. Bu ölçümler genel inceleme düzeltmelerinden öncedir; güncel sonuçlar üstteki tabloda yer alır.

Genel inceleme düzeltmeleri uygulandı. Düzeltme öncesi 14 hedefli testin 11'i beklenen hataları yakaladı. Düzeltme sonrası gerçek HTTP erişimiyle `final-stream-regressions`, `chat-completion-lifecycle`, `usage-lifecycle` ve `plugin` paketi 57/57; `final-http-acceptance` paketi 4/4 geçti (hata/atlama/iptal yok). LAN testi izinli profili gerçek geçici depoya kaydedip yeniden açar ve yerel sağlayıcıyı çağırır; listelenmeyen host/port reddedilir. C1 testi gerçek 300 KiB gövdeyi, okumadan Content-Length reddini ve uzunluğu belirtilmeyen akışın sınırda iptalini ölçer. Türkçe/İngilizce README yeni akış terminal metadatası ve retry sınırlarıyla hizalandı.

2026-10-27 ek doğrulama: İlk tam kapsam çalıştırması, aktif sağlayıcıya retry yardımcısının iptal sinyalinin aktarılmadığını ortaya çıkardı; bilinen hatalı paket 196 test gözleminden sonra durduruldu ve başarılı tam paket sayılmadı. Sinyal aktarımı düzeltildi: güçlendirilmiş regresyon önce aktif istek iptali için başarısız oldu (2 testten 1'i), ardından aktif iptal ve bitmiş iterator temizliği 2/2 geçti. Aynı çalıştırmadaki C# hataları ayrıca incelendi: doğrudan SDK listesi 24,1 saniyede, eski derleyici yardım komutu 36,8 saniyede başarıyla döndü; SDK yokluğu iddiası doğrulanmadı. Bağımsız C# paketi 11/12, sıfır atlama verdi; modern istemci derleme/HTTP/iptal ve hatalı kaynak algılama geçti. Kalan eski .NET hatasının iptal istenmeyen normal `content` çağrısına uygulanan 5 saniyelik test bekleyicisinden geldiği tanı kayıtlarıyla belirlendi.

Eski .NET testi normal çağrıları 20 saniyeyle sınırlar; gerçek iptal/başlık/gövde kontrolleri 5 saniye, dış derleme ve yürütme sınırları 30 saniye olarak korunur. Üretim şablonu değişmedi. Son hedefli eski .NET paketi **8/8**, hata/atlama/iptal yok: dört hedef varyantı gerçek .NET 4.0 referanslarıyla derlendi, HTTP ve iptal davranışları doğrulandı. Normal ilk yanıtlar 1693/181/210/611 ms; başlık/gövde iptalleri 508–562 ms sürdü ve sunucu bağlantı kapanışları gözlendi. Bu başarılı çalışma normal çağrının 20 saniyeye ihtiyaç duyduğunu kanıtlamaz; testte normal yanıt ile iptal sözleşmesi ayrılmıştır. Son tam test/kapsam ve dar kapsamlı yeniden inceleme geçmeden kapanış yapılmaz.

Yeni tam paket tamamlandı: **386 test, 380 geçen, 6 başarısız, sıfır atlama/iptal**; 3626290 ms. Kaynak kapsamı %94,84 satır / %88,09 dal / %93,02 fonksiyon; beş temel dosyanın satır kapsamı auth %100, core %94,21, profileStore %91,64, providerTransport %94,33, runtime %99,16. Kapsam eşikleri aşıldı; altı başarısız test nedeniyle kapanış yapılmadı.

Bu pakette eski .NET bölümü geçti. Altı hata: G17 TypeScript derlemesinde 30,5 saniye sonra boş hata; Python kabul istemcisinde 10 saniyelik test bekleyicisi; iki CommonJS alt süreç kontrolünde 30 saniyelik `ETIMEDOUT`; yerel npm kurulum kontrolünde birincil hatayı örten geçici klasör `EBUSY` temizleme hatası; sinyal gönderilmeden önce CLI init hazır olma kontrolünde alt süreç çıkışı. G17 hata yakalayıcısının boş `stdout` tamponunu gerçek hata mesajından önce seçtiği doğrulandı. Aşama/hata/süre tanıları güçlendiriliyor; süre sınırları ve üretim davranışı değiştirilmedi. Doğrudan Node/Python başlatma ölçümleri bu aşamada 195/105 ms olduğu için hatalar genel ortam yavaşlığına bağlanmadı. Başarısız dosyaların hedefli tanısı ve ardından yeni tam doğrulama gereklidir.

Tanı bilgileri eklenen beş dosyanın seri hedefli çalıştırması 36 testten 35'ini geçirdi: TypeScript derlemeleri 4102/435 ms, Python'un yedi gerçek HTTP vakası 1308 ms; CommonJS ve sinyal yaşam döngüsü kontrolleri geçti. Önceki zaman aşımının kalıcı bir ürün hatasından kaynaklandığı kanıtlanmadı; bu kontrollerin süre sınırları değiştirilmedi. Kalan npm hatası, Windows kabuğunun mevcut `npm.cmd` dosyasını adıyla çözememesiydi. Aynı Node kurulumu altındaki gerçek `npm-cli.js` doğrudan çalıştırıldığında npm 10.9.8 döndü; testin Windows kolu bu gerçek CLI'yi kabuksuz kullanacak şekilde düzeltildi. Son yerel kurulum paketi 2/2 geçti: çevrimdışı gerçek kurulum, scoped core importu, sürüm ve komut bağlantısı doğrulandı. Birincil işlem ve temizlik hataları artık birbirini örtmeden korunur; lint ihlalleri de giderildi.

Son bağımsız kontroller: yerel ESLint, TypeScript ve Prettier giriş noktaları Node ile çalıştırılarak geçti. npm betiklerinin Windows kabuğunda komut bulamaması kod/biçim hatası sayılmadı ve denetimler atlanmadı. Yol haritası doğrulama betiği beklenen 404/liste/409/201/500 sonuçlarını verdi. Paket kuru koşusu 89 dosya, yasak içerik 0; üretim bağımlılık denetimi bilinen açık 0.

Sonraki tam koşu 386 testten 385'ini geçirdi; atlama/iptal yok, süre 243701 ms, kapsam %94,88 satır / %88,27 dal. Önceki altı başarısızlık kategorisinin tümü geçti; gerçek npm kurulumu 6225 ms sürdü. Tek hata paket içeriği testinin `execSync('npm pack ...')` çağrısında aynı Windows kabuk komut çözümlemesiydi; paket içerik iddiaları çalıştırılamadı. Bu test de gerçek npm CLI'yi doğrudan çağıracak şekilde hizalanıyor. Yeni tam koşu ve dar kapsamlı inceleme geçmeden kapanış yapılmayacak.

Kapsam kararları: Doğrudan `handle()` güvenilir host API'sidir; principal verilmemesinin eski host davranışı korunur. HTTP adaptörleri principal/yetki sınırını uygular; kota düzeltmesi bu sınırı gevşetmez. B1'in senkron ara adımı B2'nin async deposuyla tamamlanmıştır. B3, HTTP 500 yanında anlamlı `STORE_CORRUPT` kodu ve kurtarma mesajı üretir. İçerik loglama açılmayacak; mevcut redaction korunacaktır.

İlk bağımsız kontroller: `npm pack --dry-run --json` 88 dosya, test/veri/gerçek `.env` yok. Ağ izinli `npm audit --omit=dev --json` exit 0, sıfır güvenlik açığı. Docker Desktop başlatma komutu kabul edildi ancak motor `Docker Desktop is unable to start` yanıtı verdi; gerçek imaj build/run henüz doğrulanmadı. Bu durum dosya sözleşmesi testiyle karıştırılmaz.

Yukarıdaki on yerel görev commiti kullanıcı yetkisiyle oluşturuldu. Yayın, push, sürüm artırma veya işletim sistemi/WSL yeniden yapılandırması yapılmadı.

## Doğrulama sınırları

- Dockerfile, `.dockerignore` ve dağıtım bağlantıları kaynak/sözleşme testleriyle denetlendi. Docker motoru başlatılamadığı için gerçek imaj build/run sonucu yok; D3 kartı bu dosyaları gerektirir.
- Windows'taki sinyal kabulü gerçek alt süreç/HTTP ve IPC üzerinden sinyal callback'leriyle yapıldı; 10 saniyelik kapanış sınırı kontrollü saatle de ölçüldü. Native konsol/POSIX sinyal teslimi ve uzak OS × Node CI matrisi yerelde çalıştırılmadı.
- Eski C# yardımcıları gerçek .NET 4.0 referanslarıyla derlendi, kurulu CLR 4.8.1 üzerinde çalıştırıldı. Bu, özgün .NET 4.0 çalışma zamanı veya kurulu net48 targeting pack kanıtı değildir. Modern SDK derlemesi ve gerçek HTTP/iptal kontrolleri ayrıca çalıştırıldı.
- Sağlayıcı protokolleri yerel HTTP/SSE sunucuları ve kontrollü yanıtlarla doğrulandı; ücretli/kimlik bilgili canlı sağlayıcı çağrısı, pozitif proxy CONNECT tüneli veya isteğe bağlı uzak framework iskelet derlemesi yapılmadı. Katalog kaynaklarının 2026-10-24 tarihi canlı hesap erişilebilirliği anlamına gelmez.
- Mevcut `undici` bağımlılığı korundu; bu tamamlama turunda `package.json` ve kilit dosyası değişmedi. İsteğe bağlı framework-generator E2E/funding işleri zorunlu kapsama eklenmedi.

## Otuz iki kartın kaynak ve test eşlemesi

Bu tablo genel incelemenin kaynak/kabul eşlemesini ve son düzeltmeleri gösterir. Test yolları `tests/` altındadır; adı verilen dosyalar son 386/386 koşusuna dahildir. Çalıştırılmamış ortamlar yukarıda ayrıca belirtilmiştir.

| Kart | Kaynak / kabul kanıtı | Denetim sonucu / kapsam |
|---|---|---|
| A1 | `src/index.js`, `src/init/index.js`, paket exports; `architecture`, `package-metadata` | Senkron kök export geçiş duyurusu |
| A2 | `src/server.js`, CLI, `init/probe.js`; `architecture`, `server-options`, `init-package` | Sinyal/kapanış sahipliği ve süreç kabulü |
| A3 | `types/*.d.ts`, `types/test.ts`, CI typecheck sırası | Son derleyici doğrulaması |
| A4 | `errors.js`, `runtime.js`, `core.js`; `errors`, `runtime-diagnostics` | Merkezi sınıflandırma ve eksik hata dalları |
| A5 | Üç `transports` stratejisi; `transports`, `thinking`, `streaming` | Mevcut davranışı koruma |
| A6 | `src/init/` modülleri ve eski re-export köprüsü; init testleri | Kaynak ölçümünde en büyük modül 239 satır |
| B1 | Async stat/veri/anahtar cache; `store-cache` | 1000 okuma ve clone izolasyonu korunur |
| B2 | FIFO ve wx süreç kilidi; `store-concurrency`, `store-async`, `lock-access-retry` | 100 profil / deadline / Windows retry korunur |
| B3 | Şema migration, yedek, bozuk veri; `store-concurrency`, `store-async` | HTTP ve UI kurtarma mesajı kabulü |
| B4 | Anahtar önceliği, rotate/export/import; `key-management`, `store-async` | Eski `.env` kaynağını dosyaya taşıma |
| C1 | Mesaj/gövde limitleri; `runtime-controls`, `express-body-parser`, Express 5 kabul testi | Varsayılan 300 KB, Content-Length ve akış iptali kabulü eklendi; HTTP paketi 4/4 |
| C2 | HTTP principal/override sınırı; `auth-policy`, `runtime-controls` | Güvenilir doğrudan handle uyumu korunur |
| C3 | `rateLimit.js`, adaptör kimlikleri; `runtime-controls`, `auth-policy` | Web kişi bazlı anahtar seçimi |
| C4 | SSE transport/runtime/adaptörler; `streaming`, `stream-cleanup`, `final-stream-regressions` | İçerik ayrımı, filtre/timeout, retry ve aktif sinyal aktarımı son tam pakette geçti |
| C5 | Profil/çağrı parametreleri ve raw sonuç; `production-params`, `ui-completion` | API ve parametre eşlemeleri korunur |
| C6 | Retry-After, toplam bütçe, fallback; `retry-fallback`, `runtime-diagnostics`, `final-stream-regressions` | Akış retry ve gerçek profil metadatası uygulandı; ortak bütçe/aktif iptal regresyonu 2/2 |
| C7 | Model-aware thinking eşlemeleri; `thinking`, MiMo görünürlük UI testi | Güncel model kısıtları korunur |
| C8 | ProxyAgent ve hedef izin listesi; `network-proxy-lan` | Proxy DNS sorumluluğu belgeli |
| C9 | Açık özel host listesi/Ollama; `network-proxy-lan`, `final-http-acceptance` | Dosya deposuna izin listesi aktarımı ve gerçek yerel çağrı kabulü uygulandı |
| C10 | Donmuş JSON katalog, tarih, admin preview/checker; `catalog-preview`, `catalog-docs` | 2026-10-24 resmî kaynak kaydı korunur |
| D1 | Request ID/redaction/olaylar; `observability`, `server-options` | Akış yaşam döngüsü log sözleşmesi |
| D2 | Sırsız public health ve kapatma; `health`, `auth-policy` | Ürün davranışı mevcut |
| D3 | Dockerfile/.dockerignore/DEPLOY; `docker.test.js` | Dosya sözleşmesi mevcut; gerçek motor doğrulanamadı |
| D4 | Async JSONL ve admin aylık özet/UI; `usage`, `ui-completion` | Akış hatası/iptali ve görünen sayaç kabulü |
| E1 | Gerçek UI betiği/playground; `playground`, `streaming` | TextContent ve akış gösterimi korunur |
| E2 | tr/en sözlük, locale, messages, README.en; `i18n`, `ui-completion` | Kritik İngilizce kullanım bilgileri hizalanır |
| E3 | homeUrl, klon, modal, aria, katalog tarihi; `ui-enhancements`, `ui-completion` | Mevcut davranış ve erişilebilirlik korunur |
| F1 | ESLint/Prettier/EditorConfig/LF; üç OS × Node 22/24 CI | Yerel kalite kontrolleri; uzak CI ayrı |
| F2 | Gerçek Express 4 ESM/CJS, Express 5, Node Request köprüsü ve üç SSE mock transport | İsteğe bağlı framework E2E zorunlu sayılmaz |
| F3 | src kapsam script'i, %80 satır / %70 dal eşikleri | Beş temel modülde %85 satır hedefi ayrıca raporlanır |
| F4 | Scoped paket, Node >=22.12, metadata ve pack kontrolü | Güncel pack 89 dosya, yasak içerik yok; gerçek kurulum/CLI kabulü geçti |
| F5 | SECURITY/CONTRIBUTING/THREAT_MODEL ve CI audit; `security-docs` | Tedarik zinciri, planlanan kontroller, sürüm tablosu |
