# YH2 FAZ 0 kabul denetimi — 2026-10-25

Kapsam: YOL_HARITASI_2_VAAT_GERCEK_UYUMU içindeki G03 → G02 → G04/G05 → G06 → G01/G24 → G07. Yol haritaları, uygulama planı, önceki denetim, katalog kaynak kaydı ve doğrulama betiği okundu. Çalışma başlangıcında çok sayıda commitlenmemiş YH1 uygulaması vardı; bunlar korundu. Kullanıcı mevcut YH1 değişikliklerinin de commitlere dahil edilmesini onayladı.

## FAZ 0 madde ve kabul kanıtları

| Kart | Uygulama ve kabul kanıtı |
|---|---|
| G03 | Express ve core `chatAccess:false` için 404 `CHAT_DISABLED` verir; sağlayıcı çağrılmaz. Admin olmayan sohbet kimliği `admin` modunda 403, `authenticated` modunda 200 alır. `tests/phase0-security.test.js`, `tests/plugin.test.js`, doğrulama betiği. |
| G02 | Ortak SHA-256/timingSafeEqual Basic doğrulama; Web sayfa/betik/API auth koruması; yapılandırma yoksa 500 `AUTH_NOT_CONFIGURED` ve bir uyarı; anonim yazma 401 + Basic challenge, admin yazma 201. Async authorize/null ve çağrı düzeyi override testleri mevcut. `tests/auth-policy.test.js`, `tests/phase0-security.test.js`. Next/Nuxt/SvelteKit yardımcıları parolayı ortamdan okur. |
| G04 | Rastgele 18 bayt parola, sır içermeyen yardımcılar ve npm script'i, CLI geçmiş uyarısı. Env güncelleme satır sonunu/yorumları korur; dosya modu 0600 istenir. `tests/init-security.test.js`, `tests/env-roundtrip.test.js`, `tests/phase0-security.test.js`. Otomatik onaylı kurulumun loglarında parola/token yoktur. |
| G05 | `.gitignore`: `data/`, `.env`, `.env.local`, `*.key`; tekrar çağrı çoğaltmaz. `secrets_ignored` doğrulaması var. Sır taraması Express ESM/CJS, SPA, Next, Nuxt, SvelteKit, Electron, .NET, Python ve Tauri yardımcılarında çalışır. `tests/init-security.test.js`, `tests/init-wizard.test.js`. |
| G06 | Wildcard yalnız yapılandırılmış sohbet rotasında; credentials yok; yönetim rotalarına CORS verilmez. Özel API yolu ve sondaki slash test edildi. Açık origin izinli/izinsiz davranışı `tests/architecture.test.js` içinde. Sihirbaz yalnız Vite algılanırsa 5173 seçer; diğer projelerde origin sorar, `-y` ile adres yoksa CORS kapalıdır. Açık boş liste eski env iznini siler; `*`, path/credential içeren ve geçersiz origin init sırasında reddedilir. `tests/phase0-security.test.js`, `src/init/origins.js`. |
| G01 / G24 | Basic admin ve yalnız POST /chat yetkili Bearer ayrımı iki adaptörde de var. Geçerli sohbet belirteci yönetim sayfası/betiği/API için 403 alır. Bearer ile gönderilen profil/token/süre override alanları varsayılan politikada yok sayılır. SPA/Tauri yalnız VITE sohbet belirteci, Python/.NET yalnız ortamdan Bearer kullanır. Rastgele 24 bayt token `.env`/`.env.local` içinde tutulur. Kimlik tabloları README/ENTEGRASYON içinde. `tests/auth-policy.test.js`, `tests/phase0-security.test.js`, `tests/runtime-controls.test.js`, `tests/init-security.test.js`. |
| G07 | Scoped ad ve 2.0.0 metaverisi, public publishConfig, değişmeyen CLI bin'i; şablon adı package.json kaynağından gelir. Gerçek geçici `npm install <yerel-depo> --offline --ignore-scripts --no-audit --no-fund` sonrası scoped `/core` importu `function`, kurulu CLI `2.0.0` döner ve yerel bin oluşur. README başı/CLI yardımında ad uyarısı, iki belgede geçiş adımları. `tests/package-identity.test.js`, `tests/package-metadata.test.js`. |

## Bu denetimde düzeltilen açıklar

- Express sayfa/betik koruması geçerli sohbet Bearer belirtecini Basic girişine yönlendirip 401 veriyordu; şimdi sözleşmeye uygun 403 verir.
- Vite dışı SPA/Tauri için 5173 izni varsayılıyordu; açık origin seçimine ve etkileşimsiz kapalı varsayılana geçildi.
- Standalone CORS özel `apiPath` ayarını izlemiyordu; yalnız gerçek sohbet yolu için başlık üretir.
- Bağımsız incelemede bulunan boş origin seçiminin eski env iznini koruması regresyon testiyle düzeltildi.
- CommonJS/Tauri sır kontrolleri, otomatik onaylı kurulum logları ve gerçek scoped paket kurulum kanıtı eklendi. Paket adı uyarısı görünür yere taşındı.

İlk iki sorun ve özel API yolu için testlerin önce beklenen 401/403, 5173/boş değer ve wildcard/yönetim başlığı farklarıyla başarısız olduğu görüldü. İncelemeden gelen boş origin regresyonu da önce eski izin kaldığı için başarısız oldu, sonra düzeltildi.

## Diğer YH2 görevlerinin kontrolü

| Kartlar | Bu turdaki durum |
|---|---|
| G08, G09, G10, G11, G12, G13, G14, G15, G16, G17, G18, G19, G20, G21 | FAZ 1 envanteri ve önceki YH1 kanıtları incelendi. Uygulama/testlerin önemli kısmı mevcut; FAZ 0 kapsamındaki bu tur, bu kartların bütün numaralı koşullarını yeniden kapatmaz. Sonraki iş ayrı FAZ 1 kabul denetimidir. G08 ve G11 doğrulama betiğinde ayrıca geçti. |
| G22, G23, G25, G26 | FAZ 2 envanteri ve mevcut bağımsızlık/katalog/belge/Express5 çalışması görüldü. Bu kartlara topluca tamamlandı işareti verilmedi. |

## Doğrulama

- Başlangıç: `npm test` 182/182 geçti.
- `node docs/roadmap/dogrulama.mjs`: 1 → 404 `CHAT_DISABLED`; 2a → gerçek profil listesi; 2b → 409; 3 → 201; 4 → 500 `AUTH_NOT_CONFIGURED`.
- Hedefli son FAZ 0 güvenlik testleri: 10/10 geçti.
- Son tam `npm test`: 195/195 geçti; başarısız, iptal veya atlanan test yok.
- `npm run lint`, `npm run typecheck`, `npm run format:check`: exit 0. İlk format kontrolü testler sürerken geçici dosya silinmesine denk geldi; testler bittikten sonra yeniden çalıştırılıp geçti.
- Gerçek yerel HTTP/child-process/npm kurulum kontrolleri sandbox dışında çalıştırıldı; ağdan paket indirilmedi.

## Sınırlar ve belge yorumları

- G07'nin “eşleşme olmasın” regex'i yeni scoped importu da eşleştiriyor; kabul semantik olarak eski **unscoped** import/require yollarının kaldırılmasıdır. Doğru scoped örnekler silinmedi.
- `package.json` zaten 2.0.0 idi; `release:major` tekrar çalıştırılıp yanlışlıkla 3.0.0 yapılmadı. Henüz doğrulanmamış uzak etiket varmış gibi kurulum örneği eklenmedi. Yayın, etiket ve push yapılmaz.
- Windows ACL güvenliği yalnız POSIX 0600 bayrağından çıkarılamaz; README/entegrasyon kılavuzundaki Windows notu geçerlidir.
- Mevcut YH1 Docker/uzak CI/framework build sınırları bu turda kaldırılmış sayılmaz; önceki denetim raporuna bakın. Katalog resmî kaynakları yeniden ağdan denetlenmedi; bu tur katalog değiştirilmedi.
