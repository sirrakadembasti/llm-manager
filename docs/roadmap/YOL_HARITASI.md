# LLM Manager — tek yol haritası

## Arayüz iyileştirmesi — onaylı tasarım ve uygulama planı

2026-10-27: Kullanıcı tasarımı onayladı. Amaç: başlık/içerik hizası, görünür bildirimler ve profil kartında kalıcı test sonucu. HTML/CSS ve mevcut tarayıcı JS'i kullanıldı; yeni bağımlılık ve API değişikliği yok. Klavye erişimi ve mobil ekran korundu; ilk teslimdeki İngilizce destek sonraki kullanıcı kararıyla kaldırıldı.

- [x] `tests/ui-completion.test.js`: yükleniyor/hata/bilgi ayrımı, teknik ayrıntıların ayrılması ve kartta test sonucunun korunması için davranış testlerini ekle; eksik davranış nedeniyle başarısızlığı doğrula.
- [x] `public/llm.html`: başlık ve içerikte ortak 1200px kapsayıcı; masaüstünde görünür yapışkan bildirim, mobilde daralmayan düzen, açık/koyu tema ve odak stilleri.
- [x] `public/llm-ui.js`: durum başlığı, güvenli metin renderı, kapatma; hata kodu/destek kimliği/süreyi ayrı göster. Test sırasında ve sonrasında ilgili kartta sonuç göster; sayfa yenilendiğinde sunucunun kayıtlı test geçmişini kullan.
- [x] `public/i18n/tr.json`: bildirim başlıkları ve ayrıntı etiketleri eklendi. İlk teslimdeki İngilizce sözlük daha sonra kaldırıldı. İlgili UI/i18n testleri, lint/typecheck/format ve gerçek tarayıcıda masaüstü/mobil görünüm ile hata/başarı durumları doğrulandı; kılavuz ve değişiklik günlüğü güncellendi.

Kabul: hata kaybolmaz, sonraki işlem veya kapatma ile değişir; test sonucu yalnız test edilen kartta kalır; uzun destek kimliği taşmaz; yükleniyor başarı gibi görünmez; başlık ve içerik sol/sağ kenarları eşittir. Geçici toast yerine kalıcı durum paneli seçildi.

Doğrulama: UI/sohbet/kurtarma/i18n/hardening seçkisinde 50/50 test, lint/typecheck/format geçti. Gerçek tarayıcıda 1600px masaüstü ve 390px mobilde yatay taşma yok; başlık ve kartın sol kenarı eşit. Örnek API ile bekleme/hata/başarı ve kapatma kontrol edildi; üst bildirim kapanınca kart sonucu kaldı. Açık/koyu görünüm incelendi. Bağımsız incelemenin eski revizyon ve İngilizce başarı metni bulguları testlerle kapatıldı; açık bulgu yok.

Güncelleme: **2026-10-27** · Paket: `@sirrakadembasti/llm-manager` · Yerel sürüm: **2.0.0 / yayımlanmamış**.

**Durum:** YH1'in 32 mimari kartı ve YH2'nin G01–G26 kapsamı tamamlandı. YH2 yalnız FAZ 0/1/2 içerir; FAZ 3 yoktur. Aşağıdaki kimlikler önceki belgelerle izlenebilirlik için korunur. G13 ayrı görev kartı değildi; gerçek derleyici doğrulaması kapsamında kapatıldı.

Bu dosya eski iki yol haritasını, uygulama planını, denetim ve katalog kaynak kayıtlarını birleştirir. Ayrıntılı tarihçe Git'te `6efbe32` ve önceki commitlerdedir; eski dosyalardaki başlangıç bulguları güncel açıklar değildir. Kullanım: [README](../../README.md), [entegrasyon](../ENTEGRASYON.md), [dağıtım](../DAGITIM.md).

## Uygulama sırası ve kurallar

Sıra: güvenlik P0 → mimari temel → entegrasyon/depo P1 → runtime/arayüz/kalite P2. YH2 FAZ0 önce, FAZ1 çalışan senaryolar, FAZ2 belge/bağımsızlık uyumudur. Aşağıdaki bütün zorunlu işler kapalıdır; yeni işleri bu dosyada ayrı açık madde olarak kaydedin.

- Önce davranış testi, sonra düzeltme; bir görev bir commit. Kabul, tüm testler ve ilgili kalite kontrolleri geçmeli.
- API uyumu korunur; değişen API için tipler/README/değişiklik günlüğü güncellenir, ilgili görev kaydına kısa durum yazılır.
- Yeni runtime bağımlılığı eklenmez; dosya taşınırsa eski yol bir uyumluluk sürümü re-export sağlar.
- Anahtar/parola/istem/cevap loglanmaz. HTTP kimlik denetimi adaptörde, doğrudan ask/handle güvenilir host sınırındadır.
- Yayın, push, etiket veya sürüm artışı ayrıca yetki gerektirir. Tamamlanmış yerel çalışma yayımlanmış paket değildir.

## YH1 — mimari ve ürün

Tüm satırlar tamamlandı. Kanıtlar `tests/` altında, aksi belirtilmedikçe `.test.js` dosyasıdır.

| Kart | Sonuç / kısa kabul | Başlıca kanıt |
| --- | --- | --- |
| YH1-A1 | Core Express'siz yüklenir; init tembel/ayrı alt yol, eski async köprü ve senkron export geçişi belgeli. | architecture, package-metadata |
| YH1-A2 | `src/server.js` CLI/örnek/probe için ortak sunucu; ağ parolası ≥12, sahipli sinyal kapanışı ≤10 sn, örneksiz CLI çalışır. | server-lifecycle, server-options |
| YH1-A3 | Tüm alt yollar tipli; sync/async store örneği typecheck'ten geçer, CI testten önce tipleri denetler. | `types/test.ts`, CI |
| YH1-A4 | Tipli hata/cause; zaman aşımı 504, iptal 499; filtre/kesilme ayrımı. Türkçe regex yalnız classifier yedeğinde. | errors, final-stream-regressions |
| YH1-A5 | OpenAI/Anthropic/Google stratejileri; mesaj/usage normalizasyonu, cevap ve düşünce ayrımı. | transports, thinking |
| YH1-A6 | Init sorumluluklara bölündü; eski giriş köprü, modüller ≤300 satır (kapanışta en büyük 239). | init-safety, architecture |
| YH1-B1 | Stat/anahtar cache ve clone izolasyonu; 1000 okumada gereksiz disk okuması yok. B2 ile async hale geldi. | store-cache |
| YH1-B2 | FIFO, async I/O, 5 sn süreç kilidi ve Windows retry; iki süreç 50'şer save → 100 profil. Eski kilit için >10 sn ve ölü PID gerekir. | store-concurrency, lock-access-retry |
| YH1-B3 | Şema v1/migration, önceki sürüm .bak, bozuk/yeni sürümde yazmama ve UI kurtarma mesajı. HTTP 500 yanında tipli kod korunur. | store-recovery, store-async |
| YH1-B4 | Anahtar önceliği/legacy.env geçişi, kilitli rotate ve şifreli export/import; eski anahtar yeni veriyi çözemez. | key-management, store-async |
| YH1-C1 | Rol/user/mesaj/karakter ve 256 KiB gövde sınırı; gerçek 300 KiB → 413, Content-Length okumadan ret, sınırda iptal. | runtime-controls, final-http-acceptance |
| YH1-C2 | Varsayılan admin override; Bearer profil/süre/token/thinking değiştiremez. Trusted doğrudan handle uyumu korunur. | auth-policy, runtime-controls |
| YH1-C3 | Token bucket en çok 10000 kimlik; auth 10/chat 30/test-model 10 istek/dk. 429 + Retry-After, kararlı kişi kimliği ve reset. | runtime-controls, auth-policy |
| YH1-C4 | Üç SSE protokolü, delta/done/error, 8 MiB sınır ve kopmada iptal; düşünce sızmaz, filtre başarı sayılmaz. | streaming, stream-cleanup, final-stream-regressions |
| YH1-C5 | temperature/topP/stop/responseFormat; raw usage/finishReason, gelişmiş UI; varsayılan ask string kalır. | production-params, ui-completion |
| YH1-C6 | Yalnız retryable hata; jitter/Retry-After, 503/503/200 kabulü, 401'de tekrar yok. Tek bütçe ve gerçek fallback kimliği; çıktı sonrası tekrar yok. | retry-fallback, final-stream-regressions |
| YH1-C7 | Modele göre reasoning eşlemeleri/kapama sınırları ve yetenek temelli UI; eski kart örneği güncel model kısıtını ezmez. | thinking |
| YH1-C8 | ProxyAgent ve bilinen/açık hedef listesi; proxy DNS güvenlik ödünleşimi belgeli. Pozitif CONNECT smoke ayrı. | network-proxy-lan |
| YH1-C9 | Açık host/port ile LAN HTTP; liste dışı ret, Ollama notu; gerçek varsayılan depoda save/reload/çağrı. | network-proxy-lan, final-http-acceptance |
| YH1-C10 | Donmuş JSON katalog/tarih, güvenli admin önizleme ve hesap bazlı checker; tarihlenmiş resmi kaynaklar aşağıda. | catalog-preview, catalog-docs |
| YH1-D1 | Request-id, derin redaction, false-only içerik politikası; her mantıksal sohbet için tek completion ve son aday. | observability, chat-completion-lifecycle |
| YH1-D2 | Public health sır/profil ayrıntısı göstermez; health:false kapatır. | health |
| YH1-D3 | node:22-alpine, non-root, volume, host, healthcheck ve dockerignore/dağıtım kılavuzu. Gerçek imaj çalıştırılmadı. | docker |
| YH1-D4 | Async içeriksiz JSONL, admin aylık özet/UI; hata/iptal/erken dönüş dahil tek güvenli usage kaydı. | usage, usage-lifecycle, ui-completion |
| YH1-E1 | Etkin profil varsayılan playground; textContent, SSE, süre/token gösterimi. | playground, streaming |
| YH1-E2 | Tarihsel iki dilli arayüz görevi tamamlandı; sonraki kararla İngilizce sözlük/dil ayarı kaldırıldı, arayüz ve belgeler Türkçeleştirildi. Kart kimliği izlenebilirlik için korunur. | i18n, turkce-docs, ui-completion |
| YH1-E3 | homeUrl, sırsız klon, erişilebilir onay/Escape, form kilidi ve katalog tarihi. | ui-enhancements, ui-completion |
| YH1-F1 | ESLint/Prettier/LF, üç OS×Node 22/24 CI. Node 20, düşük engine seçilmediği için matris dışında. | kalite komutları, CI |
| YH1-F2 | Gerçek Express 4 ESM/CJS/5 host+junction+HTTP; Node Request köprüsü ve üç mock SSE sağlayıcısı. Framework iskelet E2E opsiyonel. | integration/, helpers/mockProvider.js |
| YH1-F3 | src kapsam eşikleri ≥%80 satır/%70 dal; beş temel modül hedefi ≥%85 satır. | test:coverage |
| YH1-F4 | Scoped kimlik, Node ≥22.12, optional Express, metadata/types; paket test/data/gerçek .env içermez. Funding opsiyonel. | package-identity, package-metadata |
| YH1-F5 | Güvenlik/katkı rehberi/tehdit modeli, mevcut-planlanan ayrımı ve CI üretim audit. | security-docs |

## YH2 — vaat ve gerçek uyumu

| Faz / kart | Kapatılan iş / kabul | Başlıca kanıt |
| --- | --- | --- |
| 0 · YH2-G01 | SPA admin parolası taşımaz; sohbet Bearer yalnız chat'e erişir. | phase0-security, init-security |
| 0 · YH2-G02 | Web sayfa/API auth; anonim 401, admin yazma 201, eksik yapılandırma 500 AUTH_NOT_CONFIGURED. | auth-policy |
| 0 · YH2-G03 | chatAccess:false→404 CHAT_DISABLED; generate çağrılmaz. | plugin, phase0-security |
| 0 · YH2-G04 | Rastgele parola yalnız .env; kod/script/log sır içermez, env biçimi korunur. | init-security, env-roundtrip |
| 0 · YH2-G05 | data/.env/.env.local/*.key gitignore'a güvenle eklenir. | init-wizard, init-security |
| 0 · YH2-G06 | Wildcard yönetim CORS'u açmaz; Vite dışı açık origin, boş seçimde eski izin silinir. | phase0-security, architecture |
| 0 · YH2-G07 | Scoped paket uyarısı ve gerçek çevrimdışı yerel kurulum/import/sürüm/bin kabulü. | package-identity, package-metadata |
| 1 · YH2-G08 | Tüm async host/Map ve dosya store çağrıları await; CRUD/test/chat güvenli. | store-async, host-store |
| 1 · YH2-G09 | Nuxt/SvelteKit/Next sunucu kodu istemciye eklenmez; action/ask örnekleri auth'a delege eder. | init-g09 |
| 1 · YH2-G10 | CJS setup senkron; rota 404'ten önce, kurulum hatası senkron iletilir. | init-safety |
| 1 · YH2-G11 | Eklenti parser'ı auth sonrası; host parser sırasından bağımsız 201, bozuk 400/büyük 413. | express-body-parser |
| 1 · YH2-G12 | Dosya ağacı/byte/izin/env/config/script rollback; -y hatada otomatik geri alır. Bağımlılık önkoşulu ayrı. | init-rollback-snapshot |
| 1 · YH2-G13 | Gerçek araç varsa derleme/sözdizimi kontrolü, yoksa açık atlama; host proje build garantisi verilmez. | init-g17, init-python, init-g14 |
| 1 · YH2-G14 | .NET 4.0/modern ayrımı, NuGet'siz JSON, 330 sn/iptal, assembly ve örtük kaynak uyumu. | init-g14, init-g14-legacy |
| 1 · YH2-G15 | Tauri Electron sanılmaz; ayrı Node sunucusuna HTTP istemcisi. | init-electron, init-g17 |
| 1 · YH2-G16 | Electron userData/preload/IPC ve kendi loopback yönetim penceresi; parola renderer'a verilmez. | init-electron |
| 1 · YH2-G17 | TS/giriş algılama; çıktı dizinine veya desteklenmeyen framework girişine kod yazılmaz. | init-g17 |
| 1 · YH2-G18 | Next göreli import, Node runtime/Edge uyarısı, konservatif serverExternalPackages düzenleme. | init-g18 |
| 1 · YH2-G19 | Python/C# URL/token ortamdan; Türkçe tipli hata/timeout ve sürekli servis kılavuzu. | init-python, init-g14 |
| 1 · YH2-G20 | Fiziksel host paket/Express kurulumu onayla ve yeniden kontrolle tamamlanır; cache host yerine geçmez. | init-package |
| 1 · YH2-G21 | Quick reasoning/boş token-kesilme tanısı yanlış negatif sayılmaz; sohbet kesilme hatası ve düşünce gizliliği korunur. | runtime-diagnostics, thinking |
| 2 · YH2-G22 | Nötr UI/test mesajları, legacy purpose başına tek uyarı, eski generate bayraklarını iletmeme. | purpose-compat, ui-completion |
| 2 · YH2-G23 | Varsayılan liste tarihi gerçek katalogdan; canlı liste talimatı görünür. | catalog-docs |
| 0 · YH2-G24 | Admin ve sohbet kimliği ayrıldı; Bearer yönetimde 403, chat 200. | phase0-security, auth-policy |
| 2 · YH2-G25 | Aynı 10 senaryo, üretim/auth/serverless/süreç sınırları ve Windows ACL notu. | integration-docs, turkce-docs |
| 2 · YH2-G26 | Optional peer Express 4/5; gerçek ESM/CJS/5 auth/parser HTTP uyumu. | integration/hosts, integration/express5-errors |

## Kabul ve doğrulama

| Tarih / baş | Yerel sonuç |
| --- | --- |
| 2026-10-25 · YH2 FAZ0 | 195/195; sır/auth/CORS ve gerçek scoped npm kabulü |
| 2026-10-25 · YH2 FAZ1 | 276/276; src %92,94 satır/%85,13 dal; C#/TS/Python gerçek araç kabulü |
| 2026-10-26 · YH2 FAZ2, `588c793` | 283/283; src %93,03/%85,33; dört genel inceleme bulgusu kapalı |
| 2026-10-27 · YH1 ürün `7297204`, kayıt `46551a1` | 386/386; src %94,78 satır/%87,70 dal/%93,02 fonksiyon; lint/typecheck/format yeşil |
| 2026-10-27 · PATH düzeltmesi `6efbe32` | 388/388; sıfır hata/atlama/iptal,234588 ms; standart npm kalite komutları ve gerçek npm start health/auth geçti; kalıcı PATH sabit |

Son kapsam ölçümü 386 testlik koşuya aittir: auth %100, core %93,89, profileStore %91,64, providerTransport %94,33, runtime %99,16 satır. 388 testlik koşuda yeni kapsam ölçülmedi. Önceki paket denetimi 89 dosya/yasak içerik 0 ve üretim audit 0 kendi kapanış tarihinin kanıtıdır. Belge birleşmesi sonrası paket 80 dosya, yasak içerik yok; tek roadmap Markdown içerir. Belge düzenlemesi 13 hedefli ve 388/388 tam testle doğrulandı; 58 kimlik ve 37 yerel bağlantı denetimi, kalite ve bağımsız inceleme geçti.

YH1'in on tamamlama commiti: `f2c4b0a` A4, `9f189f0` B4, `7078c1c` C3, `ff711ec` D1, `f10ef20` D4, `a836033` B3, `873f94c` A2, `9c3c12a` F5, `4cd807a` A1, `44024fa` E2. Genel inceleme `51978fc..44024fa`; beş LAN/akış bulgusu ve C1 kabul boşluğu `7297204` ile kapandı. Dar incelemede yedi madde kapalı, yeni kritik/önemli/küçük bulgu yok. PATH düzeltmesi ayrı bağımsız incelemeden geçti.

Tekrar doğrulama:

```sh
node --test --test-concurrency=1 tests/*.test.js tests/**/*.test.js
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
node docs/roadmap/dogrulama.mjs
npm pack --dry-run --json
npm audit --omit=dev
```

Seri kapsam için Node seçeneklerini dosya yollarından önce verin: `node --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include=src/** --test-coverage-lines=80 --test-coverage-branches=70 tests/*.test.js tests/**/*.test.js`. Doğrulama betiği 404 / profil listesi / 409 / 201 / 500 bekler; tam test paketinin yerine geçmez.

**Sınırlar:** Docker dosya sözleşmesi testlidir; motor başlatılamadığı için gerçek imaj build/run yapılmadı. Uzak OS×Node CI, paketli Electron/Tauri/framework E2E, canlı ücretli sağlayıcı/katalog hesabı ve pozitif proxy CONNECT çalıştırılmadı. Sinyal testleri gerçek alt süreç/HTTP ile Windows IPC callback ve kontrollü saat kullandı; native konsol/POSIX teslimi doğrulanmadı. .NET 4.0 referans derlemesi kurulu CLR 4.8.1'de çalıştı; özgün4.0 runtime/net48 targeting-pack build kanıtı değildir.

PATH sorununun nedeni geçici .NET SDK evlerinin kullanıcı PATH'ine eklenmesiydi. Üretim ve test SDK çağrıları `DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=false` kullanır. Bu makinede yalnız106 silinmiş test girdisi yedeklenerek temizlendi; yeni testler kalıcı ortamı değiştirmedi. Bu düzeltme diğer zaman aşımı gözlemlerinin tüm nedenlerini açıklamış sayılmaz.

## Sonraki isteğe bağlı işler

Güncel dil düzenlemesi: İngilizce arayüz ve etkin dil ayarı kaldırıldı; eski JavaScript `locale` değeri yok sayılır. Teknik kılavuz ve politika dosyaları Türkçe adlara taşındı, yerel bağlantılar güncellendi. Tam seri test paketi 395/395 geçti; hata/atlama/iptal yok (282395 ms). Lint, tip ve biçim kontrolleri, paket içeriği, 59 yerel bağlantı ve 58 görev kimliği doğrulandı; bağımsız incelemede açık bulgu yok. Bu çalışma yayın veya yeni canlı sağlayıcı doğrulaması içermez.

Zorunlu eski kartlarda açık iş yok. Aşağıdakiler henüz uygulanmış/çalıştırılmış sayılmaz:

- [ ] Uygun ortamda Docker build/run, kalıcı volume ve auth smoke testi.
- [ ] Uzak üç OS×Node 22/24 matrisi ve native sinyal teslimi kabulü.
- [ ] Haftalık/elle Next/Nuxt/SvelteKit iskelet build ve paketli masaüstü E2E.
- [ ] Pozitif proxy CONNECT ve izinli canlı sağlayıcı/hesap kontrolleri.
- [ ] Tedarik zinciri: dependency/lockfile inceleme süreci, immutable action pinleri, yayın kaynağı politikası/provenance/imza.

Yayın bu listeyle otomatik yetkilendirilmez. Katalog güncellemesinde resmi kesin kimlik doğrulanamazsa öneriyi kaldırın; boş liste kabul edilir. [Tehdit modeli](../TEHDIT_MODELI.md).

## Katalog kaynakları

**2026-10-24 tarihli kaynak denetimi**; bu belge düzenlemesi yeni canlı doğrulama değildir. Kesin ID'ler [providers.json](../../src/catalog/providers.json) içindedir. Bu, tüm modellerin listesi veya hesap/bölge/üretim erişim garantisi değildir. Ücretli/kimlik bilgili üretim çağrısı yapılmadı.

| Sağlayıcı | Tutulan kesin öneriler | Resmi kaynak / sınır |
| --- | --- | --- |
| OpenAI | gpt-6-astra, gpt-6.1-sol, gpt-6-luna | [Katalog](https://developers.openai.com/api/docs/models), [GPT-6](https://developers.openai.com/api/docs/guides/latest-model); text Chat Completions. Astra/Sol araç çağrısı Responses ister; paket araç çağırmaz. |
| Anthropic | claude-fable-5-1, claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5 | [Modeller](https://platform.claude.com/docs/en/models/overview), [thinking](https://platform.claude.com/docs/en/build-with-claude/thinking). |
| Google | gemini-4-argon, gemini-3.8-flash, gemini-3.5-flash-lite | [Modeller](https://ai.google.dev/gemini-api/docs/models?hl=en), [thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking.md); ses/video/görüntü üretim kapsam dışı. |
| xAI | grok-4.7 | [Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions); desteklenen legacy uç. |
| OpenRouter | moonshotai/kimi-k3.1-pro | [Public model API](https://openrouter.ai/api/v1/models); küçük text-output alt kümesi. |
| Groq | openai/gpt-oss-120b, openai/gpt-oss-20b, llama-3.3-70b-versatile, llama-3.1-8b-instant | [Modeller](https://console.groq.com/docs/models); Llama için enterprise onayı gerekebilir. |
| Together | deepseek-ai/DeepSeek-V4-Pro-0813, deepseek-ai/DeepSeek-V4.1-Flash-1017, Qwen/Qwen3.8-Flash | [Serverless](https://docs.together.ai/docs/serverless/models). |
| Fireworks | accounts/fireworks/models/glm-5p3-flash | [Quickstart](https://docs.fireworks.ai/getting-started/quickstart). |
| Cohere | command-a-plus-05-2026, command-a-03-2025, command-r-plus-08-2024, command-r-08-2024 | [Modeller](https://docs.cohere.com/docs/models), [OpenAI uyumu](https://docs.cohere.com/docs/compatibility-api). |
| DeepSeek | deepseek-flash, deepseek-v4-pro | [Modeller](https://api-docs.deepseek.com/quick_start/pricing/); eski alias yerine güncel Flash. |
| Qwen | qwen3.8-max, qwen3.7-plus, qwen3.8-flash | [Modeller](https://www.alibabacloud.com/help/en/model-studio/models), [kimlikler](https://www.alibabacloud.com/help/en/model-studio/text-generation-model); bölgesel izin gerekir. |
| Kimi | kimi-k3.1-pro, kimi-k3.1-pro-highspeed | [Quickstart](https://platform.kimi.ai/docs/get-your-api-key). |
| MiniMax | MiniMax-M3.1-Flash, MiniMax-M3 | [Modeller](https://platform.minimax.io/docs/guides/models-intro), [OpenAI uyumu](https://platform.minimax.io/docs/api-reference/text-openai-api). |
| Xiaomi MiMo | mimo-v2.6-pro, mimo-v2.6-flash | [Liste](https://mimo.mi.com/docs/en-US/quick-start/model), [Pro](https://mimo.mi.com/models/en-US/mimo-v2-6-pro), [iki ID örneği](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/batch-api); V2.5 önerileri kaldırıldı. |
| Ollama | gpt-oss:20b | [Yerel OpenAI uyumu](https://docs.ollama.com/api/openai-compatibility); modelin yerelde kurulu olması gerekir. |

Doğrulanamayan öneriler kaldırıldı; sağlayıcı/uç önayarları korundu. Boş liste sağlayıcının modeli olmadığı veya kaldırılan her modelin emekli olduğu anlamına gelmez:

| Boş liste | Tarihli gerekçe / kaynak |
| --- | --- |
| Perplexity | [Sonar geçişi](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview), [yeni modeller](https://docs.perplexity.ai/docs/agent-api/models): Responses/Agent ID'leri mevcut Chat Completions için doğrulanmadı. |
| Zhipu GLM | [Global Z.ai](https://docs.z.ai/api-reference/llm/chat-completion), varsayılan BigModel China envanterini kanıtlamaz. |
| SiliconFlow | [Quickstart](https://docs.siliconflow.com/en/userguide/quickstart), [global chat](https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions): China hesabı doğrulanmadı. |
| Baidu | [Qianfan](https://cloud.baidu.com/doc/qianfan/index.html): kesin güncel ID kurulamadı. |
| Doubao | [Ark](https://docs.volcengine.com/docs/ark/model-list?lang=zh): araç yalnız JS kabuğu gördü. |
| Hunyuan | [Tencent](https://cloud.tencent.com/document/product/1729/104753): kaynak isteği timeout oldu. |
| Custom | Kullanıcı ucu; ortak envanter yok. |

Thinking yeteneği her modelde aç/kapat garantisi değildir: Claude 5.5/5.1 adaptive kullanır; Fable/Opus full-off reddeder, Sonnet between_tools ve Haiku disabled destekleri effort'a bağlıdır. Gemini 3/4 enabled için thinkingLevel medium, auto için ayar yok, full-off ret; Gemini 2.5 Flash sayısal budget destekler, Pro off reddeder. GPT-6 aktif reasoning'de desteklenmeyen sampling alanlarını kullanmaz, disabled için effort none uygular.

Hesap bazlı kontrol: sağlayıcıya özel `OPENAI_API_KEY` veya `PROVIDER_KEY_OPENAI` tanımlayıp `node scripts/check-catalog.js --provider openai` çalıştırın. Genel `LLM_API_KEY`/komut satırı anahtarı yalnız tek açık provider seçimiyle kullanılır; hiçbir anahtar tüm sağlayıcılara yayılmaz veya yazdırılmaz. Checker yalnız model-listesi GET yapar; eşleşme hesap bazlıdır, tüm parametre/region desteğinin kanıtı değildir. Bazı servislerde liste ucu yoktur. Yerel Ollama için `--allow-local-http`, kurulu model ve dummy anahtar gerekir. Atlanmış/anonim koşu canlı doğrulama sayılmaz.
