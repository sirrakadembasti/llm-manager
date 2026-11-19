import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOptionsFromEnv } from '../src/project/options.js';

const base = { LLM_PROJECT_ROOT: '.' };
const MiB = 1024 * 1024;
const limits = {
  LLM_PROJECT_MAX_FILES: ['maxFiles', 20000],
  LLM_PROJECT_MAX_FILE_BYTES: ['maxFileBytes', 8 * MiB],
  LLM_PROJECT_MAX_TOTAL_BYTES: ['maxTotalBytes', 64 * MiB]
};

test('tarama sınırları ortamdan okunur; ayarsız değer varsayılanı bozmaz', () => {
  for (const [name, [option, max]] of Object.entries(limits)) {
    assert.equal(projectOptionsFromEnv({ ...base, [name]: '5000' }, '/x')[option], 5000, name);
    assert.equal(projectOptionsFromEnv({ ...base, [name]: String(max) }, '/x')[option], max, name);
    assert.equal(projectOptionsFromEnv(base, '/x')[option], undefined, name);
  }
});

test('geçersiz, sıfır veya üst sınırı aşan tarama sınırı yok sayılır', () => {
  for (const [name, [option, max]] of Object.entries(limits))
    for (const bad of ['abc', '0', '-5', '1.5', '', ' ', String(max + 1), '1e3', '0x10'])
      assert.equal(projectOptionsFromEnv({ ...base, [name]: bad }, '/x')[option], undefined, `${name}=${bad}`);
});

test('proje kökü yoksa sınır değişkenleri de yok sayılır', () => {
  assert.equal(projectOptionsFromEnv({ LLM_PROJECT_MAX_FILES: '5000' }, '/x'), false);
});
