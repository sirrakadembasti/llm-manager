#!/usr/bin/env node
// Dağıtım kabulü: çalışan bir LLM Manager örneğine (doğrudan, Docker, Nginx/IIS arkası) dışarıdan
// HTTP(S) istekleri atıp erişim, CSRF ve profil kalıcılığını denetler. Model çağrısı yapmaz.
//
//   LLM_ADMIN_PASSWORD=... node scripts/acceptance/deploy-check.mjs --base https://llm.kabul.test \
//     --phase create|verify [--page-path /llm] [--api-path /api/llm] [--ca ca.pem] [--wait 60]
//
// create: kabul profilini kaydeder. verify: yeniden başlatmadan sonra profilin hâlâ durduğunu doğrular.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Agent, fetch } from 'undici';

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    phase: { type: 'string', default: 'create' },
    'page-path': { type: 'string', default: '/llm' },
    'api-path': { type: 'string', default: '/api/llm' },
    user: { type: 'string', default: process.env.LLM_ADMIN_USER || 'admin' },
    ca: { type: 'string' },
    wait: { type: 'string', default: '60' }
  }
});

const PROFILE_NAME = 'Dağıtım kabulü';
const base = values.base?.replace(/\/+$/, '');
const pagePath = values['page-path'];
const apiPath = values['api-path'];
const password = process.env.LLM_ADMIN_PASSWORD;
if (!base || !password || !['create', 'verify'].includes(values.phase)) {
  console.error('Kullanım: LLM_ADMIN_PASSWORD=... deploy-check.mjs --base <url> --phase create|verify');
  process.exit(2);
}

const dispatcher = values.ca ? new Agent({ connect: { ca: readFileSync(values.ca, 'utf8') } }) : undefined;
const basic = (user, pass) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const auth = basic(values.user, password);
const request = (path, init = {}) => fetch(`${base}${path}`, { redirect: 'manual', dispatcher, ...init });

let failures = 0;
function expect(condition, label, detail = '') {
  console.log(`${condition ? 'ok  ' : 'HATA'} ${label}${!condition && detail ? ` — ${detail}` : ''}`);
  if (!condition) failures++;
}

async function waitForHealth() {
  const deadline = Date.now() + Number(values.wait) * 1000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await request(`${apiPath}/health`);
      if (response.ok) return response.json();
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.cause?.code || error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`sağlık kontrolü ${values.wait} sn içinde yanıt vermedi (${last})`);
}

try {
  const health = await waitForHealth();
  expect(health.ok === true, `${apiPath}/health oturumsuz 200 ve ok:true`);

  const pageAnon = await request(pagePath);
  expect(pageAnon.status === 401, `${pagePath} oturumsuz 401`, `HTTP ${pageAnon.status}`);
  const pageWrong = await request(pagePath, { headers: { authorization: basic(values.user, `${password}-yanlis`) } });
  expect(pageWrong.status === 401, `${pagePath} yanlış parolayla 401`, `HTTP ${pageWrong.status}`);

  const page = await request(pagePath, { headers: { authorization: auth } });
  const html = await page.text();
  expect(page.status === 200, `${pagePath} oturumlu 200`, `HTTP ${page.status}`);
  expect(html.includes(`src="${pagePath}/llm-ui.js"`), 'sayfa arayüz betiğini aynı önekle yükler');
  expect(html.includes(`data-api-base="${apiPath}"`), 'sayfa API adresini aynı önekle bildirir');

  const script = await request(`${pagePath}/llm-ui.js`, { headers: { authorization: auth } });
  expect(
    script.status === 200 && /javascript/.test(script.headers.get('content-type') || ''),
    `${pagePath}/llm-ui.js oturumlu 200 JavaScript`,
    `HTTP ${script.status} ${script.headers.get('content-type')}`
  );
  await script.arrayBuffer();

  const listAnon = await request(`${apiPath}/profiles`);
  expect(listAnon.status === 401, `${apiPath}/profiles oturumsuz 401`, `HTTP ${listAnon.status}`);

  // Kayıt sağlayıcıya istek atmaz; anahtar sahte olduğundan model çağrısı da yapılamaz.
  const profile = {
    name: PROFILE_NAME,
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'kabul-model',
    apiKey: 'kabul-sahte-anahtar'
  };
  const json = { authorization: auth, 'content-type': 'application/json' };
  const noCsrf = await request(`${apiPath}/profiles`, { method: 'POST', headers: json, body: JSON.stringify(profile) });
  expect(noCsrf.status === 403, 'CSRF başlığı olmayan yazma isteği 403', `HTTP ${noCsrf.status}`);

  const list = async () => {
    const response = await request(`${apiPath}/profiles`, { headers: { authorization: auth } });
    expect(response.status === 200, `${apiPath}/profiles oturumlu 200`, `HTTP ${response.status}`);
    return (await response.json()).profiles ?? [];
  };

  if (values.phase === 'create') {
    const existing = (await list()).some(item => item.name === PROFILE_NAME);
    if (!existing) {
      const saved = await request(`${apiPath}/profiles`, {
        method: 'POST',
        headers: { ...json, 'x-llm-csrf': '1' },
        body: JSON.stringify(profile)
      });
      expect(saved.status === 201, 'kabul profili kaydedildi (201)', `HTTP ${saved.status} ${await saved.text()}`);
    }
    expect(
      (await list()).some(item => item.name === PROFILE_NAME),
      'kabul profili listede'
    );
  } else {
    const profiles = await list();
    const found = profiles.find(item => item.name === PROFILE_NAME);
    expect(Boolean(found), 'kabul profili yeniden başlatmadan sonra duruyor', 'kabul profili bulunamadı');
    expect(found ? !JSON.stringify(found).includes(profile.apiKey) : true, 'API anahtarı yanıtta açık görünmüyor');
  }
} catch (error) {
  console.log(`HATA ${error.message}`);
  failures++;
}

if (failures) {
  console.log(`KABUL BAŞARISIZ (${values.phase}): ${failures} denetim geçmedi`);
  process.exit(1);
}
console.log(`KABUL TAMAM (${values.phase})`);
