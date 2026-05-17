// Rotas HTTP de autenticação. Toda lógica de domínio vive em service.js;
// aqui só validamos input, chamamos o service, e retornamos JSON.
//
// Endpoints:
//   POST /api/auth/signup             — cadastro
//   POST /api/auth/login              — login (retorna access + refresh tokens)
//   POST /api/auth/refresh            — troca refresh por novo access
//   POST /api/auth/logout             — revoga sessão atual
//   GET  /api/auth/me                 — dados do usuário logado
//   POST /api/auth/password/forgot    — solicita reset (envia email)
//   POST /api/auth/password/reset     — aplica nova senha com token
//   POST /api/auth/password/change    — troca senha logado

const { Router } = require('express');
const { z } = require('zod');
const service = require('./service');
const { requireAuth } = require('./middleware');

const router = Router();

// Validators Zod (input strict)
const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Mínimo 8 caracteres'),
  nome: z.string().min(2, 'Nome muito curto').max(120),
  empresa: z.string().max(120).optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  documento: z.string().max(20).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(10),
  novaSenha: z.string().min(8),
});

// Helper: extrai contexto (IP + user-agent) pra audit/rate-limit
function ctx(req) {
  return {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

// Cookie options (httpOnly = inacessível ao JS — proteção contra XSS roubo de token)
// secure: ON em produção OU quando SECURE_COOKIES=true explicitamente (ex: dev sob HTTPS).
function cookieOptions(diasExpira) {
  const secure = process.env.NODE_ENV === 'production'
    || process.env.SECURE_COOKIES === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: diasExpira * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

// === Endpoints ===

router.post('/signup', async (req, res) => {
  const parse = signupSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });
  }
  try {
    const user = await service.signup(parse.data, ctx(req));
    // Auto-login após signup
    const { accessToken, refreshToken } = await service.login(
      { email: parse.data.email, senha: parse.data.senha }, ctx(req)
    );
    res.cookie('refresh_token', refreshToken, cookieOptions(30));
    res.json({ user, accessToken });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Email ou senha inválidos' });
  try {
    const { user, accessToken, refreshToken } = await service.login(parse.data, ctx(req));
    res.cookie('refresh_token', refreshToken, cookieOptions(30));
    res.json({ user, accessToken });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token ausente' });
  try {
    const { user, accessToken, refreshToken: novoRefresh } = await service.refresh(refreshToken, ctx(req));
    res.cookie('refresh_token', novoRefresh, cookieOptions(30));
    res.json({ user, accessToken });
  } catch (e) {
    res.clearCookie('refresh_token');
    res.status(401).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
  service.logout({ refreshToken });
  res.clearCookie('refresh_token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/password/forgot', (req, res) => {
  const parse = forgotSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Email inválido' });
  const { token, enviado } = service.gerarResetSenha(parse.data.email);
  // EM PROD: aqui enviamos email com o token. Pra dev, retornamos no response
  // (com warning) pra facilitar testes. NUNCA exponha o token em produção.
  if (process.env.NODE_ENV !== 'production' && token) {
    return res.json({
      ok: true,
      _dev_token: token,
      _aviso: 'Token retornado só em DEV. Em PROD seria enviado por email.',
    });
  }
  res.json({ ok: true });
});

router.post('/password/reset', async (req, res) => {
  const parse = resetSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  try {
    await service.aplicarResetSenha(parse.data);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
