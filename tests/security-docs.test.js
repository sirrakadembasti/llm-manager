import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('GUVENLIK.md exists and documents reporting procedures', () => {
  assert.ok(fs.existsSync('docs/GUVENLIK.md'));
  const content = fs.readFileSync('docs/GUVENLIK.md', 'utf8');
  assert.match(content, /Güvenlik açığı bildirme/);
  assert.match(content, /Güvenlik mimarisi ilkeleri/);
  assert.match(content, /Sır sızıntısını önleme/);
});

test('KATKI_REHBERI.md exists and documents quality and commit guidelines', () => {
  assert.ok(fs.existsSync('docs/KATKI_REHBERI.md'));
  const content = fs.readFileSync('docs/KATKI_REHBERI.md', 'utf8');
  assert.match(content, /Standart commit biçimi/);
  assert.match(content, /Kalite doğrulama komutları/);
  assert.match(content, /npm test/);
  assert.match(content, /Sır sızıntısını önleme/);
});

test('docs/TEHDIT_MODELI.md exists and covers primary threat vectors', () => {
  assert.ok(fs.existsSync('docs/TEHDIT_MODELI.md'));
  const content = fs.readFileSync('docs/TEHDIT_MODELI.md', 'utf8');
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
  const content = fs.readFileSync('docs/GUVENLIK.md', 'utf8');
  assert.match(content, /\| 1\.x\.x\s*\| Evet \|/);
  assert.match(content, /2\.0\.0[^\n]*yayımlanmamış/);
  assert.match(content, /yayımlanmış 2\.x sürümünün kanıtı değildir/);
  assert.match(content, /Geliştirme sürümündeki açıkları[^\n]*özel kanallardan/i);
  assert.match(content, /bakım veya eski sürüme düzeltme taşıma taahhüdü eklemez/);
});

test('supply-chain threat separates current repository controls from planned protections', () => {
  const content = fs.readFileSync('docs/TEHDIT_MODELI.md', 'utf8');
  const supplyChain = content.split('### 2.7 Tedarik zinciri')[1]?.split('\n---')[0];
  assert.ok(supplyChain, 'supply-chain threat section is required');
  const [current, planned] = supplyChain.split('**Planlanan kontroller (uygulanmadı):**');
  assert.match(current, /bağımlılık[^\n]*kilit dosyası[^\n]*CI[^\n]*yayıncı/i);
  assert.match(current, /\*\*Mevcut kontroller:\*\*/);
  assert.match(current, /undici[^\n]*isteğe bağlı[^\n]*express/i);
  assert.match(current, /npm ci[^\n]*package-lock\.json/);
  assert.match(current, /npm audit --omit=dev[^\n]*geliştirme bağımlılıklarını kapsamaz/);
  assert.match(current, /npm pack --dry-run/);
  assert.match(current, /Yayın iş akışı yoktur/);
  assert.ok(planned, 'future protections must be explicitly marked as unimplemented');
  assert.match(planned, /bağımlılık[^\n]*kilit dosyası incelemesi/i);
  assert.match(planned, /değişmez commit SHA/);
  assert.match(planned, /köken kanıtı[^\n]*imzalama/);
});
