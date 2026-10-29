import { exec } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { loadStandaloneServer } from './standalone.js';
import { readEnv } from '../envFile.js';
function openDefaultBrowser(url) {
  try {
    const command =
      process.platform === 'win32'
        ? `cmd /c start "" "${url}"`
        : process.platform === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`;
    const child = exec(command, () => {});
    if (child && typeof child.unref === 'function') {
      child.unref();
    }
    return true;
  } catch {
    return false;
  }
}

export async function probeAndOpenBrowser({
  cwd = process.cwd(),
  port = 8010,
  password,
  adminUser,
  pagePath,
  apiPath,
  startServerIfNeeded = true,
  openBrowser = true,
  autoCloseStartedServer = false,
  handleSignals = false,
  browserOpener
} = {}) {
  const env = readEnv(path.join(cwd, '.env'));
  adminUser ??= env.LLM_ADMIN_USER || 'admin';
  pagePath ??= env.LLM_PAGE_PATH || '/llm';
  apiPath ??= env.LLM_API_PATH || '/api/llm';
  if (env.LLM_AUTH_MODE === 'host') {
    return {
      ok: false,
      url: pagePath,
      status: 0,
      startedServer: false,
      openedBrowser: false,
      skipped: true,
      reason: 'Host oturumu hedef uygulamada doğrulanmalıdır.'
    };
  }
  password ??= env.LLM_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid probe port');
  let url = `http://127.0.0.1:${port}${pagePath}`;
  const auth = 'Basic ' + Buffer.from(adminUser + ':' + password).toString('base64');
  let ok = false;
  let status = 0;
  let startedServer = false;
  let openedBrowser = false;
  let server;

  if (port > 0) {
    try {
      const res = await fetch(url, { headers: { Authorization: auth } });
      status = res.status;
      if (res.status === 200 && (await res.text()).includes(`data-api-base="${apiPath}"`)) {
        ok = true;
      }
    } catch {
      ok = false;
    }
  }

  if (!ok && startServerIfNeeded === true) {
    const { createStandaloneServer } = await loadStandaloneServer(cwd);
    let srvInstance;
    try {
      srvInstance = await createStandaloneServer({
        port,
        host: '127.0.0.1',
        adminPassword: password,
        adminUser,
        pagePath,
        apiPath,
        chatTokens: env.LLM_CHAT_TOKENS,
        allowedOrigins: env.LLM_ALLOWED_ORIGINS || [],
        dataDir: path.join(cwd, 'data'),
        handleSignals
      });
    } catch {
      srvInstance = await createStandaloneServer({
        port: 0,
        host: '127.0.0.1',
        adminPassword: password,
        adminUser,
        pagePath,
        apiPath,
        chatTokens: env.LLM_CHAT_TOKENS,
        allowedOrigins: env.LLM_ALLOWED_ORIGINS || [],
        dataDir: path.join(cwd, 'data'),
        handleSignals
      });
    }
    server = srvInstance.server;
    startedServer = true;
    url = srvInstance.url;
    const actualPort = srvInstance.port;
    const catalogUrl = `http://127.0.0.1:${actualPort}${apiPath}/catalog`;

    try {
      const [pageRes, catRes] = await Promise.all([
        fetch(url, { headers: { Authorization: auth } }),
        fetch(catalogUrl, { headers: { Authorization: auth } })
      ]);
      status = pageRes.status;
      ok =
        pageRes.status === 200 &&
        catRes.status === 200 &&
        (await pageRes.text()).includes(`data-api-base="${apiPath}"`);
    } catch {
      ok = false;
    }
  }

  if (ok && openBrowser === true) {
    if (typeof browserOpener === 'function') {
      try {
        await browserOpener(url);
        openedBrowser = true;
      } catch {
        openedBrowser = false;
      }
    } else {
      openedBrowser = openDefaultBrowser(url);
    }
  }

  if (autoCloseStartedServer === true && server) {
    await new Promise(resolve => server.close(() => resolve()));
  }

  return {
    ok,
    url,
    status,
    startedServer,
    openedBrowser,
    ...(server ? { server } : {})
  };
}
