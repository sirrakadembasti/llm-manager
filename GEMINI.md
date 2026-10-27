# Proje hafızası

## Amaç ve sabit kararlar

- Bağımsız LLM profil yönetimi: Node.js **>=22.12**, optional Express **4.19.2+/5.x**; Docker/veritabanı zorunlu değil.
- Paket `@sirrakadembasti/llm-manager`; CLI `llm-manager`. Yerel **2.0.0 / Unreleased**, yayımlanmış sürüm değildir. npm'deki çıplak paket başka projedir.
- Core framework bağımsız; init ayrı alt yol. Eski taşınan yollar re-export ile korunur. Yeni runtime bağımlılığı eklenmez; mevcut bağımlılık `undici`.
- Tek görev/durum kaydı: [docs/roadmap/YOL_HARITASI.md](docs/roadmap/YOL_HARITASI.md). Tarihsel ayrıntılar Git geçmişindedir.

## Çalışma kuralları

- Önce test, sonra düzeltme; `npm test`, lint, typecheck, format kontrolleri geçmeli. Bir görev bir commit; Conventional Commits.
- Değişiklikle ilgili yorumları koru; CHANGELOG `[Unreleased]`, README/tipler ve bu dosyayı güncelle.
- Anahtar/parola içeren iç profili tarayıcıya, listeye veya loga verme. İstem/cevap loglanmaz; `logContent: false` sabit.
- HTTP adaptörü kimlik/yetkiyi uygular. `ask()` ve doğrudan `handle()` güvenilir host API'sidir; bu uyumluluğu bozma.
- Bearer yalnız sohbet; yönetim admin ister. Varsayılan override yetkisi admin, CORS açık origin listesi. Tarayıcıdaki her belirteç herkese açıktır.
- Dosya deposu async; özel store `T | Promise<T>`. Revizyon denetimi ve yazma atomik; anahtar+profil birlikte yedeklenir. NFS/SMB garantisi yok.
- Akış retry/fallback yalnız ilk çıktıdan önce; tek toplam bütçe, bir mantıksal kullanım/tamamlanma kaydı. Reasoning son yanıta katılmaz.
- İşletim sistemi/SDK kontrolleri kalıcı kullanıcı ortamını değiştirmemeli. .NET için `DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=false` korunur.
- Kullanıcının mevcut değişikliklerini koru; açık yetki olmadan yayın, push veya sürüm artırma yapma.

## Güncel durum — 2026-10-27

YH1'in 32 kartı ve YH2'nin G01–G26 işleri tamamlandı; YH2 yalnız FAZ 0/1/2 içerir. Ürün kapanışı `7297204`, belge kapanışı `46551a1`; bağımsız incelemeler onaylı.

Son kod düzeltmesi `6efbe32`: .NET kontrolünün geçici araç yollarını kullanıcı PATH'ine eklemesi engellendi. Bu makinede 106 eski test girdisi yedeklenerek temizlendi; `npm start` gerçek health/auth HTTP kabulünü geçti. Son seri paket **388/388**, sıfır hata/atlama/iptal; standart npm lint/typecheck/format yeşil. Kullanıcı PATH'i test öncesi/sonrası sabit kaldı.

Son kapsam ölçümü önceki ürün başındadır: **386/386**, src **%94,78 satır / %87,70 dal**; beş temel modül ≥%85 satır. Bunu 388 testlik koşunun yeni kapsam ölçümü sayma. Paket denetimi 89 dosya/yasak içerik 0, üretim audit 0 o kapanışın kanıtıdır; yeni iddia için yeniden doğrula.

Docker imajı, uzak OS/Node CI, native POSIX/Windows konsol sinyalleri, canlı ücretli sağlayıcı ve pozitif proxy CONNECT çalıştırılmadı. Eski .NET 4.0 referanslarıyla derleme, kurulu CLR 4.8.1 üzerinde çalıştırıldı; özgün .NET 4.0 runtime kanıtı değildir.

Belge sadeleştirmesi tamamlandı: kök/kılavuz metinleri kısaltıldı; 10 roadmap belgesi tek dosyada birleştirildi. 58 kimlik ve 37 yerel bağlantı sağlam; 13 belge/geçiş testi ve 388/388 tam paket (271215 ms) geçti. Lint/typecheck/format ve bağımsız inceleme onaylı; paket 80 dosya, yasak içerik yok. Çalışma zamanı değişmedi; eski ayrıntılar Git geçmişindedir.
