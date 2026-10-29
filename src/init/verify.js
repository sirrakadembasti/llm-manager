import { packageInstalled, checkSource } from './compiler.js';
import { PKG } from './project.js';
import { INSTALL_SPEC, EXPRESS_SPEC, needsHostPackage, standalonePrerequisite } from './standalone.js';
import fs from 'node:fs';
import path from 'node:path';
import { detectProjectType, detectEntryFile } from './detect.js';
import { resolveLlmRelPath } from './paths.js';
import { readEnv } from '../envFile.js';
function getExpectedHelperFiles(cwd, type) {
  const env = readEnv(path.join(cwd, '.env'));
  const pagePath = env.LLM_PAGE_PATH || '/llm';
  const apiPath = env.LLM_API_PATH || '/api/llm';
  if (type === 'python') return ['llm_client.py'];
  if (type === 'dotnet') return ['LlmClient.cs'];
  if (type === 'spa') return [resolveLlmRelPath(cwd, 'spa')];
  if (type === 'nextjs') {
    const hasSrcApp = fs.existsSync(path.join(cwd, 'src', 'app'));
    const baseDir = hasSrcApp ? 'src' : '';
    const llmRel = baseDir ? `${baseDir}/llm.js` : 'llm.js';
    const apiRouteRel = `${baseDir ? `${baseDir}/` : ''}app${apiPath}/[...slug]/route.js`;
    const pageRouteRel = `${baseDir ? `${baseDir}/` : ''}app${pagePath}/[[...slug]]/route.js`;
    return [llmRel, apiRouteRel, pageRouteRel, `${baseDir ? `${baseDir}/` : ''}app/actions/llm.js`];
  }
  if (type === 'nuxt') {
    return [
      'server/utils/llm.js',
      `server/routes${apiPath}/[...slug].js`.replace(/^server\/routes\/api\//, 'server/api/'),
      `server/routes${pagePath}/[...slug].js`
    ];
  }
  if (type === 'sveltekit') {
    return [
      'src/lib/server/llm.js',
      `src/routes${apiPath}/[...slug]/+server.js`,
      `src/routes${pagePath}/[...slug]/+server.js`,
      'src/routes/api/ask/+server.js'
    ];
  }
  return ['llm.js'];
}

export function verifyIntegration({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  entryFile = detectEntryFile(cwd, type)
} = {}) {
  const normalizedEntry = entryFile ? entryFile.replace(/\\/g, '/').replace(/^\.\//, '') : null;
  const checks = [];
  const warnings = [];
  const integrationEnv = readEnv(path.join(cwd, '.env'));
  if (integrationEnv.LLM_AUTH_MODE === 'host') {
    const adapter = path.resolve(cwd, integrationEnv.LLM_HOST_AUTH_MODULE || '');
    checks.push({
      id: 'host_auth',
      title: 'Host yönetici oturumu adaptörü',
      ok:
        type === 'express' &&
        adapter.startsWith(path.resolve(cwd) + path.sep) &&
        fs.existsSync(adapter) &&
        fs.statSync(adapter).isFile(),
      solution: 'LLM_HOST_AUTH_MODULE ile proje içindeki requireAuth middleware adaptörünü belirtin.'
    });
    warnings.push(
      'Host oturumu canlı olarak yoklanmadı; hedef uygulamada yönetici, normal kullanıcı ve oturumsuz erişimi test edin.'
    );
  }
  warnings.push(
    'Yol taraması sabit rotaları kontrol eder. Dinamik rotalar, proxy ve middleware sırası hedef uygulamada ayrıca doğrulanmalıdır.'
  );
  if (needsHostPackage(cwd, type))
    checks.push({
      id: 'package_installed',
      title: 'Host Paket Kurulumu',
      ok: packageInstalled(cwd, PKG),
      solution: 'npm install ' + INSTALL_SPEC + ' komutunu host projede çalıştırın.'
    });
  if (needsHostPackage(cwd, type) && packageInstalled(cwd, PKG))
    checks.push({
      id: 'standalone_express',
      title: 'Bağımsız Sunucu Express Önkoşulu',
      ok: standalonePrerequisite(cwd),
      solution: 'Host projede npm install ' + EXPRESS_SPEC + ' çalıştırın.'
    });
  const ignored = fs.existsSync(path.join(cwd, '.gitignore'))
    ? fs
        .readFileSync(path.join(cwd, '.gitignore'), 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
    : [];
  checks.push({
    id: 'secrets_ignored',
    title: 'Sır Dosyalarının Git Dışında Tutulması',
    ok: ['data/', '.env', '.env.local', '*.key'].every(entry => ignored.includes(entry)),
    solution: '.gitignore dosyasına data/, .env, .env.local ve *.key ekleyin.'
  });

  // 1. data_dir kontrolü
  const dataDirTitle = 'Veri ve Şifreleme Klasörü Kontrolü';
  const dataDir = path.join(cwd, 'data');
  try {
    fs.accessSync(fs.existsSync(dataDir) ? dataDir : cwd, fs.constants.W_OK);
    checks.push({ id: 'data_dir', title: dataDirTitle, ok: true });
  } catch {
    checks.push({
      id: 'data_dir',
      title: dataDirTitle,
      ok: false,
      error: 'Veri klasörüne (./data) yazma izni yok.',
      solution:
        'Proje klasörünün yazma izinlerini kontrol edin veya uygulamayı yazma izni olan bir klasörde çalıştırın.'
    });
  }

  // 2. helper_files kontrolü
  const helperTitle = 'Yardımcı Bağlantı Dosyaları Kontrolü';
  const expectedHelpers = getExpectedHelperFiles(cwd, type);
  let missingHelper = null;
  for (const rel of expectedHelpers) {
    const full = path.join(cwd, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile() || fs.readFileSync(full, 'utf8').trim().length === 0) {
      missingHelper = rel;
      break;
    }
  }
  if (missingHelper) {
    checks.push({
      id: 'helper_files',
      title: helperTitle,
      ok: false,
      error: `Eksik bağlantı dosyası tespit edildi: ${missingHelper}`,
      solution: 'Eksik dosyaları yeniden oluşturmak için terminalde "npx llm-manager init --force" komutunu çalıştırın.'
    });
  } else {
    checks.push({ id: 'helper_files', title: helperTitle, ok: true });
  }

  // 3. entry_binding kontrolü
  const bindingTitle = 'Ana Dosya Import / Bağlantı Kontrolü';
  if (
    normalizedEntry &&
    fs.existsSync(path.join(cwd, normalizedEntry)) &&
    fs.statSync(path.join(cwd, normalizedEntry)).isFile()
  ) {
    const content = fs.readFileSync(path.join(cwd, normalizedEntry), 'utf8');
    let hasBinding;
    if (type === 'express') {
      hasBinding = /\b(?:setupLLM|askLLM)\b/.test(content);
    } else if (['nextjs', 'nuxt', 'sveltekit'].includes(type)) {
      hasBinding = true;
    } else if (type === 'spa') {
      hasBinding = /\baskLLM\b/.test(content);
    } else if (type === 'electron') {
      hasBinding = /\b(?:registerLLMIpc|askLLM)\b/.test(content);
    } else if (type === 'python') {
      hasBinding = /\bask_llm\b/.test(content);
    } else if (type === 'dotnet') {
      hasBinding = /\b(?:LlmManager|LlmClient)\b/.test(content);
    } else {
      hasBinding = true;
    }

    if (!hasBinding) {
      checks.push({
        id: 'entry_binding',
        title: bindingTitle,
        ok: false,
        error: `${normalizedEntry} dosyasında llm-manager bağlantısı (import/setup) bulunamadı.`,
        solution: `${normalizedEntry} dosyasına ilgili import satırını ekleyin veya "npx llm-manager init" komutunu tekrar çalıştırıp otomatik eklemeyi onaylayın.`
      });
    } else {
      checks.push({ id: 'entry_binding', title: bindingTitle, ok: true });
    }
  } else {
    checks.push({ id: 'entry_binding', title: bindingTitle, ok: true });
  }

  // 4. syntax_check kontrolü
  const syntaxTitle = 'Sözdizimi / Derleme Kontrolü';
  const filesToSyntaxCheck = expectedHelpers.filter(rel => fs.existsSync(path.join(cwd, rel)));
  if (type !== 'python' && type !== 'dotnet') {
    const helperRel = resolveLlmRelPath(cwd, type);
    if (fs.existsSync(path.join(cwd, helperRel))) {
      filesToSyntaxCheck.push(helperRel);
    }
  } else if (type === 'dotnet' && fs.existsSync(path.join(cwd, 'LlmClient.cs'))) {
    filesToSyntaxCheck.push('LlmClient.cs');
  }
  if (
    normalizedEntry &&
    fs.existsSync(path.join(cwd, normalizedEntry)) &&
    !filesToSyntaxCheck.includes(normalizedEntry)
  ) {
    filesToSyntaxCheck.push(normalizedEntry);
  }

  if (type === 'nextjs') {
    const edgeFiles = new Set(filesToSyntaxCheck);
    for (const rel of filesToSyntaxCheck) {
      const root = rel.startsWith('src/app/') ? 'src/app' : rel.startsWith('app/') ? 'app' : null;
      if (!root) continue;
      let dir = path.posix.dirname(rel);
      while (dir === root || dir.startsWith(root + '/')) {
        for (const ext of ['js', 'jsx', 'ts', 'tsx']) {
          const layout = `${dir}/layout.${ext}`;
          if (fs.existsSync(path.join(cwd, layout))) edgeFiles.add(layout);
        }
        dir = path.posix.dirname(dir);
      }
    }
    for (const rel of edgeFiles) {
      if (/runtime\s*=\s*['"]edge['"]/.test(fs.readFileSync(path.join(cwd, rel), 'utf8')))
        warnings.push(
          rel + ': Edge runtime desteklenmez; paket node:fs ve undici gerektirir; runtime=nodejs kullanın.'
        );
    }
  }
  let syntaxFailure = null;
  const priorWarningCount = warnings.length;
  for (const rel of new Set(filesToSyntaxCheck)) {
    const ext = path.extname(rel).toLowerCase();
    const full = path.join(cwd, rel);
    void ext;
    void full;
    const detail = checkSource(cwd, rel, warnings);
    if (detail) {
      syntaxFailure = { file: rel, detail };
      break;
    }
  }

  if (syntaxFailure) {
    checks.push({
      id: 'syntax_check',
      title: syntaxTitle,
      ok: false,
      error: `${syntaxFailure.file} içinde sözdizimi (syntax) hatası tespit edildi: ${syntaxFailure.detail}`,
      solution: `${syntaxFailure.file} dosyasındaki hatalı satırı düzeltin veya yedeğe dönüp "npx llm-manager init --force" çalıştırın.`
    });
  } else {
    checks.push({
      id: 'syntax_check',
      title: syntaxTitle,
      ok: true,
      ...(warnings.length > priorWarningCount ? { skipped: true } : {})
    });
  }

  return {
    ok: checks.every(c => c.ok),
    type,
    entryFile: normalizedEntry,
    checks,
    warnings
  };
}

export function formatVerificationReport(report) {
  if (!report || !Array.isArray(report.checks)) return '';
  const lines = [];
  for (const check of report.checks) {
    if (check.skipped) {
      lines.push(`⚠ ${check.title} (kısmen atlandı)`);
    } else if (check.ok) {
      lines.push(`✔ ${check.title}`);
    } else {
      lines.push(`✖ ${check.title}`);
      if (check.error) lines.push(`  Neden: ${check.error}`);
      if (check.solution) lines.push(`  Çözüm: ${check.solution}`);
    }
  }
  for (const warning of report.warnings || []) lines.push('⚠ ' + warning);
  return lines.join('\n');
}
