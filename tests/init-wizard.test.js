import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initLLMProject as rawInitLLMProject,
  detectProjectType,
  detectEntryFile,
  injectIntoEntryFile,
  verifyIntegration,
  formatVerificationReport,
  runInteractiveInit
} from '../src/init.js';

const packageName = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).name;
function initLLMProject(options) {
  const cwd = options.cwd;
  const target = path.join(cwd, 'node_modules', ...packageName.split('/'));
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.resolve('.'), target, 'junction');
  }
  const ts = path.join(cwd, 'node_modules/typescript');
  if (!fs.existsSync(ts)) fs.symlinkSync(path.resolve('node_modules/typescript'), ts, 'junction');
  return rawInitLLMProject(options);
}

test('detectEntryFile ve injectIntoEntryFile: Express ESM senaryosu, idempotency ve rollback', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-exp-esm-'));
  try {
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ type: 'module', dependencies: { express: '^4.19.2' } })
    );
    const originalServer = [
      "import express from 'express';",
      '',
      'const app = express();',
      'app.use(express.json());',
      '',
      'app.listen(3000);',
      ''
    ].join('\n');
    fs.writeFileSync(path.join(cwd, 'server.js'), originalServer, 'utf8');

    initLLMProject({ cwd });
    assert.equal(detectEntryFile(cwd, 'express'), 'server.js');

    const res1 = injectIntoEntryFile({ cwd, type: 'express' });
    assert.equal(res1.modified, true);
    assert.equal(res1.entryFile, 'server.js');
    assert.ok(res1.addedLines.includes("import { setupLLM, askLLM } from './llm.js';"));
    assert.ok(res1.addedLines.includes('setupLLM(app);'));
    assert.ok(res1.diffPreview.includes("+ import { setupLLM, askLLM } from './llm.js';"));
    assert.ok(res1.diffPreview.includes('+ setupLLM(app);'));

    const updatedContent = fs.readFileSync(path.join(cwd, 'server.js'), 'utf8');
    assert.ok(updatedContent.includes("import { setupLLM, askLLM } from './llm.js';"));
    assert.ok(updatedContent.includes('setupLLM(app);'));

    // Mükerrer çağrı (idempotent)
    const res2 = injectIntoEntryFile({ cwd, type: 'express' });
    assert.equal(res2.modified, false);
    assert.equal(res2.alreadyIntegrated, true);

    // Rollback
    res1.rollback();
    assert.equal(fs.readFileSync(path.join(cwd, 'server.js'), 'utf8'), originalServer);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('detectEntryFile ve injectIntoEntryFile: Express CommonJS ve alt dizin (src/app.js) senaryosu', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-exp-cjs-'));
  try {
    fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: { express: '^4.19.2' } }));
    const originalApp = ["const express = require('express');", 'const app = express();', 'app.listen(3000);'].join(
      '\n'
    );
    fs.writeFileSync(path.join(cwd, 'src', 'app.js'), originalApp, 'utf8');

    initLLMProject({ cwd });
    assert.equal(detectEntryFile(cwd, 'express'), 'src/app.js');

    const res = injectIntoEntryFile({ cwd, type: 'express', esm: false });
    assert.equal(res.modified, true);
    assert.equal(res.entryFile, 'src/app.js');
    assert.ok(res.addedLines.includes("const { setupLLM, askLLM } = require('../llm');"));
    assert.ok(res.addedLines.includes('setupLLM(app);'));

    res.rollback();
    assert.equal(fs.readFileSync(path.join(cwd, 'src', 'app.js'), 'utf8'), originalApp);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('detectEntryFile ve injectIntoEntryFile: SPA, Next.js, Python ve Electron senaryoları', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-all-'));
  try {
    // SPA
    const spaDir = path.join(root, 'spa');
    fs.mkdirSync(path.join(spaDir, 'src'), { recursive: true });
    const origSpa = "import React from 'react';\nexport default function App() { return null; }\n";
    fs.writeFileSync(path.join(spaDir, 'src', 'App.jsx'), origSpa, 'utf8');
    initLLMProject({ cwd: spaDir, type: 'spa' });
    assert.equal(detectEntryFile(spaDir, 'spa'), 'src/App.jsx');
    const spaRes = injectIntoEntryFile({ cwd: spaDir, type: 'spa' });
    assert.equal(spaRes.modified, true);
    assert.ok(spaRes.addedLines.includes("import { askLLM } from './llm.js';"));
    assert.equal(injectIntoEntryFile({ cwd: spaDir, type: 'spa' }).alreadyIntegrated, true);
    spaRes.rollback();
    assert.equal(fs.readFileSync(path.join(spaDir, 'src', 'App.jsx'), 'utf8'), origSpa);

    // Next.js
    const nextDir = path.join(root, 'next');
    fs.mkdirSync(path.join(nextDir, 'src', 'app'), { recursive: true });
    const origNext = "'use client';\n\nexport default function Page() { return null; }\n";
    fs.writeFileSync(path.join(nextDir, 'src', 'app', 'page.tsx'), origNext, 'utf8');
    initLLMProject({ cwd: nextDir, type: 'nextjs' });
    assert.equal(detectEntryFile(nextDir, 'nextjs'), 'src/app/page.tsx');
    const nextRes = injectIntoEntryFile({ cwd: nextDir, type: 'nextjs' });
    assert.equal(nextRes.modified, false);
    assert.match(nextRes.reason, /Server Action/);
    assert.equal(injectIntoEntryFile({ cwd: nextDir, type: 'nextjs' }).modified, false);
    nextRes.rollback();
    assert.equal(fs.readFileSync(path.join(nextDir, 'src', 'app', 'page.tsx'), 'utf8'), origNext);

    // Python
    const pyDir = path.join(root, 'python');
    fs.mkdirSync(pyDir, { recursive: true });
    const origPy = "import os\n\nprint('merhaba')\n";
    fs.writeFileSync(path.join(pyDir, 'main.py'), origPy, 'utf8');
    initLLMProject({ cwd: pyDir, type: 'python' });
    assert.equal(detectEntryFile(pyDir, 'python'), 'main.py');
    const pyRes = injectIntoEntryFile({ cwd: pyDir, type: 'python' });
    assert.equal(pyRes.modified, true);
    assert.ok(pyRes.addedLines.includes('from llm_client import ask_llm'));
    assert.equal(injectIntoEntryFile({ cwd: pyDir, type: 'python' }).alreadyIntegrated, true);
    pyRes.rollback();
    assert.equal(fs.readFileSync(path.join(pyDir, 'main.py'), 'utf8'), origPy);

    // Electron (ESM)
    const elDir = path.join(root, 'electron');
    fs.mkdirSync(elDir, { recursive: true });
    fs.writeFileSync(path.join(elDir, 'package.json'), JSON.stringify({ type: 'module', main: 'main.js' }));
    const origEl = [
      "import { app, BrowserWindow } from 'electron';",
      '',
      'app.whenReady().then(() => {',
      '  new BrowserWindow();',
      '});',
      ''
    ].join('\n');
    fs.writeFileSync(path.join(elDir, 'main.js'), origEl, 'utf8');
    initLLMProject({ cwd: elDir, type: 'electron' });
    assert.equal(detectEntryFile(elDir, 'electron'), 'main.js');
    const elRes = injectIntoEntryFile({ cwd: elDir, type: 'electron', esm: true });
    assert.equal(elRes.modified, true);
    assert.ok(elRes.addedLines.includes("import { registerLLMIpc, askLLM } from './llm.js';"));
    assert.ok(elRes.addedLines.some(line => line.includes('registerLLMIpc(ipcMain);')));
    const elContent = fs.readFileSync(path.join(elDir, 'main.js'), 'utf8');
    assert.ok(elContent.includes('ipcMain'));
    assert.equal(injectIntoEntryFile({ cwd: elDir, type: 'electron', esm: true }).alreadyIntegrated, true);
    elRes.rollback();
    assert.equal(fs.readFileSync(path.join(elDir, 'main.js'), 'utf8'), origEl);

    // Electron (CommonJS)
    const elCjsDir = path.join(root, 'electron-cjs');
    fs.mkdirSync(elCjsDir, { recursive: true });
    fs.writeFileSync(path.join(elCjsDir, 'package.json'), JSON.stringify({ main: 'llm.js' }));
    const origElCjs = "const { app } = require('electron');\n";
    fs.writeFileSync(path.join(elCjsDir, 'main.js'), origElCjs, 'utf8');
    initLLMProject({ cwd: elCjsDir, type: 'electron' });
    assert.equal(detectEntryFile(elCjsDir, 'electron'), 'main.js');
    const elCjsRes = injectIntoEntryFile({ cwd: elCjsDir, type: 'electron', esm: false });
    assert.equal(elCjsRes.modified, true);
    assert.ok(elCjsRes.addedLines.includes("const { registerLLMIpc, askLLM } = require('./llm');"));
    assert.ok(elCjsRes.addedLines.includes('registerLLMIpc(ipcMain);'));
    elCjsRes.rollback();
    assert.equal(fs.readFileSync(path.join(elCjsDir, 'main.js'), 'utf8'), origElCjs);

    // Hedef dosya yoksa güvenli dönüş
    const emptyDir = path.join(root, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    assert.equal(detectEntryFile(emptyDir, 'express'), null);
    const missingRes = injectIntoEntryFile({ cwd: emptyDir, type: 'express' });
    assert.equal(missingRes.modified, false);
    assert.equal(missingRes.entryFile, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('verifyIntegration ve formatVerificationReport: başarılı kurulum, eksik yardımcı dosya, eksik import ve syntax hatası kontrolleri', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-verify-'));
  try {
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ type: 'module', dependencies: { express: '^4.19.2' } })
    );
    const serverCode = [
      "import express from 'express';",
      'const app = express();',
      'app.use(express.json());',
      'app.listen(3000);',
      ''
    ].join('\n');
    fs.writeFileSync(path.join(cwd, 'server.js'), serverCode, 'utf8');

    // 1. Başarılı kurulum ve enjeksiyon sonrası ok: true
    initLLMProject({ cwd, type: 'express' });
    injectIntoEntryFile({ cwd, type: 'express' });

    const okReport = verifyIntegration({ cwd, type: 'express' });
    assert.equal(okReport.ok, true);
    assert.equal(okReport.type, 'express');
    assert.equal(okReport.entryFile, 'server.js');
    assert.equal(okReport.checks.length, 6);
    assert.equal(okReport.checks.find(check => check.id === 'secrets_ignored').ok, true);
    assert.ok(okReport.checks.every(c => c.ok));

    const formattedOk = formatVerificationReport(okReport);
    assert.ok(formattedOk.includes('✔ Veri ve Şifreleme Klasörü Kontrolü'));
    assert.ok(formattedOk.includes('✔ Yardımcı Bağlantı Dosyaları Kontrolü'));
    assert.ok(formattedOk.includes('✔ Ana Dosya Import / Bağlantı Kontrolü'));
    assert.ok(formattedOk.includes('✔ Sözdizimi / Derleme Kontrolü'));

    // 2. Eksik llm.js durumunda helper_files ok: false ve Türkçe çözüm önerisi
    fs.unlinkSync(path.join(cwd, 'llm.js'));
    const missingHelperReport = verifyIntegration({ cwd, type: 'express' });
    assert.equal(missingHelperReport.ok, false);
    const helperCheck = missingHelperReport.checks.find(c => c.id === 'helper_files');
    assert.equal(helperCheck.ok, false);
    assert.equal(helperCheck.error, 'Eksik bağlantı dosyası tespit edildi: llm.js');
    assert.equal(
      helperCheck.solution,
      'Eksik dosyaları yeniden oluşturmak için terminalde "npx llm-manager init --force" komutunu çalıştırın.'
    );

    const formattedMissing = formatVerificationReport(missingHelperReport);
    assert.ok(formattedMissing.includes('✖ Yardımcı Bağlantı Dosyaları Kontrolü'));
    assert.ok(formattedMissing.includes('  Neden: Eksik bağlantı dosyası tespit edildi: llm.js'));
    assert.ok(
      formattedMissing.includes(
        '  Çözüm: Eksik dosyaları yeniden oluşturmak için terminalde "npx llm-manager init --force" komutunu çalıştırın.'
      )
    );

    // llm.js'yi geri yükle
    initLLMProject({ cwd, type: 'express', force: true });

    // 3. entryFile içinde import silindiğinde entry_binding ok: false ve Türkçe çözüm önerisi
    fs.writeFileSync(path.join(cwd, 'server.js'), serverCode, 'utf8');
    const missingBindingReport = verifyIntegration({ cwd, type: 'express' });
    assert.equal(missingBindingReport.ok, false);
    const bindingCheck = missingBindingReport.checks.find(c => c.id === 'entry_binding');
    assert.equal(bindingCheck.ok, false);
    assert.equal(bindingCheck.error, 'server.js dosyasında llm-manager bağlantısı (import/setup) bulunamadı.');
    assert.equal(
      bindingCheck.solution,
      'server.js dosyasına ilgili import satırını ekleyin veya "npx llm-manager init" komutunu tekrar çalıştırıp otomatik eklemeyi onaylayın.'
    );

    // 4. entryFile içine bozuk JS (const a = ;) yazıldığında syntax_check ok: false ve Türkçe hata/çözüm metni
    fs.writeFileSync(path.join(cwd, 'server.js'), "import { setupLLM } from './llm.js';\nconst a = ;\n", 'utf8');
    const syntaxReport = verifyIntegration({ cwd, type: 'express' });
    assert.equal(syntaxReport.ok, false);
    const syntaxCheck = syntaxReport.checks.find(c => c.id === 'syntax_check');
    assert.equal(syntaxCheck.ok, false);
    assert.ok(syntaxCheck.error.startsWith('server.js içinde sözdizimi (syntax) hatası tespit edildi: '));
    assert.equal(
      syntaxCheck.solution,
      'server.js dosyasındaki hatalı satırı düzeltin veya yedeğe dönüp "npx llm-manager init --force" çalıştırın.'
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyIntegration: Next.js, SPA (JSX), Electron ve Python senaryoları', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-verify-multi-'));
  try {
    // Next.js
    const nextDir = path.join(root, 'next');
    fs.mkdirSync(path.join(nextDir, 'src', 'app'), { recursive: true });
    fs.writeFileSync(
      path.join(nextDir, 'src', 'app', 'page.tsx'),
      "'use client';\nexport default function Page() { return <div />; }\n",
      'utf8'
    );
    initLLMProject({ cwd: nextDir, type: 'nextjs' });
    injectIntoEntryFile({ cwd: nextDir, type: 'nextjs' });
    const nextRep = verifyIntegration({ cwd: nextDir, type: 'nextjs' });
    assert.equal(nextRep.ok, true, JSON.stringify(nextRep));

    // JSX bozuk parantez kontrolü
    const spaDir = path.join(root, 'spa');
    fs.mkdirSync(path.join(spaDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(spaDir, 'src', 'App.jsx'),
      "import { askLLM } from './llm.js';\nexport default function App() { return (<div>; }\n",
      'utf8'
    );
    initLLMProject({ cwd: spaDir, type: 'spa' });
    const spaRep = verifyIntegration({ cwd: spaDir, type: 'spa' });
    assert.equal(spaRep.ok, false);
    const spaSyntax = spaRep.checks.find(c => c.id === 'syntax_check');
    assert.equal(spaSyntax.ok, false);
    assert.ok(spaSyntax.error.startsWith('src/App.jsx içinde sözdizimi (syntax) hatası tespit edildi:'));

    // Python
    const pyDir = path.join(root, 'py');
    fs.mkdirSync(pyDir, { recursive: true });
    fs.writeFileSync(path.join(pyDir, 'main.py'), "print('ok')\n", 'utf8');
    initLLMProject({ cwd: pyDir, type: 'python' });
    injectIntoEntryFile({ cwd: pyDir, type: 'python' });
    const pyRep = verifyIntegration({ cwd: pyDir, type: 'python' });
    assert.equal(pyRep.ok, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runInteractiveInit: onay verildiğinde 4 aşamalı uçtan uca kurulum, canlı /llm yoklaması ve tarayıcı açma', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-interactive-ok-'));
  try {
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ type: 'module', dependencies: { express: '^4.19.2' } })
    );
    const originalServer = [
      "import express from 'express';",
      'const app = express();',
      'app.use(express.json());',
      'app.listen(3000);',
      ''
    ].join('\n');
    fs.writeFileSync(path.join(cwd, 'server.js'), originalServer, 'utf8');

    const answers = ['e', 'e'];
    const prompts = [];
    const logs = [];
    const openedUrls = [];

    const target = path.join(cwd, 'node_modules', ...packageName.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.resolve('.'), target, 'junction');
    const result = await runInteractiveInit({
      cwd,
      password: 'testPass123',
      port: 0,
      autoCloseServer: true,
      askQuestion: async promptText => {
        prompts.push(promptText);
        return answers.shift() || 'e';
      },
      logger: msg => logs.push(String(msg)),
      browserOpener: url => {
        openedUrls.push(url);
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'express');
    assert.equal(result.entryFile, 'server.js');
    assert.ok(result.initRes.createdFiles.includes('llm.js'));
    assert.equal(result.injectRes.modified, true);
    assert.equal(result.verification.ok, true);
    assert.equal(result.probe.ok, true);
    assert.equal(result.probe.status, 200);
    assert.equal(result.probe.startedServer, true);
    assert.equal(result.probe.openedBrowser, true);
    assert.match(result.probe.url, /^http:\/\/127\.0\.0\.1:\d+\/llm$/);
    assert.deepEqual(openedUrls, [result.probe.url]);
    assert.equal(prompts.length, 2);
    assert.ok(prompts[0].includes('Onaylıyor musunuz? (E/h): '));
    assert.ok(prompts[1].includes('Yapılan eklemeleri kontrol ettiniz mi, iç doğrulama adımına geçilsin mi? (E/h): '));

    const updatedServer = fs.readFileSync(path.join(cwd, 'server.js'), 'utf8');
    assert.ok(updatedServer.includes("import { setupLLM, askLLM } from './llm.js';"));
    assert.ok(updatedServer.includes('setupLLM(app);'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('runInteractiveInit: 2. aşamada kullanıcı hayır dediğinde rollback çalışır ve ana dosya eski haline döner', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-wiz-interactive-rb-'));
  try {
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ type: 'module', dependencies: { express: '^4.19.2' } })
    );
    const originalServer = [
      "import express from 'express';",
      'const app = express();',
      'app.use(express.json());',
      'app.listen(3000);',
      ''
    ].join('\n');
    fs.writeFileSync(path.join(cwd, 'server.js'), originalServer, 'utf8');

    const answers = ['e', 'h', 'h'];
    const openedUrls = [];

    const result = await runInteractiveInit({
      cwd,
      port: 0,
      autoCloseServer: true,
      askQuestion: async () => answers.shift(),
      logger: () => {},
      browserOpener: url => openedUrls.push(url)
    });

    assert.equal(result.aborted, true);
    assert.equal(result.rolledBack, true);
    assert.equal(result.step, 'inject');
    assert.equal(openedUrls.length, 0);
    assert.equal(fs.readFileSync(path.join(cwd, 'server.js'), 'utf8'), originalServer);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('detectProjectType, injectIntoEntryFile ve verifyIntegration: C# (.NET Core / MVC / MVP), Vue, Nuxt ve SvelteKit senaryoları', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-dotnet-vue-nuxt-'));
  try {
    // 1. C# / .NET Core / ASP.NET MVC / MVP (Program.cs + .csproj)
    const dotnetDir = path.join(root, 'dotnet-app');
    fs.mkdirSync(dotnetDir, { recursive: true });
    fs.writeFileSync(path.join(dotnetDir, 'MyWebApp.csproj'), '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>\n');
    const origProgramCs =
      'using System;\nusing Microsoft.AspNetCore.Builder;\n\nvar builder = WebApplication.CreateBuilder(args);\n';
    fs.writeFileSync(path.join(dotnetDir, 'Program.cs'), origProgramCs);

    assert.equal(detectProjectType(dotnetDir), 'dotnet');
    assert.equal(detectEntryFile(dotnetDir, 'dotnet'), 'Program.cs');
    const dotnetInit = initLLMProject({ cwd: dotnetDir, password: 'sifre' });
    assert.deepEqual(dotnetInit.createdFiles, ['LlmClient.cs']);
    assert.ok(
      fs
        .readFileSync(path.join(dotnetDir, 'LlmClient.cs'), 'utf8')
        .includes('public static async Task<string> AskAsync')
    );
    const dotnetInject = injectIntoEntryFile({ cwd: dotnetDir, type: 'dotnet' });
    assert.equal(dotnetInject.modified, true);
    assert.ok(fs.readFileSync(path.join(dotnetDir, 'Program.cs'), 'utf8').includes('using LlmManager;'));
    const dotnetVerify = verifyIntegration({ cwd: dotnetDir, type: 'dotnet' });
    assert.equal(dotnetVerify.ok, true);
    dotnetInject.rollback();
    assert.equal(fs.readFileSync(path.join(dotnetDir, 'Program.cs'), 'utf8'), origProgramCs);

    // 2. Vue 3 (src/App.vue SFC)
    const vueDir = path.join(root, 'vue-app');
    fs.mkdirSync(path.join(vueDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(vueDir, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.4.0' } }));
    const origVue = '<script setup>\nimport { ref } from "vue";\n</script>\n<template><div>Merhaba</div></template>\n';
    fs.writeFileSync(path.join(vueDir, 'src/App.vue'), origVue);

    assert.equal(detectProjectType(vueDir), 'spa');
    assert.equal(detectEntryFile(vueDir, 'spa'), 'src/App.vue');
    initLLMProject({ cwd: vueDir });
    const vueInject = injectIntoEntryFile({ cwd: vueDir, type: 'spa' });
    assert.equal(vueInject.modified, true);
    assert.ok(
      fs
        .readFileSync(path.join(vueDir, 'src/App.vue'), 'utf8')
        .includes("<script setup>\nimport { askLLM } from './llm.js';")
    );
    assert.equal(verifyIntegration({ cwd: vueDir, type: 'spa' }).ok, true);

    // 3. Nuxt 3 (app.vue + server/api/llm/[...slug].js)
    const nuxtDir = path.join(root, 'nuxt-app');
    fs.mkdirSync(nuxtDir, { recursive: true });
    fs.writeFileSync(path.join(nuxtDir, 'package.json'), JSON.stringify({ devDependencies: { nuxt: '^3.12.0' } }));
    fs.writeFileSync(path.join(nuxtDir, 'app.vue'), '<script setup>\n</script>\n<template><NuxtPage /></template>\n');

    assert.equal(detectProjectType(nuxtDir), 'nuxt');
    assert.equal(detectEntryFile(nuxtDir, 'nuxt'), 'app.vue');
    const nuxtInit = initLLMProject({ cwd: nuxtDir });
    assert.equal(nuxtInit.createdFiles.length, 3);
    assert.equal(injectIntoEntryFile({ cwd: nuxtDir, type: 'nuxt' }).modified, false);
    assert.equal(verifyIntegration({ cwd: nuxtDir, type: 'nuxt' }).ok, true);

    // 4. SvelteKit (src/routes/+page.svelte)
    const svelteDir = path.join(root, 'svelte-app');
    fs.mkdirSync(path.join(svelteDir, 'src/routes'), { recursive: true });
    fs.writeFileSync(
      path.join(svelteDir, 'package.json'),
      JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2.0.0' } })
    );
    fs.writeFileSync(path.join(svelteDir, 'src/routes/+page.svelte'), '<script>\n</script>\n<h1>SvelteKit</h1>\n');

    assert.equal(detectProjectType(svelteDir), 'sveltekit');
    assert.equal(detectEntryFile(svelteDir, 'sveltekit'), 'src/routes/+page.svelte');
    initLLMProject({ cwd: svelteDir });
    assert.equal(injectIntoEntryFile({ cwd: svelteDir, type: 'sveltekit' }).modified, false);
    assert.equal(verifyIntegration({ cwd: svelteDir, type: 'sveltekit' }).ok, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
