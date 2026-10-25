#!/usr/bin/env node
import fs from 'node:fs';
import { runInteractiveInit } from '../src/init.js';

const HELP = `llm-manager - bağımsız LLM profil yönetimi sunucusu ve kurulum sihirbazı

Bu komutlar yalnız @sirrakadembasti/llm-manager projeye kurulduktan sonra kullanılır.
npm'deki llm-manager paketi bu projeyle ilgili değildir.

Kullanım:
  npx llm-manager init [seçenekler]         Etkileşimli kurulum sihirbazını çalıştırır ve /llm ekranını açar
  npx llm-manager --password <parola>       Yönetim sunucusunu (/llm) başlatır
  npx llm-manager key rotate                Şifreleme anahtarını döndürür ve profilleri yeniden şifreler
  npx llm-manager export --out <dosya>      Profilleri şifreli taşınabilir yedek olarak dışa aktarır
  npx llm-manager import <dosya>            Şifreli yedekten profilleri içe aktarır

Seçenekler:
  -t, --type <tip>          Proje tipi: express | spa | nextjs | nuxt | sveltekit | electron | dotnet | python | fastify | koa | hono | nestjs | tauri (varsayılan: otomatik algılar)
  -w, --password <sır>      Yönetim / yedekleme parolası (LLM_ADMIN_PASSWORD / LLM_BACKUP_PASSWORD)
  -u, --user <ad>           Kullanıcı adı (varsayılan: admin, LLM_ADMIN_USER ile de verilebilir)
  --host <adres>            Dinlenecek adres (varsayılan: 127.0.0.1)
  -p, --port <sayı>         Dinlenecek port (varsayılan: 8010, PORT ile de verilebilir)
  -c, --cors <adres>        İzin verilen SPA/masaüstü adresleri (ör. http://localhost:5173 veya *)
  --data-dir <dizin>        Profil ve anahtar verilerinin saklanacağı klasör
  --out <dosya>             Dışa aktarılacak dosya yolu (export için)
  --replace                 İçe aktarırken aynı kimlikli mevcut profillerin üzerine yaz
  --chat-token <belirteç>   Sohbet istemcileri için izinli yetki belirteci
  -f, --force               Mevcut llm.js dosyasının üzerine yaz
  -y, --yes                 Kurulum sorularını otomatik onayla (etkileşimsiz mod)
  --no-open                 Kurulum sonunda varsayılan tarayıcıyı otomatik açma
  -h, --help                Bu yardımı göster
  -v, --version             Sürümü göster

Sunucu varsayılan olarak 127.0.0.1 üzerinde dinler; sayfa /llm adresindedir.
Çalışma dizinindeki .env dosyası otomatik okunur.
--password komut satırı geçmişine düşer; .env ya da ortam değişkeni önerilir.
`;

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch (e) {
  if (e?.code !== 'ENOENT') {
    // .env yoksa veya okunamadıysa yoksay
  }
}

const args = process.argv.slice(2);
const fail = message => {
  console.error(`Hata: ${message}\n\n${HELP}`);
  process.exit(1);
};

if (args[0] === 'key' && args[1] === 'rotate') {
  const { rotateEncryptionKey } = await import('../src/setup.js');
  let dataDir = process.env.LLM_DATA_DIR;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--data-dir') dataDir = String(args[++i] || '');
  }
  try {
    const res = rotateEncryptionKey({ dataDir });
    console.log(`✓ Şifreleme anahtarı başarıyla döndürüldü.`);
    console.log(`  Yeniden şifrelenen profil sayısı: ${res.count}`);
    if (res.backupKeyPath) console.log(`  Eski anahtar yedeği: ${res.backupKeyPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`Hata: ${err.message}`);
    process.exit(1);
  }
}

if (args[0] === 'export') {
  const { exportProfiles } = await import('../src/setup.js');
  let dataDir = process.env.LLM_DATA_DIR;
  let outputPath;
  let password = process.env.LLM_BACKUP_PASSWORD || process.env.LLM_ADMIN_PASSWORD;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out') outputPath = String(args[++i] || '');
    else if (args[i] === '--data-dir') dataDir = String(args[++i] || '');
    else if (args[i] === '-w' || args[i] === '--password') password = String(args[++i] || '');
  }
  if (!outputPath) fail('Dışa aktarma çıktısı gerekli: --out <dosya>');
  if (!password) fail('Yedekleme parolası gerekli: --password <parola> veya LLM_BACKUP_PASSWORD');
  try {
    const res = exportProfiles({ dataDir, outputPath, password });
    console.log(`✓ ${res.profileCount} profil başarıyla şifreli olarak dışa aktarıldı: ${res.outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`Hata: ${err.message}`);
    process.exit(1);
  }
}

if (args[0] === 'import') {
  const { importProfiles } = await import('../src/setup.js');
  let dataDir = process.env.LLM_DATA_DIR;
  let inputPath = args[1] && !args[1].startsWith('-') ? args[1] : null;
  let password = process.env.LLM_BACKUP_PASSWORD || process.env.LLM_ADMIN_PASSWORD;
  let replace = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--replace') replace = true;
    else if (args[i] === '--data-dir') dataDir = String(args[++i] || '');
    else if (args[i] === '-w' || args[i] === '--password') password = String(args[++i] || '');
    else if (!inputPath && !args[i].startsWith('-')) inputPath = args[i];
  }
  if (!inputPath) fail('İçe aktarılacak dosya gerekli: npx llm-manager import <dosya>');
  if (!password) fail('Yedek parolası gerekli: --password <parola> veya LLM_BACKUP_PASSWORD');
  try {
    const res = importProfiles({ dataDir, inputPath, password, replace });
    console.log(`✓ ${res.importedCount} profil başarıyla içe aktarıldı (Toplam profil: ${res.totalCount}).`);
    process.exit(0);
  } catch (err) {
    console.error(`Hata: ${err.message}`);
    process.exit(1);
  }
}

let isInit = false;
let initType;
let force = false;
let yes = false;
let openBrowser = true;
let host = process.env.HOST || '127.0.0.1';
let dataDir = process.env.LLM_DATA_DIR;
let chatTokens = process.env.LLM_CHAT_TOKENS;

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
  } else if (arg === '--host') {
    host = String(args[++i] || '127.0.0.1');
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
  } else if (arg === '--data-dir') {
    dataDir = String(args[++i] || '');
  } else if (arg === '--chat-token') {
    chatTokens = String(args[++i] || '');
  } else fail(`Bilinmeyen seçenek: ${arg}`);
}

if (isInit) {
  const result = await runInteractiveInit({
    type: initType,
    password: process.env.LLM_ADMIN_PASSWORD,
    allowedOrigins: process.env.LLM_ALLOWED_ORIGINS,
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

  const { createStandaloneServer } = await import('../src/server.js');
  const serverInstance = await createStandaloneServer({
    host,
    port: Number(process.env.PORT) || 8010,
    adminUser: process.env.LLM_ADMIN_USER || 'admin',
    adminPassword: process.env.LLM_ADMIN_PASSWORD,
    allowedOrigins: process.env.LLM_ALLOWED_ORIGINS || '',
    dataDir,
    chatTokens
  });

  console.log(`LLM yönetimi: ${serverInstance.url} (Kullanıcı: ${process.env.LLM_ADMIN_USER || 'admin'})`);

  const shutdown = () => {
    serverInstance.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
