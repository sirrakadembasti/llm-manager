# Yol Haritası 2 — Vaat Edilen ile Gerçekleşen Arasındaki Farklar ve Çözümleri

> **Hedef kitle:** Bu belgeyi uygulayacak yazılım geliştirici / kod yazan yapay zekâ modeli.
> **Hazırlayan bakış açısı:** Yazılım mimarı + kıdemli geliştirici incelemesi (2026-10-22, sürüm v1.0.0, commit `2a204c1`).
> **Kardeş belge:** [YOL_HARITASI_1_TEKNIK_MIMARI.md](YOL_HARITASI_1_TEKNIK_MIMARI.md) (mimari, kalite, eksik özellikler).

> **Güncel durum — 2026-10-25:** FAZ 0'ın G01–G07 ve G24 kabul kriterleri uygulandı ve doğrulandı. Madde/test kanıtları: [FAZ 0 denetim raporu](YH2_FAZ0_DENETIM_2026-10-25.md). Aşağıdaki başlangıç bulguları 2026-10-22 durumunu anlatır; FAZ 1/2 kartları bu notla topluca kapatılmaz.

---

## 0. Bu belgeyi uygulayan için kurallar (HER GÖREVDE GEÇERLİ)

1. **Sıra:** Önce bu belgedeki **Faz 0** (güvenlik açısından kritik) görevlerini bitir. Ardından Yol Haritası 1'in Faz A'sına geç. Genel sıra en altta, [Bölüm 5](#5-genel-uygulama-sırası-iki-belge-birlikte)'te.
2. **Bir görev = bir commit.** Commit mesajı Conventional Commits biçiminde olsun: `fix(core): ...`, `feat(init): ...`. Görev kimliğini gövdeye yaz (ör. `Refs: YH2-G02`).
3. Her görevden sonra `npm test` çalıştır. **Tüm testler geçmeden bir sonraki göreve geçme.**
4. Her görev için **en az bir yeni test** yaz. Önce testi yaz, başarısız olduğunu gör, sonra düzelt (TDD).
5. `CHANGELOG.md` içinde `[Unreleased]` altına `### Fixed`, `### Security` veya `### Changed` başlığıyla kısa bir satır ekle.
6. API anahtarı, admin parolası ya da şifreleme anahtarı **hiçbir zaman** loga, HTTP yanıtına, tarayıcı paketine veya kaynak koduna yazılmaz.
7. Kullanıcıya dönük hata mesajları Türkçe olur; makinenin okuyacağı `code` alanları İngilizce BÜYÜK_HARF olur.
8. Değişikliğinle ilgisi olmayan yorumları ve dokümantasyonu silme.
9. Genel API'yi (`mountLLMManagement`, `createLLMManager`, `ask`, `fetch`, `handle`, store sözleşmesi) **geriye dönük uyumlu** tut. Kırıcı bir değişiklik kaçınılmazsa eski davranışı `@deprecated` uyarısıyla bir sürüm daha koru ve CHANGELOG'a `### Deprecated` yaz.
10. Kararsız kaldığın bir noktada uydurma; görevi "BEKLEMEDE" olarak işaretle ve sorunu not et.
11. **Paket adı (karar onaylandı, 2026-10-23):** `@sirrakadembasti/llm-manager`, hedef sürüm **v2.0.0**. Belgelerde geçen `<PKG>` bu adı ifade eder. Kodda bu adı elle yazma; `package.json#name` alanından oku (bkz. G07). CLI komutu `llm-manager` olarak kalır.

---

## 1. Yönetici özeti

Uygulama tek bir Express/Node sürecinde sağlam çalışıyor. Şifreleme (AES-256-GCM), SSRF/DNS rebinding koruması, revizyon denetimi ve hata sınıflandırma iyi yazılmış. **Fakat projenin iki büyük vaadi var: "Her projeye sıfır ayarla, güvenli biçimde entegre olur" ve "API anahtarı güvendedir".** Bu iki vaat Express dışındaki senaryolarda ve kurulum sihirbazında **gerçekleşmiyor**. Daha kötüsü, bazı senaryolarda kurulum sihirbazının ürettiği kod **güvenlik açığı yaratıyor**.

Doğrulama betiğiyle teyit edilen bulgular ([`dogrulama.mjs`](dogrulama.mjs), çalıştırma: `node docs/roadmap/dogrulama.mjs`, 2026-10-22):

| # | Test | Beklenen | Gerçek |
|---|---|---|---|
| 1 | `chatAccess: false` iken `POST /chat` | 404/403 (kapalı) | İstek işleyiciye ulaşıyor (409 `ACTIVE_PROFILE_MISSING` döndü; etkin profil olsaydı cevap verecekti) |
| 2 | Async (Promise döndüren) host deposu ile `GET /profiles` | Profil listesi | `{}` (Promise JSON'a çevrilmiş) |
| 3 | `express.json()` eklentiden **sonra** bağlanırsa `POST /profiles` | 201 | 400 (gövde boş) |
| 4 | `llm.fetch()` (Next/Nuxt/SvelteKit) ile **kimlik bilgisi olmadan** profil oluşturma | 401 | **201 — saldırgan profil oluşturabiliyor** |
| 5 | `npm view llm-manager` | Bu proje | **npm'de başka birine ait `llm-manager@1.5.5` paketi var** |

---

## 2. Vaat ↔ Gerçek karşılaştırma tablosu

Önem: **P0** = güvenlik açığı ya da veri kaybı, hemen düzelt · **P1** = vaat edilen senaryo çalışmıyor · **P2** = belge ya da kalite farkı.

| ID | Vaat (kaynak) | Gerçek durum | Önem |
|---|---|---|---|
| G01 | "API anahtarı tarayıcıya asla verilmez", güvenli SPA entegrasyonu (README, ENTEGRASYON Senaryo 2) | SPA için üretilen `src/llm.js` **admin parolasını** tarayıcı paketine gömüyor (`LLM_PASS`). Sitenin her ziyaretçisi tam yönetici olur: profil ekleyip etkinleştirerek tüm LLM trafiğini kendi sunucusuna yönlendirebilir. | **P0** |
| G02 | Next.js / Nuxt / SvelteKit için `/llm` yönetimi "güvenli" (README tablosu) | `llm.fetch()` **hiç kimlik doğrulaması yapmıyor**. Üretilen rotalar herkese açık. Saldırgan profil oluşturup etkinleştirebiliyor (doğrulandı: 201), uygulamanın tüm istemlerini kendi sunucusuna akıtabiliyor ve sahibinin kotasını harcayabiliyor. | **P0** |
| G03 | `chatAccess: false` → "kapalı" (README §API) | `src/index.js:122` `return next()` diyor, yani istek sohbet işleyicisine ulaşıyor. Üstelik bu durumda admin kontrolü de atlanıyor. | **P0** |
| G04 | "Sıfır ayar", "güvenli" kurulum (README CLI) | Sihirbaz parolayı **düz metin olarak** `llm.js`, `LlmClient.cs`, `llm_client.py` ve `package.json` (`scripts.llm`) dosyalarına yazıyor. Parola verilmezse varsayılan `admin123` kullanılıyor ve parola konsola basılıyor. Bu dosyalar git'e gider. | **P0** |
| G05 | "data/ altındaki anahtarları kaynak depoya eklemeyin" (README) | Sihirbaz host projenin `.gitignore` dosyasına `data/`, `.env` ve `*.key` satırlarını **eklemiyor**. Şifreleme anahtarı ve şifreli sırlar aynı klasörde durduğu için birlikte commit edilme riski yüksek. | **P0** |
| G06 | CSRF koruması `X-LLM-CSRF` başlığıyla (README) | Sihirbaz `--cors *` üretiyor. Sunucu her origin'i yansıtıp `Access-Control-Allow-Credentials: true` gönderiyor. Tarayıcıda Basic Auth önbellekteyken **herhangi bir web sitesi** yönetim API'sini çağırabilir; CSRF koruması fiilen devre dışı kalır. | **P0** |
| G07 | `npx llm-manager init` (README satır 98, ENTEGRASYON) | npm'de `llm-manager` adı **başka bir pakete ait**. Paket yerelde kurulu değilse `npx llm-manager` yabancı paketi indirip `--password` argümanıyla çalıştırır. Bu bir tedarik zinciri riskidir. **Karar onaylandı (2026-10-23): yeni ad `@sirrakadembasti/llm-manager`, sürüm v2.0.0.** | **P0** |
| G08 | "Host deposu da verilebilir" (README §depo sözleşmesi) | Çekirdek store metotlarını **senkron** çağırıyor. Veritabanına bağlanan bir depo (async) bozuluyor (doğrulandı). | P1 |
| G09 | Nuxt / SvelteKit / Vue / Next.js'te "ana sayfaya import otomatik eklenir, `askLLM` çağırın" | `app.vue`, `+page.svelte` ve `'use client'` sayfaları tarayıcıda da çalışır. `node:fs` kullanan sunucu modülünü bunlara import etmek **derlemeyi kırar**. SvelteKit sunucu modülünü `$lib/server` altında ister. | P1 |
| G10 | Express CommonJS desteği (README, ENTEGRASYON Senaryo 1) | CJS `setupLLM` **async** ama çağrısı `await`'siz ekleniyor (`setupLLM(app);`). Rotalar host'un 404/hata katmanlarından sonra kaydediliyor ve hata olursa "unhandled rejection" oluşuyor. | P1 |
| G11 | Otomatik kod ekleme "çalışır entegrasyon" üretir | `setupLLM(app)` satırı, `app.use(express.json())` ifadesi tam bu biçimde yazılmamışsa (ör. `express.json({limit})`) gövde ayrıştırıcıdan **önce** ekleniyor. Bu durumda POST gövdeleri boş geliyor (doğrulandı). | P1 |
| G12 | "Onay vermezseniz ana dosyanızı tek tuşla eski haline döndürür" (ENTEGRASYON) | Rollback yalnız ana dosyayı geri alıyor. Oluşturulan yardımcı dosyalar ve `package.json` script'i kalıyor. İç doğrulama başarısız olursa hiç rollback önerilmiyor. | P1 |
| G13 | "Sözdizimi / Derleme Kontrolü" (sihirbaz çıktısı) | `.ts/.tsx/.vue/.svelte/.cs` dosyaları için yalnız parantez sayan bir sezgisel kontrol var. `/=\s*;/` gibi yanlış pozitif üretebilen kurallar içeriyor. Gerçek bir derleme yapılmıyor. Python dosyası hiç kontrol edilmiyor. | P2 |
| G14 | C# ".NET Framework / ASP.NET MVC (Global.asax, Web.config)" desteği | Üretilen kod `using var` (C# 8) ve `System.Text.Json` kullanıyor. Bunlar .NET Framework 4.x'te yok, **derleme başarısız olur**. Eski tip csproj'a `<Compile Include>` da eklenmiyor. | P1 |
| G15 | Tauri desteği (README tablosu "Electron / Tauri") | `@tauri-apps` görülünce Electron tipi seçiliyor ve `ipcMain` kodu üretiliyor. Tauri'nin arka ucu Rust'tır; üretilen kod çalışmaz. | P1 |
| G16 | Electron masaüstü entegrasyonu | `dataDir: './data'` (çalışma dizini) kullanılıyor. Paketlenmiş uygulamada bu dizin salt okunur ya da tahmin edilemez (README `app.getPath('userData')` diyor, üretilen kod demiyor). Renderer'dan `ipcRenderer.invoke` çağrısı `contextIsolation` açıkken preload ister; preload üretilmiyor. Paketlenmiş uygulamada anahtar girmek için arayüz yok. | P1 |
| G17 | "Her GitHub reposundaki uygulamaya entegre edilebilir" (GEMINI hedefi) | TypeScript Express (`src/index.ts`, `server.ts`) algılanmıyor. `package.json#main` `dist/` gibi derleme çıktısını gösteriyorsa kod **derleme çıktısına** enjekte ediliyor. Fastify/Koa/Hono/NestJS "express" sanılıp `setupLLM(app)` ekleniyor ve uygulama kırılıyor. | P1 |
| G18 | Next.js App Router desteği | `@/llm` alias'ının varlığı varsayılıyor. `llm-manager` paketi `import.meta.url` ile `public/` okuduğu için Next paketleyicisi altında `serverExternalPackages` ayarı gerekebilir. Vercel gibi sunucusuz ortamlarda dosya sistemi salt okunur olduğundan dosya deposu çalışmaz. Bu sınırlar belgelenmemiş. | P1 |
| G19 | Python / C# "tek satırla çağrı" | İstemciler `127.0.0.1:8010`'da sürekli çalışan bir Node sunucusuna bağımlı. Bu sunucunun nasıl kalıcı çalıştırılacağı (servis, Docker, pm2) anlatılmıyor. URL ve parola kodun içine sabitlenmiş. Python istemcisinde zaman aşımı ve hata ayrıştırma yok. | P1 |
| G20 | `npx github:...init` ile kurulum "uçtan uca tamamlanır" | Sihirbaz paketi host projeye **kurmuyor** ve kurulu olup olmadığını kontrol etmiyor. Üretilen `import 'llm-manager'` satırı çalışma anında patlıyor. | P1 |
| G21 | "Kısa bağlantı testi" (README) | Akıl yürüten (reasoning) modellerde (o3, o4-mini, deepseek-reasoner, gemini-2.5-pro) 512 token düşünmeye harcanıyor ve `LLM_TRUNCATED` ya da `LLM_EMPTY_RESPONSE` dönüyor. Bağlantı sağlam olduğu halde test **yanlış negatif** veriyor. | P1 |
| G22 | "XFactor izleri kaldırıldı / bağımsız eklenti" (GEMINI Düzeltme 1 ✔) | Kalıntılar var: "Manager ajanı", "otel yönetimi" test istemi, `purpose: 'manager' / 'production'`, `useManagedProfile`, `allowMockFallback`, arayüzde "Manager ve ajanların kullandığı profil", README'de "üretim ajanları". | P2 |
| G23 | "Varsayılan model listeleri" (README) | Liste 2025 başına ait (gpt-4.1, claude-sonnet-4-20250514, gemini-2.5…). Bugün (2026-10) güncel değil ve güncelleme mekanizması yok. | P2 |
| G24 | `chatAccess: 'authenticated'` ile `'admin'` farklı erişim düzeyleridir | Yerleşik `adminPassword` Basic Auth herkesi `isAdmin: true` yapıyor, yani iki ayar arasında fark yok. Yalnız sohbet yetkisi olan bir kimlik türü bulunmuyor. | P1 |
| G25 | Belge tutarlılığı | `docs/ENTEGRASYON.md` "5 Senaryo" diyor, README 8 tip listeliyor. SPA senaryosunda parolanın tarayıcıya gömüldüğü söylenmiyor. README "Windows/Linux/macOS aynı" diyor ama `0o600` izni Windows'ta etkisiz. | P2 |
| G26 | "Express için eklenti" | `express@^4` doğrudan bağımlılık. Express 5 kullanan host iki kopya Express yükler ve uyumluluk test edilmemiş. | P2 |

---

## 3. Çözüm yol haritası (görev kartları)

Her kartta şu alanlar var: **Dosyalar**, **Sorun**, **Yapılacaklar** (adım adım), **Kabul kriterleri** ve **Testler**.

### FAZ 0 — Güvenlik açısından kritik (P0). Başka bir şeye başlamadan bitir.

---

#### YH2-G03 — `chatAccess: false` gerçekten kapatsın
- **Efor:** S · **Dosyalar:** `src/index.js`, `tests/plugin.test.js`
- **Sorun:** `src/index.js` satır 122: `if (chatAccess === false) return next();`
- **Yapılacaklar:**
  1. Satırı şununla değiştir: `if (chatAccess === false) return res.status(404).json({ error: 'Sohbet uç noktası kapalı.', code: 'CHAT_DISABLED' });`
  2. Aynı mantığı çekirdeğe de taşı: `createLLMManager({ chatAccess })` seçeneği ekle. `handle()` içinde `resource === 'chat'` ve `chatAccess === false` ise `{ status: 404, body: { code: 'CHAT_DISABLED' } }` döndür. Express adaptörü bu seçeneği çekirdeğe iletsin.
- **Kabul:** `chatAccess:false` iken `POST /api/llm/chat` 404 + `CHAT_DISABLED` döner ve `generate` **hiç çağrılmaz**.
- **Testler:** `chatAccess:false` (404, generate çağrılmadı), `chatAccess:'admin'` + `isAdmin:false` kullanıcı (403), `'authenticated'` (200).

---

#### YH2-G02 — Web `fetch` adaptörüne zorunlu kimlik doğrulama
- **Efor:** M · **Dosyalar:** `src/core.js`, yeni `src/auth.js`, `src/index.js`, `src/init.js` (Next/Nuxt/SvelteKit şablonları), testler
- **Sorun:** `fetchHandler` (`src/core.js:271`) kimlik denetimi yapmıyor. Üretilen rotalar herkese açık.
- **Yapılacaklar:**
  1. `src/auth.js` dosyasını oluştur ve `safeEqual` ile Basic Auth ayrıştırmayı `src/index.js` içinden buraya taşı. Framework'ten bağımsız şu fonksiyonu yaz:
     ```js
     // Döner: { ok: true, principal: { isAdmin: true, kind: 'admin' } } | { ok: false }
     export function checkBasicAuth(authorizationHeader, { user = 'admin', password }) { ... }
     ```
     `createBasicAuth` (Express) bu fonksiyonu kullansın.
  2. `fetchHandler` imzası: `fetch(request, { apiPath, pagePath, requireCsrf, adminPassword, adminUser, authorize, insecureNoAuth = false })`
     - `authorize` verilmişse çağır: `async (request) => principal | null`.
     - Verilmemişse ve `adminPassword` varsa (ya da `process.env.LLM_ADMIN_PASSWORD`) `checkBasicAuth` kullan.
     - İkisi de yoksa ve `insecureNoAuth !== true` ise **401 değil 500** döndür, gövde `{ code: 'AUTH_NOT_CONFIGURED' }` olsun ve sunucu konsoluna **bir kez** Türkçe uyarı yaz. Fail-closed davran.
     - Kimlik doğrulanmamışsa `401` dön ve `WWW-Authenticate: Basic realm="LLM Yonetimi"` başlığını ekle. Bu kural sayfa (`/llm`), betik (`/llm/llm-ui.js`) ve API için geçerli.
     - Admin olmayan principal yönetim rotalarında 403 alsın; `/chat` için `chatAccess` kuralları uygulansın (G03 ile aynı mantık).
  3. Seçenekleri `createLLMManager({ adminPassword, adminUser, authorize })` aracılığıyla da kabul et. `fetch` çağrısındaki seçenekler bunları ezsin.
  4. `src/init.js` içindeki Next.js, Nuxt ve SvelteKit `llm.js` şablonlarını şöyle değiştir:
     ```js
     export const llm = createLLMManager({
       dataDir: process.env.LLM_DATA_DIR || './data',
       adminPassword: process.env.LLM_ADMIN_PASSWORD // .env içinde; yoksa yönetim kapalı kalır
     });
     ```
- **Kabul:** Parolasız `fetch(new Request('/api/llm/profiles', {method:'POST',...}))` 401 döner. Doğru Basic başlığıyla 201 döner. Hiç auth yapılandırılmamışsa 500 `AUTH_NOT_CONFIGURED` döner. `/llm` sayfası da 401 döner.
- **Testler:** Bu dört durum + `authorize` geri çağrısının null dönmesi (401) + admin olmayan principal ile `/profiles` (403).

---

#### YH2-G01 + YH2-G24 — Tarayıcıya admin parolası gömmeyi bırak; yalnız sohbet yetkili "istemci belirteci"
- **Efor:** L · **Dosyalar:** `src/auth.js`, `src/index.js`, `src/core.js`, `src/init.js` (SPA, dotnet, python, tauri şablonları), `README.md`, `docs/ENTEGRASYON.md`
- **Sorun:** SPA şablonu admin parolasını paketin içine koyuyor. Basic Auth ile giren herkes admin olduğu için `chatAccess` ayrımının anlamı kalmıyor.
- **Tasarım kararı (uygula):**
  - İki ayrı kimlik türü olacak:
    1. **Admin** (Basic Auth ya da host `requireAuth`): her şeye erişir.
    2. **Chat client token** (`Authorization: Bearer <token>`): **yalnız `POST /chat`** çağırabilir. `profileId`, `timeoutMs` ve `maxOutputTokens` geçersiz kılma alanları bu kimlik için **yok sayılır**. Bu iş YH1-C2'de yapılır, burada yalnız bayrağı hazırla.
  - Belirteçler `chatTokens` seçeneğinden ya da `LLM_CHAT_TOKENS` ortam değişkeninden (virgülle ayrılmış liste) okunur. Karşılaştırma `safeEqual` ile yapılır.
- **Yapılacaklar:**
  1. `src/auth.js` içine `checkBearerToken(header, tokens)` ekle. Başarılı olursa `{ isAdmin: false, kind: 'chat-client' }` döndürsün.
  2. Express adaptöründe: `/chat` rotası için sıra şöyle olsun: önce Bearer kontrolü, başarısızsa normal auth. Bearer ile gelen istek `/chat` dışındaki bir yola giderse 403 döner.
  3. `fetch` adaptöründe de aynı mantığı uygula.
  4. SPA şablonunu değiştir:
     - `LLM_PASS` ve `Authorization: Basic ...` satırlarını **kaldır**.
     - `const LLM_URL = import.meta.env?.VITE_LLM_URL || 'http://127.0.0.1:8010/api/llm/chat';`
     - `const LLM_TOKEN = import.meta.env?.VITE_LLM_CHAT_TOKEN;` (varsa `Authorization: Bearer` gönder)
     - Dosyanın başına şu uyarı yorumunu koy: `// UYARI: Tarayıcıya giden her değer herkese açıktır. Bu belirteç yalnız sohbet yetkilidir; üretimde kendi sunucunuz üzerinden çağırın.`
  5. Sihirbaz SPA senaryosunda rastgele bir sohbet belirteci üretsin (`crypto.randomBytes(24).toString('base64url')`). Belirteci host projenin `.env.local` dosyasına `VITE_LLM_CHAT_TOKEN=...` olarak, yönetim sunucusunun okuyacağı `.env` dosyasına da `LLM_CHAT_TOKENS=...` olarak yazsın (G04/G05'teki `.env` yardımcısını kullan).
  6. C# ve Python şablonları da Basic yerine Bearer sohbet belirteci kullansın ve belirteci ortam değişkeninden okusun (`LLM_CHAT_TOKEN`).
  7. README ve ENTEGRASYON'a bir "Kimlik türleri" tablosu ekle (admin ve sohbet istemcisi; neye erişebilir, nerede saklanır).
- **Kabul:** Üretilen hiçbir istemci dosyasında admin parolası geçmez (testte `!content.includes(password)` kontrol edilir). Bearer belirteciyle `/profiles` 403, `/chat` 200 döner.
- **Testler:** Sayılan durumlar + `chatAccess:'admin'` iken Bearer ile `/chat` çağrısının 403 dönmesi.

---

#### YH2-G04 + YH2-G05 — Sırları koda yazma; `.env` ve `.gitignore` yönetimi
- **Efor:** M · **Dosyalar:** `src/init.js`, `bin/llm-manager.js`, yeni `src/envFile.js`, testler
- **Yapılacaklar:**
  1. `src/envFile.js` dosyasını yaz: `upsertEnv(filePath, { KEY: value })` mevcut satırı günceller ya da yoksa ekler, satır sonunu korur ve dosyayı mümkünse `0o600` izniyle yazar. `ensureGitignore(cwd, ['data/', '.env', '.env.local', '*.key'])` eksik satırları ekler, `.gitignore` yoksa oluşturur. Ek satırları `# llm-manager` yorumuyla grupla.
  2. `bin/llm-manager.js` satır 71: `|| 'admin123'` varsayılanını **kaldır**. Parola verilmemişse `crypto.randomBytes(18).toString('base64url')` ile güçlü bir parola üret.
  3. `initLLMProject` içinde:
     - Tüm şablonlardan `'${password}'` gömmelerini kaldır ve yerine `process.env.LLM_ADMIN_PASSWORD` kullan (C#'ta `Environment.GetEnvironmentVariable`, Python'da `os.environ.get`).
     - Parolayı host projenin `.env` dosyasına `LLM_ADMIN_PASSWORD=...` olarak yaz (`upsertEnv`).
     - Ardından `ensureGitignore` çağır.
     - `ensureNpmScript` artık `"llm": "llm-manager"` yazsın; parolayı ve `--cors *` değerini **yazmasın**. CLI zaten `.env` okuyor.
  4. `runInteractiveInit` parolayı konsola basmasın; bunun yerine "Parola `.env` dosyasında `LLM_ADMIN_PASSWORD` olarak saklandı." yazsın. Kullanıcı `--password` ile kendisi verdiyse de basmasın.
  5. CLI yardım metnine şu uyarıyı ekle: "`--password` komut satırı geçmişine düşer; `.env` ya da ortam değişkeni önerilir."
  6. `verifyIntegration` içine yeni bir kontrol ekle: `id: 'secrets_ignored'`. `.gitignore` içinde `data/` ve `.env` yoksa başarısız olsun.
- **Kabul:** `init -y` çalıştıktan sonra şunlar sağlanır: (a) host projede `grep -r <parola>` yalnız `.env` içinde eşleşir, (b) `.gitignore` gerekli satırları içerir, (c) `package.json` içinde parola yoktur.
- **Testler:** Her proje tipi için (express ESM/CJS, spa, nextjs, nuxt, sveltekit, electron, dotnet, python) geçici dizinde `initLLMProject` çalıştır ve tüm dosyalarda parola araması yap.

---

#### YH2-G06 — `--cors *` ile kimlik bilgili istekleri yasakla
- **Efor:** S · **Dosyalar:** `examples/server.js` (YH1-A2'den sonra `src/server.js`), `src/init.js`, testler
- **Yapılacaklar:**
  1. CORS ara katmanında `*` seçildiğinde:
     - `Access-Control-Allow-Origin: *` gönder, **`Allow-Credentials` gönderme**, origin yansıtma.
     - İzinli başlıklar `Content-Type, Authorization, X-LLM-CSRF` olsun.
     - `*` modunda **yalnız `/api/llm/chat`** için CORS başlığı ekle. Yönetim rotaları cross-origin'e kapalı kalsın.
  2. Açık origin listesi verildiğinde mevcut davranışı koru ama listeyi doğrula: her girdi `new URL()` ile ayrıştırılabilmeli ve `origin` alanı kendisine eşit olmalı.
  3. Sihirbaz hiçbir senaryoda `*` üretmesin. SPA senaryosunda Vite projesi algılanırsa `http://localhost:5173` yazsın, diğer durumlarda kullanıcıya sorsun.
- **Kabul:** `--cors *` iken `Origin: https://evil.example` ile `GET /api/llm/profiles` yanıtında `Access-Control-Allow-Origin` başlığı **yer almaz**.
- **Testler:** `*` modunda `/chat` ve `/profiles` başlık farkı; listede olan ve olmayan origin.

---

#### YH2-G07 — npm ad çakışması / tedarik zinciri riski
- **Efor:** S (karar) + S (uygulama) · **Dosyalar:** `package.json`, `README.md`, `docs/ENTEGRASYON.md`, `src/init.js` şablonları, `bin/`
- **✅ KARAR ONAYLANDI (proje sahibi, 2026-10-23):** Paket adı **`@sirrakadembasti/llm-manager`** olacak (scoped). Bu kırıcı bir değişikliktir ve **v2.0.0** ile yayımlanacak. CLI komut adı (`bin`) `llm-manager` olarak **kalır**. GitHub deposu adı ve URL'si (`sirrakadembasti/llm-manager`) değişmez.
- **Yapılacaklar:**
  1. `package.json#name` → `"@sirrakadembasti/llm-manager"`. `publishConfig: { "access": "public" }` ekle (scoped paketler npm'de varsayılan olarak özeldir). `bin: { "llm-manager": "bin/llm-manager.js" }` aynen kalsın.
  2. Şablonlardaki (`src/init.js`) tüm `from '@sirrakadembasti/llm-manager'`, `'llm-manager/core'`, `import('@sirrakadembasti/llm-manager')` ve `require('@sirrakadembasti/llm-manager')` ifadelerini yeni adla değiştir. Adı elle yazma; tek bir sabitten üret:
     ```js
     import { readFileSync } from 'node:fs';
     const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;
     // şablonlarda: `import { createLLMManager } from '${PKG}/core';`
     ```
  3. Paket kurulu mu kontrolü (YH2-G20) ve testlerdeki junction yolları scoped ad için `node_modules/@sirrakadembasti/llm-manager` olur. `path.join(cwd, 'node_modules', ...PKG.split('/'))` kullan; scope klasörünü (`@sirrakadembasti`) önce oluştur.
  4. `injectIntoEntryFile` içindeki "zaten entegre" tespiti ve `verifyIntegration` kontrolleri ad değişikliğinden etkilenmez (yardımcı fonksiyon adlarına bakıyorlar). Bunu bir testle doğrula.
  5. README ve ENTEGRASYON:
     - Kurulum komutu: `npm install github:sirrakadembasti/llm-manager#v2.0.0`. Bu komut paketi `package.json#name` adıyla, yani `@sirrakadembasti/llm-manager` olarak kurar.
     - Import örnekleri: `import { mountLLMManagement } from '@sirrakadembasti/llm-manager';` ve `'@sirrakadembasti/llm-manager/core'`.
     - **Tüm** `npx llm-manager ...` örneklerini ya `npx github:sirrakadembasti/llm-manager#v2.0.0 ...` biçimine çevir ya da "paket projeye kurulduktan sonra `npx llm-manager ...`" diye açıkça belirt.
     - Bir **"1.x'ten 2.0'a geçiş"** bölümü ekle: (a) `npm uninstall llm-manager`, (b) yeni adla kurulum, (c) importları `rg "from '@sirrakadembasti/llm-manager" -l` ile bulup değiştirme, (d) `data/` klasörü ve şifreleme anahtarı **değişmez**, profiller aynen çalışır.
  6. Paket README'sinin başına bir uyarı koy: "npm'deki `llm-manager` paketi bu projeyle ilgili değildir."
  7. CHANGELOG `[Unreleased]` → `### Changed` altına **BREAKING** notu ekle. Sürüm, Faz 0 ve Faz 1 tamamlandığında `npm run release:major` ile **2.0.0** yapılır. G22'deki purpose yeniden adlandırması ve A1'deki init re-export kaldırma da bu sürüme dahil edilir.
  8. `GEMINI.md` içindeki "paket adı `llm-manager`" ifadesini yeni adla güncelle.
- **Kabul:**
  - `rg "from '@sirrakadembasti/llm-manager|require\('llm-manager|import\('llm-manager" src docs README.md` eşleşme vermez.
  - README ve ENTEGRASYON'da çıplak `npx llm-manager init` komutu "kurulduktan sonra" notu olmadan geçmez.
  - Geçici bir projede `npm install <depo yolu>` sonrası `node -e "import('@sirrakadembasti/llm-manager/core').then(m=>console.log(typeof m.createLLMManager))"` komutu `function` yazar.
  - `npx llm-manager --version` (yerel kurulumdan) yeni sürümü gösterir.

---

### FAZ 1 — Vaat edilen senaryolar çalışsın (P1)

---

#### YH2-G08 — Store sözleşmesini async yap (geriye uyumlu)
- **Efor:** M · **Dosyalar:** `src/core.js`, `README.md`, testler
- **Yapılacaklar:**
  1. `core.js` içindeki **her** `store.*` çağrısını `await` ile yap: `list`, `get`, `getActive`, `save`, `remove`, `activate`, `recordTest`. Senkron dosya deposu da çalışmaya devam eder (`await` senkron değeri olduğu gibi döndürür).
  2. `guarded` yardımcısını async yap: `const guarded = async (fn, status=200) => { try { return ok(await fn(), status); } catch (e) { return profileError(e); } };`
  3. `testProfile` içindeki `recordTest(...) === null` karşılaştırmasını `await` sonrasına taşı.
  4. README'deki "host deposu" bölümüne bir arayüz tablosu ekle (metot, parametre, dönüş tipi, fırlatması gereken hata kodları) ve tüm metotların Promise dönebileceğini yaz.
  5. `examples/memory-store.js` dosyası oluştur: Map tabanlı async bir depo. Şifreleme hostta kalır; örnekte `apiKey` bellekte tutulur ve bu durum yorumda belirtilir.
- **Kabul:** Async depo ile tüm CRUD, test ve sohbet akışları geçer.
- **Testler:** Mevcut CRUD testini async depo sarmalayıcısıyla (`wrapAsync(store)`) bir kez daha çalıştır.

---

#### YH2-G11 — Eklenti kendi gövde ayrıştırıcısını kullansın
- **Efor:** S · **Dosyalar:** `src/index.js`, testler
- **Yapılacaklar:**
  1. `Router()` oluşturulduktan hemen sonra (auth'tan önce değil, auth'tan sonra) şunu ekle: `router.use(express.json({ limit: bodyLimit }))`. Yeni seçenek `bodyLimit = '256kb'`.
  2. Host zaten ayrıştırdıysa (`req._body === true` ya da `req.body` nesneyse) `express.json` bunu atlar; ek bir şey yapma.
  3. Ayrıştırma hatasını (400/413) JSON olarak döndür: `{ code: 'BODY_INVALID' | 'BODY_TOO_LARGE' }`.
- **Kabul:** Doğrulama betiğindeki 3 numaralı senaryo 201 döner.
- **Testler:** Ayrıştırıcının sonra bağlandığı senaryo; 300kb gövde → 413 `BODY_TOO_LARGE`.

---

#### YH2-G10 — Express CommonJS şablonunu senkron yap
- **Efor:** S · **Dosyalar:** `src/init.js` (CJS express ve electron şablonları), testler
- **Gerekçe:** `engines.node >= 22.12` olduğu için `require()` ile ESM yüklenebiliyor (top-level await olmadığı sürece). Paketin `src/` grafiğinde top-level await **yok**; bunu koru ve bir testle kilitle.
- **Yapılacaklar:**
  1. CJS şablonu:
     ```js
     const { mountLLMManagement, createLLMManager } = require('<PKG>');
     let activeManager = null;
     function setupLLM(app, options = {}) {
       activeManager = mountLLMManagement(app, { dataDir: process.env.LLM_DATA_DIR || './data', adminPassword: process.env.LLM_ADMIN_PASSWORD, ...options });
       return activeManager;
     }
     async function askLLM(prompt, options = {}) {
       if (!activeManager) activeManager = createLLMManager({ dataDir: process.env.LLM_DATA_DIR || './data' });
       return activeManager.ask(prompt, options);
     }
     module.exports = { setupLLM, askLLM };
     ```
  2. Test: geçici bir CJS projesi oluştur, `node_modules/<PKG>` altına bu depoya işaret eden bir symlink/junction koy (Windows'ta `fs.symlinkSync(target, link, 'junction')`). `node -e "require('./llm.js')"` çalıştırıp hata olmadığını doğrula.
  3. `src/` içinde top-level await olmadığını doğrulayan bir test yaz: tüm `src/*.js` dosyalarında satır başında `await` arayan basit bir regex.
- **Kabul:** CJS host'ta `setupLLM(app)` senkron döner ve rotalar host'un 404 katmanından önce kaydedilir.

---

#### YH2-G09 — Nuxt / SvelteKit / Next istemci bileşenlerine sunucu modülü enjekte etme
- **Efor:** M · **Dosyalar:** `src/init.js`, testler, `docs/ENTEGRASYON.md`
- **Yapılacaklar:**
  1. **SvelteKit:** yardımcıyı `src/lib/server/llm.js` dosyasına yaz. Rota importlarını `$lib/server/llm.js` olarak değiştir. `+page.svelte` dosyasına **enjeksiyon yapma**. Bunun yerine örnek dosya `src/routes/api/ask/+server.js` üret (POST → `askLLM`).
  2. **Nuxt 3:** yardımcıyı `server/utils/llm.js` dosyasına yaz (Nuxt bunu sunucu tarafında otomatik import eder). Rota dosyaları `import { llm } from '../../utils/llm.js'` kullansın. `app.vue` ya da `pages/*.vue` dosyalarına **enjeksiyon yapma**.
  3. **Next.js:** `llm.js` dosyasının ilk satırına `import 'server-only';` ekleme seçeneğini değerlendir (bu ek bir bağımlılıktır; `server-only` paketi yoksa ekleme). Hedef dosyanın ilk anlamlı satırı `'use client'` ise enjeksiyonu **atla** ve kullanıcıya bilgi ver: "İstemci bileşenine sunucu modülü eklenemez; Server Action ya da route handler kullanın." Bir örnek Server Action dosyası (`app/actions/llm.js`, `'use server'`) üret.
  4. **SPA:** değişiklik yok (tarayıcı istemcisi zaten HTTP ile çalışıyor).
  5. `injectIntoEntryFile` ve `verifyIntegration` testlerini bu yeni davranışa göre güncelle.
- **Kabul:** Hiçbir `.vue`, `.svelte` ya da `'use client'` dosyasına `node:fs` zincirine sahip bir import eklenmez.

---

#### YH2-G12 — Gerçek işlem (transaction) tabanlı rollback
- **Efor:** M · **Dosyalar:** `src/init.js`
- **Yapılacaklar:**
  1. `createChangeJournal()` yaz. Dosyaya her yazmadan önce önceki durumu kaydetsin: dosya yoksa `{ path, existed: false }`, varsa `{ path, existed: true, content }`.
  2. `writeFileIfMissing`, `ensureNpmScript`, `upsertEnv`, `ensureGitignore` ve `injectIntoEntryFile` journal üzerinden yazsın.
  3. `journal.rollback()` çağrıldığında: önceden olmayan dosyaları siler, var olanları eski içeriğiyle geri yazar ve yeni oluşan boş klasörleri temizler.
  4. `runInteractiveInit` içinde rollback şu durumlarda önerilir: 2. adımda "hayır" denirse **ve** 3. adımda doğrulama başarısız olursa ("Değişiklikler geri alınsın mı? (E/h)"). `-y` modunda doğrulama başarısızsa otomatik geri al.
- **Kabul:** Rollback sonrası proje dizininin dosya ağacı ve içerikleri init öncesiyle **birebir** aynıdır. Test bunu dizin anlık görüntüsü (hash listesi) karşılaştırarak doğrular.

---

#### YH2-G17 — Proje algılamayı güvenli hale getir
- **Efor:** M · **Dosyalar:** `src/init.js`, testler
- **Yapılacaklar:**
  1. `detectProjectType` yeni tipleri tanısın: `fastify`, `koa`, `hono`, `@nestjs/core` ve `tauri` (Tauri artık Electron'dan ayrı). Bu tiplerde **otomatik enjeksiyon yapılmaz**. Sihirbaz yardımcı dosyayı üretir ve framework'e özel elle kurulum talimatını yazdırır (`llm.fetch(request)` ya da `llm.handle()` örneği).
  2. `package.json` var ama tanınan bir framework yoksa `'express'` varsayma. `'unknown'` dön ve kullanıcıdan `--type` iste (`-y` modunda hata ver).
  3. `readPkgMain`: yolu `dist/`, `build/`, `out/`, `.next/` ya da `lib/` ile başlıyorsa (veya `.min.js` ile bitiyorsa) **aday sayma**.
  4. Aday listelerine TypeScript dosyalarını ekle: `server.ts`, `app.ts`, `index.ts`, `src/server.ts`, `src/app.ts`, `src/index.ts`, `src/main.ts`. Hedef `.ts` ise yardımcı dosya `llm.ts` değil `llm.js` olarak kalabilir, fakat import yolu ESM/TS kurallarına uymalı (`'./llm.js'`).
  5. `.csproj` **ve** `package.json` birlikte bulunuyorsa (ör. ASP.NET + SPA) kullanıcıya hangisini istediğini sor.
- **Kabul:** Fastify projesinde `server.js` dosyasına dokunulmaz. `main: "dist/index.js"` olan projede `dist/` değiştirilmez.

---

#### YH2-G14 — C# şablonu: .NET Framework ve modern .NET ayrımı
- **Efor:** M · **Dosyalar:** `src/init.js`, testler
- **Yapılacaklar:**
  1. `.csproj` dosyasını oku. `<TargetFramework>net(5|6|7|8|9|10)` ya da `netcoreapp` görülürse **modern** şablonu, `<TargetFrameworkVersion>v4.x` ya da `Web.config` + `Global.asax` görülürse **netfx** şablonunu seç.
  2. **Modern şablon:** mevcut kodu kullan. Ek olarak: `HttpClient` zaman aşımı `TimeSpan.FromSeconds(330)`; URL `Environment.GetEnvironmentVariable("LLM_MANAGER_URL") ?? "http://127.0.0.1:8010/api/llm/chat"`; belirteç `LLM_CHAT_TOKEN` değişkeninden okunur; yanıt JSON değilse anlamlı bir `InvalidOperationException` fırlatılır; `CancellationToken` parametresi eklenir.
  3. **Netfx şablonu (C# 7.3):** `using var` kullanma, `using (...) { }` kullan. JSON için `System.Runtime.Serialization.Json.DataContractJsonSerializer` kullan (ek NuGet gerektirmez) ya da basit DTO sınıfları tanımla.
  4. Eski tip csproj'da (`<Compile Include=` içeren dosyada) `<Compile Include="LlmClient.cs" />` satırını ilk `<ItemGroup>` içine ekle (journal üzerinden yaz).
  5. Tespit edilen hedef çatıyı sihirbaz çıktısında göster.
- **Kabul:** Netfx şablonunda `using var` ve `System.Text.Json` geçmez. CI'da dotnet SDK varsa `dotnet build` ile modern şablon derlenir (opsiyonel iş, YH1-F2).

---

#### YH2-G15 + YH2-G16 — Tauri ve Electron senaryolarını gerçekçi hale getir
- **Efor:** M · **Dosyalar:** `src/init.js`, `docs/ENTEGRASYON.md`
- **Yapılacaklar:**
  1. **Tauri:** ayrı tip olsun. Tauri arka ucu Rust olduğundan Node modülü eklenemez. SPA istemcisi gibi `src/llm.js` (HTTP + sohbet belirteci) üretilsin. Yönetim sunucusunun ayrı süreçte (`npm run llm`) çalıştırılması gerektiği belgelensin. README tablosunda "Tauri: HTTP istemcisi (yönetim sunucusu ayrı süreç)" diye yaz. Yapılamıyorsa README'den Tauri iddiasını kaldır.
  2. **Electron `llm.js` şablonu:**
     ```js
     import { app } from 'electron';
     import path from 'node:path';
     export const llm = createLLMManager({ dataDir: path.join(app.getPath('userData'), 'llm') });
     ```
     Modül `app` hazır olmadan yüklenebileceği için yöneticiyi tembel oluştur: `getManager()` ilk çağrıda yaratsın.
  3. `preload.js` örneği üret (varsa dokunma):
     ```js
     const { contextBridge, ipcRenderer } = require('electron');
     contextBridge.exposeInMainWorld('llm', { ask: (prompt, options) => ipcRenderer.invoke('llm:ask', prompt, options) });
     ```
     Kullanıcıya `webPreferences.preload` ayarını yapmasını söyle. Renderer kullanımını `await window.llm.ask('...')` olarak belgele.
  4. `registerLLMIpc` içinde `options` parametresini filtrele: yalnız `system` geçsin. Renderer'dan `profileId`/`timeoutMs` gelmesin.
  5. Paketlenmiş uygulamada anahtar girmek için `openLLMPanel()` yardımcısı ekle: rastgele portta yalnız `127.0.0.1` dinleyen geçici bir Express sunucusu başlatır, oturumluk rastgele bir parola üretir ve bir `BrowserWindow` içinde `http://admin:<pw>@127.0.0.1:<port>/llm` açar. (Alternatif: parolayı `session.webRequest.onBeforeSendHeaders` ile ekle; URL'de kimlik bilgisi taşımamak tercih edilir.)
- **Kabul:** Electron şablonunda `'./data'` geçmez. Tauri projesinde `ipcMain` içeren kod üretilmez.

---

#### YH2-G19 — Python / C# istemcileri ve yönetim sunucusunun kalıcı çalıştırılması
- **Efor:** M · **Dosyalar:** `src/init.js` (python şablonu), `docs/ENTEGRASYON.md`, yeni `docs/DEPLOY.md`
- **Yapılacaklar:**
  1. Python şablonu: `os.environ.get('LLM_MANAGER_URL', 'http://127.0.0.1:8010/api/llm/chat')` ve `LLM_CHAT_TOKEN` kullansın. `urlopen(req, timeout=330)` ile çağırsın. `urllib.error.HTTPError` yakalansın, gövdedeki JSON `error`/`code` alanları ayrıştırılıp `LLMError(Exception)` (code, status alanlarıyla) fırlatılsın. `data.get("content") or data.get("text")` kullanılsın.
  2. `docs/DEPLOY.md` yaz: yönetim sunucusunu (a) pm2, (b) systemd unit, (c) Windows hizmeti (NSSM ya da `sc.exe`), (d) Docker ile çalıştırma (YH1-D3 Dockerfile). Her biri kopyalanabilir komutlarla.
  3. Python dosyası için `verifyIntegration` içinde, `python`/`py` bulunursa `py_compile` kontrolü çalıştır. Bulunamazsa uyarı ver ama başarısız sayma.
- **Kabul:** Python istemcisi 401 aldığında Türkçe hata mesajıyla `LLMError` fırlatır. Bu, mock HTTP sunucusuyla birim testinde doğrulanabilir (python yoksa test atlanır).

---

#### YH2-G18 — Next.js özel durumları
- **Efor:** S · **Dosyalar:** `src/init.js`, `docs/ENTEGRASYON.md`
- **Yapılacaklar:**
  1. `@/` alias'ını varsaymadan önce `tsconfig.json`/`jsconfig.json` içinde `compilerOptions.paths['@/*']` var mı kontrol et. Yoksa göreli import kullan.
  2. `next.config.(js|mjs|ts)` varsa kullanıcıya `serverExternalPackages: ['<PKG>']` eklemesini öner. Kullanıcı onaylarsa basit desen eşleşmesiyle ekle; eşleşme bulunamazsa elle talimat ver.
  3. Belgeye "Sunucusuz (Vercel/Netlify) ortamlarda dosya deposu yazılamaz; kalıcı disk ya da host deposu (`store`) gerekir" uyarısını ekle.
  4. `runtime = 'edge'` tespit edilirse uyar: paket `node:fs` ve `undici` gerektirir.

---

#### YH2-G20 — Sihirbaz paketin kurulu olduğunu doğrulasın / kursun
- **Efor:** S · **Dosyalar:** `src/init.js`
- **Yapılacaklar:**
  1. Node tabanlı tiplerde `require.resolve`/`import.meta.resolve` yerine `fs.existsSync(path.join(cwd,'node_modules',PKG,'package.json'))` kontrolü yap.
  2. Paket yoksa sor: "Paket projeye kurulsun mu? (`npm install github:sirrakadembasti/llm-manager#v<sürüm>`)". Onaylanırsa `execFileSync('npm', [...], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })` çalıştır.
  3. `verifyIntegration` içine `id: 'package_installed'` kontrolünü ekle.

---

#### YH2-G21 — Kısa testte akıl yürüten modellerin yanlış negatifleri
- **Efor:** S · **Dosyalar:** `src/runtime.js`, `src/core.js`, testler
- **Yapılacaklar:**
  1. `generateProfileResponse` içine `options.acceptTruncated` bayrağı ekle. Bayrak açıksa `finishReason` kesilme belirtse bile HTTP 200 ve geçerli JSON yanıt "bağlantı doğrulandı" sayılsın: `{ content: content || '', truncated: true }`. Bu fonksiyon bugün string dönüyor; geriye uyum için yeni bir iç fonksiyon `callProvider()` yaz, `{ content, finishReason, usage }` dönsün. `generateProfileResponse` bunu sarmalasın.
  2. Kısa testte (`mode === 'quick'`) `acceptTruncated: true` kullan ve mesajı şöyle yaz: "Bağlantı ve kimlik doğrulandı (model düşünme nedeniyle yanıtı kısa kesti; sohbet testini çalıştırın)."
  3. OpenAI uyumlu yanıtta `message.content` boşsa ama `message.reasoning_content` doluysa kısa testte bunu başarı say.
- **Kabul:** `finish_reason: 'length'` ve boş içerikli mock yanıt kısa testte `passed` sayılır, sohbet testinde `LLM_TRUNCATED` döner.

---

### FAZ 2 — Belge ve bağımsızlık tutarlılığı (P2)

---

#### YH2-G22 — XFactor kalıntılarını tamamen temizle
- **Efor:** S · **Dosyalar:** `src/core.js`, `src/runtime.js`, `public/llm.html`, `public/llm-ui.js`, `README.md`, testler
- **Yapılacaklar:**
  1. `defaultTestMessages('conversation')` içeriğini nötr hale getir:
     - system: `'Yardımsever bir asistansın. Kısa ve doğru yanıt ver.'`
     - user: `'Bir web uygulamasında kullanıcı kimlik doğrulaması için üç temel güvenlik önlemini maddeler halinde yaz.'`
  2. `useManagedProfile` ve `allowMockFallback` alanlarını `options` nesnesinden **kaldır**. Bu alanlar başka hiçbir yerde kullanılmıyor; yalnız `generate` adaptörlerine sızıyorlar. CHANGELOG'a "custom generate adaptörlerine artık iletilmiyor" notunu düş.
  3. `purpose` değerlerini yeniden adlandır: `'quick' | 'diagnostic' | 'default'`. Geriye uyum: `'manager'` → `'diagnostic'`, `'production'` → `'default'` (kabul et, `process.emitWarning` ile bir kez uyar).
  4. Arayüz metinleri: "Manager ve ajanların kullandığı profil" → "Uygulamanın kullandığı etkin profil". "Otomatik mod Manager'ın hızlı denemelerinde…" → "Otomatik mod; testlerde düşünmeyi kapatır, normal çağrılarda modelin varsayılanını kullanır."
  5. README §"Gecikme ve dış sebepler" metnini yeni adlara göre güncelle.
- **Kabul:** `rg -i "manager ajan|ajanlar|otel|useManagedProfile|allowMockFallback|'production'" src public README.md` sonuç vermez (`NODE_ENV === 'production'` kontrolü hariç).

---

#### YH2-G23 — Model kataloğu güncelliği
- Ayrıntılı uygulama: **YH1-C10**. Bu belgede yapılacak tek iş: README'deki "varsayılan model listeleri" ifadesinin yanına "katalog tarihi: YYYY-AA; güncel liste için **Modelleri getir** kullanın" notunu ekle.

---

#### YH2-G25 — Belge hizalaması
- **Efor:** S · **Dosyalar:** `README.md`, `docs/ENTEGRASYON.md`
- **Yapılacaklar:**
  1. ENTEGRASYON başlığını "Entegrasyon Kılavuzu" yap. Senaryo listesini README tablosuyla birebir aynı tut (8–10 tip).
  2. Her senaryoya bir **"Güvenlik ve sınırlar"** kutusu ekle (`> [!WARNING]`): kimlik türü, nerede çalışır (yerel/üretim), sunucusuz uyumluluk, ayrı süreç gereksinimi.
  3. README'ye bir **"Desteklenen ortamlar matrisi"** ekle (tip × üretime uygun mu × ayrı süreç gerekir mi × otomatik enjeksiyon var mı).
  4. Windows notu: "Dosya izinleri (0600) Windows'ta uygulanmaz; `data/` klasörünü yalnız uygulama kullanıcısının erişebileceği bir konuma koyun."

---

#### YH2-G26 — Express 4/5 uyumu ve bağımlılık modeli
- Ayrıntı: **YH1-A1** (express → `peerDependencies`). Bu belgede yapılacak iş: Express 5 ile entegrasyon testini (YH1-F2) ekleyip README'de "Express 4.19+ ve 5.x" diye belirtmek.

---

## 4. Tamamlanma kontrol listesi (Faz sonu)

- [x] Faz 0 + G08 + G11 doğrulama betiği: `node docs/roadmap/dogrulama.mjs` beklenen değerleri verdi (1: 404, 2a: liste, 2b: 409, 3: 201, 4: 500). Bu, G08/G11'in tüm kabul kapsamının yeniden kapatıldığı anlamına gelmez.
- [x] Faz 0 sır denetimi: Express ESM/CJS, SPA, Next, Nuxt, SvelteKit, Electron, .NET, Python ve Tauri yardımcılarında parola yalnız `.env` içinde; `.gitignore` güncel. Otomatik onaylı SPA kurulumu ve logları ayrıca test edildi.
- [ ] Faz 1 sonunda: Express ESM, Express CJS ve Express 5 host'larında gerçek HTTP ile `/llm` 200 ve `POST /api/llm/profiles` 201 dönüyor (entegrasyon testi).
- [ ] Faz 1 sonunda: Async store ile tüm testler geçiyor.
- [ ] Faz 2 sonunda: README ↔ ENTEGRASYON ↔ kod arasında çelişki yok. XFactor araması temiz.
- [ ] Her faz sonunda `npm test` yeşil, CHANGELOG `[Unreleased]` güncel ve `GEMINI.md` "Durum" bölümü güncellendi.
- [x] FAZ 0 sonunda `npm test` 195/195, lint/typecheck/format kontrolleri yeşil; CHANGELOG ve GEMINI güncel. Sonraki fazların kapanışı ayrıdır.

## 5. Genel uygulama sırası (iki belge birlikte)

1. **YH2 Faz 0:** G03 → G02 → G04+G05 → G06 → G01+G24 → G07
2. **YH1 Faz A:** A1 → A2 → A4 (sonraki işler bunların üzerine kurulur)
3. **YH2 Faz 1:** G08 → G11 → G10 → G09 → G12 → G17 → G20 → G21 → G14 → G15+G16 → G19 → G18
4. **YH1 Faz B ve C (P1 görevler)**
5. **YH2 Faz 2** ve **YH1 Faz D, E, F**
6. Büyük sürüm yayını (`npm run release:major`): ad değişikliği ve purpose yeniden adlandırması nedeniyle **2.0.0**.
