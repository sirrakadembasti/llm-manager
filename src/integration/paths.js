export function validateManagementPath(value) {
  if (typeof value !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Geçersiz eklenti mount yolu.');
  }
  return value;
}

export function chooseManagementPaths(
  occupied,
  { pagePath = '/llm', apiPath = '/api/llm', isOccupied = () => false } = {}
) {
  validateManagementPath(pagePath);
  validateManagementPath(apiPath);
  if (pagePath === apiPath || pagePath.startsWith(apiPath + '/') || apiPath.startsWith(pagePath + '/')) {
    throw new Error('Yönetim sayfası ve API yolları birbirinden ayrı olmalıdır.');
  }
  const paths = [...occupied].map(value => value.toLowerCase().replace(/\/$/, ''));
  const conflicts = candidate =>
    isOccupied(candidate) ||
    paths.some(value => value === candidate.toLowerCase() || value.startsWith(candidate.toLowerCase() + '/'));
  const automatic = /^\/llm\d*$/.test(pagePath) && apiPath === '/api' + pagePath;
  const start = automatic ? Number(pagePath.slice(4) || 0) : 0;
  for (let index = start; index < start + 1000; index++) {
    const page = automatic ? '/llm' + (index || '') : pagePath;
    const api = automatic ? '/api' + page : apiPath;
    if (!conflicts(page) && !conflicts(api)) return { pagePath: page, apiPath: api };
    if (!automatic) break;
  }
  throw new Error('Yönetim yolu başka bir sayfa/API ile çakışıyor; farklı pagePath/apiPath belirtin.');
}
