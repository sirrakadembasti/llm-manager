import { projectWords } from './query.js';

export function projectGraphSelection(files, graph, terms, overviewPaths, revision) {
  if (graph?.status !== 'ready' || (revision !== undefined && graph.revision !== revision)) return null;
  const inventory = new Map(files.map(file => [file.path, { ...file, lines: file.content.split('\n') }]));
  const nodes = new Map();
  const ambiguous = new Set();
  for (const node of graph.nodes || []) {
    const line = node.line ?? 1;
    if (
      !inventory.has(node.path) ||
      !Number.isSafeInteger(line) ||
      line < 1 ||
      line > inventory.get(node.path).lines.length
    )
      continue;
    if (nodes.has(node.id)) {
      ambiguous.add(node.id);
      continue;
    }
    nodes.set(node.id, { ...node, line });
  }
  for (const id of ambiguous) nodes.delete(id);
  const seeds = new Set(
    [...nodes.values()]
      .filter(node => {
        const words = new Set(projectWords(`${node.path} ${node.label}`));
        return terms.some(term => words.has(term)) || overviewPaths.has(node.path);
      })
      .map(node => node.id)
  );
  const paths = new Set();
  function* relations() {
    for (const link of graph.links || []) {
      if (!nodes.has(link.from) || !nodes.has(link.to) || (!seeds.has(link.from) && !seeds.has(link.to))) continue;
      const from = nodes.get(link.from),
        to = nodes.get(link.to);
      yield {
        fromPath: from.path,
        fromLine: from.line,
        toPath: to.path,
        toLine: to.line,
        kind: String(link.kind || 'related').slice(0, 80),
        confidence: String(link.confidence || 'unknown').slice(0, 40)
      };
    }
  }
  for (const relation of relations()) {
    paths.add(relation.fromPath);
    paths.add(relation.toPath);
  }
  return { paths, relations, inventory };
}

const header =
  '\n[GRAPHIFY İLİŞKİ KANITLARI — statik harita işaretleri]\nSeçim nedeni: soruyla eşleşen veya genel bakışta kapsanan düğümün komşuları. Kaynak satırlarıyla doğrulayın; çalışma zamanı garantisi değildir.\n';

export function projectGraphEvidence(selection, budget) {
  const graphEvidence = [],
    snippets = new Map(),
    seen = new Set();
  if (!selection || budget < header.length) return { text: '', graphEvidence, snippets: [], partial: false };
  let text = '',
    partial = false;
  for (const relation of selection.relations()) {
    const identity = JSON.stringify(relation);
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (graphEvidence.length === 20) {
      partial = true;
      break;
    }
    const nextSnippets = new Map(snippets);
    for (const [file, line] of [
      [relation.fromPath, relation.fromLine],
      [relation.toPath, relation.toLine]
    ]) {
      const content = selection.inventory.get(file).lines[line - 1];
      nextSnippets.set(`${file}:${line}`, {
        path: file,
        line,
        text: content.length > 500 ? content.slice(0, 500) + ' … [satır kısaltıldı]' : content
      });
    }
    const candidate =
      header + JSON.stringify({ relations: [...graphEvidence, relation], sources: [...nextSnippets.values()] });
    if (candidate.length > budget) {
      partial = true;
      continue;
    }
    graphEvidence.push(relation);
    for (const [key, snippet] of nextSnippets) snippets.set(key, snippet);
    text = candidate;
  }
  return { text, graphEvidence, snippets: [...snippets.values()], partial };
}
