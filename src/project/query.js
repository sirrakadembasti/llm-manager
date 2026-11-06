const genericWords = new Set(
  'uygulama uygulamayi uygulamanin proje projeyi projenin hakkinda bilgi ver verir misin bana lutfen lütfen öncelikle oncelikle önce once anlat tanit tanıt tanitim tanıtım açikla acikla genel bakiş bakis overview application app project about information give tell explain describe please first the a an of for and what does this do is can you me ile ve bir nasil nasıl nedir'.split(
    ' '
  )
);

const foldTurkish = word => word.replace(/[şğüöç]/g, c => ({ ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c' })[c]);

// General Turkish → English software vocabulary, matched on ASCII-folded
// whole words. A stem is followed by any Turkish suffix (\w*) unless the
// pattern lists explicit endings to avoid collisions (sil/silah, ara/araç).
const concept = (pattern, aliases) => [new RegExp(`^(?:${pattern})$`), aliases];
const concepts = [
  // Identity and access
  concept('giris\\w*|oturum\\w*', ['login', 'signin', 'session', 'auth']),
  concept('cikis\\w*', ['logout']),
  concept('yetki\\w*|izin\\w*', ['auth', 'authorization', 'permission', 'role']),
  concept('yonetici\\w*', ['admin', 'role']),
  concept('rol(?:u|ler\\w*|e|de|den|un)?', ['role']),
  concept('kullanici\\w*', ['user', 'users', 'account']),
  concept('sifre\\w*|parola\\w*', ['password', 'credential']),
  concept('kayit\\w*|kaydi\\w*|kaydol\\w*', ['register', 'signup', 'record']),
  concept('kaydet\\w*|kaydedil\\w*', ['save']),
  concept('dogrula\\w*', ['verify', 'validate', 'validation']),
  concept('sifirla\\w*', ['reset']),
  concept('grup\\w*', ['group']),
  // Workflow
  concept('talep\\w*|taleb\\w*|istek\\w*', ['request']),
  concept('onay\\w*', ['approve', 'approval', 'confirm']),
  concept('redd\\w*|ret|reti\\w*', ['reject']),
  concept('teslim\\w*', ['delivery', 'deliver']),
  concept('tutana\\w*', ['report', 'record', 'receipt', 'minutes']),
  concept('rapor\\w*', ['report']),
  concept('yazdir\\w*', ['print']),
  concept('bildirim\\w*', ['notification', 'notify']),
  concept('posta\\w*|eposta\\w*', ['email', 'mail']),
  concept('mesaj\\w*', ['message']),
  concept('yorum\\w*', ['comment', 'review']),
  concept('takvim\\w*', ['calendar']),
  concept('randevu\\w*', ['appointment']),
  concept('zamanla\\w*', ['schedule', 'scheduler', 'cron', 'job']),
  concept('kuyruk\\w*', ['queue']),
  // Commerce and inventory
  concept('siparis\\w*', ['order', 'orders']),
  concept('urun\\w*', ['product', 'products']),
  concept('stok\\w*', ['stock', 'inventory']),
  concept('depo(?:su|lar\\w*|da|dan|ya|nun)?', ['warehouse', 'storage']),
  concept('malzeme\\w*', ['material', 'item']),
  concept('musteri\\w*', ['customer', 'client']),
  concept('fatura\\w*', ['invoice', 'billing']),
  concept('odem\\w*', ['payment', 'pay']),
  concept('fiyat\\w*', ['price']),
  concept('indirim\\w*', ['discount']),
  concept('miktar\\w*', ['quantity', 'amount']),
  concept('sepet\\w*', ['cart', 'basket']),
  concept('kargo\\w*', ['shipping', 'shipment']),
  concept('adres\\w*', ['address']),
  concept('kategori\\w*', ['category']),
  concept('etiket\\w*', ['tag', 'label']),
  concept('abonelik\\w*', ['subscription']),
  concept('personel\\w*|calisan\\w*', ['employee', 'staff']),
  // Application layers
  concept('kontrolcu\\w*|denetleyici\\w*', ['controller']),
  concept('veritaban\\w*', [
    'database',
    'db',
    'schema',
    'model',
    'table',
    'migration',
    'orm',
    'sql',
    'prisma',
    'sequelize',
    'typeorm',
    'mongoose',
    'knex',
    'sqlalchemy'
  ]),
  concept('tablo\\w*', ['table', 'schema']),
  concept('sema(?:si|lar\\w*|ya|da|nin)?', ['schema']),
  concept('kolon\\w*|sutun\\w*', ['column']),
  concept('sorgu\\w*', ['query']),
  concept('rota\\w*|yonlendir\\w*', ['route', 'router', 'routes']),
  concept('servis\\w*|hizmet\\w*', ['service']),
  concept('arayuz\\w*', ['ui', 'interface', 'frontend']),
  concept('ekran\\w*', ['screen', 'view']),
  concept('sayfa\\w*', ['page', 'view']),
  concept('bilesen\\w*', ['component']),
  concept('dugme\\w*|buton\\w*', ['button']),
  concept('pano\\w*', ['dashboard']),
  concept('dosya\\w*', ['file']),
  concept('yukle\\w*', ['upload']),
  concept('indir(?:me\\w*|il\\w*|en|di\\w*|ebil\\w*)?', ['download']),
  // Operations on data
  concept('ara(?:ma\\w*|n\\w*|yor\\w*)', ['search']),
  concept('liste\\w*', ['list']),
  concept('sil(?:me\\w*|in\\w*|di\\w*|er|ecek\\w*)?', ['delete', 'remove']),
  concept('guncelle\\w*', ['update']),
  concept('ekle(?:me\\w*|n\\w*|di\\w*|r|yen)?', ['add', 'create']),
  concept('olustur\\w*', ['create']),
  concept('hata\\w*', ['error', 'exception']),
  concept('ayar\\w*|yapilandir\\w*', ['settings', 'config']),
  concept('dagitim\\w*', ['deploy', 'deployment']),
  concept('onbellek\\w*', ['cache'])
];

export function projectWords(value) {
  const split = String(value)
    .normalize('NFKC')
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2');
  return (
    split
      .toLocaleLowerCase('tr-TR')
      .replaceAll('ı', 'i')
      .match(/[\p{L}\p{N}]+/gu) || []
  );
}

export function projectQuery(question) {
  const words = projectWords(question);
  const terms = [...new Set(words.filter(word => word.length >= 2 && !genericWords.has(word)))];
  // Bridge Turkish product questions to common English code identifiers.
  // Aliases translate the question word itself; they never infer a project's
  // stack or domain. Whole-word matching keeps "ver" away from "server".
  const folded = words.map(foldTurkish);
  for (const [pattern, aliases] of concepts)
    if (folded.some(word => pattern.test(word)))
      for (const alias of aliases) if (!terms.includes(alias)) terms.push(alias);
  const overview =
    words.some(word =>
      /^(?:uygulama\p{L}*|proje\p{L}*|application|app|project|overview|mimari\p{L}*|architecture|teknoloji\p{L}*|stack)$/u.test(
        word
      )
    ) &&
    (terms.length === 0 ||
      words.some(word =>
        /^(?:hakkinda|bilgi|tanit|tanıt|tanitim|tanıtım|genel|overview|mimari\p{L}*|architecture|teknoloji\p{L}*|stack|about|describe|explain)$/u.test(
          word
        )
      ));
  return { terms, overview };
}
