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

test('security policy distinguishes unreleased development from existing release support', () => {
  const content = fs.readFileSync('SECURITY.md', 'utf8');
  assert.match(content, /\| 1\.x\.x\s*\| :white_check_mark: \|/);
  assert.match(content, /2\.0\.0[^\n]*Unreleased/);
  assert.match(content, /not evidence of a published 2\.x release/);
  assert.match(content, /development vulnerabilities[^\n]*same private reporting channels/i);
  assert.match(content, /does not add a maintenance or backport commitment/);
});

test('supply-chain threat separates current repository controls from planned protections', () => {
  const content = fs.readFileSync('docs/THREAT_MODEL.md', 'utf8');
  const supplyChain = content.split('### 2.7 Supply Chain')[1]?.split('\n---')[0];
  assert.ok(supplyChain, 'supply-chain threat section is required');
  const [current, planned] = supplyChain.split('**Planned controls (not implemented)**:');
  assert.match(current, /dependency[^\n]*lockfile[^\n]*CI[^\n]*publish/i);
  assert.match(current, /\*\*Current controls\*\*/);
  assert.match(current, /undici[^\n]*optional[^\n]*express/i);
  assert.match(current, /npm ci[^\n]*package-lock\.json/);
  assert.match(current, /npm audit --omit=dev[^\n]*does not cover development dependencies/);
  assert.match(current, /npm pack --dry-run/);
  assert.match(current, /no publishing workflow/);
  assert.ok(planned, 'future protections must be explicitly marked as unimplemented');
  assert.match(planned, /dependency[^\n]*lockfile[^\n]*review/i);
  assert.match(planned, /immutable commit SHAs/);
  assert.match(planned, /provenance[^\n]*signing/);
});
