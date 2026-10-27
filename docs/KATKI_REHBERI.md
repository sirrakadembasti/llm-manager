# Katkı rehberi

Node.js 22.12+ kullanın. Çekirdek uygulama çatısından bağımsız kalır; ana uygulamaya özel varsayım eklemeyin.

## Sır sızıntısını önleme

API/şifreleme anahtarları, yönetici parolası, istem ve cevap içeriği günlüklere veya istemci paketine yazılmaz. İç profilleri HTTP veri nesnesi olarak döndürmeyin; günlük nesnelerini `redact()` ile maskeleyin.

## Kalite doğrulama komutları

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm audit --omit=dev
```

Biçimlendirme: `npm run format`. Hata düzeltmesi/özellik için önce davranışı gösteren test yazın. Seri koşuda Node seçeneklerini dosya yollarından önce verin:

```sh
node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js
```

## Standart commit biçimi

Bir görev bir commit: `feat`, `fix`, `docs`, `test`, `refactor` veya `chore`; kısa ve amaca uygun başlık kullanın. Örnek: `fix(store): Windows yeniden adlandırmasını tekrarla`. Kırıcı değişikliği açıkça belirtin.

Davranış/API değişirse ilgili README, tipler ve kılavuzları güncelleyin. Her katkıda değişiklik günlüğünün `[Yayımlanmamış]` bölümü ve ilgili yol haritası kaydı güncel kalır. Yeni çalışma zamanı bağımlılığı eklemeyin; zorunlu değişikliği gerekçelendirin. Kod dosyası taşırken eski yolu bir uyumluluk sürümü boyunca yeniden dışa aktarımla koruyun.

Değişiklik isteğinde sorun, çözüm, test sonucu ve sınırları yazın. Testleri geçen commit yayın veya uzak depoya gönderme yetkisi değildir. Görev/durum kaydı: [tek yol haritası](roadmap/YOL_HARITASI.md).

## Geliştirme sınırları

- Kullanıcının mevcut değişikliklerini koruyun. Yayın, uzak depoya gönderme ve sürüm artırma ayrıca yetki ister.
- Dosya deposu asenkrondur; revizyon ve atomik yazma korunur. Profil ile anahtarı birlikte yedekleyin.
- `ask()`/`handle()` güvenilir ana uygulama API'leridir; HTTP kimlik ve yetkisini adaptör uygular.
- Akışta yeniden deneme/yedek profile geçiş yalnız ilk çıktıdan önce çalışır. Tüm denemeler tek zaman bütçesini paylaşır; tek tamamlanma/kullanım kaydı üretilir. Gizli düşünce son yanıta eklenmez.
- Test/SDK kontrolleri kalıcı kullanıcı ortamını değiştirmemelidir; .NET kontrollerinde `DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=false` korunur.

Teknik kararlar ve tamamlanma kanıtları [yol haritasında](roadmap/YOL_HARITASI.md) tutulur. Ayrı bir `GEMINI.md` proje hafızası kullanılmaz.
