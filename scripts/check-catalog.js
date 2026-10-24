#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { PROVIDERS } from '../src/providers.js';
import { getTransport } from '../src/transports/index.js';
import { providerEndpoint, providerAuthHeaders } from '../src/runtime.js';
import { providerFetch } from '../src/providerTransport.js';

const options = {
  provider: { type: 'string', short: 'p' },
  'api-key': { type: 'string', short: 'k' },
  'allow-local-http': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h' }
};

export function resolveApiKey(providerId, overrideKey) {
  if (overrideKey) return overrideKey;
  const envCandidates = [
    `PROVIDER_KEY_${providerId.toUpperCase()}`,
    `${providerId.toUpperCase()}_API_KEY`,
    'LLM_API_KEY'
  ];
  for (const envKey of envCandidates) {
    if (process.env[envKey]) return process.env[envKey];
  }
  return null;
}

export async function checkProvider(provider, apiKey, networkOptions = {}) {
  const dummyProfile = {
    provider: provider.id,
    baseURL: provider.baseURL,
    apiKey,
    transport: provider.transport
  };

  const transport = getTransport(provider.transport);
  const url = providerEndpoint(dummyProfile, 'models', networkOptions);
  const headers = providerAuthHeaders(dummyProfile);

  const res = await providerFetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
    ...networkOptions
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const payload = await res.json();
  const remoteModels = transport.parseModels(payload);
  const remoteSet = new Set(remoteModels);

  const catalogModels = provider.models || [];
  const verified = [];
  const missingInRemote = [];

  for (const model of catalogModels) {
    if (remoteSet.has(model)) {
      verified.push(model);
    } else {
      missingInRemote.push(model);
    }
  }

  return {
    remoteCount: remoteModels.length,
    catalogCount: catalogModels.length,
    verified,
    missingInRemote,
    sampleRemote: remoteModels.slice(0, 5)
  };
}

export async function runCatalogCheck(argv = process.argv.slice(2)) {
  const { values } = parseArgs({ args: argv, options, allowPositionals: false });

  if (values.help) {
    console.log(`
Kullanım:
  node scripts/check-catalog.js [seçenekler]

Seçenekler:
  -p, --provider <id>     Yalnızca belirtilen sağlayıcıyı kontrol et (örn. openai, anthropic)
  -k, --api-key <key>     Kontrol edilecek sağlayıcının API anahtarı (veya env: PROVIDER_KEY_<ID> ya da <ID>_API_KEY)
  --allow-local-http      Yerel HTTP uç noktalarına (örn. ollama) izin ver
  -h, --help              Yardım mesajını göster
`);
    return 0;
  }

  console.log('--- llm-manager Katalog Doğrulama Aracı ---');
  const targetProviders = values.provider ? PROVIDERS.filter(p => p.id === values.provider) : PROVIDERS;

  if (values.provider && targetProviders.length === 0) {
    console.error(`Bilinmeyen sağlayıcı: "${values.provider}".`);
    return 1;
  }

  const networkOptions = {
    allowLocalHttp: values['allow-local-http']
  };

  let checkedCount = 0;
  let hasErrors = false;

  for (const provider of targetProviders) {
    if (!provider.baseURL) {
      console.log(`[ATLANDI] ${provider.name} (${provider.id}): Sabit baseURL tanımlanmamış.`);
      continue;
    }

    const apiKey = resolveApiKey(provider.id, values['api-key']);
    if (!apiKey) {
      console.log(
        `[ATLANDI] ${provider.name} (${provider.id}): API anahtarı yok (sağlamak için -k veya env tanımlayın).`
      );
      continue;
    }

    checkedCount++;
    process.stdout.write(`[KONTROL] ${provider.name} (${provider.id})... `);

    try {
      const result = await checkProvider(provider, apiKey, networkOptions);
      console.log('BAŞARILI');
      console.log(`  * Uzak model sayısı: ${result.remoteCount}`);
      console.log(
        `  * Doğrulanan katalog modelleri (${result.verified.length}/${result.catalogCount}): ${result.verified.join(', ') || 'Yok'}`
      );
      if (result.missingInRemote.length > 0) {
        console.warn(
          `  * DİKKAT: Uzak listede bulunamayan katalog modelleri (${result.missingInRemote.length}): ${result.missingInRemote.join(', ')}`
        );
        hasErrors = true;
      }
    } catch (err) {
      console.log('HATA');
      console.error(`  * ${err.message}`);
      hasErrors = true;
    }
  }

  console.log('-------------------------------------------');
  console.log(`Tamamlandı: ${checkedCount} sağlayıcı kontrol edildi.`);
  return hasErrors ? 1 : 0;
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirectRun) {
  runCatalogCheck().then(code => {
    if (code !== 0) process.exit(code);
  });
}
