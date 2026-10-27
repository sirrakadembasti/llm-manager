import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initLLMProject } from '../src/init.js';

const execute = promisify(execFile);
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-g14-legacy-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

for (const [name, xml, references, compileCount] of [
  [
    'SDK net48 implicit compile',
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net48</TargetFramework></PropertyGroup></Project>',
    ['System.Net.Http', 'System.Runtime.Serialization'],
    0
  ],
  [
    'already registered v4.8 helper',
    '<Project><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup><ItemGroup><Compile Include="LlmClient.cs" /></ItemGroup></Project>',
    ['System.Net.Http', 'System.Runtime.Serialization'],
    1
  ],
  [
    'v4.0 helper',
    '<Project><PropertyGroup><TargetFrameworkVersion>v4.0</TargetFrameworkVersion></PropertyGroup><ItemGroup><Compile Include="Program.cs" /></ItemGroup></Project>',
    ['System', 'System.Runtime.Serialization', 'System.Xml'],
    1
  ],
  [
    'SDK net40 implicit compile',
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net40</TargetFramework></PropertyGroup></Project>',
    ['System', 'System.Runtime.Serialization', 'System.Xml'],
    0
  ],
  [
    'SDK net48 explicit other source',
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net48</TargetFramework></PropertyGroup><ItemGroup><Compile Include="../Other.cs" /></ItemGroup></Project>',
    ['System.Net.Http', 'System.Runtime.Serialization'],
    0
  ],
  [
    'qualified single-quoted references',
    "<Project><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup><ItemGroup><Compile Include='LlmClient.cs' /><Reference Include='System.Net.Http, Version=4.0.0.0, Culture=neutral' /><Reference Include='System.Runtime.Serialization' /></ItemGroup></Project>",
    ['System.Net.Http', 'System.Runtime.Serialization'],
    1
  ],
  [
    'SDK disabled implicit compile',
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net48</TargetFramework><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs" /></ItemGroup></Project>',
    ['System.Net.Http', 'System.Runtime.Serialization'],
    1
  ]
]) {
  test(`G14 reconciles references independently for ${name}, idempotently with byte-exact rollback`, t => {
    const cwd = fixture(t);
    const project = path.join(cwd, 'App.csproj');
    const before = Buffer.from('\uFEFF' + xml.replaceAll('><', '>\r\n<') + '\r\n');
    fs.writeFileSync(project, before);
    const existingHelper =
      name === 'already registered v4.8 helper' ? Buffer.from('// kullanıcı yardımcısı\r\n') : null;
    if (existingHelper) fs.writeFileSync(path.join(cwd, 'LlmClient.cs'), existingHelper);
    const result = initLLMProject({ cwd, type: 'dotnet' });
    const content = fs.readFileSync(project, 'utf8');
    const registered = [...content.matchAll(/<Reference\s+Include=["']([^"']+)/g)].map(match => match[1].split(',')[0]);
    for (const reference of references)
      assert.equal(registered.filter(name => name === reference).length, 1, reference);
    assert.equal((content.match(/Compile Include=["']LlmClient.cs["']/g) || []).length, compileCount);
    if (name.includes('4.0') || name.includes('net40')) assert.ok(!content.includes('System.Net.Http'));
    const second = initLLMProject({ cwd, type: 'dotnet' });
    assert.equal(fs.readFileSync(project, 'utf8'), content);
    second.journal.rollback();
    result.journal.rollback();
    assert.deepEqual(fs.readFileSync(project), before);
    if (existingHelper) assert.deepEqual(fs.readFileSync(path.join(cwd, 'LlmClient.cs')), existingHelper);
    assert.deepEqual(fs.readdirSync(cwd), existingHelper ? ['App.csproj', 'LlmClient.cs'] : ['App.csproj']);
  });
}

test('G14 v4.0 and net40 clients compile against actual .NET 4.0 references and run HTTP cancellation', async t => {
  const refs = path.join(
    process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)',
    'Reference Assemblies/Microsoft/Framework/.NETFramework/v4.0'
  );
  const compiler = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework/v4.0.30319/csc.exe');
  if (!fs.existsSync(path.join(refs, 'mscorlib.dll')) || !fs.existsSync(compiler))
    return t.skip('.NET 4.0 reference assemblies/compiler not installed');
  for (const targetXml of [
    '<TargetFrameworkVersion>v4.0</TargetFrameworkVersion>',
    '<TargetFramework>net40</TargetFramework>',
    '<TargetFrameworks>net8.0; net40</TargetFrameworks>',
    ''
  ]) {
    const cwd = fixture(t);
    fs.writeFileSync(
      path.join(cwd, 'App.csproj'),
      `<Project><PropertyGroup>${targetXml}</PropertyGroup><ItemGroup><Compile Include="Program.cs" /></ItemGroup></Project>`
    );
    if (!targetXml) for (const name of ['Web.config', 'Global.asax']) fs.writeFileSync(path.join(cwd, name), '');
    assert.equal(initLLMProject({ cwd, type: 'dotnet' }).targetFamily, 'netfx');
    fs.writeFileSync(
      path.join(cwd, 'Program.cs'),
      `using System;
using System.Threading;
using System.Threading.Tasks;
using LlmManager;
class Program {
 static void Main() {
  Console.OutputEncoding = System.Text.Encoding.UTF8;
  foreach (var prompt in new[]{"content", "text", "invalid", "null", "failure", "error", "cancel", "headers", "body"}) {
   using (var cancel = new CancellationTokenSource()) {
    if (prompt == "cancel") cancel.Cancel();
    using (var timer = new Timer(delegate { cancel.Cancel(); }, null, prompt == "headers" || prompt == "body" ? 500 : -1, -1)) {
     var elapsed = System.Diagnostics.Stopwatch.StartNew();
     Console.WriteLine("phase:ask:start prompt:" + prompt);
     var task = LlmClient.AskAsync(prompt, "sistem şğ", cancel.Token);
     Console.WriteLine("phase:ask:wait prompt:" + prompt + " elapsedMs:" + elapsed.ElapsedMilliseconds);
     var cancellationCase = prompt == "cancel" || prompt == "headers" || prompt == "body";
     var waitMs = cancellationCase ? 5000 : 20000;
     try {
      if (!task.Wait(waitMs)) throw new Exception("AskAsync did not complete within test bound; prompt:" + prompt + " phase:wait boundMs:" + waitMs + " elapsedMs:" + elapsed.ElapsedMilliseconds + " taskStatus:" + task.Status + " cancellationRequested:" + cancel.IsCancellationRequested);
      Console.WriteLine(prompt + ":" + task.Result);
     } catch (AggregateException error) {
      var cause = error.InnerException;
      Console.WriteLine(prompt + ":" + cause.GetType().Name + ":" + cause.Message + ":" + task.Status);
     }
     Console.WriteLine("phase:ask:completed prompt:" + prompt + " elapsedMs:" + elapsed.ElapsedMilliseconds);
    }
   }
  }
 }
}`
    );
    try {
      await execute(
        compiler,
        [
          '/nologo',
          '/noconfig',
          '/nostdlib+',
          '/langversion:4',
          '/target:exe',
          '/out:Run.exe',
          ...['mscorlib', 'System', 'System.Core', 'System.Runtime.Serialization', 'System.Xml'].map(
            name => `/reference:${path.join(refs, name + '.dll')}`
          ),
          'LlmClient.cs',
          'Program.cs'
        ],
        { cwd, timeout: 30000 }
      );
    } catch (error) {
      throw new Error(error.stdout || error.message, { cause: error });
    }
    const requests = [];
    const timings = [];
    let runStartedAt;
    const server = http.createServer(async (req, res) => {
      const timing = { arrivedMs: Date.now() - runStartedAt };
      timings.push(timing);
      res.on('finish', () => {
        timing.responseFinishedMs = Date.now() - runStartedAt;
      });
      res.on('close', () => {
        timing.closedMs = Date.now() - runStartedAt;
      });
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      timing.prompt = data.prompt;
      timing.bodyReadMs = Date.now() - runStartedAt;
      requests.push({ data, token: req.headers.authorization, csrf: req.headers['x-llm-csrf'] });
      if (data.prompt === 'headers') return;
      if (data.prompt === 'body') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': 100 });
        res.write('{');
        return;
      }
      res.statusCode = ['failure', 'error'].includes(data.prompt) ? 503 : 200;
      res.end(
        {
          content: '{"content":"yanıt"}',
          text: '{"text":"metin"}',
          invalid: 'not-json',
          null: 'null',
          failure: '{}',
          error: '{"error":"sunucu hatası"}'
        }[data.prompt]
      );
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      runStartedAt = Date.now();
      const result = await execute(path.join(cwd, 'Run.exe'), [], {
        cwd,
        timeout: 30000,
        env: {
          ...process.env,
          LLM_MANAGER_URL: `http://127.0.0.1:${server.address().port}/api/llm/chat`,
          LLM_CHAT_TOKEN: 'legacy-token'
        }
      });
      t.diagnostic(`Legacy target ${targetXml || 'implicit netfx'} stdout:\n${result.stdout}`);
      assert.match(result.stdout, /content:yanıt/);
      assert.match(result.stdout, /text:metin/);
      assert.match(result.stdout, /invalid:InvalidOperationException:LLM sunucusu geçersiz JSON döndürdü \(HTTP 200\)/);
      assert.match(result.stdout, /null:InvalidOperationException:LLM sunucusu boş JSON yanıtı döndürdü \(HTTP 200\)/);
      assert.match(result.stdout, /failure:InvalidOperationException:LLM isteği başarısız \(HTTP 503\)/);
      assert.match(result.stdout, /error:InvalidOperationException:sunucu hatası/);
      for (const prompt of ['cancel', 'headers', 'body'])
        assert.match(result.stdout, new RegExp(`${prompt}:TaskCanceledException:.*:Canceled`));
      assert.equal(requests.length, 8);
      assert.ok(
        requests.every(r => r.token === 'Bearer legacy-token' && r.csrf === '1' && r.data.system === 'sistem şğ')
      );
    } catch (error) {
      throw new Error(
        `Legacy target ${targetXml || 'implicit netfx'} failed: ${error.message}\nstdout:\n${error.stdout || ''}\nstderr:\n${error.stderr || ''}`,
        { cause: error }
      );
    } finally {
      t.diagnostic(`Legacy target ${targetXml || 'implicit netfx'} server timings: ${JSON.stringify(timings)}`);
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});
