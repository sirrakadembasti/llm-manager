#!/usr/bin/env node
import fs from 'node:fs';
import { runInteractiveInit } from '../src/init.js';

const HELP = `llm-manager - bağımsız LLM profil yönetimi sunucusu ve kurulum sihirbazı

Kullanım:
  npx llm-manager init [seçenekler]         Etkileşimli kurulum sihirbazını çalıştırır ve /llm ekranını açar
  npx llm-manager --password <parola>       Yönetim sunucusunu (/llm) başlatır

Seçenekler:
  -t, --type <tip>      Proje tipi: express | spa | nextjs | nuxt | sveltekit | electron | dotnet | python (varsayılan: otomatik algılar)
  -w, --password <sır>  Yönetim arayüzü parolası (LLM_ADMIN_PASSWORD ile de verilebilir)
  -u, --user <ad>       Kullanıcı adı (varsayılan: admin, LLM_ADMIN_USER ile de verilebilir)
  -c, --cors <adres>    İzin verilen SPA/masaüstü adresleri (ör. http://localhost:5173 veya *)
  -p, --port <sayı>     Dinlenecek port (varsayılan: 8010, PORT ile de verilebilir)
  -f, --force           Mevcut llm.js dosyasının üzerine yaz
  -y, --yes             Kurulum sorularını otomatik onayla (etkileşimsiz mod)
  --no-open             Kurulum sonunda varsayılan tarayıcıyı otomatik açma
  -h, --help            Bu yardımı göster
  -v, --version         Sürümü göster

Sunucu yalnız 127.0.0.1 üzerinde dinler; sayfa /llm adresindedir.
Çalışma dizinindeki .env dosyası otomatik okunur.
`;

await import('dotenv').then(({ default: dotenv }) => dotenv.config());

const args = process.argv.slice(2);
const fail = message => {
  console.error(`Hata: ${message}\n\n${HELP}`);
  process.exit(1);
};

let isInit = false;
let initType;
let force = false;
let yes = false;
let openBrowser = true;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === 'init') {
    isInit = true;
    continue;
  }
  if (arg === '-h' || arg === '--help') {
    console.log(HELP);
    process.exit(0);
  }
  if (arg === '-v' || arg === '--version') {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }
  if (arg === '-t' || arg === '--type') {
    initType = String(args[++i] || '');
  } else if (arg === '-f' || arg === '--force') {
    force = true;
  } else if (arg === '-y' || arg === '--yes') {
    yes = true;
  } else if (arg === '--no-open') {
    openBrowser = false;
  } else if (arg === '-p' || arg === '--port') {
    const port = Number(args[++i]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail('Geçersiz port.');
    process.env.PORT = String(port);
  } else if (arg === '-w' || arg === '--password') {
    process.env.LLM_ADMIN_PASSWORD = String(args[++i] || '');
  } else if (arg === '-u' || arg === '--user') {
    process.env.LLM_ADMIN_USER = String(args[++i] || '');
  } else if (arg === '-c' || arg === '--cors') {
    process.env.LLM_ALLOWED_ORIGINS = String(args[++i] || '');
  } else fail(`Bilinmeyen seçenek: ${arg}`);
}

if (isInit) {
  const result = await runInteractiveInit({
    type: initType,
    password: process.env.LLM_ADMIN_PASSWORD || 'admin123',
    port: Number(process.env.PORT) || 8010,
    force,
    yes,
    openBrowser
  });
  if (result.aborted) {
    process.exit(0);
  }
  if (!result.ok) {
    process.exit(1);
  }
  if (result.probe?.startedServer) {
    console.log('\n🚀 Yönetim sunucusu açık bırakıldı (durdurmak için Ctrl+C).');
  } else {
    process.exit(0);
  }
} else {
  if (!process.env.LLM_ADMIN_PASSWORD) {
    fail('Parola gerekli: --password <parola> verin veya LLM_ADMIN_PASSWORD ortam değişkenini ayarlayın.');
  }

  await import('../examples/server.js');
}
