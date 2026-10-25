import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('YH2-G23: README dates default models from catalog metadata and explains refresh', () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../src/catalog/providers.json', import.meta.url), 'utf8'));
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const catalogLine = readme.split('\n').find(line => line.includes('varsayılan model listeleri'));

  assert.ok(catalogLine, 'README must describe the default model lists');
  assert.ok(
    catalogLine.includes(`katalog tarihi: ${catalog.updatedAt.slice(0, 7)}`),
    'Default model date must match catalog metadata'
  );
  assert.ok(
    catalogLine.includes('güncel liste için **Modelleri getir** kullanın'),
    'Default models must include the current-list instruction'
  );
});
