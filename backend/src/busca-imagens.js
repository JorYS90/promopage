const fs = require('fs');
const path = require('path');
const https = require('https');
const { nanoid } = require('nanoid');
const { filtrarImagensSeguras } = require('./lib/moderacao');

const CACHE_IMG_DIR = path.join(__dirname, '..', 'uploads', 'produtos');

function fetchJson(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'EncarteBuilder/1.0 (contato@encartebuilder.local)',
        'Accept': 'application/json',
        ...extraHeaders,
      },
      timeout: 4000, // reduzido de 8000 em 2026-05-17 (latência > 21s em prod)
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Se vier HTML em vez de JSON: log curto, sem despejar o HTML
        if (data.trim().startsWith('<')) {
          return reject(new Error(`HTTP ${res.statusCode} retornou HTML`));
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON inválido')); }
      });
    });
    req.on('error', reject);
    // CRITICAL: node `timeout` option só DISPARA o event, não aborta. Sem este
    // handler, o request fica pendurado mesmo após o timeout — daí 21s/produto.
    req.on('timeout', () => { req.destroy(new Error('Timeout 4s')); });
  });
}

function downloadImagem(url) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(CACHE_IMG_DIR, { recursive: true });
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const filename = `${Date.now()}-${nanoid(6)}${ext.split('?')[0]}`;
    const localPath = path.join(CACHE_IMG_DIR, filename);

    const fazerRequest = (urlAlvo, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Muitos redirecionamentos'));
      const req = https.get(urlAlvo, {
        headers: { 'User-Agent': 'Mozilla/5.0 EncarteBuilder/1.0' },
        timeout: 8000, // download de imagem pode ser maior que API call (até 1-2MB)
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fazerRequest(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(localPath);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(`/uploads/produtos/${filename}`); });
        file.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('Download timeout 8s')); });
    };
    fazerRequest(url);
  });
}

// Open Food Facts: produtos de mercado/alimentação (>2 milhões cadastrados)
// Endpoint search.openfoodfacts.org é mais estável que world.openfoodfacts.org/api/v2/search
// (que estava retornando HTML em algumas requisições, possivelmente rate-limit/CF challenge).
async function buscarOpenFoodFacts(query, limite = 12) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?` +
    `search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1` +
    `&fields=code,product_name,product_name_pt,brands,categories_tags,image_front_url,image_url` +
    `&page_size=${limite}` +
    `&countries_tags=brazil`;

  try {
    const json = await fetchJson(url);
    if (!json.products) return [];
    return filtrarImagensSeguras(json.products
      .filter(p => p.image_front_url || p.image_url)
      .map(p => ({
        nome: p.product_name_pt || p.product_name || 'Sem nome',
        marca: p.brands || '',
        categoria: detectarCategoria(p.categories_tags || []),
        codigoBarras: p.code || '',
        imagem: p.image_front_url || p.image_url,
        fonte: 'openfoodfacts',
      })));
  } catch (e) {
    // OFF/Cloudflare frequentemente retorna 503/HTML. Não loga toda vez pra não floodar.
    // Se quiser ver, descomenta a linha abaixo.
    // console.error('[off]', e.message);
    return [];
  }
}

function detectarCategoria(tags) {
  const map = [
    { tag: 'beverages', cat: 'Bebidas' },
    { tag: 'dairies', cat: 'Laticínios' },
    { tag: 'meats', cat: 'Açougue' },
    { tag: 'breads', cat: 'Padaria' },
    { tag: 'fruits', cat: 'Hortifruti' },
    { tag: 'vegetables', cat: 'Hortifruti' },
    { tag: 'snacks', cat: 'Snacks' },
    { tag: 'cleaning', cat: 'Limpeza' },
    { tag: 'hygiene', cat: 'Higiene' },
  ];
  for (const tag of tags) {
    const t = tag.toLowerCase();
    for (const m of map) if (t.includes(m.tag)) return m.cat;
  }
  return 'Mercearia';
}

// Bing Image Search via scraping. Tenta o padrão JSON-em-attribute (mais estável)
// e cai pra padrões alternativos se a estrutura mudar.
async function buscarBingImages(query, limite = 12) {
  const cacheKey = `bing:${query}:${limite}`;
  const cacheado = cacheBuscaGet(cacheKey);
  if (cacheado) return cacheado;
  const r = await _buscarBingImagesNoCache(query, limite);
  cacheBuscaSet(cacheKey, r);
  return r;
}
async function _buscarBingImagesNoCache(query, limite = 12) {
  try {
    // adlt=strict + safesearch=strict force Bing SafeSearch máximo (filtra
    // adulto/violência). Cookie SRCHHPGUSR adicional reforça (Bing às vezes
    // ignora só o querystring quando vem de IP novo).
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&mkt=pt-BR&safesearch=strict&adlt=strict`;
    const html = await fetchText(url, {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Cookie': 'SRCHHPGUSR=ADLT=STRICT',
    });

    const resultados = [];
    const vistos = new Set();
    const adicionar = (imagem, titulo) => {
      if (!imagem || !/^https?:\/\//.test(imagem)) return;
      if (vistos.has(imagem)) return;
      vistos.add(imagem);
      resultados.push({
        nome: titulo || query,
        marca: '',
        categoria: 'Geral',
        codigoBarras: '',
        imagem,
        fonte: 'bing',
      });
    };

    // Padrão 1 (preferencial): JSON em m="..." no <a class="iusc">.
    // Tem murl (URL real), t (título), turl (thumbnail).
    for (const m of html.matchAll(/<a[^>]*class="iusc"[^>]*m="([^"]+)"/g)) {
      try {
        const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const meta = JSON.parse(decoded);
        if (meta.murl) adicionar(meta.murl, meta.t);
      } catch {}
      if (resultados.length >= limite) break;
    }

    // Padrão 2 (alternativo): mediaurl="..." dentro de <a class="iusc">
    if (resultados.length < limite) {
      for (const m of html.matchAll(/mediaurl=([^&"]+)&[^"]*?(?:t=([^&"]*))?/g)) {
        try {
          const u = decodeURIComponent(m[1]);
          const titulo = m[2] ? decodeURIComponent(m[2].replace(/\+/g, ' ')) : query;
          adicionar(u, titulo);
        } catch {}
        if (resultados.length >= limite) break;
      }
    }

    if (resultados.length === 0) {
      console.warn(`[bing] 0 resultados pra "${query}" (HTML ${html.length} chars). Possível mudança de layout.`);
    }

    return filtrarImagensSeguras(resultados.slice(0, limite));
  } catch (e) {
    console.error('Erro Bing:', e.message);
    return [];
  }
}

// Google Images via scraping. Tenta múltiplos padrões pra sobreviver a mudanças no HTML.
// Modern Google embeda dados de imagem em arrays JSON dentro de scripts AF_initDataCallback —
// formato `["URL", [W, H], "title", ...]`. O modo `udm=2` força a UI moderna de imagens
// (mais consistente que gbv=1 antigo, que está sendo removido).
async function buscarGoogleImages(query, limite = 12) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=2&hl=pt-BR&gl=br&safe=active`;
    const html = await fetchText(url, {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    });

    const vistos = new Set();
    const resultados = [];
    const adicionar = (imagem, titulo) => {
      if (!imagem || !/^https?:\/\//.test(imagem)) return;
      if (imagem.includes('gstatic.com/images')) return; // descarta sprites/ícones do Google
      if (vistos.has(imagem)) return;
      vistos.add(imagem);
      resultados.push({
        nome: titulo || query,
        marca: '',
        categoria: 'Geral',
        codigoBarras: '',
        imagem,
        fonte: 'google',
      });
    };

    // Padrão 1 (moderno): arrays JSON `["URL", W, H]` dentro de scripts.
    // Pega URLs de imagens reais (.jpg/.png/.webp) com título embutido em [..., "title"]
    // se aparecer adjacente.
    for (const m of html.matchAll(/\["(https?:\\?\/\\?\/[^"]+\.(?:jpg|jpeg|png|webp|gif))(?:\?[^"]*)?",\s*(\d+),\s*(\d+)\]/gi)) {
      const url = m[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      adicionar(url, query);
      if (resultados.length >= limite) break;
    }

    // Padrão 2 (legacy): /imgres?imgurl=ENCODED_URL
    if (resultados.length < limite) {
      for (const m of html.matchAll(/imgurl=([^&"]+)&[^"]*?(?:imgrefurl=([^&"]*))?/g)) {
        try {
          const u = decodeURIComponent(m[1]);
          adicionar(u, query);
        } catch {}
        if (resultados.length >= limite) break;
      }
    }

    // Padrão 3: "ou":"URL" (data layer antigo)
    if (resultados.length < limite) {
      for (const m of html.matchAll(/"ou":"(https?:[^"]+)"/g)) {
        adicionar(m[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&'), query);
        if (resultados.length >= limite) break;
      }
    }

    // Padrão 4: <img src="URL"> direto no HTML (incluindo data-src)
    if (resultados.length < limite) {
      for (const m of html.matchAll(/<img[^>]+(?:src|data-src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))(?:\?[^"]*)?"[^>]*?(?:alt="([^"]*)")?/gi)) {
        adicionar(m[1], m[2] || query);
        if (resultados.length >= limite) break;
      }
    }

    // Google bloqueia scraping desde 2024 (exige JS). Não loga toda vez — apenas
    // se passar a funcionar de novo.
    return filtrarImagensSeguras(resultados.slice(0, limite));
  } catch (e) {
    return [];
  }
}

// Valida se uma URL de imagem responde com 200 OK (HEAD ou GET com timeout curto)
function validarUrlImagem(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!url || !/^https?:\/\//.test(url)) return resolve(false);
    const finished = (ok) => {
      if (timeout) clearTimeout(timeout);
      resolve(ok);
    };
    let timeout = setTimeout(() => finished(false), timeoutMs);

    const fazerRequest = (urlAlvo, redirects = 0) => {
      if (redirects > 5) return finished(false);
      try {
        const req = https.get(urlAlvo, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
            'Accept': 'image/*,*/*;q=0.8',
          },
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fazerRequest(res.headers.location, redirects + 1);
          }
          finished(res.statusCode === 200);
        });
        req.on('error', () => finished(false));
        req.end();
      } catch { finished(false); }
    };
    fazerRequest(url);
  });
}

// Procura primeira URL válida em uma lista de resultados (testa até N em paralelo)
async function primeiraUrlValida(resultados, maxTentativas = 5) {
  const candidatos = resultados.slice(0, maxTentativas);
  // Testa em paralelo, retorna a 1ª que validou
  const checks = candidatos.map(async (r) => ({ r, ok: await validarUrlImagem(r.imagem) }));
  for (const promise of checks) {
    const { r, ok } = await promise;
    if (ok) return r;
  }
  return null;
}

// HTTP GET genérico (texto). Segue até 5 redirects (Yandex/Google às vezes redirecionam
// pra subdomínios geográficos), descomprime gzip/deflate, retorna texto.
const zlib = require('zlib');
function fetchText(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Muitos redirects'));
    let req;
    try {
      req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          ...headers,
        },
        timeout: 5000, // reduzido de 12000 em 2026-05-17 (latência > 21s em prod)
      }, (res) => {
        // Redirect: segue Location
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          res.resume(); // descarta body
          return fetchText(next, headers, redirects + 1).then(resolve, reject);
        }
        // Descomprime se necessário
        const enc = res.headers['content-encoding'];
        let stream = res;
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

        const chunks = [];
        stream.on('data', c => chunks.push(c));
        stream.on('end', () => {
          try { resolve(Buffer.concat(chunks).toString('utf8')); }
          catch (e) { reject(e); }
        });
        stream.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('Timeout 5s')); });
    } catch (e) { reject(e); }
  });
}

// ===== GOOGLE CUSTOM SEARCH API (oficial, qualidade Google nativa) =====
// Plano gratuito: 100 queries/dia. Usa endpoint v1 da Custom Search JSON API.
// Config: backend/data/google-cse-config.json com { apiKey, cx }
// Tracking: backend/data/google-cse-quota.json com { data: 'YYYY-MM-DD', usados: N }
const fsPath = require('path');
const fsLib = require('fs');
const CSE_CONFIG_FILE = fsPath.join(__dirname, '..', 'data', 'google-cse-config.json');
const CSE_QUOTA_FILE = fsPath.join(__dirname, '..', 'data', 'google-cse-quota.json');
const CSE_QUOTA_DIARIA = 100;

function lerConfigCSE() {
  try {
    if (!fsLib.existsSync(CSE_CONFIG_FILE)) return null;
    const cfg = JSON.parse(fsLib.readFileSync(CSE_CONFIG_FILE, 'utf8'));
    if (!cfg.apiKey || !cfg.cx) return null;
    return cfg;
  } catch { return null; }
}

function lerQuotaCSE() {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    if (!fsLib.existsSync(CSE_QUOTA_FILE)) return { data: hoje, usados: 0 };
    const q = JSON.parse(fsLib.readFileSync(CSE_QUOTA_FILE, 'utf8'));
    if (q.data !== hoje) return { data: hoje, usados: 0 };
    return q;
  } catch { return { data: hoje, usados: 0 }; }
}

function salvarQuotaCSE(quota) {
  try {
    fsLib.mkdirSync(fsPath.dirname(CSE_QUOTA_FILE), { recursive: true });
    fsLib.writeFileSync(CSE_QUOTA_FILE, JSON.stringify(quota, null, 2));
  } catch {}
}

async function buscarGoogleCSE(query, limite = 10) {
  const cacheKey = `gcse:${query}:${limite}`;
  const cacheado = cacheBuscaGet(cacheKey);
  if (cacheado) return cacheado;

  const cfg = lerConfigCSE();
  if (!cfg) return [];

  const quota = lerQuotaCSE();
  if (quota.usados >= CSE_QUOTA_DIARIA) {
    console.warn(`[gcse] quota diária atingida (${quota.usados}/${CSE_QUOTA_DIARIA}). Reset à 00:00 UTC.`);
    return [];
  }

  // Google CSE max 10 resultados por chamada. Pode pedir start=11 pra próxima página.
  const num = Math.min(10, limite);
  const url = `https://www.googleapis.com/customsearch/v1?` +
    `key=${cfg.apiKey}&cx=${cfg.cx}&q=${encodeURIComponent(query)}` +
    `&searchType=image&num=${num}&safe=active&gl=br&lr=lang_pt`;

  try {
    const json = await fetchJson(url);
    quota.usados += 1;
    salvarQuotaCSE(quota);

    if (!json.items) {
      if (json.error) console.warn('[gcse] erro API:', json.error.message);
      cacheBuscaSet(cacheKey, []);
      return [];
    }

    const resultados = filtrarImagensSeguras(json.items.map(item => ({
      nome: item.title || query,
      marca: '',
      categoria: 'Geral',
      codigoBarras: '',
      imagem: item.link,
      thumb: item.image?.thumbnailLink || null,
      fonte: 'gcse',
    })));
    console.log(`[gcse] q="${query}" → ${resultados.length} resultados (quota: ${quota.usados}/${CSE_QUOTA_DIARIA})`);
    cacheBuscaSet(cacheKey, resultados);
    return resultados;
  } catch (e) {
    console.error('[gcse] falha:', e.message);
    return [];
  }
}

function statsCSE() {
  const cfg = lerConfigCSE();
  const quota = lerQuotaCSE();
  return {
    configurado: !!cfg,
    quotaDiaria: CSE_QUOTA_DIARIA,
    usadosHoje: quota.usados,
    restantes: Math.max(0, CSE_QUOTA_DIARIA - quota.usados),
    data: quota.data,
  };
}

// ===== SISTEMA DE PONTUAÇÃO DE FONTES =====
// Atribui um "score" a cada URL de imagem baseado no domínio. CDNs de varejistas
// (vtexassets, mlstatic) recebem score alto = aparecem primeiro. Redes sociais e
// thumbnails genéricos recebem score baixo. Permite ordenar resultados de várias
// fontes por qualidade, mantendo apenas o melhor da pilha visível pro usuário.
//
// Estratégia inspirada em qrofertas: eles têm CDN curado próprio, mas a maioria
// das fotos boas que indexam vem desses mesmos domínios de varejo.
const DOMINIOS_VAREJO = [
  // VTEX-based BR (alta confiança: foto de produto profissional em fundo branco)
  'vtexassets.com', 'vteximg.com.br',
  // Plataformas de e-commerce BR
  'mlstatic.com',           // Mercado Livre
  'magazinevoce.com.br', 'magazineluiza.com.br',
  'americanas.com.br', 'submarino.com.br', 'shoptime.com.br',
  'casasbahia.com.br', 'extra.com.br', 'pontofrio.com.br',
  'amazon.com.br',
  // Supermercados específicos
  'shopee.com.br',
  'ifood-static.com.br', 'static.ifood-static.com.br',
  // Storage CDNs comuns em e-commerce
  'cloudfront.net', 'akamaized.net', 'amazonaws.com',
  // Brand sites brasileiros
  'sadia.com.br', 'seara.com.br', 'friboi.com.br', 'aurora.com.br',
];
const DOMINIOS_BAIXA_QUALIDADE = [
  // Redes sociais com conteúdo aleatório
  'cdninstagram.com', 'fbcdn.net', 'twimg.com', 'tiktokcdn.com',
  // Avatares/perfis
  'gravatar.com',
];
function pontuarFonte(url) {
  if (!url) return -100;
  const u = url.toLowerCase();
  for (const dom of DOMINIOS_VAREJO) {
    if (u.includes(dom)) return 10;  // ALTA confiança
  }
  for (const dom of DOMINIOS_BAIXA_QUALIDADE) {
    if (u.includes(dom)) return -5;  // BAIXA confiança
  }
  // Domínios médios (YouTube thumbs, Pinterest, Wikimedia, sites gerais)
  if (u.includes('ytimg.com')) return -2;          // thumbnails de vídeo (relevante mas não foto de produto)
  if (u.includes('pinimg.com')) return 0;          // Pinterest variável
  if (u.includes('wikimedia.org')) return 3;       // Wikimedia geralmente correto
  if (u.includes('shopify')) return 8;             // lojas em Shopify
  if (u.includes('wp.com')) return 2;              // proxy genérico
  return 1; // default neutro
}

// Cache em memória de buscas Yandex/Bing/etc — TTL 5 minutos.
// Evita repetir a mesma chamada externa quando o usuário pesquisa o mesmo termo
// várias vezes (ex: digitando lista, usando modal de troca, recarregando).
const CACHE_BUSCA = new Map();
const CACHE_BUSCA_TTL_MS = 5 * 60 * 1000;
function cacheBuscaGet(chave) {
  const entry = CACHE_BUSCA.get(chave);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_BUSCA_TTL_MS) {
    CACHE_BUSCA.delete(chave);
    return null;
  }
  return entry.dados;
}
function cacheBuscaSet(chave, dados) {
  CACHE_BUSCA.set(chave, { dados, t: Date.now() });
  // Limita tamanho do cache (evita crescer indefinidamente)
  if (CACHE_BUSCA.size > 200) {
    // Remove a entrada mais antiga
    const primeira = CACHE_BUSCA.keys().next().value;
    CACHE_BUSCA.delete(primeira);
  }
}

// Yandex Image Search via scraping. Cobertura excelente pra produtos BR + internacionais
// porque indexa CDNs de supermercados (Carrefour vtexassets, Festval, Mambo etc.).
// Não tem CAPTCHA pesado como Google, e o HTML expõe metadados em JSON escapado.
async function buscarYandexImages(query, limite = 20) {
  const cacheKey = `yandex:${query}:${limite}`;
  const cacheado = cacheBuscaGet(cacheKey);
  if (cacheado) return cacheado;
  const r = await _buscarYandexImagesNoCache(query, limite);
  cacheBuscaSet(cacheKey, r);
  return r;
}
async function _buscarYandexImagesNoCache(query, limite = 20) {
  try {
    // family=yes + cookie yp/sp = SafeSearch família (Yandex não tem SafeSearch
    // tão forte quanto Bing; o filtro de resultados (filtrarImagensSeguras) é a
    // defesa principal). Yandex é fonte de risco — sempre filtrar o retorno.
    const url = `https://yandex.com/images/search?text=${encodeURIComponent(query)}&family=yes`;
    const html = await fetchText(url, {
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Cookie': 'yp=1900000000.sp.family%3A2',
    });

    const resultados = [];
    const vistos = new Set();

    // Yandex embeda items em JSON HTML-escapado. Cada item tem estrutura:
    //   "preview":[{"url":"https://...jpg",...}],"snippet":{"title":"...","domain":"..."}
    // CRÍTICO: ancorar em "preview":[{"url":..." pra pegar a URL da IMAGEM (não a URL
    // da página do produto que aparece dentro do snippet).
    const itemRegex = /&quot;preview&quot;:\[\{&quot;url&quot;:&quot;(https?:.+?)&quot;[\s\S]{0,3000}?&quot;snippet&quot;:\{&quot;title&quot;:&quot;(.+?)&quot;/gi;

    for (const m of html.matchAll(itemRegex)) {
      const imageUrl = m[1].replace(/\\\//g, '/').replace(/&amp;/g, '&');
      const titulo = m[2]
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .replace(/\\u0026/g, '&')
        .replace(/\\u002F/g, '/');
      if (vistos.has(imageUrl)) continue;
      vistos.add(imageUrl);
      resultados.push({
        nome: titulo,
        marca: '',
        categoria: 'Geral',
        codigoBarras: '',
        imagem: imageUrl,
        fonte: 'yandex',
      });
      if (resultados.length >= limite) break;
    }

    if (resultados.length === 0) {
      console.warn(`[yandex] 0 resultados pra "${query}" (HTML ${html.length} chars). Início HTML: ${html.slice(0, 120).replace(/\s+/g, ' ')}`);
    }

    return filtrarImagensSeguras(resultados.slice(0, limite));
  } catch (e) {
    console.error('Erro Yandex:', e?.message || String(e) || 'erro vazio', e?.code || '');
    return [];
  }
}

// DuckDuckGo Image Search: sem API key, funciona via 2 etapas (token vqd + busca JSON).
// Atende bem produtos brasileiros (carnes, hortifruti, marcas) com fundo geralmente limpo.
async function buscarDuckDuckGo(query, limite = 5) {
  try {
    // Etapa 1: pegar o token vqd
    const htmlInicial = await fetchText(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
    const matchVqd = htmlInicial.match(/vqd=["']?(\d+-\d+(?:-\d+)?)["']?/);
    if (!matchVqd) return [];
    const vqd = matchVqd[1];

    // Etapa 2: buscar imagens
    const urlBusca = `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`;
    const json = await fetchText(urlBusca, {
      'Referer': 'https://duckduckgo.com/',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    });
    let parsed;
    try { parsed = JSON.parse(json); } catch (e) { return []; }
    if (!parsed.results) return [];

    return filtrarImagensSeguras(parsed.results.slice(0, limite).map(r => ({
      nome: r.title || query,
      marca: r.source || '',
      categoria: 'Geral',
      codigoBarras: '',
      imagem: r.image,
      thumb: r.thumbnail,
      fonte: 'duckduckgo',
    })));
  } catch (e) {
    console.error('Erro DuckDuckGo:', e.message);
    return [];
  }
}

// Mapeamento PT→EN para queries genéricas (Wikimedia tem mais material em inglês)
const TRADUCOES_PT_EN = {
  'picanha': 'picanha steak', 'fraldinha': 'flank steak', 'alcatra': 'rump steak',
  'frango': 'chicken', 'peito': 'chicken breast', 'coxa': 'chicken thigh', 'asa': 'chicken wing',
  'carne': 'beef meat', 'porco': 'pork', 'bacon': 'bacon', 'linguica': 'sausage',
  'tomate': 'tomato', 'cebola': 'onion', 'alho': 'garlic', 'batata': 'potato',
  'cenoura': 'carrot', 'alface': 'lettuce', 'banana': 'banana', 'maca': 'apple fruit',
  'laranja': 'orange fruit', 'manga': 'mango', 'abacaxi': 'pineapple',
  'arroz': 'rice', 'feijao': 'beans', 'macarrao': 'pasta', 'farinha': 'flour',
  'leite': 'milk', 'queijo': 'cheese', 'iogurte': 'yogurt', 'manteiga': 'butter',
  'pao': 'bread', 'biscoito': 'cookie', 'bolacha': 'cracker', 'bolo': 'cake',
  'cerveja': 'beer', 'vinho': 'wine', 'refrigerante': 'soda', 'suco': 'juice',
  'agua': 'water bottle', 'cafe': 'coffee', 'cha': 'tea',
  'sabao': 'soap', 'detergente': 'detergent', 'shampoo': 'shampoo',
};

function traduzirQuery(query) {
  const termos = (query || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 3);
  for (const t of termos) {
    if (TRADUCOES_PT_EN[t]) return TRADUCOES_PT_EN[t];
  }
  return query;
}

// Wikimedia Commons: imagens livres genéricas (ótimo para hortifruti/açougue/genéricos).
// Tenta primeiro a query original; se falhar, traduz pra inglês.
async function buscarWikimedia(queryOriginal, limite = 3) {
  let resultado = await _buscarWikimediaRaw(queryOriginal, limite);
  if (resultado.length === 0) {
    const traduzida = traduzirQuery(queryOriginal);
    if (traduzida !== queryOriginal) {
      resultado = await _buscarWikimediaRaw(traduzida, limite);
    }
  }
  return resultado;
}

async function _buscarWikimediaRaw(query, limite) {
  // 1. Busca arquivos com a query
  const buscaUrl = `https://commons.wikimedia.org/w/api.php?` +
    `action=query&format=json&list=search&srlimit=${limite}` +
    `&srnamespace=6` +              // namespace 6 = File
    `&srsearch=${encodeURIComponent(query)}+filetype:bitmap`;

  try {
    const json = await fetchJson(buscaUrl);
    const titulos = (json.query?.search || []).map(r => r.title).slice(0, limite);
    if (!titulos.length) return [];

    // 2. Pega URL real de cada arquivo
    const detalhesUrl = `https://commons.wikimedia.org/w/api.php?` +
      `action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=400` +
      `&titles=${encodeURIComponent(titulos.join('|'))}`;
    const detalhes = await fetchJson(detalhesUrl);
    const paginas = detalhes.query?.pages || {};

    return filtrarImagensSeguras(Object.values(paginas)
      .map(p => {
        const info = p.imageinfo?.[0];
        if (!info) return null;
        return {
          nome: (p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
          marca: '',
          categoria: 'Geral',
          codigoBarras: '',
          imagem: info.thumburl || info.url,
          fonte: 'wikimedia',
        };
      })
      .filter(Boolean));
  } catch (e) {
    console.error('Erro Wikimedia:', e.message);
    return [];
  }
}

// Gera URL de placeholder estilizado (sempre disponível)
function gerarPlaceholderUrl(nome, paleta = 'vermelho') {
  return `/api/placeholder?nome=${encodeURIComponent(nome)}&paleta=${paleta}`;
}

// SVG bonito com gradient + nome (servido pelo endpoint /api/placeholder)
function gerarPlaceholderSVG(nome, paleta = 'vermelho') {
  const PALETAS = {
    vermelho:  ['#ef4444', '#fbbf24'],
    azul:      ['#2563eb', '#60a5fa'],
    verde:     ['#16a34a', '#86efac'],
    laranja:   ['#f97316', '#fde047'],
    rosa:      ['#ec4899', '#fbcfe8'],
    roxo:      ['#7c3aed', '#c4b5fd'],
  };
  const [c1, c2] = PALETAS[paleta] || PALETAS.vermelho;
  const inicial = (nome || '?').trim().charAt(0).toUpperCase();
  const linha2 = (nome || '').toUpperCase().slice(0, 22);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <circle cx="200" cy="170" r="80" fill="rgba(255,255,255,0.25)"/>
    <text x="200" y="200" font-family="Impact, Arial Black, sans-serif" font-size="120" font-weight="900"
          text-anchor="middle" fill="#ffffff">${inicial}</text>
    <text x="200" y="320" font-family="Arial, sans-serif" font-size="22" font-weight="bold"
          text-anchor="middle" fill="#ffffff">${linha2}</text>
  </svg>`;
}

module.exports = { buscarBingImages, buscarGoogleImages, buscarOpenFoodFacts, buscarYandexImages, buscarDuckDuckGo, buscarWikimedia, buscarGoogleCSE, statsCSE, downloadImagem, gerarPlaceholderUrl, gerarPlaceholderSVG, validarUrlImagem, primeiraUrlValida, pontuarFonte };
