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

test('K12: a bare reassignment from a member reference is code, not a credential', () => {
  for (const source of [
    'password = writtenEnv.LLM_ADMIN_PASSWORD;',
    '  password = env.DB.PASS;',
    'logger(x);\n    password = writtenEnv.LLM_ADMIN_PASSWORD;\n    next();',
    'if (ready) { password = config.admin.password; }'
  ])
    assert.equal(hasProjectSecret(source), false, source);
});

test('K12: bare assignments that can hold a real secret stay excluded', () => {
  for (const source of [
    'password = "hunter2";',
    "password = 'abc' + x;",
    'PASSWORD=hunter2',
    'password = hunter2;',
    'PASSWORD=my.secret.pass',
    'password = my.secret.pass',
    "password = a.b || 'default-secret';",
    "password = a.b ?? 'default-secret';",
    'password = a.b + "tail";'
  ])
    assert.equal(hasProjectSecret(source), true, source);
});

test('maskProjectSecrets replaces only assignment-style secret lines and keeps line numbers', async () => {
  const { maskProjectSecrets } = await import('../src/project/policy.js');
  const source = [
    'import x from "y";',
    '  const password = "hunter2";',
    'run(x);',
    "  apiKey: 'synthetic-value',",
    ''
  ].join('\n');
  const masked = maskProjectSecrets(source);
  assert.equal(masked.count, 2);
  assert.equal(masked.content.split('\n').length, source.split('\n').length);
  assert.deepEqual(masked.content.split('\n'), ['import x from "y";', '  [GİZLENDİ]', 'run(x);', '  [GİZLENDİ]', '']);
  assert.doesNotMatch(masked.content, /hunter2|synthetic-value/);
  assert.equal(hasProjectSecret(masked.content), false);
});

test('maskProjectSecrets keeps CRLF endings and refuses files holding real credential formats', async () => {
  const { maskProjectSecrets } = await import('../src/project/policy.js');
  assert.equal(maskProjectSecrets('a\r\npassword = "hunter2";\r\nb\r\n').content, 'a\r\n[GİZLENDİ]\r\nb\r\n');
  // Hard credential formats and anything the masked text still trips on stay fully excluded.
  assert.equal(maskProjectSecrets('const password = "x";\nconst k = "sk-abcdefghijklmnopqrstuvwxyz";'), null);
  assert.equal(maskProjectSecrets('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'), null);
  assert.equal(maskProjectSecrets('postgresql://user:pass123@localhost/db\npassword = "x";'), null);
  assert.equal(maskProjectSecrets('const a = AKIAABCDEFGHIJKLMNOP;\npassword = "x";'), null);
  assert.equal(maskProjectSecrets('const a = 1;\n'), null);
});
