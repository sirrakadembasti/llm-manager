import fs from 'node:fs';
import { configureNext } from './next-config.js';
import { execFileSync } from 'node:child_process';
import { packageInstalled } from './compiler.js';
import { PKG } from './project.js';
import readline from 'node:readline/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { readEnv } from '../envFile.js';
import { detectProjectType, detectEntryFile } from './detect.js';
import { initLLMProject } from './project.js';
import { injectIntoEntryFile } from './inject.js';
import { verifyIntegration, formatVerificationReport } from './verify.js';
import { probeAndOpenBrowser } from './probe.js';
import { createChangeJournal } from './journal.js';
function isDeclined(answer) {
  const normalized = String(answer ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'h' || normalized === 'hayır' || normalized === 'hayir';
}

export async function runInteractiveInit({
  cwd = process.cwd(),
  type,
  password,
  port = 8010,
  force = false,
  yes = false,
  openBrowser = true,
  autoCloseServer = false,
  askQuestion,
  logger = console.log,
  browserOpener
} = {}) {
  password ??= readEnv(path.join(cwd, '.env')).LLM_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  const journal = createChangeJournal(cwd);
  let rl = null;
  const promptUser = promptText => {
    if (yes === true) return 'e';
    if (typeof askQuestion === 'function') {
      return askQuestion(promptText);
    }
    if (!rl) {
      rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }
    return rl.question(promptText);
  };

  try {
    // Adım 1: Algılama ve Onay
    let detectedType = type || detectProjectType(cwd);
    if (
      !type &&
      fs.existsSync(path.join(cwd, 'package.json')) &&
      fs.readdirSync(cwd).some(name => name.endsWith('.csproj'))
    ) {
      if (yes) throw new Error('Mixed Node/.NET project: choose --type explicitly.');
      const choice = await promptUser('Node veya .NET? (node/dotnet): ');
      if (choice.trim().toLowerCase() === 'dotnet') detectedType = 'dotnet';
    }
    if (detectedType === 'unknown') throw new Error('Unknown project: choose --type explicitly.');
    if (['fastify', 'koa', 'hono', 'nestjs'].includes(detectedType))
      logger(
        detectedType +
          ': llm.fetch(request) / llm.handle({ method, resource, body, isAdmin }) ile elle bağlayın. Otomatik enjeksiyon yapılmaz.'
      );
    if (detectedType === 'tauri')
      logger('Tauri: HTTP istemcisi; yönetim sunucusunu ayrı süreçte npm run llm ile başlatın.');
    if (detectedType === 'electron')
      logger(
        'BrowserWindow webPreferences.preload için preload.cjs kullanın; renderer: window.llm.ask(prompt). Anahtar girişi: openLLMPanel().'
      );
    if (detectedType === 'nextjs') {
      logger(
        'next.config: serverExternalPackages: [' +
          JSON.stringify(PKG) +
          '] ekleyin. Kalıcı disk veya host store gerekir; sunucusuz dosya deposu kalıcı değildir.'
      );
      for (const file of ['next.config.js', 'next.config.mjs', 'next.config.ts'])
        if (fs.existsSync(path.join(cwd, file))) logger(file + ': serverExternalPackages ayarını uygulayın.');
    }
    const entryFile = detectEntryFile(cwd, detectedType);
    logger(
      `\n[Adım 1/4] Algılanan senaryo: ${detectedType} | Hedef dosya: ${entryFile || '(otomatik bağlantı dosyası bulunamadı)'}`
    );
    const step1Answer = await promptUser('Onaylıyor musunuz? (E/h): ');
    if (isDeclined(step1Answer)) {
      logger('Kurulum kullanıcı tarafından iptal edildi.');
      return { aborted: true, step: 'detect' };
    }

    // Dependency installation is an explicit prerequisite, outside scaffold rollback.
    if (!['python', 'dotnet', 'spa', 'tauri'].includes(detectedType) && !packageInstalled(cwd, PKG)) {
      logger(
        'Host paketi eksik. npm install github:sirrakadembasti/llm-manager çalıştırın. Paket kurulumu, package-lock ve node_modules sonraki scaffold rollback sırasında korunur.'
      );
      if (!yes) {
        const answer = await promptUser('Paket projeye kurulsun mu? (e/H): ');
        if (/^(e|evet|y|yes)$/i.test(String(answer).trim())) {
          const version = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url))).version;
          if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid package version');
          execFileSync('npm', ['install', 'github:sirrakadembasti/llm-manager#v' + version], {
            cwd,
            stdio: 'inherit',
            shell: process.platform === 'win32'
          });
        }
      }
    }
    // Adım 2: Dosya Oluşturma, Otomatik Kod Ekleme ve Kontrol Onayı
    const initRes = initLLMProject({ cwd, type: detectedType, password, force, journal });
    if (detectedType === 'nextjs') await configureNext({ cwd, journal, promptUser, yes, logger, packageName: PKG });
    const injectRes = injectIntoEntryFile({ cwd, type: detectedType, entryFile, esm: initRes.esm, journal });

    if (initRes.targetFramework) logger('Hedef çatı: ' + initRes.targetFramework);
    if (injectRes.reason) logger(injectRes.reason);
    logger('\n[Adım 2/4] Oluşturulan dosyalar ve kod eklemeleri:');
    if (initRes.createdFiles.length > 0) {
      logger(`📄 Oluşturulan dosyalar: ${initRes.createdFiles.join(', ')}`);
    } else {
      logger('📄 Yardımcı bağlantı dosyaları zaten mevcut.');
    }
    if (injectRes.diffPreview) {
      logger(`📝 ${injectRes.entryFile} dosyasına eklenen satırlar:\n${injectRes.diffPreview}`);
    } else if (injectRes.alreadyIntegrated) {
      logger(`📝 ${injectRes.entryFile} dosyası zaten entegre edilmiş.`);
    }

    const step2Answer = await promptUser(
      'Yapılan eklemeleri kontrol ettiniz mi, iç doğrulama adımına geçilsin mi? (E/h): '
    );
    if (isDeclined(step2Answer)) {
      journal.rollback();
      logger('Değişiklikler geri alındı (rollback).');
      return { aborted: true, rolledBack: true, step: 'inject' };
    }

    // Adım 3: Otomatik İç Kontrol
    const verification = verifyIntegration({ cwd, type: detectedType, entryFile });
    const reportText = formatVerificationReport(verification);
    logger(`\n[Adım 3/4] Otomatik İç Kontrol Raporu:\n${reportText}`);
    if (!verification.ok) {
      logger('\n❌ İç doğrulama başarısız oldu. Lütfen yukarıdaki çözüm önerilerini uygulayın.');
      const rollbackAnswer = yes ? 'e' : await promptUser('Değişiklikler geri alınsın mı? (E/h): ');
      const rolledBack = !isDeclined(rollbackAnswer);
      if (rolledBack) journal.rollback();
      return { ok: false, step: 'verify', verification, rolledBack };
    }

    // Adım 4: Canlı /llm Yoklaması ve Tarayıcı Açma
    const probe = await probeAndOpenBrowser({
      cwd,
      port,
      password,
      openBrowser,
      autoCloseStartedServer: autoCloseServer,
      browserOpener
    });

    if (probe.ok) {
      logger(`\n[Adım 4/4] ✅ Canlı /llm yönetim ekranı doğrulandı!`);
      logger(`🌐 Yönetim Adresi: ${probe.url}`);
      logger('Parola .env dosyasında LLM_ADMIN_PASSWORD olarak saklandı.');
    }

    return {
      ok: probe.ok,
      type: detectedType,
      entryFile,
      initRes,
      injectRes,
      verification,
      probe
    };
  } catch (error) {
    journal.rollback();
    throw error;
  } finally {
    if (rl) {
      rl.close();
    }
  }
}
