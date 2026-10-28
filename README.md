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

Sunucuya `LLM_PROJECT_ROOT` verin veya CLI'da `llm-manager --project-root F:\uygulamalar\hedef` kullanın. Paket entegrasyonunda `project: { root: '/absolute/target' }` seçeneği vardır. OpenCode ayrıca kurulmalıdır; `LLM_OPENCODE_PATH` ile yolu seçebilirsiniz. Graphify isteğe bağlıdır (`LLM_GRAPHIFY_PYTHON`). [Entegrasyon](docs/ENTEGRASYON.md#proje-asistanını-bağlama) ve [kullanım ayrıntıları](docs/KULLANICI_KILAVUZU.md#proje-asistanı-ikinci-sekme).

Görevler geçici kaynak kopyasında hazırlanır; hedef dosyalar ayrı onayla değişir. Geri alma kayıtları sunucu belleğindedir; kapanışta silinir. Kaynak taraması gerçek veritabanına bağlanmaz.

## Belgeler

- [Kullanıcı kılavuzu](docs/KULLANICI_KILAVUZU.md): arayüz, API, ayarlar, güvenlik ve yedekleme.
- [Entegrasyon](docs/ENTEGRASYON.md) · [Dağıtım](docs/DAGITIM.md) · [Teknik kılavuz](docs/TEKNIK_KILAVUZ.md)
- [Yol haritası](docs/roadmap/YOL_HARITASI.md) · [Klasörlerin amacı ve temizlik listesi](docs/KLASORLER.md)
- [Graphify kod haritası](docs/graphify-out/README.md): kaynak ilişkileri ve tarama kapsamı.
- [Değişiklikler](docs/DEGISIKLIKLER.md) · [Katkı](docs/KATKI_REHBERI.md) · [Güvenlik](docs/GUVENLIK.md)

**Yedekleme:** `data/llm-profiles.json` ile `data/llm-encryption.key` dosyalarını birlikte saklayın. Anahtar kaybolursa kayıtlı API anahtarları çözülemez.

[MIT Lisansı](LICENSE)
