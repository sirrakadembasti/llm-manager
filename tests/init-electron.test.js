import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import electron from '../src/init/templates/electron.js';
import { initLLMProject } from '../src/init.js';

function loadHelper() {
  let ready = false;
  const managers = [],
    asks = [],
    servers = [];
  const app = {
    isReady: () => ready,
    whenReady: async () => {
      ready = true;
    },
    getPath: name => {
      assert.equal(name, 'userData');
      return '/user/data';
    }
  };
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = handler => {
        this.popup = handler;
      };
    }
    async loadURL(url) {
      this.url = url;
    }
    destroy() {
      this.emit('closed');
    }
  }
  const dependencies = {
    electron: { app, BrowserWindow },
    'pkg/core': {
      createLLMManager(options) {
        managers.push(options);
        return {
          ask: (...args) => {
            asks.push(args);
            return 'answer';
          }
        };
      }
    },
    'pkg/server': {
      async createStandaloneServer(options) {
        const server = { options, closed: 0 };
        servers.push(server);
        return { url: 'http://127.0.0.1:43123/llm', server: { close: () => server.closed++ } };
      }
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(electron({ PKG: 'pkg', esm: false })['llm.js'], {
    module,
    URL,
    require: name => dependencies[name] || createRequire(import.meta.url)(name)
  });
  return {
    helper: module.exports,
    managers,
    asks,
    servers,
    ready: () => {
      ready = true;
    }
  };
}

function challenge(window, url, overrides = {}) {
  let prevented = false,
    credentials;
  window.webContents.emit(
    'login',
    {
      preventDefault() {
        prevented = true;
      }
    },
    { url },
    { isProxy: false, scheme: 'basic', host: '127.0.0.1', port: 43123, ...overrides },
    (...args) => {
      credentials = args;
    }
  );
  assert.equal(prevented, true);
  return credentials;
}

test('generated Electron panel authenticates only its own loopback Basic challenge', async () => {
  const { helper, servers } = loadHelper();
  const window = await helper.openLLMPanel();
  assert.deepEqual(challenge(window, window.url), ['admin', servers[0].options.adminPassword]);
  for (const [url, auth] of [
    ['https://external.invalid/', {}],
    [window.url, { isProxy: true }],
    [window.url, { scheme: 'digest' }],
    [window.url, { host: 'external.invalid' }],
    [window.url, { port: 80 }],
    [window.url, { isProxy: undefined }],
    ['https://127.0.0.1:43123/llm', {}],
    ['http://localhost:43123/llm', {}],
    ['http://127.0.0.1:43124/llm', {}],
    ['invalid', {}]
  ])
    assert.deepEqual(challenge(window, url, auth), [], url + JSON.stringify(auth));
  assert.equal(servers[0].options.host, '127.0.0.1');
  assert.equal(servers[0].options.port, 0);
  assert.equal(new URL(window.url).password, '');
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(new window.constructor({}).webContents.listenerCount('login'), 0);
  window.emit('closed');
  assert.equal(servers[0].closed, 1);
});

test('generated panel blocks external navigation, redirects and new windows', async () => {
  const { helper } = loadHelper();
  const window = await helper.openLLMPanel();
  for (const name of ['will-navigate', 'will-redirect']) {
    for (const [url, expected] of [
      [window.url, false],
      ['http://127.0.0.1:43123/llm/profiles', false],
      ['https://external.invalid/', true],
      ['invalid', true]
    ]) {
      let blocked = false;
      window.webContents.emit(
        name,
        {
          preventDefault() {
            blocked = true;
          }
        },
        url
      );
      assert.equal(blocked, expected, name + url);
      blocked = false;
      window.webContents.emit(name, {
        url,
        preventDefault() {
          blocked = true;
        }
      });
      assert.equal(blocked, expected, name + ' details.url ' + url);
    }
  }
  assert.equal(window.popup({ url: 'https://external.invalid/' }).action, 'deny');
});

test('generated helper is lazy, uses userData and filters renderer options at runtime', async () => {
  const { helper, managers, asks, ready } = loadHelper();
  assert.equal(managers.length, 0);
  await assert.rejects(helper.askLLM('early'), /app.whenReady\(\).*sonra/);
  assert.equal(managers.length, 0);
  ready();
  let handler;
  helper.registerLLMIpc({
    handle(name, callback) {
      assert.equal(name, 'llm:ask');
      handler = callback;
    }
  });
  await handler({}, 'hello', { system: 'safe', profileId: 'admin', timeoutMs: 1 });
  await handler({}, 'again', null);
  assert.equal(managers.length, 1);
  assert.equal(managers[0].dataDir, path.join('/user/data', 'llm'));
  assert.equal(
    JSON.stringify(asks),
    JSON.stringify([
      ['hello', { system: 'safe' }],
      ['again', {}]
    ])
  );
});

test('Electron force preserves existing preload; Tauri generates HTTP helper and separate server script', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-g15-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    fs.writeFileSync(path.join(cwd, 'preload.cjs'), '// user preload');
    initLLMProject({ cwd, type: 'electron', force: true });
    assert.equal(fs.readFileSync(path.join(cwd, 'preload.cjs'), 'utf8'), '// user preload');
    initLLMProject({ cwd, type: 'tauri', force: true });
    const text = fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8');
    assert.match(text, /fetch\(/);
    assert.doesNotMatch(text, /ipcMain|from 'electron'|createLLMManager/);
    assert.match(JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'))).scripts.llm, /llm-manager/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
