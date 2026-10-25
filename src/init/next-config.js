import fs from 'node:fs';
import path from 'node:path';
export async function configureNext({ cwd, journal, promptUser, yes, logger, packageName }) {
  for (const name of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const full = path.join(cwd, name);
    if (!fs.existsSync(full)) continue;
    const original = fs.readFileSync(full, 'utf8');
    if (original.includes(packageName)) return;
    const instruction = `${name}: serverExternalPackages: [${JSON.stringify(packageName)}] ekleyin.`;
    if (/serverExternalPackages/.test(original)) {
      logger(instruction);
      return;
    }
    const answer = yes ? 'e' : await promptUser('Next.js serverExternalPackages ayarı eklensin mi? (e/H): ');
    if (!/^(e|evet|y|yes)$/i.test(String(answer).trim())) {
      logger(instruction);
      return;
    }
    const pattern = /(?:export\s+default\s*|(?:const|let|var)\s+nextConfig(?:\s*:\s*\w+)?\s*=\s*)\{/;
    if (!pattern.test(original)) {
      logger(instruction);
      return;
    }
    journal.write(
      full,
      original.replace(pattern, match => match + `\n  serverExternalPackages: [${JSON.stringify(packageName)}],`)
    );
    return;
  }
}
