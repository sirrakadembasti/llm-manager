#!/usr/bin/env node
import fs from 'node:fs';

const HELP = `llm-manager - bağımsız LLM profil yönetimi sunucusu

Kullanım:
  npx llm-manager [seçenekler]

Seçenekler:
  -p, --port <sayı>   Dinlenecek port (varsayılan: 8010, PORT ile de verilebilir)
  -h, --help          Bu yardımı göster
  -v, --version       Sürümü göster

Ortam değişkenleri (zorunlu):
  LLM_ADMIN_USER      Yönetim arayüzü kullanıcı adı
  LLM_ADMIN_PASSWORD  Yönetim arayüzü parolası

Sunucu yalnız 127.0.0.1 üzerinde dinler; sayfa /llm adresindedir.
Çalışma dizinindeki .env dosyası otomatik okunur.
`;

const args = process.argv.slice(2);
const fail = message => { console.error(`Hata: ${message}\n\n${HELP}`); process.exit(1); };

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help') { console.log(HELP); process.exit(0); }
  if (arg === '-v' || arg === '--version') {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }
  if (arg === '-p' || arg === '--port') {
    const port = Number(args[++i]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail('Geçersiz port.');
    process.env.PORT = String(port);
  } else fail(`Bilinmeyen seçenek: ${arg}`);
}

await import('dotenv').then(({ default: dotenv }) => dotenv.config());
if (!process.env.LLM_ADMIN_USER || !process.env.LLM_ADMIN_PASSWORD) {
  fail('LLM_ADMIN_USER ve LLM_ADMIN_PASSWORD ortam değişkenlerini ayarlayın.');
}

await import('../examples/server.js');
