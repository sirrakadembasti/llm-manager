import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

export async function recoveryFixture(t, content = '{"apiKey":"secret-corrupt-bytes",') {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-recovery-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const file = path.join(dataDir, 'llm-profiles.json');
  const backup = '{"version":1,"activeId":null,"profiles":[]}';
  await fs.writeFile(file, content);
  await fs.writeFile(`${file}.bak`, backup);
  return {
    file,
    options: { dataDir, adminPassword: 'recovery-password', rateLimit: false },
    async unchanged() {
      assert.equal(await fs.readFile(file, 'utf8'), content);
      assert.equal(await fs.readFile(`${file}.bak`, 'utf8'), backup);
    }
  };
}

export async function assertRepairResponse(response) {
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.code, 'STORE_CORRUPT');
  assert.match(body.error, /bozuk|geçersiz JSON/);
  assert.match(body.error, /llm-profiles\.json\.bak/);
  assert.match(body.error, /üzerine kopyala/);
  assert.equal(JSON.stringify(body).includes('secret-corrupt-bytes'), false);
  return body;
}

export async function assertUiRepair(fetchRequest) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '' });
    return elements.get(id);
  };
  element('llm-i18n').textContent = await fs.readFile('public/i18n/tr.json', 'utf8');
  const context = vm.createContext({
    document: { body: { dataset: {} }, getElementById: element },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetchRequest
  });
  const source = (await fs.readFile('public/llm-ui.js', 'utf8')).replace(/init\(\)\.catch[\s\S]*$/, '');
  vm.runInContext(source, context);
  await vm.runInContext('loadProfiles().catch(error => message(error.message, true))', context);
  assert.equal(element('message').className, 'error');
  assert.match(element('message').textContent, /STORE_CORRUPT/);
  assert.match(element('message').textContent, /llm-profiles\.json\.bak.*üzerine kopyala/);
}
