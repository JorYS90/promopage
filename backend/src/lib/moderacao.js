// Moderação de conteúdo — bloqueia queries com termos proibidos antes de
// mandar pra fontes externas (Bing/etc.) ou processar uploads.
//
// Política: blacklist conservadora focada em CATEGORIAS claramente fora do
// escopo (encartes de mercado/varejo). Não bloqueia ambíguos (ex: "vinho" OK,
// "cerveja" OK, "carne suína" OK — apesar de restrições religiosas, não é
// nosso papel filtrar).
//
// Como adicionar termos: edite as listas abaixo e reinicie o backend.
// Lista deliberadamente em PT-BR (mercado-alvo) + termos EN comuns.

const TERMOS_PROIBIDOS = [
  // Pornografia / conteúdo adulto
  'porno', 'pornô', 'porn', 'xxx', 'sexo', 'sex', 'nude', 'nudez', 'nudes',
  'naked', 'erotic', 'erótico', 'erotica', 'erótica',
  'hentai', 'incest', 'incesto',
  'pussy', 'dick', 'cock', 'penis', 'pênis', 'vagina',
  'boquete', 'masturbação', 'masturbacao',

  // Drogas ilícitas
  'cocaine', 'cocaína', 'cocaina', 'crack', 'maconha', 'marijuana', 'weed',
  'heroína', 'heroina', 'heroin', 'lsd', 'meth', 'metanfetamina',
  'mdma', 'ecstasy', 'ecstasy',

  // Armas (foco em ilícitas)
  'arma de fogo', 'pistola 9mm', 'fuzil', 'metralhadora',

  // Outros ilícitos
  'pedofilia', 'pedophile', 'menor de idade nu',
];

function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Versões sem acento dos termos pra match após normalização
const TERMOS_NORMALIZADOS = TERMOS_PROIBIDOS.map(normalizar);

/**
 * Retorna true se a query contém algum termo proibido.
 * Match por whole word/substring — "porno" pega "pornografia", "pornôs", etc.
 * "sexo" pega como palavra inteira (não pega "sexta-feira" porque normalização
 * converte espaços em ' ' e fronteiras de palavra são respeitadas).
 */
function queryProibida(query) {
  if (!query) return false;
  const q = normalizar(query);
  if (!q) return false;
  // Tokens da query (palavras inteiras)
  const tokens = q.split(' ');
  for (const proibido of TERMOS_NORMALIZADOS) {
    const tokensProibido = proibido.split(' ');
    if (tokensProibido.length === 1) {
      // Match exato de palavra inteira (evita falso positivo tipo "sexta")
      if (tokens.includes(tokensProibido[0])) return true;
    } else {
      // Frase multi-palavra: busca substring com fronteiras
      if (q.includes(proibido)) return true;
    }
  }
  return false;
}

/**
 * Versão verbose: retorna { proibida, termo } pra log/debug.
 */
function classificar(query) {
  if (!query) return { proibida: false };
  const q = normalizar(query);
  if (!q) return { proibida: false };
  const tokens = q.split(' ');
  for (let i = 0; i < TERMOS_NORMALIZADOS.length; i++) {
    const proibido = TERMOS_NORMALIZADOS[i];
    const tokensProibido = proibido.split(' ');
    if (tokensProibido.length === 1) {
      if (tokens.includes(tokensProibido[0])) {
        return { proibida: true, termo: TERMOS_PROIBIDOS[i] };
      }
    } else {
      if (q.includes(proibido)) return { proibida: true, termo: TERMOS_PROIBIDOS[i] };
    }
  }
  return { proibida: false };
}

// ===================================================================
// FILTRAGEM DE RESULTADOS (defense-in-depth)
// Mesmo com SafeSearch nas fontes (Bing/Google/etc.), conteúdo adulto às vezes
// vaza. Aqui filtramos os RESULTADOS (URL + título) por domínios adultos
// conhecidos e termos explícitos, ANTES de devolver ao usuário.
// ===================================================================

// Domínios de conteúdo adulto — match por substring no hostname.
const DOMINIOS_ADULTOS = [
  'pornhub', 'xvideos', 'xnxx', 'redtube', 'youporn', 'xhamster', 'spankbang',
  'onlyfans', 'fansly', 'rule34', 'nhentai', 'e-hentai', 'ehentai', 'hanime',
  'erome', 'motherless', 'porntrex', 'eporner', 'tnaflix', 'beeg', 'tube8',
  'youjizz', 'fapello', 'brazzers', 'bangbros', 'naughtyamerica', 'realitykings',
  'chaturbate', 'stripchat', 'livejasmin', 'camsoda', 'myfreecams', 'bongacams',
  'manyvids', 'clips4sale', 'adultempire', 'redgifs', 'imagefap', 'pornpics',
  'sexvid', 'txxx', 'hclips', 'upornia', 'gotporn', 'drtuber', 'nuvid',
  'porn300', 'javhd', 'javbus', 'javlibrary', 'cumlouder', 'gelbooru',
  'danbooru', 'sankakucomplex', 'hentai-foundry', 'thumbzilla',
  'porn', 'xxx', 'hentai', 'sexo', 'erotik', 'escort',
];

// Termos explícitos pra checar (palavra inteira) no caminho da URL e no título.
// Whole-word só (evita falso positivo: "sexta-feira", "essex" etc.).
const TERMOS_IMAGEM_PROIBIDOS = [
  'porn', 'porno', 'xxx', 'sex', 'sexo', 'sexy', 'nude', 'nudes', 'nua', 'nuas',
  'naked', 'nsfw', 'erotic', 'erotica', 'erotico', 'erotica', 'hentai', 'bdsm',
  'bondage', 'fetish', 'milf', 'anal', 'blowjob', 'creampie', 'cumshot',
  'pussy', 'dick', 'cock', 'boobs', 'tits', 'titties', 'nipple', 'gangbang',
  'deepthroat', 'hardcore', 'camgirl', 'escort', 'upskirt', 'voyeur', 'boquete',
];

/**
 * true se a URL (domínio/caminho) ou o título indicam conteúdo adulto.
 */
function imagemProibida(url, titulo = '') {
  if (!url) return true;  // sem URL = descarta
  let u = String(url).toLowerCase();
  try { u = decodeURIComponent(u); } catch { /* mantém */ }

  // 1) Domínio adulto conhecido
  let host = u;
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { /* usa string toda */ }
  for (const d of DOMINIOS_ADULTOS) {
    if (host.includes(d)) return true;
  }

  // 2) Termos explícitos (palavra inteira) no caminho da URL ou no título
  const alvo = normalizar(`${u} ${titulo}`);
  const tokens = new Set(alvo.split(' '));
  for (const t of TERMOS_IMAGEM_PROIBIDOS) {
    if (tokens.has(t)) return true;
  }
  return false;
}

/**
 * Filtra uma lista de resultados {imagem, nome}, removendo conteúdo adulto.
 */
function filtrarImagensSeguras(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter(r => r && r.imagem && !imagemProibida(r.imagem, r.nome || r.titulo || ''));
}

module.exports = { queryProibida, classificar, normalizar, imagemProibida, filtrarImagensSeguras };
