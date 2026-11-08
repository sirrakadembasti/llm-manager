import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveProjectContext } from '../src/project/retrieval.js';
import { projectQuery } from '../src/project/query.js';
import { auditProjectCitations } from './helpers/project-citations.js';

const files = [
  { path: 'README.md', content: '# Current Mimo Stok\nInventory application.' },
  { path: 'backend/package.json', content: '{"dependencies":{"express":"^5.2.1","@prisma/client":"^7.0.0"}}' },
  { path: 'frontend/package.json', content: '{"dependencies":{"nuxt":"^4.5.1","vue":"^3.5.40"}}' },
  {
    path: 'backend/src/app.js',
    content:
      "const {setupLLMManagement}=require('./integrations/llmManagement');\nsetupLLMManagement(app);\napp.use('/api/requests', requestRoutes);"
  },
  {
    path: 'backend/src/middleware/auth.js',
    content:
      'export function auth(req,res,next) {\n const sessionId=req.cookies.session_id;\n if(!sessionId) return res.sendStatus(401);\n next();\n}\nexport function requireAdmin(req,res,next) {if(req.user.role!=="admin") return res.sendStatus(403);next();}'
  },
  {
    path: 'backend/src/routes/auth.js',
    content: "const {auth}=require('../middleware/auth');\napp.post('/login', login);"
  },
  {
    path: 'backend/src/controllers/request.js',
    content:
      "const prisma=require('../utils/prisma');\nexport async function approveRequest(id) {\n return prisma.request.update({where:{id},data:{status:'ACCEPTED'}});\n}"
  },
  {
    path: 'backend/src/utils/prisma.js',
    content:
      "const {PrismaClient}=require('@prisma/client');\nconst prisma=new PrismaClient();\nmodule.exports=prisma;\n// A URL branch declares adapter selection, not a successful deployment."
  },
  {
    path: 'backend/prisma/schema.prisma',
    content: 'model Request {\n id Int @id\n status String\n}\nmodel Product {\n id Int @id\n quantity Int\n}'
  },
  {
    path: 'frontend/components/DeliveryReceiptModal.vue',
    content:
      '<template><button @click="printReceipt">Print delivery receipt</button></template>\n<script setup>\nconst printReceipt = () => window.print();\n</script>'
  },
  {
    path: 'backend/src/integrations/llmManagement.js',
    content:
      "export function setupLLMManagement(app) {\n return setupLLM(app, { pagePath: '/llm', authMode: 'host', requireAuth });\n}"
  },
  { path: 'docs/archive/old.md', content: 'Historical design: Express 3 migration proposal.' },
  { path: 'docs/plans/next.md', content: 'Future deployment plan; not implemented evidence.' },
  ...Array.from({ length: 12 }, (_, i) => ({
    path: `backend/aaa-noise${i}.js`,
    content: 'export const unrelated=true;\n'.repeat(180)
  }))
];
const snapshot = { files, revision: 'a'.repeat(64) };
const graph = {
  status: 'ready',
  revision: snapshot.revision,
  nodes: files.map(file => ({ id: file.path, label: file.path, path: file.path, line: 1 })),
  links: [
    {
      from: 'backend/src/controllers/request.js',
      to: 'backend/src/utils/prisma.js',
      kind: 'imports',
      confidence: 'high'
    },
    {
      from: 'backend/src/app.js',
      to: 'backend/src/integrations/llmManagement.js',
      kind: 'imports',
      confidence: 'high'
    },
    { from: 'backend/src/routes/auth.js', to: 'backend/src/middleware/auth.js', kind: 'imports', confidence: 'high' }
  ]
};
const cases = [
  [
    'general',
    'uygulama hakkında bilgi ver öncelikle',
    ['README.md', 'backend/package.json', 'frontend/package.json', 'backend/src/integrations/llmManagement.js']
  ],
  [
    'architecture',
    'Nuxt ve Express mimarisini ve sürümlerini açıkla',
    ['backend/package.json', 'frontend/package.json', 'backend/src/app.js']
  ],
  [
    'auth',
    'Giriş ve yönetici yetkileri nasıl denetleniyor?',
    ['backend/src/middleware/auth.js', 'backend/src/routes/auth.js']
  ],
  [
    'approval',
    'Stok talebi onaylandığında kontrolcü ile veritabanı nasıl bağlanıyor?',
    ['backend/src/controllers/request.js', 'backend/src/utils/prisma.js', 'backend/prisma/schema.prisma']
  ],
  ['receipt', 'Malzeme teslim tutanağı nasıl hazırlanıyor?', ['frontend/components/DeliveryReceiptModal.vue']],
  [
    'llm',
    'LLM yönetimi hedef uygulamaya nereden bağlanıyor?',
    ['backend/src/app.js', 'backend/src/integrations/llmManagement.js']
  ],
  ['history', 'Uygulamanın geçmişindeki geliştirmeler ve planları anlat', ['docs/archive/old.md', 'docs/plans/next.md']]
];
for (const [name, question, expected] of cases)
  for (const mode of ['basic', 'graphify'])
    test(`${name}: ${mode} selects the sources required for the question`, () => {
      const { context, retrieval } = retrieveProjectContext(snapshot, question, { mode, graph, budget: 9000 });
      for (const file of expected)
        assert.ok(
          context.sources.some(source => source.path === file),
          `${name}/${mode}: ${file}`
        );
      assert.ok(context.text.length <= 9000);
      assert.equal(retrieval.sourceRevision, snapshot.revision);
      if (name !== 'history') assert.ok(!context.sources.some(source => ['historical', 'plan'].includes(source.role)));
      else {
        assert.match(context.text, /Tarihsel kayıt/);
        assert.match(context.text, /Plan belgesi/);
      }
      for (const source of context.sources) {
        const file = files.find(file => file.path === source.path);
        assert.ok(file);
        assert.ok(source.startLine >= 1 && source.endLine <= file.content.split('\n').length);
      }
    });

test('citation audit rejects ranges that cross omitted lines and unknown files', () => {
  const context = '\n[KAYNAK app.js:1]\n1| const app = {};\n8| app.listen();\n';
  const result = auditProjectCitations(context, 'Başlatma app.js:1-8; other.js:2.');
  assert.equal(result.citationCount, 2);
  assert.deepEqual(result.invalid[0].unprovidedLines, [2, 3, 4, 5, 6, 7]);
  assert.equal(result.invalid[1].path, 'other.js');
});

test('citation audit accepts exact excerpt and structured fact lines', () => {
  const context =
    '\n[KAYNAK app.js:1]\n1| const app = {};\n' +
    JSON.stringify({ components: [{ path: 'app.js', line: 8 }], sources: [{ path: 'db.js', line: 3 }] });
  assert.deepEqual(auditProjectCitations(context, 'app.js:1, 8 ve db.js:3').invalid, []);
  assert.equal(auditProjectCitations(context, 'Atıfsız cevap').citationCount, 0);
});

test('graph contribution and revision gates remain explicit in quality fixtures', () => {
  const prompt = 'Stok talebi onaylandığında kontrolcü ile veritabanı nasıl bağlanıyor?';
  const enhanced = retrieveProjectContext(snapshot, prompt, { mode: 'graphify', graph, budget: 9000 });
  assert.equal(enhanced.retrieval.graphContributed, true);
  assert.ok(
    enhanced.retrieval.graphEvidence.some(
      edge => edge.fromPath === 'backend/src/controllers/request.js' && edge.toPath === 'backend/src/utils/prisma.js'
    )
  );
  const basic = retrieveProjectContext(snapshot, prompt, { mode: 'basic', graph, budget: 9000 });
  assert.equal(basic.retrieval.graphContributed, false);
  const stale = retrieveProjectContext(snapshot, prompt, {
    mode: 'graphify',
    graph: { ...graph, revision: 'b'.repeat(64) },
    budget: 9000
  });
  assert.equal(stale.retrieval.reason, 'graph-stale');
  assert.equal(stale.retrieval.graphContributed, false);
});

// Next.js App Router fixture modelled on the pdf-to-onlinequiz field test: a
// widely imported helper, a byte-identical twin tree, a packaged tool with its
// own manifest/README, and Turkish question words that must not act as terms.
const nextUtils = "import { clsx } from 'clsx';\nexport function cn(...inputs) {\n  return clsx(inputs);\n}\n";
const nextAi =
  "export async function requestQuizFromAi(prompt) {\n  const response = await fetch(process.env.AI_URL, { method: 'POST', body: JSON.stringify({ prompt }) });\n  return response.json();\n}\n";
const nextFiles = [
  { path: 'README.md', content: '# PDF to Online Quiz\nConverts PDF exams into online quizzes.' },
  {
    path: 'package.json',
    content: '{"dependencies":{"next":"16.0.0","react":"19.0.0","@prisma/client":"6.0.0"}}'
  },
  {
    path: 'docs/notes.md',
    content: 'Bu belge için hangi kaynak var, nerede belirt? Kaynak için hangi dosya var nerede?\n'.repeat(20)
  },
  {
    path: 'tools/pnpm/package.json',
    content: JSON.stringify({
      name: 'pnpm',
      bin: { pnpm: 'bin/pnpm.cjs' },
      description: 'Fast, disk space efficient package manager',
      keywords: Array.from({ length: 300 }, (_, i) => `keyword-${i}`)
    })
  },
  { path: 'tools/pnpm/README.md', content: '# pnpm\n' + 'Fast, disk space efficient package manager.\n'.repeat(120) },
  // The scanner skips extensionless LICENSE files, so the tool is recognised by its own bin.
  { path: 'tools/pnpm/bin/pnpm.cjs', content: "#!/usr/bin/env node\nrequire('../dist/pnpm.cjs');\n" },
  { path: 'lib/utils.ts', content: nextUtils },
  {
    path: 'lib/db.ts',
    content: "import { PrismaClient } from '@prisma/client';\nexport const prisma = new PrismaClient();\n"
  },
  { path: 'lib/ai.ts', content: nextAi },
  {
    path: 'app/api/ai/route.ts',
    content:
      "import { requestQuizFromAi } from '../../../lib/ai';\nexport async function POST(request) {\n  const { prompt } = await request.json();\n  return Response.json(await requestQuizFromAi(prompt));\n}\n"
  },
  {
    path: 'app/api/exams/route.ts',
    content:
      "import { prisma } from '../../../lib/db';\nexport async function GET() {\n  return Response.json(await prisma.exam.findMany());\n}\n"
  },
  {
    path: 'prisma/schema.prisma',
    content:
      'model Exam {\n  id String @id\n  title String\n  questions Question[]\n}\nmodel Question {\n  id String @id\n  examId String\n  exam Exam @relation(fields: [examId], references: [id])\n}\n'
  },
  {
    path: 'prisma/migrations/20261007140500_initial/migration.sql',
    content:
      'CREATE TABLE "Exam" ("id" TEXT PRIMARY KEY, "title" TEXT);\nCREATE TABLE "Question" ("id" TEXT PRIMARY KEY, "examId" TEXT);\n'
  },
  ...Array.from({ length: 14 }, (_, i) => ({
    path: `components/ui/widget${i}.tsx`,
    content:
      `import { cn } from '../../lib/utils';\n// Bu bileşen için hangi kaynak var, nerede kullanıldığını belirt; hangi dosyada?\n` +
      `export function Widget${i}(props) {\n  var hangi = props.kaynak;\n` +
      `  const classes = ['flex', 'items-center', 'gap-2', 'rounded-md', 'border', 'px-3', 'py-2'];\n`.repeat(8) +
      `  return <div className={cn('widget', hangi, classes)} />;\n}\n`
  }))
];
const twinFiles = nextFiles
  .filter(file => /^(?:lib|components)\//.test(file.path))
  .map(file => ({ path: `sites-source/${file.path}`, content: file.content }));
const nextSnapshot = { files: [...nextFiles, ...twinFiles], revision: 'c'.repeat(64) };
const nextGraph = {
  status: 'ready',
  revision: nextSnapshot.revision,
  nodes: nextSnapshot.files.map(file => ({ id: file.path, label: file.path, path: file.path, line: 1 })),
  links: [
    { from: 'app/api/ai/route.ts', to: 'lib/ai.ts', kind: 'imports', confidence: 'high' },
    { from: 'app/api/exams/route.ts', to: 'lib/db.ts', kind: 'imports', confidence: 'high' }
  ]
};
const nextCases = [
  [
    'next-database',
    'Veritabanında hangi tablolar var?',
    [['prisma/schema.prisma', 'prisma/migrations/20261007140500_initial/migration.sql']]
  ],
  ['next-ai', 'AI isteği hangi dosyada?', [['lib/ai.ts'], ['app/api/ai/route.ts']]]
];
for (const [name, question, expected] of nextCases)
  for (const mode of ['basic', 'graphify'])
    test(`${name}: ${mode} selects the question's files over hubs, twins and packaged tools`, () => {
      const { context } = retrieveProjectContext(nextSnapshot, question, { mode, graph: nextGraph, budget: 9000 });
      const paths = context.sources.map(source => source.path);
      for (const anyOf of expected)
        assert.ok(
          anyOf.some(file => paths.includes(file)),
          `${name}/${mode}: ${anyOf.join(' | ')} not in ${paths.join(', ')}`
        );
      // A helper imported from everywhere must not outrank the files that answer the question.
      const hub = paths.indexOf('lib/utils.ts');
      for (const anyOf of expected)
        assert.ok(
          hub === -1 || anyOf.some(file => paths.includes(file) && paths.indexOf(file) < hub),
          `${name}/${mode}: hub lib/utils.ts ranked before ${anyOf.join(' | ')}`
        );
      assert.ok(!paths.some(path => path.startsWith('tools/pnpm/')), `${name}/${mode}: packaged tool selected`);
      assert.ok(!paths.some(path => path.startsWith('sites-source/')), `${name}/${mode}: twin copy selected`);
      assert.ok(context.text.length <= 9000);
    });

test('Turkish question scaffolding words are not retrieval terms', () => {
  const { terms } = projectQuery('Bunun için hangi kaynak var, nerede? Kaynağını belirt.');
  for (const word of ['için', 'hangi', 'var', 'nerede', 'belirt', 'kaynak', 'kaynağını', 'bunun'])
    assert.ok(!terms.includes(word), word);
  assert.ok(projectQuery('AI isteği hangi dosyada?').terms.includes('request'));
});

test('citation audit reads Next.js dynamic, catch-all and route group paths whole', () => {
  const context =
    '\n[KAYNAK app/api/exams/[id]/route.ts:1]\n5| export async function GET() {}\n' +
    '\n[KAYNAK app/llm/[[...slug]]/route.js:1]\n3| export const GET = handler;\n' +
    '\n[KAYNAK app/(shop)/@modal/page.tsx:1]\n2| export default Page;\n';
  const answer =
    'Uç nokta `app/api/exams/[id]/route.ts:5`, panel (app/llm/[[...slug]]/route.js:3), ' +
    'grup app/(shop)/@modal/page.tsx:2 ve gösterilmeyen app/api/exams/[id]/route.ts:9.';
  const result = auditProjectCitations(context, answer);
  assert.equal(result.citationCount, 4);
  assert.deepEqual(
    result.invalid.map(item => [item.path, item.unprovidedLines]),
    [['app/api/exams/[id]/route.ts', [9]]]
  );
});
