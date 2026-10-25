import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packageInstalled } from './compiler.js';
import { PKG } from './project.js';
export const INSTALL_SPEC =
  'github:sirrakadembasti/llm-manager#v' +
  JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url))).version;
export const EXPRESS_SPEC = 'express@^4.19.2';
export function needsHostPackage(cwd, type) {
  return (
    !['python', 'dotnet'].includes(type) &&
    (!['spa', 'tauri'].includes(type) || fs.existsSync(path.join(cwd, 'package.json')))
  );
}
function serverPath(cwd) {
  return packageInstalled(cwd, PKG)
    ? path.join(cwd, 'node_modules', PKG, 'src/server.js')
    : fileURLToPath(new URL('../server.js', import.meta.url));
}
export function standalonePrerequisite(cwd) {
  try {
    const selected = serverPath(cwd);
    const local = createRequire(fs.existsSync(selected) ? fs.realpathSync(selected) : selected);
    const meta = JSON.parse(fs.readFileSync(local.resolve('express/package.json'), 'utf8'));
    const [major, minor, patch] = meta.version.split('.').map(Number);
    return (major === 4 && (minor > 19 || (minor === 19 && patch >= 2))) || major === 5;
  } catch {
    return false;
  }
}
export async function loadStandaloneServer(cwd = process.cwd()) {
  if (!standalonePrerequisite(cwd))
    throw new Error(
      `Express önkoşulu eksik veya sürümü desteklenmiyor. Host projede npm install ${EXPRESS_SPEC} çalıştırın; önbellekten çalıştırıyorsanız npm install ${INSTALL_SPEC} komutunu da uygulayın.`
    );
  return await import(pathToFileURL(serverPath(cwd)).href);
}
