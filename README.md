# LLM Manager

LLM sağlayıcılarını, modellerini ve API anahtarlarını tek arayüzden yönetin. Profil oluşturun, bağlantıyı test edin ve etkin profille sohbet edin. Bağımsız çalışır veya mevcut uygulamanıza eklenir.

**Gereksinim:** Node.js 22.12+. Docker ve veritabanı zorunlu değildir. Arayüz yalnız Türkçedir.

Kaynaklı sohbetin temel/Graphify karşılaştırması, aynı revizyon ve boş geçmişle yapılır. İlk çiftteki satır atıf hataları sonrası yönerge sıkılaştırıldı; ikinci çiftte kapsam dışı atıf bulunmadı ve güncel LLM bağlantısı kapsandı. Bu sınırlı kabul, Graphify'nin her soruda üstün olduğu anlamına gelmez. [Ölçümler ve kabul sınırları](docs/KULLANICI_KILAVUZU.md#kaynaklı-yanıt-kalitesini-karşılaştırma).

## Başlatma

İndirdiğiniz proje klasöründe PowerShell açın:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

`.env` dosyasında `LLM_ADMIN_USER=admin` ve `LLM_ADMIN_PASSWORD=kendi-guclu-parolaniz` ayarlayın. Ardından `npm start` çalıştırıp **[http://127.0.0.1:8010/llm](http://127.0.0.1:8010/llm)** adresini açın. Belirlediğiniz kullanıcı adı ve parolayla giriş yapın. Durdurma: **Ctrl+C**.

Linux/macOS'ta da `.env.example` dosyasını mevcut `.env` üzerine yazmadan kopyalayıp düzenleyin; `npm ci` ve `npm start` kullanın. Terminalde önceden tanımlanmış ortam değişkenleri `.env` değerlerinden önceliklidir.

## Uygulamanıza ekleme

Host proje klasöründe:

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

Kurulum menü eklemez. Yönetim yolu `/llm` olur; sabit rota veya sayfa çakışması bulunursa `/llm1`, `/llm2` seçilir.
Rol sistemi olmayan web/masaüstü/eski uygulamalarda ayrı LLM kullanıcı adı ve parolası kullanılır.
Express yönetici oturumuna bağlamak için `--auth host --auth-module ./llm-auth.cjs` seçin;
oturum adaptörü ve izinli roller açıkça yapılandırılır. [Giriş yöntemleri ve sınırlar](docs/KULLANICI_KILAVUZU.md#yönetim-yolu-ve-giriş).

Express bağlantısı, ayrı parola/host oturumu seçimi, özel adres, doğrulama ve kurulum geri alma ilk kapsamı tamamlandı.
2026-11-06 son tam seride **584 test: 583 geçti, 1 platform testi atlandı**; yedi soru türünü iki yöntemle sınayan kalite kontrolleri **17/17** geçti. Hedef uygulamanın kabul sonuçları kendi README'sinde tutulur.
Çalışan hedefte paket değişikliğinin yüklenmesi için sunucu yeniden başlatılır; kurulum hedef uygulamayı kendiliğinden güncellemez.
Domainin `/llm`, arayüz betiği ve `/api/llm` istekleri aynı backend'e ulaşmalıdır; `/stok/` altında kurulumda genel yol `/stok/llm` olur.
Yerel HTTP proxy kabulü tamamlandı; gerçek Linux VPS, Windows Server/IIS, domain/HTTPS ve servis yeniden başlatma kabulü henüz tamamlanmadı.

Paket adı `@sirrakadembasti/llm-manager`; npm'deki çıplak `llm-manager` başka bir projedir. Yerel 2.0.0 sürümü henüz **yayımlanmamış** durumundadır.

## Proje Asistanı

İkinci **Proje Asistanı** sekmesi, bağladığınız uygulamanın teknoloji, API, SQL şeması ve dosya ilişkilerini gösterir. Birinci sekmedeki etkin profille kaynaklı sohbet, OpenCode ile plan/değişiklik hazırlama ve onaylı uygulama/geri alma sunar; aynı Türkçe tema kullanılır.

Sohbet çalışma alanı model denemesini de içerir: proje bağlamadan kayıtlı profil seçebilir, sistem talimatı verebilir ve akışlı yanıtı süre/token bilgisiyle sınayabilirsiniz. Kaynaklı sohbet ve geliştirme türleri etkin profili kullanır. Soldaki listeden sohbet açılır/silinir; **Seçili sohbet** alanından başlık, dışa aktarma ve kayıt işlemleri yapılır. Mesajlar geniş dikey merkez alanda, proje bilgileri açılabilen sağ paneldedir. Mobilde **Sohbetler** düğmesi listeyi açar.

Sunucuya `LLM_PROJECT_ROOT` verin veya CLI'da `llm-manager --project-root F:\uygulamalar\hedef` kullanın. Paket entegrasyonunda `project: { root: '/absolute/target' }` seçeneği vardır. Temel kaynak taraması yerleşiktir. Hedef uygulama için isteğe bağlı Graphify ilişki analizi, **Proje bilgileri** panelinden seçilir; kurulum rehberi aynı yerdedir. Plan ve değişiklik görevleri için OpenCode ayrıca kurulmalıdır; `LLM_OPENCODE_PATH` ile yolu seçebilirsiniz. [Bağlama ve kullanım](docs/KULLANICI_KILAVUZU.md#proje-asistanı).

Express helper hedef `.env` dosyasındaki proje kökünü okur; göreli yol helper klasörüne göredir. `backend/llm.js` için `LLM_PROJECT_ROOT=..` uygulama kökünü bağlar. Kök tanımlı değilse **Projeyi tara** pasiftir; genel bakış ilk yerel taramadan sonra oluşur.

Kaynaklı sohbette güncel README/kılavuz ve bileşen manifestleri önceliklidir. Arşiv ve planlar tarihçe/plan sorularında, rollerini belirten uyarılarla dahil edilir. Özel belge rolleri sunucuda `project.documentRoles` ile ayarlanır; bu eşleme gizlilik filtresini aşamaz.
Genel tanıtımda frontend/backend/yetki/entegrasyon/veritabanı kaynaklarına pay ayrılır; aynı taramadan üretilmiş dosya/satır kanıtlı mimari özeti modele aktarılır. Genel soru sözcükleri rastgele alt dize eşleşmeleri üretmez. Özet ve kaynaklar toplam 40.000 karakterle sınırlıdır; statik bulgular başarılı çalışma/test garantisi değildir.
Graphify seçilirse aynı bütçeye en fazla 20 dosya/satır referanslı ilişki ve sınırlı kaynak satırları eklenir. Ek dosya veya ilişki kanıtı yoksa `graphUsed`/`graphContributed` false olur. Sohbet ve geliştirme görevleri aynı seçim/revizyon kontrolünü kullanır; ilişki izi Yanıt ayrıntılarında ve şifreli geçmişte korunur.
Gizlilik filtresi boş Vue reactive ifadelerini parola sanmaz; gerçek literal kimlik bilgileri çalışma kopyasına alınmaz. **Dışlanan kaynaklar ve nedenleri** paneli güvenli göreli yollar ve neden kodlarını gösterir; ham sır içermez. Özet sınırlıdır ve dizinler tek kayıtla gösterilebilir; DB URL örnekleri güvenle ayrıştırılamazsa dosya dışlanır.

Görevler geçici kaynak kopyasında hazırlanır; hedef dosyalar ayrı onayla değişir. Sohbetler ve iş çıktısı özetleri mevcut anahtarla şifreli kalıcı kaydedilir; kayıtlı sohbet açılıp sürdürülebilir. Canlı diff/geri alma kayıtları sunucu belleğindedir; kapanışta silinir. Geçmiş kaydı dosyaları otomatik uygulamaz. Kaynak taraması gerçek veritabanına bağlanmaz.

## Belgeler

- [Tek kullanıcı kılavuzu](docs/KULLANICI_KILAVUZU.md): başlangıç, arayüz, entegrasyon, API, güvenlik, yedekleme, dağıtım ve geliştirme.
- [Değişiklikler, doğrulanmış durum ve belge özetleri](docs/KULLANICI_KILAVUZU.md#geçmiş-ve-belge-özetleri).

**Yedekleme:** `data/llm-profiles.json`, varsa `data/llm-profiles.json.assistant.enc` ve `data/llm-encryption.key` dosyalarını birlikte saklayın. Anahtar kaybolursa profiller ve sohbet geçmişi çözülemez. Özel profil yolu kullanılıyorsa geçmiş dosyası `<profil-dosyası>.assistant.enc` konumundadır.

Anahtar döndürme profil ve sohbet geçmişini birlikte yeniden şifreler. Önce sunucuyu durdurun; açık/env anahtarını güncelleyip yeniden başlatın. [Yedekleme ve kurtarma](docs/KULLANICI_KILAVUZU.md#yedekleme-ve-sorun-giderme).

[MIT Lisansı](LICENSE)
