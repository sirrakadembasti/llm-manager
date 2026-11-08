import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Unified guide exists and documents reporting procedures', () => {
  assert.ok(fs.existsSync('docs/KULLANICI_KILAVUZU.md'));
  const content = fs.readFileSync('docs/KULLANICI_KILAVUZU.md', 'utf8');
  assert.match(content, /Güvenlik açığı bildirme/);
  assert.match(content, /Güvenlik mimarisi ilkeleri/);
  assert.match(content, /Sır sızıntısını önleme/);
});

test('Unified guide exists and documents quality and commit guidelines', () => {
  assert.ok(fs.existsSync('docs/KULLANICI_KILAVUZU.md'));
  const content = fs.readFileSync('docs/KULLANICI_KILAVUZU.md', 'utf8');
  assert.match(content, /Standart commit biçimi/);
  assert.match(content, /Kalite doğrulama komutları/);
  assert.match(content, /npm test/);
  assert.match(content, /Sır sızıntısını önleme/);
});

test('docs/KULLANICI_KILAVUZU.md exists and covers primary threat vectors', () => {
  assert.ok(fs.existsSync('docs/KULLANICI_KILAVUZU.md'));
  const content = fs.readFileSync('docs/KULLANICI_KILAVUZU.md', 'utf8');
  assert.match(content, /Korunan varlıklar/);
  assert.match(content, /Sunucu tarafı istek sahteciliği \(SSRF\)/);
  assert.match(content, /Siteler arası istek sahteciliği \(CSRF\)/);
  assert.match(content, /Kimlik bilgisi ve sır sızıntısı/);
  assert.match(content, /Kaynak tüketimi ve maliyet istismarı/);
});

test('.github/workflows/ci.yml runs production dependency audit', () => {
  assert.ok(fs.existsSync('.github/workflows/ci.yml'));
  const content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(content, /npm audit --omit=dev/);
});

test('security policy distinguishes unreleased development from existing release support', () => {
  const content = fs.readFileSync('docs/KULLANICI_KILAVUZU.md', 'utf8');
  assert.match(content, /1\.x\.x desteklenir/);
  assert.match(content, /2\.0\.0[^\n]*yayımlanmamış/);
  assert.match(content, /yayımlanmış 2\.x sürümünün kanıtı değildir/);
  assert.match(content, /Geliştirme sürümündeki açıkları[^\n]*özel kanallardan/i);
  assert.match(content, /bakım veya eski sürüme düzeltme taşıma taahhüdü eklemez/);
});

test('supply-chain threat separates current repository controls from planned protections', () => {
  const content = fs.readFileSync('docs/KULLANICI_KILAVUZU.md', 'utf8');
  const supplyChain = content.split('### Tedarik zinciri')[1]?.split('\n### ')[0];
  assert.ok(supplyChain, 'supply-chain threat section is required');
  const [current, planned] = supplyChain.split('**Planlanan kontroller (uygulanmadı):**');
  assert.match(current, /bağımlılık[^\n]*kilit dosyası[^\n]*CI[^\n]*yayıncı/i);
  assert.match(current, /\*\*Mevcut kontroller:\*\*/);
  assert.match(current, /undici[^\n]*isteğe bağlı[^\n]*express/i);
  assert.match(current, /npm ci[^\n]*package-lock\.json/);
  assert.match(current, /npm audit --omit=dev[^\n]*geliştirme bağımlılıklarını kapsamaz/);
  assert.match(current, /npm pack --dry-run/);
  assert.match(current, /Yayın iş akışı yoktur/);
  assert.match(current, /tam commit SHA[^\n]*contents: read/);
  assert.match(current, /npm audit signatures/);
  assert.match(current, /tests\/supply-chain\.test\.js[^\n]*sha512/);
  assert.match(current, /dependabot/i);
  assert.ok(planned, 'future protections must be explicitly marked as unimplemented');
  assert.doesNotMatch(planned, /commit SHA/, 'SHA pinning is implemented, not planned');
  assert.match(planned, /yayıncı[^\n]*politikası/);
  assert.match(planned, /köken kanıtı[^\n]*imzalama/);
});
