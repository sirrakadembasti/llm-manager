import { analyzeProject } from './analyze.js';

export function selectProjectContext(files, question, budget = 40000, graph = null) {
  const terms = [
    ...new Set(
      String(question)
        .toLowerCase()
        .match(/[\p{L}\p{N}_]{3,}/gu) || []
    )
  ];
  const scores = new Map(
    files.map(f => [
      f.path,
      terms.reduce(
        (n, term) =>
          n + (f.path.toLowerCase().includes(term) ? 8 : 0) + (f.content.toLowerCase().includes(term) ? 2 : 0),
        0
      ) + (/package\.json$|\.sql$|\.prisma$/.test(f.path) ? 2 : 0)
    ])
  );
  const report = analyzeProject(files);
  const graphPaths = new Set();
  const graphUsed = graph?.status === 'ready';
  if (graphUsed) {
    const nodes = new Map(graph.nodes.map(n => [n.id, n]));
    const seeds = new Set(
      graph.nodes.filter(n => terms.some(term => `${n.path} ${n.label}`.toLowerCase().includes(term))).map(n => n.id)
    );
    for (const link of graph.links) {
      if (!seeds.has(link.from) && !seeds.has(link.to)) continue;
      for (const id of [link.from, link.to]) {
        const node = nodes.get(id);
        if (node && scores.has(node.path)) graphPaths.add(node.path);
      }
    }
    for (const name of graphPaths) scores.set(name, (scores.get(name) || 0) + 12);
  }
  for (const r of report.relationships) {
    if ((scores.get(r.from) || 0) > 2) scores.set(r.to, (scores.get(r.to) || 0) + 3);
    if ((scores.get(r.to) || 0) > 2) scores.set(r.from, (scores.get(r.from) || 0) + 3);
  }
  const ranked = [...files].sort((a, b) => scores.get(b.path) - scores.get(a.path) || a.path.localeCompare(b.path));
  const guidance = ranked.filter(f => /\.(?:md|txt)$/i.test(f.path)).slice(0, 3);
  const ordered = [...guidance, ...ranked.filter(f => !guidance.includes(f))];
  let text = '';
  const sources = [];
  let partial = false;
  const limit = Math.max(0, Math.min(100000, Number(budget) || 0));
  for (const file of ordered) {
    const lines = file.content.split('\n');
    const matched = lines.findIndex(line => terms.some(term => line.toLowerCase().includes(term)));
    const start = matched > 40 ? Math.max(0, matched - 10) : 0;
    const header = `\n[KAYNAK ${file.path}:${start + 1}]\n`;
    if (text.length + header.length + 20 > limit) {
      partial = true;
      break;
    }
    const available = Math.min(
      limit - text.length - header.length,
      guidance.includes(file) ? Math.min(2400, Math.floor(limit * 0.12)) : 8000
    );
    let excerpt = '',
      end = start;
    for (; end < Math.min(lines.length, start + 180); end++) {
      const line = `${end + 1}| ${lines[end]}\n`;
      if (excerpt.length + line.length > available) break;
      excerpt += line;
    }
    if (!excerpt) {
      partial = true;
      continue;
    }
    text += header + excerpt;
    sources.push({ path: file.path, startLine: start + 1, endLine: end });
    if (start > 0 || end < lines.length) partial = true;
  }
  return { text, sources, partial: partial || sources.length < files.length, graphUsed };
}
