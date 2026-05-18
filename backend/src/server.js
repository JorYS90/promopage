// Carrega variáveis de ambiente do .env ANTES de qualquer require que dependa delas.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const https = require('https');
const { nanoid } = require('nanoid');

const produtosDb = require('./produtos-db');
const imagensDb = require('./imagens-db');
const categoriasDb = require('./categorias-db');

// === SaaS: auth + multi-tenant ===
// Inicializa banco SQLite (cria tabelas se não existir + seeds default)
require('./db/schema');
const authRoutes = require('./auth/routes');
const usersRoutes = require('./auth/users-routes');
const adminRoutes = require('./admin/routes');
const { requireAuth, requireRole } = require('./auth/middleware');
const { buscarBingImages, buscarGoogleImages, buscarOpenFoodFacts, buscarYandexImages, buscarDuckDuckGo, buscarWikimedia, buscarGoogleCSE, statsCSE, downloadImagem, gerarPlaceholderUrl, gerarPlaceholderSVG, primeiraUrlValida, pontuarFonte } = require('./busca-imagens');
const seedProdutos = require('./seed-produtos');
const seedImagensPopulares = require('./seed-imagens-populares');
const cacheImagens = require('./db/cache-imagens');
const moderacao = require('./lib/moderacao');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PROJETOS_DIR = path.join(ROOT, 'projetos');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');

for (const dir of [TEMPLATES_DIR, PROJETOS_DIR, UPLOADS_DIR, DATA_DIR, path.join(UPLOADS_DIR, 'produtos')]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const app = express();

// === Trust proxy ===
// Necessário pra rate-limit ler IP real quando atrás de Nginx/Cloudflare/Load Balancer.
// Em prod sempre estamos atrás de proxy; em dev não atrapalha.
app.set('trust proxy', 1);

// === Helmet — security headers ===
// Aplica: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy,
// Strict-Transport-Security (HSTS) etc. Desliga CSP por enquanto pra não quebrar
// o frontend (canvas inline, etc) — ativar depois com policy custom.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // /uploads precisa carregar de outro origin em dev
}));

// === CORS ===
// Em dev: CORS_ORIGIN vazio → libera tudo (true). Vite proxy também ajuda.
// Em prod: CORS_ORIGIN=https://promopage.com.br (1 ou múltiplos separados por vírgula).
// credentials:true permite enviar cookies (refresh token httpOnly).
const corsOriginEnv = (process.env.CORS_ORIGIN || '').trim();
const corsOrigins = corsOriginEnv
  ? corsOriginEnv.split(',').map(s => s.trim()).filter(Boolean)
  : null;
app.use(cors({
  origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// === Rate limiting ===
// Limiter GLOBAL: protege o servidor de abuso geral (scraping, ataque DDoS leve).
const limiterGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15min
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '300', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas requisições deste IP. Tente novamente em alguns minutos.' },
  // Não limita /api/health (uptime monitoring) nem assets estáticos
  skip: (req) => req.path === '/api/health' || req.path.startsWith('/uploads'),
});
app.use(limiterGlobal);

// Limiter AUTH: anti brute-force em login/signup/forgot-password. Bem mais agressivo.
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de autenticação. Aguarde 15 minutos antes de tentar novamente.' },
});
// Aplica antes das rotas de auth (montadas abaixo)

// === Rotas de autenticação SaaS ===
// /api/auth/signup, /login, /refresh, /logout, /me, /password/forgot, /password/reset
// Rate limit AGRESSIVO em endpoints sensíveis a brute-force:
app.use('/api/auth/login', limiterAuth);
app.use('/api/auth/signup', limiterAuth);
app.use('/api/auth/password/forgot', limiterAuth);
app.use('/api/auth/password/reset', limiterAuth);
app.use('/api/auth', authRoutes);
// /api/users/me, /me/password, /me/subscription, /me/payments, /api/plans
app.use('/api/users', usersRoutes);
app.use('/api', usersRoutes);  // pra /api/plans (rota pública)
// /api/admin/* — gestão administrativa (requer role admin ou super_admin)
app.use('/api/admin', adminRoutes);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Placeholder estilizado (SVG dinâmico) — usado quando nenhuma fonte achou imagem
app.get('/api/placeholder', (req, res) => {
  const nome = (req.query.nome || 'Produto').toString().slice(0, 60);
  const paleta = (req.query.paleta || 'vermelho').toString();
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(gerarPlaceholderSVG(nome, paleta));
});

// Mapa de variantes de unidades → abreviação padrão (mesmas do frontend)
const MAPA_UNIDADES = {
  // peso
  kg: { abrev: 'kg', nome: 'Kilo' },
  kilo: { abrev: 'kg', nome: 'Kilo' }, kilos: { abrev: 'kg', nome: 'Kilo' },
  quilo: { abrev: 'kg', nome: 'Quilo' }, quilos: { abrev: 'kg', nome: 'Quilo' },
  g: { abrev: 'g', nome: 'Grama' }, gr: { abrev: 'g', nome: 'Grama' },
  grama: { abrev: 'g', nome: 'Grama' }, gramas: { abrev: 'g', nome: 'Grama' },
  '100g': { abrev: '100g', nome: '100 Gramas' },
  // volume
  l: { abrev: 'L', nome: 'Litro' }, lt: { abrev: 'L', nome: 'Litro' },
  litro: { abrev: 'L', nome: 'Litro' }, litros: { abrev: 'L', nome: 'Litro' },
  ml: { abrev: 'ml', nome: 'Ml' }, mililitro: { abrev: 'ml', nome: 'Ml' },
  // unidade/contagem
  un: { abrev: 'un', nome: 'Unidade' }, und: { abrev: 'un', nome: 'Unidade' },
  unid: { abrev: 'un', nome: 'Unidade' }, unidade: { abrev: 'un', nome: 'Unidade' },
  unidades: { abrev: 'un', nome: 'Unidade' },
  dz: { abrev: 'dz', nome: 'Dúzia' }, duzia: { abrev: 'dz', nome: 'Dúzia' },
  duzias: { abrev: 'dz', nome: 'Dúzia' }, dúzia: { abrev: 'dz', nome: 'Dúzia' },
  dúzias: { abrev: 'dz', nome: 'Dúzia' },
  cento: { abrev: 'cto', nome: 'Cento' }, centos: { abrev: 'cto', nome: 'Cento' },
  cto: { abrev: 'cto', nome: 'Cento' },
  milheiro: { abrev: 'mil', nome: 'Milheiro' }, mil: { abrev: 'mil', nome: 'Milheiro' },
  // embalagem
  cx: { abrev: 'cx', nome: 'Caixa' }, caixa: { abrev: 'cx', nome: 'Caixa' },
  caixas: { abrev: 'cx', nome: 'Caixa' },
  pct: { abrev: 'pct', nome: 'Pacote' }, pacote: { abrev: 'pct', nome: 'Pacote' },
  pacotes: { abrev: 'pct', nome: 'Pacote' },
  lata: { abrev: 'lt', nome: 'Lata' }, latas: { abrev: 'lt', nome: 'Lata' },
  grf: { abrev: 'grf', nome: 'Garrafa' }, garrafa: { abrev: 'grf', nome: 'Garrafa' },
  garrafas: { abrev: 'grf', nome: 'Garrafa' },
  bdj: { abrev: 'bdj', nome: 'Bandeja' }, bandeja: { abrev: 'bdj', nome: 'Bandeja' },
  bandejas: { abrev: 'bdj', nome: 'Bandeja' },
  sch: { abrev: 'sch', nome: 'Sachê' }, sache: { abrev: 'sch', nome: 'Sachê' },
  sachê: { abrev: 'sch', nome: 'Sachê' }, saches: { abrev: 'sch', nome: 'Sachê' },
  saco: { abrev: 'sc', nome: 'Saco' }, sacos: { abrev: 'sc', nome: 'Saco' },
  sc: { abrev: 'sc', nome: 'Saco' },
  fardo: { abrev: 'fd', nome: 'Fardo' }, fardos: { abrev: 'fd', nome: 'Fardo' },
  fd: { abrev: 'fd', nome: 'Fardo' },
  pote: { abrev: 'pt', nome: 'Pote' }, potes: { abrev: 'pt', nome: 'Pote' },
  balde: { abrev: 'bld', nome: 'Balde' }, baldes: { abrev: 'bld', nome: 'Balde' },
  rolo: { abrev: 'rl', nome: 'Rolo' }, rolos: { abrev: 'rl', nome: 'Rolo' },
  tambor: { abrev: 'tb', nome: 'Tambor' }, tb: { abrev: 'tb', nome: 'Tambor' },
  // peças/porções
  par: { abrev: 'par', nome: 'Par' }, pares: { abrev: 'par', nome: 'Par' },
  pc: { abrev: 'pç', nome: 'Peça' }, peca: { abrev: 'pç', nome: 'Peça' },
  peça: { abrev: 'pç', nome: 'Peça' }, pecas: { abrev: 'pç', nome: 'Peça' },
  porcao: { abrev: 'porç', nome: 'Porção' }, porção: { abrev: 'porç', nome: 'Porção' },
  porcoes: { abrev: 'porç', nome: 'Porção' },
  fatia: { abrev: 'ft', nome: 'Fatia' }, fatias: { abrev: 'ft', nome: 'Fatia' },
  maco: { abrev: 'mç', nome: 'Maço' }, maço: { abrev: 'mç', nome: 'Maço' },
  cartela: { abrev: 'cart', nome: 'Cartela' }, cart: { abrev: 'cart', nome: 'Cartela' },
  kit: { abrev: 'kit', nome: 'Kit' }, kits: { abrev: 'kit', nome: 'Kit' },
  combo: { abrev: 'cb', nome: 'Combo' }, combos: { abrev: 'cb', nome: 'Combo' },
  display: { abrev: 'dpy', nome: 'Display' },
  // medidas lineares/área
  m: { abrev: 'm', nome: 'Metro' }, metro: { abrev: 'm', nome: 'Metro' },
  metros: { abrev: 'm', nome: 'Metro' },
  cm: { abrev: 'cm', nome: 'Centímetro' }, centimetro: { abrev: 'cm', nome: 'Centímetro' },
  centímetro: { abrev: 'cm', nome: 'Centímetro' },
  'm²': { abrev: 'm²', nome: 'M²' }, m2: { abrev: 'm²', nome: 'M²' },
  pol: { abrev: 'pol', nome: 'Polegada' }, polegada: { abrev: 'pol', nome: 'Polegada' },
  polegadas: { abrev: 'pol', nome: 'Polegada' },
  pe: { abrev: 'pé', nome: 'Pé' }, pé: { abrev: 'pé', nome: 'Pé' },
  yd: { abrev: 'yd', nome: 'Jarda' }, jarda: { abrev: 'yd', nome: 'Jarda' },
  // peso adicionais
  t: { abrev: 't', nome: 'Tonelada' }, tonelada: { abrev: 't', nome: 'Tonelada' },
  toneladas: { abrev: 't', nome: 'Tonelada' },
  lb: { abrev: 'lb', nome: 'Libra' }, libra: { abrev: 'lb', nome: 'Libra' },
  libras: { abrev: 'lb', nome: 'Libra' },
};

function detectarUnidade(texto) {
  // Tenta achar a última palavra como unidade
  const palavras = texto.trim().split(/\s+/);
  if (palavras.length === 0) return { unidade: null, abrev: null, textoLimpo: texto };

  const ultima = palavras[palavras.length - 1].toLowerCase();
  const dados = MAPA_UNIDADES[ultima];
  if (dados) {
    return {
      unidade: dados.nome,
      abrev: dados.abrev,
      textoLimpo: palavras.slice(0, -1).join(' ').trim(),
    };
  }
  return { unidade: null, abrev: null, textoLimpo: texto };
}

// Parser robusto: aceita "Nome 14,99 kg", "Nome R$ 14,99", "Nome R$ X por R$ Y", etc.
function parsearLinha(linha) {
  let texto = linha.trim();
  if (!texto) return null;

  // 1) Tenta extrair unidade (última palavra)
  const { unidade, abrev, textoLimpo } = detectarUnidade(texto);
  if (unidade) texto = textoLimpo;

  // 2) Captura preço duplo: "Nome R$ 4,99 por R$ 3,99"
  const regexPrecoDuplo = /^(.+?)\s+r?\$?\s*(\d+[.,]?\d*)\s+por\s+r?\$?\s*(\d+[.,]?\d*)\s*$/i;
  let m = texto.match(regexPrecoDuplo);
  if (m) {
    return {
      nome: m[1].trim(),
      precoDe: m[2].replace('.', ','),
      preco: m[3].replace('.', ','),
      unidade, unidadeAbrev: abrev,
    };
  }

  // 3) Captura preço simples: "Nome R$ 4,99" OU "Nome 4,99" (sem R$)
  const regexPrecoSimples = /^(.+?)\s+r?\$?\s*(\d+[.,]\d{2})\s*$/i;
  m = texto.match(regexPrecoSimples);
  if (m) {
    return {
      nome: m[1].trim(),
      preco: m[2].replace('.', ','),
      unidade, unidadeAbrev: abrev,
    };
  }

  // 4) Sem preço — só nome (e talvez unidade)
  return { nome: texto, preco: '', unidade, unidadeAbrev: abrev };
}

const TERMOS_GENERICOS_API = new Set([
  'kg','g','ml','l','lt','un','unid','unidade','pct','pacote','caixa','cx',
  'lata','garrafa','litro','litros','grama','gramas','kilo','quilo',
  'de','do','da','com','sem','para','por','e','o','a','os','as'
]);

function termosRelevantesAPI(query) {
  return (query || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(t => t && t.length >= 3 && !TERMOS_GENERICOS_API.has(t));
}

// Aceita match local apenas se TODOS os termos relevantes casarem
// (caso contrário "Picanha kg" acharia "Arroz Tio João 5kg" pelo termo "kg").
function imagemRelevante(query, scoreItem) {
  if (!scoreItem) return false;
  const totalTermos = scoreItem.total || 0;
  const casaram = scoreItem.casaram || 0;
  return totalTermos > 0 && casaram === totalTermos;
}

// Avalia se um produto externo é relevante. Threshold dinâmico:
// - 1-2 termos: exige TODOS os termos casarem (caso contrário "bacon friella" volta lixo
//   só com "bacon" no título — Nescau/Coca/etc do OFF, ou meme "Receive Bacon" do Bing)
// - 3+ termos: exige >= 60% (mais flexível porque queries longas tendem a ter palavras
//   tangenciais que nem o produto real casa todas)
function externoRelevante(query, produto) {
  const termos = termosRelevantesAPI(query);
  if (!termos.length) return true;
  const alvo = `${produto.nome || ''} ${produto.marca || ''}`.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const casaram = termos.filter(t => alvo.includes(t)).length;
  const minimo = termos.length <= 2 ? termos.length : Math.ceil(termos.length * 0.6);
  return casaram >= minimo;
}

// ---------- Busca em lote (várias linhas de uma vez, igual qrofertas) ----------
app.post('/api/produtos/buscar-lote', async (req, res) => {
 try {
  const linhas = (req.body.linhas || '').toString().split('\n').map(l => l.trim()).filter(Boolean);
  if (!linhas.length) return res.json({ resultados: [] });

  const resultados = await Promise.all(linhas.map(async (linha) => {
    const parsed = parsearLinha(linha);
    if (!parsed) return null;

    // Nome FIEL ao que o usuário digitou (sempre).
    const nomeDigitado = parsed.nome;
    let imagemEncontrada = '';
    let codigoBarras = '';
    let fonte = null;

    // 0) MODERAÇÃO: bloqueia queries com termos proibidos (pornografia, drogas,
    //    armas, etc.) — força placeholder e pula TODAS as fontes externas pra
    //    não passar a query nem pra log do Bing.
    const mod = moderacao.classificar(nomeDigitado);
    if (mod.proibida) {
      console.warn(`[moderacao] bloqueado termo "${mod.termo}" em query="${nomeDigitado}"`);
      return {
        linhaOriginal: linha,
        produto: {
          id: 'novo-' + nanoid(6),
          nome: nomeDigitado,
          marca: '',
          categoria: 'Bloqueado',
          codigoBarras: '',
          imagem: gerarPlaceholderUrl(nomeDigitado, 'vermelho'),
          preco: parsed.preco || '',
          precoDe: parsed.precoDe || '',
          unidade: parsed.unidade || '',
          unidadeAbrev: parsed.unidadeAbrev || '',
          fonte: 'moderacao-bloqueado',
        },
      };
    }

    // 1) PRIORIDADE MÁXIMA: BANCO DE IMAGENS POPULARES (uso real dos usuários).
    // Quando o usuário troca a imagem, ela sobe no banco e ganha prioridade.
    // Resolve o problema de "estou trocando a imagem toda vez por uma mais bonita".
    try {
      const popular = imagensDb.imagemMaisPopular(nomeDigitado);
      if (popular && popular.url) {
        imagemEncontrada = popular.url;
        fonte = 'populares';
      }
    } catch (e) { /* segue */ }

    // 2) Fallback: tenta cache local de produtos (com score)
    if (!imagemEncontrada) {
      const ranked = produtosDb.buscarLocalComScore(nomeDigitado);
      if (ranked.length > 0 && imagemRelevante(nomeDigitado, ranked[0]) && ranked[0].produto.imagem) {
        imagemEncontrada = ranked[0].produto.imagem;
        codigoBarras = ranked[0].produto.codigoBarras || '';
        fonte = 'local';
      }
    }

    // ============================================================================
    // ORDEM RECALIBRADA em 2026-05-17 após medir 21s/produto em produção.
    // Diagnóstico (logs VPS): das 7 fontes externas, só Bing+OFF+Wikimedia funcionam.
    //   - Google CSE  → "permission denied" (API não habilitada no Google Cloud)
    //   - Yandex      → retorna HTML lang="en" (bloqueio geográfico do datacenter)
    //   - DuckDuckGo  → endpoint i.js mudou, sempre retorna 0
    //   - Google Images → exige JS desde 2024 (scraping morreu)
    // Nova estratégia: Bing PRIMEIRO (única consistente), depois OFF (quando tem
    // código de barras), depois Wikimedia (genéricos de hortifruti/açougue).
    // As funções das fontes mortas continuam exportadas no busca-imagens.js pra
    // reativação futura, mas não são mais chamadas neste pipeline.
    // ============================================================================

    // 2.5) CACHE PERSISTENTE de buscas externas. Hit aqui = pula scraping/HTTP toda.
    //      TTL: 30 dias pra hits reais, 1 dia pra placeholders (chance de aparecer).
    //      Skipa se passos 1/2 (populares/local) já acharam — eles são mais frescos.
    if (!imagemEncontrada) {
      const hit = cacheImagens.cacheGet(nomeDigitado);
      if (hit) {
        imagemEncontrada = hit.imagem;
        codigoBarras = hit.codigoBarras || '';
        fonte = `cache:${hit.fonte}`;
      }
    }

    // Query com contexto pra desambiguar buscas ambíguas em web search
    // (ex: "Saches Heinz" sozinho retorna paleontologia; com contexto retorna o produto)
    const queryWeb = `${nomeDigitado} produto supermercado`;

    // 3) Bing Images — única fonte de web scraping consistente em 2026.
    //    Filtra por relevância no título antes de validar URL (sem isso vinha lixo
    //    tipo ícone de arquivo pra "FILE PEITO").
    if (!imagemEncontrada) {
      try {
        const bing = await buscarBingImages(queryWeb, 12);
        const relevantes = bing.filter(r => externoRelevante(nomeDigitado, r));
        const valido = await primeiraUrlValida(relevantes, 5);
        if (valido && valido.imagem) {
          imagemEncontrada = valido.imagem;
          fonte = 'bing';
        }
      } catch (e) { /* segue */ }
    }

    // 4) Open Food Facts — produtos BR cadastrados (com código de barras).
    //    Cobertura BR razoável pra alimentos industrializados.
    if (!imagemEncontrada) {
      try {
        const externos = await buscarOpenFoodFacts(nomeDigitado, 5);
        const candidato = externos.find(p => externoRelevante(nomeDigitado, p));
        if (candidato && candidato.imagem) {
          imagemEncontrada = candidato.imagem;
          codigoBarras = candidato.codigoBarras || '';
          fonte = 'openfoodfacts';
        }
      } catch (e) { /* segue */ }
    }

    // 5) Wikimedia Commons — fallback pra genéricos (hortifruti/açougue, com tradução PT→EN)
    if (!imagemEncontrada) {
      try {
        const wm = await buscarWikimedia(nomeDigitado, 3);
        if (wm.length > 0 && wm[0].imagem) {
          imagemEncontrada = wm[0].imagem;
          fonte = 'wikimedia';
        }
      } catch (e) { /* segue */ }
    }

    // 6) Placeholder estilizado (último recurso)
    if (!imagemEncontrada) {
      imagemEncontrada = gerarPlaceholderUrl(nomeDigitado, 'vermelho');
      fonte = 'placeholder';
    }

    // Persiste no cache se veio de fonte externa OU é placeholder.
    // Pula 'populares', 'local' e 'cache:*' — esses já vem de fontes internas
    // que não custam nada repetir (e populares pode mudar quando user troca imagem).
    if (fonte && !['populares', 'local'].includes(fonte) && !fonte.startsWith('cache:')) {
      cacheImagens.cacheSet(nomeDigitado, {
        imagem: imagemEncontrada,
        codigoBarras,
        fonte,
      });
    }

    return {
      linhaOriginal: linha,
      produto: {
        id: 'novo-' + nanoid(6),
        nome: nomeDigitado,
        marca: '',
        categoria: 'Geral',
        codigoBarras,
        imagem: imagemEncontrada,
        preco: parsed.preco || '',
        precoDe: parsed.precoDe || '',
        unidade: parsed.unidade || '',
        unidadeAbrev: parsed.unidadeAbrev || '',
        fonte,
      },
    };
  }));

  res.json({ resultados: resultados.filter(Boolean) });
 } catch (e) {
  console.error('[buscar-lote] erro fatal:', e?.message || e, e?.stack);
  res.status(500).json({ error: e?.message || 'erro desconhecido', resultados: [] });
 }
});

// ---------- Produtos: busca com cache local + Open Food Facts ----------
app.get('/api/produtos/buscar', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json({ produtos: [], fonte: 'vazio' });

  // 1) Busca local primeiro
  const locais = produtosDb.buscarLocal(query);
  if (locais.length >= 6) {
    return res.json({ produtos: locais.slice(0, 24), fonte: 'local' });
  }

  // 2) Busca externa (Open Food Facts) — pode falhar/estar fora
  let externos = [];
  let externoFalhou = false;
  try {
    externos = await buscarOpenFoodFacts(query, 12);
  } catch (e) {
    externoFalhou = true;
    console.error('Falha busca externa:', e.message);
  }

  // Mistura: locais primeiro, depois externos sem duplicar por código de barras
  const codigosLocais = new Set(locais.map(p => p.codigoBarras).filter(Boolean));
  const novosExternos = externos.filter(p => !p.codigoBarras || !codigosLocais.has(p.codigoBarras));

  let fonte;
  if (locais.length && novosExternos.length) fonte = 'local+externo';
  else if (locais.length) fonte = externoFalhou ? 'local-externo-fora' : 'local';
  else if (novosExternos.length) fonte = 'externo';
  else fonte = externoFalhou ? 'externo-fora' : 'vazio';

  res.json({
    produtos: [...locais, ...novosExternos.map(p => ({ ...p, id: 'ext-' + (p.codigoBarras || nanoid(6)) }))],
    fonte,
  });
});

app.get('/api/produtos', (req, res) => {
  res.json(produtosDb.carregar().produtos);
});

// Retorna até N imagens encontradas para uma query (Bing + Google + OFF + Wikimedia).
// IMPORTANTE: precisa ficar ANTES de /api/produtos/:id para não ser tratado como id.
app.get('/api/produtos/buscar-imagens', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    const limite = parseInt(req.query.limite) || 20;
    if (!query) return res.json({ imagens: [] });

    // ESTRATÉGIA: múltiplas queries + ranqueamento por qualidade do domínio.
    //
    // 1) Query original "Ancho Maturatta"
    // 2) Variações automáticas: brand sozinho ("Maturatta") e produto sozinho ("Ancho")
    //    quando query tem 2+ palavras — amplia cobertura (qrofertas tem foto pra
    //    "Maturatta" mesmo se você buscou "Ancho Maturatta Bovino Resfriado").
    // 3) Roda tudo em paralelo nas fontes
    // 4) Pontua cada URL por DOMÍNIO (vtexassets/mlstatic = top, redes sociais = baixo)
    // 5) Ordena por score desc → CDNs de varejo aparecem primeiro
    const palavras = query.split(/\s+/).filter(p => p.length >= 3);
    const queries = [query];
    if (palavras.length >= 2) {
      // Variação 1: última palavra (geralmente brand: "Maturatta", "Friella", "Heinz")
      queries.push(palavras[palavras.length - 1]);
      // Variação 2: primeira palavra (produto base: "Ancho", "Bacon", "Sache")
      queries.push(palavras[0]);
    }

    // Pipeline em paralelo: pra cada query, dispara fontes scraping.
    // 2026-05-17: removidos Google CSE (permission denied), Yandex (bloqueado geo)
    // e DuckDuckGo (endpoint quebrado). Mantidos Bing (consistente), OFF e Wikimedia.
    const todasPromises = [];
    for (const q of queries) {
      todasPromises.push(
        buscarBingImages(q, 12).catch(() => []),
      );
    }
    todasPromises.push(
      buscarOpenFoodFacts(query, 8).catch(() => []),
      buscarWikimedia(query, 6).catch(() => []),
    );

    const resultadosBrutos = await Promise.all(todasPromises);
    const bingCount = resultadosBrutos.slice(0, queries.length).reduce((s, l) => s + l.length, 0);
    const offCount = resultadosBrutos[queries.length].length;
    const wmCount = resultadosBrutos[queries.length + 1].length;
    console.log(`[buscar-imagens] q="${query}" (${queries.length} variações) → bing:${bingCount} off:${offCount} wm:${wmCount}`);

    // Achata + dedup + pontua por confiabilidade do domínio.
    const vistos = new Set();
    const todasComScore = [];
    for (const lista of resultadosBrutos) {
      for (const item of lista) {
        if (!item.imagem || vistos.has(item.imagem)) continue;
        vistos.add(item.imagem);
        todasComScore.push({
          url: item.imagem,
          fonte: item.fonte || 'externo',
          titulo: item.nome,
          score: pontuarFonte(item.imagem),
        });
      }
    }
    // Ordena por score desc — domínios de varejo (vtexassets, mlstatic) primeiro,
    // genéricos no meio, redes sociais por último
    todasComScore.sort((a, b) => b.score - a.score);
    const todas = todasComScore.slice(0, limite).map(({ score, ...resto }) => resto);

    res.json({ imagens: todas, total: todas.length });
  } catch (e) {
    console.error('[buscar-imagens] erro:', e?.message || e);
    res.status(500).json({ error: e?.message || 'erro desconhecido', imagens: [] });
  }
});

app.get('/api/produtos/:id', (req, res) => {
  const p = produtosDb.obter(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(p);
});

app.post('/api/produtos', async (req, res) => {
  const dados = { ...req.body };
  // Se a imagem é externa (URL), baixa e cacheia local
  if (dados.imagem && /^https?:\/\//.test(dados.imagem) && !dados.imagem.includes('/uploads/')) {
    try {
      const localUrl = await downloadImagem(dados.imagem);
      dados.imagemOriginal = dados.imagem;
      dados.imagem = localUrl;
    } catch (e) {
      console.error('Falha cacheando imagem:', e.message);
      // Mantém URL externa se falhar
    }
  }
  const produto = produtosDb.adicionar(dados);
  res.json(produto);
});

app.put('/api/produtos/:id', (req, res) => {
  const atualizado = produtosDb.atualizar(req.params.id, req.body);
  if (!atualizado) return res.status(404).json({ error: 'Não encontrado' });
  res.json(atualizado);
});

app.delete('/api/produtos/:id', (req, res) => {
  produtosDb.remover(req.params.id);
  res.json({ ok: true });
});

// (movido para antes de /api/produtos/:id — ver bloco "buscar-imagens")

// Proxy streaming de imagem (não salva em disco — só repassa bytes pro browser).
// Útil pra mostrar previews de muitas imagens sem encher /uploads.
app.get('/api/proxy-imagem-direto', (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).send('URL inválida');
  try {
    const fazerRequest = (urlAlvo, redirects = 0) => {
      if (redirects > 5) return res.status(502).send('Muitos redirecionamentos');
      // BUG FIX: redirects podem vir como URL relativa (ex: "/gallery/foo.jpg")
      // ou com protocolo (https://...). new URL() crasha em relativo sem base.
      // Resolve usando a URL anterior como base — comportamento HTTP padrão.
      let urlAbs;
      try {
        urlAbs = new URL(urlAlvo).href;
      } catch {
        try {
          // Tenta resolver relativo à URL anterior (anterior está no closure como `url` da query)
          urlAbs = new URL(urlAlvo, urlAnterior).href;
        } catch (e) {
          return res.status(502).send(`URL de redirect inválida: ${urlAlvo}`);
        }
      }
      // Só HTTPS aqui (http.get pra HTTP seria outro módulo)
      if (!urlAbs.startsWith('https://')) {
        return res.status(502).send(`Protocolo não suportado: ${urlAbs}`);
      }
      urlAnterior = urlAbs;  // próximo redirect usa essa como base
      https.get(urlAbs, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
          'Accept': 'image/*,*/*;q=0.8',
        },
      }, (upstream) => {
        if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
          return fazerRequest(upstream.headers.location, redirects + 1);
        }
        if (upstream.statusCode !== 200) {
          return res.status(upstream.statusCode).send('Falha origem');
        }
        res.set('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        upstream.pipe(res);
      }).on('error', (e) => res.status(502).send(e.message));
    };
    let urlAnterior = url;  // base inicial pra resolver redirects relativos
    fazerRequest(url);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Proxy para baixar imagem externa via backend (evita CORS no canvas)
app.get('/api/proxy-imagem', async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).send('URL inválida');
  try {
    const localUrl = await downloadImagem(url);
    res.json({ url: localUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Banco de imagens populares ----------
// Registra que uma imagem foi usada pra um produto (incrementa contador).
// Body: { nome, imagemUrl, peso? } — peso 1 (uso normal) ou 3 (escolha explícita)
app.post('/api/produtos/registrar-imagem', (req, res) => {
  try {
    const { nome, imagemUrl, peso } = req.body || {};
    if (!nome || !imagemUrl) {
      return res.status(400).json({ error: 'nome e imagemUrl são obrigatórios' });
    }
    // Não registra placeholders nem URLs vazias
    if (imagemUrl.includes('/api/placeholder')) {
      return res.json({ ok: true, ignorado: 'placeholder' });
    }
    const pesoNum = Math.max(1, Math.min(50, parseInt(peso, 10) || 1));
    imagensDb.registrarUso(nome, imagemUrl, pesoNum);
    if (pesoNum >= 5) {
      console.log(`[banco] registrado "${nome}" com peso ${pesoNum} → ${imagemUrl.slice(0, 80)}`);
      // Peso >= 5 = ação explícita do usuário (upload/swap). Invalida cache
      // pra próxima busca pelo termo retornar a imagem nova (via populares),
      // não a antiga que ainda estaria cacheada.
      cacheImagens.cacheInvalidate(nome);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lista as imagens mais usadas pra um produto (ordenadas por popularidade).
// Query: ?q=<nome>&limite=12
app.get('/api/produtos/imagens-populares', (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limite = parseInt(req.query.limite || '12', 10);
    if (!q) return res.json({ imagens: [] });
    const populares = imagensDb.buscarPopulares(q, Math.min(limite, 50));
    res.json({ imagens: populares });
  } catch (e) {
    res.status(500).json({ error: e.message, imagens: [] });
  }
});

// Estatísticas do banco (debug/dashboard)
app.get('/api/produtos/imagens-stats', (req, res) => {
  try {
    res.json(imagensDb.estatisticas());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Status do Google Custom Search (quota diária)
app.get('/api/produtos/gcse-stats', (req, res) => {
  try {
    res.json(statsCSE());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Categorias ----------
app.get('/api/categorias', (req, res) => {
  try {
    res.json(categoriasDb.listar());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/categorias', (req, res) => {
  try {
    const { nome } = req.body || {};
    const cat = categoriasDb.adicionar(nome);
    res.json(cat);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/categorias/:nome', (req, res) => {
  try {
    const ok = categoriasDb.remover(req.params.nome);
    if (!ok) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Templates ----------
app.get('/api/templates', (req, res) => {
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
  const templates = files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
      const json = JSON.parse(raw);
      return {
        id: path.basename(file, '.json'),
        nome: json.nome || file,
        categoria: json.categoria || 'Temas Grátis',
        premium: !!json.premium,
        novo: !!json.novo,
        gratis: !!json.gratis,  // tema liberado pra clientes sem conta/assinatura
        paleta: json.paleta || {},
        capa: json.capa || null,
      };
    } catch (e) { return null; }
  }).filter(Boolean);
  res.json(templates);
});

app.get('/api/templates/:id', (req, res) => {
  const file = path.join(TEMPLATES_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Template não encontrado' });
  res.sendFile(file);
});

// Lista todos os balões de oferta extraídos dos temas existentes.
// Retorna URLs únicas + metadata (tema de origem) pra exibir na galeria.
app.get('/api/baloes-tema', (req, res) => {
  try {
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    const baloes = [];
    const vistos = new Set();
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
        const json = JSON.parse(raw);
        const url = json.paleta?.balaoOferta;
        if (url && !vistos.has(url)) {
          vistos.add(url);
          baloes.push({
            url,
            temaId: path.basename(file, '.json'),
            temaNome: json.nome || file,
          });
        }
      } catch { /* skip */ }
    }
    res.json({ baloes });
  } catch (e) {
    res.status(500).json({ error: e.message, baloes: [] });
  }
});

// Cria/atualiza um template. Body: { id?, nome, categoria, capa, rodape, paleta }
// Tema é AGNÓSTICO ao formato — as imagens são re-escaladas pra qualquer tamanho de encarte.
// RESTRITO a admin/super_admin: temas afetam TODOS os usuários da plataforma,
// não é um recurso self-service do cliente.
app.post('/api/templates', requireAuth, requireRole(['admin', 'super_admin']), (req, res) => {
  const body = req.body || {};
  if (!body.nome || typeof body.nome !== 'string') {
    return res.status(400).json({ error: 'nome é obrigatório' });
  }
  // Slug: lowercase, sem acentos, espaços→hífen, só [a-z0-9-]
  const slug = body.id || body.nome
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!slug) return res.status(400).json({ error: 'nome inválido pra gerar id' });

  const file = path.join(TEMPLATES_DIR, `${slug}.json`);
  const data = {
    nome: body.nome,
    categoria: body.categoria || 'Meus Temas',
    premium: false,
    novo: !fs.existsSync(file),
    capa: body.capa || null,
    rodape: body.rodape || null,
    paleta: body.paleta || {},
    fundoEncarte: body.fundoEncarte || null,  // novo: cor ou imagem tileada da área dos produtos
    criadoEm: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    res.json({ id: slug, ...data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove um template — só admin/super_admin
app.delete('/api/templates/:id', requireAuth, requireRole(['admin', 'super_admin']), (req, res) => {
  const file = path.join(TEMPLATES_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Template não encontrado' });
  try {
    fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Projetos ----------
// Lista projetos com metadata enriquecido (capa do tema + qtd produtos + datas).
// Cacheia capas de tema em memória pra evitar reler todos os templates a cada
// chamada (templates raramente mudam dentro do mesmo processo Node).
let _capasTemaCache = null;
function obterCapasTema() {
  if (_capasTemaCache) return _capasTemaCache;
  _capasTemaCache = {};
  try {
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
        const json = JSON.parse(raw);
        const id = path.basename(file, '.json');
        _capasTemaCache[id] = {
          capa: json.capa || null,
          nome: json.nome || id,
        };
      } catch {}
    }
  } catch {}
  return _capasTemaCache;
}

app.get('/api/projetos', (req, res) => {
  const files = fs.readdirSync(PROJETOS_DIR).filter(f => f.endsWith('.json'));
  const capasTema = obterCapasTema();
  const projetos = files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(PROJETOS_DIR, file), 'utf8');
      const json = JSON.parse(raw);
      const temaInfo = json.tema ? (capasTema[json.tema] || {}) : {};
      return {
        id: path.basename(file, '.json'),
        nome: json.nome || 'Sem nome',
        tema: json.tema || null,
        temaNome: temaInfo.nome || null,
        capa: temaInfo.capa || null,
        qtdProdutos: Array.isArray(json.produtos) ? json.produtos.length : 0,
        criadoEm: json.criadoEm || json.atualizadoEm || null,
        atualizadoEm: json.atualizadoEm || null,
        vencidaEm: json.vencidaEm || null,
      };
    } catch (e) { return null; }
  }).filter(Boolean);
  projetos.sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
  res.json(projetos);
});

app.get('/api/projetos/:id', (req, res) => {
  const file = path.join(PROJETOS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.sendFile(file);
});

app.post('/api/projetos', (req, res) => {
  const id = req.body.id || nanoid(10);
  const agora = new Date().toISOString();
  // Preserva criadoEm + lê produtos antigos pra comparar (aprendizado passivo)
  let criadoEm = req.body.criadoEm || null;
  let produtosAntigos = [];
  try {
    const existente = path.join(PROJETOS_DIR, `${id}.json`);
    if (fs.existsSync(existente)) {
      const json = JSON.parse(fs.readFileSync(existente, 'utf8'));
      criadoEm = criadoEm || json.criadoEm || json.atualizadoEm || agora;
      produtosAntigos = Array.isArray(json.produtos) ? json.produtos : [];
    } else {
      criadoEm = criadoEm || agora;
    }
  } catch { criadoEm = criadoEm || agora; }

  const data = { ...req.body, id, criadoEm, atualizadoEm: agora };
  fs.writeFileSync(path.join(PROJETOS_DIR, `${id}.json`), JSON.stringify(data, null, 2));

  // APRENDIZADO PASSIVO (peso 1): registra produtos do projeto no banco populares.
  // Só registra NOVOS ou com imagem trocada vs versão anterior — evita inflar peso
  // quando user salva mesmo projeto várias vezes. Sinal fraco; 5+ usos = popular.
  try {
    const antigoPorId = new Map(produtosAntigos.map(p => [p.id, p]));
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];
    let registrados = 0;
    for (const p of produtos) {
      if (!p?.nome || !p?.imagem) continue;
      if (p.imagem.includes('/api/placeholder')) continue;
      const antigo = antigoPorId.get(p.id);
      if (antigo && antigo.imagem === p.imagem) continue; // imagem inalterada — pula
      imagensDb.registrarUso(p.nome, p.imagem, 1);
      registrados++;
    }
    if (registrados > 0) {
      console.log(`[aprendizado-passivo] projeto ${id}: ${registrados} produtos novos/alterados registrados (peso 1)`);
    }
  } catch (e) {
    console.error('[aprendizado-passivo] falhou (não bloqueia save):', e.message);
  }

  res.json({ id, ok: true });
});

app.delete('/api/projetos/:id', (req, res) => {
  const file = path.join(PROJETOS_DIR, `${req.params.id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// ---------- Upload manual ----------
// Wrapper pra capturar erros do multer (file too large, etc) e retornar JSON.
// Aceita metadata opcional no body (multipart fields): nome, marca, categoria,
// codigoBarras. Se fornecido, registra peso 25 no banco populares (acima do peso
// 20 de "upload sem contexto") porque o user demonstrou intenção explícita
// associando imagem a um produto específico — sinal forte de qualidade.
app.post('/api/upload', (req, res) => {
  upload.single('imagem')(req, res, (err) => {
    if (err) {
      console.error('[upload] multer:', err.code, err.message);
      // Mensagens user-friendly
      const code = err.code || 'ERROR';
      const msgs = {
        'LIMIT_FILE_SIZE': 'Arquivo maior que 10MB. Reduza a foto antes de subir.',
        'LIMIT_UNEXPECTED_FILE': 'Campo do arquivo errado (esperado "imagem").',
      };
      return res.status(400).json({ error: msgs[code] || `Erro upload: ${err.message}`, code });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const url = `/uploads/${req.file.filename}`;
    console.log(`[upload] ${req.file.filename} (${(req.file.size/1024).toFixed(1)}KB) → ${url}`);

    // Salva parâmetros do produto se fornecidos no upload — sinal forte de uso real.
    // Frontend pode passar nome + marca + categoria + codigoBarras como campos do form.
    const { nome, marca, categoria, codigoBarras } = req.body || {};
    if (nome && typeof nome === 'string' && nome.trim()) {
      // Moderação: rejeita salvar metadata se o nome do produto bate na blacklist.
      // A imagem em si já foi salva (multer), mas NÃO é associada ao nome proibido
      // — não entra no banco populares, não é cacheada. Cliente ainda pode usar a
      // imagem solta (URL retornada), mas perde o aprendizado.
      const mod = moderacao.classificar(nome.trim());
      if (mod.proibida) {
        console.warn(`[upload][moderacao] bloqueado metadata pra termo "${mod.termo}" — imagem salva mas não associada`);
        return res.json({ url, filename: req.file.filename, _aviso: 'metadata bloqueada por termo proibido' });
      }
      try {
        // Peso 25 = mais forte que upload genérico (20) e troca de imagem (10).
        // Sinaliza que o user explicitamente associou ESSA imagem a ESSE produto.
        imagensDb.registrarUso(nome.trim(), url, 25);
        console.log(`[upload+metadata] "${nome.trim()}" → ${url} (peso 25)`);
        // Invalida cache pra próxima busca pegar a imagem nova
        try {
          const cacheImagens = require('./db/cache-imagens');
          cacheImagens.cacheInvalidate(nome.trim());
        } catch {}
        // Se tem marca ou código de barras, registra como produto completo
        // no produtos-db (catálogo persistente do estabelecimento).
        if (marca || codigoBarras) {
          try {
            // produtosDb.adicionar() já trata duplicate (match por codigoBarras ou
            // nome+marca) — atualiza se existir, cria se não. Idempotente.
            produtosDb.adicionar({
              nome: nome.trim(),
              marca: (marca || '').trim(),
              categoria: (categoria || 'Geral').trim(),
              codigoBarras: (codigoBarras || '').trim(),
              imagem: url,
              fonte: 'upload-user',
            });
          } catch (e) { console.error('[upload+metadata] produtos-db falhou:', e.message); }
        }
      } catch (e) { console.error('[upload+metadata] falhou:', e.message); }
    }
    res.json({ url, filename: req.file.filename });
  });
});

// Popula seed inicial de produtos (com cache de imagens) na primeira execução
async function popularSeedSeNecessario() {
  const db = produtosDb.carregar();
  if (db.produtos.length > 0) return;
  console.log('[seed] Banco vazio, populando com produtos brasileiros iniciais...');
  for (const p of seedProdutos) {
    try {
      let imagemFinal = p.imagem;
      if (imagemFinal && /^https?:\/\//.test(imagemFinal)) {
        try {
          imagemFinal = await downloadImagem(p.imagem);
          console.log(`[seed] ${p.nome} ✓`);
        } catch (e) {
          console.warn(`[seed] ${p.nome} (mantendo URL externa): ${e.message}`);
        }
      }
      produtosDb.adicionar({ ...p, imagem: imagemFinal, fonte: 'seed' });
    } catch (e) {
      console.error(`[seed] erro em ${p.nome}:`, e.message);
    }
  }
  console.log(`[seed] Concluído: ${produtosDb.carregar().produtos.length} produtos no banco.`);
}

// Migração one-shot: ajusta pesos do banco de imagens populares pra hierarquia nova.
// - URLs locais (/uploads/*) = upload do usuário → peso mínimo 20 (sempre dominam)
// - URLs externas com peso entre 5-10 = seed antigo → resetado pra peso 1
// Roda automaticamente no startup; não destrói dados, só normaliza pesos.
function migrarPesosImagens() {
  const fs = require('fs');
  const path = require('path');
  const DB_FILE = path.join(ROOT, 'data', 'imagens-produtos.json');
  const FLAG = path.join(ROOT, 'data', '.migracao-pesos-v2-done');
  if (fs.existsSync(FLAG)) return;
  if (!fs.existsSync(DB_FILE)) return;

  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    let resetSeed = 0;
    let bumpUpload = 0;
    for (const chave of Object.keys(db)) {
      for (const e of db[chave] || []) {
        const ehUploadLocal = e.url && e.url.startsWith('/uploads/');
        if (ehUploadLocal && (e.usos || 0) < 20) {
          e.usos = 20;
          bumpUpload++;
        } else if (!ehUploadLocal && (e.usos || 0) >= 5 && (e.usos || 0) <= 10) {
          // Provável seed antigo (peso 8 que eu setei errado)
          e.usos = 1;
          resetSeed++;
        }
      }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    fs.writeFileSync(FLAG, new Date().toISOString());
    console.log(`[migração-pesos-v2] ${bumpUpload} uploads bumped→20, ${resetSeed} seeds reset→1`);
  } catch (e) {
    console.error('[migração-pesos-v2] falhou:', e.message);
  }
}

// Popula o banco de IMAGENS POPULARES em background com a lista curada de produtos BR.
// Roda só uma vez por nome (se já tem entry pra esse nome, pula). Usa Yandex pra buscar
// e pegar a top imagem de cada nome. Throttle de 800ms entre buscas pra não estressar o Yandex.
async function popularImagensPopulares() {
  const stats = imagensDb.estatisticas();
  // Marker file pra rodar só uma vez
  const fs = require('fs');
  const path = require('path');
  const flag = path.join(ROOT, 'data', '.seed-imagens-populares-done');
  if (fs.existsSync(flag)) return;

  console.log(`[seed-imagens] Iniciando seed em background de ${seedImagensPopulares.length} produtos populares...`);
  let novos = 0;
  let pulados = 0;
  for (const item of seedImagensPopulares) {
    try {
      // Pula se já tem imagem registrada pra esse nome (usuário já subiu/escolheu)
      if (imagensDb.imagemMaisPopular(item.nome)) {
        pulados++;
        continue;
      }
      // Yandex retornava bons resultados de produtos BR antes, mas em 2026 o IP do
      // datacenter HostGator é bloqueado (retorna HTML lang="en" genérico). Trocado
      // por Bing — única fonte de scraping consistente em produção.
      const bing = await buscarBingImages(item.nome, 3);
      const boas = bing.filter(r => pontuarFonte(r.imagem) > 0);
      const escolhidas = boas.length > 0 ? boas.slice(0, 2) : bing.slice(0, 1);
      for (const r of escolhidas) {
        // peso 1: BAIXÍSSIMO. Seed é só baseline pra primeiro uso. QUALQUER ação
        // do usuário (upload peso 20, swap peso 10) sobrescreve isso facilmente.
        imagensDb.registrarUso(item.nome, r.imagem, 1);
      }
      if (escolhidas.length > 0) novos++;
      // Throttle pra não estressar a fonte
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      // Falha individual não para o seed
    }
  }
  // Marca como feito (mesmo que algumas falhem) pra não rodar de novo
  try {
    fs.mkdirSync(path.dirname(flag), { recursive: true });
    fs.writeFileSync(flag, new Date().toISOString());
  } catch {}
  console.log(`[seed-imagens] Concluído: ${novos} novos, ${pulados} já existiam.`);
}

const PORT = process.env.PORT || 4010;
app.listen(PORT, async () => {
  console.log(`Encarte Builder API rodando em http://localhost:${PORT}`);
  // Migração de pesos: corrige hierarquia (uploads sempre vencem seed)
  migrarPesosImagens();
  popularSeedSeNecessario().catch(e => console.error('Falha no seed:', e.message));
  // Background, não bloqueia startup. Demora ~80 produtos × 800ms = ~65 segundos.
  popularImagensPopulares().catch(e => console.error('Falha seed-imagens:', e.message));
});
