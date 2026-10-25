import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initLLMProject } from '../src/init.js';
import { checkSource } from '../src/init/compiler.js';
import http from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-g14-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
test('G14 classifies modern and legacy frameworks including Web Forms fallback', t => {
  for (const [xml, family, target] of [
    ['<TargetFramework>net8.0</TargetFramework>', 'modern', 'net8.0'],
    ['<TargetFramework>netcoreapp3.1</TargetFramework>', 'modern', 'netcoreapp3.1'],
    ['<TargetFrameworkVersion>v4.8</TargetFrameworkVersion>', 'netfx', 'v4.8'],
    ['<TargetFramework>net48</TargetFramework>', 'netfx', 'net48'],
    ['', 'netfx', '.NET Framework 4.x']
  ]) {
    const cwd = fixture(t);
    if (xml) fs.writeFileSync(path.join(cwd, 'App.csproj'), `<Project>${xml}</Project>`);
    else for (const name of ['Web.config', 'Global.asax']) fs.writeFileSync(path.join(cwd, name), '');
    const result = initLLMProject({ cwd, type: 'dotnet' });
    assert.equal(result.targetFamily, family);
    assert.equal(result.targetFramework, target);
  }
});
test('G14 C# host source is explicitly skipped with project context explanation', t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'Program.cs'), 'var builder = WebApplication.CreateBuilder(args);');
  const warnings = [];
  assert.equal(checkSource(cwd, 'Program.cs', warnings), null);
  assert.match(warnings.join('\n'), /proje bağlamı/);
  assert.doesNotMatch(warnings.join('\n'), /unavailable/);
});
test('G14 generated helper compiler detects real C# errors when SDK is installed', t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'LlmClient.cs'), 'this is invalid C#;');
  const warnings = [];
  const error = checkSource(cwd, 'LlmClient.cs', warnings);
  if (warnings.some(w => w.includes('SDK bulunamadı'))) return t.skip('dotnet SDK bulunamadı');
  assert.match(error || '', /error CS/);
});
test('G14 generated C# client builds offline and handles HTTP JSON, Turkish errors and cancellation', async t => {
  let version;
  try {
    version = execFileSync('dotnet', ['--list-sdks'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.match(/^\d+\.\d+\.\d+/)?.[0])
      .filter(Boolean)
      .sort((a, b) => Number(b.split('.')[0]) - Number(a.split('.')[0]))[0];
  } catch {}
  if (!version) return t.skip('.NET SDK bulunamadı');
  const major = Number(version.split('.')[0]);
  const target = major >= 5 ? `net${major}.0` : `netcoreapp${version.split('.').slice(0, 2).join('.')}`;
  const cwd = fixture(t);
  initLLMProject({ cwd, type: 'dotnet' });
  fs.writeFileSync(path.join(cwd, 'global.json'), JSON.stringify({ sdk: { version } }));
  fs.writeFileSync(
    path.join(cwd, 'NuGet.Config'),
    '<configuration><packageSources><clear /></packageSources></configuration>'
  );
  fs.writeFileSync(
    path.join(cwd, 'Run.csproj'),
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${target}</TargetFramework><LangVersion>7.3</LangVersion></PropertyGroup></Project>`
  );
  fs.writeFileSync(
    path.join(cwd, 'Program.cs'),
    `using System;
using System.Threading;
using System.Threading.Tasks;
using LlmManager;
class Program {
 static async Task Main() {
  foreach(var prompt in new[]{"content","text","invalid","null","failure","cancel"}) {
   try {
    var token = prompt == "cancel" ? new CancellationToken(true) : CancellationToken.None;
    Console.WriteLine(prompt + ":" + await LlmClient.AskAsync(prompt, "sistem", token));
   } catch(Exception error) { Console.WriteLine(prompt + ":" + error.GetType().Name + ":" + error.Message); }
  }
 }
}`
  );
  const env = {
    ...process.env,
    DOTNET_CLI_HOME: path.join(cwd, 'home'),
    NUGET_PACKAGES: path.join(cwd, 'packages'),
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1'
  };
  await execute('dotnet', ['build', 'Run.csproj', '--nologo', '--configfile', 'NuGet.Config'], {
    cwd,
    env,
    timeout: 120000
  });
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    requests.push({ data, token: req.headers.authorization, csrf: req.headers['x-llm-csrf'] });
    res.setHeader('Content-Type', 'application/json');
    if (data.prompt === 'failure') res.statusCode = 503;
    res.end(
      { content: '{"content":"yanıt"}', text: '{"text":"metin"}', invalid: 'not-json', null: 'null', failure: '{}' }[
        data.prompt
      ]
    );
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const result = await execute('dotnet', [path.join(cwd, 'bin', 'Debug', target, 'Run.dll')], {
    cwd,
    env: {
      ...env,
      LLM_MANAGER_URL: `http://127.0.0.1:${server.address().port}/api/llm/chat`,
      LLM_CHAT_TOKEN: 'test-token'
    },
    timeout: 30000
  });
  assert.match(result.stdout, /content:yanıt/);
  assert.match(result.stdout, /text:metin/);
  assert.match(result.stdout, /invalid:InvalidOperationException:LLM sunucusu geçersiz JSON döndürdü \(HTTP 200\)/);
  assert.match(result.stdout, /null:InvalidOperationException:LLM sunucusu boş JSON yanıtı döndürdü \(HTTP 200\)/);
  assert.match(result.stdout, /failure:InvalidOperationException:LLM isteği başarısız \(HTTP 503\)/);
  assert.match(result.stdout, /cancel:TaskCanceledException/);
  assert.equal(requests.length, 5);
  assert.ok(requests.every(r => r.token === 'Bearer test-token' && r.csrf === '1' && r.data.system === 'sistem'));
  const source = fs.readFileSync(path.join(cwd, 'LlmClient.cs'), 'utf8');
  assert.match(source, /TimeSpan.FromSeconds\(330\)/);
  assert.doesNotMatch(source, /using var|System.Text.Json/);
});
