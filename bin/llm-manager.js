#!/usr/bin/env node
import fs from 'node:fs';
import { initLLMProject } from '../src/init.js';

const HELP = `llm-manager - bağımsız LLM profil yönetimi sunucusu ve kurulum sihirbazı

Kullanım:
  npx llm-manager init [seçenekler]         Projenize hazır llm.js bağlantı dosyasını oluşturur
  npx llm-manager --password <parola>       Yönetim sunucusunu (/llm) başlatır

Seçenekler:
  -t, --type <tip>      Proje tipi: express | spa | nextjs | electron | python (varsayılan: otomatik algılar)
  -w, --password <sır>  Yönetim arayüzü parolası (LLM_ADMIN_PASSWORD ile de verilebilir)
  -u, --user <ad>       Kullanıcı adı (varsayılan: admin, LLM_ADMIN_USER ile de verilebilir)
  -c, --cors <adres>    İzin verilen SPA/masaüstü adresleri (ör. http://localhost:5173 veya *)
  -p, --port <sayı>     Dinlenecek port (varsayılan: 8010, PORT ile de verilebilir)
  -f, --force           Mevcut llm.js dosyasının üzerine yaz
  -h, --help            Bu yardımı göster
  -v, --version         Sürümü göster

Sunucu yalnız 127.0.0.1 üzerinde dinler; sayfa /llm adresindedir.
Çalışma dizinindeki .env dosyası otomatik okunur.
`;

await import('dotenv').then(({ default: dotenv }) => dotenv.config());

const args = process.argv.slice(2);
const fail = message => { console.error(`Hata: ${message}\n\n${HELP}`); process.exit(1); };

let isInit = false;
let initType;
let force = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === 'init') { isInit = true; continue; }
  if (arg === '-h' || arg === '--help') { console.log(HELP); process.exit(0); }
  if (arg === '-v' || arg === '--version') {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }
  if (arg === '-t' || arg === '--type') {
    initType = String(args[++i] || '');
  } else if (arg === '-f' || arg === '--force') {
    force = true;
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
  const result = initLLMProject({
    type: initType,
    password: process.env.LLM_ADMIN_PASSWORD || 'admin123',
    force
  });
  console.log(`\n✅ llm-manager kurulumu tamamlandı! (Algılanan proje tipi: ${result.type})`);
  if (result.createdFiles.length) {
    console.log(`📄 Oluşturulan dosyalar: ${result.createdFiles.join(', ')}`);
  }
  if (result.type === 'express') {
    console.log(result.esm
      ? `\nAna sunucu dosyanıza (server.js / app.js) şu 2 satırı ekleyin:\n  import { setupLLM, askLLM } from './llm.js';\n  setupLLM(app);\n\nSoru sormak için:\n  const cevap = await askLLM('Merhaba!');`
      : `\nAna sunucu dosyanıza (server.js / app.js) şu 2 satırı ekleyin:\n  const { setupLLM, askLLM } = require('./llm');\n  setupLLM(app);\n\nSoru sormak için:\n  const cevap = await askLLM('Merhaba!');`);
  } else if (result.type === 'nextjs') {
    console.log(`\nNext.js rotalarınız (/llm ve /api/llm) hazır! Soru sormak için:\n  import { askLLM } from './llm.js';\n  const cevap = await askLLM('Merhaba!');`);
  } else if (result.type === 'spa') {
    console.log(`\n1. Yönetim servisini başlatın: npm run llm\n2. Ön yüz kodunuzda soru sorun:\n  import { askLLM } from './${result.createdFiles[0] || 'llm.js'}';\n  const cevap = await askLLM('Merhaba!');`);
  } else if (result.type === 'electron') {
    console.log(`\n1. API anahtarınızı girmek için: npm run llm (http://127.0.0.1:8010/llm)\n2. Electron main.js dosyanızda:\n  import { askLLM, registerLLMIpc } from './llm.js';\n  registerLLMIpc(ipcMain);`);
  } else if (result.type === 'python') {
    console.log(`\n1. Yönetim servisini başlatın: npx llm-manager --password ${result.password}\n2. Python kodunuzda:\n  from llm_client import ask_llm\n  print(ask_llm("Merhaba!"))`);
  }
  process.exit(0);
}

if (!process.env.LLM_ADMIN_PASSWORD) {
  fail('Parola gerekli: --password <parola> verin veya LLM_ADMIN_PASSWORD ortam değişkenini ayarlayın.');
}

await import('../examples/server.js');
