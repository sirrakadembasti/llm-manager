# YH2 FAZ 1 uygulama ve kabul denetimi — 2026-10-25

Durum: FAZ 1 tamamlandı. Başlangıç commit'i `ec55e4f`; FAZ 0 kapanışı ve 195 test korunur. On iki kart mevcut uygulamayla tek tek karşılaştırıldı; eksikler görev bazlı test, düzeltme ve commitlerle kapatıldı. Görev incelemeleri ve genel incelemenin düzeltme tekrarı onaylıdır. Son kapsam ölçümlü tam paket 276/276 geçti. Uzak yayın/push bu çalışmanın kapsamında değildir.

## Görev takibi

| Sıra | Kart | Durum / kanıt |
|---|---|---|
| 1 | G08 — async host depo | Tamam: `38bc33d`, async Map örneği, arayüz tablosu, async wrapper ve Map için CRUD/test/chat; 4 hedefli ve 199 tam test geçti. Bağımsız spec/kalite incelemesi onayladı. |
| 2 | G11 — auth sonrası JSON ayrıştırıcı | Tamam: `5549fca`, altı gerçek Express/HTTP kabul testi; 6 hedefli test ve ikinci tam turda 205/205 geçti. Bağımsız spec/kalite incelemesi onayladı. |
| 3 | G10 — senkron CommonJS | Tamam: `6f4baa3`, yeni child-process CJS graph/senkron hata/yeniden kurulum testi; async mutasyonla regresyon gücü doğrulandı. 10 hedefli / 222 tam test; bağımsız spec/kalite onayı. |
| 4 | G09 — sunucu/istemci framework sınırı | Tamam: `4e6a657`, zorunlu action/ask doğrulaması, koşullu server-only, Türkçe fail-closed action; yorum sonrası client koruması ve gerçek yöneticiyle Svelte auth/delegasyon testleri. 7 yeni G09 / 229 tam test; bağımsız spec/kalite onayı. Üçüncü taraf server-only paketinin kendi runtime davranışı ayrıca çalıştırılmadı. |
| 5 | G12 — transaction rollback | Tamam: `98ce5fb`, 5 SHA-256/ağaç/izin regresyonu; kullanıcı reddi, interaktif ve otomatik başarısızlık, binary/CRLF ve mevcut boş klasörler. 23 hedefli / 234 tam test; bağımsız spec/kalite onayı. Önkoşul host kurulumu journal dışında korunur. |
| 6 | G17 — güvenli proje algılama | Tamam: `a383020`, Electron TS adayları, açık `.js` yolları, Türkçe belirsizlik hataları ve CLI yardım düzeltmesi. Karma Node/.NET seçimleri gerçek helper dosyalarıyla, iki TS yolu NodeNext derleyicisiyle doğrulandı. 23 hedefli / 239 tam test; bağımsız spec/kalite onayı. Electron GUI çalıştırılmadı. |
| 7 | G20 — host paket kurulumu | Tamam: `b57eaf3`, fiziksel SPA/Tauri host kontrolü, sürümlü kurulum sorusu ve kurulum sonrası yeniden doğrulama. İsteğe bağlı Express modeli korunur; önbellekten çalışan komut host sunucusunu yükler. Paketsiz statik istemci sunucu başlatmaz. 247 tam / son izole fixture ile 8 hedefli test; bağımsız spec/kalite onayı. |
| 8 | G21 — reasoning kısa bağlantı testi | Tamam: `0608beb`, length+boş içerik ve stop+yalnız reasoning senaryoları ayrıldı. Gerçek dosya deposunda quick passed korunur; sohbet kesilme/boş yanıtı reddeder, düşünme içeriği sızmaz. 7 hedefli / 248 tam test; iki bağımsız mutasyon ve spec/kalite onayı. Mevcut runtime korundu. |
| 9 | G14 — .NET hedefleri | Tamam: `8cdc751` + `a99b385`, hedef/JSON hataları, modern C# 7.3 ve HTTP kanıtı. Genel incelemenin v4.0/net40 API ve SDK net48 referans açıkları kapatıldı. Gerçek 2010 .NET 4.0 referanslarıyla C# 4 derlemesi; CLR 4.8.1 üzerinde HTTP/başlık ve gövde iptali. Referanslar Compile eklenmesinden bağımsız, SDK örtük kaynakları ve tam rollback korunur. Son 30 hedefli / 276 tam test; scoped genel tekrar incelemesi onaylı. SDK net48 hedef paketi yok; net48 build ve özgün 4.0 runtime çalıştırılması iddia edilmez. |
| 10 | G15/G16 — Tauri/Electron | Tamam: `1f90c05`, Electron parolası yalnız yerel nonproxy Basic challenge'a verilir; dış gezinme/yönlendirme/popup engellenir. Güncel ve eski gezinme olayları, tembel userData, IPC filtresi ve preload korunması çalıştırılan şablon testleriyle doğrulandı. README Tauri HTTP modelini ayırır. 29 hedefli / 256 tam test; bağımsız spec/kalite onayı. Paketli Electron/Tauri E2E çalıştırılmadı. |
| 11 | G19 — Python/C# istemci ve sürekli servis | Tamam: `d215ef1`, gerçek Python/HTTP 401 testinde Türkçe LLMError ve code/status korunur; bozuk/nonobject hata JSON'u güvenle karşılanır. Parser/araç yokluğu doğrulandı; dağıtım önkoşulları hizalandı. 10 hedefli / seri 258 tam test; bağımsız spec/kalite onayı. Gerçek servis kurulumu yapılmadı; C# kanıtı G14'tedir. |
| 12 | G18 — Next özel koşulları | Tamam: `9be5e7a` + `6167735`, gerçek config dizileri ve yorum/string ayrımı, güvenli manuel fallback, journal/onay, hedefli üst layout Edge uyarıları. İncelemede regex literal açığı bulundu; çalıştırılan fixture ile RED/GREEN ve konservatif fallback düzeltildi. Son 10 G18 / 268 tam test; scoped tekrar incelemesi onayladı. Gerçek Next/Vercel dağıtımı çalıştırılmadı. |

G13 karşılaştırma tablosunda yer alır; ayrı görev kartı yoktur. Bu fazda TypeScript, modern C# ve Python gerçek araçlarla sınandı; kurulu olmayan framework derleyicileri ve proje bağlamı gerektiren host C# kontrolleri derlenmiş sayılmaz.

## Ortak doğrulama bulgusu

G11'in ilk tam turunda mevcut 100 profil/iki child-process testinde Windows `EPERM` kilit açma hatası görüldü; ilgili dosya tek başına 7/7, tam tekrar 205/205 geçti. `2296f99` ile yalnız Windows EPERM/EACCES için sınırlı retry eklendi. Kalıcı hata özgün hata nesnesiyle döner, mevcut kilit sahibinin dosyası korunur; deadline ve diğer platformlar test edildi. RED aşamasında 8 beklenen başarısızlık, GREEN aşamasında 27 hedefli / 221 tam test geçti. Bağımsız spec/kalite incelemesi onayladı. Hatanın işletim sistemi içindeki kesin nedeni bu logdan çıkarılmadı.

G19'un ilk paralel tam turunda 257/258 geçti; mevcut Express 5 host başlangıcı 60 saniyede timeout verdi. Aynı test tek başına 10 saniyede 1/1, kod/timeout değiştirilmeden seri tam tekrar 258/258 geçti. Sonraki tam kontroller dış derleyici/kurulum süreçlerinin yükünü sınırlamak için `--test-concurrency=1` ile yürütülür. Bu gözlemler tek başına işletim sistemi düzeyindeki kesin nedeni kanıtlamaz.

G18 doğrulamasında da CJS, C# derleme, Express 5, yerel/offline npm ve TypeScript alt süreçlerinde aralıklı timeout/temizleme hataları kaydedildi. Başarısız senaryolar tekil çalıştırmada geçti; doğrulanmış sahipsiz test süreci bulunmadı ve süreç sonlandırılmadı. Test timeout'ları veya ilgili ürün kodu bu gözlemler nedeniyle değiştirilmedi. Sessiz seri tam turlar önce 267/267, regex düzeltmesinden sonra 268/268 geçti. Yerel/offline G07 izolasyonunu reddeden otomatik onay incelemesi, mevcut `--offline --ignore-scripts --no-audit --no-fund` kaynak kanıtı sunulunca aynı komuta izin verdi.

## Nihai kontroller

Windows, Node `v22.23.2`, yerel paket `2.0.0` üzerinde, ürün kodu `a99b385` durumundayken çalıştırıldı:

| Kontrol | Sonuç |
|---|---|
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run format:check` | Exit 0 |
| `npm run test:coverage -- --test-concurrency=1` | Exit 0; 276/276, sıfır hata/iptal/atlama/todo; 96,5 saniye |
| `src` kapsamı | %92,94 satır, %85,13 dal, %91,67 fonksiyon; %80/%70 eşikleri geçti |
| `node docs/roadmap/dogrulama.mjs` | Exit 0; 1: 404 `CHAT_DISABLED`, 2a: profil listesi, 2b: 409 `ACTIVE_PROFILE_MISSING`, 3: 201, 4: 500 |

Son tam paket, Express 4 ESM/CJS ve Express 5 gerçek hostlarında kimlik doğrulamalı `/llm` 200 / profil POST 201 kabul testlerini, Promise tabanlı dosya deposunu ve async host/Map senaryolarını birlikte içerir. Sonrasında yalnız kapanış belgeleri güncellendi; ürün/test kaynakları değiştirilmedi.

Görev bazlı spec/kalite kapılarından sonra `ec55e4f..6167735` aralığı genel incelemeye alındı. İki G14 P2 bulgusu tek dalgada `a99b385` ile giderildi; `6167735..a99b385` scoped tekrar incelemesinde ikisi de **ADDRESSED**, yeni Critical/Important yok, kapanışa hazır sonucu verildi. G18'in regex literal bulgusu da `6167735` ile düzeltilip ayrı scoped incelemede onaylandı. Express parser testindeki tüketilmeyen başarılı response body gözlemi engelleyici değildir; fixture bağlantıları kapatır, dosyaya sonraki dokunuşa ertelenmiştir.

Senkron CommonJS için kırılgan satır başı `await` regex'i yerine gerçek geçişli ESM grafiğini `require()` eden ve senkron hata/yeniden denemeyi sınayan test kullanıldı. G21'de mevcut `raw` sözleşmesi içerik/finishReason/usage ve string uyumluluğunu zaten sağladığından yalnız isim için ikinci bir `callProvider` katmanı eklenmedi; bağımsız mutasyonlar kabul dallarını doğruladı.

## Doğrulama sınırları

- Modern .NET istemcisi gerçek çevrimdışı SDK derlemesi ve HTTP ile sınandı. Eski istemci, yalnız .NET 4.0 referanslarıyla `/noconfig /nostdlib+ /langversion:4` kullanılarak derlendi; yürütme kurulu CLR 4.8.1 üzerindeydi. Özgün/yamasız .NET 4.0 runtime ve SDK net48 build çalıştırılmadı; makinede net48 hedef paketi yoktur. 330 saniyenin tamamı beklenmedi; yapılandırma ve gerçek bekleyen başlık/gövde iptali test edildi. Eski TPL yolu ağ sırasında worker kullanır.
- Electron, kontrollü Electron API taklidiyle üretilen modül çalıştırılarak sınandı; paketli GUI/ağ E2E ve Tauri/Rust uygulaması çalıştırılmadı. Next config fixture'ları çalıştırıldı; gerçek Next/Vercel dağıtımı yapılmadı. Koşullu üçüncü taraf `server-only` paketinin iç davranışı ayrıca çalıştırılmadı.
- Python gerçek yerel HTTP ve parser ile sınandı. PM2/systemd/NSSM/Docker komutları belge/kod düzeyinde denetlendi; gerçek servis kurulumu, Docker build/run veya uzak CI matrisi çalıştırılmadı.
- Host bağımlılığı kurulumu açık bir önkoşuldur ve scaffold journal'ının dışında korunur. Rollback, bu sınırdan sonraki scaffold ağacını/baytlarını/izinlerini geri alır. Windows'ta POSIX izinlerinin tamamı uygulanamaz; gerçek POSIX izin restorasyonu bu oturumda çalıştırılmadı.
- Yerel sürüm zaten 2.0.0 olduğundan `release:major` yeniden çalıştırılmadı. Yayın, uzak tag/push ve FAZ 2 bu kapanışa dahil değildir. Kurulum komutlarının ağdan GitHub sürüm kurulumu bu testlerde denenmedi; mevcut G07 kabul testi yerel/offline kurulumdur.

## Test yürütme notu

G20'nin ilk genişletilmiş test denemesinde eski, her soruya evet diyen iki geçici fixture gerçek npm Express kurulumu başlattı. Test durduruldu; depo package.json/package-lock değişmedi. Sonraki fixture'lar beklenmeyen kurulumları reddeder veya yalnız yerel kontrollü kurulum uygular. Kalan sahipli geçici dizin temizlendi; npm genel önbelleği silinmedi. Son testlerde ağdan kurulum yapılmadı.
