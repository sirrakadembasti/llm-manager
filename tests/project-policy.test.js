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

test('computed passwords, parameter defaults and namespaced UI labels are not credentials', () => {
  for (const source of [
    'let password = process.env.LLM_BACKUP_PASSWORD || process.env.LLM_ADMIN_PASSWORD;',
    "else if (args[i] === '-w' || args[i] === '--password') password = String(args[++i] || '');",
    "    password = readEnv(path.join(cwd, '.env')).LLM_ADMIN_PASSWORD;",
    "const password = crypto.randomBytes(24).toString('hex');",
    'function f({ adminPassword: password = adminPassword, user } = {}) {}',
    'const handler = ({ password = defaults.password }) => password;',
    'password = await vault.read(name);',
    '"form.api_key": "API anahtarı",',
    '"form.password_placeholder": "Parolanızı girin",'
  ])
    assert.equal(hasProjectSecret(source), false, source);
});

test('fallback literals, unquoted config values and dotted keys with token-like values stay excluded', () => {
  for (const source of [
    "const password = process.env.DB_PASSWORD || 'fallback-private-value';",
    'let password = config.password ?? "fallback-private-value";',
    'password = hunter2',
    'Server=db;Password=actual.private.value;',
    '{"db.password": "hunter2"}',
    'config.apiKey = "sk-syntheticprivatevalue123456789";'
  ])
    assert.equal(hasProjectSecret(source), true, source);
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
