import fs from 'node:fs';
import path from 'node:path';
function hasFilesWithExt(cwd, extList) {
  try {
    const entries = fs.readdirSync(cwd);
    return entries.some(name => extList.some(ext => name.toLowerCase().endsWith(ext)));
  } catch {
    return false;
  }
}

export function detectProjectType(cwd = process.cwd()) {
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@tauri-apps/api'] || deps['@tauri-apps/cli']) return 'tauri';
      if (deps.electron) return 'electron';
      for (const name of ['fastify', 'koa', 'hono']) if (deps[name]) return name;
      if (deps['@nestjs/core']) return 'nestjs';
      if (deps.next) return 'nextjs';
      if (deps.nuxt) return 'nuxt';
      if (deps['@sveltejs/kit']) return 'sveltekit';
      if (deps.express) return 'express';
      if (deps.vite || deps.react || deps.vue || deps.svelte || deps['@angular/core']) return 'spa';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
  if (fs.existsSync(path.join(cwd, 'nuxt.config.ts')) || fs.existsSync(path.join(cwd, 'nuxt.config.js'))) {
    return 'nuxt';
  }
  if (
    hasFilesWithExt(cwd, ['.csproj', '.sln']) ||
    fs.existsSync(path.join(cwd, 'Program.cs')) ||
    fs.existsSync(path.join(cwd, 'Startup.cs')) ||
    fs.existsSync(path.join(cwd, 'Global.asax.cs')) ||
    fs.existsSync(path.join(cwd, 'Form1.cs')) ||
    fs.existsSync(path.join(cwd, 'Web.config'))
  ) {
    return 'dotnet';
  }
  if (
    fs.existsSync(path.join(cwd, 'requirements.txt')) ||
    fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
    fs.existsSync(path.join(cwd, 'main.py')) ||
    fs.existsSync(path.join(cwd, 'app.py'))
  ) {
    return 'python';
  }
  if (fs.existsSync(path.join(cwd, 'index.html'))) {
    return 'spa';
  }
  return 'express';
}

export function isEsmProject(cwd, type) {
  if (type === 'nextjs' || type === 'nuxt' || type === 'sveltekit' || type === 'spa') return true;
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return true;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.type === 'module';
  } catch {
    return true;
  }
}

function readPkgMain(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (typeof pkg.main === 'string' && pkg.main.trim()) {
      const normalized = pkg.main.trim().replace(/\\/g, '/').replace(/^\.\//, '');
      if (
        normalized &&
        !/^(?:dist|build|out|\.next|lib)\//.test(normalized) &&
        !normalized.endsWith('.min.js') &&
        !path.isAbsolute(normalized) &&
        !normalized.split('/').includes('..') &&
        path.posix.basename(normalized) !== 'llm.js'
      ) {
        return normalized;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function detectEntryFile(cwd = process.cwd(), type = detectProjectType(cwd)) {
  const candidates = [];
  if (type === 'express') {
    const pkgMain = readPkgMain(cwd);
    if (pkgMain) candidates.push(pkgMain);
    candidates.push(
      'server.ts',
      'app.ts',
      'index.ts',
      'src/server.ts',
      'src/app.ts',
      'src/index.ts',
      'src/main.ts',
      'server.js',
      'app.js',
      'index.js',
      'src/server.js',
      'src/app.js',
      'src/index.js'
    );
  } else if (type === 'spa') {
    candidates.push(
      'src/App.vue',
      'App.vue',
      'src/App.svelte',
      'src/App.jsx',
      'src/App.tsx',
      'src/App.js',
      'src/main.ts',
      'src/main.jsx',
      'src/main.js',
      'main.js',
      'index.js'
    );
  } else if (type === 'nextjs') {
    candidates.push(
      'src/app/page.js',
      'src/app/page.tsx',
      'src/app/page.jsx',
      'app/page.js',
      'app/page.tsx',
      'app/page.jsx'
    );
  } else if (type === 'nuxt') {
    candidates.push('app.vue', 'pages/index.vue', 'src/app.vue', 'src/pages/index.vue');
  } else if (type === 'sveltekit') {
    candidates.push('src/routes/+page.svelte', 'src/App.svelte');
  } else if (type === 'dotnet') {
    candidates.push(
      'Program.cs',
      'Startup.cs',
      'Controllers/HomeController.cs',
      'Presenters/MainPresenter.cs',
      'Form1.cs',
      'MainWindow.xaml.cs',
      'Global.asax.cs'
    );
  } else if (type === 'python') {
    candidates.push('main.py', 'app.py', 'server.py', 'run.py', 'manage.py');
  } else if (type === 'electron') {
    const pkgMain = readPkgMain(cwd);
    if (pkgMain) candidates.push(pkgMain);
    candidates.push('main.js', 'electron/main.js', 'src/main.js', 'index.js');
  }

  for (const rel of candidates) {
    const full = path.join(cwd, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return rel;
    }
  }
  return null;
}
