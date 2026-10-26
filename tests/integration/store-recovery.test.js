import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountLLMManagement } from '../../src/index.js';
import { recoveryFixture, assertRepairResponse, assertUiRepair } from '../helpers/storeRecovery.js';

test('B3 real Express preserves corrupt-file JSON repair response and UI-visible instructions', async t => {
  const fixture = await recoveryFixture(t);
  const app = express();
  mountLLMManagement(app, fixture.options);
  let hostErrors = 0;
  app.use((error, req, res, _next) => {
    hostErrors++;
    res.status(500).json({ error: 'Generic host failure', code: 'HOST_ERROR' });
  });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fetchRequest = (url, options = {}) =>
    fetch(`${origin}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: 'Basic ' + Buffer.from('admin:recovery-password').toString('base64')
      }
    });
  await assertRepairResponse(await fetchRequest('/api/llm/profiles'));
  await assertUiRepair(fetchRequest);
  assert.equal(hostErrors, 0);
  await fixture.unchanged();
});

test('B3 real Express still forwards unknown host-store exceptions to host middleware', async t => {
  const error = new Error('private-host-error');
  const app = express();
  mountLLMManagement(app, {
    adminPassword: 'recovery-password',
    rateLimit: false,
    store: {
      list() {
        throw error;
      }
    }
  });
  let observed;
  app.use((caught, req, res, _next) => {
    observed = caught;
    res.status(503).json({ code: 'HOST_UNAVAILABLE' });
  });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/llm/profiles`, {
    headers: { Authorization: 'Basic ' + Buffer.from('admin:recovery-password').toString('base64') }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'HOST_UNAVAILABLE');
  assert.equal(observed, error);
});
