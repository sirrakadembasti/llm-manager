import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectWorkspace } from '../src/project/workspace.js';
const { runOpenCode } = await import('../src/project/opencode.js').catch(() => ({}));

async function fixture(t, mode = 'change') {
  assert.equal(typeof runOpenCode, 'function');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-opencode-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'engine.cjs');
  await fs.writeFile(
    script,
    `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const cfg=JSON.parse(process.env.OPENCODE_CONFIG_CONTENT);
    if (Object.keys(process.env).some(k=>k.startsWith('LLM_'))) process.exit(3);
    if(cfg.permission.bash!=='deny'||cfg.permission.external_directory!=='deny'||!process.env.OPENCODE_DISABLE_EXTERNAL_SKILLS)process.exit(4);
    const port=Number(process.argv.find(a=>a.startsWith('--port=')).split('=')[1]);
    const server=http.createServer(async(req,res)=>{
      res.setHeader('Content-Type','application/json');
      if(req.headers.authorization!=='Basic '+Buffer.from('opencode:'+process.env.OPENCODE_SERVER_PASSWORD).toString('base64')){res.writeHead(401);res.end('{}');return;}
      if(req.url.startsWith('/global/health')){res.end(JSON.stringify({healthy:true,version:'1.18.33'}));return;}
      if(req.url==='/session'){res.end(JSON.stringify({id:'ses_fixture'}));return;}
      if(req.url.includes('/message')){
        let raw='';for await(const b of req)raw+=b;
        const body=JSON.parse(raw);if(body.model.providerID!=='active')process.exit(5);
        if(cfg.permission.edit==='allow')fs.writeFileSync(path.join(process.cwd(),'app.js'),'export const value=2;');
        res.end(JSON.stringify({info:{id:'msg_fixture'},parts:[{type:'text',text:'Kaynak: app.js:1'}]}));return;
      }
      res.writeHead(404);res.end('{}');
    });
    server.listen(port,'127.0.0.1',()=>console.log('opencode server listening on http://127.0.0.1:'+port));
  `
  );
  const workspace = await createProjectWorkspace([{ path: 'app.js', content: 'export const value=1;' }]);
  t.after(() => workspace.dispose());
  return {
    command: process.execPath,
    args: [script],
    workspace,
    mode,
    relay: { provider: { models: { fixture: {} } }, model: 'fixture' },
    prompt: 'Değeri iki yap'
  };
}

test('OpenCode adapter runs a private authenticated engine against a staging workspace', async t => {
  const options = await fixture(t);
  const result = await runOpenCode(options);
  assert.match(result.content, /app\.js:1/);
  assert.equal(result.version, '1.18.33');
  assert.equal(await fs.readFile(path.join(options.workspace.root, 'app.js'), 'utf8'), 'export const value=2;');
});

test('OpenCode plan mode denies edit tools', async t => {
  const options = await fixture(t, 'plan');
  await runOpenCode(options);
  assert.equal(await fs.readFile(path.join(options.workspace.root, 'app.js'), 'utf8'), 'export const value=1;');
});

test('OpenCode adapter reports a missing executable without invoking a shell', async t => {
  const options = await fixture(t);
  await assert.rejects(runOpenCode({ ...options, command: 'llm-manager-no-such-engine' }), {
    code: 'PROJECT_ENGINE_UNAVAILABLE'
  });
});
