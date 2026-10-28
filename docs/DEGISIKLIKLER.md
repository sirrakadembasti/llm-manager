# Değişiklik günlüğü

[SemVer](https://semver.org/lang/tr/) ve [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) kullanılır.

## [Yayımlanmamış]

### Sohbet çalışma alanı

- Graphify kurulum rehberi ve host PATH keşfi; revizyonla doğrulanan grafik destekli kaynak seçimi, README/kılavuz bağlamı ve belge sayıları eklendi. Sohbet alanı uzatıldı ve mesaj sütunu okunabilir genişlikle sınırlandı.
- Mesajlara daha fazla dikey alan ayrıldı (masaüstü 940px, mobil 800px alt sınır). Merkezdeki sohbet menüsü solda Seçili sohbet alanına taşındı; yinelenen yeni sohbet düğmesi ve Sohbet bağlamı ve kaynaklar paneli kaldırıldı. Kaynak analizi, kayıt ve mesaj ayrıntıları korundu.

- Açılır sohbet seçicisi yerine solda kayıtlı sohbet çerçevesi, satırdan açma/silme ve yeni sohbet; merkezde mesajlar ve altta yazma alanı eklendi.
- Çalışma türü/profil üst araç çubuğuna; başlık/dışa aktarma/silme/kurtarma soldaki **Seçili sohbet** alanına, proje bilgileri açılır yan panele taşındı. Yanıt ayrıntıları katlanır; mobil liste düğmeyle açılır.
- Sohbet yanıtı sonu başarı paneli kaldırıldı. Enter/Shift+Enter, IME, klavye odağı ve kullanıcı yukarı kaydırmasını koruyan akış takibi doğrulandı.

### Kalıcı sohbet ve iş çıktıları

- Yönetici/proje kapsamlı şifreli sohbet arşivi, yeniden açma/devam, adlandırma, JSON dışa aktarma, revizyon kontrollü silme ve kayıt hatası kurtarma eklendi. Yeni yönetici API'si: `/assistant/sessions`.
- Tamamlanmış/başarısız/durdurulmuş/bekleyen yanıtlar ve sınırlı model bağlamı ayrıldı. Geçmiş gezinme ve model/görev işlemleri ortak kilit kullanır; başarısız yanıtlar bağlama girmez.
- Görev önerileri, dosya listeleri, son bilinen etki ve doğrulama/işlem izi sohbetle saklanır. Canlı görevi açma yeniden doğrulanır; arşivden otomatik uygulama/geri alma yapılmaz. OpenCode hazırlama API'si isteğe bağlı sınırlı sohbet geçmişi kabul eder.

### Arayüz düzeni ve birleşik sohbet

- Üst başlık ve sekmeler inceltildi; ana sayfa bağlantısı, profil sayısı ve etkin profil özet panelleri kaldırıldı. Etkinlik işareti profil kartında korunur.
- Playground, Proje Asistanı'ndaki **Uygulaman hakkında çalış** alanıyla birleştirildi: model denemesi, kaynaklı sohbet, geliştirme planı ve değişiklik hazırlama tek formdadır. Profil seçimi, sistem talimatı, SSE/JSON, süre/token ve iptal model denemesinde korunur; kaynak modları etkin profili ve kaynak onayını kullanır.
- Sohbet soldaki geniş sütuna, bağlı proje/etkin model/mimari sağdaki tek bilgi bloğuna alındı; mobilde sohbet önce gelir. API sözleşmesi değişmedi.

Yerel hedef **2.0.0**; npm yayını/Git etiketi oluşturulmadı. Tamamlanan işler ve tarihli kanıtlar [tek yol haritasında](roadmap/YOL_HARITASI.md).

### Kırıcı değişiklikler ve geçiş

- İngilizce arayüz desteği kaldırıldı. TypeScript seçeneklerinde `locale` ve mesaj sözlüğünde `MESSAGES.en` yoktur. Eski JavaScript dil ayarları yok sayılır; arayüz Türkçe açılır.
- Paket `@sirrakadembasti/llm-manager`; CLI adı korunur. Eski paketi kaldırıp importları scoped ada taşıyın.
- Node alt sınırı **22.12**: CJS `require(esm)` ve undici gereksinimleri karşılanır. Express optional peer; dotenv kaldırıldı.
- Dosya deposu tüm metotlarda Promise döndürür; `await` kullanın. Host depoları `T | Promise<T>` destekler.
- Amaçlar `quick | diagnostic | default`; eski adlar birer uyarıyla eşlenir. Kullanılmayan eski generate bayrakları iletilmez.

### Kullanımdan kaldırılanlar

- 2.0 sürümünde senkron `detectProjectType`, `detectEntryFile`, `formatVerificationReport` kökten kaldırıldı; `@sirrakadembasti/llm-manager/init` kullanın. Kökteki beş async init sarmalayıcısı bir uyumluluk sürümü için korunur; ayrıntılar [kullanıcı kılavuzundadır](KULLANICI_KILAVUZU.md#20-geçişi-ve-alt-yollar).

### Eklendi

- `docs/graphify-out/` altında paylaşılabilir kaynaklardan üretilen statik Graphify kod haritası; katkı, dağıtım, güvenlik ve klasör belgelerinde Proje Asistanı işletim sınırları.

- Birinci sekmeyle aynı Türkçe tema ve mobil düzene sahip **Proje Asistanı**: güvenli kaynak envanteri, teknoloji/API/SQL analizi, kaynaklı sohbet ve isteğe bağlı Graphify haritası.
- OpenCode ile temiz kopyada plan/değişiklik, gerçek API anahtarını motora vermeyen yerel köprü, önce/sonra inceleme, ayrı işlem onayı, çakışmalı uygulama/geri alma ve host tanımlı doğrulama komutları.
- `project` seçeneği, proje yönetici API'si, `--project-root`, `LLM_PROJECT_ROOT`/`LLM_OPENCODE_PATH`/`LLM_GRAPHIFY_PYTHON`, kapanış temizliği ve ilgili TypeScript sözleşmeleri. Ayrıntılar entegrasyon ve kullanıcı kılavuzundadır.

- Framework bağımsız core, bağımsız sunucu, tüm alt yollar için TypeScript tipleri ve modüler init.
- Express 4 ESM/CJS ve Express 5; Next/Nuxt/SvelteKit sunucu yardımcıları; SPA/Python/.NET/Tauri HTTP ve Electron IPC entegrasyonları.
- OpenAI/Anthropic/Google stratejileri; SSE, iptal, retry/Retry-After, sıralı fallback, gerçek yanıt profili ve kullanım bilgisi.
- Parametreler: temperature/topP/stop/responseFormat; modele göre thinking. Katalog tarih/kaynak kaydı ve admin canlı model önizlemesi.
- Playground, Türkçe arayüz, profil klonlama, erişilebilir silme onayı, `homeUrl`, aylık kullanım kartları.
- Public health, request-id, maskeli logger, içeriksiz aylık JSONL; token/mesaj/gövde sınırları ve kotalar.
- Dockerfile/dağıtım kılavuzu, ESLint/Prettier, OS × Node CI, kapsam eşikleri, üretim audit ve paket içerik denetimi.

### Güvenlik ve veri

- Basic admin ve sohbet Bearer yetkileri ayrıldı; Web auth varsayılan kapalı, auth sonrası JSON parser ve CSRF/CORS sınırları uygulandı.
- Parolalar yalnız env dosyalarında; gitignore güncel. SPA'ya admin sırrı taşınmaz. Electron parolası yalnız kendi loopback Basic challenge'ına verilir; dış navigasyon engellenir.
- Async FIFO, süreç kilidi/Windows retry, clone/stat cache, şema migration, `.bak` ve tipli kurtarma hataları eklendi.
- Anahtar önceliği, kilitli legacy `.env` geçişi, tarihli benzersiz rotate yedeği ve şifreli export/import tamamlandı; `writeEnv: true` deprecated.
- AES-256-GCM IV/tag/format denetimi; HTTPS/DNS SSRF, proxy hedef listesi ve açık LAN host izinleri korundu.
- Mevcut ve planlanan tedarik zinciri kontrolleri ayrıldı; Güvenlik politikasının 1.x destek politikası değiştirilmedi.

### Düzeltildi

- README ve kullanıcı kılavuzunda Türkçe arayüz, ayar sonrası yeniden başlatma, özel yönetici adıyla API çağrısı ve varsayılan yedekleme yolları netleştirildi.
- İngilizce arayüz sözlüğü ve etkin dil seçeneği kaldırıldı; arayüz/hata açıklamaları Türkçe oldu. Eski JavaScript `locale` ayarı ve `getErrorMessage` ikinci parametresi dili değiştirmez. Teknik kılavuz ve politika dosyalarının adları/içeriği Türkçeleştirildi, yerel bağlantılar güncellendi.

- Yönetim arayüzünde başlık/içerik hizası eşitlendi; mobil ve açık/koyu tema kontrastı iyileştirildi. Kalıcı, kapatılabilir durum bildirimi ve profil kartında revizyona bağlı test sonucu eklendi; hata açıklaması ile teknik ayrıntılar ayrıldı.
- Yanlış şifreleme anahtarıyla profil açma, sağlayıcıya istek yapılmadan `STORE_DECRYPT_FAILED` döndürür. Güvenli kurtarma mesajı, Türkçe açıklamaları ve veri korunumu regresyon testi eklendi; anahtar önceliği değişmedi.
- `npm start` çalışma dizinindeki `.env` dosyasını okur ve `LLM_ADMIN_USER` ayarını uygular. Terminal ortamı önceliklidir; eksik `.env` engel değildir, diğer okuma hataları gizlenmez.
- `chatAccess: false` 404 döndürür; Bearer yönetim sayfası/betiğine giremez. Özel API yolu ve wildcard CORS yalnız sohbet kapsamındadır.
- Init CJS sırası, client/server sınırları, güvenli proje algılama, gerçek paket kurulumu ve işlem tabanlı byte/izin geri alma düzeltildi. Next belirsiz config'i çalıştırmaz; Edge uyarısı verir.
- .NET 4.0 için C#4/TPL/HttpWebRequest, modern hedefler için HttpClient; 330 sn sınır, iptal, JSON ve assembly referansları düzeltildi. Python hataları tipli Türkçe mesaja dönüştürülür.
- Akışta reasoning sızıntısı, filtre/kesilmenin başarı sayılması, timeout/iptal ayrımı, aktif istek iptali ve iterator temizliği düzeltildi.
- İlk çıktı öncesi retry ve tüm fallback'lerde tek bütçe; gerçek `profileId`/`fallbackUsed`, bir mantıksal kullanım ve tamamlanma olayı sağlandı.
- LAN listesi dosya deposuna iletilir; kotalar kararlı kişi kimliği kullanır; Web 429 `Retry-After` korunur.
- Revizyon/404/409, test geçmişi korunumu, model formunun korunması, nötr örnekler ve README/teknik kılavuz uyumu tamamlandı.
- .NET doğrulamasının geçici SDK araç dizinlerini kalıcı PATH'e eklemesi engellendi; gerçek `npm start` health/auth regresyonu eklendi (`6efbe32`, 388/388).
- Kök/kılavuz Markdown dosyaları kısaltıldı; roadmap ve denetim tekrarları tek dosyada birleştirildi. Eski ayrıntılar Git geçmişinde korunur.
- Kökte yalnız kısa README bırakıldı; API ve özellik açıklamaları kullanıcı kılavuzuna, diğer Markdown belgeleri `docs/` altına taşındı. `GEMINI.md` kaldırıldı; gerekli kurallar katkı belgesinde, klasör incelemesi `KLASORLER.md` içinde.

### Doğrulama

YH2 FAZ 0/1/2 ve YH1 32 kartı görev/genel incelemelerle kapatıldı. 2026-10-27 Türkçe arayüz/belge düzenlemesi sonrası tam test paketi 395/395 geçti; önceki 386 testlik kapsam %94,78 satır/%87,70 dal. Son test koşusu yeni bir kapsam ölçümü değildir. Bu yerel kanıtlar Docker build/run, uzak CI, paketli masaüstü/framework E2E veya canlı sağlayıcı üretim garantisi değildir.

## [1.0.0] - 2026-10-19

İlk bağımsız sürüm:

- Önceki host uygulamanın ad/bağımlılıkları kaldırıldı; paket o tarihte `llm-manager`, CSRF başlığı `X-LLM-CSRF` oldu.
- Core/Express ayrımı, UI önbelleği, bağımsız setup, CLI, sağlayıcı/model seçimi ve şifreli profil yönetimi sunuldu.
- `.env.example`, MIT lisansı, sürüm betikleri ve değişiklik günlüğü eklendi; kod/örnekler okunabilir hale getirildi.

[Yayımlanmamış]: https://github.com/sirrakadembasti/llm-manager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sirrakadembasti/llm-manager/releases/tag/v1.0.0
