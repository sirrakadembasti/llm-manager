import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readEnv, upsertEnv, ensureGitignore } from '../envFile.js';
import { detectProjectType, isEsmProject } from './detect.js';
import { createChangeJournal } from './journal.js';
import { resolveInitOrigins } from './origins.js';
import { planIntegration } from './integration.js';
import express from './templates/express.js';
import spa from './templates/spa.js';
import nextjs from './templates/nextjs.js';
import nuxt from './templates/nuxt.js';
import sveltekit from './templates/sveltekit.js';
import electron from './templates/electron.js';
import dotnet from './templates/dotnet.js';
import python from './templates/python.js';
import tauri from './templates/tauri.js';
import fastify from './templates/fastify.js';
import koa from './templates/koa.js';
import hono from './templates/hono.js';
import nestjs from './templates/nestjs.js';
export const PKG = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).name;
const templates = {
  express,
  spa,
  nextjs,
  nuxt,
  sveltekit,
  electron,
  dotnet,
  python,
  tauri,
  fastify,
  koa,
  hono,
  nestjs
};
function dotnetTargets(cwd) {
  const projects = fs
    .readdirSync(cwd)
    .filter(name => name.endsWith('.csproj'))
    .map(name => {
      const full = path.join(cwd, name);
      const content = fs.readFileSync(full, 'utf8');
      const target = content.match(/<TargetFramework(?:Version|s)?>([^<]+)/)?.[1]?.trim();
      const targets = target?.split(';').map(value => value.trim()) || [];
      const family = targets.some(value => /^v4\.|^net4\d/.test(value))
        ? 'netfx'
        : targets.some(value => /^netcoreapp|^net(?:[5-9]|[1-9]\d)\./.test(value))
          ? 'modern'
          : 'unknown';
      // Unknown/Web Forms targets must also work on the oldest promised Framework.
      const legacy =
        !targets.length ||
        targets.some(value => !/^netcoreapp|^net(?:[5-9]|[1-9]\d)\.|^v4\.[5-9]|^net4[5-9]/.test(value));
      return { full, content, target, family, legacy };
    });
  const selected =
    projects.find(project => project.legacy && project.target) ||
    projects.find(project => project.family === 'netfx') ||
    projects.find(project => project.target);
  const webForms = fs.existsSync(path.join(cwd, 'Web.config')) && fs.existsSync(path.join(cwd, 'Global.asax'));
  const targetFamily = selected?.family || (webForms ? 'netfx' : 'unknown');
  return {
    projects,
    legacy: !projects.length || projects.some(project => project.legacy),
    targetFamily,
    targetFramework: selected?.target || (targetFamily === 'netfx' ? '.NET Framework 4.x' : 'C# 7.3 (hedef bilinmiyor)')
  };
}
function registerDotnet(target, journal) {
  for (const project of target.projects) {
    let content = project.content;
    const sdk = /<Project\b[^>]*\bSdk\s*=|<Sdk\b/.test(content);
    const implicitCompile = sdk && !/<EnableDefault(?:Compile)?Items>\s*false\s*</.test(content);
    const includes = [...content.matchAll(/<Compile\b[^>]*\bInclude\s*=\s*(["'])(.*?)\1/g)].map(match => match[2]);
    if (!implicitCompile && includes.length && !includes.some(value => /^(?:\.\\|\.\/)?LlmClient\.cs$/i.test(value))) {
      content = content.replace(/<ItemGroup[^>]*>/, '$&\n    <Compile Include="LlmClient.cs" />');
    }
    if (project.family !== 'modern') {
      const existing = [...content.matchAll(/<Reference\b[^>]*\bInclude\s*=\s*(["'])(.*?)\1/g)].map(match =>
        match[2].split(',')[0].trim()
      );
      const references = [
        'System',
        'System.Runtime.Serialization',
        'System.Xml',
        ...(target.legacy ? [] : ['System.Net.Http'])
      ];
      for (const reference of references) {
        if (!existing.includes(reference))
          content = content.replace(
            '</Project>',
            `<ItemGroup><Reference Include="${reference}" /></ItemGroup></Project>`
          );
      }
    }
    if (content !== project.content) journal.write(project.full, content);
  }
}
export function initLLMProject({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  password,
  adminUser,
  authMode,
  hostAuthModule,
  adminRoles,
  pagePath,
  apiPath,
  allowedOrigins,
  force = false,
  journal = createChangeJournal(cwd)
} = {}) {
  if (!templates[type]) throw new Error(`Desteklenmeyen proje tipi: ${type}. --type ile bir entegrasyon seçin.`);
  const esm = isEsmProject(cwd, type);
  const envPath = path.join(cwd, '.env');
  const env = readEnv(envPath);
  const integration = planIntegration(cwd, {
    type,
    adminUser,
    authMode,
    hostAuthModule,
    adminRoles,
    pagePath,
    apiPath
  });
  const expressHelper = path.join(cwd, 'llm.js');
  if (
    integration.authMode === 'host' &&
    !force &&
    fs.existsSync(expressHelper) &&
    !fs.readFileSync(expressHelper, 'utf8').includes('mountLLMIntegration')
  ) {
    throw new Error(
      'Mevcut llm.js host oturumu adaptörünü desteklemiyor. Dosyayı inceleyip --force ile yükseltin veya entegrasyonu elle taşıyın.'
    );
  }
  const origins = ['spa', 'tauri'].includes(type) ? resolveInitOrigins(cwd, allowedOrigins) : '';
  password ??= env.LLM_ADMIN_PASSWORD || integration.examplePassword || crypto.randomBytes(18).toString('base64url');
  const token = env.LLM_CHAT_TOKENS || crypto.randomBytes(24).toString('base64url');
  journal.capture(envPath);
  journal.capture(path.join(cwd, '.gitignore'));
  upsertEnv(envPath, {
    LLM_ADMIN_USER: integration.adminUser,
    LLM_AUTH_MODE: integration.authMode,
    LLM_PAGE_PATH: integration.pagePath,
    LLM_API_PATH: integration.apiPath,
    LLM_ADMIN_ROLES: integration.adminRoles.join(','),
    ...(integration.hostAuthModule ? { LLM_HOST_AUTH_MODULE: integration.hostAuthModule } : {}),
    LLM_ADMIN_PASSWORD: password,
    LLM_CHAT_TOKENS: token,
    LLM_CHAT_TOKEN: env.LLM_CHAT_TOKEN || token.split(',')[0]
  });
  ensureGitignore(cwd);
  if (['spa', 'tauri'].includes(type)) {
    journal.capture(path.join(cwd, '.env.local'));
    upsertEnv(path.join(cwd, '.env.local'), { VITE_LLM_CHAT_TOKEN: token.split(',')[0] });
    if (origins || allowedOrigins !== undefined || env.LLM_ALLOWED_ORIGINS !== undefined)
      upsertEnv(envPath, { LLM_ALLOWED_ORIGINS: origins });
  }
  const target = type === 'dotnet' ? dotnetTargets(cwd) : undefined;
  const files = templates[type]({ cwd, PKG, esm, fs, legacy: target?.legacy, ...integration });
  const createdFiles = [];
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(cwd, rel);
    if (fs.existsSync(full) && (!force || rel === 'preload.cjs')) continue;
    journal.write(full, content);
    createdFiles.push(rel);
  }
  let scriptAdded = false;
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts?.llm) {
      pkg.scripts = { ...pkg.scripts, llm: 'llm-manager' };
      journal.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      scriptAdded = true;
    }
  }
  if (target) registerDotnet(target, journal);
  journal.write(
    path.join(cwd, '.llm-manager.json'),
    JSON.stringify(
      {
        version: 1,
        type,
        pagePath: integration.pagePath,
        apiPath: integration.apiPath,
        authMode: integration.authMode,
        generatedFiles: [...new Set([...(integration.previous.generatedFiles || []), ...createdFiles])]
      },
      null,
      2
    ) + '\n'
  );
  return {
    type,
    esm,
    createdFiles,
    scriptAdded,
    journal,
    pagePath: integration.pagePath,
    apiPath: integration.apiPath,
    authMode: integration.authMode,
    ...(target ? { targetFramework: target.targetFramework, targetFamily: target.targetFamily } : {})
  };
}
