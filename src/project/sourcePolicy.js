import { projectError, projectPath } from './policy.js';

const sourceRoles = Object.freeze(['canonical', 'manifest', 'code', 'test', 'historical', 'plan']);

export function normalizeDocumentRoles(roles) {
  if (roles === undefined) return {};
  if (
    !roles ||
    typeof roles !== 'object' ||
    Array.isArray(roles) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(roles))
  )
    throw projectError('PROJECT_ROOT_INVALID', 'documentRoles göreli kaynak yollarını belge rollerine eşlemelidir.');
  return Object.fromEntries(
    Object.entries(roles).map(([file, role]) => {
      try {
        projectPath(file);
      } catch {
        throw projectError(
          'PROJECT_ROOT_INVALID',
          'documentRoles yalnız izin verilen göreli kaynak yollarını kabul eder.'
        );
      }
      if (!sourceRoles.includes(role))
        throw projectError('PROJECT_ROOT_INVALID', 'documentRoles içinde bilinmeyen kaynak rolü var.');
      return [file, role];
    })
  );
}

export function classifyProjectSource(relativePath, roles = {}) {
  if (Object.hasOwn(roles, relativePath)) return roles[relativePath];
  const name = relativePath.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');
  if (
    /^(?:(?:docs?|documentation)\/.*?|)(?:archive|archives|archived|arsiv|arşiv)\//.test(name) ||
    /^(?:archive|arsiv|arşiv)\.(?:md|txt)$/.test(name)
  )
    return 'historical';
  if (
    /^(?:(?:docs?|documentation|superpowers|\.superpowers)\/.*?|)(?:plans?|roadmap)\//.test(name) ||
    /(?:^|\/)(?:roadmap|plan|yol_haritasi)\.(?:md|txt)$/.test(name)
  )
    return 'plan';
  if (
    /(?:^|\/)(?:package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|pom\.xml|composer\.json|gemfile)$|\.(?:csproj|fsproj)$/.test(
      name
    )
  )
    return 'manifest';
  if (/(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\./.test(name)) return 'test';
  return /\.(?:md|txt)$/.test(name) ? 'canonical' : 'code';
}

export function requestsHistoricalSources(question) {
  const text = String(question).toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');
  if (
    /(?:arşiv|arsiv|archive|historical|plan)\p{L}*(?:\s+\p{L}+){0,6}\s+(?:kullanma\p{L}*|hariç|haric|dışla\p{L}*|disla\p{L}*)|(?:without|exclude|ignore)\s+(?:the\s+)?(?:archives?|historical|plans?)/u.test(
      text
    )
  )
    return false;
  return /(?:^|[^\p{L}])(?:(?:tarihçe|tarihce|geçmiş|gecmis|eski|önceki|onceki|arşiv|arsiv)\p{L}*|plan(?:lar\p{L}*|lama\p{L}*|i\p{L}*|s)?|planning|history|historical|archive|archives|roadmap|changelog)(?:$|[^\p{L}])|yol\s+haritasi/u.test(
    text
  );
}

export function canonicalPriority(file, roles) {
  if (roles[file] === 'canonical') return 0;
  if (/^readme(?:\.[^/]+)?\.(?:md|txt)$/i.test(file)) return 1;
  if (!file.includes('/')) return 2;
  return 3;
}
