#!/usr/bin/env node
// Docker imajı için: bağımsız sunucunun ihtiyaç duyduğu Express'i devDependencies'ten dependencies'e taşır.
// Böylece `npm ci --include=dev` kilit dosyasındaki sürümü kurar, `npm prune --omit=dev` Express'i korur ve
// geri kalan geliştirme araçlarını siler. Yalnız imaj içindeki package.json kopyasını değiştirir.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const RUNTIME_PACKAGES = ['express'];

export function promoteRuntimeDependencies(pkg) {
  pkg.dependencies ??= {};
  for (const name of RUNTIME_PACKAGES) {
    const range = pkg.devDependencies?.[name];
    if (!range) throw new Error(`${name} devDependencies içinde bulunamadı`);
    pkg.dependencies[name] = range;
    delete pkg.devDependencies[name];
  }
  return pkg;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2] ?? 'package.json';
  const pkg = promoteRuntimeDependencies(JSON.parse(readFileSync(file, 'utf8')));
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}
