import { analyzeProject } from './analyze.js';

export const overviewHeader = '\n[MİMARİ ÖZETİ — statik kaynak kanıtları]\n';

export function projectOverview(files, roles, sources, budget, partial) {
  const selected = new Map(sources.map((source, index) => [source.path, index]));
  const report = analyzeProject(
    files
      .filter(file => selected.has(file.path) && ['code', 'manifest'].includes(roles.get(file.path)))
      .sort((a, b) => selected.get(a.path) - selected.get(b.path))
  );
  const candidates = {
    stack: report.stack.map(item => ({ ...item, evidence: 'dependency-declaration' })),
    components: report.components,
    api: report.api,
    database: report.database.map(({ columns: _columns, ...item }) => item)
  };
  const overview = {
    stack: [],
    components: [],
    api: [],
    database: [],
    limitations: [
      'Statik kaynak işaretleri; çalışan sürüm, başarılı test veya dinamik davranış kanıtı değildir.',
      ...(partial ? ['Kısmi bağlam: dosya/satır bütçesi nedeniyle kaynakların tamamı aktarılmadı.'] : [])
    ]
  };
  const size = () => overviewHeader.length + JSON.stringify(overview).length;
  // Round-robin prevents dependencies from consuming the API/database allocation.
  const positions = Object.fromEntries(Object.keys(candidates).map(key => [key, 0]));
  const clipped = new Set();
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const key of Object.keys(candidates)) {
      const item = candidates[key][positions[key]++];
      if (!item) continue;
      remaining = true;
      overview[key].push(item);
      if (size() > budget - 160) {
        overview[key].pop();
        clipped.add(key);
      }
    }
  }
  if (clipped.size) overview.limitations.push(`Özet bütçesinde kesilen alanlar: ${[...clipped].join(', ')}.`);
  if (!sources.length) overview.limitations.push('Bu bütçede kaynak aktarılamadı.');
  const text = size() <= budget ? overviewHeader + JSON.stringify(overview) : '';
  return { overview, text, clipped: clipped.size > 0 || !text };
}
