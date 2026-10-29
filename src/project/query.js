const genericWords = new Set(
  'uygulama uygulamayi uygulamanin proje projeyi projenin hakkinda bilgi ver verir misin bana lutfen lütfen öncelikle oncelikle önce once anlat tanit tanıt tanitim tanıtım açikla acikla genel bakiş bakis overview application app project about information give tell explain describe please first the a an of for and what does this do is can you me ile ve bir nasil nasıl nedir'.split(
    ' '
  )
);

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
  // Bridge Turkish product questions to common code identifiers, without
  // treating arbitrary substrings as matches (e.g. "ver" versus "server").
  const concepts = [
    [
      /^(?:giriş\p{L}*|giris\p{L}*|yetki\p{L}*|yönetici\p{L}*|oturum\p{L}*)$/u,
      ['auth', 'login', 'session', 'admin', 'role']
    ],
    [
      /^(?:onay\p{L}*|talep\p{L}*|taleb\p{L}*|kontrolcü\p{L}*)$/u,
      ['request', 'approve', 'controller', 'controllers', 'prisma', 'schema']
    ],
    [/^(?:tutanak\p{L}*|tutana\p{L}*|teslim\p{L}*)$/u, ['delivery', 'receipt', 'print']]
  ];
  for (const [pattern, aliases] of concepts)
    if (words.some(word => pattern.test(word)))
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
