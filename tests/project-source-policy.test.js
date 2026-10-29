import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProjectSource, normalizeDocumentRoles } from '../src/project/sourcePolicy.js';

test('source conventions distinguish current documents, old records, plans and runtime sources', () => {
  for (const [file, role] of [
    ['README.md', 'canonical'],
    ['KULLANIM_KILAVUZU.md', 'canonical'],
    ['docs/current/guide.md', 'canonical'],
    ['docs/archive/README.md', 'historical'],
    ['docs/arşiv/eski.md', 'historical'],
    ['ARCHIVE.md', 'historical'],
    ['docs/superpowers/plans/change.md', 'plan'],
    ['docs/roadmap/README.md', 'plan'],
    ['apps/api/package.json', 'manifest'],
    ['apps/web/package.json', 'manifest'],
    ['pyproject.toml', 'manifest'],
    ['Service.csproj', 'manifest'],
    ['backend/tests/auth.test.js', 'test'],
    ['backend/src/archive/service.js', 'code']
  ])
    assert.equal(classifyProjectSource(file), role, file);
});

test('document-role configuration rejects unknown roles and paths outside the source policy', () => {
  for (const invalid of [
    null,
    [],
    new Date(),
    { 'README.md': 'current' },
    { '../outside.md': 'canonical' },
    { '/outside.md': 'canonical' },
    { '.env': 'canonical' }
  ])
    assert.throws(() => normalizeDocumentRoles(invalid), { code: 'PROJECT_ROOT_INVALID' });
  const roles = normalizeDocumentRoles({ 'docs/archive/guide.md': 'canonical', 'README.md': 'historical' });
  assert.equal(classifyProjectSource('docs/archive/guide.md', roles), 'canonical');
  assert.equal(classifyProjectSource('README.md', roles), 'historical');
});
