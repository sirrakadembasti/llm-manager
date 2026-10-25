import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
export function packageInstalled(cwd, name) {
  return fs.existsSync(path.join(cwd, 'node_modules', ...name.split('/'), 'package.json'));
}
export function checkSource(cwd, rel, warnings) {
  const full = path.join(cwd, rel);
  const ext = path.extname(rel);
  const run = (command, args) => {
    try {
      execFileSync(command, args, { cwd, stdio: 'pipe', timeout: 120000 });
      return null;
    } catch (error) {
      return String((error.stderr?.length ? error.stderr : error.stdout) || error.message).trim();
    }
  };
  if (['.js', '.mjs', '.cjs'].includes(ext)) return run(process.execPath, ['--check', full]);
  if (ext === '.py') {
    for (const command of ['python', 'py']) {
      try {
        execFileSync(command, ['--version'], { stdio: 'pipe', timeout: 5000 });
      } catch {
        continue;
      }
      // compile() performs the same parser check as py_compile without leaving __pycache__ artifacts.
      return run(command, [
        '-c',
        'import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_bytes(),str(p),"exec")',
        full
      ]);
    }
    warnings.push(`${rel}: Python unavailable; syntax was not verified.`);
    return null;
  }
  if (ext === '.cs') {
    if (path.basename(rel) !== 'LlmClient.cs') {
      warnings.push(`${rel}: Host C# dosyası proje bağlamı ve bağımlılıkları gerektirir; derleme kontrolü atlandı.`);
      return null;
    }
    let version;
    try {
      version = execFileSync('dotnet', ['--list-sdks'], { encoding: 'utf8', timeout: 10000 })
        .split(/\r?\n/)
        .map(line => line.match(/^(\d+)\.\d+\.\d+/)?.[0])
        .filter(Boolean)
        .sort((a, b) => Number(b.split('.')[0]) - Number(a.split('.')[0]))[0];
    } catch {
      /* SDK absence is reported below. */
    }
    if (!version) {
      warnings.push(`${rel}: .NET SDK bulunamadı; derleme kontrolü atlandı.`);
      return null;
    }
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-csharp-'));
    try {
      const major = Number(version.split('.')[0]);
      const target = major >= 5 ? `net${major}.0` : `netcoreapp${version.split('.').slice(0, 2).join('.')}`;
      fs.copyFileSync(full, path.join(temp, 'LlmClient.cs'));
      fs.writeFileSync(path.join(temp, 'global.json'), JSON.stringify({ sdk: { version } }));
      fs.writeFileSync(
        path.join(temp, 'NuGet.Config'),
        '<configuration><packageSources><clear /></packageSources></configuration>'
      );
      fs.writeFileSync(
        path.join(temp, 'Check.csproj'),
        `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>${target}</TargetFramework><LangVersion>7.3</LangVersion><EnableNETAnalyzers>false</EnableNETAnalyzers></PropertyGroup></Project>`
      );
      execFileSync('dotnet', ['build', 'Check.csproj', '--nologo', '--configfile', 'NuGet.Config'], {
        cwd: temp,
        stdio: 'pipe',
        timeout: 120000,
        env: {
          ...process.env,
          DOTNET_CLI_HOME: path.join(temp, 'home'),
          NUGET_PACKAGES: path.join(temp, 'packages'),
          DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
          DOTNET_CLI_TELEMETRY_OPTOUT: '1',
          DOTNET_NOLOGO: '1'
        }
      });
      return null;
    } catch (error) {
      return String((error.stdout?.length ? error.stdout : error.stderr) || error.message).trim();
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
  const local = createRequire(path.join(cwd, 'package.json'));
  if (['.ts', '.tsx', '.jsx'].includes(ext)) {
    try {
      const ts = local('typescript');
      if (!ts.transpileModule) {
        const metaPath = local.resolve('typescript/package.json');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const bin = path.join(path.dirname(metaPath), typeof meta.bin === 'string' ? meta.bin : meta.bin.tsc);
        return run(process.execPath, [
          bin,
          '--noCheck',
          '--noEmit',
          '--jsx',
          'preserve',
          '--allowJs',
          ...(Number(meta.version.split('.')[0]) >= 6 ? ['--ignoreConfig'] : []),
          full
        ]);
      }
      const result = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
        fileName: rel,
        reportDiagnostics: true,
        compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext }
      });
      return (
        result.diagnostics
          ?.filter(d => d.category === ts.DiagnosticCategory.Error)
          .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
          .join('\n') || null
      );
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') return error.message;
    }
  }
  if (ext === '.vue' || ext === '.svelte') {
    try {
      if (ext === '.vue') {
        const c = local('@vue/compiler-sfc');
        const parsed = c.parse(fs.readFileSync(full, 'utf8'));
        if (parsed.errors.length) return parsed.errors.join('\n');
        if (parsed.descriptor.script || parsed.descriptor.scriptSetup)
          c.compileScript(parsed.descriptor, { id: 'llm-verify' });
      } else local('svelte/compiler').compile(fs.readFileSync(full, 'utf8'), { filename: rel });
      return null;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') return error.message;
    }
  }
  warnings.push(`${rel}: compiler unavailable; syntax was not verified.`);
  return null;
}
