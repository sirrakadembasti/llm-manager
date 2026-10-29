// Acceptance utility: checks citation exposure, not the truth of a claim.
// Semantic review (including historical/current and runtime claims) is separate.
export function auditProjectCitations(context, response) {
  const exposed = new Map();
  const add = (path, line) => {
    if (!exposed.has(path)) exposed.set(path, new Set());
    exposed.get(path).add(line);
  };
  let path;
  for (const line of context.split('\n')) {
    const header = /^\[KAYNAK (.+):\d+\]$/.exec(line);
    if (header) path = header[1];
    const numbered = /^(\d+)\| /.exec(line);
    if (path && numbered) add(path, Number(numbered[1]));
    if (line.startsWith('{')) {
      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      for (const key of ['stack', 'components', 'api', 'database', 'sources'])
        for (const fact of data[key] || [])
          if (typeof fact.path === 'string' && Number.isSafeInteger(fact.line)) add(fact.path, fact.line);
    }
  }
  const citations = [];
  const pattern = /([\w./-]+\.[\w]+):(\d+(?:[-–]\d+)?(?:,\s*\d+(?:[-–]\d+)?)*)/gu;
  for (const match of String(response).matchAll(pattern)) {
    const path = match[1],
      missing = [];
    for (const span of match[2].split(/,\s*/)) {
      const bounds = span.split(/[-–]/).map(Number);
      const [start, end = start] = bounds;
      if (end < start || end - start > 10000) {
        missing.push(start);
        continue;
      }
      for (let line = start; line <= end; line++) if (!exposed.get(path)?.has(line)) missing.push(line);
    }
    citations.push({ citation: match[0], path, unprovidedLines: missing });
  }
  return { citationCount: citations.length, invalid: citations.filter(citation => citation.unprovidedLines.length) };
}
