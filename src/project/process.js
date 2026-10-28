import path from 'node:path';
import { promisify } from 'node:util';
import { projectError } from './policy.js';

export async function stopProjectProcess(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exec = promisify((await import('node:child_process')).execFile);
    await exec(
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'],
      { windowsHide: true, timeout: 5000 }
    ).catch(() => child.kill());
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill();
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }
}

export async function runProjectProcess({
  command,
  args = [],
  cwd,
  env,
  signal,
  timeoutMs = 60000,
  maxOutputBytes = 1024 * 1024
}) {
  signal?.throwIfAborted();
  const { spawn } = await import('node:child_process');
  if (typeof command !== 'string' || !command || !Array.isArray(args) || args.some(a => typeof a !== 'string')) {
    throw projectError('PROJECT_TOOL_INVALID', 'Araç komutu ve bağımsız değişkenleri geçersiz.');
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '',
      bytes = 0,
      failure;
    const stop = error => {
      failure ||= error;
      void stopProjectProcess(child);
    };
    const onAbort = () => stop(signal.reason || new DOMException('İşlem iptal edildi.', 'AbortError'));
    const timer = setTimeout(
      () => stop(projectError('PROJECT_TOOL_TIMEOUT', 'Proje aracı zaman sınırını aştı.', 504)),
      timeoutMs
    );
    signal?.addEventListener('abort', onAbort, { once: true });
    const collect = chunk => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes)
        stop(projectError('PROJECT_TOOL_OUTPUT_LIMIT', 'Proje aracı çıktı sınırını aştı.', 413));
      else output += chunk.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    child.once('error', error => {
      cleanup();
      reject(error);
    });
    child.once('close', (code, exitSignal) => {
      cleanup();
      if (failure) reject(failure);
      else resolve({ code, signal: exitSignal, output });
    });
    if (signal?.aborted) onAbort();
  });
}
