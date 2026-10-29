// Optional local engine acceptance. Uses synthetic source and credentials only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { createProjectWorkspace } from '../src/project/workspace.js';
import { createProjectRelay } from '../src/project/relay.js';
import { runOpenCode } from '../src/project/opencode.js';

const files = [
  { path: 'app.js', content: 'export const value = 1;\n' },
  { path: 'db/schema.sql', content: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, total NUMERIC NOT NULL);\n' }
];
const workspace = await createProjectWorkspace(files);
let relay;
let requests = 0;
const upstream = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  requests++;
  const outputs = (body.messages || []).filter(m => m.role === 'tool');
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const emit = (delta, finish = null) =>
    res.write(
      'data: ' +
        JSON.stringify({
          id: 'chatcmpl-fixture',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'fixture-tool-model',
          choices: [{ index: 0, delta, finish_reason: finish }]
        }) +
        '\n\n'
    );
  if (outputs.length < 2) {
    const name = outputs.length === 0 ? 'read' : 'edit';
    const args =
      name === 'read'
        ? { filePath: path.join(workspace.root, 'app.js') }
        : { filePath: path.join(workspace.root, 'app.js'), oldString: 'value = 1', newString: 'value = 2' };
    emit({
      role: 'assistant',
      tool_calls: [
        { index: 0, id: 'call_' + requests, type: 'function', function: { name, arguments: JSON.stringify(args) } }
      ]
    });
    emit({}, 'tool_calls');
  } else {
    emit({ role: 'assistant', content: 'app.js:1 güncellendi.' });
    emit({}, 'stop');
  }
  res.end('data: [DONE]\n\n');
});
upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
try {
  const profile = {
    id: 'fixture',
    provider: 'custom',
    model: 'fixture-tool-model',
    apiKey: 'synthetic-original-key-for-acceptance',
    baseURL: `http://127.0.0.1:${upstream.address().port}/v1`,
    timeoutMs: 120000,
    maxOutputTokens: 512
  };
  relay = await createProjectRelay({ profile, networkOptions: { allowLocalHttp: true, proxyUrl: '' } });
  const result = await runOpenCode({
    workspace,
    relay,
    prompt: 'app.js içindeki değeri iki yap.',
    mode: 'change',
    command: process.env.LLM_OPENCODE_PATH
  });
  assert.match(await fs.readFile(path.join(workspace.root, 'app.js'), 'utf8'), /value = 2/);
  assert.match(result.content, /app\.js:1/);
  let matches = 0;
  async function audit(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory()) await audit(file);
      else if ((await fs.readFile(file)).includes(Buffer.from(profile.apiKey))) matches++;
    }
  }
  await audit(workspace.directory);
  assert.equal(matches, 0);
  console.log(
    JSON.stringify({
      engine: result.version,
      readAndEdit: true,
      providerRequests: requests,
      originalKeyPersisted: false
    })
  );
} catch (error) {
  console.error(JSON.stringify({ acceptance: 'failed', code: error.code || error.name, providerRequests: requests }));
  throw error;
} finally {
  await relay?.close();
  upstream.closeAllConnections();
  await new Promise(resolve => upstream.close(resolve));
  await workspace.dispose();
}
