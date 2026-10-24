import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('SECURITY.md exists and documents reporting procedures', () => {
  assert.ok(fs.existsSync('SECURITY.md'));
  const content = fs.readFileSync('SECURITY.md', 'utf8');
  assert.match(content, /Reporting a Vulnerability/);
  assert.match(content, /Security Architecture Principles/);
  assert.match(content, /Zero Secret Leakage/);
});

test('CONTRIBUTING.md exists and documents quality and commit guidelines', () => {
  assert.ok(fs.existsSync('CONTRIBUTING.md'));
  const content = fs.readFileSync('CONTRIBUTING.md', 'utf8');
  assert.match(content, /Conventional Commits/);
  assert.match(content, /Quality Verification Commands/);
  assert.match(content, /npm test/);
  assert.match(content, /Zero Secret Leakage/);
});

test('docs/THREAT_MODEL.md exists and covers primary threat vectors', () => {
  assert.ok(fs.existsSync('docs/THREAT_MODEL.md'));
  const content = fs.readFileSync('docs/THREAT_MODEL.md', 'utf8');
  assert.match(content, /Protected Assets/);
  assert.match(content, /Server-Side Request Forgery \(SSRF\)/);
  assert.match(content, /Cross-Site Request Forgery \(CSRF\)/);
  assert.match(content, /Credential & Secret Leakage/);
  assert.match(content, /Resource Exhaustion & Cost Abuse/);
});

test('.github/workflows/ci.yml runs production dependency audit', () => {
  assert.ok(fs.existsSync('.github/workflows/ci.yml'));
  const content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(content, /npm audit --omit=dev/);
});
