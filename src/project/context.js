import { analyzeProject } from './analyze.js';
import { projectQuery, projectWords } from './query.js';
import { projectOverview } from './overview.js';
import { projectGraphSelection, projectGraphEvidence } from './relations.js';
import {
  classifyProjectSource,
  normalizeDocumentRoles,
  requestsHistoricalSources,
  canonicalPriority,
  packagedToolDirectories
} from './sourcePolicy.js';

// Byte-identical copies (a mirrored "sites-source/" tree) would spend the
// budget twice; keep the shallowest path of each identical content. Copies
// with different roles (an archived snapshot of live code) stay apart.
function withoutTwins(files, roles) {
  const preferred = new Map();
  const key = file => `${roles.get(file.path)}\n${file.content}`;
  const depth = path => path.split('/').length;
  for (const file of files) {
    if (!file.content.trim()) continue;
    const current = preferred.get(key(file));
    if (
      !current ||
      depth(file.path) < depth(current.path) ||
      (depth(file.path) === depth(current.path) && file.path < current.path)
    )
      preferred.set(key(file), file);
  }
  return files.filter(file => !file.content.trim() || preferred.get(key(file)) === file);
}

export function selectProjectContext(files, question, budget = 40000, graph = null, documentRoles, sourceRevision) {
  const overrides = normalizeDocumentRoles(documentRoles);
  const roles = new Map(files.map(file => [file.path, classifyProjectSource(file.path, overrides)]));
  const historyRequested = requestsHistoricalSources(question);
  const { terms, overview: isOverview } = projectQuery(question);
  const packagedTools = packagedToolDirectories(files.map(file => file.path)).filter(
    dir => !terms.includes(projectWords(dir.split('/').at(-1)).join(''))
  );
  const eligible = withoutTwins(
    files.filter(
      file =>
        (historyRequested || !['historical', 'plan'].includes(roles.get(file.path))) &&
        !packagedTools.some(dir => file.path.startsWith(dir + '/'))
    ),
    roles
  );
  const contains = (value, term) => new Set(projectWords(value)).has(term);
  const scores = new Map(
    files.map(f => [
      f.path,
      (() => {
        const pathWords = new Set(projectWords(f.path));
        const contentWords = new Set(projectWords(f.content));
        return terms.reduce((n, term) => n + (pathWords.has(term) ? 8 : 0) + (contentWords.has(term) ? 2 : 0), 0);
      })() + (/package\.json$|\.sql$|\.prisma$/.test(f.path) ? 2 : 0)
    ])
  );
  const report = analyzeProject(eligible);
  const baseline =
    graph?.status === 'ready' ? selectProjectContext(files, question, budget, null, overrides, sourceRevision) : null;
  const overviewPaths = new Set(
    isOverview
      ? baseline?.sources
          .filter(source => source.role === 'code')
          .slice(0, 10)
          .map(source => source.path)
      : []
  );
  const graphSelection = projectGraphSelection(eligible, graph, terms, overviewPaths, sourceRevision);
  if (graphSelection) for (const name of graphSelection.paths) scores.set(name, (scores.get(name) || 0) + 12);
  // A relevant neighbour lends a file one fixed bonus. Summing it per import
  // would push a helper imported from everywhere above the files that answer.
  const related = new Set();
  for (const r of report.relationships) {
    if ((scores.get(r.from) || 0) > 2) related.add(r.to);
    if ((scores.get(r.to) || 0) > 2) related.add(r.from);
  }
  for (const name of related) scores.set(name, (scores.get(name) || 0) + 3);
  const ranked = [...eligible].sort((a, b) => scores.get(b.path) - scores.get(a.path) || a.path.localeCompare(b.path));
  const guidance = ranked
    .filter(f => roles.get(f.path) === 'canonical')
    .sort((a, b) => canonicalPriority(a.path, overrides) - canonicalPriority(b.path, overrides))
    .slice(0, 3);
  const historicalCandidates = ranked.filter(f => ['historical', 'plan'].includes(roles.get(f.path)));
  const firstHistorical = historicalCandidates[0];
  const otherHistorical = historicalCandidates.find(f => roles.get(f.path) !== roles.get(firstHistorical?.path));
  const historical = historyRequested
    ? [...new Set([firstHistorical, otherHistorical, ...historicalCandidates].filter(Boolean))].slice(0, 3)
    : [];
  const manifests = ranked.filter(f => roles.get(f.path) === 'manifest');
  const code = ranked.filter(f => roles.get(f.path) === 'code');
  const fileRoles = new Map(report.files.map(file => [file.path, file.role]));
  const backendEntry = code.find(
    file => /(?:^|\/)(?:app|server|main|index)\.[cm]?[jt]s$/.test(file.path) && fileRoles.get(file.path) === 'backend'
  );
  const entryImports = new Set(
    report.relationships.filter(link => link.kind === 'import' && link.from === backendEntry?.path).map(link => link.to)
  );
  const authFiles = code.filter(file => /(?:auth|security)/i.test(file.path) && fileRoles.get(file.path) === 'backend');
  const llmFiles = code.filter(file => /\b(?:setupLLM|mountLLMManagement)\s*\(/.test(file.content));
  const coverage = isOverview
    ? [
        code.find(file => fileRoles.get(file.path) === 'frontend'),
        backendEntry,
        authFiles.find(file => /(?:^|\/)middleware\//.test(file.path)) || authFiles[0],
        llmFiles.find(file => entryImports.has(file.path)) || llmFiles[0],
        code.find(file => /(?:^|\/)schema\.(?:prisma|sql)$/.test(file.path)) ||
          code.find(file => fileRoles.get(file.path) === 'database')
      ].filter(Boolean)
    : [];
  const essential = [...new Set([...historical, ...guidance, ...manifests, ...coverage])];
  const ordered = [...essential, ...ranked.filter(f => !essential.includes(f))];
  let text = '';
  const sources = [];
  let partial = false;
  const limit = Math.max(0, Math.min(100000, Number(budget) || 0));
  const overviewBudget = isOverview ? Math.min(8000, Math.floor(limit * 0.25)) : 0;
  const graphProof = projectGraphEvidence(graphSelection, Math.min(6000, Math.floor(limit * 0.25)));
  const sourceLimit = limit - overviewBudget - graphProof.text.length;
  const essentialSlot = Math.floor(sourceLimit / (essential.length + 1));
  const notes = {
    canonical: 'Güncel belge adayı; kodla karşılaştırılmalıdır.',
    manifest: 'Bağımlılık bildirimi; çalışan sürüm veya başarılı test kanıtı değildir.',
    historical: 'Tarihsel kayıt; güncel davranış kanıtı değildir.',
    plan: 'Plan belgesi; uygulanma durumu bu sınıflandırmadan çıkarılamaz.'
  };
  for (const file of ordered) {
    const lines = file.content.split('\n');
    const matched = lines.findIndex(line => terms.some(term => contains(line, term)));
    const start = !isOverview && !essential.includes(file) && matched > 40 ? Math.max(0, matched - 10) : 0;
    const role = roles.get(file.path);
    const header = `\n[KAYNAK ${file.path}:${start + 1}]\n${notes[role] ? '[KAYNAK ROLÜ: ' + role + '] ' + notes[role] + '\n' : ''}`;
    if (text.length + header.length + 20 > sourceLimit) {
      partial = true;
      break;
    }
    const available = Math.min(
      sourceLimit - text.length - header.length,
      essential.includes(file)
        ? Math.min(
            roles.get(file.path) === 'manifest' ? 8000 : Math.min(2400, Math.floor(limit * 0.12)),
            Math.max(0, essentialSlot - header.length)
          )
        : 8000
    );
    const anchors =
      isOverview && roles.get(file.path) === 'code'
        ? lines.flatMap((line, i) =>
            /\b(?:setupLLM\w*|mountLLMManagement|requireAuth|requireAdmin|authorize)\s*\(|\b(?:app|router)\.(?:use|get|post)\s*\(/.test(
              line
            )
              ? [Math.max(0, i - 1), i, Math.min(lines.length - 1, i + 1)]
              : []
          )
        : [];
    const indexes = [
      ...new Set(
        anchors.length ? [0, 1, 2, 3, 4, 5, ...anchors, ...lines.map((_, i) => i)] : lines.map((_, i) => i).slice(start)
      )
    ]
      .filter(i => i < lines.length)
      .slice(0, 180);
    let excerpt = '',
      end = start,
      count = 0;
    for (const index of indexes) {
      const line = `${index + 1}| ${lines[index]}\n`;
      if (excerpt.length + line.length > available) {
        if (!excerpt && essential.includes(file) && available >= 40) {
          const marker = '… [satır kısaltıldı]\n';
          excerpt = line.slice(0, available - marker.length) + marker;
          partial = true;
          end = Math.max(end, index + 1);
          count++;
        }
        break;
      }
      excerpt += line;
      end = Math.max(end, index + 1);
      count++;
    }
    if (!excerpt) {
      partial = true;
      continue;
    }
    text += header + excerpt;
    sources.push({ path: file.path, startLine: start + 1, endLine: end, role });
    if (start > 0 || count < lines.length) partial = true;
  }
  const summary = isOverview
    ? projectOverview(eligible, roles, sources, overviewBudget, partial || sources.length < eligible.length)
    : null;
  if (summary) {
    text = summary.text + text;
    partial ||= summary.clipped;
    // A summarized fact is also a source: extend the cited span to include its
    // exact line even when the raw numbered excerpt was clipped by the budget.
    if (summary.text)
      for (const key of ['stack', 'components', 'api', 'database'])
        for (const fact of summary.overview[key]) {
          const source = sources.find(source => source.path === fact.path);
          source.startLine = Math.min(source.startLine, fact.line);
          source.endLine = Math.max(source.endLine, fact.line);
        }
  }
  text = graphProof.text + text;
  for (const snippet of graphProof.snippets) {
    const source = sources.find(source => source.path === snippet.path);
    if (source) {
      source.startLine = Math.min(source.startLine, snippet.line);
      source.endLine = Math.max(source.endLine, snippet.line);
    } else
      sources.push({
        path: snippet.path,
        startLine: snippet.line,
        endLine: snippet.line,
        role: roles.get(snippet.path)
      });
  }
  partial ||= graphProof.partial;
  const baselinePaths = graphSelection ? new Set(baseline.sources.map(source => source.path)) : null;
  const graphAddedFiles = baselinePaths
    ? sources.filter(source => !baselinePaths.has(source.path)).map(source => source.path)
    : [];
  return {
    text,
    sources,
    partial: partial || sources.length < files.length,
    graphUsed: graphProof.graphEvidence.length > 0 || graphAddedFiles.length > 0,
    graphAddedFiles,
    graphEvidence: graphProof.graphEvidence,
    ...(summary ? { overview: summary.overview } : {})
  };
}
