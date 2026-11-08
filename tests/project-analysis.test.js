import test from 'node:test';
import assert from 'node:assert/strict';
const { analyzeProject } = await import('../src/project/analyze.js').catch(() => ({}));
const { selectProjectContext } = await import('../src/project/context.js').catch(() => ({}));

test('a ready but unrelated graph does not count as used', () => {
  const result = selectProjectContext([{ path: 'orders.js', content: 'export const orders = 1;' }], 'orders', 1200, {
    status: 'ready',
    nodes: [{ id: 'x', path: 'unrelated.js', label: 'other', line: 1 }],
    links: []
  });
  assert.equal(result.graphUsed, false);
  assert.deepEqual(result.graphEvidence, []);
});

test('Graphify contributes cited relation evidence even when both files were already in basic context', () => {
  const files = [
    { path: 'orders.js', content: 'export function orders() { return implementation(); }' },
    { path: 'service.js', content: 'export function implementation() { return 1; }' }
  ];
  const graph = {
    status: 'ready',
    revision: 'current',
    nodes: [
      { id: 'a', path: 'orders.js', label: 'orders', line: 1 },
      { id: 'b', path: 'service.js', label: 'implementation', line: 1 }
    ],
    links: [{ from: 'a', to: 'b', kind: 'calls', confidence: 'source-pattern' }]
  };
  const basic = selectProjectContext(files, 'orders', 4000);
  const result = selectProjectContext(files, 'orders', 4000, graph, undefined, 'current');
  assert.equal(basic.sources.length, 2);
  assert.deepEqual(result.graphAddedFiles, []);
  assert.equal(result.graphUsed, true);
  assert.deepEqual(result.graphEvidence, [
    { fromPath: 'orders.js', fromLine: 1, toPath: 'service.js', toLine: 1, kind: 'calls', confidence: 'source-pattern' }
  ]);
  assert.match(result.text, /GRAPHIFY İLİŞKİ KANITLARI/);
  assert.match(result.text, /Seçim nedeni/);
  assert.match(result.text, /return implementation\(\)/);
  const stale = selectProjectContext(files, 'orders', 4000, graph, undefined, 'new-revision');
  assert.equal(stale.graphUsed, false);
  assert.deepEqual(stale.graphEvidence, []);
  assert.doesNotMatch(stale.text, /GRAPHIFY İLİŞKİ/);
});

test('relation references include distant source lines, reject invalid endpoints and stay capped and budgeted', () => {
  const files = [
    { path: 'orders.js', content: '// prefix\n'.repeat(220) + 'export function orders() { return 1; }' },
    ...Array.from({ length: 25 }, (_, i) => ({ path: `service${i}.js`, content: `export const handler${i}=1;` }))
  ];
  const graph = {
    status: 'ready',
    nodes: [
      { id: 'a', path: 'orders.js', label: 'orders', line: 221 },
      ...files.slice(1).map((file, i) => ({ id: `b${i}`, path: file.path, label: 'handler', line: 1 })),
      { id: 'invalid', path: 'service0.js', label: 'bad', line: 9000 }
    ],
    links: [
      { from: 'a', to: 'invalid', kind: 'bad' },
      ...files.slice(1).map((_, i) => ({ from: 'a', to: `b${i}`, kind: 'calls', confidence: 'unknown' }))
    ]
  };
  const result = selectProjectContext(files, 'orders', 40000, graph);
  assert.equal(result.graphEvidence.length, 20);
  assert.ok(result.graphEvidence.every(item => item.fromLine === 221 && item.kind === 'calls'));
  assert.match(result.text, /export function orders/);
  assert.ok(result.sources.some(source => source.path === 'orders.js' && source.endLine >= 221));
  assert.ok(result.text.length <= 40000);
  for (const budget of [0, 100, 600, 1200]) {
    const small = selectProjectContext(files, 'orders', budget, graph);
    assert.ok(small.text.length <= budget);
    assert.ok(small.graphEvidence.length <= 20);
    assert.equal(small.graphUsed, small.graphEvidence.length > 0 || small.graphAddedFiles.length > 0);
  }
});

test('general overview selects graph relations from the covered code instead of generic request words', () => {
  const files = [
    { path: 'backend/app.js', content: 'setupLLMManagement(app);' },
    { path: 'backend/integration.js', content: 'export const setupLLMManagement = () => {};' }
  ];
  const graph = {
    status: 'ready',
    nodes: [
      { id: 'a', path: files[0].path, label: 'bootstrap', line: 1 },
      { id: 'b', path: files[1].path, label: 'setupLLMManagement', line: 1 }
    ],
    links: [{ from: 'a', to: 'b', kind: 'calls', confidence: 'unknown' }]
  };
  const result = selectProjectContext(files, 'uygulama hakkında bilgi ver öncelikle', 8000, graph);
  assert.equal(result.graphUsed, true);
  assert.equal(result.graphEvidence.length, 1);
  assert.ok(result.overview);
});

test('generic request words do not promote server substrings over the requested subject', () => {
  for (const question of ['orders hakkında bilgi ver öncelikle', 'please give information about orders first']) {
    const result = selectProjectContext(
      [
        { path: 'backend/server.js', content: 'export const unrelated = true;\n'.repeat(100) },
        { path: 'feature.js', content: 'export const orders = 1;\n'.repeat(100) }
      ],
      question,
      1000
    );
    assert.equal(result.sources[0].path, 'feature.js', question);
  }
});

test('identifier matching recognizes camel and snake words without matching arbitrary substrings', () => {
  const result = selectProjectContext(
    [
      { path: 'a/preorder.js', content: 'export const unrelated = true;\n'.repeat(100) },
      { path: 'z/action.js', content: 'export const orderApproval = order_state;\n'.repeat(100) }
    ],
    'order',
    900
  );
  assert.equal(result.sources[0].path, 'z/action.js');
});

test('overview reserves actual frontend, backend, authorization, integration and database evidence', () => {
  const corpus = [
    { path: 'README.md', content: '# Current application\n' + 'Guide.\n'.repeat(500) },
    { path: 'backend/package.json', content: '{\n"dependencies": {\n"express": "^5.2.1"\n}\n}' },
    { path: 'frontend/package.json', content: '{\n"dependencies": {\n"nuxt": "^4.5.1",\n"vue": "^3.5.0"\n}\n}' },
    { path: 'frontend/pages/index.vue', content: '<template>Inventory</template>\n'.repeat(200) },
    {
      path: 'backend/src/app.js',
      content:
        "import { authorize } from './middleware/auth.js';\n" +
        '// initialization\n'.repeat(100) +
        "setupLLMManagement(app);\napp.get('/stock', authorize, handler);\n"
    },
    {
      path: 'backend/src/middleware/auth.js',
      content:
        'export function authorize(req, res, next) {\n  if (!req.session) return res.sendStatus(401);\n  next();\n}\n'
    },
    {
      path: 'backend/src/integrations/llmManagement.js',
      content: "export function setupLLMManagement(app) { setupLLM(app, { pagePath: '/llm' }); }"
    },
    { path: 'backend/prisma/schema.prisma', content: 'model Product {\n id Int @id\n}\n' },
    ...Array.from({ length: 20 }, (_, i) => ({
      path: `backend/noise${i}.js`,
      content: 'const server = true;\n'.repeat(300)
    })),
    { path: 'docs/archive/old.md', content: 'Express 3 used to run.' }
  ];
  const result = selectProjectContext(corpus, 'uygulama hakkında bilgi ver öncelikle', 8000);
  for (const file of [
    'README.md',
    'frontend/pages/index.vue',
    'backend/src/app.js',
    'backend/src/middleware/auth.js',
    'backend/src/integrations/llmManagement.js',
    'backend/prisma/schema.prisma'
  ])
    assert.ok(
      result.sources.some(source => source.path === file),
      file
    );
  assert.match(result.text, /if \(!req.session\)/);
  assert.match(result.text, /setupLLMManagement\(app\)/);
  assert.ok(result.overview);
  assert.deepEqual(Object.keys(result.overview).sort(), ['api', 'components', 'database', 'limitations', 'stack']);
  assert.ok(
    result.overview.stack.some(
      item =>
        item.name === 'express' && item.version === '^5.2.1' && item.path === 'backend/package.json' && item.line === 3
    )
  );
  assert.ok(result.overview.stack.some(item => item.name === 'nuxt' && item.line === 3));
  assert.ok(result.overview.stack.some(item => item.name === 'vue' && item.line === 4));
  assert.ok(result.overview.api.some(item => item.endpoint === '/stock' && item.line === 103));
  assert.ok(result.overview.database.some(item => item.path === 'backend/prisma/schema.prisma'));
  assert.match(result.overview.limitations.join(' '), /Statik|statik/);
  assert.match(result.overview.limitations.join(' '), /[Kk]ıs|bütçe|[Kk]es/);
  assert.ok(result.text.length <= 8000);
  assert.ok(!result.sources.some(source => source.role === 'historical'));
  for (const section of ['stack', 'components', 'api', 'database']) {
    for (const fact of result.overview[section]) {
      assert.equal(typeof fact.path, 'string');
      assert.ok(Number.isInteger(fact.line) && fact.line > 0);
      assert.ok(result.sources.some(s => s.path === fact.path && s.startLine <= fact.line && s.endLine >= fact.line));
    }
  }
});

test('manifest version citations point to the dependency section, not a similarly named script', () => {
  const report = analyzeProject([
    {
      path: 'frontend/package.json',
      content: '{\n"scripts": {"vue": "test"},\n"dependencies": {\n"vue": "^3.5.0"\n}\n}'
    }
  ]);
  assert.equal(report.stack.find(item => item.name === 'vue').line, 4);
});

test('overview favors real authorization middleware and the entry-imported LLM integration over similarly named files', () => {
  const result = selectProjectContext(
    [
      { path: 'backend/src/app.js', content: "require('./integrations/llmManagement').setupLLMManagement(app);" },
      { path: 'backend/llm.js', content: 'setupLLM(app, options);\n'.repeat(100) },
      { path: 'backend/src/integrations/llmAuth.cjs', content: 'export const adapter = true;\n'.repeat(100) },
      {
        path: 'backend/src/integrations/llmManagement.js',
        content: "setupLLM(app, {pagePath: '/llm'});\n".repeat(100)
      },
      {
        path: 'backend/src/middleware/auth.js',
        content: 'export const sessionId = req.cookies.session_id;\n'.repeat(100)
      }
    ],
    'uygulama hakkında bilgi ver öncelikle',
    2200
  );
  assert.ok(result.sources.some(s => s.path === 'backend/src/middleware/auth.js'));
  assert.ok(result.sources.some(s => s.path === 'backend/src/integrations/llmManagement.js'));
});

test('tiny overview budgets stay bounded and report omitted scope without inventing facts', () => {
  for (const budget of [0, 100, 400, 1000]) {
    const result = selectProjectContext(
      [
        { path: 'frontend/package.json', content: '{"dependencies":{"vue":"^3"}}' },
        { path: 'backend/app.js', content: "app.get('/orders', handler);\n".repeat(400) }
      ],
      'give a project overview',
      budget
    );
    assert.ok(result.text.length <= budget);
    assert.equal(result.partial, true);
    assert.ok(result.overview.limitations.length > 0);
  }
});

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

test('context reserves space for project guidance and follows local imports', () => {
  const corpus = [
    { path: 'README.md', content: '# Uygulama\nSipariş yönetimi.' },
    { path: 'docs/KULLANICI_KILAVUZU.txt', content: 'Teslimat iş akışı açıklaması.' },
    {
      path: 'src/orders.js',
      content: "import { implementation } from './hidden.js';\nexport const orders = implementation;"
    },
    { path: 'src/hidden.js', content: 'export const implementation = 2;' },
    ...Array.from({ length: 20 }, (_, i) => ({ path: `src/aaa${i}.js`, content: 'orders\n'.repeat(100) }))
  ];
  const result = selectProjectContext(corpus, 'orders', 1600);
  for (const name of ['README.md', 'docs/KULLANICI_KILAVUZU.txt', 'src/hidden.js'])
    assert.ok(
      result.sources.some(s => s.path === name),
      name
    );
  assert.ok(result.text.length <= 1600);
  assert.equal(result.graphUsed, false);
});

test('Graphify neighbours prioritize related sources only when the graph is current', () => {
  const files = [
    { path: 'src/orders.js', content: 'export const orders = 1;' },
    { path: 'src/hidden.js', content: 'export const implementation = 2;' },
    ...Array.from({ length: 20 }, (_, i) => ({ path: `src/aaa${i}.js`, content: 'orders\n'.repeat(100) }))
  ];
  const graph = {
    status: 'ready',
    nodes: [
      { id: 'a', path: 'src/orders.js', label: 'orders' },
      { id: 'b', path: 'src/hidden.js', label: 'implementation' }
    ],
    links: [{ from: 'a', to: 'b' }]
  };
  const result = selectProjectContext(files, 'orders', 1000, graph);
  assert.equal(result.graphUsed, true);
  assert.deepEqual(result.graphAddedFiles, ['src/hidden.js']);
  assert.ok(result.sources.some(item => item.path === 'src/hidden.js'));
  assert.equal(selectProjectContext(files, 'orders', 1000, { ...graph, status: 'stale' }).graphUsed, false);
});

test('overview prioritizes current README and reserves room for every component manifest', () => {
  const corpus = [
    { path: 'README.md', content: '# Güncel\nStok uygulaması.\n' + 'Güncel kullanım bilgisi.\n'.repeat(150) },
    { path: 'docs/archive/old.md', content: 'uygulama hakkında bilgi ver öncelikle\n'.repeat(100) },
    { path: 'docs/superpowers/plans/old.md', content: 'uygulama hakkında bilgi ver öncelikle' },
    { path: 'backend/package.json', content: JSON.stringify({ dependencies: { express: '^5.2.1' } }) },
    { path: 'frontend/package.json', content: JSON.stringify({ dependencies: { nuxt: '^4.5.1' } }) }
  ];
  const result = selectProjectContext(corpus, 'uygulama hakkında bilgi ver öncelikle', 1800);
  assert.equal(result.sources[0].path, 'README.md');
  for (const file of ['backend/package.json', 'frontend/package.json'])
    assert.ok(
      result.sources.some(source => source.path === file),
      file
    );
  assert.ok(!result.sources.some(source => /archive|plans/.test(source.path)));
  assert.ok(result.text.length <= 1800);
});

test('historical and plan sources require an explicit request and are labeled as such', () => {
  const corpus = [
    { path: 'README.md', content: '# Current application' },
    { path: 'docs/archive/old.md', content: 'An older architecture.' },
    { path: 'docs/superpowers/plans/upgrade.md', content: 'Migration proposal.' }
  ];
  const current = selectProjectContext(corpus, 'uygulama hakkında bilgi ver', 2000);
  assert.deepEqual(
    current.sources.map(source => source.path),
    ['README.md']
  );
  const history = selectProjectContext(corpus, 'uygulamanın tarihçesi ve eski geliştirme planları', 2000);
  assert.ok(history.sources.some(source => source.path === 'docs/archive/old.md' && source.role === 'historical'));
  assert.ok(
    history.sources.some(source => source.path === 'docs/superpowers/plans/upgrade.md' && source.role === 'plan')
  );
  assert.match(history.text, /Tarihsel kayıt/);
  assert.match(history.text, /uygulanma durumu/);
  assert.equal(Object.hasOwn(history.sources[0], 'date'), false);
  assert.equal(Object.hasOwn(history.sources[0], 'implemented'), false);
});

test('server document-role overrides can choose a custom current manual', () => {
  const corpus = [
    { path: 'README.md', content: 'Old instructions' },
    { path: 'docs/archive/OPERATIONS.md', content: 'Current institution guide' },
    { path: 'backend/package.json', content: '{"dependencies":{"express":"5"}}' }
  ];
  const roles = { 'README.md': 'historical', 'docs/archive/OPERATIONS.md': 'canonical' };
  const result = selectProjectContext(corpus, 'uygulama hakkında bilgi ver', 1200, null, roles);
  assert.equal(result.sources[0].path, 'docs/archive/OPERATIONS.md');
  assert.ok(!result.sources.some(source => source.path === 'README.md'));
});

test('long single-line manifests do not erase subsequent component manifests', () => {
  const corpus = [
    { path: 'README.md', content: '# Current\n' + 'Guide '.repeat(200) },
    {
      path: 'backend/package.json',
      content: JSON.stringify({ description: 'x'.repeat(5000), dependencies: { express: '5' } })
    },
    { path: 'frontend/package.json', content: '{"dependencies":{"nuxt":"4"}}' }
  ];
  const result = selectProjectContext(corpus, 'uygulama hakkında bilgi ver', 1800);
  assert.ok(result.sources.some(source => source.path === 'backend/package.json'));
  assert.ok(result.sources.some(source => source.path === 'frontend/package.json'));
  assert.equal(result.partial, true);
  assert.ok(result.text.length <= 1800);
});

test('Graphify cannot pull archived sources into a current overview', () => {
  const corpus = [
    { path: 'README.md', content: '# Current' },
    { path: 'docs/archive/old.md', content: 'orders' },
    { path: 'server.js', content: 'export const orders=1;' }
  ];
  const graph = {
    status: 'ready',
    nodes: [
      { id: 'a', path: 'server.js', label: 'orders' },
      { id: 'b', path: 'docs/archive/old.md', label: 'orders' }
    ],
    links: [{ from: 'a', to: 'b' }]
  };
  const result = selectProjectContext(corpus, 'orders', 1500, graph);
  assert.ok(!result.sources.some(source => source.path === 'docs/archive/old.md'));
  assert.ok(!result.sources.some(source => source.role === 'historical'));
  assert.ok(!result.graphAddedFiles.includes('docs/archive/old.md'));
});

test('excluded historical graph seeds cannot promote unrelated current sources', () => {
  const corpus = [
    { path: 'README.md', content: '# Current' },
    { path: 'docs/archive/old.md', content: 'orders' },
    { path: 'related.js', content: 'export const implementation=1;' },
    ...Array.from({ length: 10 }, (_, i) => ({ path: `noise${i}.js`, content: 'orders\n'.repeat(100) }))
  ];
  const graph = {
    status: 'ready',
    nodes: [
      { id: 'a', path: 'docs/archive/old.md', label: 'orders' },
      { id: 'b', path: 'related.js', label: 'implementation' }
    ],
    links: [{ from: 'a', to: 'b' }]
  };
  const result = selectProjectContext(corpus, 'orders', 1000, graph);
  assert.ok(!result.graphAddedFiles.includes('related.js'));
});

test('a request excluding archives and plans keeps the current-only selection', () => {
  const corpus = [
    { path: 'README.md', content: 'Current app' },
    { path: 'docs/archive/old.md', content: 'Old' },
    { path: 'docs/plans/next.md', content: 'Proposal' }
  ];
  const result = selectProjectContext(corpus, 'Arşiv ve plan belgelerini kullanmadan güncel uygulamayı anlat', 1200);
  assert.ok(!result.sources.some(source => ['historical', 'plan'].includes(source.role)));
});

test('a mixed history and planning question reserves a source from both historical roles', () => {
  const corpus = [
    { path: 'README.md', content: 'Current app' },
    ...Array.from({ length: 5 }, (_, i) => ({
      path: `docs/archive/old${i}.md`,
      content: 'tarihçesi eski geliştirme planları\n'.repeat(100)
    })),
    { path: 'docs/plans/upgrade.md', content: 'Planned migration.\n'.repeat(100) },
    ...Array.from({ length: 4 }, (_, i) => ({
      path: `noise${i}.js`,
      content: 'tarihçesi eski geliştirme planları\n'.repeat(100)
    }))
  ];
  const result = selectProjectContext(corpus, 'uygulamanın tarihçesi ve eski geliştirme planları', 1600);
  assert.ok(result.sources.some(source => source.role === 'historical'));
  assert.ok(result.sources.some(source => source.role === 'plan'));
  assert.ok(result.text.length <= 1600);
});

test('Turkish inflections of history explicitly enable historical sources', () => {
  const corpus = [
    { path: 'README.md', content: 'Current app' },
    { path: 'docs/archive/old.md', content: 'Old architecture' }
  ];
  for (const question of ['Uygulamanın tarihçesini anlat', 'Uygulamanın geçmişini açıkla']) {
    assert.ok(
      selectProjectContext(corpus, question, 1200).sources.some(source => source.role === 'historical'),
      question
    );
  }
});

test('imports quoted in excluded archives cannot change current source ranking', () => {
  const corpus = [
    { path: 'README.md', content: '# Current' },
    { path: 'docs/archive/old.md', content: "orders architecture\nimport {implementation} from '../../related.js';" },
    { path: 'related.js', content: 'export const implementation=1;' },
    ...Array.from({ length: 10 }, (_, i) => ({ path: `noise${i}.js`, content: 'orders\n'.repeat(100) }))
  ];
  const result = selectProjectContext(corpus, 'orders architecture', 1000);
  assert.ok(!result.sources.some(source => source.path === 'related.js'));
});

test('Next.js App Router route handlers become route endpoints derived from the file path', () => {
  const report = analyzeProject([
    {
      path: 'app/api/ai/route.ts',
      content:
        "export const runtime = 'nodejs';\nexport async function POST(request) {\n  return Response.json({});\n}\n"
    },
    {
      path: 'app/api/exams/[id]/route.ts',
      content: 'export function GET() {}\nexport const DELETE = async () => new Response(null);\n'
    },
    {
      path: 'src/app/(shop)/docs/[...slug]/route.js',
      content: 'const handler = () => {};\nexport { handler as GET, handler as HEAD };\n'
    },
    { path: 'app/route.ts', content: 'export async function GET() {}\n' },
    { path: 'app/page.tsx', content: 'export async function GET() {}\n' },
    { path: 'lib/route.ts', content: 'export async function POST() {}\n' },
    { path: 'components/form.tsx', content: "fetch('/api/ai', { method: 'POST' });\n" }
  ]);
  const routes = report.api
    .filter(entry => entry.kind === 'route')
    .map(({ method, endpoint, path, line }) => `${method} ${endpoint} ${path}:${line}`);
  assert.deepEqual(routes.sort(), [
    'DELETE /api/exams/[id] app/api/exams/[id]/route.ts:2',
    'GET / app/route.ts:1',
    'GET /api/exams/[id] app/api/exams/[id]/route.ts:1',
    'GET /docs/[...slug] src/app/(shop)/docs/[...slug]/route.js:2',
    'HEAD /docs/[...slug] src/app/(shop)/docs/[...slug]/route.js:2',
    'POST /api/ai app/api/ai/route.ts:2'
  ]);
  assert.ok(
    report.relationships.some(
      link => link.kind === 'http' && link.from === 'components/form.tsx' && link.to === 'app/api/ai/route.ts'
    )
  );
});
