import test from 'node:test';
import assert from 'node:assert/strict';
import { projectQuery } from '../src/project/query.js';
import { retrieveProjectContext } from '../src/project/retrieval.js';

const includesAll = (terms, expected, label) => {
  for (const term of expected) assert.ok(terms.includes(term), `${label}: ${term} in ${terms.join(',')}`);
};

test('Turkish product questions map to general code vocabulary across domains', () => {
  const cases = [
    ['Fatura ödemesi nasıl alınıyor?', ['invoice', 'payment']],
    ['Siparişler nerede güncelleniyor?', ['order', 'update']],
    ['Kullanıcı şifresi nasıl sıfırlanıyor?', ['user', 'password']],
    ['Müşteri bildirimleri e-posta ile mi gidiyor?', ['customer', 'notification', 'email']],
    ['Ürün stoku hangi tabloda tutuluyor?', ['product', 'stock', 'table']],
    ['Giriş ve yönetici yetkileri nasıl denetleniyor?', ['login', 'auth', 'admin', 'permission']],
    ['Talep onaylandığında kontrolcü veritabanına nasıl yazıyor?', ['request', 'approve', 'controller', 'database']],
    ['Malzeme teslim tutanağı nasıl hazırlanıyor?', ['delivery', 'receipt']],
    ['Raporu yazdırma düğmesi nerede?', ['report', 'print']]
  ];
  for (const [question, expected] of cases) includesAll(projectQuery(question).terms, expected, question);
});

test('concept aliases translate the question words and never infer an unrelated stack or domain', () => {
  const { terms } = projectQuery('Talep onaylandığında ne oluyor?');
  assert.ok(terms.includes('request'));
  for (const unrelated of ['prisma', 'schema', 'controllers', 'print'])
    assert.ok(!terms.includes(unrelated), unrelated);
  assert.ok(!projectQuery('Teslim tarihi nasıl hesaplanıyor?').terms.includes('print'));
});

test('short or prefix-similar words do not trigger concepts', () => {
  const { terms } = projectQuery('araç sınıfı ve silah verisi');
  for (const alias of ['search', 'delete', 'class']) assert.ok(!terms.includes(alias), alias);
});

test('general vocabulary retrieves non-inventory applications', () => {
  const files = [
    { path: 'README.md', content: '# Shop\nE-commerce storefront.' },
    { path: 'src/billing/invoiceService.js', content: 'export function createInvoice(order) {\n  return order;\n}' },
    { path: 'src/payments/gateway.js', content: 'export async function charge(payment) {\n  return payment;\n}' },
    ...Array.from({ length: 10 }, (_, i) => ({
      path: `src/aaa-noise${i}.js`,
      content: 'export const unrelated = true;\n'.repeat(200)
    }))
  ];
  const snapshot = { files, revision: 'c'.repeat(64) };
  const { context } = retrieveProjectContext(snapshot, 'Fatura ve ödeme akışı nasıl çalışıyor?', { budget: 5000 });
  for (const file of ['src/billing/invoiceService.js', 'src/payments/gateway.js'])
    assert.ok(
      context.sources.some(source => source.path === file),
      file
    );
});
