export default function electron({ PKG, esm }) {
  const header = esm
    ? `import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLLMManager } from '${PKG}/core';
import { createStandaloneServer } from '${PKG}/server';`
    : `const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const { createLLMManager } = require('${PKG}/core');
const { createStandaloneServer } = require('${PKG}/server');`;
  const exp = esm ? 'export ' : '';
  return {
    'llm.js': `${header}
let manager;
function getManager() {
  if (!app.isReady()) throw new Error('Call LLM helpers after app.whenReady()');
  return manager ||= createLLMManager({ dataDir: path.join(app.getPath('userData'), 'llm') });
}
${exp}async function askLLM(prompt, options = {}) { return getManager().ask(prompt, options); }
${exp}function registerLLMIpc(ipcMain) {
  ipcMain.handle('llm:ask', (_event, prompt, options = {}) => askLLM(prompt, { system: typeof options.system === 'string' ? options.system : undefined }));
}
${exp}async function openLLMPanel() {
  await app.whenReady();
  const password = crypto.randomBytes(24).toString('base64url');
  const instance = await createStandaloneServer({ host: '127.0.0.1', port: 0, adminPassword: password, dataDir: path.join(app.getPath('userData'), 'llm') });
  const window = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, partition: 'llm-' + crypto.randomBytes(12).toString('hex') } });
  window.webContents.on('login', (event, _details, _authInfo, callback) => { event.preventDefault(); callback('admin', password); });
  window.on('closed', () => instance.server.close());
  try { await window.loadURL(instance.url); } catch (error) { instance.server.close(); window.destroy(); throw error; }
  return window;
}
${esm ? '' : 'module.exports = { askLLM, registerLLMIpc, openLLMPanel };'}
`,
    'preload.cjs': `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('llm', {
  ask: (prompt, options) => ipcRenderer.invoke('llm:ask', prompt, options)
});
`
  };
}
