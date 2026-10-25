import fs from 'node:fs';
import path from 'node:path';
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
