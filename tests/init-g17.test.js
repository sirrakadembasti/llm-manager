import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { detectEntryFile, initLLMProject, injectIntoEntryFile, runInteractiveInit } from '../src/init.js';

function fixture(run) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g17-'));
  return Promise.resolve()
    .then(() => run(cwd))
    .finally(() => fs.rmSync(cwd, { recursive: true, force: true }));
}

test('Electron TS candidates ignore all build main prefixes', () =>
  fixture(cwd => {
    fs.mkdirSync(path.join(cwd, 'src'));
    fs.writeFileSync(
      path.join(cwd, 'src/main.ts'),
      "import { app } from 'electron';\napp.whenReady().then(() => {\n});\n"
    );
    for (const main of [
      'dist/main.js',
      './dist/main.js',
      '.\\dist\\main.js',
      'build/main.js',
      'out/main.js',
      '.next/main.js',
      'lib/main.js',
      'bundle.min.js'
    ]) {
      const output = main.replaceAll('\\', '/');
      fs.mkdirSync(path.dirname(path.join(cwd, output)), { recursive: true });
      fs.writeFileSync(path.join(cwd, output), '// compiled');
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ main, dependencies: { electron: '*' } }));
      assert.equal(detectEntryFile(cwd, 'electron'), 'src/main.ts');
      assert.equal(fs.readFileSync(path.join(cwd, output), 'utf8'), '// compiled');
    }
    initLLMProject({ cwd, type: 'electron' });
    const result = injectIntoEntryFile({ cwd, type: 'electron', esm: false });
    assert.ok(result.modified);
    assert.match(
      fs.readFileSync(path.join(cwd, 'src/main.ts'), 'utf8'),
      /const \{ registerLLMIpc, askLLM \} = require\('..\/llm.js'\)/
    );
  }));

test('ESM syntax TS host in CommonJS package imports explicit JS helper and compiles', t =>
  fixture(cwd => {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    fs.writeFileSync(path.join(cwd, 'server.ts'), "import express from 'express';\nconst app = express();\n");
    initLLMProject({ cwd, type: 'express' });
    const explicit = injectIntoEntryFile({ cwd, type: 'express', esm: false });
    assert.match(fs.readFileSync(path.join(cwd, 'server.ts'), 'utf8'), /require\('.\/llm.js'\)/);
    const target = path.join(cwd, 'node_modules');
    fs.symlinkSync(path.resolve('node_modules'), target, 'junction');
    const compiler = path.resolve('node_modules/typescript/bin/tsc');
    fs.writeFileSync(
      path.join(cwd, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          allowJs: true,
          checkJs: false,
          skipLibCheck: true,
          noEmit: true,
          strict: false
        },
        include: ['server.ts', 'llm.js', 'node-globals.d.ts']
      })
    );
    // This repository has no @types/node; model the require global provided by a Node host.
    fs.writeFileSync(path.join(cwd, 'node-globals.d.ts'), 'declare function require(id: string): any;\n');
    const compile = phase => {
      const startedAt = Date.now();
      try {
        execFileSync(process.execPath, [compiler, '-p', cwd], { stdio: 'pipe', timeout: 30000 });
      } catch (error) {
        const details = {
          phase,
          elapsedMs: Date.now() - startedAt,
          executable: process.execPath,
          args: [compiler, '-p', cwd],
          code: error.code,
          status: error.status,
          signal: error.signal,
          pid: error.pid,
          killed: error.killed,
          message: error.message
        };
        throw new Error(
          `TypeScript compilation failed: ${JSON.stringify(details)}\nstdout:\n${String(error.stdout ?? '')}\nstderr:\n${String(error.stderr ?? '')}`,
          { cause: error }
        );
      }
      t.diagnostic(`TypeScript compilation ${phase} completed in ${Date.now() - startedAt}ms`);
    };
    compile('explicit CommonJS');
    explicit.rollback();
    injectIntoEntryFile({ cwd, type: 'express' });
    assert.match(
      fs.readFileSync(path.join(cwd, 'server.ts'), 'utf8'),
      /import \{ setupLLM, askLLM \} from '.\/llm.js'/
    );
    fs.unlinkSync(path.join(cwd, 'node-globals.d.ts'));
    compile('inferred ESM');
  }));

test('unknown and ambiguous projects give Turkish explicit-type guidance', () =>
  fixture(async cwd => {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    await assert.rejects(
      runInteractiveInit({
        installRunner() {
          assert.fail('Unexpected network installer');
        },
        cwd,
        yes: true
      }),
      /Proje.*--type/
    );
    fs.writeFileSync(path.join(cwd, 'App.csproj'), '<Project />');
    await assert.rejects(
      runInteractiveInit({
        installRunner() {
          assert.fail('Unexpected network installer');
        },
        cwd,
        yes: true
      }),
      /Node ve \.NET birlikte bulundu: --type/
    );
    for (const choice of ['node', 'dotnet']) {
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: { express: '*' } }));
      const logs = [];
      let inspected = false;
      const result = await runInteractiveInit({
        installRunner() {
          assert.fail('Unexpected network installer');
        },
        cwd,
        askQuestion: question => {
          if (question.includes('Node veya')) return choice;
          if (question.includes('Paket projeye')) return 'h';
          if (question.includes('Yapılan eklemeleri')) {
            assert.equal(fs.existsSync(path.join(cwd, 'LlmClient.cs')), choice === 'dotnet');
            assert.equal(fs.existsSync(path.join(cwd, 'llm.js')), choice === 'node');
            inspected = true;
            return 'h';
          }
          return 'e';
        },
        logger: line => logs.push(line)
      });
      assert.equal(inspected, true);
      assert.equal(result.rolledBack, true);
      assert.ok(logs.some(line => line.includes(`Algılanan senaryo: ${choice === 'node' ? 'express' : 'dotnet'}`)));
    }
  }));

test('CLI help only advertises supported framework types', () => {
  const help = execFileSync(process.execPath, ['bin/llm-manager.js', '--help'], { encoding: 'utf8' });
  assert.doesNotMatch(help, /\| manual/);
});

test('wizard infers TS ESM syntax without changing the CommonJS helper format', () =>
  fixture(async cwd => {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: { express: '*' } }));
    const host = "import express from 'express';\nconst app = express();\n";
    fs.writeFileSync(path.join(cwd, 'server.ts'), host);
    let inspected = false;
    const result = await runInteractiveInit({
      installRunner() {
        assert.fail('Unexpected network installer');
      },
      cwd,
      logger: () => {},
      askQuestion: question => {
        if (question.includes('Paket projeye')) return 'h';
        if (question.includes('Yapılan eklemeleri')) {
          assert.match(fs.readFileSync(path.join(cwd, 'server.ts'), 'utf8'), /from '.\/llm.js'/);
          assert.match(fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8'), /module.exports/);
          inspected = true;
          return 'h';
        }
        return 'e';
      }
    });
    assert.equal(inspected, true);
    assert.equal(result.rolledBack, true);
    assert.equal(fs.readFileSync(path.join(cwd, 'server.ts'), 'utf8'), host);
  }));
