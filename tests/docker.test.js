import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('YH1-D3: Dockerfile, .dockerignore and unified guide meet production specs', () => {
  const root = path.resolve();

  // 1. Dockerfile checks
  const dockerfilePath = path.join(root, 'Dockerfile');
  assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile should exist');
  const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

  assert.ok(dockerfile.includes('node:22-alpine'), 'Should use node:22-alpine image');
  assert.ok(dockerfile.includes('USER node'), 'Should switch to non-root user node');
  assert.ok(dockerfile.includes('VOLUME ["/data"]'), 'Should declare /data volume');
  assert.ok(dockerfile.includes('HEALTHCHECK'), 'Should define HEALTHCHECK');
  assert.ok(dockerfile.includes('/api/llm/health'), 'HEALTHCHECK should probe /api/llm/health');
  assert.ok(dockerfile.includes('--host') && dockerfile.includes('0.0.0.0'), 'Default host should be 0.0.0.0');

  // 2. .dockerignore checks
  const dockerignorePath = path.join(root, '.dockerignore');
  assert.ok(fs.existsSync(dockerignorePath), '.dockerignore should exist');
  const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');

  assert.ok(dockerignore.includes('node_modules'));
  assert.ok(dockerignore.includes('tests'));
  assert.ok(dockerignore.includes('data'));
  assert.ok(dockerignore.includes('.git'));
  assert.ok(dockerignore.includes('.env*'));

  // 3. Deployment instructions in the unified guide.
  const deployPath = path.join(root, 'docs/KULLANICI_KILAVUZU.md');
  assert.ok(fs.existsSync(deployPath), 'Unified user guide should exist');
  const deploy = fs.readFileSync(deployPath, 'utf8');

  assert.ok(deploy.includes('docker run'));
  assert.ok(deploy.includes('/api/llm/health'));
  assert.ok(deploy.includes('LLM_ADMIN_PASSWORD'));
  assert.ok(deploy.includes('/data'));
});

test('Docker image installs Express as a runtime dependency from the lockfile', async () => {
  const root = path.resolve();
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  // express bir devDependency; NODE_ENV=production altında `npm install express --no-save` onu atlar.
  assert.doesNotMatch(dockerfile, /npm install express[^\n]*--no-save/);
  assert.match(dockerfile, /npm ci --include=dev/);
  assert.match(dockerfile, /node scripts\/docker-runtime-deps\.mjs/);
  assert.match(dockerfile, /npm prune --omit=dev/);
  const order = ['npm ci --include=dev', 'node scripts/docker-runtime-deps.mjs', 'npm prune --omit=dev'].map(step =>
    dockerfile.indexOf(step)
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
    'kurulum, Express taşıma ve budama sırası bozuk'
  );

  const { promoteRuntimeDependencies } = await import('../scripts/docker-runtime-deps.mjs');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const promoted = promoteRuntimeDependencies(structuredClone(pkg));
  assert.equal(promoted.dependencies.express, pkg.devDependencies.express);
  assert.equal(promoted.devDependencies.express, undefined);
  assert.equal(promoted.dependencies.undici, pkg.dependencies.undici);
  assert.ok(promoted.devDependencies.eslint, 'diğer geliştirme bağımlılıkları budanmak üzere yerinde kalır');
});
