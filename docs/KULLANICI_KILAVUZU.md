# LLM Manager kullanıcı kılavuzu

Sağlayıcı, model ve API anahtarlarını yönetin; modelleri deneyin, bağlı projenizi inceleyin ve onayladığınız değişiklikleri uygulayın. Bu belge kullanım, entegrasyon, işletim ve geliştirme bilgilerinin tek kaynağıdır. Son düzenleme: **2026-11-08**.

**Gereksinimler:** Node.js **22.12+**. Paket `@sirrakadembasti/llm-manager`, CLI `llm-manager`; npm'deki çıplak `llm-manager` başka projedir. Yerel **2.0.0 yayımlanmamış** geliştirme sürümüdür. Arayüz yalnız Türkçedir. Docker ve veritabanı zorunlu değildir. Express adaptörü/CLI için Express **4.19.2+ veya 5.x** gerekir; `/core` Express gerektirmez.

[Başlatma](#başlatma) · [Arayüz](#arayüz-ve-sohbet) · [Proje Asistanı](#proje-asistanı) · [Entegrasyon](#entegrasyon) · [API](#api-ve-sınırlar) · [Güvenlik](#güvenlik) · [Yedekleme](#yedekleme-ve-sorun-giderme) · [Dağıtım](#dağıtım-ve-ayarlar) · [Geliştirme](#geliştirme-ve-mimari) · [Geçmiş ve belge özetleri](#geçmiş-ve-belge-özetleri)

## Başlatma

Depo klasöründe PowerShell açın:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Mevcut ayarları koruyarak `.env` içine yazın:

```dotenv
LLM_ADMIN_USER=admin
LLM_ADMIN_PASSWORD=kendi-guclu-parolaniz
```

`npm start` çalıştırın; [http://127.0.0.1:8010/llm](http://127.0.0.1:8010/llm) adresine bu bilgilerle girin. Durdurma: **Ctrl+C**. Linux/macOS'ta da mevcut `.env` üzerine yazmadan aynı ayarları ve npm komutlarını kullanın.

CLI ve `npm start` çalışma dizininin `.env` dosyasını okur; mevcut süreç ortamı önceliklidir. PowerShell'de eski oturum ayarlarını kaldırmak için `Remove-Item Env:LLM_ADMIN_USER, Env:LLM_ADMIN_PASSWORD -ErrorAction SilentlyContinue` kullanılabilir. Düşük seviyeli API'yi elle bağlayan uygulama `.env` yüklemesini kendisi yapar; Express entegrasyon helper'ı kendi hedef klasöründeki `.env` dosyasını okur. Dosya/ayar değişince sunucuyu yeniden başlatın; eski arayüz görünüyorsa **Ctrl+F5** kullanın.

## Arayüz ve sohbet

**LLM Yönetimi** ilk sekmedir. Profil adı, sağlayıcı, model, API anahtarı ve gerekiyorsa özel adresi girin; kaydedin, bağlantıyı test edin ve profili etkinleştirin. Aynı anda bir profil etkindir. **Modelleri getir** hesabınızın erişimini sorgular; profil klonlanabilir. Düzenlemede boş API anahtarı kayıtlı değeri korur; sağlayıcı/adres değişiminde yeni anahtar gerekir. Kimlik/adres/model/anahtar değişikliği eski test sonucunu sıfırlar.

Zaman sınırı, çıktı tokenı, düşünme ve gelişmiş üretim ayarları profil bazındadır; destek modele bağlıdır. Yedek profiller hata durumunda sırayla denenir. Test sonucu profil kartında, hata kodu ve destek kimliği bildirimde görünür. Açık/koyu tema sistem tercihini izler. `locale` eski JavaScript kodunda yok sayılır; `homeUrl` uyumluluk için kabul edilir ancak arayüzde dönüş bağlantısı oluşturmaz.

Sağlayıcı kataloğu ve varsayılan model listeleri (katalog tarihi: 2026-10; güncel liste için **Modelleri getir** kullanın) [providers.json](../src/catalog/providers.json) içindedir; tam kaynak tarihi **2026-10-24**. Öneriler hesap/bölge/üretim erişim garantisi değildir. Boş öneri listesinde model kimliği elle girilebilir. `node scripts/check-catalog.js --provider openai` ilgili sağlayıcının anahtarıyla yalnız model listesi GET kontrolü yapar; üretim veya bütün parametreler doğrulanmış sayılmaz.

**Proje Asistanı** sekmesindeki **Çalışma türü**:

| Tür | Kullanımı |
| --- | --- |
| Model denemesi | Proje gerektirmez. Kayıtlı profil seçilir; sistem talimatı ve SSE/JSON akışı **Yanıt ayarları** altındadır. Kaynak gönderilmez. |
| Kaynaklı sohbet | Etkin profil ve seçilmiş proje parçaları kullanılır; kaynak paylaşım onayı gerekir. Yanıt tamamlanınca gösterilir. |
| Geliştirme planı | OpenCode temiz kopyayı okur; hedef dosyalara yazmaz. |
| Değişiklik hazırla | OpenCode geçici kopyada fark hazırlar; hedefe uygulama ayrıca onaylanır. |

Solda **Sohbetler**, altında **Seçili sohbet** kayıt işlemleri; ortada mesajlar, altta yazma alanı vardır. **Proje bilgileri** sağ paneli açar. Mobilde sohbet listesi **Sohbetler** düğmesiyle açılır. **Enter** gönderir, **Shift+Enter** satır ekler; **Durdur** isteği iptal eder. Süre/token/kaynaklar **Yanıt ayrıntıları** içindedir. Kısa ekranlarda sayfa da kaydırılır; mesaj alanı bağımsız kayar.

### Kayıtlı sohbetler

**+ Yeni sohbet** eski kaydı silmez. Listeden konuşmayı açıp devam edin; × ile onaylayarak silin. **Seçili sohbet** alanından adlandırın, JSON dışa aktarın veya **Kaydı tekrar dene** kullanın. **Kaydedildi** durumunu kontrol edin. Yeniden kayıt modeli tekrar çağırmaz; silme uygulanmış proje dosyalarını geri almaz.

Varsayılan geçmiş `<profil-dosyası>.assistant.enc` dosyasında aynı profil anahtarıyla şifrelidir. Aynı yönetici/proje kökü aynı arşivi paylaşır; kök değişirse kapsam değişir. Özel depo geçmiş desteği sağlamazsa sayfa belleği kullanıldığı açıkça bildirilir. JSON dışa aktarımı **şifresizdir**. Kayıt/bağlantı hatasında ekrandaki metin korunur; gerekirse dışa aktarın. Başka sekmenin güncel revizyonu sessizce ezilmez.

| Kayıt sınırı | Değer |
| --- | --- |
| Yönetici/proje başına sohbet | 50; otomatik silinmez |
| Sohbet başına | 100 mesaj, 20 iş çıktısı, 220000 UTF-8 bayt |
| Arşivlenen yanıt | En fazla 32000 karakter |
| Sonraki model bağlamı | Aynı bağlamın son 10 tamamlanmış mesajı; mesaj başına 10000 karakter |
| Toplam geçmiş dosyası | Şifreleme öncesi 40 MiB; diskten okuma 64 MiB |

Profil/model/sistem talimatı değişince model bağlamı yenilenir; kayıtlı mesajlar silinmez. Model ve proje bağlamları ayrıdır. Kaynaklı sohbetten plan/değişikliğe tamamlanmış proje bağlamı aktarılabilir. Başarısız, yarım veya durdurulmuş yanıtlar model bağlamına girmez. Sayfa kapanırken son akış parçaları kaybolabilir; pending kayıt otomatik yeniden gönderilmez.

## Proje Asistanı

Kaynak kökünü sunucuda `LLM_PROJECT_ROOT` veya `project.root` ile açıkça belirtin; CLI karşılığı `--project-root`. `project: false` ortamla etkinleştirmeyi de kapatır. Tarayıcı kök/motor/komut seçemez.

Express entegrasyonu hedef `.env` dosyasındaki `LLM_PROJECT_ROOT` değerini de okur; göreli yol helper'ın bulunduğu `cwd` klasörüne göredir. Örneğin helper `backend/llm.js` ise `LLM_PROJECT_ROOT=..`, frontend ve belgeler dahil uygulama kökünü bağlar. Açık `project.root` ayarı önceliklidir. Kurulum sihirbazı `.env` dosyasında `LLM_PROJECT_ROOT` yoksa helper klasörüne göre göreli kökü yazar: helper'ı içeren git deposunun kökü (`.git` klasörü ya da worktree'lerdeki `.git` dosyası), depo yoksa helper klasörünün kendisi. Örneğin `backend/llm.js` için `..`, uygulama kökündeki Next.js veya Express hostu için `.` yazılır. Mevcut değer, boş bırakılmış olsa bile ezilmez; boş değer Proje Asistanı'nı kapalı tutar. Kurulum geri alındığında satır da kaldırılır. Çekirdek bu değeri süreç ortamından okur ve göreli yolu çalışma dizinine göre çözer; Next.js gibi `.env` dosyasını kendisi yükleyen hostlarda `.` uygulama kökünü bağlar. `.next/standalone` sunucusu çalışma dizinini build klasörüne taşıdığından o kurulumda mutlak yol verin. pdf-to-onlinequiz saha testinde bu değer eksik olduğu için hedefin `/llm` panelinde Proje Asistanı kapalıydı; sihirbaz artık değeri kendisi yazar. Sihirbaz çıktısı yazılan kökü gösterir; `.env` içindeki `LLM_PROJECT_ROOT` sihirbazın yeniden çalıştırılmasını engellemez (yalnız açık `--project-root` bayrağı init'te reddedilir). Kök bağlanmadığında tarama düğmesi pasiftir ve genel bakış oluşmaz; bağladıktan sonra sunucuyu yeniden başlatıp **Projeyi tara** seçin. Tarama LLM isteği göndermez; kaynak paylaşımı ayrıca onaylanır.

**İsteğe bağlı Graphify:** Hedef uygulamada kod ilişkilerini daha ayrıntılı çıkarmak için **Proje bilgileri → Graphify ile ilişki analizi** seçeneğini işaretleyip **Projeyi tara** düğmesine basın. Varsayılan temel tarama Graphify çalıştırmaz. Güncel harita kaynaklı sohbette ve geliştirme görevlerinde ilgili dosya seçiminde kullanılır; kaynak değişince eski harita kullanılmaz. Araç yoksa veya hata verirse temel analiz kullanılabilir. Graphify'ın paket adı ya da taranmamış dosyaya işaret eden düğümleri haritayı geçersiz kılmaz; bu düğümler atlanır ve `skippedNodes` sayısı tutulur. Mutlak veya `..` ile kök dışına çıkan referans içeren harita yine reddedilir.

**Kaynaklı sohbetin yöntemi:** Aynı kutu her yeni sohbet ve geliştirme görevi için `basic` veya `graphify` seçer. Kapalıyken bellekte hazır harita bulunsa da temel seçim yapılır. **Yanıt ayrıntıları**, istenen/kullanılan yöntemi, geçiş nedenini, kaynak/harita revizyonlarını, temel seçimle aynı toplam bütçede eklenen dosyaları ve en fazla 20 kaynak satırlı ilişkiyi gösterir. Bir ilişki iki uçtaki dosya/satır, tür ve Graphify güven bilgisi taşır; iki kaynak satırından sınırlı parçalar da modele aktarılır. Genel tanıtımda kapsanan kod dosyaları, diğer sorularda eşleşen düğümler ve komşuları seçilir. Haritanın tamamı modele gönderilmez; statik ilişki işaretleri gerçek çağrının çalıştığına dair garanti değildir. Harita yoksa/eskiyse/kapalıysa temel analize geçiş belirtilir; istemcinin kaynak revizyonu değişmişse `PROJECT_CONFLICT` ile yeniden tarama gerekir. İz mesajla birlikte şifreli geçmişte saklanır; eski kayıtlarda bilinmiyor görünür. Yöntem değişince önceki mesajlar silinmez; temiz karşılaştırma için ayrı yeni sohbetler açın.

`POST /project/chat` ve `POST /project/tasks` gövdelerinde isteğe bağlı `retrievalMode: 'basic' | 'graphify'` kabul edilir; başka değerler reddedilir. Alanı göndermeyen eski istemcilerde son taramanın seçimi, ilk taramadan önce `basic` kullanılır. `retrieval`, `requestedMode`, `effectiveMode`, `reason`, `sourceRevision`, `graphRevision`, `graphReady`, `graphContributed`, `graphAddedFiles` ve varsa `graphEvidence` içerir. İlişki biçimi `{ fromPath, fromLine, toPath, toLine, kind, confidence }` olur. `graphUsed` ve `graphContributed` ancak ek dosya veya aktarılmış ilişki kanıtı varsa doğrudur. Hazır ama katkısız haritada seçim yöntemi Graphify, neden `no-graph-contribution`, bu iki bayrak false olur. İz en fazla 100 ek göreli dosya ve 20 ilişki taşır; araç komutları veya ham kaynak satırları geçmişin iz alanına kaydedilmez. Sohbet ve geliştirme görevleri aynı kaynak/harita revizyon kontrolünü kullanır.

**Belge önceliği:** Genel/güncel sorularda kök README ve kullanıcı kılavuzları önce seçilir; bileşen manifestlerine ayrı bağlam payı ayrılır. `docs/archive/`, `docs/arşiv/` ve plan/yol haritası belgeleri varsayılan güncel seçimden çıkarılır. Tarihçe, eski durum veya plan istendiğinde bunlar tarihsel/plan etiketiyle dahil edilir; karma soruda iki role de yer ayrılır. Aynı kural Graphify seçiminde de geçerlidir. Kaynak rollerini **Yanıt ayrıntıları → Kaynaklar** içinde görebilirsiniz. Rol bir doğruluk garantisi değildir; tarih veya planın uygulanmış olduğu bu sınıflandırmadan çıkarılmaz. Belge ile kod çelişirse kanıtları ve belirsizliği belirtme yönergesi verilir; model yanıtının doğruluğu ayrıca değerlendirilmelidir.

Özel belge adları için sunucu `project.documentRoles` kullanabilir: `{ 'docs/current/KURUM.md': 'canonical', 'README.md': 'historical' }`. Anahtarlar tam ve göreli kaynak yollarıdır; roller `canonical`, `manifest`, `code`, `test`, `historical`, `plan` olabilir. İstek gövdesinden rol değişikliği kabul edilmez; bu ayar gizlilik ve dosya erişim engellerini aşamaz. Uzun belgeler ve tek satırlı manifestler bütçe içinde kısaltılabilir; kesilme açıkça işaretlenir. Çok küçük bütçede bütün kaynakların sığması garanti değildir.

**Genel tanıtım:** Türkçe/İngilizce genel istek sözcükleri sıralamadan çıkarılır; `ver`, `server` içinde eşleşmez. Kod adlarında camelCase/snake_case sözcükleri ayrılır. Genel bakışta güncel belgelere ek olarak frontend, backend giriş dosyası, yetki middleware'i, girişten çağrılan LLM entegrasyonu ve veritabanı şemasına bağlam payı ayrılır. Bu seçim statik işaretlere dayanır; her mimariyi eksiksiz çözmez.

Aynı kaynak görüntüsünden çıkarılan `stack`, `components`, `api`, `database`, `limitations` alanlı mimari özeti sohbet modeline gönderilir. Olgular dosya/satır taşır; npm sürümleri bağımlılık bildirimi olarak etiketlenir ve çalışan sürüm sayılmaz. Özet, numaralı kaynak parçaları ve varsa Graphify ilişki kanıtları birlikte 40.000 karakter sınırına uyar; kesilen özet alanları ve kısmi kapsam belirtilir. Graphify kanıtı en fazla 6.000 karakter ve toplam bütçenin dörtte biridir; bu yüzden 20'den az ilişki sığabilir. Model çıktılarının kontrollü A/B değerlendirmesi ayrı görevdir.

[Resmî Graphify rehberine](https://github.com/Graphify-Labs/graphify) göre sunucuda Python 3.10+ ile `uv tool install graphifyy` veya `pipx install graphifyy` kullanılır. Tarayıcının bulunduğu bilgisayar yerine LLM Manager servisinin çalıştığı makineye kurun. Servisin PATH'inde `graphify` aranır; gerekirse Graphify kurulu Python yorumlayıcısını `LLM_GRAPHIFY_PYTHON` ile belirtin. Bu değere mutlak yol verin: göreli değer çalışma dizinine (Express entegrasyonunda helper klasörüne) göre çözülür; `python` gibi yalın komut adı PATH'te aranmaz. PATH/ayar değişince servisi yeniden başlatın. Bu bağlantı için `graphify install` ve sohbet içinde / komutu gerekmez.

Yalnız izin verilen kaynakların geçici kopyası `extract --code-only` ile taranır; canlı hedefe harita dosyası yazılmaz, model çağrısı yapılmaz. Harita sunucu belleğinde tutulur ve yeniden başlatmada kaybolur. Sunucu `project.graphify: false` ile aracı kapatabilir; `graphifyAutoDetect: false` PATH aramasını kapatır. Açık `graphify: { command, args }` veya `graphifyPython` yalnız sunucuda yapılandırılır; tarayıcı komut/yol seçemez. Graphify desteği hedef uygulama içindir; LLM Manager'ın kendi geliştirme haritaları geri eklenmedi.

1. İlk sekmede profili etkinleştirin; **Proje bilgileri → Projeyi tara** seçin.
2. Teknoloji, API, SQL kolonları ve dosya ilişkilerini dosya/satır kanıtlarıyla inceleyin. Tarama manifest çalıştırmaz ve gerçek DB'ye bağlanmaz.
3. Kaynak paylaşımını onaylayıp sohbet/plan/değişiklik isteyin. Sohbette seçili parçalar, motor görevinde kopyadan okunan dosyalar sağlayıcıya gönderilir.
4. Değişiklikte önce/sonra içeriklerini inceleyin; işlem onayını verip uygulayın. Onay her işlemden sonra sıfırlanır. Kaynak değişmişse `PROJECT_CONFLICT` ile durur.
5. Varsa hostun tanımladığı doğrulamayı ayrı onayla çalıştırın. Komut hedef klasörde değil, hazırlanan farkı içeren geçici kopyada çalışır; `node_modules`, `.env` ve canlı veri bulunmadığından bağımlılık isteyen kontroller başarısız olabilir. Uygulamadan önce veya sonra çalıştırılabilir; hedef dosyaların görev sürümüyle eşleşmesi gerekir. Gerçek çıkış kodunu kontrol edin. Bu kontrol hedefe uygulanmış dosyaları çalıştırmaz; başarısız doğrulama dosyaları otomatik geri almaz. Geri alma da dosya sürümü eşleşmesi ister.

Dosya farkları ve geri alma kayıtları **sunucu belleğindedir**; en fazla 10 görev tutulur. Sunucu kapanınca veya **Görev kaydını kapat** seçilince uygulanmış dosyalar kalır, geri alma kaydı gider. Sohbetteki iş çıktısı öneri/dosya listesi/son bilinen etki/doğrulama/işlem izini korur. **Canlı görevi aç** mevcut sunucu kaydını yeniden denetler; geçmişi açmak dosya yazmaz veya komut çalıştırmaz. Yanıt alınamadığında işlem etkisi belirsizdir; otomatik yeniden uygulamayın.

**Eşzamanlılık:** Kaynaklı sohbetler dosya yazmaz; birbirleriyle ve süren tarama/görev işlemleriyle aynı anda çalışır. Tarama, görev hazırlama, uygulama, geri alma, komut ve görev kaydını kapatma sunucuda tek seferde bir tanedir; biri sürerken yenisi `409 PROJECT_BUSY` döner. Sohbette **Durdur** yalnız kendi isteğini keser. `POST /project/cancel` yalnız aynı yönetici kimliğinin başlattığı özel işlemi iptal eder ve `{ cancelled }` döndürür; sohbetleri ve başka yöneticinin işini etkilemez. Eşzamanlı sohbetler aynı chat kotasını paylaşır.

Uygulama yalnız kaynak dosyalarını değiştirir; paket kurulumu, migration, servis yeniden başlatma ve deployment ayrı süreçtir. Eski migration'ı değiştirmek yerine yeni dosya hazırlanabilir. Geçici kopyada `node_modules`, sırlar ve canlı veriler yoktur; çalışmayan kontrol başarı sayılmaz.

### Araçlar ve tarama kapsamı

Kaynak taraması ve bağlam seçimi yerleşiktir; Python veya harici analiz aracı gerektirmez. OpenCode yalnız plan/değişiklik görevleri için ayrı kurulmalıdır; `LLM_OPENCODE_PATH` / `project.opencodePath` ile yolu verilebilir. Eksikse model denemesi, tarama ve kaynaklı sohbet çalışır; motor görevleri hata verir.

`.env*`, anahtarlar, bağlantılı/ikili/üretilmiş dosyalar ve Git ignore kapsamı dışlanır. `node_modules`, `dist`, `coverage`, `obj`, `.git`, sanal ortam ve önbellek dizinleri her konumda; `data`, `build`, `out` yalnız proje kökünde dışlanır. `src/data/` veya `app/build/` gibi iç içe kaynak klasörleri ignore edilmemişse taranır. Varsayılan tarama: **2500 dosya, dosya başına 256 KiB, toplam 4 MiB**. Kısmi taramayla sohbet yapılır. Yalnız dosya başına boyut sınırını aşan dosyalar (ör. `pnpm-lock.yaml`, büyük wasm) atlandıysa plan/değişiklik görevi de hazırlanır: bu dosyalar geçici kopyaya alınmaz ve uygulama adımında üzerlerine yazılamaz (409). Dosya sayısı veya toplam boyut sınırı kaynak atladıysa (`limited: true`) motor görevi hazırlanmaz. Sohbet kaynak bütçesi **40000 karakter**; ilk üç uygun README/kılavuz/metin için sınırlı pay ayrılır. Plan/değişiklik görevlerinde seçim bütçesi **12000 karakter**dir; API/DB işaretleriyle motora verilen yerel bağlam en fazla 20000 karakterdir. Bütün proje her istekte gönderilmez; sır algılayıcı kusursuz değildir.

**Dışlanan kaynaklar ve nedenleri** bölümünde gizlilik, ignore, bağlantı, tür/kodlama veya boyut/sayı sınırı nedeniyle alınmayan kaynakları görebilirsiniz. Dizin kaydı içindeki tüm dosyaların sayıldığı anlamına gelmez. API envanteri `exclusions: [{ path, reason }]`, `exclusionCounts` ve `exclusionsTruncated` döndürür; ayrıntı listesi en fazla 200 kayıttır. Yollar göreli tutulur; güvenli gösterilemeyen veya anahtar biçimi içeren yollar listelenmez. Eşleşen sırın içeriği ve ham sistem hata metni bu özette bulunmaz. Eski kayıtta ayrıntı yoksa panel bunu belirtir.

Boş `ref('')`, boolean görünürlük durumu ve sınırlı kod referansları parola sanılmaz. Hesaplanan değerler (`process.env.X || process.env.Y`, `String(...)`, `crypto.randomBytes(...)`, `await vault.read(...)`), parametre/destructuring varsayılanları (`{ password = adminPassword }`) ve noktalı çeviri anahtarlarındaki boşluklu metinler (`"form.api_key": "API anahtarı"`) de sır sayılmaz; böylece kimlik doğrulama kodu sohbet kapsamından düşmez. Boş olmayan bir sabite geri dönen ifadeler (`env.X || 'varsayılan-değer'`) ve test dosyalarındaki sabit kimlik bilgileri yine dışlanır. Doğrudan string parola/anahtar değerleri, dolu reactive parola başlangıçları ve kimlik bilgili DB bağlantıları dışlanır; kısa string değerler ve JSON anahtarları da denetlenir. Belge içindeki DB URL örnekleri otomatik maskelenmez: güvenli ayrım yapılamıyorsa dosyanın tamamı `secret` nedeniyle dışlanır. Aynı içerik filtresi okuyucuda ve Graphify/OpenCode çalışma kopyasında uygulanır; bütün dosyayı koşulsuz açan bir istisna yoktur.

Yerleşik analiz JS/TS importlarını, bazı JS/Python route işaretlerini, Next.js App Router `app/**/route.(ts|js)` dosyalarındaki `export async function GET/POST…`, `export const GET =` ve `export { handler as GET }` tanımlarını (uç nokta dosya yolundan türetilir: `app/api/ai/route.ts` → `/api/ai`; `(grup)` ve `@slot` klasörleri atlanır, `[id]`/`[...slug]` korunur), fetch çağrılarını ve SQL CREATE TABLE kolonlarını kaynak örüntülerinden çıkarır; dosya adı/içerik eşleşmeleri ve yerel ilişkiler bağlam sırasını belirler. İlgili bir komşu dosyaya tek sabit ek puan verir; çok yerden içe aktarılan yardımcı dosya bu yüzden soruyla ilgili dosyaların önüne geçmez. Aynı roldeki birebir aynı içerikli kopyalardan (ör. `sites-source/` ikiz ağacı) yalnız en sığ yoldaki gönderilir. `tools/`, `vendor/`, `third_party/` gibi bir klasörde kendi manifesti ile lisans dosyası ya da `bin/`/`dist/` klasörü olan paketlenmiş araç (ör. `tools/pnpm`) soru o aracın adını içermedikçe bağlama alınmaz. Her sohbet/görev kaynakları yeniden okur; eski revizyonla istek 409 verir. Statik örüntüler tam LSP, çalışma zamanı veya DB introspection değildir. Belgeler/geçmiş mesajlar talimat ya da dosya/komut yetkisi sayılmaz. Repomix, Cline, Aider ve DBHub ürünün etkin bileşenleri değildir.

## Entegrasyon

Ana uygulama klasöründe:

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

Sihirbaz türü bulur, değişiklikleri onayla uygular, doğrular ve sayfayı açar. `--type`, `--force`, `-y`, `--no-open` seçenekleri vardır. `-y` doğrulama hatasında scaffold'u geri alır; ayrı onaylanan paket kurulumunun node_modules/lockfile değişikliği geri alma kapsamında değildir. Mevcut yardımcılar `--force` olmadan ezilmez; belirsiz girişe/çıktı klasörüne kod eklenmez. Derleyici yoksa kontrol atlanmış gösterilir; yardımcı derlenmesi hostun tam build kanıtı değildir.

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';
const app = express();
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD,
  adminUser: process.env.LLM_ADMIN_USER || 'admin',
  // Proje özelliği gerekmiyorsa bu alanı kaldırın.
  project: { root: '/absolute/target', commands: {
    test: { command: process.execPath, args: ['--test'], timeoutMs: 60000 }
  } }
});
app.listen(3000);
// Güvenilir sunucu kodunda: await llm.ask('Merhaba');
// Host kapanışında: await llm.close();
```

Framework bağımsız kullanım: `import { createLLMManager } from '@sirrakadembasti/llm-manager/core'`; yönetici oluşturup `ask()`, `stream()`, `fetch(Request)` veya `handle()` kullanın. `ask()`/`handle()` güvenilir host API'leridir; HTTP kimlik/yetki denetimini adaptör sağlar. Express host session için `requireAuth`, Web için `authorize(request)` verilebilir; yönetim `isAdmin === true` ister.

### Kaynaklı yanıt kalitesini karşılaştırma

Türkçe soru sözcükleri, alana bağlı olmayan genel bir sözlükle yaygın İngilizce kod adlarına eşlenir: kimlik/yetki (giriş → login, auth), iş akışı (talep → request, onay → approve), ticaret/stok (fatura → invoice, sipariş → order), uygulama katmanları (veritabanı → database, schema ve yaygın ORM adları; kontrolcü → controller) ve veri işlemleri (güncelle → update, sil → delete). Eşleme yalnız sorudaki sözcüğün karşılığını ekler; projenin teknoloji yığınını veya alanını tahmin etmez. Türkçe ekler tanınır, `sil`/`silah` gibi benzer sözcükler eşlenmez; `isteği` de `request` olarak eşlenir. "için, hangi, var, nerede, belirt, kaynak, bu, mi" gibi soru kalıbı sözcükleri arama terimi sayılmaz. Bu, kaynak bulmayı iyileştirir; yanıt doğruluğunu garanti etmez. Genel tanıtımda güncel belge/manifest ve LLM bağlantısı, tarihçe sorusunda etiketlenmiş eski belgeler beklenir. "Kaynaklarda görülen LLM entegrasyonunu da belirt" yönergesi sistem talimatına yalnız genel tanıtım sorularında eklenir; diğer sorular bu yönergeyi almaz.

Kontrollü A/B denemesinde aynı kaynak revizyonu, profil/model ve üretim ayarları kullanılır; geçmiş iki istekte de boştur. Kabul kaydı soru, yöntem, kaynak/profil revizyonu, kaynaklar, yöntem izi, sağlayıcının bildirdiği giriş/çıkış tokenleri ve süreyi taşır. Anahtar kaydedilmez. Ücretli çağrı kapsamı ayrıca onaylanır; bu kabulde otomatik tekrar ve yedek profil kapatılmıştır. Normal sohbetin tekrar politikası bu deney için değiştirilmez.

`tests/project-retrieval-quality.test.js` yedi soru türünü ve Next.js App Router örneğindeki iki soruyu ("Veritabanında hangi tablolar var?", "AI isteği hangi dosyada?"; çok içe aktarılan yardımcı, ikiz ağaç ve paketlenmiş araç içerir) iki yöntemle sınar; test yardımcısı atıfların gerçekten gösterilmiş satırlarda kaldığını kontrol eder. Satır kontrolü iddianın anlam bakımından doğruluğunu kanıtlamaz; tarihsel/güncel ayrımı, güncel entegrasyon kapsamı ve çalışma zamanı iddiaları ayrıca incelenir. Kaynak aralığı metadata'sı kesintisiz alıntı garantisi değildir. Daha uzun yanıt veya daha fazla ilişki tek başına başarı ölçütü değildir.

2026-10-29 ilk canlı çift gösterilmeyen ara satırları kapsayan birer atıf nedeniyle kabul edilmedi. Tek satır atıflarına sıkılaştırılan yönergeyle, ayrıca onaylanan ikinci çiftte temel yanıtın 41 ve Graphify yanıtının 37 atfı gösterilmiş satırlarda kaldı. İkisi de güncel LLM bağlantısını kapsadı; tarihsel kaynak kullanmadı ve PostgreSQL çalışma garantisi vermedi. İkinci çiftte temel yöntem 13.746 giriş / 1.119 çıkış tokeni ve 20.278 ms; Graphify 13.856 / 1.319 ve 22.484 ms kullandı. Graphify 14 ek dosya ve 20 ilişki sağladı. Süre yalnız sağlayıcı çağrısıdır; harita çıkarımı dahil değildir. Toplam dört çağrı yapıldı. Bu sınırlı kabul başka soru/sağlayıcılar için doğruluk, fiyat veya hız üstünlüğü kanıtlamaz; parasal fiyat hesaplanmadı.

Kalite testleri 23/23 geçti (yedi soru türü ve iki Next.js sorusu × iki yöntem, artı Next.js yolları dahil atıf/harita ve soru sözcüğü denetimleri). 2026-11-08'de dağıtım kabulü betikleri eklendikten sonraki kapsam koşusunda 632 testten 631'i geçti, başarısız test yok, 1 platform testi atlandı. Lint/typecheck/format geçti. Hedef uygulamanın tam testleri gerçek veriler yerine izole kopyada çalıştırılmalıdır; paket kurulumu ve hedef kabulü ayrıca doğrulanır.

### Desteklenen ortamlar

| Ortam | CLI türü | Bağlantı / kimlik sınırı | Ayrı Node süreci |
| --- | --- | --- | --- |
| Express | express | ESM/CJS/TypeScript; Basic/host session, chat Bearer; parser auth sonrası | Hayır |
| SPA | spa | HTTP helper; yalnız chat Bearer, üretimde kendi backend'iniz | Evet |
| Next.js | nextjs | App Router Node; yalnız sunucu importu; admin/host authorize | Hayır |
| Nuxt | nuxt | `server/utils/llm.js`; istemcide HTTP, sunucuda host kimliği | Hayır |
| SvelteKit | sveltekit | `src/lib/server/llm.js`, `+server.js`; ask rotası fetch politikasına delege | Hayır |
| Electron | electron | `userData/llm`, main/preload IPC; renderer admin parolası almaz | Hayır |
| Tauri | tauri | HTTP helper; Rust/Electron enjeksiyonu yok, chat Bearer | Evet |
| Fastify, Koa, Hono ve NestJS | fastify/koa/hono/nestjs | Otomatik enjeksiyon yok; doğrulanmış principal ile elle köprü | Hayır |
| Python | python | `llm_client.py`, `ask_llm()`; URL/token, 330 sn, tipli LLMError | Evet |
| .NET ve .NET Framework | dotnet | `LlmClient.cs`; URL/token, iptal/330 sn; .NET 4.0 ve modern hedefler | Evet |

Edge desteklenmez. Sunucusuz Node dağıtımında kalıcı ana uygulama deposu gerekir; Electron sürekli masaüstü ana süreci ister. SPA/Tauri/Python/.NET istemci olabilir, yönetim servisi sürekli Node ister. Gruplanmış framework'lerden tek CLI türü seçin. CJS helper senkron kurulur ve hostun 404 katmanından önce bağlanır.

Next.js için `serverExternalPackages: ['@sirrakadembasti/llm-manager']` gerekir; ayar yoksa `next build` paketi derlemeye katar ve başarısız olur. Sihirbaz dinamik config çalıştırmaz; herhangi bir adla tanımlanıp `export default` edilen literal nesneleri, tek satırlık yazımı ve `webpack(config) { … }` gibi metot kısayollarını düzenler. Config hiç yoksa onayla en küçük `next.config.mjs` oluşturur. Otomatik düzenlenemeyen veya ayarı içermeyen config doğrulamada **başarısız** (`next_external_package`) gösterilir. Next.js, Nuxt ve SvelteKit kurulumunda `.env` dosyasına mutlak `LLM_DATA_DIR` (proje kökündeki `data/`) yazılır; mevcut değer korunur. Böylece `.next/standalone` sunucusunun çalışma dizini değişse de profil, anahtar ve geçmiş build çıktısına yazılmaz. Sunucuya taşırken bu değeri kalıcı bir mutlak klasöre ayarlayın. Üretilen Server Action host yetkisi kurulana kadar kapalıdır. Nuxt/SvelteKit sunucu modülleri istemci bileşenine taşınmaz. Electron `contextIsolation: true`, `nodeIntegration: false` kullanır; yalnız kendi loopback Basic challenge'ına parola verir, dış gezinmeyi engeller; mevcut preload korunur.

Python/.NET `LLM_MANAGER_URL` ve `LLM_CHAT_TOKEN` okur, `.env` yüklemez. Modern/.NET 4.5+ HttpClient ve `await LlmClient.AskAsync()`; .NET 4.0/net40/belirsiz eski hedefler C#4, HttpWebRequest/TPL ve `ContinueWith` kullanır. NuGet gerektirmeyen JSON/assembly yardımcıları üretilir; eski hedefte hostun tam runtime doğrulaması ayrıca gerekir.

### Yönetim yolu ve giriş

Kurulum **menü eklemez**. Önce `/llm` ve `/api/llm` denenir; sabit rota, dosya tabanlı sayfa veya statik dosya çakışmasında `/llm1` + `/api/llm1`, ardından `/llm2` + `/api/llm2` seçilir. Seçim hedef `.env` ve sır içermeyen `.llm-manager.json` dosyasına kaydedilir; tekrar kurulumda mevcut yol ve parola korunur. Express başlangıcında daha önce kayıtlı sayfa rotaları da kontrol edilir; kullanılan gerçek adresler `setupLLM(app)` sonucunun `pagePath` ve `apiPath` alanlarındadır. Özel yollar `--page-path /tools/llm --api-path /api/tools/llm` ile verilebilir; çakışırsa üzerine yazılmaz.

**Ayrı LLM girişi:** Rol sistemi olmayan uygulamalarda ve varsayılan kurulumda `--auth basic` kullanılır. Kullanıcı adı/parola önce hedef `.env`, ardından hedef `.env.example` ve paketle gelen `.env.example` varsayılanlarından alınır; kullanıcı adı yoksa `admin`, parola boşsa benzersiz rastgele parola üretilir ve yalnız `.env` içine yazılır. Terminal ortamı veya açık API seçenekleri çalışma anında `.env` değerlerinden önceliklidir. Tarayıcı Basic Auth penceresiyle giriş yapılır; paket örneğindeki parola boş bırakılır.

**Mevcut yönetici oturumu:** Otomatik bağlantı şu anda Express içindir. Adaptör önce hedef uygulamanın gerçek oturumunu doğrulamalı ve `req.user` üretmelidir. Örneğin mevcut Mimo Stok backend'inde `llm-auth.cjs` içeriği şu olabilir:

```js
module.exports = require('./src/middleware/auth').auth;
```

Ardından hedef backend klasöründe:

```sh
npx llm-manager init --type express --auth host --auth-module ./llm-auth.cjs --admin-roles admin
```

Yalnız `req.user.isAdmin === true`, izinli `req.user.role` veya izinli `req.user.roles` kabul edilir. Roller tam adlarıyla eşleşir; farklı yönetici rolleri `--admin-roles admin,owner` ile açıkça eklenir. Pasif/devre dışı kullanıcılar reddedilir. Adaptör bulunamazsa veya oturum doğrulanamazsa ayrı parolaya otomatik geçilmez. Sihirbaz bu modda ayrı sunucu başlatmaz; canlı doğrulamayı tamamlanmış saymaz. Hedefte yönetici, normal kullanıcı ve oturumsuz erişim ayrıca denenmelidir.

Programatik Express bağlantısı `@sirrakadembasti/llm-manager/integration` alt yolundaki `mountLLMIntegration(app, { cwd, authMode, requireAuth, adminRoles })` ile yapılır. `basePath: '/stok'` verilirse yönetim ve API adresleri bu genel öneki kullanır; proxy öneki siliyorsa host dispatch öncesinde geri koymalıdır. App ve Router üzerinde yol çakışmaları denetlenir. Bu yönetim adaptöründe chat Bearer erişimi ve herkese açık sağlık ucu kapalıdır; bütün panel/API erişimi seçilen yönetici girişine bağlıdır. Daha geniş sohbet politikaları için mevcut düşük seviye `mountLLMManagement` API'si kullanılır.

**Masaüstü ve eski/gömülü uygulamalar:** Node sunucusu barındıramayan uygulamada yönetim ekranı ayrı, sürekli çalışan Node servisinde açılır. Servis hedef `.env` bilgilerini ve seçilen yolları CLI üzerinden kullanır; uygulama HTTP istemcisiyle bağlanır. Python/.NET/Tauri şablonlarının istemci adresi seçilen API yoluna göre üretilir. Aynı domain altında `/llm` isteniyorsa reverse proxy bağlantısı ayrıca yapılır; yerel servis kurulması bu yönlendirmeyi kendiliğinden oluşturmaz. Electron'un izole ana süreç paneli ayrı bir şablondur; paketli/native dağıtımın ayrıca sınanması gerekir. Yönetici parolasını renderer veya tarayıcı paketine koymayın.

Sabit rota taraması bütün uygulamayı anlattığı anlamına gelmez: dinamik rotalar, proxy önekleri, iç içe router'lar ve özel middleware sırası hedefte doğrulanır. Bilinen Express bağlantısı JSON/cookie/session katmanlarından sonra, yakalanabilen genel rotalardan önce eklenir; `app = express()` noktası bulunamazsa dosyaya tahmini kod yazılmaz ve doğrulama elle bağlantı ister. Kurulum içindeki hata/ret sırasında journal dosyaları geri alır; npm bağımlılık kurulumu bu işlemin dışındadır. Eski helper'dan host moduna geçiş inceleme ve gerektiğinde `--force` ister. Paket yükseltmesi veya hedef uygulamanın güncellenmesi otomatik yapılmaz.

### Kurulumu yükseltme ve geri alma

Express ilk kapsamı tamamlanmıştır: menüsüz bağlantı, ayrı Basic veya mevcut yönetici oturumu seçimi, ayarlanabilir adres ve çakışma denetimi, kurulum doğrulaması ve journal ile geri alma. Hedefin oturum adaptörü açıkça verilir; rol isimleri tahmin edilmez. Host doğrulaması başarısız olduğunda Basic parolaya geçilmez.

Paket yükseltmesinden önce hedef `.env`, bağlantı dosyaları ve profil/geçmiş/anahtar üçlüsünü koruyun. Mevcut helper otomatik olarak ezilmez; inceleyip gerektiğinde `init --force` kullanın. Kurulum sırasında hata veya ret varsa journal yaptığı dosya değişikliklerini geri alır; npm kurulumu ve daha sonra ortaya çıkan çalışma hataları bu transaction kapsamında değildir. Başarılı paket güncellemesinden sonra hedef sunucuyu yeniden başlatın ve oturumlu/oturumsuz erişimi tekrar deneyin.

Özel proxy için sayfa kadar betiği, API'yi ve profil kaydını da doğrulayın. Mimo Stok kabulünde bunlar öneki koruyan ve soyan yerel HTTP proxy ile sınandı; bütün adayları yakalayan önceden kayıtlı dinamik rotada otomatik ekleme durduruldu. Native masaüstü paketleme ve kurumsal TLS/proxy kabulü ayrı dağıtım çalışmasıdır.

VPS veya kurum sunucusunda domainin `/llm`, `/llm/llm-ui.js` ve `/api/llm` istekleri aynı backend'e ulaşmalıdır; seçilmiş özel/numaralı yollar ve alt adres öneki de korunur. Domain zaten bütün istekleri backend'e aktarıyorsa ek kural gerekmeyebilir. Paket kurulumu proxy veya Windows/Linux servis kaydını kendiliğinden oluşturmaz. Dağıtım kabulünde HTTPS/çerez ayarları, admin/normal kullanıcı/oturumsuz erişim, tarama, profil kaydı, servis yeniden açılışı ve yükseltme/geri dönüş ayrıca denenir. Gerçek Linux VPS, Windows Server/IIS ve domain/HTTPS kabulü henüz yapılmadı; yerel test sonucu bu senaryolar için garanti değildir.

### Özel depo

`store` metotları `T | Promise<T>` döndürebilir; dosya deposu asenkrondur. Güncellemede `id + revision`, silme/etkinleştirmede JSON `revision` zorunludur; karşılaştırma/yazma atomik olmalıdır. Eski kaydın açık `null` revizyonu ilk değişiklikte geçerli, eksik alan geçersizdir.

| Metot | Sözleşme |
| --- | --- |
| `list()` | `{version: 1, activeId, profiles}`; sırsız |
| `get(id)`, `getActive()` | İç profil: apiKey/transport dahil veya null; yalnız sunucu |
| `save(input)` | Genel profil; yeni kayıtta name/provider/model/baseURL/apiKey |
| `remove(id, revision)`, `activate(id, revision)` | Güncel liste; host remove `{ok:true}` da döndürebilir |
| `recordTest(id, status, expectedRevision, details)` | Genel profil; revizyon değiştiyse null; revision değiştirmez |

`status` passed/failed, `details` mode/durationMs/isteğe bağlı code içerir. [Async bellek örneği](../examples/memory-store.js) geçici ve tek süreçlidir. `testMessages`/`validateTestReply` iç profil alır; bu nesneyi loglamayın. İsteğe bağlı `store.assistantHistory.read(scope)` listeyi, `update(scope, mutate)` atomik güncel liste değişikliğinin sonucunu döndürür; mutate hata verirse yazılmamalıdır. Şifreleme, süreçler arası transaction ve yedekleme hostun sorumluluğudur. Çok kullanıcılı host her yöneticiye kararlı ve farklı `principal.id` sağlamalıdır.

## API ve sınırlar

Varsayılan sayfa `/llm`, API kökü `/api/llm`; `pagePath` / `apiPath` ile değiştirilebilir. Aşağıdaki yollar API köküne göredir. Yazma istekleri `X-LLM-CSRF: 1` ister. Bearer yalnız `POST /chat` içindir; diğer uçlar yönetici ister. `/health` sırsız ve herkese açıktır; `health: false` kapatır.

| İşlem | Yöntem / yol ve temel gövde |
| --- | --- |
| Katalog/profiller | `GET /catalog`, `GET /profiles` |
| Profil oluştur/güncelle/sil | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Etkinleştir/test/modeller | `POST /profiles/:id/activate`, `POST /profiles/:id/test`, `GET /profiles/:id/models` |
| Önizleme/özet/sağlık | `POST /models/preview`, `GET /usage?month=YYYY-MM`, `GET /health` |
| Model sohbeti | `POST /chat`: `{prompt}` veya `{messages}`, isteğe bağlı `stream: true` |
| Proje durumu/tarama/iptal | `GET /project`, `POST /project/scan`, `POST /project/cancel` |
| Kaynaklı sohbet | `POST /project/chat`: `{prompt, shareSources:true, revision?, history?}` |
| Görev hazırla/listele/oku | `POST /project/tasks`: `{mode:'plan' veya 'change', prompt, shareSources:true, revision?, history?}`; `GET /project/tasks` ve `/:id` |
| Uygula/geri al/doğrula | `POST /project/tasks/:id/apply`, `/revert`, `/commands/:name`: `{approved:true, revision}` |
| Görevi kapat | `POST /project/tasks/:id/discard`: `{approved:true}` |
| Sohbet arşivi | `GET /assistant/sessions` → `{available,sessions:[{id,title,updatedAt,mode}],reason?}` |
| Arşiv oluştur/oku/güncelle/sil | `POST /assistant/sessions`: mode zorunlu; `GET /assistant/sessions/:id`; `PUT /:id`: tam içerik+revision; `DELETE /:id`: `{revision}` |

Arşiv POST 201 ve tam kayıt döndürür. Kayıt alanları `title, mode, profileId, system, contextId, modelContext, messages, outputs`; mesaj rolü user/assistant, durumu pending/completed/failed/cancelled. Tam tipler [core.d.ts](../types/core.d.ts) ve [project.d.ts](../types/project.d.ts) içindedir. Kapsam dışında/yok kayıt 404, eski revizyon 409 `ASSISTANT_CONFLICT`; özel history desteği yoksa liste available false, yazma 503 verir.

HTTP sohbet örneği (sunucuda `LLM_CHAT_TOKENS` tanımlı ve etkin profil varken):

```js
const response = await fetch('http://127.0.0.1:8010/api/llm/chat', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.LLM_CHAT_TOKEN,
    'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
  body: JSON.stringify({ prompt: 'Merhaba' })
});
const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
```

`ask()` dize, `{raw:true}` ile usage/finishReason/profileId/duration sonucu döndürür. `stream()` AsyncIterable; HTTP SSE `delta`, `done`, `error` kullanır. `done` gerçek `profileId`/`fallbackUsed` taşır. Bağlantı kopması veya `signal` sağlayıcı isteğini iptal eder; done olmadan bitiş başarı değildir. Hiç metin üretmeyen akış (boş içerik, ayrıştırılamayan JSON veya olaysız gövde) `done` değil, JSON yoluyla aynı `LLM_EMPTY_RESPONSE` (502, retryable) hatasıdır; ilk çıktıdan önce olduğu için tekrar ve yedek profil zinciri sürer. Kabul edilen kesilme (`acceptTruncated`) bunun dışındadır. Retry yalnız retryable hatada ilk çıktıdan önce çalışır; Retry-After/backoff ve bütün fallback'ler ilk profilin tek süre bütçesini paylaşır. `retry:false` kapatır. Gizli düşünce son yanıta eklenmez; filtre/kesilme ayrı hatadır.

| Ayar / kapsam | Varsayılan veya sınır |
| --- | --- |
| `limits` | maxMessages 100; maxChars 200000; maxSingleMessageChars 100000; maxBodyBytes 262144 |
| Mesaj | system/user/assistant; en az bir user |
| `timeoutMs` / `maxOutputTokens` | 120000 ms (5000–300000); 8192 (256–32768) |
| Üretim | temperature 0–2; topP 0–1; stop en çok 4 dize; responseFormat text/json |
| `thinking` | auto/enabled/disabled; modele göre tam kapama desteklenmeyebilir |
| `chatAccess` / `chatOverrides` | authenticated/admin/false; admin/all/none (varsayılan admin) |
| Kota | Chat 30/dk; test 10/dk; model/önizleme 10/dk; hatalı giriş 10/dk |
| Sağlayıcı çıktısı / kısa test | JSON 2 MiB, SSE 8 MiB; quick test en çok 20 sn/512 token |
| Proje isteği | Prompt 10000 karakter; kaynaklı sohbet geçmişi en çok 12, görev geçmişi 10 mesaj; mesaj başına 10000 karakter |
| Değişiklik / motor köprüsü | 100 dosya, 2 MiB önce/sonra; 40 sağlayıcı isteği, istek 1 MiB, yanıt 8 MiB |

Proje chat/tasks mevcut chat kotasını paylaşır. Kota anahtarı host `clientKey` veya Web `getClientId(request)`, sonra `principal.id`, yoksa ortak anonim kimliktir. Express `req.ip`/`trust proxy` hostun sorumluluğudur. 429 `Retry-After` taşır; `rateLimit:false` kapatır. Kotalar süreç içidir, dağıtık maliyet tavanı değildir.

Amaçlar `quick | diagnostic | default`. MiMo auto modunda `purpose: 'diagnostic'` ve `purpose: 'quick'` düşünmeyi kapatır; `purpose: 'default'` model varsayılanını korur. MiMo quick testi açık thinking seçimini de kapatır. Test geçmesi üretim uygunluğu garantisi değildir.

## Güvenlik

### Güvenlik mimarisi ilkeleri

**Korunan varlıklar:** sağlayıcı/şifreleme anahtarları, yönetici kimliği, sohbet/kaynak içerikleri ve kullanım kayıtları. **Sır sızıntısını önleme:** genel profiller `hasApiKey` gösterir; iç get/getActive sonuçları yalnız sunucuda kalır. AES-256-GCM 12 bayt IV ve 16 bayt tag kullanır. `redact()` logları maskeler; `logContent: false` sabittir ve içerik günlüğü açılamaz.

| Tehdit | Mevcut kontrol / kalan sorumluluk |
| --- | --- |
| Sunucu tarafı istek sahteciliği (SSRF) | HTTPS, DNS/soket özel IP filtresi, yönlendirme reddi. LAN için açık allowedPrivateHosts; proxyUrl/LLM_HTTPS_PROXY durumunda uzak DNS nedeniyle bilinen/açık allowedHosts listesi gerekir. |
| Siteler arası istek sahteciliği (CSRF) | Yazma başlığı, CORS, CSP/X-Frame-Options. Host kendi session/SameSite ve uçlarını korur. |
| Kimlik bilgisi ve sır sızıntısı | Basic/host admin ile chat Bearer ayrıdır. Tarayıcı/masaüstüne gömülü token herkese açıktır; üretimde kendi backend'inizi kullanın. |
| Yetkisiz erişim | Web auth yapılandırılmamışsa AUTH_NOT_CONFIGURED ile kapalıdır. insecureNoAuth yalnız açık yerel tercihtir. Dış ağda TLS, güçlü parola ve servis hesabı kullanın. |
| Kaynak tüketimi ve maliyet istismarı | Gövde/mesaj/token/süre/çıktı sınırları, kota ve iptal; admin override. Sağlayıcı maliyet raporu ayrıca izlenmelidir. |
| Dosya ve model talimatları | Açık kök, realpath/symlink/ignore/sır kontrolleri; model çıktısı güvenli metindir. Paylaşım ve hedefe yazma ayrı onay ister. |

Vite geliştirmesi localhost:5173 kullanabilir; diğer SPA/Tauri origin'leri açık verilmelidir. Sihirbaz `*` kabul etmez; CLI wildcard yalnız sohbet için, credentials olmadan işler. Admin sırrı istemciye verilmez. Eksik origin ile `-y` CORS açmaz. Ortam/sır dosyalarını Git dışında tutun.

OpenCode temiz HOME/env, rastgele loopback parolası ve geçici köprü tokenıyla çalışır; gerçek API anahtarı ana süreçte kalır. Plugin/skill, LSP, bash, dış dizin, paylaşım ve snapshot kapalıdır. İzinler **OS sandbox değildir**; araç ve host komutları servis hesabı yetkileriyle çalışır. Komutlar hostun adlandırdığı command/args listesindendir, shell false kullanır. Araç kullanım maliyeti mevcut chat usage sayacına eklenmez.

Revizyon, kilit ve atomik tek dosya yazımı yerel bütünlüğü destekler; NFS/SMB, çok dosyalı ACID, atomik compare-and-swap veya çöküş sonrası kalıcı geri alma garantisi yoktur. İş çıktıları istemci kaynaklı tarihsel verilerdir; değiştirilemez audit günlüğü veya komut yetkisi değildir.

### Tedarik zinciri

Tehdit: kötücül bağımlılık, kilit dosyası, CI eylemi veya yayıncı kimliği bütün varlıkları etkileyebilir. **Mevcut kontroller:** runtime `undici`, isteğe bağlı peer `express`; `npm ci` package-lock.json bütünlüklerini kullanır; CI `npm audit --omit=dev` geliştirme bağımlılıklarını kapsamaz. `npm pack --dry-run`/izin listesi gerçek env, veri ve test dosyalarını dışlar. CI eylemleri sürüm yorumlu tam commit SHA'larına sabitlidir; iş akışı yalnız `contents: read` izniyle çalışır ve checkout depo belirtecini saklamaz (`persist-credentials: false`). CI `npm audit signatures` ile kurulan paketlerin kayıt imzalarını ve varsa köken kanıtlarını doğrular. `tests/supply-chain.test.js` sabitlenmemiş eylemi, geniş izni, kilit dosyasında npm kaydı dışı kaynağı veya `sha512` bütünlüğü olmayan paketi reddeder. `.github/dependabot.yml` eylem SHA'larını ve npm bağımlılıklarını haftalık güncelleme PR'larıyla izler; bu PR'lar da aynı CI'dan geçer. `undici` ve `express` büyük sürümleri yok sayılır: undici 8 Node 22.19+ ister (paket 22.12+ destekler), `express` geliştirme bağımlılığı Express 4 testleri içindir ve Express 5 `express5` takma adıyla sınanır. Aynı test, runtime bağımlılıklarının `engines.node` alt sınırının paketinkinden yeni olmasını da reddeder; CI en yeni Node 22 ile koştuğu için bu kırılma başka türlü görülmez. Geliştirme bağımlılıklarında yaması yalnız yeni büyük sürümde olan açıklar `package.json` `overrides` ile kapatılır (eslint'in kullandığı `minimatch` ^11.0.5); test, kilit dosyasında bilinen açığın yamasından eski `minimatch`/`body-parser` sürümünü reddeder. CI'daki `npm audit --omit=dev` yalnız paketle giden bağımlılıkları denetler; geliştirme açıkları yerelde `npm audit` ile izlenir. Yayın iş akışı yoktur.

**Planlanan kontroller (uygulanmadı):** yayıncı/kaynak politikası, yayımlanan pakette köken kanıtı (`npm publish --provenance`) ve çıktı imzalama; bunlar yayın iş akışıyla birlikte eklenecektir. Audit ve imza denetimi bilinen açıkları ve kayıt bütünlüğünü denetler; bağımlılığın güvenilir olduğunu garanti etmez.

### Güvenlik açığı bildirme

Sır/istismar ayrıntısını açık issue'da paylaşmayın; [özel GitHub bildirimi](https://github.com/sirrakadembasti/llm-manager/security/advisories/new) veya `sirrakadembasti@users.noreply.github.com` adresine `[SECURITY VULNERABILITY] llm-manager` konusuyla bildirin. Etki, tekrar adımları, commit/sürüm, OS ve Node sürümünü ekleyin. Hedef alındı bildirimi 48 saat, ön değerlendirme 5 iş günüdür; açıklamayı düzeltmeyle koordine edin.

Mevcut destek politikası: **1.x.x desteklenir; <1.0 desteklenmez**. Yerel 2.0.0 yayımlanmamıştır; yayımlanmış 2.x sürümünün kanıtı değildir. Bu durum ek bakım veya eski sürüme düzeltme taşıma taahhüdü eklemez. Geliştirme sürümündeki açıkları da özel kanallardan bildirin.

## Yedekleme ve sorun giderme

**Birlikte saklayın:** `data/llm-profiles.json`, varsa `data/llm-profiles.json.assistant.enc`, `data/llm-encryption.key`. Özel profil yolunda geçmiş `<profil-dosyası>.assistant.enc` olur. Anahtar kaybı profilleri ve geçmişi çözülemez bırakır; bozuk dosyayı koruyun, boş depoyla ezmeyin. Profil `.bak`, döndürme veri `.bak` ve `.old-*` anahtar yedekleri eşleşen takım hâlinde saklanmalıdır. Normal sohbet yazıları ayrı `.bak` üretmez; anahtar döndürme geçmiş yedeği de alır.

```sh
npx llm-manager key rotate
npx llm-manager export --out yedek.json --password yedek-parolasi
npx llm-manager import yedek.json --password yedek-parolasi
```

**Döndürmeden önce** bütün depo süreçlerini durdurun ve üç dosyayı yedekleyin. Profil/geçmiş kilitlenip yazmadan önce çözülür; ikisi yeni anahtarla şifrelenir. Eski veriler `.bak`, eski anahtar `llm-encryption.key.old-<tarih>-<kimlik>` olur. Bozuk geçmiş işlemi durdurur; normal yazma hatasında veriler geri alınır. Sistem çökmesinde çok dosyalı atomiklik yoktur; profil/geçmiş yedeklerini eşleşen eski anahtarla birlikte geri yükleyin.

Anahtar önceliği: açık `encryptionKey` > `LLM_CONFIG_ENCRYPTION_KEY` > anahtar dosyası. Varsayılan setup legacy `.env` anahtarını dosyaya taşır; `.env` değişmez. `writeEnv: true` eski uyumluluk yoludur. Döndürme sonrasında açık/env anahtarını yeni değere güncelleyip süreçleri yeniden başlatın; CLI `.env` dosyasını güncellemez. Export/import yalnız **profil** taşır, sohbet arşivini içermez. Yedek parolası `--password`, yoksa `LLM_BACKUP_PASSWORD`, o da yoksa `LLM_ADMIN_PASSWORD` değerinden alınır; yönetici parolasından ayrı yedek parolası için `LLM_BACKUP_PASSWORD` tanımlayın.

| Belirti / kod | Yapılacak işlem |
| --- | --- |
| auth.failed / 401 | Yönetici adı/parolası ve tarayıcı Basic önbelleğini kontrol edin; ilk anonim istek de bunu üretebilir. |
| STORE_DECRYPT_FAILED / ASSISTANT_STORE_FAILED | Eşleşen anahtarı ve veri dosyasını geri yükleyin; eski env anahtarı dosyanın önüne geçebilir. Yeni anahtar eski veriyi kurtarmaz. Disk/izin de kontrol edilmelidir. |
| STORE_CORRUPT / STORE_VERSION_UNSUPPORTED | Dosyayı koruyun; uyumlu sürüm veya eşleşen sağlam yedek kullanın. |
| STORE_LOCKED / PROFILE_CONFLICT / ASSISTANT_CONFLICT | Kilidi/revizyonu kontrol edin; ekrandaki kaydedilmemiş metni dışa aktararak güncel kaydı açın. |
| PROJECT_CONFLICT / PROJECT_PARTIAL_APPLY | Güncel kaynakları yeniden tarayın; kısmi uygulamada dosyaları elle karşılaştırın. |
| MESSAGES_INVALID / BODY_INVALID / BODY_TOO_LARGE | Mesaj/JSON biçimini veya boyutunu düzeltin; 400/413. Host parser daha küçük sınır koyabilir. |
| 429 / 504 / 499 | Retry-After bekleyin; süreyi/araç durumunu kontrol edin; 499 iptaldir. |
| Node kurulu ama npm bulamıyor | Windows cmd.exe PATH sınırı 8191 karakterdir; eski geçici girdileri temizleyip terminali yenileyin. |

Dosya izinleri (0600) Windows'ta uygulanmaz; `data/` klasörünü yalnız uygulama kullanıcısının erişebileceği bir konuma koyun ve NTFS ACL verin. POSIX'te dosya/dizin izinlerini de sınırlandırın. Şifreli/çevrimdışı yedek kullanın; anahtar arşivini herkese açmayın.

## Dağıtım ve ayarlar

Üretimde TLS ters vekili, servis hesabı ve kalıcı veri dizini kullanın. Ağa açık CLI en az **12 karakter** parola ister. Parolayı komut satırı/kabuk geçmişi yerine servis ortamında tutun. Sağlık: `curl -f http://127.0.0.1:8010/api/llm/health`; ok/version/hasActiveProfile/requestId döner, canlı sağlayıcı başarısını kanıtlamaz. `usageLog:true` veya `LLM_USAGE_LOG=true` aylık içeriksiz JSONL ve admin `/usage` açar; `chat.completed` başarı/hata/iptal/erken yineleyici dönüşü dahil mantıksal isteği bir kez kaydeder, bilinmeyen usage null'dır.

| Ayar | Kapsam |
| --- | --- |
| LLM_ADMIN_USER / LLM_ADMIN_PASSWORD | Kullanıcı varsayılan admin; parola gerekli |
| LLM_AUTH_MODE / LLM_HOST_AUTH_MODULE / LLM_ADMIN_ROLES | Init ve Express entegrasyonunda basic/host, oturum adaptörü ve izinli yönetici rolleri |
| LLM_PAGE_PATH / LLM_API_PATH | Init, Express entegrasyonu ve CLI yönetim yolları; sihirbaz çakışmada numaralı yol seçer |
| HOST / PORT / LLM_DATA_DIR | CLI: 127.0.0.1 / 8010 / ./data; bayraklar öncelikli. `npm start` örneği yalnız PORT'u doğrudan okur. |
| LLM_CONFIG_PATH / LLM_CONFIG_KEY_PATH / LLM_CONFIG_ENCRYPTION_KEY | Açık dosya yolları / 32 bayt hex veya base64 anahtar |
| LLM_CHAT_TOKENS / LLM_ALLOWED_ORIGINS | Chat Bearer listesi / açık CORS origin listesi |
| LLM_ALLOW_LOCAL_HTTP / LLM_HTTPS_PROXY / LLM_USAGE_LOG | true ile yerel HTTP istisnası / proxy / true ile kullanım kaydı |
| LLM_PROJECT_ROOT / LLM_OPENCODE_PATH / LLM_GRAPHIFY_PYTHON | Kaynak kökü / OpenCode motor yolu / isteğe bağlı Graphify kurulu Python yorumlayıcısının mutlak yolu |
| LLM_BACKUP_PASSWORD | CLI export/import yedek parolası; yoksa LLM_ADMIN_PASSWORD kullanılır |

Her giriş noktası her değişkeni otomatik okumaz. CLI bayrakları `--host`, `--port`, `--data-dir`, `--user`, `--password`, `--chat-token`, `--cors`, `--project-root`; tümü için `--help`.

LAN host izinlerini programatik `allowedPrivateHosts` seçeneğiyle verin; önceki belgede anılan `LLM_ALLOWED_PRIVATE_HOSTS` mevcut kod tarafından okunmaz. Proxy için ek `allowedHosts` verilebilir. Kaynak kökü ve araçlar core tarafından env'den çözülebilir; paket entegrasyonunda açık seçenekler kullanılabilir.

### Docker ve servisler

```sh
docker build -t llm-manager .
docker run -d --name llm-manager --restart unless-stopped -p 8010:8010 -v llm_data:/data -e LLM_ADMIN_PASSWORD llm-manager
```

Önce kabukta parolayı tanımlayın. İmaj `node:22-alpine`, non-root `node`, `/data` volume ve healthcheck kullanır; Express'i kurar. CMD host/port/data değerlerini açık verir: `0.0.0.0:8010`, `/data`. Portu değiştirirken CMD ve healthcheck'i birlikte uyarlayın. Compose/Kubernetes'te aynı imajı Secret/env, kalıcı volume/PVC ve `/api/llm/health` yoklamasıyla çalıştırın; NFS/SMB ortak dosya deposu yerine uygun host store seçin. OpenCode imaja otomatik kurulmaz; bağlı proje kökünü ayrıca mount edin, `data` dizinini kaynak kökü yapmayın.

| Servis | Asgari kurulum |
| --- | --- |
| PM2 | `pm2 start node_modules/@sirrakadembasti/llm-manager/bin/llm-manager.js --name llm-manager`; cwd'yi `.env` olan hosta ayarlayın, `pm2 startup` talimatını uygulayın, `pm2 save`. |
| systemd | WorkingDirectory host, EnvironmentFile host/.env, User ayrı servis hesabı; ExecStart mutlak node + paketin bin/llm-manager.js yolu; Restart=on-failure, TimeoutStopSec=15. `systemctl daemon-reload`, enable --now; journalctl ile izleyin. |
| Windows/NSSM | `nssm install LLMManager 'C:\Program Files\nodejs\node.exe'`; AppDirectory host, AppParameters paketin mutlak CLI yolu. Boşluklu yolu tırnaklayın, servis hesabı/ACL ve otomatik başlangıç ayarlayın. Ek ortam için AppEnvironmentExtra mevcut sistem ortamını korur. |

**Dağıtım kabulü iş akışı** (`.github/workflows/deploy-acceptance.yml`) bu kurulumları GitHub'ın Linux ve Windows Server makinelerinde gerçekten kurar ve `scripts/acceptance/deploy-check.mjs` ile dışarıdan sınar: Docker imajı (root olmayan kullanıcı, healthcheck, `docker restart` ve kapsayıcı yeniden oluşturulunca `/data` volume'unun korunması); ayrı servis hesabıyla systemd + Nginx ve yerel CA sertifikalı HTTPS (HTTP→HTTPS yönlendirmesi, `/stok/llm` önekli ikinci kurulum, `systemctl restart`, `kill -9` sonrası `Restart=on-failure`, 15 sn içinde düzgün kapanış); Windows Server'da NSSM servisi + IIS (URL Rewrite/ARR ters vekil, kendinden imzalı HTTPS bağlaması, servis/IIS yeniden başlatma ve çöken sürecin geri gelmesi). Her senaryoda oturumsuz/yanlış parolayla 401, oturumlu sayfa/betik/API, CSRF başlığı olmayan yazmanın 403 alması ve sahte anahtarlı kabul profilinin yeniden başlatmadan sonra korunması denetlenir; model çağrısı yapılmaz, parola her koşuda rastgele üretilip günlükte maskelenir. İş akışı elle (`gh workflow run deploy-acceptance.yml`), haftalık, `v*` etiketinde ve kabul dosyaları değişen PR'larda çalışır. Gerçek domain/genel sertifika ve gerçek VPS ağı bu kabulün kapsamı dışındadır.

CLI/örnek SIGINT/SIGTERM kapanışı en fazla **10 saniye** sürer; servis yöneticisi daha uzun süre tanımalıdır. Programatik bağımsız sunucuda `handleSignals: true`, gömülü host kapanışında `await instance.close()` kullanın. `close()` aktif işi/motoru/köprüyü iptal eder, sahipli geçici kopyaları temizler; arşivi silmez. Windows zorla sonlandırmada cleanup çalışmayabilir; POSIX süreç grubu SIGTERM sonrası SIGKILL ile, Windows çocukları taskkill /T /F ile kapatılır.

## Geliştirme ve mimari

| Konum | Sorumluluk |
| --- | --- |
| `src/core.js`, `src/index.js`, `src/server.js` | Framework bağımsız yönetici; Express adaptörü; ortak bağımsız sunucu |
| `src/runtime.js`, `transports/`, `providerTransport.js` | OpenAI/Anthropic/Google dönüşümleri, retry/SSE, DNS/SSRF/proxy taşıması |
| `src/profileStore.js`, `store/`, `assistant/` | Şifreli profil/geçmiş, kilit/revizyon, session API |
| `src/project/` | Güvenli envanter/analiz/bağlam; workspace/process; relay/opencode/tasks; changes/commands |
| `src/init/`, `bin/` | Proje algılama, şablon, journal/geri alma, doğrulama, CLI |
| `src/integration.js`, `src/integration/` | Express yönetici girişi ve çakışmasız yönetim yolu seçimi |
| `public/` | Profil UI; chat-client, assistant-history-ui, project-ui. Betikler tek korumalı UI asset'inde birleşir. |
| `types/`, `examples/`, `tests/`, `scripts/`, `.github/` | Tipler, çalışır örnekler, davranış testleri, isteğe bağlı araçlar, CI |
| `docs/` | Bu tek kılavuz ve küçük tarihsel kabul betiği |
| `data/`, `node_modules/`, `.git/` | Aktif veri/anahtarlar; bağımlılıklar; sürüm geçmişi. Geçici dosya sanıp silmeyin. |

### Kalite doğrulama komutları

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm audit --omit=dev
```

Seri koşuda seçenekler dosyalardan önce gelir: `node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js`. Kapsam eşikleri satır %80/dal %70; CI Linux/Windows/macOS × Node 22/24 matrisi tanımlar ve Ubuntu + Node 22 işinde testleri `npm run test:coverage` ile bu eşiklere göre çalıştırır, diğer işler `npm test` kullanır. Gerçek motor kabulü `scripts/check-project-assistant.mjs` ile sentetik kaynak/anahtar ve yerel sağlayıcı kullanır; araçlar ayrıca kurulu olmalıdır. Testler aktif veri yerine izole dizin kullanmalı; .NET SDK kontrollerinde `DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=false` korunmalıdır.

### Standart commit biçimi

Bir görev bir commit; feat/fix/docs/test/refactor/chore ve kısa amaç başlığı, ör. `fix(store): geçmişi yeni anahtarla şifrele`. Önce davranış testi yazın; API değişince tipleri ve bu kılavuzu güncelleyin. Her commit/push öncesi README başta olmak üzere tüm Markdown belgelerini (`git ls-files "*.md"`) değişiklikle karşılaştırın; test sayıları, özellik açıklamaları ve doğrulanmış durum satırları güncel değilse önce belgeyi güncelleyin. Core Express bağımsız, araç importları gerektiğinde yüklenir kalmalı; yeni runtime bağımlılığı zorunluysa gerekçelendirin. Kullanıcı değişikliklerini koruyun. Test geçmesi commit/push/yayın/sürüm artırma yetkisi vermez. İstekte sorun, çözüm, doğrulama ve sınırları yazın; değişiklik/karar kayıtlarını bu belgenin sonunda tutun.

### 2.0 geçişi ve alt yollar

Eski `llm-manager` paketini kaldırın, scoped import kullanın ve dosya deposunu await edin. `detectProjectType`, `detectEntryFile`, `formatVerificationReport` 2.0'da kökten kaldırılmıştır; yerine:

```js
import { detectProjectType, detectEntryFile, formatVerificationReport } from '@sirrakadembasti/llm-manager/init';
```

Kökteki async `runInteractiveInit`, `probeAndOpenBrowser`, `initLLMProject`, `verifyIntegration`, `injectIntoEntryFile` bir uyumluluk sürümü için deprecated köprülerdir. Eski purpose manager → diagnostic, production → default birer uyarıyla eşlenir; eski generate bayrakları iletilmez. `getErrorMessage` ikinci parametresi dili değiştirmez. CLI/veri/anahtar dosyaları korunur.

| İçe aktarma | Amaç |
| --- | --- |
| `@sirrakadembasti/llm-manager` | Express ve temel API |
| `@sirrakadembasti/llm-manager/core` | Framework bağımsız çekirdek/depo |
| `@sirrakadembasti/llm-manager/server` | Bağımsız sunucu |
| `@sirrakadembasti/llm-manager/integration` | Açık basic/host girişiyle menüsüz Express yönetim bağlantısı |
| `@sirrakadembasti/llm-manager/init` | Algılama, kurulum, doğrulama ve geri alma |
| `@sirrakadembasti/llm-manager/setup` | Anahtar ve profil yedekleri |
| `@sirrakadembasti/llm-manager/runtime` | Üretim ve hata sınıflandırma |
| `@sirrakadembasti/llm-manager/transport` | Güvenli sağlayıcı HTTP taşıması |
| `@sirrakadembasti/llm-manager/errors` | Tipli hatalar |

## Geçmiş ve belge özetleri

### Değişiklik özeti

| Tarih / durum | Sonuç |
| --- | --- |
| 2026-10-19 / 1.0.0 | İlk bağımsız core/Express/CLI, sağlayıcı kataloğu ve şifreli profiller. |
| 2026-10-20–27 / 2.0 geliştirme | Çoklu framework init, async/host store, tipler, transportlar/SSE/retry/fallback, güvenlik/kota/loglar, dağıtım/CI; Türkçe arayüz. YH1/YH2 kartları kapatıldı. |
| 2026-10-28 / `29066dc`, `b73f5d6` | Proje Asistanı, OpenCode, onaylı değişiklik/geri alma; birleşik sohbet ve şifreli kalıcı geçmiş. |
| 2026-10-29 / `6acce05` | Anahtar döndürmeye sohbet eklendi; normal yazma hatasında geri alma. Graphify değerlendirilip ek tarama maliyeti nedeniyle entegrasyonu, ayarları ve harita çıktıları kaldırıldı. Kaynak seçimi yerleşik analizi kullanır. |
| 2026-10-29 / `7a7d531` | Menüsüz kurulum; `/llm`, `/llm1`, `/llm2` yol seçimi; ayrı parola veya açık Express yönetici oturumu; mevcut ayarları koruma ve geri alma. Mimo Stok bağlantısı hedef depoda `ffdb82b` ile kaydedildi. |
| 2026-10-29 proje kökü düzeltmesi | Express hedef `.env` proje ayarı aktarılır; göreli kök helper klasörüne göre çözülür. Stokta frontend/backend/belgeleri içeren kök bağlandı; pasif düğmenin bekleme imleci düzeltildi. |
| 2026-10-29 hedef Graphify desteği | Hedef uygulama için isteğe bağlı ilişki analizi, panelde seçim/kurulum rehberi, güncel haritayla sohbet/görev bağlamı geri eklendi. LLM Manager'ın kendi harita çıktıları geri eklenmedi. |
| 2026-10-29 ilk P0 görevi | Kaynaklı sohbette açık temel/Graphify seçimi; yanıt bazında yöntem, geçiş nedeni, revizyon ve ek dosya katkısı; şifreli geçmişte izinli alanlarla kalıcılık. |
| 2026-10-29 kaynak otoritesi ve mimari | Altı kaynak rolü, güncel belge/manifest önceliği, soru amacı ve Türkçe kod kavramları; toplam bütçe içinde kaynaklı mimari özeti. |
| 2026-10-29 ilişki, gizlilik ve kalite kabulü | En fazla 20 ilişki kanıtı, ortak revizyon denetimi, güvenli dışlama nedenleri ve literal sır ayrımı. Dört onaylı canlı çağrının ikinci çiftinde atıf/kapsam kabulü; 17 kalite testi. |
| 2026-11-05 / `a6a83af` ve belge düzeltmesi | `LLM_ALLOWED_PRIVATE_HOSTS` ortam değişkeni koddan kaldırıldı; LAN izni yalnız `allowedPrivateHosts` ile verilir. Doğrulama komutunun geçici kopyada çalıştığı, görev bağlam bütçesi, Graphify Python yolu ve yedek parolası kaynağı kodla eşitlendi. |
| 2026-11-05 tarama kapsamı | `data`, `build`, `out` dizin engeli proje köküyle sınırlandı; iç içe kaynak klasörleri tarama, sohbet ve onaylı değişiklik kapsamına girer. |
| 2026-11-06 genel Türkçe kod sözlüğü | Hedef uygulamaya özgü kavram eşlemeleri (talep → prisma/schema, teslim → print) kaldırıldı; yerine alandan bağımsız Türkçe → İngilizce yazılım sözlüğü geldi. |
| 2026-11-08 saha testi düzeltmeleri | pdf-to-onlinequiz (Next.js 16) üzerindeki saha testinde bulunan yüksek önemli dört hata giderildi: Next config düzenleyicisi gerçek yazımları tanır ve doğrulama eksik ayarı yakalar; Next/Nuxt/SvelteKit veri klasörü mutlak `LLM_DATA_DIR` ile sabitlenir; Graphify envanter dışı düğümleri atlar; boyutu aşan tek dosya plan/değişiklik görevlerini kapatmaz. |
| 2026-11-06 eşzamanlı sohbet | Kaynaklı sohbet genel işlem kilidinden ayrıldı; özel işlemler sıralı kalır, iptal yalnız sahibinin işlemini durdurur. Arayüzde **Durdur** sohbet isteğini doğrudan keser. |
| 2026-11-06 macOS/Windows geçici dizin düzeltmesi | Graphify ve görev çalışma alanı geçici dizini gerçek yola çevrilir; macOS `/var` bağlantısı ve Windows kısa TEMP adlarında Graphify sonucu artık reddedilmez. |
| 2026-11-06 kapsam denetimi | Kapsam yeniden ölçüldü (satır %94,71 / dal %87,65); CI'nin Ubuntu + Node 22 işi %80/%70 eşiğini zorunlu denetler. |
| 2026-11-06 sır filtresi yanlış alarmları | Canlı denemede `src/core.js` dahil 9 gerçek kaynak dosyasının sır sanıldığı görüldü. Hesaplanan değerler, parametre varsayılanları ve çeviri metinleri artık dışlanmıyor; depo taramasında alınan dosya 134'ten 140'a çıktı, sabit kimlik bilgisi içeren dosyalar dışlanmaya devam ediyor. |
| 2026-11-08 saha testi orta önemli düzeltmeler | pdf-to-onlinequiz (Next.js 16) denemesinden: metinsiz SSE akışı `LLM_EMPTY_RESPONSE` verir ve yedek profil zinciri sürer; ilişki puanı dosya başına tek ek puanla sınırlandı, birebir ikiz kopyalar ve paketlenmiş araçlar (`tools/pnpm`) bağlam bütçesini tüketmez, Türkçe soru kalıbı sözcükleri terim sayılmaz; App Router `route.(ts|js)` dosyaları API envanterine `kind:'route'` olarak girer; LLM entegrasyonu yönergesi yalnız genel tanıtım sorularında gönderilir. |
| 2026-11-08 init proje kökü | Kurulum sihirbazı `.env` dosyasında yoksa `LLM_PROJECT_ROOT` yazar (helper'ı içeren git deposunun köküne göre göreli; depo yoksa `.`); mevcut değer ezilmez, geri alma satırı kaldırır. `.env` içindeki değer artık `init`'in yeniden çalıştırılmasını engellemez. |
| 2026-11-08 geliştirme audit | Geliştirme bağımlılıklarındaki 5 `npm audit` bulgusu kapatıldı: test Express 4'ünün `body-parser` 1.20.9'a yükseldi (GHSA-27r3-jxmh-p828), eslint'in `minimatch` bağımlılığı `overrides` ile 11.0.5'e çekildi (GHSA-g3hv-75wg-m249). eslint aynı 183 dosyayı aynı sonuçla denetler. |
| 2026-11-08 undici 7.30.2 | Runtime bağımlılığı `undici` 7.30.2'ye yükseltildi (redirect/önbellek ve SRI güvenlik düzeltmeleri; Node desteği değişmedi). undici 8 ve `express` 5 Dependabot PR'ları kapatıldı; büyük sürümleri yok sayılır. CI eylemleri `actions/checkout` v7.0.1 ve `actions/setup-node` v7.1.0 SHA'larına güncellendi. |
| 2026-11-08 tedarik zinciri | CI eylemleri tam commit SHA'larına sabitlendi, iş akışı izni `contents: read` ile sınırlandı, checkout belirteci saklanmıyor; CI `npm audit signatures` koşar; Dependabot eylem ve npm güncellemelerini izler; `tests/supply-chain.test.js` bu kuralları ve kilit dosyası kaynağını/bütünlüğünü denetler. |
| Bu belge düzenlemesi | 11 Markdown belgesi incelenip güncellendi; tekrarları kaldırılarak bu kılavuzda birleştirildi. Ayrı plan/politika/kılavuz kopyaları kaldırıldı. |

### Doğrulanmış durum ve açık işler

2026-11-08 dağıtım kabulü betiklerinden sonra tam seri aynı komutla **632 test; 631 geçti, 0 başarısız, 1 platform testi atlandı**; init proje kökü değişikliğinden sonra 619 testin 618'i geçmişti. Önceki tam seri (`node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js`, Windows): iki saha testi dalı birleştikten sonra **612 test; 610 geçti, 1 başarısız, 1 platform testi atlandı**. Başarısız test `tests/auth-policy.test.js` içindeki init probe testiydi (yerel istekte geçici `fetch failed`); tek başına üç kez ve aynı gün `npm run test:coverage` koşusunda geçti (612 test; 611 geçti, 0 başarısız). Makine yükteyken `tests/server-lifecycle.test.js` alt süreçleri 15 sn içinde başlayamayıp zaman aşımına düşebilir; boş makinede 17/17 geçer. pdf-to-onlinequiz (Next.js 16) saha testinde bu sürümle sihirbaz config'i kendisi düzenledi, build elle düzeltme olmadan geçti, veri proje `data/` klasörüne yazıldı, Graphify haritası hazır oldu ve kilit dosyası olan projede plan görevi açıldı. pdf-to-onlinequiz (Next.js 16) saha testindeki boş SSE yanıtı, kaynak seçimi, App Router rotaları ve genel tanıtım yönergesi düzeltmeleri de sınandı. Aynı gün, kullanıcı onayıyla, düzeltilmiş kod gerçek `gemini-3.8-flash` profiliyle pdf-to-onlinequiz kaynağında üç soruya (veritabanı tabloları, AI isteğinin dosyası, genel tanıtım) yanıt verdi; tekrar ve yedek kapalıyken üç çağrı yapıldı. Önceki saha testinde üç sorudan biri doğruydu; bu kez üçü de doğru dosyaları seçti ve kaynakla uyumlu yanıt verdi. Giriş 14.177–14.846, çıkış 344–1.022 token; süre 15,7–31,8 sn. 56 atıfın tamamı gösterilen satırlarda kaldı. Test yardımcısı önce `[id]`/`[...slug]` içeren yolları tanımıyordu; Next.js dinamik, catch-all, route group ve slot bölümlerini okuyacak şekilde düzeltildi ve kayıtlı yanıtlar yeni model çağrısı yapılmadan yeniden denetlendi. Ana kopyadan farklı içerikli `sites-source/` dosyaları birebir ikiz olmadığından bağlamda yer almaya devam eder. Birleşik sürümle, kullanıcı onayıyla, gerçek OpenCode 1.18.33 ve aynı profil pdf-to-onlinequiz'de yalnız fark hazırlayan bir değişiklik görevini (health yanıtına `VERSION.json` sürümü) 76 sn'de tamamladı: tek dosyalık doğru fark önerildi, hedefe uygulanmadı; hedefin git durumu ve dosya özetleri değişmedi. Sağlayıcıya 9 istek gitti; giriş 202.213, çıkış 834, düşünce 2.912 token. Eşzamanlı sohbet, sahibine bağlı iptal, iç içe kaynak klasörleri, genel Türkçe kod sözlüğü ve ortamdan okunmayan LAN izinleri de sınandı. Profil/sohbet/proje akışları, Express 4/5 ve basic/host yetkileri, kurulum/geri alma, anahtar/veri koruma, kaynak rolleri ve mimari kapsam, gerçek ilişki katkısı ve eski revizyon reddi sınandı. Güvenli reactive ifadeler/literal sır ayrımı ve aynı gizlilik filtresiyle kaynak/Graphify kopyası doğrulandı. Yedi soru türü ve iki Next.js sorusu × iki yöntem ile Next.js yolları dahil atıf/harita ve soru sözcüğü denetimleri **23/23** geçti. Lint/typecheck/format kontrolleri geçti; paket gerçek `.env`, anahtar ve profil verisi içermez.

Son Mimo Stok taramasında Graphify 0.9.97, filtrelenmiş 108 dosyalık code-only kopyada **1.585 öğe ve 2.919 ilişki** üretti; kaynak ve harita revizyonları eşleşti. Bu tarama model çağrısı yapmadı ve hedefe harita dosyası yazmadı. Ayrı kontrollü A/B kabulünün dört sağlayıcı çağrısı ve sınırları [ilgili bölümde](#kaynaklı-yanıt-kalitesini-karşılaştırma) açıklanır. Dosya ve ilişki sayıları kaynak değiştikçe farklılaşabilir.

Mimo Stok'ta güncel paketle LLM entegrasyonu **18/18**, gerçek veri içermeyen geçici kopyadaki tam seri **292/292** geçti. Canlı admin/birim/oturumsuz erişim, iki tarama yöntemi ve yerel sahte sağlayıcıyla sohbet izi doğrulandı; `.env` ve dört LLM veri dosyası korundu. Önceki yerel HTTP proxy kabulünde öneki koruyan/silen yönlendirme, özel yollar ve kurulum geri alma da sınandı. Kaynak serisindeki başlangıç ve bir hedef koşu/tarama zaman aşımı ardından ayrı kontroller ve son tam seriler geçti; ilk hatalar başarı sayılmadı. Bu sonuç bütün IIS/Nginx/TLS dağıtımlarının veya paketli masaüstü uygulamalarının kabulü anlamına gelmez.

Son kapsam ölçümü 2026-11-08'de dağıtım kabulü betikleriyle 632 testlik kaynakta (Windows, `npm run test:coverage`; 631 geçti, 0 başarısız, 1 atlandı) satır %94,93 / dal %88,19 / fonksiyon %92,85 oldu; eşikler geçti. En düşük satır kapsamı `src/init/probe.js` (%74), `src/rateLimit.js` (%80) ve `src/project/tasks.js` (%83; dal %68) dosyalarındadır. Kapsam, kodun çalıştırıldığını gösterir; davranışın doğruluğunu tek başına kanıtlamaz. Tam seri sonucu ile kapsam ölçümünü birbirinin yerine kullanmayın.

Gerçek OpenCode 1.18.33 kabulü kontrollü sentetik kaynaklarla yapıldı; önceki sınırlı canlı sağlayıcı denemesi bütün hesapların garantisi değildir. Gerçek Docker build/run, uzak OS×Node matrisi, paketli framework/masaüstü E2E, native sinyal teslimi, pozitif proxy CONNECT ve kapsamlı canlı sağlayıcı/DB kabulü **henüz tamamlanmış değildir**. Tedarik zincirinde yayıncı politikası, yayın köken kanıtı ve çıktı imzalama açık iştir. DBHub/canlı DB bağlantısı ertelidir; bu liste yayın yetkisi vermez.

Docs altında tek Markdown dosyası vardır; 11 belgenin toplam metnine göre birleştirme sırasında yaklaşık **%79** kısaldı. [Küçük tarihsel kabul betiği](roadmap/dogrulama.mjs) tam test serisinin veya canlı dağıtımın yerine geçmez. Graphify hedef uygulama için isteğe bağlı olarak geri eklendi: proje durumunda `graph`, sohbet yanıtında `graphUsed`, hata sözlüğünde `PROJECT_GRAPH_FAILED` / `PROJECT_GRAPH_INVALID` vardır. `POST /project/scan` gövdesindeki `graphify: true` taramayı seçer; varsayılan tarama yerleşik analizi kullanır. Yerel geliştirme haritaları ve ayrı eski belge kopyaları geri eklenmedi.

### Birleştirilen her belgenin kısa özeti

| Önceki dosya | Güncellenmiş özeti / buradaki karşılığı |
| --- | --- |
| KULLANICI_KILAVUZU.md | Başlangıç, profil ve sohbet akışı; yeni okuyucu sırasına alındı, eski UI tarifleri temizlendi. |
| TEKNIK_KILAVUZ.md | Core/adaptör, transport, proje ve geçmiş mimarisi; API/tip/sınırlar aynı konu altında toplandı. |
| ENTEGRASYON.md | Init ve 10 ortamın süreç/kimlik sınırları; ortak örnek ve tek tabloya indirildi, host store sözleşmesi korundu. |
| DAGITIM.md | Docker/servis, ortam ayarları, sağlık/kapanış; giriş noktalarının gerçekten okuduğu ayarlar ayrıldı. |
| GUVENLIK.md | Sır koruma, destek ve özel açık bildirimi; aynı güvenlik bölümünde korundu. |
| TEHDIT_MODELI.md | SSRF/CSRF, erişim, maliyet, bütünlük/tedarik zinciri; anahtar kurtarması profil+geçmiş+anahtar olarak güncellendi. |
| KATKI_REHBERI.md | Kalite, commit, API/tip güncelleme ve test gizliliği; geliştirme bölümüne taşındı. |
| KLASORLER.md | Çalışan kod/veri/araçların amacı; geçici olmayan veri ve anahtarların korunmasıyla tek tablo oldu. |
| DEGISIKLIKLER.md | İlk sürüm ve yayımlanmamış değişiklikler; tekrar eden özellikler yerine tarihli kısa gelişim özeti oldu. |
| roadmap/YOL_HARITASI.md | YH1/YH2/YH3 sonuçları, doğrulama ve açık işler; eski planlar güncel davranış gibi sunulmadan özetlendi. |
| superpowers/plans/2026-10-29-rotation-docs-graphify.md | Tamamlanan anahtar/belge/harita planı; sonucu ve işletim sınırları ilgili bölümlere işlendi. |

Ayrıntılı eski commit kayıtları Git geçmişindedir; bu dosya güncel kullanım kaynağıdır. [README](../README.md) · [MIT lisansı](../LICENSE)
