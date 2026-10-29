import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { projectPath, hasProjectSecret, projectError, isWithin } from './policy.js';

export async function createProjectWorkspace(files) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-work-'));
  const root = path.join(directory, 'source');
  const runtime = path.join(directory, 'runtime');
  const dispose = async () => {
    const resolved = await fs.realpath(directory).catch(() => null);
    if (
      resolved &&
      isWithin(await fs.realpath(os.tmpdir()), resolved) &&
      path.basename(resolved).startsWith('llm-project-work-')
    ) {
      await fs.rm(resolved, { recursive: true, force: true });
    }
  };
  try {
    await fs.mkdir(root);
    await fs.mkdir(runtime);
    for (const file of files) {
      projectPath(file.path);
      if (hasProjectSecret(file.content))
        throw projectError(
          'PROJECT_SECRET_DETECTED',
          'Sır içerebilecek dosya çalışma kopyasına alınamaz.',
          403,
          'secret'
        );
      const target = path.join(root, ...file.path.split('/'));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, { flag: 'wx', mode: 0o600 });
    }
    const env = {};
    for (const name of [
      'PATH',
      'Path',
      'SystemRoot',
      'WINDIR',
      'COMSPEC',
      'PATHEXT',
      'TEMP',
      'TMP',
      'NUMBER_OF_PROCESSORS',
      'PROCESSOR_ARCHITECTURE'
    ]) {
      if (process.env[name]) env[name] = process.env[name];
    }
    for (const name of [
      'HOME',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
      'XDG_CONFIG_HOME',
      'XDG_DATA_HOME',
      'XDG_CACHE_HOME',
      'XDG_STATE_HOME'
    ]) {
      env[name] = path.join(runtime, name.toLowerCase());
      await fs.mkdir(env[name]);
    }
    env.PYTHONUTF8 = '1';
    return { directory, root, runtime, env, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
