import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';

const [mode, entry, dataDir] = process.argv.slice(2);
let server;
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  server = this;
  this.once('close', () => console.log('SERVER_CLOSED'));
  return originalListen.apply(this, args);
};
process.on('message', signal => process.emit(signal));

if (mode === 'cli' || mode === 'cli-init' || mode === 'example') {
  if (mode !== 'example') {
    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    process.env.PORT = String(reservation.address().port);
    await new Promise(resolve => reservation.close(resolve));
  }
  process.argv = [process.execPath, entry, ...process.argv.slice(5)];
  await import(pathToFileURL(entry));
} else {
  const { createStandaloneServer } = await import('../../src/server.js');
  const { probeAndOpenBrowser, runInteractiveInit } = await import('../../src/init.js');
  const options = { port: 0, adminPassword: 'lifecycle-password', dataDir, logger: { info() {}, warn() {} } };
  if (mode === 'host-default') {
    let hostSignals = 0;
    const handler = () => hostSignals++;
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
    const before = ['SIGINT', 'SIGTERM'].map(signal => process.listeners(signal));
    const instance = await createStandaloneServer(options);
    const probe = await probeAndOpenBrowser({ cwd: dataDir, port: 0, openBrowser: false });
    const init = await runInteractiveInit({
      cwd: dataDir,
      type: 'spa',
      port: 0,
      yes: true,
      openBrowser: false,
      logger() {}
    });
    assert.equal(init.ok, true);
    assert.equal(init.probe.startedServer, true);
    assert.deepEqual(
      ['SIGINT', 'SIGTERM'].map(signal => process.listeners(signal)),
      before
    );
    process.emit('SIGINT');
    process.emit('SIGTERM');
    assert.equal(hostSignals, 2);
    assert.equal(instance.server.listening, true);
    assert.equal(probe.server.listening, true);
    assert.equal(init.probe.server.listening, true);
    await instance.close();
    await new Promise(resolve => probe.server.close(resolve));
    await new Promise(resolve => init.probe.server.close(resolve));
    console.log('HOST_OWNS_SIGNALS');
    process.disconnect();
  } else if (['deadline', 'timer-cleanup', 'raw-pending'].includes(mode)) {
    const instance = await createStandaloneServer({ ...options, handleSignals: true });
    let completeRequest;
    const pending = new Promise(resolve => {
      instance.app.get('/hold', (_req, res) => {
        completeRequest = () => res.end('done');
        resolve();
      });
    });
    const request = http.get(`http://127.0.0.1:${instance.port}/hold`, res => res.resume());
    request.on('error', () => {});
    await pending;
    if (mode === 'raw-pending') {
      instance.server.close();
      let settled = false;
      const closing = instance.close().then(() => {
        settled = true;
      });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(settled, false, 'close() must wait for a pending raw close to finish');
      completeRequest();
      await closing;
      assert.equal(process.listenerCount('SIGINT'), 0);
      assert.equal(process.listenerCount('SIGTERM'), 0);
      console.log('RAW_CLOSE_DRAINED');
      process.disconnect();
    } else {
      mock.timers.enable({ apis: ['setTimeout'] });
      const exit = process.exit.bind(process);
      const exitCodes = [];
      if (mode === 'timer-cleanup') process.exit = code => exitCodes.push(code);
      process.emit('SIGINT');
      assert.equal(server.listening, false, 'signal must stop accepting connections');
      mock.timers.tick(9999);
      console.log('ALIVE_AT_9999');
      process.emit('SIGTERM');
      if (mode === 'deadline') {
        mock.timers.tick(1);
        assert.fail('owner must exit at 10000ms, without resetting on a second signal');
      }
      const closed = once(server, 'close');
      completeRequest();
      await closed;
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(exitCodes, [0]);
      assert.equal(process.listenerCount('SIGINT'), 0);
      assert.equal(process.listenerCount('SIGTERM'), 0);
      mock.timers.tick(10000);
      assert.deepEqual(exitCodes, [0], 'successful close must cancel its deadline');
      console.log('TIMER_CLEANED');
      exit(0);
    }
  } else if (mode === 'probe-owner') {
    const probe = await probeAndOpenBrowser({
      cwd: dataDir,
      port: 0,
      password: 'lifecycle-password',
      openBrowser: false,
      handleSignals: true
    });
    assert.equal(probe.ok, true);
  } else {
    await createStandaloneServer({ ...options, handleSignals: true });
  }
}
if (!['host-default', 'deadline', 'timer-cleanup', 'raw-pending'].includes(mode)) {
  assert.ok(server?.listening, 'entrypoint must retain its started server');
  assert.equal(process.listenerCount('SIGINT'), 1);
  assert.equal(process.listenerCount('SIGTERM'), 1);
  process.send({ url: `http://127.0.0.1:${server.address().port}/llm`, address: server.address().address });
}
