import test from 'node:test';
import assert from 'node:assert/strict';
import { hasProjectSecret } from '../src/project/policy.js';

test('safe reactive values and code references are not mistaken for connection passwords', () => {
  for (const source of [
    "const newPassword = ref('');",
    'const showModalPassword = ref(false);',
    "const password = ref('');",
    'const password = ref(false);',
    'const password = request.body.password;',
    'form.password = generateSecurePassword();',
    'let password = undefined;',
    'const pwd = input.value;'
  ])
    assert.equal(hasProjectSecret(source), false, source);
});

test('literal credentials remain excluded, including short quoted values and connection strings', () => {
  for (const source of [
    'password = "synthetic-private-password-value"',
    'const password = "short";',
    '{"password":"short"}',
    "const newPassword = ref('actual-private-password');",
    'Server=localhost;Password=actual-private-value;',
    'Pwd=actual-private-value',
    'postgresql://user:password@host/db',
    '-----BEGIN PRIVATE KEY-----',
    'const apiKey="sk-syntheticprivatevalue123456789";'
  ])
    assert.equal(hasProjectSecret(source), true);
});
