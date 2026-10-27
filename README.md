# LLM Manager

LLM sağlayıcılarını, modellerini ve API anahtarlarını tek arayüzden yönetin. Profil oluşturun, bağlantıyı test edin ve etkin profille sohbet edin. Bağımsız çalışır veya mevcut uygulamanıza eklenir.

**Gereksinim:** Node.js 22.12+. Docker ve veritabanı zorunlu değildir.

## Başlatma

İndirdiğiniz proje klasöründe PowerShell açın:

```powershell
npm ci
$env:LLM_ADMIN_PASSWORD = 'kendi-guclu-parolaniz'
npm start
```

**[http://127.0.0.1:8010/llm](http://127.0.0.1:8010/llm)** adresini açın. Kullanıcı adı `admin`, parola yukarıda belirlediğiniz değerdir. Durdurmak için **Ctrl+C** kullanın.

Linux/macOS: `npm ci` ardından `LLM_ADMIN_PASSWORD='kendi-guclu-parolaniz' npm start`.

## Uygulamanıza ekleme

Host proje klasöründe:

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

Paket adı `@sirrakadembasti/llm-manager`; npm'deki çıplak `llm-manager` başka bir projedir. Yerel 2.0.0 sürümü henüz **Unreleased** durumundadır.

## Belgeler

- [Kullanıcı kılavuzu](docs/KULLANICI_KILAVUZU.md): arayüz, API, ayarlar, güvenlik ve yedekleme.
- [Entegrasyon](docs/ENTEGRASYON.md) · [Dağıtım](docs/DEPLOY.md) · [English guide](docs/README.en.md)
- [Yol haritası](docs/roadmap/YOL_HARITASI.md) · [Klasörlerin amacı ve temizlik listesi](docs/KLASORLER.md)
- [Değişiklikler](docs/CHANGELOG.md) · [Katkı](docs/CONTRIBUTING.md) · [Güvenlik](docs/SECURITY.md)

**Yedekleme:** `data/llm-profiles.json` ile `data/llm-encryption.key` dosyalarını birlikte saklayın. Anahtar kaybolursa kayıtlı API anahtarları çözülemez.

[MIT Lisansı](LICENSE)
