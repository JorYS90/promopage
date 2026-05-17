// Middlewares de autenticação e autorização.
//
// requireAuth     — exige access token válido. Popula req.user.
// requireRole     — exige role específica (ou superior).
// requirePermission — exige permissão granular (e.g. 'users:update').
// optionalAuth    — popula req.user SE token presente, mas não bloqueia.
// requirePlan     — exige assinatura ativa em plano específico (Pro/Premium).

const service = require('./service');
const db = require('../db/schema');

// Hierarquia de roles (super_admin tem acesso a tudo abaixo)
const HIERARQUIA = { super_admin: 4, admin: 3, moderador: 2, cliente: 1 };

function extrairToken(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  // Fallback: cookie httpOnly
  return req.cookies?.access_token || null;
}

function requireAuth(req, res, next) {
  const token = extrairToken(req);
  if (!token) return res.status(401).json({ error: 'Não autenticado', code: 'NO_TOKEN' });
  const payload = service.verificarAccessToken(token);
  if (!payload) return res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });

  // Carrega user completo (pode ter sido suspenso depois do token emitido)
  const user = service.obterUserPorId(payload.sub);
  if (!user || !user.ativo) {
    return res.status(403).json({ error: 'Conta suspensa ou inativa', code: 'USER_INACTIVE' });
  }
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const token = extrairToken(req);
  if (!token) return next();
  const payload = service.verificarAccessToken(token);
  if (!payload) return next();
  const user = service.obterUserPorId(payload.sub);
  if (user && user.ativo) req.user = user;
  next();
}

function requireRole(rolesPermitidas) {
  if (!Array.isArray(rolesPermitidas)) rolesPermitidas = [rolesPermitidas];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const nivelUser = HIERARQUIA[req.user.role_nome] || 0;
    const nivelMinimo = Math.min(...rolesPermitidas.map(r => HIERARQUIA[r] || 99));
    if (nivelUser < nivelMinimo) {
      return res.status(403).json({ error: 'Permissão negada', code: 'FORBIDDEN' });
    }
    next();
  };
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const role = db.prepare('SELECT permissoes FROM roles WHERE id = ?').get(req.user.role_id);
    if (!role) return res.status(403).json({ error: 'Role inválida' });
    let perms = [];
    try { perms = JSON.parse(role.permissoes || '[]'); } catch {}
    // Wildcard '*' libera tudo (super_admin)
    if (perms.includes('*') || perms.includes(perm)) return next();
    return res.status(403).json({ error: `Permissão negada: ${perm}`, code: 'FORBIDDEN' });
  };
}

/**
 * Exige assinatura ATIVA. Opcionalmente filtra por planos específicos.
 * Uso: app.post('/feature-pro', requirePlan(['pro', 'premium']), handler)
 */
function requirePlan(planosPermitidos = null) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const sub = db.prepare(`
      SELECT s.*, p.slug as plan_slug, p.nome as plan_nome
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ? AND s.status IN ('ativo', 'trial')
      ORDER BY s.criado_em DESC LIMIT 1
    `).get(req.user.id);

    if (!sub) {
      return res.status(402).json({
        error: 'Assinatura necessária pra acessar esse recurso',
        code: 'PLAN_REQUIRED',
        plansAceitos: planosPermitidos,
      });
    }
    if (new Date(sub.vencimento) < new Date()) {
      return res.status(402).json({
        error: 'Assinatura vencida',
        code: 'PLAN_EXPIRED',
        vencimento: sub.vencimento,
      });
    }
    if (planosPermitidos && !planosPermitidos.includes(sub.plan_slug)) {
      return res.status(402).json({
        error: `Recurso disponível só nos planos: ${planosPermitidos.join(', ')}`,
        code: 'PLAN_INSUFFICIENT',
        planAtual: sub.plan_slug,
        plansAceitos: planosPermitidos,
      });
    }
    req.subscription = sub;
    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requirePlan,
};
