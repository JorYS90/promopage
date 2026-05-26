// Endpoints do painel administrativo. Todas as rotas exigem role >= admin.
//
//   GET    /api/admin/stats                    — números do dashboard (users, MRR, etc.)
//   GET    /api/admin/users                    — lista paginada com filtros
//   GET    /api/admin/users/:id                — detalhe + assinatura + pagamentos
//   PUT    /api/admin/users/:id                — atualiza nome/empresa/role/etc.
//   POST   /api/admin/users/:id/suspend        — suspende conta
//   POST   /api/admin/users/:id/reactivate     — reativa conta
//   POST   /api/admin/users/:id/change-plan    — força mudança de plano (cria/atualiza subscription)
//   GET    /api/admin/subscriptions            — lista assinaturas (com filtros)
//   GET    /api/admin/payments                 — lista todos os pagamentos
//   GET    /api/admin/audit-logs               — histórico de ações
//   PUT    /api/admin/plans/:id                — edita plano (preço, limites, recursos)

const { Router } = require('express');
const { z } = require('zod');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../auth/middleware');
const service = require('../auth/service');

const router = Router();

// TODAS as rotas exigem auth + role admin ou super_admin
router.use(requireAuth);
router.use(requireRole(['admin', 'super_admin']));

const agora = () => new Date().toISOString();
const tryParse = (s, fb) => { try { return JSON.parse(s || ''); } catch { return fb; } };

// === GET /api/admin/stats ===
router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const activeUsers = db.prepare('SELECT COUNT(*) c FROM users WHERE ativo = 1').get().c;
  const suspendedUsers = totalUsers - activeUsers;
  const novosUlt30d = db.prepare(`
    SELECT COUNT(*) c FROM users WHERE criado_em >= datetime('now', '-30 days')
  `).get().c;

  const activeSubs = db.prepare(`
    SELECT COUNT(*) c FROM subscriptions WHERE status IN ('ativo','trial')
  `).get().c;
  const expiredSubs = db.prepare(`
    SELECT COUNT(*) c FROM subscriptions WHERE status IN ('expirado','cancelado','suspenso')
  `).get().c;

  // MRR aproximado (assinaturas ativas, normalizado pra mensal)
  const mrrRow = db.prepare(`
    SELECT COALESCE(SUM(
      CASE s.ciclo
        WHEN 'anual' THEN p.preco_anual_centavos / 12.0
        ELSE p.preco_mensal_centavos
      END
    ), 0) as mrr
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.status IN ('ativo','trial')
  `).get();

  const receitaUlt30d = db.prepare(`
    SELECT COALESCE(SUM(valor_centavos), 0) as total
    FROM payments WHERE status = 'pago' AND criado_em >= datetime('now', '-30 days')
  `).get().total;

  const inadimplentes = db.prepare(`
    SELECT COUNT(DISTINCT user_id) c FROM subscriptions
    WHERE status IN ('pendente','expirado') AND vencimento < datetime('now')
  `).get().c;

  // Top planos por nº de assinantes
  const planosTopRows = db.prepare(`
    SELECT p.slug, p.nome, COUNT(s.id) as assinantes
    FROM plans p
    LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status IN ('ativo','trial')
    GROUP BY p.id ORDER BY assinantes DESC
  `).all();

  res.json({
    users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, novosUlt30d },
    subscriptions: { active: activeSubs, expired: expiredSubs, inadimplentes },
    financial: {
      mrr_centavos: Math.round(mrrRow.mrr),
      receita_ult30d_centavos: receitaUlt30d,
    },
    planos_top: planosTopRows,
  });
});

// === GET /api/admin/users ===
router.get('/users', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const busca = (req.query.q || '').toString().trim();
  const filtroAtivo = req.query.ativo;  // '0', '1', ou ausente (todos)
  const filtroRole = req.query.role;    // ex: 'cliente'

  let where = ['1=1'];
  let params = [];
  if (busca) {
    where.push('(u.email LIKE ? OR u.nome LIKE ? OR u.empresa LIKE ? OR u.documento LIKE ?)');
    const like = `%${busca}%`;
    params.push(like, like, like, like);
  }
  if (filtroAtivo === '0' || filtroAtivo === '1') {
    where.push('u.ativo = ?');
    params.push(parseInt(filtroAtivo));
  }
  if (filtroRole) {
    where.push('r.nome = ?');
    params.push(filtroRole);
  }
  const whereSQL = where.join(' AND ');

  const total = db.prepare(`
    SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE ${whereSQL}
  `).get(...params).c;

  const users = db.prepare(`
    SELECT u.id, u.email, u.nome, u.empresa, u.telefone, u.documento,
           u.ativo, u.motivo_suspensao, u.criado_em, u.atualizado_em,
           r.nome as role_nome, r.id as role_id,
           (SELECT s.id FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('ativo','trial') ORDER BY s.criado_em DESC LIMIT 1) as sub_id,
           (SELECT p.slug FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = u.id AND s.status IN ('ativo','trial') ORDER BY s.criado_em DESC LIMIT 1) as plan_slug,
           (SELECT s.status FROM subscriptions s WHERE s.user_id = u.id ORDER BY s.criado_em DESC LIMIT 1) as sub_status
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE ${whereSQL}
    ORDER BY u.criado_em DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ users, total, limit, offset });
});

// === GET /api/admin/users/:id ===
router.get('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare(`
    SELECT u.*, r.nome as role_nome FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
  `).get(id);
  if (!user) return res.status(404).json({ error: 'User não encontrado' });
  delete user.senha_hash;

  const subscriptions = db.prepare(`
    SELECT s.*, p.slug as plan_slug, p.nome as plan_nome
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? ORDER BY s.criado_em DESC
  `).all(id);

  const payments = db.prepare(`
    SELECT * FROM payments WHERE user_id = ? ORDER BY criado_em DESC LIMIT 50
  `).all(id);

  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs WHERE user_id = ? ORDER BY criado_em DESC LIMIT 20
  `).all(id);

  res.json({ user, subscriptions, payments, auditLogs });
});

// === PUT /api/admin/users/:id ===
const adminUserSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  empresa: z.string().max(120).nullable().optional(),
  telefone: z.string().max(30).nullable().optional(),
  documento: z.string().max(20).nullable().optional(),
  role_id: z.number().int().min(1).max(4).optional(),
});

router.put('/users/:id', (req, res) => {
  const parse = adminUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });
  const id = parseInt(req.params.id);
  const existente = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(id);
  if (!existente) return res.status(404).json({ error: 'User não encontrado' });

  // Só super_admin pode mudar role pra super_admin ou de super_admin pra outro
  if (parse.data.role_id !== undefined) {
    const podeMudarRole = req.user.role_nome === 'super_admin';
    const ehMudancaSensivel = existente.role_id === 1 || parse.data.role_id === 1;
    if (ehMudancaSensivel && !podeMudarRole) {
      return res.status(403).json({ error: 'Apenas super_admin pode alterar role super_admin' });
    }
  }

  const campos = [];
  const params = [];
  for (const [k, v] of Object.entries(parse.data)) {
    campos.push(`${k} = ?`);
    params.push(v);
  }
  if (campos.length === 0) return res.json({ ok: true });

  campos.push('atualizado_em = ?');
  params.push(agora());
  params.push(id);

  db.prepare(`UPDATE users SET ${campos.join(', ')} WHERE id = ?`).run(...params);
  service.auditar({
    user_id: id, actor_id: req.user.id, acao: 'admin.user_updated',
    recurso: `user:${id}`, dados: parse.data,
    ip: req.ip, user_agent: req.headers['user-agent'],
  });
  res.json({ ok: true });
});

// === POST /api/admin/users/:id/suspend ===
router.post('/users/:id/suspend', (req, res) => {
  const id = parseInt(req.params.id);
  const motivo = (req.body?.motivo || 'Suspenso pelo admin').toString().slice(0, 300);

  if (id === req.user.id) return res.status(400).json({ error: 'Não pode suspender a si mesmo' });

  const user = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User não encontrado' });
  if (user.role_id === 1 && req.user.role_nome !== 'super_admin') {
    return res.status(403).json({ error: 'Apenas super_admin pode suspender super_admin' });
  }

  db.prepare(`
    UPDATE users SET ativo = 0, motivo_suspensao = ?, atualizado_em = ? WHERE id = ?
  `).run(motivo, agora(), id);

  // Revoga todas as sessões ativas (força logout)
  db.prepare(`
    UPDATE sessions SET revogada_em = ? WHERE user_id = ? AND revogada_em IS NULL
  `).run(agora(), id);

  service.auditar({
    user_id: id, actor_id: req.user.id, acao: 'admin.user_suspended',
    recurso: `user:${id}`, dados: { motivo },
    ip: req.ip, user_agent: req.headers['user-agent'],
  });
  res.json({ ok: true });
});

// === POST /api/admin/users/:id/reactivate ===
router.post('/users/:id/reactivate', (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User não encontrado' });

  db.prepare(`
    UPDATE users SET ativo = 1, motivo_suspensao = NULL, atualizado_em = ? WHERE id = ?
  `).run(agora(), id);

  service.auditar({
    user_id: id, actor_id: req.user.id, acao: 'admin.user_reactivated',
    recurso: `user:${id}`, ip: req.ip, user_agent: req.headers['user-agent'],
  });
  res.json({ ok: true });
});

// === POST /api/admin/users/:id/change-plan ===
// Cria ou atualiza assinatura forçando um plano (útil pra liberar manual,
// dar plano de cortesia, etc). Não cobra nada — é só ajuste interno.
const changePlanSchema = z.object({
  plan_id: z.number().int(),
  ciclo: z.enum(['mensal', 'anual']).optional().default('mensal'),
  diasValidade: z.number().int().min(1).max(3650).optional().default(30),
  status: z.enum(['ativo', 'trial', 'cancelado', 'suspenso']).optional().default('ativo'),
});

router.post('/users/:id/change-plan', (req, res) => {
  const parse = changePlanSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });
  const id = parseInt(req.params.id);
  const { plan_id, ciclo, diasValidade, status } = parse.data;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User não encontrado' });
  const plan = db.prepare('SELECT id, slug, nome FROM plans WHERE id = ? AND ativo = 1').get(plan_id);
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado ou inativo' });

  const inicio = agora();
  const vencimento = new Date(Date.now() + diasValidade * 86400000).toISOString();

  // Cancela assinaturas ativas anteriores
  db.prepare(`
    UPDATE subscriptions SET status = 'cancelado', cancelada_em = ?, motivo_cancelamento = 'Troca de plano via admin', atualizado_em = ?
    WHERE user_id = ? AND status IN ('ativo','trial')
  `).run(agora(), agora(), id);

  // Cria nova
  const r = db.prepare(`
    INSERT INTO subscriptions (user_id, plan_id, status, ciclo, inicio, vencimento, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, plan_id, status, ciclo, inicio, vencimento, inicio, inicio);

  service.auditar({
    user_id: id, actor_id: req.user.id, acao: 'admin.plan_changed',
    recurso: `user:${id}`, dados: { plan_slug: plan.slug, ciclo, status, vencimento },
    ip: req.ip, user_agent: req.headers['user-agent'],
  });
  res.json({ ok: true, subscription_id: r.lastInsertRowid });
});

// === GET /api/admin/subscriptions ===
router.get('/subscriptions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;  // 'ativo','trial','pendente','expirado'...

  let where = ['1=1'];
  let params = [];
  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) c FROM subscriptions s WHERE ${where.join(' AND ')}`).get(...params).c;

  const subs = db.prepare(`
    SELECT s.*, u.email, u.nome as user_nome, p.slug as plan_slug, p.nome as plan_nome,
           p.preco_mensal_centavos
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    JOIN plans p ON p.id = s.plan_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.criado_em DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ subscriptions: subs, total, limit, offset });
});

// === GET /api/admin/payments ===
router.get('/payments', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  let where = ['1=1'];
  let params = [];
  if (status) { where.push('p.status = ?'); params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) c FROM payments p WHERE ${where.join(' AND ')}`).get(...params).c;
  const totalCents = db.prepare(`
    SELECT COALESCE(SUM(valor_centavos),0) c FROM payments p WHERE ${where.join(' AND ')} AND status='pago'
  `).get(...params).c;

  const payments = db.prepare(`
    SELECT p.*, u.email, u.nome as user_nome
    FROM payments p
    JOIN users u ON u.id = p.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.criado_em DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    payments: payments.map(p => ({ ...p, metadata: tryParse(p.metadata, {}) })),
    total, totalCentsPagos: totalCents, limit, offset,
  });
});

// === GET /api/admin/audit-logs ===
router.get('/audit-logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const acao = req.query.acao;

  let where = ['1=1'];
  let params = [];
  if (acao) { where.push('a.acao = ?'); params.push(acao); }

  const total = db.prepare(`SELECT COUNT(*) c FROM audit_logs a WHERE ${where.join(' AND ')}`).get(...params).c;
  const logs = db.prepare(`
    SELECT a.*, u.email as user_email, ac.email as actor_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN users ac ON ac.id = a.actor_id
    WHERE ${where.join(' AND ')}
    ORDER BY a.criado_em DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    logs: logs.map(l => ({ ...l, dados: tryParse(l.dados, {}) })),
    total, limit, offset,
  });
});

// === GET /api/admin/plans ===
router.get('/plans', (req, res) => {
  const planos = db.prepare(`
    SELECT * FROM plans ORDER BY ordem ASC, preco_mensal_centavos ASC
  `).all();
  res.json({
    plans: planos.map(p => ({
      ...p,
      limites: tryParse(p.limites, {}),
      recursos: tryParse(p.recursos, []),
    })),
  });
});

// === GET /api/admin/interesses-stats ===
// Agrega os interesses (segmentos) marcados por TODOS os usuários e retorna o
// ranking (mais marcados primeiro) + quantos marcaram / não marcaram nenhum.
router.get('/interesses-stats', (req, res) => {
  const rows = db.prepare('SELECT interesses FROM users').all();
  const counts = {};
  let comInteresse = 0;
  for (const row of rows) {
    let lista = tryParse(row.interesses, []);
    if (!Array.isArray(lista)) lista = [];
    // 'todos' é um meta-seletor (marca tudo na UI); não conta como segmento real.
    lista = lista.filter(id => id && id !== 'todos');
    if (lista.length > 0) comInteresse++;
    for (const id of lista) counts[id] = (counts[id] || 0) + 1;
  }
  const total = rows.length;
  const ranking = Object.entries(counts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
  res.json({
    ranking,
    totalUsuarios: total,
    usuariosComInteresse: comInteresse,
    usuariosSemInteresse: total - comInteresse,
  });
});

module.exports = router;
