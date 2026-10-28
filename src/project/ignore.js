import fs from 'node:fs/promises';
import path from 'node:path';

export async function gitIgnoredPaths(root, paths) {
  const { spawn } = await import('node:child_process');
  return await new Promise(resolve => {
    const child = spawn('git', ['check-ignore', '--no-index', '--stdin', '-z'], {
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    let output = '',
      bytes = 0;
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 5000);
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) child.kill();
      else output += chunk.toString();
    });
    child.stdin.on('error', () => {});
    child.once('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.once('close', code => {
      clearTimeout(timer);
      resolve(
        (code === 0 || code === 1) && bytes <= 8 * 1024 * 1024 ? new Set(output.split('\0').filter(Boolean)) : null
      );
    });
    child.stdin.end(paths.join('\0') + '\0');
  });
}

function glob(pattern) {
  let result = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      result += pattern[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i++;
      if (pattern[i + 1] === '/') i++;
    } else if (c === '*') result += '[^/]*';
    else if (c === '?') result += '[^/]';
    else if (c === '[' && pattern.indexOf(']', i + 1) > i + 1) {
      const end = pattern.indexOf(']', i + 1);
      let members = pattern.slice(i + 1, end);
      if (members.startsWith('!')) members = '^' + members.slice(1);
      result += '[' + members.replace(/\\/g, '\\\\') + ']';
      i = end;
    } else result += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(result);
}

// Conservatively apply directory-local ignore files even when Git is unavailable.
// Git's own traversal remains authoritative when the source is a working tree.
export async function isProjectIgnored(root, relativePath, { git = true } = {}) {
  if (git) {
    const ignored = await gitIgnoredPaths(root, [relativePath]);
    if (ignored) return ignored.has(relativePath);
  }
  const parts = relativePath.split('/');
  let ignored = false;
  for (let depth = 0; depth < parts.length; depth++) {
    const directory = path.join(root, ...parts.slice(0, depth));
    const ignoreFile = path.join(directory, '.gitignore');
    const stat = await fs.lstat(ignoreFile).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) continue;
    const content = await fs.readFile(ignoreFile, 'utf8');
    const suffix = parts.slice(depth).join('/');
    for (let line of content.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const negate = line.startsWith('!');
      if (negate) line = line.slice(1);
      const anchored = line.startsWith('/');
      if (anchored) line = line.slice(1);
      if (line.endsWith('/')) line = line.slice(0, -1);
      if (!line) continue;
      const prefix = anchored || line.includes('/') ? '^' : '(?:^|/)';
      if (new RegExp(prefix + glob(line).source + '(?:/|$)').test(suffix)) ignored = !negate;
    }
    if (ignored && depth < parts.length - 1) return true;
  }
  return ignored;
}
