# Entegrasyon kılavuzu

Node.js **22.12+** gerekir. Paket `@sirrakadembasti/llm-manager`, yerel komut `llm-manager`.

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

`--type` ile tür seçilebilir; `--help` tüm seçenekleri gösterir. Paket kurulmadan çıplak `npx llm-manager` kullanmayın. 1.x geçişinde eski paketi kaldırıp importları scoped ada taşıyın; CLI/veri/anahtar korunur. Yerel 2.0.0, yayımlanmış bir sürüm etiketi değildir.

Sihirbaz değişiklikleri onayla uygular. `-y` başarısız doğrulamada scaffold'u geri alır. Ayrı onaylanan bağımlılık kurulumunun node_modules/lockfile değişiklikleri rollback'e dahil değildir. `dist`, `build`, `out`, `.next`, `lib` çıktıları enjeksiyon hedefi değildir; belirsiz projede türü açık seçin.

## Desteklenen ortamlar

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

Express ESM/CJS/TypeScript; SPA React/Vue/Vite/Angular/Svelte; Next App Router desteklenir. Gruplanmış framework değerlerinden tek tip seçin: ör. `--type hono`. Core Express gerektirmez; Express adaptörü/CLI sunucusu optional peer'ı ayrıca ister. Paketsiz statik SPA yalnız HTTP yardımcısı üretir.

## Kimlik ve ortak sınırlar

Admin Basic/host principal yönetim+sohbet içindir; Bearer yalnız `POST /api/llm/chat` yetkisidir. Üretilen parola `.env` içinde `LLM_ADMIN_PASSWORD`, sunucu belirteçleri `LLM_CHAT_TOKENS`, istemci belirteci `LLM_CHAT_TOKEN` olur. SPA geliştirmesi `.env.local` içindeki `VITE_LLM_CHAT_TOKEN` kullanır. Tarayıcı/masaüstü paketindeki belirteç herkese açıktır; üretimde kendi backend'inizde kimlik doğrulayın.

Yazma istekleri `X-LLM-CSRF: 1` ister. Vite için localhost:5173 seçilir; diğer SPA/Tauri projelerinde origin sorulur. `--cors`/`LLM_ALLOWED_ORIGINS` ile açık http/https origin verin; `-y` ve izinsiz origin CORS açmaz. Sihirbaz wildcard kabul etmez; CLI wildcard yalnız sohbet içindir ve credentials taşımaz.

Dosya deposu Promise döndürür; `await` kullanın. Yerel disk kilidi NFS/SMB garantisi değildir. Dosya izinleri (0600) Windows'ta uygulanmaz; `data/` klasörünü yalnız uygulama kullanıcısının erişebileceği bir konuma koyun. Profil ve şifreleme anahtarını birlikte yedekleyin.

## Express

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';
const app = express();
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD,
  chatTokens: process.env.LLM_CHAT_TOKENS
});
app.listen(3000);
// Sunucuda: await llm.ask('Merhaba');
```

Eklenti JSON parser'ı auth sonrasına bağlar. `requireAuth` ile host session kullanılabilir; yönetim `req.user.isAdmin === true` ister. CJS helper Node >=22.12'de senkron kurulur; host 404 katmanından önce çağrılır.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Basic/host session, sohbet Bearer. **Çalışma:** Kalıcı disk/store ile Node.
> **Sunucusuz:** Node + kalıcı host store; Edge yok. **Ayrı süreç:** Gerekmez. `trust proxy`/`req.ip` hostun sorumluluğudur.

## SPA

Yardımcıdaki `askLLM(prompt)` veya doğrudan HTTP kullanın:

```js
const response = await fetch('http://127.0.0.1:8010/api/llm/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', 'X-LLM-CSRF': '1',
    Authorization: `Bearer ${import.meta.env.VITE_LLM_CHAT_TOKEN}`
  },
  body: JSON.stringify({ prompt: 'Merhaba' })
});
const result = await response.json();
```

Node hostunda `npm run llm` veya kurulu paketin `npx llm-manager` komutuyla ayrı sunucuyu çalıştırın. Statik/paketsiz projede bu sunucuyu ayrıca kurun.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Sohbet Bearer; admin parolası tarayıcıya verilmez. **Çalışma:** Üretimde kendi backend'iniz.
> **Sunucusuz:** Statik istemci olabilir; yönetim sürekli Node/kalıcı depo ister. **Ayrı süreç:** Gerekir.

## Next.js

`llm.js`, sunucu route handler'ları ve `app/actions/llm.js` üretilir. Client component'e import eklenmez; kuruluysa `server-only` kullanılır. Route importları göreli, runtime `nodejs` olur. Üst `app/layout.*` / `src/app/layout.*` dosyalarında Edge seçilmediğini de kontrol edin.

`serverExternalPackages: ['@sirrakadembasti/llm-manager']` gerekir. Sihirbaz basit literal nesne/dizileri onayla düzenler; diğer paketleri korur. Wrapper/spread/dinamik config'i çalıştırmaz; elle talimat verir. Örnek Server Action, host yetkilendirmesi kurulana kadar kapalıdır.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Admin/host authorize; sohbet Bearer. **Çalışma:** Node App Router.
> **Sunucusuz:** Kalıcı host store gerekir; Edge yok. **Ayrı süreç:** Gerekmez. Varsayılan dosya deposunu geçici/salt okunur diskte kullanmayın.

## Nuxt

`server/utils/llm.js` ve sunucu rotaları kullanılır; `.vue` istemci sayfasına sunucu importu eklenmez. İstemci HTTP üzerinden çağırır; sunucuda `askLLM()` kullanılabilir.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Admin/host principal, sohbet Bearer. **Çalışma:** Node sunucusu.
> **Sunucusuz:** Node adaptörü + kalıcı host store; Edge yok. **Ayrı süreç:** Gerekmez. Sunucu modülü/sır istemciye taşınmaz.

## SvelteKit

Yardımcı `src/lib/server/llm.js`; HTTP rotaları `+server.js` olur. `api/ask` örneği method/gövde/kimliği koruyarak `llm.fetch()` ile chat politikasına delege eder; herkese açık ücretli `ask()` rotası açmaz.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Admin/host principal, sohbet Bearer. **Çalışma:** Node adaptörü.
> **Sunucusuz:** Kalıcı host store; Edge yok. **Ayrı süreç:** Gerekmez. `.svelte` istemcisine sunucu importu eklenmez.

## Electron

Ana süreç `app.whenReady()` sonrasında `app.getPath('userData')/llm` deposunu açar. `registerLLMIpc(ipcMain)` ve üretilen `preload.cjs` bağlanır; renderer `window.llm.ask(prompt)` çağırır. `openLLMPanel()` loopback/rastgele portlu yönetim penceresini açar.

Oturum parolası yalnız aynı HTTP origin'inin proxy olmayan Basic challenge'ına verilir. Dış gezinme/yönlendirme/yeni pencere engellenir. Mevcut preload korunur; sohbet IPC yalnız metin `system` seçeneğini iletir.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Ana süreç admin; renderer sınırlı sohbet IPC. **Çalışma:** userData deposuyla masaüstü.
> **Sunucusuz:** Uygun değil. **Ayrı süreç:** Gerekmez. `contextIsolation: true`, `nodeIntegration: false`; güvenilmeyen sayfaya IPC yetkisi vermeyin.

## Tauri

Rust arka ucuna Node/Electron IPC kodu eklenmez. SPA HTTP yardımcısı ayrı Node yönetim sunucusuna bağlanır.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Sohbet Bearer; admin ayrı sunucuda. **Çalışma:** HTTP istemcisi, üretimde kendi backend'iniz.
> **Sunucusuz:** Yönetim sürekli Node/kalıcı depo ister. **Ayrı süreç:** Gerekir. Pakete gömülü belirteç herkese açıktır.

## Fastify, Koa, Hono ve NestJS

Helper hazırlanır; host girişine otomatik framework kodu eklenmez. Web Request varsa `llm.fetch(request)`; yoksa doğrulanmış principal/method/path/body ile `llm.handle()` sonucunu host yanıtına çevirin.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Host session/token ve admin/sohbet ayrımı. **Çalışma:** Elle Node adaptörü.
> **Sunucusuz:** Node + kalıcı host store; Edge yok. **Ayrı süreç:** Gerekmez. `handle()`/`ask()` HTTP kimliği doğrulamaz; doğrudan anonim isteğe açmayın.

## Python

`llm_client.py`: `ask_llm('Merhaba')`. `LLM_MANAGER_URL` ve `LLM_CHAT_TOKEN` okur; timeout 330 sn. Hatalar Türkçe `LLMError` içinde status/code taşır; JSON olmayan/nesne olmayan gövdeler güvenle ele alınır. Python `.env` yüklemez; servis ortamını sağlayın.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Sohbet Bearer; admin verilmez. **Çalışma:** HTTP istemcisi.
> **Sunucusuz:** İstemci olabilir, yönetim sürekli Node ister. **Ayrı süreç:** Gerekir. [Servis kurulumu](DEPLOY.md).

## .NET ve .NET Framework

`LlmClient.cs`, aynı URL/token değişkenlerini ve NuGet gerektirmeyen `DataContractJsonSerializer` kullanır. Modern/.NET4.5+ için HttpClient ve `await LlmClient.AskAsync("Merhaba")`; .NET 4.0/net40/belirsiz eski Web Forms için C#4, HttpWebRequest/TPL ve `ContinueWith` kullanılır. İkisi de `Task<string>`, iptal ve 330 sn sınırını korur; eski yol worker kullanır.

Gerekli assembly referansları journal ile eklenir; SDK örtük kaynak dahil etmesi korunur. Mevcut yardımcı üzerine yazılmaz; yeniden üretmek için `--force` gerekir.

> [!WARNING]
> **Güvenlik ve sınırlar** — **Kimlik:** Sohbet Bearer; admin verilmez. **Çalışma:** HTTP istemcisi.
> **Sunucusuz:** İstemci olabilir, yönetim sürekli Node ister. **Ayrı süreç:** Gerekir. `.env` otomatik yüklenmez; eski hedefte yoğun eşzamanlılık için modern hedef tercih edin.

## Doğrulama ve geri alma

Journal env/gitignore/npm script/helper/giriş/config dosyalarının içerik ve izinlerini geri alır; yalnız işlemin oluşturduğu boş klasörleri kaldırır. Kod ekleme reddi veya doğrulama sonrası geri alma bu kapsamdadır; `-y` hatada otomatik geri alır.

Kurulu derleyiciyle JS/TS/JSX/Vue/Svelte/Python/C# kontrol edilir; araç yokluğu açıkça atlanmış gösterilir. Python `compile()` önbellek dosyası bırakmaz. C# yardımcı yalıtılmış SDK projesinde derlenir; hostun kendi hedefiyle tam build kanıtı değildir. SDK geçici araç dizinini kullanıcı PATH'ine eklemez. Canlı probe sayfa/kataloğu sınar; ücretli sağlayıcı üretimi yapmaz.

## Özel depo

`createLLMManager({ store })` veya `mountLLMManagement(app, { store })` verilebilir. Dosya deposu async; host store `T | Promise<T>` döndürür.

| Metot | Dönüş / sözleşme |
| --- | --- |
| `list()` | `{ version: 1, activeId, profiles }`; sır içermeyen profiller |
| `get(id)`, `getActive()` | İç profil (apiKey/transport dahil) veya null; yalnız sunucu |
| `save(input)` | Genel profil; yenide name/provider/model/baseURL/apiKey zorunlu |
| `remove(id, revision)`, `activate(id, revision)` | Güncel liste; host remove `{ ok: true }` da döndürebilir |
| `recordTest(id, status, expectedRevision, details)` | Genel profil; test sırasında revizyon değişmişse null |

Güncellemede id+revision; silme/etkinleştirmede JSON revision zorunlu. Eski revizyonsuz kayıttan gelen açık null ilk değişiklikte geçerli, eksik alan geçersizdir. Karşılaştırma+yazma atomik olmalı. Bulunamayan profil `PROFILE_NOT_FOUND`/404, çakışma `PROFILE_CONFLICT`/409; geçersiz profil/seçenek ve anahtar-adres uyumsuzluğu tipli hata olmalı.

Diğer temel kodlar: `PROFILE_INVALID`, `RUNTIME_OPTIONS_INVALID`, `AI_CREDENTIAL_ENDPOINT_MISMATCH`; dosya kilidi zaman aşımı `STORE_LOCKED` olur. Kısa test en çok20 sn / 512 token, normal sağlayıcı JSON yanıtı2 MiB ve SSE8 MiB ile sınırlıdır.

Boş/eksik güncelleme anahtarı eskiyi korur; sağlayıcı/baseURL değişirse yeni anahtar gerekir. Kimlik/adres/model/anahtar değişikliği test geçmişini sıfırlar; ad/süre/token ayarı korur. `recordTest` revision değiştirmez; status passed/failed, details mode/durationMs/opsiyonel code içerir.

list/save/remove/activate/recordTest sırsız kalır; iç get sonucunu istemciye/loga vermeyin. [Async Map örneği](../examples/memory-store.js) tek süreçli/geçicidir ve anahtarı açık bellekte tutar; kalıcılık/şifreleme hostun sorumluluğudur. `testMessages`/`validateTestReply` özel tanı callback'leri iç profil alır; bu nesneyi loglamayın. Varsayılan sohbet testi nötr bir web güvenliği sorusudur.
