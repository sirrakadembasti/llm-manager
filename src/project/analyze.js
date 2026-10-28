import path from 'node:path';

function role(name) {
  if (/(?:^|\/)(?:db|database|migrations|models)(?:\/|$)|\.(?:sql|prisma)$/.test(name)) return 'database';
  if (/(?:^|\/)(?:frontend|client|components|pages|views)(?:\/|$)|\.(?:jsx|tsx|vue|svelte)$/.test(name))
    return 'frontend';
  if (/(?:^|\/)(?:backend|server|api|controllers|services|routes)(?:\/|$)/i.test(name)) return 'backend';
  if (/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.test\./.test(name)) return 'test';
  return 'shared';
}

export function analyzeProject(files) {
  const stack = [],
    components = [],
    api = [],
    database = [],
    relationships = [],
    warnings = [];
  const paths = new Set(files.map(f => f.path));
  const lineAt = (content, offset) => content.slice(0, offset).split('\n').length;
  for (const file of files) {
    const { path: name, content } = file;
    if (/(?:^|\/)package\.json$/.test(name)) {
      try {
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [dependency, version] of Object.entries(deps)) {
          if (typeof version === 'string') stack.push({ name: dependency, version, path: name, line: 1 });
        }
        components.push({ name: path.posix.dirname(name), manifest: name, role: role(name) });
      } catch {
        warnings.push({ path: name, message: 'Paket bildirimi ayrıştırılamadı.' });
      }
    }
    if (name.endsWith('requirements.txt') || name.endsWith('pyproject.toml')) {
      for (const m of content.matchAll(/^\s*([\w-]+)\s*(?:==|>=|~=|=)\s*["']?([\w.*+-]+)/gm)) {
        stack.push({ name: m[1], version: m[2], path: name, line: lineAt(content, m.index) });
      }
      components.push({ name: path.posix.dirname(name), manifest: name, role: 'backend' });
    }
    if (name.endsWith('.csproj')) {
      for (const m of content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g)) {
        stack.push({ name: m[1], version: m[2], path: name, line: lineAt(content, m.index) });
      }
      components.push({ name: path.posix.dirname(name), manifest: name, role: 'backend' });
    }
    for (const m of content.matchAll(
      /\b(?:app|router|server)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi
    )) {
      api.push({
        method: m[1].toUpperCase(),
        endpoint: m[2],
        path: name,
        line: lineAt(content, m.index),
        kind: 'route'
      });
    }
    for (const m of content.matchAll(/@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi)) {
      if (!api.some(a => a.path === name && a.line === lineAt(content, m.index) && a.endpoint === m[2])) {
        api.push({
          method: m[1].toUpperCase(),
          endpoint: m[2],
          path: name,
          line: lineAt(content, m.index),
          kind: 'route'
        });
      }
    }
    for (const m of content.matchAll(/\bfetch\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
      api.push({ method: 'UNKNOWN', endpoint: m[1], path: name, line: lineAt(content, m.index), kind: 'client' });
    }
    for (const m of content.matchAll(/(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*)['"]([.][^'"]+)['"]/g)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(name), m[1]));
      const target = [base, ...['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'].map(ext => base + ext)].find(
        p => paths.has(p)
      );
      if (target)
        relationships.push({
          from: name,
          to: target,
          kind: 'import',
          line: lineAt(content, m.index),
          confidence: 'source-pattern'
        });
    }
    if (name.endsWith('.sql')) {
      for (const m of content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."`[\]]+)\s*\(/gi)) {
        let end = m.index + m[0].length,
          nesting = 1;
        const start = end;
        for (; end < content.length && nesting; end++) {
          if (content[end] === '(') nesting++;
          if (content[end] === ')') nesting--;
        }
        const columns = content
          .slice(start, end - 1)
          .split(/,(?![^()]*\))/)
          .flatMap(column => {
            const c = /^\s*["`[]?([\w]+)["`\]]?\s+([\w]+(?:\([^)]*\))?)/.exec(column);
            if (!c || /^(?:constraint|primary|foreign|unique|check)$/i.test(c[1])) return [];
            return [{ name: c[1], type: c[2].toUpperCase(), nullable: !/\bNOT\s+NULL|\bPRIMARY\s+KEY/i.test(column) }];
          });
        database.push({
          name: m[1].replace(/["`[\]]/g, ''),
          columns,
          path: name,
          line: lineAt(content, m.index),
          kind: 'table'
        });
      }
    } else if (/\.(?:prisma|edmx)$|(?:^|\/)(?:models?|schema)\//.test(name)) {
      database.push({ name: path.posix.basename(name), path: name, line: 1, kind: 'model', columns: [] });
    }
  }
  for (const client of api.filter(a => a.kind === 'client')) {
    for (const route of api.filter(a => a.kind === 'route' && a.endpoint === client.endpoint)) {
      relationships.push({
        from: client.path,
        to: route.path,
        kind: 'http',
        line: client.line,
        confidence: 'endpoint-match'
      });
    }
  }
  return {
    stack,
    components,
    api,
    database,
    relationships,
    warnings,
    files: files.map(f => ({ path: f.path, role: role(f.path), bytes: f.bytes })),
    note: 'Statik kaynak işaretleri; dinamik rotalar ve çalışma zamanı ilişkileri eksik olabilir.'
  };
}
