import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readEnv, upsertEnv, ensureGitignore } from '../envFile.js';
import { detectProjectType, isEsmProject } from './detect.js';
import { createChangeJournal } from './journal.js';
import { resolveInitOrigins } from './origins.js';
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
export function initLLMProject({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  password,
  allowedOrigins,
  force = false,
  journal = createChangeJournal(cwd)
} = {}) {
  if (!templates[type]) throw new Error(`Desteklenmeyen proje tipi: ${type}. --type ile bir entegrasyon seçin.`);
  const esm = isEsmProject(cwd, type);
  const envPath = path.join(cwd, '.env');
  const env = readEnv(envPath);
  const origins = ['spa', 'tauri'].includes(type) ? resolveInitOrigins(cwd, allowedOrigins) : '';
  password ??= env.LLM_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  const token = env.LLM_CHAT_TOKENS || crypto.randomBytes(24).toString('base64url');
  journal.capture(envPath);
  journal.capture(path.join(cwd, '.gitignore'));
  upsertEnv(envPath, {
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
  const files = templates[type]({ cwd, PKG, esm, fs });
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
  let targetFramework;
  let targetFamily;
  if (type === 'dotnet') {
    for (const name of fs.readdirSync(cwd).filter(name => name.endsWith('.csproj'))) {
      const full = path.join(cwd, name);
      let content = fs.readFileSync(full, 'utf8');
      targetFramework = content.match(/<TargetFramework(?:Version|s)?>([^<]+)/)?.[1]?.trim();
      if (targetFramework) {
        const targets = targetFramework.split(';');
        targetFamily = targets.some(target => /^v4\.|^net4\d/.test(target))
          ? 'netfx'
          : targets.some(target => /^netcoreapp|^net(?:[5-9]|[1-9]\d)\./.test(target))
            ? 'modern'
            : 'unknown';
      }
      if (/<Compile\s+Include=/.test(content) && !/Compile\s+Include="LlmClient.cs"/.test(content)) {
        content = content.replace(/<ItemGroup[^>]*>/, '$&\n    <Compile Include="LlmClient.cs" />');
        if (/<TargetFrameworkVersion>/.test(content))
          for (const reference of ['System.Net.Http', 'System.Runtime.Serialization']) {
            if (!content.includes('Reference Include="' + reference + '"'))
              content = content.replace(
                '</Project>',
                '<ItemGroup><Reference Include="' + reference + '" /></ItemGroup></Project>'
              );
          }
        journal.write(full, content);
      }
    }
  }
  if (type === 'dotnet' && !targetFramework) {
    targetFamily =
      fs.existsSync(path.join(cwd, 'Web.config')) && fs.existsSync(path.join(cwd, 'Global.asax')) ? 'netfx' : 'unknown';
    targetFramework = targetFamily === 'netfx' ? '.NET Framework 4.x' : 'C# 7.3 (hedef bilinmiyor)';
  }
  return {
    type,
    esm,
    createdFiles,
    scriptAdded,
    journal,
    ...(targetFramework ? { targetFramework, targetFamily } : {})
  };
}
