# Kullanıcı kılavuzu

## Proje Asistanı: ikinci sekme

`LLM Yönetimi` ilk ve varsayılan sekmedir; profil ekleme, düzenleme ve etkinleştirme burada yapılır. Üst başlık ve sekmeler tek ince satırdadır; ana sayfa bağlantısı ve büyük profil özetleri kaldırılmıştır. Etkin profil kendi kartındaki işaretle görülebilir.

`Proje Asistanı` içinde tek sohbet çalışma alanı vardır. Ayrı Playground bu alana taşınmıştır. Soldaki sohbet çerçevesinden yeni konuşma açılır, kayıtlı konuşmaya dönülür veya satırdaki × ile açık onayla silinir. Ortadaki mesaj alanı bağımsız kayar; yazma alanı altta kalır. **Çalışma türü** ve **Kullanılacak profil** sohbetin üst araç çubuğundadır. **Proje bilgileri** düğmesi bağlı proje/etkin model/mimari panelini açar. Mobilde sol liste **Sohbetler** düğmesiyle açılır.

| Çalışma türü | Davranış |
| --- | --- |
| Model denemesi | Proje bağlanmadan da çalışır. İstediğiniz kayıtlı profili seçin; **Yanıt ayarları** altında sistem talimatı ve akış seçeneğini düzenleyin. Proje kaynakları gönderilmez. |
| Kaynaklı sohbet | Etkin profil ve seçilmiş proje kaynaklarıyla çalışır; kaynak paylaşım onayı gerekir. Profil seçimi kilitlenir; kaynak referansları gösterilir. |
| Geliştirme planı | Etkin profille OpenCode kullanır; temiz kaynak kopyasında okuma yapar, hedef dosyalara yazmaz. |
| Değişiklik hazırla | Etkin profille OpenCode kullanır; geçici kopyada hazırlanan farklar ayrı işlem onayıyla hedefe uygulanır. |

Yanıt tarihi, tamamlanma durumu, süre ve sağlayıcı bildiriyorsa token sayısı mesajın **Yanıt ayrıntıları** altında gösterilir. **Enter** mesajı gönderir; **Shift+Enter** yeni satır ekler. Sohbet yanıtı sonrası başarı paneli gösterilmez; bekleme durumu sohbetin üstündeki küçük durum satırında, hatalar mevcut bildirimde görünür. Akış seçeneği model denemesine aittir; kaynaklı sohbetin yanıtı tamamlandığında gösterilir. **Durdur**, model denemesinin bağlantısını veya devam eden proje işlemini iptal eder; kısmi yanıt tamamlanmış sayılmaz. Mod veya profil değiştiğinde kayıtlı mesajlar ekranda kalır; model denemesi ve proje bağlamları birbirine taşınmaz. **+ Yeni sohbet** mevcut kaydı silmeden boş bir çalışma açar. Kaynak kökü sunucu tarafından `LLM_PROJECT_ROOT` veya `project.root` ile bağlanır; tarayıcıdan keyfi dizin açılamaz.

1. İlk sekmede kullanacağınız profili etkinleştirin.
2. İkinci sekmede **Projeyi tara** düğmesine basın. Bu işlem yereldir; manifestleri çalıştırmaz. Teknoloji, API, SQL kolonları ve kaynak ilişkileri dosya/satır kanıtlarıyla gösterilir. Statik analizin bulamadığı dinamik ilişkiler olabilir.
3. Kaynak aktarımı kutusunu okuyup onaylayın. Sohbette seçilmiş parçalar; OpenCode görevlerinde temiz kaynak kopyasından okunan dosyalar etkin sağlayıcıya gönderilir. Sır taraması bir algılayıcıdır; paylaşmadan önce kaynaklarınızın uygunluğunu değerlendirin.
4. **Kaynaklı sohbet** ile mimariyi sorun. **Geliştirme planı** kaynaklarda yazma izni vermez. **Değişiklik hazırla** ayrı geçici kopyada çalışır; hedefi doğrudan düzenlemez.
5. Önce/sonra dosyalarını inceleyin, işlem onay kutusunu işaretleyin ve farkı uygulayın. Onay her işlemden sonra sıfırlanır. Dosya sürümü değişmişse uygulama/geri alma `PROJECT_CONFLICT` ile durur; yeniden görev hazırlayın.
6. Hostun tanımladığı doğrulama komutunu ayrıca onaylayın. Gerçek çıkış kodu gösterilir; bağımlılık veya servis bulunamaması başarısız sonuçtur. Komut geçici kopyada çalışır; `node_modules`, veriler ve sırlar kopyalanmaz. Otomatik paket kurulumu yapılmaz.

**Geri alma kaydı yalnız sunucu belleğindedir.** Sayfa yenilendiğinde sunucu açık kaldıysa görev seçicisinden yeniden açılabilir. Sunucu kapanırsa veya **Görev kaydını kapat** seçilirse uygulanmış dosyalar kalır, oturumun geri alma kaydı silinir. En fazla 10 görev saklanır. Sohbet geçmişi ve iş çıktısı özeti aşağıdaki kalıcı kayıt sisteminde saklanır; bu kayıt canlı geri alma yetkisi sağlamaz.

`.env*`, anahtarlar, `data`, bağlantılı dizinler, ikili dosyalar ve üretilmiş içerikler dışlanır; Git ignore kuralları uygulanır. Varsayılan sınırlar: 2500 dosya, dosya başına 256 KiB, toplam 4 MiB. Sınırlı taramayla sohbet yapılabilir; dosya değiştirme görevi hazırlanamaz. Canlı veritabanı bağlantısı ve migration çalıştırma bu özelliğin parçası değildir; yeni migration dosyası hazırlanabilir.

OpenCode eksikse model denemesi ve kaynak tarama/sohbet çalışır, plan ve değişiklik görevi hata verir. Graphify isteğe bağlıdır; eksik veya başarısızsa temel kaynak analizi kullanılabilir. **Durdur** devam eden tarama/sohbet/motor/komut işlemini durdurur.

Node.js **22.12+** için sağlayıcı, profil ve API anahtarı yönetimi. Bağımsız sunucu veya uygulama eklentisi olarak çalışır; Docker ve veritabanı zorunlu değildir.

Paket adı **`@sirrakadembasti/llm-manager`**, CLI adı `llm-manager`. npm'deki çıplak `llm-manager` başka bir projedir. Yerel sürüm **2.0.0 / yayımlanmamış**; bu, npm yayını veya yayımlanmış Git etiketi anlamına gelmez.

[Teknik kılavuz](TEKNIK_KILAVUZ.md) · [Başlangıç](../README.md) · [Entegrasyon](ENTEGRASYON.md) · [Dağıtım](DAGITIM.md) · [Yol haritası](roadmap/YOL_HARITASI.md)

İçindekiler: [Başlatma](#hızlı-başlangıç) · [Entegrasyon](#uygulamaya-ekleme) · [Arayüz](#arayüzü-kullanma) · [API](#api-kullanımı) · [Güvenlik](#kimlik-ve-güvenlik) · [Yedekleme](#veri-yedek-ve-işletim) · [2.0 geçişi](#20-geçişi-ve-alt-yollar)


### Kayıtlı sohbetler ve iş çıktıları

Soldaki **Sohbetler** listesinden eski konuşmayı açıp devam edebilirsiniz. **+ Yeni sohbet** eski kaydı silmeden boş konuşma açar. Her satırdaki × yalnız o kaydı onayla siler. Soldaki sohbet listesinin altındaki **Seçili sohbet** alanında başlık kaydetme, JSON dışa aktarma, etkin kaydı silme ve kaydı yeniden deneme vardır. Gönderilen soru önce kaydedilir; yanıt tamamlandıktan veya durdurulduktan sonra durumuyla birlikte tekrar kaydedilir. **Kaydedildi** yazısını kontrol edin. Sayfa/bağlantı yanıt sürerken kapanırsa kayıt tamamlanmamış görünür; otomatik yeniden istek gönderilmez. Akışın son kayıttan sonra gelen parçaları tarayıcı kapanınca kaybolabilir. Durdurulmuş veya başarısız yanıtlar sonraki model bağlamına alınmaz.

Varsayılan dosya deposu mesajları ve sistem talimatını mevcut profil anahtarıyla şifreler. Anahtar, profil ve `.assistant.enc` dosyasını birlikte yedekleyin. Anahtar eksik veya dosya bozuksa geçmiş sıfırlanmaz; erişim durur. JSON dışa aktarımı **şifresizdir**, güvenli saklayın. Ortak yönetici hesabını kullananlar aynı proje sohbetlerini görür. Özel profil deposu kayıt desteği sağlamıyorsa ekranda yalnız sayfa belleğinde çalışıldığı belirtilir.

Kayıtta en fazla 100 mesaj/20 iş çıktısı, yaklaşık 220 KB ve yönetici/proje başına 50 sohbet tutulur. Eski kayıtlar otomatik silinmez. Yanıtın kayıt metni en fazla 32000 karakterdir; çok uzun çıktıları sağlayıcıdan daha küçük parçalar halinde isteyin. Modelin sonraki isteğine yalnız aynı çalışma bağlamının son 10 tamamlanmış mesajı (mesaj başına en fazla 10000 karakter) gönderilir; tüm arşiv model belleği değildir. Profil/model/sistem talimatı değişince model bağlamı yenilenir. Kaynak sohbetinden plan/değişiklik moduna geçerken tamamlanmış proje bağlamı kullanılabilir.

Disk, boyut, bağlantı veya başka sekmeyle revizyon çakışmasında mevcut ekrandaki metin korunur; **Kaydı tekrar dene** yalnız kaydı dener, modeli tekrar çağırmaz. Gerekirse dışa aktarın. Kayıt yapılamıyorsa yeni/eski sohbet açarken kaydedilmeyen kısmı bırakmak için ayrıca onay istenir. Başka sekmenin daha yeni kaydı sessizce ezilmez.

**İş çıktıları ve uygulama etkisi** her görevin önerisini, dosya listesini, son bilinen durumunu, doğrulama çıktısını ve işlem izini gösterir. **Canlı görevi aç** gerçek sunucu kaydını denetler; ayrı inceleme/onay ekranını kullanır. Eski bir sohbeti açmak dosya yazmaz veya komut çalıştırmaz.

| Durum / senaryo | Hedef uygulamadaki etkisi |
| --- | --- |
| Model denemesi, kaynaklı sohbet veya plan | Dosya yazmaz; yanıt bir öneri/bilgidir. |
| Değişiklik önerisi hazır | Fark geçici kopyadadır; hedefe uygulanmamıştır. |
| Fark açık onayla uygulandı | Kaynak dosyaları değişir. Çalışan servis, paket kurulumu ve gerçek veritabanı kendiliğinden güncellenmez. Migration/deploy ayrı süreçtir. |
| Doğrulama başarısız | Başarı olarak gösterilmez; uygulanmış dosyaları otomatik geri almaz. Komut geçici kaynak kopyasında çalışır. |
| Dosya sonradan değişti | Mevcut sürüm kontrolü uygulama/geri almayı durdurur; güncel kaynaklardan yeniden hazırlayın. |
| İşlem sonucu alınamadı | Etki doğrulanmamış görünür. Canlı görevi açıp dosyaları inceleyin; otomatik tekrar uygulanmaz. |
| Sunucu yeniden başladı / görev kapatıldı | Sohbet ve iş özeti okunabilir; canlı diff/geri alma kaydı yoktur. Yeniden uygulama için güncel kaynaklardan yeni görev hazırlayın. |
| Sohbet kaydı silindi | Yalnız sohbet arşivi silinir. Uygulanmış dosyalar ve ayrıca yönetilen canlı görevler değişmez. |

## Hızlı başlangıç

Depo klasöründe, PowerShell:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

`.env` dosyasını düzenleyin; mevcut diğer ayarları koruyun:

```dotenv
LLM_ADMIN_USER=admin
LLM_ADMIN_PASSWORD=kendi-guclu-parolaniz
```

`npm start` çalıştırıp **http://127.0.0.1:8010/llm** adresini açın. Belirlediğiniz kullanıcı/parolayla giriş yapın. Sağlayıcı/model/API anahtarını kaydedin, test edin ve profili etkinleştirin. Durdurma: **Ctrl+C**. Linux/macOS'ta da aynı `.env` ayarlarından sonra `npm ci` ve `npm start` kullanın.

`npm start` ve CLI çalışma dizininin `.env` dosyasını okur. Terminalde önceden verilmiş değerler önceliklidir; PowerShell'de dosyadaki değerlere dönmek için `Remove-Item Env:LLM_ADMIN_PASSWORD, Env:LLM_ADMIN_USER -ErrorAction SilentlyContinue` kullanın. `$env:...` ile verilen değerler dosyaya kaydedilmez. `npx llm-manager init`, parolayı kurulumun yapıldığı hedef projenin `.env` dosyasına yazar. Kütüphaneyi elle entegre ediyorsanız ortam dosyasını hostunuz yüklemelidir.

`.env` veya uygulama dosyaları değişince açık sunucuyu **Ctrl+C** ile durdurup `npm start` ile yeniden başlatın. Arayüz güncellemesi görünmüyorsa tarayıcıda **Ctrl+F5** kullanın.

Express kurulu bir Node hostunda GitHub'dan CLI kullanımı:

```sh
npx github:sirrakadembasti/llm-manager --password guclu-parola --port 8010
```

Express adaptörü/CLI sunucusu için Express **4.19.2+ veya 5.x** gerekir; optional peer'dır. `npm ci` geliştirme kopyasına Express'i kurar. Core tek başına Express gerektirmez.

Windows'ta Node kurulu olduğu halde bulunamıyorsa [cmd.exe PATH sınırını](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation) kontrol edin: 8191 karakteri aşan PATH yok sayılabilir. Eski geçici girdileri temizleyip terminali yenileyin. .NET doğrulaması artık geçici araç yollarını kullanıcı PATH'ine eklemez.

## Uygulamaya ekleme

Host proje klasöründe:

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

Sihirbaz proje türünü bulur; onayınızla yardımcıları ekler, doğrular ve `/llm` sayfasını açar. Yerel son kodu kullanmak için Windows'ta `npm install "F:\projeler\llm-manager" express` yapılabilir. Kurulumdan önce çıplak `npx llm-manager` kullanmayın.

Express'e elle bağlantı:

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';

const app = express();
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD
});
app.listen(3000);
// Sunucu kodunda: const cevap = await llm.ask('Merhaba');
```

Framework bağımsız kullanım:

```js
import { createLLMManager } from '@sirrakadembasti/llm-manager/core';
const llm = createLLMManager({ adminPassword: process.env.LLM_ADMIN_PASSWORD });
const cevap = await llm.ask('Merhaba');
// HTTP adaptörü: await llm.fetch(request)
```

## Desteklenen ortamlar matrisi

| Ortam | Tip | Üretimde kullanım | Ayrı Node süreci | Otomatik enjeksiyon |
| --- | --- | --- | --- | --- |
| Express | express | Kalıcı disk/host store ile | Hayır | Evet |
| SPA | spa | Kendi backend'iniz üzerinden önerilir | Evet | Evet; HTTP istemci yardımcısı |
| Next.js | nextjs | Node runtime + kalıcı disk/host store | Hayır | Yalnız sunucu bileşeni |
| Nuxt | nuxt | Node sunucusunda | Hayır | İstemci bileşenine yapılmaz |
| SvelteKit | sveltekit | Node adaptörü + kalıcı store | Hayır | İstemci bileşenine yapılmaz |
| Electron | electron | Ana süreç, userData deposu | Hayır | Ana süreç |
| Tauri | tauri | HTTP istemcisi | Evet | Hayır |
| Fastify, Koa, Hono ve NestJS | fastify/koa/hono/nestjs | Host auth adaptörüyle | Hayır | Hayır; elle bağlantı |
| Python | python | HTTP istemcisi | Evet | Yardımcı import |
| .NET ve .NET Framework | dotnet | HTTP istemcisi | Evet | Yardımcı namespace |

Next.js App Router ve Node runtime desteklenir; Edge desteklenmez. Sunucusuz ortamda kalıcı host deposu gerekir. SPA/Tauri/Python/.NET ayrı Node sunucusuna HTTP ile bağlanır. Diğer framework'lerde ayrıntılar ve yardımcı çağrıları [entegrasyon kılavuzunda](ENTEGRASYON.md).

## Neler sağlar?

- Şifreli profiller, etkin profil, test, canlı model listesi, klonlama ve Türkçe arayüz.
- OpenAI/Anthropic/Google transportları, SSE akışı, iptal, retry ve sıralı fallback.
- Sağlayıcı kataloğu ve varsayılan model listeleri (katalog tarihi: 2026-10; güncel liste için **Modelleri getir** kullanın). [Tarihli kaynaklar ve model sınırları](roadmap/YOL_HARITASI.md#katalog-kaynakları).
- Yetkilendirme, CSRF, SSRF, kota, güvenli loglar ve isteğe bağlı aylık kullanım özeti.

## Arayüzü kullanma

1. **Yeni profil** bölümünde bir ad, sağlayıcı, model ve API anahtarı girip kaydedin.
2. Kayıtlı profilin bağlantı testini çalıştırın. **Modelleri getir** ile hesabınızın erişebildiği modelleri sorgulayabilirsiniz.
3. Uygulamanın kullanacağı profili etkinleştirin. Aynı anda tek profil etkindir.
4. **Proje Asistanı → Uygulaman hakkında çalış → Model denemesi** yolunda profil ve mesaj seçip yanıtı sınayın. **Yanıt ayarları** altındaki akış seçeneği yanıtı geldikçe gösterir.

Düzenlerken API anahtarını boş bırakmak kayıtlı anahtarı korur. Zaman sınırı, çıktı tokenı, düşünme modu ve gelişmiş üretim ayarları profil bazındadır; destek modele bağlıdır. Yedek profiller, hata durumunda sırayla denenecek profillerdir.

İşlem bildirimleri üstte görünür kalır; hata, başarı, bilgi ve bekleme durumları ayrı gösterilir. Hata açıklamasının altında kod, destek kimliği ve süre yer alır. Bildirimi **×** ile kapatabilirsiniz; test sonucu ilgili profil kartında kalır. Karttaki ayrıntı bu sekmede korunur, profil değişince sıfırlanır; sayfayı yeniden açınca sunucuda saklanan test geçmişi gösterilir. Açık/koyu görünüm sistem tercihini izler.

### Arayüz dili

Arayüz metinleri `public/i18n/tr.json` içindedir. Arayüz ve paket hata sözlüğü yalnız Türkçedir; etkin dil ayarı yoktur. Eski JavaScript `locale: 'en'` seçeneği dikkate alınmaz ve Türkçe kullanılır. `getErrorMessage` işlevinin kullanım dışı ikinci parametresi uyumluluk için kabul edilir; dili değiştirmez.

## API kullanımı

Yönetim sayfası `/llm`, API kökü `/api/llm`. Yazma isteklerinde `X-LLM-CSRF: 1` gerekir.

| İşlem | API yolu |
| --- | --- |
| Katalog / profil listesi | `GET /catalog`, `GET /profiles` |
| Oluştur / güncelle / sil | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Etkinleştir / test et | `POST /profiles/:id/activate`, `POST /profiles/:id/test` |
| Model listesi / önizleme | `GET /profiles/:id/models`, `POST /models/preview` |
| Sohbet | `POST /chat`: `{ prompt }` veya `{ messages }` |
| Sağlık / aylık özet | `GET /health`, `GET /usage?month=YYYY-MM` |

`ask()` varsayılan olarak string, `{ raw: true }` ile usage/finishReason/profil/süre içeren sonuç döndürür. `stream()` AsyncIterable; HTTP `{ stream: true }` ile SSE `delta`, `done`, `error` üretir. `done`, gerçek `profileId` ve `fallbackUsed` içerir. İstemci kopunca üst akış iptal edilir; doğrudan çağrılarda `signal` verilebilir.

Retry yalnız retryable hatalarda ve ilk parça yayımlanmadan önce çalışır. `Retry-After`/backoff sınırları korunur; ilk çıktıdan sonra retry/fallback yapılmaz. Tüm denemeler ilk profilin tek timeout bütçesini paylaşır; `retry: false` yeniden denemeyi kapatır. Gizli düşünce son yanıta eklenmez; filtre ve kesilme tipli hata üretir.

| Ayar | Varsayılan / sınır |
| --- | --- |
| `limits` | 100 mesaj; 200000 toplam / 100000 tek mesaj karakteri; 262144 bayt gövde |
| Mesaj rolleri | `system`, `user`, `assistant`; en az bir `user` |
| Süre / token | 120000 ms (5000–300000); 8192 token (256–32768) |
| Gelişmiş | `temperature` 0–2; `topP` 0–1; `stop` en çok 4 dize; `responseFormat` text/json |
| `thinking` | auto/enabled/disabled; model desteğine bağlı |
| `chatAccess` | authenticated/admin/false |
| `chatOverrides` | admin/all/none; varsayılan admin |
| Kota | Sohbet 30/dk; test 10/dk; model/önizleme 10/dk; hatalı giriş 10/dk |

Geçersiz mesaj/JSON 400; büyük gövde 413. Express kendi ayrıştırıcısını auth sonrasına bağlar; hostun daha önceki ayrıştırıcısı daha küçük sınır koyabilir. HTTP yanıtları sır içermez. [Depo sözleşmesi ve hata kodları](ENTEGRASYON.md#özel-depo).

### HTTP ile sohbet örneği

Node.js sunucu kodunda; yönetici parolasını tarayıcıya koymayın. Önce bir profil kaydedip etkinleştirin:

```js
const adminUser = process.env.LLM_ADMIN_USER || 'admin';
const authorization = 'Basic ' + Buffer.from(`${adminUser}:${process.env.LLM_ADMIN_PASSWORD}`).toString('base64');
const response = await fetch('http://127.0.0.1:8010/api/llm/chat', {
  method: 'POST',
  headers: { Authorization: authorization, 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
  body: JSON.stringify({ prompt: 'Merhaba' })
});
const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
console.log(result);
```

Sohbet istemcilerine yönetim yetkisi vermek yerine sunucuda `LLM_CHAT_TOKENS` tanımlayıp `Authorization: Bearer <belirteç>` kullanabilirsiniz. Bu belirteç yalnız sohbet içindir. Akış için gövdeye `stream: true` ekleyin ve yanıtı JSON yerine SSE olarak okuyun.

## Kimlik ve güvenlik

Yönetim sayfası/betiği/API'si Basic admin veya admin host principal ister. `authorize(request)` host kimliği sağlayabilir; yapılandırılmamış Web auth `AUTH_NOT_CONFIGURED` ile kapalıdır. Bearer `LLM_CHAT_TOKENS` yalnız sohbet içindir; `chatAccess: 'admin'` bunu da kapatır. `requireAuth` Express session bağlantısı içindir. `ask()`/`handle()` güvenilir host API'leridir; HTTP yetkisini adaptör sağlar. `insecureNoAuth: true` yalnız açık güvensiz yerel tercihtir.

Kotalar host `clientKey` / Web `getClientId(request)` (Express `req.ip`), sonra `principal.id`, yoksa ortak anonim kimlikle çalışır. Profil değiştirmek test/model kotasını yenilemez. `trust proxy` hostun sorumluluğudur. 429 yanıtı `Retry-After` taşır; `rateLimit: false` kapatır. Kotalar süreç içidir, dağıtık değildir.

SPA geliştirme belirteci de tarayıcıda herkese açıktır; üretimde kendi backend'inizi kullanın. Sihirbaz Vite için localhost:5173 seçer; diğerlerinde açık origin ister. `-y` ile origin yoksa CORS kapalı kalır. Sihirbaz `*` kabul etmez; CLI wildcard yalnız sohbet rotasında, credentials olmadan kullanılabilir. Admin parolası kaynak koda/npm script'ine yazılmaz; `.env`, `.env.local` ve sır dosyaları gitignore'a eklenir.

HTTPS ve soket/DNS filtresi özel IP'leri engeller. LAN/Ollama için açık `allowedPrivateHosts`; proxy için `proxyUrl`/`LLM_HTTPS_PROXY` ve `allowedHosts` kullanın. Proxy DNS'inde yerel IP filtresi uygulanamaz; hedefler bilinen sağlayıcı alan adları ve açık listeyle sınırlandırılır.

## Veri, yedek ve işletim

Varsayılan `data/llm-profiles.json` ve `data/llm-encryption.key` dosyaları otomatik oluşur; **ikisini birlikte yedekleyin**. Anahtar kaybolursa profiller çözülemez. AES-256-GCM kullanılır. Dosya izinleri (0600) Windows'ta uygulanmaz; `data/` klasörünü yalnız uygulama kullanıcısının erişebileceği bir konuma koyun.

```sh
npx llm-manager key rotate
npx llm-manager export --out yedek.json --password yedek-parolasi
npx llm-manager import yedek.json --password yedek-parolasi
```

Anahtar önceliği: açık `encryptionKey` > `LLM_CONFIG_ENCRYPTION_KEY` > anahtar dosyası. Varsayılan setup eski `.env` anahtarını kilit altında dosyaya taşır; `.env` değişmez. `writeEnv: true` deprecated uyumluluk yoludur. Döndürme eski anahtarı `.old-<tarih>-<kimlik>` adıyla saklar.

`STORE_DECRYPT_FAILED`, kayıtlı API anahtarının açılamadığını bildirir; sağlayıcı hatası değildir. `.env` içindeki eski `LLM_CONFIG_ENCRYPTION_KEY`, doğru anahtar dosyasının önüne geçebilir. Önce `.env`, profil ve anahtarı yedekleyin. Dosyadaki anahtarın mevcut profilleri açtığı doğrulanmışsa çakışan `.env` ayarını kaldırıp sunucuyu yeniden başlatın. Yeni bir anahtar üretmek eski profilleri kurtarmaz; şifreli verinin bozulması da aynı hatayı verebilir.

Terminaldeki `auth.failed`, eksik veya yanlış yönetim kimlik bilgili isteği gösterir. Tarayıcının ilk Basic Auth isteğinde veya eski parola önbellekte kaldığında görülebilir; sağlayıcı bağlantısıyla ilgili değildir.

Depo Promise tabanlıdır; yerel disk kilidi, FIFO yazma, revizyon ve `.bak` yedeği kullanır. NFS/SMB garantisi yoktur. `STORE_CORRUPT` için bozuk dosyayı koruyup eşleşen anahtar ve sağlam `.bak` ile dönün; `STORE_VERSION_UNSUPPORTED` için uyumlu sürüm kullanın. Boş depoyla üzerine yazmayın.

`logger` istek kimliğiyle güvenli üstveri yazar. `logContent: false` sabittir; sır/istem/cevap günlüğe yazılmaz. `chat.completed` başarı, hata, iptal ve erken yineleyici dönüşünde bir mantıksal sohbet için bir kez code/usage/son profil bilgisi verir; bilinmeyen usage null'dır. `usageLog: true` aylık sayısal JSONL ve yönetici `/usage` özeti açar. Herkese açık `/health` sırsızdır; `health: false` kapatır. `homeUrl`, ana uygulamaya dönüş bağlantısını ayarlar.

CLI/örnek sunucu SIGINT/SIGTERM'de kapanır; üst sınır 10 saniyedir. Programatik factory/probe/init host sinyallerini varsayılan olarak yönetmez; sahipli bağımsız süreçte `handleSignals: true`, gömülü kullanımda `await instance.close()` kullanın. [Docker, servis ve kurtarma](DAGITIM.md).

## 2.0 geçişi ve alt yollar

Eski paket: `npm uninstall llm-manager`; yeni paket: `npm install github:sirrakadembasti/llm-manager`. Importları scoped ada taşıyın; CLI adı ve veriler korunur. Dosya deposu çağrılarını `await` edin; özel store `T | Promise<T>` döndürebilir.

| Alt yol | Amaç |
| --- | --- |
| `@sirrakadembasti/llm-manager` | Express ve temel API |
| `@sirrakadembasti/llm-manager/core` | Framework bağımsız çekirdek/depo |
| `@sirrakadembasti/llm-manager/server` | Bağımsız sunucu |
| `@sirrakadembasti/llm-manager/init` | Algılama, kurulum, doğrulama, geri alma |
| `@sirrakadembasti/llm-manager/setup` | Anahtar yönetimi |
| `@sirrakadembasti/llm-manager/runtime` | İstek/yanıt ve hata sınıflandırma |
| `@sirrakadembasti/llm-manager/transport` | Güvenli HTTP taşıma |
| `@sirrakadembasti/llm-manager/errors` | Tipli hata kodları |

2.0 sürümünde senkron `detectProjectType`, `detectEntryFile`, `formatVerificationReport` kökten kaldırıldı:

```js
import { detectProjectType, detectEntryFile, formatVerificationReport } from '@sirrakadembasti/llm-manager/init';
```

Kökteki async `runInteractiveInit`, `probeAndOpenBrowser`, `initLLMProject`, `verifyIntegration`, `injectIntoEntryFile` bir uyumluluk sürümü için deprecated sarmalayıcılardır; yeni kod `/init` kullanmalıdır.

Amaçlar `quick | diagnostic | default`; eski `manager` → `diagnostic`, `production` → `default` eşlemesi birer uyarı verir. MiMo auto'da `purpose: 'diagnostic'` ve `purpose: 'quick'` düşünmeyi kapatır; `purpose: 'default'` model varsayılanını korur. MiMo quick testi açık düşünme seçimini de kapatır. Başarılı test sağlayıcı hızını/üretim uygunluğunu garanti etmez; kota, izin, ağ, filtre ve kesilme ayrı kodlarla bildirilir. [Xiaomi açıklaması](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking).

MIT · [Lisans](../LICENSE) · [Değişiklikler](DEGISIKLIKLER.md) · [Güvenlik](GUVENLIK.md) · [Katkı](KATKI_REHBERI.md)


### Graphify ve belge destekli proje bağlamı (2026-10-28)

Proje bilgileri → Bağlı proje → **Graphify ile daha güçlü proje analizi** alanında resmî depo, kurulum ve kullanım rehberi bulunur. Graphify hedef uygulamaya JavaScript bağımlılığı olarak değil, LLM Manager sürecinin çalıştığı sunucuya kurulur. Python 3.10+ gerekir; resmî paket `graphifyy`, CLI `graphify` adındadır: `uv tool install graphifyy` veya ayrı ortamda `python -m pip install graphifyy`. Kaynak: https://github.com/Graphify-Labs/graphify . Bu backend entegrasyonunda `graphify install` ve sohbette `/graphify` gerekmez.

Kurulumdan sonra **Projeyi tara** seçilir. Mutlak host PATH dizinlerindeki CLI yeniden aranır; açık `graphify.command` veya `LLM_GRAPHIFY_PYTHON` / `project.graphifyPython` ayarı önceliklidir. PATH değişikliği çalışan servise yansımıyorsa servis yeniden başlatılır. `project.graphifyAutoDetect: false` otomatik keşfi kapatır. Projeden araç veya kurulum betiği otomatik çalıştırılmaz. Kurulu araç doğrulanmış tarama çıktısı üretirse algılandı, bulunamazsa eksik, çalışmazsa hata durumu gösterilir. Kurulum/çalıştırma birbirinden farklıdır; keşif tek başına başarılı analiz sayılmaz.

Graphify yalnız filtrelenmiş geçici kaynak kopyasında `--code-only` çalışır. Güncel kaynak revizyonuyla eşleşen ilişkiler kaynaklı sohbetin dosya seçimini destekler; kaynak değişince eski harita kullanılmaz ve yeniden tarama istenir. README, kılavuz, `.md` ve `.txt` belgeleri ayrıca yerel okuyucuyla okunur; ilk üç uygun belge için bağlam payı ayrılır. Belgeler ve geçmiş mesajlar talimat/yetki sayılmaz. Seçili kaynaklar yalnız paylaşım onayı verilen kaynaklı sohbette etkin sağlayıcıya gönderilir. Model denemesi proje kaynaklarını kullanmaz.

Tarama kaynak/belge/dışlanan dosya sayılarını ve kısmi taramayı gösterir. Varsayılan sınırlar 2500 dosya, dosya başına 256 KiB, toplam 4 MiB; sohbet bağlamı 40000 karakterdir. Bu nedenle her belge veya bütün proje her istekte modele gönderilmez. Canlı DB, dış servis ve çalışma zamanı davranışları bu analizle doğrulanmış sayılmaz. Geliştirme motoru güncel filtrelenmiş çalışma kopyasını okuyabilir; dosya uygulama ve komut onayları korunur.

Repomix yeniden incelendi (https://repomix.com/guide/); mevcut güvenli okuyucu ve sınırlı kaynak seçimi korunarak zorunlu bağımlılık eklenmedi. Cline/Aider alternatif motor adayları; DBHub veritabanı bağlantısı ertelendiği için eklenmedi. Bunlar kurulmuş veya aktifmiş gibi gösterilmez.

Sohbet görünümü mesajlara daha fazla dikey alan ayırır: masaüstünde en az 940 px, mobilde en az 800 px uzunluğundadır. Daha kısa ekranda yazma alanına sayfayı aşağı kaydırarak ulaşılır; mesajlar kendi alanında kaydırılır. Merkezde ayrı sohbet menüsü ve **Sohbet bağlamı ve kaynaklar** paneli bulunmaz. Başlık düzenleme, JSON dışa aktarma, silme ve kaydı tekrar deneme soldaki **Seçili sohbet** bölümündedir; mobilde **Sohbetler** düğmesiyle açılır. Yanıta ait metrik ve kaynak referansları, varsa mesajın **Yanıt ayrıntıları** içinde korunur.
