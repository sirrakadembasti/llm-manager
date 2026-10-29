# LLM Manager

LLM sağlayıcılarını, modellerini ve API anahtarlarını tek arayüzden yönetin. Profil oluşturun, bağlantıyı test edin ve etkin profille sohbet edin. Bağımsız çalışır veya mevcut uygulamanıza eklenir.

**Gereksinim:** Node.js 22.12+. Docker ve veritabanı zorunlu değildir. Arayüz yalnız Türkçedir.

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

Paket adı `@sirrakadembasti/llm-manager`; npm'deki çıplak `llm-manager` başka bir projedir. Yerel 2.0.0 sürümü henüz **yayımlanmamış** durumundadır.

## Proje Asistanı

İkinci **Proje Asistanı** sekmesi, bağladığınız uygulamanın teknoloji, API, SQL şeması ve dosya ilişkilerini gösterir. Birinci sekmedeki etkin profille kaynaklı sohbet, OpenCode ile plan/değişiklik hazırlama ve onaylı uygulama/geri alma sunar; aynı Türkçe tema kullanılır.

Sohbet çalışma alanı model denemesini de içerir: proje bağlamadan kayıtlı profil seçebilir, sistem talimatı verebilir ve akışlı yanıtı süre/token bilgisiyle sınayabilirsiniz. Kaynaklı sohbet ve geliştirme türleri etkin profili kullanır. Soldaki listeden sohbet açılır/silinir; **Seçili sohbet** alanından başlık, dışa aktarma ve kayıt işlemleri yapılır. Mesajlar geniş dikey merkez alanda, proje bilgileri açılabilen sağ paneldedir. Mobilde **Sohbetler** düğmesi listeyi açar.

Sunucuya `LLM_PROJECT_ROOT` verin veya CLI'da `llm-manager --project-root F:\uygulamalar\hedef` kullanın. Paket entegrasyonunda `project: { root: '/absolute/target' }` seçeneği vardır. Kaynak taraması yerleşiktir; ek analiz aracı kurulmaz. Plan ve değişiklik görevleri için OpenCode ayrıca kurulmalıdır; `LLM_OPENCODE_PATH` ile yolu seçebilirsiniz. [Bağlama ve kullanım](docs/KULLANICI_KILAVUZU.md#proje-asistanı).

Görevler geçici kaynak kopyasında hazırlanır; hedef dosyalar ayrı onayla değişir. Sohbetler ve iş çıktısı özetleri mevcut anahtarla şifreli kalıcı kaydedilir; kayıtlı sohbet açılıp sürdürülebilir. Canlı diff/geri alma kayıtları sunucu belleğindedir; kapanışta silinir. Geçmiş kaydı dosyaları otomatik uygulamaz. Kaynak taraması gerçek veritabanına bağlanmaz.

## Belgeler

- [Tek kullanıcı kılavuzu](docs/KULLANICI_KILAVUZU.md): başlangıç, arayüz, entegrasyon, API, güvenlik, yedekleme, dağıtım ve geliştirme.
- [Değişiklikler, doğrulanmış durum ve belge özetleri](docs/KULLANICI_KILAVUZU.md#geçmiş-ve-belge-özetleri).

**Yedekleme:** `data/llm-profiles.json`, varsa `data/llm-profiles.json.assistant.enc` ve `data/llm-encryption.key` dosyalarını birlikte saklayın. Anahtar kaybolursa profiller ve sohbet geçmişi çözülemez. Özel profil yolu kullanılıyorsa geçmiş dosyası `<profil-dosyası>.assistant.enc` konumundadır.

Anahtar döndürme profil ve sohbet geçmişini birlikte yeniden şifreler. Önce sunucuyu durdurun; açık/env anahtarını güncelleyip yeniden başlatın. [Yedekleme ve kurtarma](docs/KULLANICI_KILAVUZU.md#yedekleme-ve-sorun-giderme).

[MIT Lisansı](LICENSE)
