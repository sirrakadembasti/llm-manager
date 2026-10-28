import test from 'node:test';
import assert from 'node:assert/strict';
const { analyzeProject } = await import('../src/project/analyze.js').catch(() => ({}));
const { selectProjectContext } = await import('../src/project/context.js').catch(() => ({}));

const files = [
  {
    path: 'package.json',
    content: JSON.stringify({ type: 'module', dependencies: { express: '4.21.2', react: '18.3.1' } })
  },
  {
    path: 'frontend/Orders.jsx',
    content: "import { listOrders } from './api.js';\nexport function Orders() { return listOrders(); }"
  },
  {
    path: 'frontend/api.js',
    content: "export async function listOrders() { return fetch('/api/orders').then(r => r.json()); }"
  },
  {
    path: 'backend/routes.js',
    content:
      "import { listOrders } from './service.js';\napp.get('/api/orders', (_req, res) => res.json(listOrders()));"
  },
  {
    path: 'backend/service.js',
    content: "import { orderTable } from '../db/schema.js';\nexport function listOrders() { return orderTable; }"
  },
  { path: 'db/schema.js', content: "export const orderTable = 'orders';" },
  { path: 'db/migrations/001.sql', content: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, total NUMERIC NOT NULL);' }
];

test('project analysis links frontend HTTP calls to matching backend routes with source evidence', () => {
  assert.equal(typeof analyzeProject, 'function');
  const report = analyzeProject(files);
  assert.ok(report.stack.some(s => s.name === 'express' && s.version === '4.21.2' && s.path === 'package.json'));
  assert.ok(report.stack.some(s => s.name === 'react'));
  const route = report.api.find(a => a.path === 'backend/routes.js');
  assert.equal(route.method, 'GET');
  assert.equal(route.endpoint, '/api/orders');
  assert.equal(route.line, 2);
  assert.ok(
    report.relationships.some(r => r.from === 'frontend/api.js' && r.to === 'backend/routes.js' && r.kind === 'http')
  );
  assert.ok(
    report.relationships.some(
      r => r.from === 'backend/routes.js' && r.to === 'backend/service.js' && r.kind === 'import'
    )
  );
  const sql = report.database.find(d => d.path === 'db/migrations/001.sql');
  assert.equal(sql.name, 'orders');
  assert.deepEqual(
    sql.columns.map(c => c.name),
    ['id', 'total']
  );
});

test('project analysis preserves separate workspace manifests and reports invalid ones without executing them', () => {
  assert.equal(typeof analyzeProject, 'function');
  const report = analyzeProject([
    { path: 'apps/web/package.json', content: '{"dependencies":{"next":"15.0.0"}}' },
    { path: 'apps/api/package.json', content: '{"dependencies":{"fastify":"5.0.0"}}' },
    { path: 'broken/package.json', content: 'not json' },
    { path: 'next.config.js', content: 'throw new Error("must not execute");' }
  ]);
  assert.equal(report.stack.length, 2);
  assert.ok(report.warnings.some(w => w.path === 'broken/package.json'));
  assert.ok(report.components.some(c => c.name === 'apps/web'));
  assert.ok(report.components.some(c => c.name === 'apps/api'));
});

test('context selection includes related SQL and API sources within an explicit character budget', () => {
  assert.equal(typeof selectProjectContext, 'function');
  const context = selectProjectContext(files, 'orders teslimat total alanını güncelle', 3000);
  assert.ok(context.text.length <= 3000);
  assert.ok(context.sources.some(s => s.path === 'db/migrations/001.sql'));
  assert.ok(context.sources.some(s => s.path === 'backend/routes.js'));
  assert.match(context.text, /backend\/routes\.js:1/);
  assert.match(context.text, /CREATE TABLE orders/);
  assert.equal(new Set(context.sources.map(s => s.path)).size, context.sources.length);
});

test('context reports truncation and does not fabricate missing file contents', () => {
  assert.equal(typeof selectProjectContext, 'function');
  const context = selectProjectContext([{ path: 'large.js', content: 'export const x = 1;\n'.repeat(200) }], 'x', 240);
  assert.ok(context.text.length <= 240);
  assert.equal(context.partial, true);
  assert.deepEqual(selectProjectContext([], 'missing', 1000).sources, []);
});
