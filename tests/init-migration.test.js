import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as root from '@sirrakadembasti/llm-manager';

const helpers = ['detectProjectType', 'detectEntryFile', 'formatVerificationReport'];

test('2.0 migration names removed root helpers and supplies an executable scoped replacement', async t => {
  const readme = fs.readFileSync(new URL('../docs/KULLANICI_KILAVUZU.md', import.meta.url), 'utf8');
  assert.match(readme, /2\.0[^\n]*kaldır/);
  for (const name of helpers) assert.ok(readme.includes(`\`${name}\``), `${name} migration is documented`);
  assert.ok(readme.includes('@sirrakadembasti/llm-manager/init'));
  const example = [...readme.matchAll(/```js\r?\n([\s\S]*?)```/g)]
    .map(match => match[1])
    .find(code => helpers.every(name => code.includes(name)));
  assert.ok(example, 'User guide must provide an import example for the synchronous helpers');
  const init = await import(
    `data:text/javascript,${encodeURIComponent(
      example.replace(
        "'@sirrakadembasti/llm-manager/init'",
        JSON.stringify(import.meta.resolve('@sirrakadembasti/llm-manager/init'))
      ) + '\nexport { detectProjectType, detectEntryFile, formatVerificationReport };'
    )}`
  );
  for (const name of helpers) assert.equal(Object.hasOwn(root, name), false, `${name} is absent from root`);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'init-migration-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ type: 'module', dependencies: { express: '^5.0.0' }, main: 'app.js' })
  );
  fs.writeFileSync(path.join(cwd, 'app.js'), '');
  assert.equal(init.detectProjectType(cwd), 'express');
  assert.equal(init.detectEntryFile(cwd, 'express'), 'app.js');
  assert.equal(init.formatVerificationReport({ checks: [{ title: 'Kurulum', ok: true }] }), '✔ Kurulum');
});
