# YH1 Tamamlama Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Onaylanan YH1 denetimindeki açık kabul kriterlerini ve roadmap önkoşullarını tamamlamak.
**Architecture:** Ortak auth/env/domain yardımcıları; adaptörlerden core'a principal aktarımı; init davranışlarını düzelttikten sonra sorumluluklara göre modüllere ayırma.
**Tech Stack:** Node ESM, mevcut undici, opsiyonel Express, node:test, TypeScript declarations.

## Global Constraints
- Yeni runtime bağımlılığı ekleme. Eski yollar re-export köprüleriyle korunur.
- Sırlar log/DTO/üretilen kodlarda bulunmaz. Önceden değişmiş dosyalar korunur.
- YH1/YH2 görev kartlarının tüm numaralı koşulları ve kabul testleri nihai denetimde tek tek doğrulanır.
- Yayın/push bu çalışmanın parçası değildir. Onaylanan tasarım: YH1_DENETIM_2026-10-24.md.

## 1. Ortak auth ve güvenli HTTP adaptörleri
Files: src/auth.js, src/core.js, src/index.js, types/core.d.ts, types/index.d.ts, tests/auth-policy.test.js.
Interface: checkBasicAuth(header,{user,password}), checkBearerToken(header,tokens); principal {isAdmin,kind,id}.
- [x] Önce tests/auth-policy.test.js: yapılandırılmamış fetch 500; anonim 401; Basic admin 200; chat Bearer profiles 403; chatAccess admin Bearer 403; authorize null 401; çağrı seçeneği override; health açık.
- [x] `node --test tests/auth-policy.test.js`: eksik auth sebebiyle FAIL doğrula.
- [x] SHA256 timingSafeEqual; auth seçeneklerini createLLMManager ve fetch override üzerinden paylaş. Health hariç page/script/API korunur. Kimlik core.handle'a aktarılır. Express Bearer aynı politikayı kullanır.
- [x] Önceki açık fetch testlerini açıkça insecureNoAuth ile izole et; gerçek HTTP testlerini Basic ile doğrula. npm test/lint/typecheck çalıştır.

## 2. Güvenli init ve paket kimliği (YH2 Faz 0)
Files: src/envFile.js, src/init.js, bin/llm-manager.js, package.json, package-lock.json, README.md, docs/ENTEGRASYON.md, tests/init-security.test.js.
- [x] Önce her proje tipi için parola yalnız env dosyalarında, gitignore tam, script sırsız testlerini yaz ve FAIL doğrula.
- [x] upsertEnv/ensureGitignore; random parola/token; Basic sırlarını istemciden kaldır; CORS explicit origin; npm scoped adını tek package.json kaynağından türet.
- [x] CLI gerçek geçici projelerde çalıştır; parola log/response araması ve tüm testleri doğrula.

## 3. Init davranışı ve ayrıştırma (YH2 Faz 1, A6)
Files: src/init/{detect,inject,verify,journal,probe,interactive,index}.js ve templates/*.js, src/init.js, tests/init-*.test.js.
- [x] Rollback snapshot, unsupported framework/TS algılama, client component enjeksiyonu yasağı, CJS startup sırası, paket kurulumu ve framework derleme testlerini önce yaz/FAIL doğrula.
- [x] Roadmap YH2 G08-G21 kartlarının tüm koşullarını uygula; sonra mevcut API'yi re-export köprüsüyle modüllere taşı.
- [x] Her modül <=300 satır; gerçek host ve rollback testleri; npm test yeşil.

## 4. Depo ve anahtar yönetimi (B2-B4)
Files: src/profileStore.js, src/store/fileLock.js, src/setup.js, bin/llm-manager.js, types/setup.d.ts, tests/store-*.test.js, tests/key-management.test.js.
- [x] Async queue, iki child process ile 100 profil, bozuk/yeni şema yazmama, env varsayılan yazmama, rotasyon ve şifreli yedek roundtrip testlerini önce yaz/FAIL doğrula.
- [x] Promise kuyruğu, fs.promises ve kilitli read-modify-write; anahtar önceliği ve writeEnv:true legacy seçeneğini uygula.
- [x] Testler, tipler ve README depo sözleşmesini doğrula.

## 5. Kalan YH1 kabul kriterleri
Files: src/server.js, types/*.d.ts, public/llm-ui.js, public/llm.html, public/i18n/*.json, src/catalog/providers.json, tests/integration/express5-esm.test.js, eslint.config.js, package.json, .github/workflows/ci.yml.
- [x] Sunucu logger aktarımı, fallback çoklu seçim, tüm dinamik çeviriler, Express 5 gerçek HTTP ve hata tipleri için eksik testleri yaz/FAIL doğrula.
- [x] Eksikleri uygula; Node/undici engine uyumunu düzelt; katalog kimliklerini resmi belgelerden doğrula ve doğrulanmayan modelleri kaldır.
- [x] npm test; npm run lint; npm run typecheck; npm run format:check; npm run test:coverage; npm pack --dry-run; npm audit --omit=dev.
- [x] CHANGELOG/GEMINI/denetim raporunu sonuçlarla güncelle. Tüm 32 görev kartını tek tek kanıtlamadan tamamlandı işaretleme.
