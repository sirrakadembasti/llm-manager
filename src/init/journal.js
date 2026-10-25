import fs from 'node:fs';
import path from 'node:path';

export function createChangeJournal(cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const files = new Map();
  const dirs = new Set();
  function capture(file) {
    const full = path.resolve(file);
    if (!full.startsWith(root + path.sep)) throw new Error('Journal path escapes project');
    let ancestor = full;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    const resolved = fs.realpathSync(ancestor);
    const actualRoot = fs.realpathSync(root);
    if (resolved !== actualRoot && !resolved.startsWith(actualRoot + path.sep))
      throw new Error('Journal symlink escapes project');
    if (files.has(full)) return;
    files.set(full, fs.existsSync(full) ? { content: fs.readFileSync(full), mode: fs.statSync(full).mode } : null);
    let dir = path.dirname(full);
    while (dir !== root && !fs.existsSync(dir)) {
      dirs.add(dir);
      dir = path.dirname(dir);
    }
  }
  return {
    capture,
    write(file, content) {
      capture(file);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    },
    rollback() {
      for (const [file, before] of [...files].reverse()) {
        if (before) {
          fs.writeFileSync(file, before.content);
          fs.chmodSync(file, before.mode);
        } else fs.rmSync(file, { force: true });
      }
      for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      }
    }
  };
}
