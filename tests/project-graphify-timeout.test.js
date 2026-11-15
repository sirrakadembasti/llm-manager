import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { projectOptionsFromEnv } from '../src/project/options.js';
import { createProjectAssistant } from '../src/project/index.js';
import * as graphify from '../src/project/graphify.js';

test('Graphify varsayılan süre sınırı gerçek projeler için 5 dakikadır', () => {
  // pdf-to-onlinequiz saha testinde çıkarım 104–132 sn sürdü; eski 120 sn sınırı haritayı düşürüyordu.
  assert.equal(graphify.DEFAULT_GRAPHIFY_TIMEOUT_MS, 300000);
});

test('LLM_GRAPHIFY_TIMEOUT_MS ortamdan okunur; geçersiz veya aralık dışı değer yok sayılır', () => {
  const base = { LLM_PROJECT_ROOT: '.' };
  assert.equal(projectOptionsFromEnv({ ...base, LLM_GRAPHIFY_TIMEOUT_MS: '600000' }, '/x').graphifyTimeoutMs, 600000);
  assert.equal(projectOptionsFromEnv(base, '/x').graphifyTimeoutMs, undefined);
  for (const bad of ['abc', '0', '-5', '999', '3600001', '1.5'])
    assert.equal(
      projectOptionsFromEnv({ ...base, LLM_GRAPHIFY_TIMEOUT_MS: bad }, '/x').graphifyTimeoutMs,
      undefined,
      bad
    );
});

async function slowGraphifyProject(t, delayMs) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-graphify-timeout-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'server.js'), 'export const orders = 1;\n');
  const runner = path.join(os.tmpdir(), `graph-slow-${path.basename(root)}.cjs`);
  t.after(() => fs.rm(runner, { force: true }));
  await fs.writeFile(
    runner,
    `const fs=require('node:fs'),path=require('node:path');
    const args=process.argv.slice(2),out=path.join(args[args.indexOf('--out')+1],'graphify-out');
    setTimeout(()=>{fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'graph.json'),JSON.stringify({nodes:[{id:'orders',label:'orders',source_file:'server.js',source_location:'L1'}],links:[]}));},${delayMs});`
  );
  return { root, graphify: { command: process.execPath, args: [runner] } };
}

test('project.graphifyTimeoutMs Graphify çıkarımının süre sınırını belirler', async t => {
  const { root, graphify: tool } = await slowGraphifyProject(t, 2500);
  const make = graphifyTimeoutMs => {
    const assistant = createProjectAssistant({
      options: { root, graphify: tool, graphifyTimeoutMs },
      ask: async () => ({ text: 'ok' }),
      getActiveProfile: async () => null
    });
    t.after(() => assistant.close());
    return assistant;
  };
  const short = await make(500).handle({ method: 'POST', path: '/project/scan', body: { graphify: true } });
  assert.equal(short.body.graph.status, 'error');
  assert.equal(short.body.graph.code, 'PROJECT_TOOL_TIMEOUT');

  const long = await make(20000).handle({ method: 'POST', path: '/project/scan', body: { graphify: true } });
  assert.equal(long.body.graph.status, 'ready');
});
