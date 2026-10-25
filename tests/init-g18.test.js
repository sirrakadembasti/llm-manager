import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { configureNext } from '../src/init/next-config.js';
import { createChangeJournal } from '../src/init/journal.js';
import { initLLMProject, verifyIntegration } from '../src/init.js';
const packageName = '@sirrakadembasti/llm-manager';

async function configCase(original, extension, answer, check) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'next-g18-'));
  try {
    const file = path.join(cwd, `next.config.${extension}`);
    fs.writeFileSync(file, original);
    const journal = createChangeJournal(cwd);
    const messages = [];
    let prompts = 0;
    await configureNext({
      cwd,
      journal,
      packageName,
      logger: m => messages.push(m),
      promptUser: () => {
        prompts++;
        return answer;
      }
    });
    check(fs.readFileSync(file, 'utf8'), messages, prompts);
    journal.rollback();
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

for (const [extension, original] of [
  ['js', `// serverExternalPackages: ['${packageName}']\nmodule.exports = { reactStrictMode: true };`],
  ['mjs', `export default { description: '${packageName}' };`],
  [
    'ts',
    `import type { NextConfig } from 'next';\nconst nextConfig: NextConfig = { /* serverExternalPackages: ['${packageName}'] */ reactStrictMode: true };\nexport default nextConfig;`
  ],
  ['mjs', `export default { serverExternalPackages: ['other'] };`]
])
  test(`Next ${extension} updates actual config despite comments and unrelated strings: ${original.slice(0, 25)}`, async () => {
    await configCase(original, extension, 'e', (content, messages, prompts) => {
      assert.equal(prompts, 1);
      assert.match(content, /serverExternalPackages:\s*\[[^\]]*"@sirrakadembasti\/llm-manager"/);
      // Evaluate only these controlled literal fixtures, never host config in production.
      const context = { module: { exports: {} } };
      runInNewContext(
        content
          .replace("import type { NextConfig } from 'next';", '')
          .replace(': NextConfig', '')
          .replace('export default', 'module.exports ='),
        context
      );
      assert.deepEqual(
        Array.from(context.module.exports.serverExternalPackages),
        original.includes("['other']") ? ['other', packageName] : [packageName]
      );
      assert.equal(messages.length, 0);
    });
  });

test('Next recognizes existing literal array without prompting', async () => {
  await configCase(
    `export default { serverExternalPackages: ['${packageName}', 'other'] };`,
    'mjs',
    'e',
    (content, messages, prompts) => {
      assert.equal(prompts, 0);
      assert.equal(messages.length, 0);
    }
  );
});

test('Next relative imports work with and without a configured alias', () => {
  for (const alias of [false, true]) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'next-alias-'));
    try {
      fs.mkdirSync(path.join(cwd, 'src/app'), { recursive: true });
      if (alias)
        fs.writeFileSync(
          path.join(cwd, 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })
        );
      initLLMProject({ cwd, type: 'nextjs' });
      const route = fs.readFileSync(path.join(cwd, 'src/app/api/llm/[...slug]/route.js'), 'utf8');
      assert.ok(!route.includes('@/'));
      const imported = route.match(/from ['"]([^'"]*llm\.js)['"]/)[1];
      assert.ok(fs.existsSync(path.resolve(cwd, 'src/app/api/llm/[...slug]', imported)));
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test('Next refusal and ambiguous config preserve bytes and give manual instructions', async () => {
  for (const [original, answer] of [
    ['export default { reactStrictMode: true };', 'h'],
    ['export default withPlugin({});', 'e'],
    ['export default { serverExternalPackages: packages };', 'e'],
    ['export default { ...shared };', 'e'],
    ['const nextConfig = {}; export default otherConfig;', 'e']
  ])
    await configCase(original, 'mjs', answer, (content, messages) => {
      assert.equal(content, original);
      assert.match(messages.join('\n'), /serverExternalPackages/);
    });
});

for (const base of ['app', 'src/app'])
  test(`Next warns for relevant ancestor layouts in ${base} only`, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'next-edge-'));
    try {
      for (const rel of [
        `${base}/layout.tsx`,
        `${base}/dashboard/layout.jsx`,
        `${base}/dashboard/page.tsx`,
        `${base}/unrelated/layout.js`
      ]) {
        fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
        fs.writeFileSync(path.join(cwd, rel), "export const runtime = 'edge';");
      }
      initLLMProject({ cwd, type: 'nextjs' });
      const report = verifyIntegration({ cwd, type: 'nextjs', entryFile: `${base}/dashboard/page.tsx` });
      const edge = report.warnings.filter(w => w.includes('Edge'));
      assert.ok(edge.some(w => w.startsWith(`${base}/layout.tsx:`)));
      assert.ok(edge.some(w => w.startsWith(`${base}/dashboard/layout.jsx:`)));
      assert.ok(!edge.some(w => w.includes('unrelated')));
      assert.ok(edge.every(w => w.includes('node:fs') && w.includes('undici')));
      const actionOnly = verifyIntegration({ cwd, type: 'nextjs', entryFile: null });
      assert.ok(actionOnly.warnings.some(w => w.startsWith(`${base}/layout.tsx:`)));
      assert.ok(!actionOnly.warnings.some(w => w.includes('dashboard/layout')));
      assert.match(fs.readFileSync(path.join(cwd, `${base}/api/llm/[...slug]/route.js`), 'utf8'), /runtime = 'nodejs'/);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
