// Service de autenticação: signup, login, refresh, password reset.
// Toda a lógica de domínio fica aqui — as rotas (routes.js) só fazem
// validação de input e chamam essas funções.
//
// Tokens:
//   - access token (JWT): vida curta (15min), assinado com JWT_SECRET, contém { sub, role, plan }
//   - refresh token: aleatório (32 bytes hex), vida longa (30 dias), guardado HASHED no DB
//     em sessions. Cliente recebe via cookie httpOnly. Permite logout/revoke por sessão.
//
// Por que NÃO storage do refresh token plain? Se DB vazar, atacante pode falsificar sessões.
// Hash sha256 é suficiente aqui (tokens já têm 256 bits de entropia, brute-force inviável).

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/schema');

// JWT_SECRET vem do .env. Em produção (NODE_ENV=production), recusa subir sem ele.
// Em dev, gera um secret aleatório por boot (sessões serão invalidadas a cada restart,
// o que é o comportamento desejado pra desenvolvimento sem .env).
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('\n❌ JWT_SECRET ausente ou fraco (mínimo 32 caracteres).');
    console.error('   Gere um com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    console.error('   E coloque no .env: JWT_SECRET=...\n');
    process.exit(1);
  }
  console.warn('⚠️  JWT_SECRET não definido — usando secret aleatório de dev (sessões serão invalidadas em cada restart).');
  return require('crypto').randomBytes(48).toString('base64url');
})();
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

// Tentativas de login antes de bloqueio (anti brute-force)
const MAX_TENTATIVAS_LOGIN = 5;
const TEMPO_BLOQUEIO_MIN = 15;

// === Helpers ===

function gerarRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function gerarAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role_nome || 'cliente',
      role_id: user.role_id,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function verificarAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function agora() { return new Date().toISOString(); }

function agoraMaisDias(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
}

// === Rate limit por chave (e.g. "login:email@x.com") ===

function checarRateLimit(chave) {
  const r = db.prepare('SELECT * FROM rate_limits WHERE chave = ?').get(chave);
  if (!r) return { ok: true };
  if (r.bloqueado_ate && new Date(r.bloqueado_ate) > new Date()) {
    const restanteMs = new Date(r.bloqueado_ate) - new Date();
    const restanteMin = Math.ceil(restanteMs / 60000);
    return { ok: false, motivo: `Muitas tentativas. Tente novamente em ${restanteMin}min.` };
  }
  return { ok: true };
}

function registrarTentativaFalha(chave) {
  const existente = db.prepare('SELECT * FROM rate_limits WHERE chave = ?').get(chave);
  const novaTentativa = (existente?.tentativas || 0) + 1;
  const bloqueado_ate = novaTentativa >= MAX_TENTATIVAS_LOGIN
    ? new Date(Date.now() + TEMPO_BLOQUEIO_MIN * 60 * 1000).toISOString()
    : null;
  db.prepare(`
    INSERT INTO rate_limits (chave, tentativas, bloqueado_ate, atualizado_em)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET
      tentativas = excluded.tentativas,
      bloqueado_ate = excluded.bloqueado_ate,
      atualizado_em = excluded.atualizado_em
  `).run(chave, novaTentativa, bloqueado_ate, agora());
}

function limparTentativas(chave) {
  db.prepare('DELETE FROM rate_limits WHERE chave = ?').run(chave);
}

// === Audit log ===

function auditar({ user_id, actor_id, acao, recurso, dados, ip, user_agent }) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, actor_id, acao, recurso, dados, ip, user_agent, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user_id || null, actor_id || null, acao, recurso || null,
           JSON.stringify(dados || {}), ip || null, user_agent || null, agora());
  } catch (e) {
    console.error('[audit] erro:', e.message);
  }
}

// === Service functions ===

/**
 * Cria usuário novo. Default role = cliente (4). Retorna user (sem senha_hash).
 * Lança erro se email já cadastrado.
 */
async function signup({ email, senha, nome, empresa, telefone, documento }, ctx = {}) {
  email = String(email || '').trim().toLowerCase();
  nome = String(nome || '').trim();

  if (!email || !email.includes('@')) throw new Error('Email inválido');
  if (!senha || senha.length < 8) throw new Error('Senha precisa ter pelo menos 8 caracteres');
  if (!nome) throw new Error('Nome obrigatório');

  const existente = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existente) throw new Error('Email já cadastrado');

  const senha_hash = await bcrypt.hash(senha, BCRYPT_ROUNDS);
  const ts = agora();

  const result = db.prepare(`
    INSERT INTO users (email, senha_hash, nome, empresa, telefone, documento, role_id, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, 4, 1, ?, ?)
  `).run(email, senha_hash, nome, empresa || null, telefone || null, documento || null, ts, ts);

  const userId = result.lastInsertRowid;

  auditar({
    user_id: userId, actor_id: userId, acao: 'user.signup',
    recurso: `user:${userId}`, ip: ctx.ip, user_agent: ctx.userAgent,
  });

  return obterUserPorId(userId);
}

/**
 * Verifica credenciais. Aplica rate limit por email+ip. Retorna user + tokens
 * em caso de sucesso. Lança erro com mensagem amigável em caso de falha.
 */
async function login({ email, senha }, ctx = {}) {
  email = String(email || '').trim().toLowerCase();

  const chaveRate = `login:${email}:${ctx.ip || 'unknown'}`;
  const rl = checarRateLimit(chaveRate);
  if (!rl.ok) throw new Error(rl.motivo);

  const user = db.prepare(`
    SELECT u.*, r.nome as role_nome FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.email = ?
  `).get(email);

  if (!user) {
    registrarTentativaFalha(chaveRate);
    throw new Error('Email ou senha incorretos');
  }

  if (!user.ativo) {
    auditar({ user_id: user.id, acao: 'login.suspended', ip: ctx.ip, user_agent: ctx.userAgent });
    throw new Error('Conta suspensa. ' + (user.motivo_suspensao || 'Contate o suporte.'));
  }

  const ok = await bcrypt.compare(senha, user.senha_hash);
  if (!ok) {
    registrarTentativaFalha(chaveRate);
    auditar({ user_id: user.id, acao: 'login.failed', ip: ctx.ip, user_agent: ctx.userAgent });
    throw new Error('Email ou senha incorretos');
  }

  limparTentativas(chaveRate);

  const tokens = criarSessao(user, ctx);
  auditar({ user_id: user.id, actor_id: user.id, acao: 'login.success', ip: ctx.ip, user_agent: ctx.userAgent });

  return { user: sanitizarUser(user), ...tokens };
}

/**
 * Cria sessão (refresh token) + retorna access token + refresh token.
 * O refresh token é guardado HASHED no DB e enviado plain pro cliente
 * (via cookie httpOnly). Cliente nunca conhece o hash.
 */
function criarSessao(user, ctx = {}) {
  const accessToken = gerarAccessToken(user);
  const refreshToken = gerarRefreshToken();
  const refreshHash = hashToken(refreshToken);
  const sessionId = crypto.randomBytes(8).toString('hex');
  const expira = agoraMaisDias(REFRESH_TOKEN_TTL_DAYS);

  db.prepare(`
    INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, expira_em, criada_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, user.id, refreshHash, ctx.userAgent || null, ctx.ip || null, expira, agora());

  return { accessToken, refreshToken, sessionId, expiraEm: expira };
}

/**
 * Troca refresh token por novo access token. Se refresh token for inválido
 * ou expirado, lança erro (cliente precisa fazer login de novo).
 *
 * IMPORTANTE: faz rotação — a sessão antiga é revogada e uma NOVA é criada.
 * Isso permite detectar reuso de token (se o token antigo for tentado de novo
 * depois da rotação, sabemos que foi vazado).
 */
async function refresh(refreshToken, ctx = {}) {
  if (!refreshToken) throw new Error('Refresh token ausente');
  const hash = hashToken(refreshToken);
  const sessao = db.prepare('SELECT * FROM sessions WHERE refresh_token_hash = ?').get(hash);
  if (!sessao) throw new Error('Sessão inválida');
  if (sessao.revogada_em) throw new Error('Sessão revogada');
  if (new Date(sessao.expira_em) < new Date()) throw new Error('Sessão expirada');

  const user = db.prepare(`
    SELECT u.*, r.nome as role_nome FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(sessao.user_id);
  if (!user || !user.ativo) throw new Error('Usuário inativo');

  // Rotação: revoga sessão antiga e cria nova
  db.prepare('UPDATE sessions SET revogada_em = ? WHERE id = ?').run(agora(), sessao.id);
  const tokens = criarSessao(user, ctx);

  return { user: sanitizarUser(user), ...tokens };
}

/**
 * Revoga uma sessão (logout). Se sessionId não passado, revoga a sessão
 * referenciada pelo refresh token.
 */
function logout({ refreshToken, sessionId }) {
  if (sessionId) {
    db.prepare('UPDATE sessions SET revogada_em = ? WHERE id = ?').run(agora(), sessionId);
    return;
  }
  if (refreshToken) {
    const hash = hashToken(refreshToken);
    db.prepare('UPDATE sessions SET revogada_em = ? WHERE refresh_token_hash = ?').run(agora(), hash);
  }
}

/**
 * Gera token de password reset. Token plain é retornado pra ser ENVIADO POR EMAIL.
 * Apenas o hash fica no DB. Token expira em 1h.
 */
function gerarResetSenha(email) {
  email = String(email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  // SEMPRE retorna sucesso (não vaza se o email existe — evita user enumeration)
  if (!user) return { token: null, enviado: false };

  const token = crypto.randomBytes(24).toString('hex');
  const hash = hashToken(token);
  const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO password_resets (token_hash, user_id, expira_em, criado_em)
    VALUES (?, ?, ?, ?)
  `).run(hash, user.id, expira, agora());

  auditar({ user_id: user.id, acao: 'password.reset_requested' });
  return { token, enviado: true };
}

/**
 * Aplica nova senha usando token recebido por email.
 */
async function aplicarResetSenha({ token, novaSenha }) {
  if (!token) throw new Error('Token ausente');
  if (!novaSenha || novaSenha.length < 8) throw new Error('Senha precisa ter pelo menos 8 caracteres');
  const hash = hashToken(token);
  const reset = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hash);
  if (!reset) throw new Error('Token inválido');
  if (reset.usado_em) throw new Error('Token já usado');
  if (new Date(reset.expira_em) < new Date()) throw new Error('Token expirado');

  const senha_hash = await bcrypt.hash(novaSenha, BCRYPT_ROUNDS);
  db.prepare('UPDATE users SET senha_hash = ?, atualizado_em = ? WHERE id = ?').run(senha_hash, agora(), reset.user_id);
  db.prepare('UPDATE password_resets SET usado_em = ? WHERE token_hash = ?').run(agora(), hash);

  // Revoga todas as sessões existentes (força re-login)
  db.prepare('UPDATE sessions SET revogada_em = ? WHERE user_id = ? AND revogada_em IS NULL').run(agora(), reset.user_id);

  auditar({ user_id: reset.user_id, acao: 'password.changed' });
}

// === Getters ===

function obterUserPorId(id) {
  const u = db.prepare(`
    SELECT u.*, r.nome as role_nome FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(id);
  return u ? sanitizarUser(u) : null;
}

function sanitizarUser(u) {
  if (!u) return null;
  const { senha_hash, ...rest } = u;
  return rest;
}

module.exports = {
  signup, login, refresh, logout,
  gerarResetSenha, aplicarResetSenha,
  obterUserPorId, sanitizarUser,
  verificarAccessToken, hashToken, auditar,
  // Helpers de teste/admin
  gerarAccessToken,
};
