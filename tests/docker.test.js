import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('YH1-D3: Dockerfile, .dockerignore and DAGITIM.md exist and meet production specs', () => {
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

  // 3. docs/DAGITIM.md checks
  const deployPath = path.join(root, 'docs/DAGITIM.md');
  assert.ok(fs.existsSync(deployPath), 'docs/DAGITIM.md should exist');
  const deploy = fs.readFileSync(deployPath, 'utf8');

  assert.ok(deploy.includes('docker run'));
  assert.ok(deploy.includes('/api/llm/health'));
  assert.ok(deploy.includes('LLM_ADMIN_PASSWORD'));
  assert.ok(deploy.includes('/data'));
});
