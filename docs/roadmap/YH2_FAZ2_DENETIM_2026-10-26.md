# YH2 FAZ 2 uygulama ve kabul denetimi — 2026-10-26

Durum: FAZ 2 tamamlandı. Başlangıç `d26ef4a`, `codex/yh1-completion` dalı. Dört kart ayrı commitlerle kapatıldı; görev incelemeleri ve genel incelemenin tek düzeltme dalgası onaylıdır. Son kapsam paketi 283/283 geçti. FAZ 1'in 276 testlik kapanışı korunur.

| Kart | Kapsam | Durum |
|---|---|---|
| G22 | Nötr test mesajları, eski seçenekler/purpose uyumu, UI ve README | Tamam: `3b12e17`; 9 hedefli / 278 tam test, iki regresyon mutasyonu ve bağımsız spec/kalite onayı. |
| G23 | Depodaki katalog tarihi ve canlı liste talimatı | Tamam: `1a7623d`; tarih notu gerçek katalog metadatasına bağlandı, RED/GREEN ve 279/279 tam test; bağımsız inceleme onaylı. |
| G25 | Senaryo listeleri, güvenlik/sınırlar, ortam matrisi, Windows izin notu | Tamam: `33a47cb`; üç tabloda aynı on senaryo, her senaryoya dört sınır alanı, RED/GREEN ve 281/281 tam test; bağımsız inceleme onaylı. |
| G26 | Express 4/5 ve peer bağımlılık kanıtı | Tamam: `71cefd8`; gerçek Express 5 auth/JSON HTTP kabul testi, 4/5 hostlarla 4 hedefli / 282 tam test; bağımsız inceleme onaylı. |

Yerel görev commitleri önceki kullanıcı onayıyla oluşturuldu. Yayın, push, sürüm artırma ve başka fazların topluca kapatılması bu çalışmanın kapsamında değildir. Her kart için test ve bağımsız inceleme kapısı, kapanışta tam paket/kalite ve belge kontrolleri uygulandı.

G22'de nötr mesajlar ve `quick/diagnostic/default` davranışı zaten uygulanmıştı. Yeni testler gerçek yönetici rotaları ve özel generate adaptörü üzerinden bunu doğrular; legacy seçenek alanları yalnız sohbet isteğinde açıkça gönderilir, iki tanılama rotasında da adaptöre eklenmedikleri denetlenir. Eski `manager`/`production` amaçları birer uyarıyla eşlenmeye devam eder. Tam kapsam ölçümü 278/278 geçti: %92,94 satır / %85,25 dal. Kabul araması `src public README.md` içinde sonuç vermedi. Etkin profil metni ve tiplerdeki geriye uyum ayrıca kaynakta kontrol edildi.

Test yürütme notu: Node seçenekleri dosya yollarından önce verilir (`node --test --test-concurrency=1 ...`). npm betiğine dosya yollarından sonra eklenen seçeneklerin filtreleme/serileştirme yaptığı varsayılmadı. Yanlış kapsamla sandbox içinde başlayan ilk tur HTTP/junction/rename izin hataları verdi ve sahipli oturum açıkça durduruldu; aynı kodun doğru komutla izinli tam çalıştırması geçti. Zaman aşımı artırılmadı.

## Kabul kanıtları

- G22: `tests/purpose-compat.test.js` gerçek yönetici rotalarındaki nötr mesajları, desteklenen adaptör seçeneklerini ve iki kez çağrılan eski amaç başına tek uyarıyı sınar. Uyarı guard'ının kaldırılması ve eski alanın adaptöre geri eklenmesi testleri başarısız yaptı; kaynaklar geri alındı. HTML ile tr/en metinleri hizalıdır. Kabul araması sonuç vermedi; uyumluluk alias'ları ve tipleri korunur.
- G23: `tests/catalog-docs.test.js` README ayını gerçek `src/catalog/providers.json#updatedAt` tarihinden türetir ve aynı satırdaki **Modelleri getir** talimatını denetler. Eksik tarih RED, düzeltme GREEN. Katalog yeniden güncellenmiş sayılmaz; depodaki tarih 2026-10-24'tür.
- G25: `tests/integration-docs.test.js` README scaffold listesi, README matrisi ve kılavuz listesinin aynı on senaryo/tip/sırayı kullandığını; iki matrisin tüm hücrelerini, her senaryodaki dört güvenlik alanını ve Windows cümlesini denetler. Eksik matris/uyarı RED, belge düzenlemesi GREEN. Kaynaktaki CLI tipleri ayrıca karşılaştırıldı.
- G26: `tests/integration/express5-errors.test.js` gerçek Express 5 HTTP sunucusunda auth önceliği, 401/400/413 kodları ve request ID tutarlılığını sınar. Ayrıştırıcının auth önüne taşınması RED verdi, geri alınca GREEN. Mevcut Express 4 ESM/CJS ve Express 5 hostlarıyla hedefli 4/4 geçti. README Express 4.19+ ve 5.x ifadesinin yanında gerçek 4.x alt sınırını 4.19.2 olarak belirtir. Express optional peer olarak kaldı.

## Son doğrulama

Node v22.23.2 / Windows / yerel paket 2.0.0; test edilen son ürün/test başı `588c793`:

| Kontrol | Sonuç |
|---|---|
| Tam seri kapsam paketi | 283/283; sıfır hata/iptal/atlama/todo, 155657,4137 ms; exit 0 |
| src kapsamı | %93,03 satır / %85,33 dal / %91,67 fonksiyon; %80/%70 eşikleri geçti |
| Lint / typecheck / format:check | Exit 0 |
| `node docs/roadmap/dogrulama.mjs` | Exit 0; 404 / profil listesi / 409 / 201 / 500 beklenen sonuçlar |
| G22 kabul araması | `src public README.md` içinde eşleşme yok |
| `src types bin examples package.json package-lock.json` | FAZ 2 başlangıcıyla aynı; geçici mutasyon kalmadı |

Tam komut: `node --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include=src/** --test-coverage-lines=80 --test-coverage-branches=70 tests/*.test.js tests/**/*.test.js`. npm test betiğindeki aynı iki dosya kümesi çalıştırıldı. Görev başına tam paketler 278 → 279 → 281 → 282 testle, genel inceleme düzeltmesi ardından 283 testle geçti. Git'in CRLF normalleştirme bildirimleri kayıtlarda korundu; testler ve kalite kontrolleri başarısız sayılmadı.

## Genel inceleme ve düzeltme

`d26ef4a..71cefd8` genel incelemesi bir P2 ve üç P3 bulgusu verdi. Tek düzeltme dalgası `588c793` ile hepsi kapatıldı: otomatik düşünme açıklaması yalnız MiMo için gösterilir, diğer sağlayıcıların düşünme kontrolleri korunur; SPA enjeksiyon hücreleri açık hale getirildi; README'de MiMo quick testi için açık düşünme istisnası belirtildi; görev raporunun legacy girdi kapsamı düzeltildi. `71cefd8..588c793` scoped tekrar incelemesi dört bulguyu **ADDRESSED**, yeni Critical/Important sorun yok olarak değerlendirdi.

Yeni UI regresyonu gerçek HTML çeviri düğümleri ve üretim JavaScript'iyle sağlayıcı geçişlerini, Türkçe/İngilizce sayfa bağlamlarını ve çeviri sonrasında görünürlüğü sınar. RED aşamasında Google seçiliyken yanlış açıklama görünürlüğünü yakaladı. İlk tam koşuda iki eski DOM taklidi yeni `thinking-hint` öğesini içermediği için init erken durdu (281/283); gerçek HTML'deki öğe iki test düzeneğine eklendi, mevcut assertion'lar değiştirilmedi. Etkilenen dosyalar dahil 39/39 hedefli, ardından 283/283 tam paket geçti. Bu, tarayıcı render/E2E kanıtı değildir. Sonrasında yalnız kapanış belgeleri değiştirildi.

## Doğrulama sınırları

Gerçek yerel HTTP, Express 4/5, çevrimdışı .NET referans/SDK ve TypeScript/Python kontrolleri tam pakete dahildir. Paketli Electron/Tauri E2E, gerçek Next/Vercel dağıtımı, Docker build/run, uzak CI ve dış sağlayıcılara canlı ücretli çağrı yapılmadı. Özgün .NET 4.0 runtime ve SDK net48 build sınırları FAZ 1 raporunda korunur. Windows POSIX 0600 erişim sınırı sağlamaz; belge servis hesabına özel konumu açıklar. Her ortama üretim garantisi verilmez; tablolar koşulları ve ayrı süreç gereksinimini belirtir. API, sürüm ve çalışma zamanı bağımlılıkları bu fazda değişmedi.
