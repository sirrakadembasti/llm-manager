import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import python from '../src/init/templates/python.js';
import { checkSource } from '../src/init/compiler.js';

const interpreter = ['python', 'py'].find(command => spawnSync(command, ['--version'], { timeout: 5000 }).status === 0);

test('Python verification parses real files without pycache and warns in Turkish when unavailable', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-python-'));
  const oldPath = process.env.PATH;
  try {
    fs.writeFileSync(path.join(cwd, 'llm_client.py'), python()['llm_client.py']);
    if (interpreter) {
      assert.equal(checkSource(cwd, 'llm_client.py', []), null);
      assert.equal(fs.existsSync(path.join(cwd, '__pycache__')), false);
      fs.writeFileSync(path.join(cwd, 'llm_client.py'), 'def broken(:');
      assert.match(checkSource(cwd, 'llm_client.py', []), /SyntaxError/);
    }
    process.env.PATH = cwd;
    const warnings = [];
    assert.equal(checkSource(cwd, 'llm_client.py', warnings), null);
    assert.deepEqual(warnings, ['llm_client.py: Python bulunamadı; sözdizimi kontrolü atlandı.']);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test(
  'generated Python preserves HTTP errors and supports env, token, content/text and timeout',
  { skip: !interpreter, timeout: 20000 },
  async () => {
    const requests = [];
    const replies = [
      'not json',
      '[]',
      'null',
      '{}',
      '{"error":"Belirteç geçersiz","code":"AUTH_REQUIRED"}',
      '{"content":"yanıt"}',
      '{"content":"","text":"eski yanıt"}'
    ];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
        res.writeHead(requests.length <= 5 ? 401 : 200, { 'Content-Type': 'application/json' });
        res.end(replies[requests.length - 1]);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const script = `${python()['llm_client.py']}
original_urlopen = urllib.request.urlopen
timeouts = []
def tracked_urlopen(req, timeout):
    timeouts.append(timeout)
    return original_urlopen(req, timeout=timeout)
urllib.request.urlopen = tracked_urlopen
results = []
for i in range(7):
    try:
        results.append({"value": ask_llm("Merhaba", "Kısa")})
    except Exception as error:
        results.append({"type": type(error).__name__, "message": str(error), "code": getattr(error, "code", None), "status": getattr(error, "status", None)})
print(json.dumps({"results": results, "timeouts": timeouts}))
`;
    try {
      const output = await new Promise((resolve, reject) => {
        const child = spawn(interpreter, ['-c', script], {
          env: {
            ...process.env,
            LLM_MANAGER_URL: `http://127.0.0.1:${server.address().port}/custom-chat`,
            LLM_CHAT_TOKEN: 'test-token',
            PYTHONIOENCODING: 'utf-8'
          }
        });
        let stdout = '',
          stderr = '';
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('Python istemcisi zaman aşımına uğradı'));
        }, 10000);
        child.stdout.on('data', chunk => {
          stdout += chunk;
        });
        child.stderr.on('data', chunk => {
          stderr += chunk;
        });
        child.once('error', error => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('close', code => {
          clearTimeout(timer);
          code === 0 ? resolve(stdout) : reject(new Error(stderr));
        });
      });
      const { results, timeouts } = JSON.parse(output);
      for (const result of results.slice(0, 4)) {
        assert.equal(result.type, 'LLMError');
        assert.equal(result.status, 401);
        assert.match(result.message, /LLM isteği başarısız.*401/);
        assert.equal(result.code, null);
      }
      assert.deepEqual(results[4], {
        type: 'LLMError',
        message: 'Belirteç geçersiz',
        code: 'AUTH_REQUIRED',
        status: 401
      });
      assert.deepEqual(results.slice(5), [{ value: 'yanıt' }, { value: 'eski yanıt' }]);
      assert.deepEqual(timeouts, Array(7).fill(330));
      assert.equal(requests.length, 7);
      for (const request of requests) {
        assert.equal(request.url, '/custom-chat');
        assert.equal(request.headers.authorization, 'Bearer test-token');
        assert.equal(request.headers['x-llm-csrf'], '1');
        assert.deepEqual(request.body, { prompt: 'Merhaba', system: 'Kısa' });
      }
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
);
