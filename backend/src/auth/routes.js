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
const { enviarReset } = require('../lib/email');
const { validarTelefone, validarDocumento } = require('../lib/documento');

const router = Router();

// Validators Zod (input strict)
// telefone e documento (CPF/CNPJ) são OBRIGATÓRIOS e validados de verdade
// (dígito verificador), não só presença. empresa segue opcional.
const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Mínimo 8 caracteres'),
  nome: z.string().min(2, 'Nome muito curto').max(120),
  empresa: z.string().max(120).optional().nullable(),
  telefone: z.string({ required_error: 'Telefone obrigatório' })
    .max(30)
    .refine(validarTelefone, 'Telefone inválido — informe DDD + número'),
  documento: z.string({ required_error: 'CPF/CNPJ obrigatório' })
    .max(20)
    .refine(validarDocumento, 'CPF ou CNPJ inválido'),
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

// Cookie options (httpOnly = inacessível ao JS — proteção contra XSS roubo de token).
// secure: ON em produção OU quando SECURE_COOKIES=true explicitamente (ex: dev sob HTTPS).
//
// domain: configurado via COOKIE_DOMAIN env (em prod: ".promopage.com.br" pra que o
// cookie seja válido em TODOS os subdomínios — promopage.com.br + videos.promopage.com.br).
// Em dev (localhost) deixa undefined porque "domain=.localhost" não funciona consistente
// entre browsers; cada porta vira um "site" separado e o user precisa logar nos 2.
function cookieOptions(diasExpira) {
  const secure = process.env.NODE_ENV === 'production'
    || process.env.SECURE_COOKIES === 'true';
  const opts = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: diasExpira * 24 * 60 * 60 * 1000,
    path: '/',
  };
  if (process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }
  return opts;
}

// Helper pra setar ACCESS_TOKEN como cookie httpOnly também. Antes o access ia
// só no body (frontend guardava no localStorage). Agora vai TAMBÉM no cookie
// pra que requests cross-subdomain (videos.promopage.com.br) funcionem sem
// passar token via header (que exige proxy ou logic extra).
// Mantemos o body também — compat retroativa com frontend que ainda usa Bearer.
function setarCookiesAuth(res, accessToken, refreshToken) {
  // Access token: vida curta (15 min default no service)
  res.cookie('access_token', accessToken, cookieOptions(1));     // 1 dia (cap de segurança)
  // Refresh token: vida longa (30 dias)
  res.cookie('refresh_token', refreshToken, cookieOptions(30));
}

function limparCookiesAuth(res) {
  // clearCookie precisa do mesmo path + domain pra funcionar de verdade
  const clearOpts = { path: '/' };
  if (process.env.COOKIE_DOMAIN) clearOpts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie('access_token', clearOpts);
  res.clearCookie('refresh_token', clearOpts);
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
    setarCookiesAuth(res, accessToken, refreshToken);
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
    setarCookiesAuth(res, accessToken, refreshToken);
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
    setarCookiesAuth(res, accessToken, novoRefresh);
    res.json({ user, accessToken });
  } catch (e) {
    limparCookiesAuth(res);
    res.status(401).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
  service.logout({ refreshToken });
  limparCookiesAuth(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/password/forgot', async (req, res) => {
  const parse = forgotSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Email inválido' });
  const { token } = service.gerarResetSenha(parse.data.email);

  // Em prod com email configurado: dispara reset por email.
  // Em dev (sem RESEND_API_KEY): backend loga, e devolvemos o token no response
  // pra facilitar testes manuais sem precisar configurar email.
  if (token) {
    const baseUrl = (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4010}`).replace(/\/+$/, '');
    const link = `${baseUrl}/?reset=${encodeURIComponent(token)}`;
    try {
      await enviarReset({ to: parse.data.email, token, link });
    } catch (err) {
      // Não vaza falha pro cliente (evita enumeration). Loga server-side.
      console.error('[password/forgot] falha ao enviar email:', err.message);
    }
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        ok: true,
        _dev_token: token,
        _dev_link: link,
        _aviso: 'Token retornado só em DEV. Em PROD seria enviado APENAS por email.',
      });
    }
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
