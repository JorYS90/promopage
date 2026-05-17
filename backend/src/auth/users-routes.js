// Endpoints de usuário logado (self-service).
//   GET    /api/users/me            — dados completos (com assinatura ativa + último pagamento)
//   PUT    /api/users/me            — atualiza nome/empresa/telefone/documento
//   PUT    /api/users/me/password   — troca senha (precisa da atual)
//   GET    /api/users/me/subscription — assinatura ativa + plano + recursos
//   GET    /api/users/me/payments  — histórico de pagamentos (paginado)
//   GET    /api/plans              — lista planos disponíveis (público)

const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const service = require('./service');
const { requireAuth } = require('./middleware');

const router = Router();

// === Helpers ===
function agora() { return new Date().toISOString(); }

function obterAssinaturaAtiva(userId) {
  return db.prepare(`
    SELECT s.*, p.slug as plan_slug, p.nome as plan_nome, p.descricao as plan_descricao,
           p.limites as plan_limites, p.recursos as plan_recursos,
           p.preco_mensal_centavos, p.preco_anual_centavos
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status IN ('ativo','trial')
    ORDER BY s.criado_em DESC LIMIT 1
  `).get(userId);
}

function parseAssinatura(sub) {
  if (!sub) return null;
  return {
    ...sub,
    plan_limites: tryParse(sub.plan_limites, {}),
    plan_recursos: tryParse(sub.plan_recursos, []),
  };
}

function tryParse(s, fb) { try { return JSON.parse(s || ''); } catch { return fb; } }

// === Validators ===
const perfilSchema = z.object({
  nome: z.string().min(2).max(120),
  empresa: z.string().max(120).optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  documento: z.string().max(20).optional().nullable(),
});

const senhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8, 'Mínimo 8 caracteres'),
});

// === GET /api/users/me — dados completos do user logado ===
router.get('/me', requireAuth, (req, res) => {
  const sub = parseAssinatura(obterAssinaturaAtiva(req.user.id));
  const ultimoPag = db.prepare(`
    SELECT id, valor_centavos, moeda, metodo, status, gateway, pago_em, criado_em
    FROM payments WHERE user_id = ? ORDER BY criado_em DESC LIMIT 1
  `).get(req.user.id);
  res.json({
    user: req.user,
    subscription: sub,
    lastPayment: ultimoPag || null,
  });
});

// === PUT /api/users/me — atualiza perfil ===
router.put('/me', requireAuth, (req, res) => {
  const parse = perfilSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });
  const { nome, empresa, telefone, documento } = parse.data;
  db.prepare(`
    UPDATE users SET nome=?, empresa=?, telefone=?, documento=?, atualizado_em=?
    WHERE id=?
  `).run(nome, empresa || null, telefone || null, documento || null, agora(), req.user.id);
  service.auditar({
    user_id: req.user.id, actor_id: req.user.id, acao: 'user.profile_updated',
    recurso: `user:${req.user.id}`, ip: req.ip, user_agent: req.headers['user-agent'],
  });
  const atualizado = service.obterUserPorId(req.user.id);
  res.json({ user: atualizado });
});

// === PUT /api/users/me/password — troca de senha (precisa da atual) ===
router.put('/me/password', requireAuth, async (req, res) => {
  const parse = senhaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });

  // Busca user com senha_hash (não vem em req.user pra evitar exposição)
  const user = db.prepare('SELECT id, senha_hash FROM users WHERE id = ?').get(req.user.id);
  const ok = await bcrypt.compare(parse.data.senhaAtual, user.senha_hash);
  if (!ok) return res.status(400).json({ error: 'Senha atual incorreta' });

  const hash = await bcrypt.hash(parse.data.novaSenha, 12);
  db.prepare('UPDATE users SET senha_hash=?, atualizado_em=? WHERE id=?').run(hash, agora(), req.user.id);
  // Revoga todas as outras sessões (força re-login em outros devices)
  db.prepare(`
    UPDATE sessions SET revogada_em=? WHERE user_id=? AND revogada_em IS NULL
  `).run(agora(), req.user.id);

  service.auditar({
    user_id: req.user.id, actor_id: req.user.id, acao: 'user.password_changed',
    ip: req.ip, user_agent: req.headers['user-agent'],
  });
  res.json({ ok: true, message: 'Senha alterada. Outras sessões foram desconectadas.' });
});

// === GET /api/users/me/subscription ===
router.get('/me/subscription', requireAuth, (req, res) => {
  const sub = parseAssinatura(obterAssinaturaAtiva(req.user.id));
  if (!sub) return res.json({ subscription: null });
  // Calcula dias restantes
  const diasRestantes = Math.max(0, Math.ceil(
    (new Date(sub.vencimento) - new Date()) / (1000 * 60 * 60 * 24)
  ));
  res.json({ subscription: { ...sub, diasRestantes } });
});

// === GET /api/users/me/payments — histórico paginado ===
router.get('/me/payments', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const payments = db.prepare(`
    SELECT id, valor_centavos, moeda, metodo, status, gateway, pago_em, criado_em, metadata
    FROM payments WHERE user_id = ?
    ORDER BY criado_em DESC LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM payments WHERE user_id = ?').get(req.user.id).c;
  res.json({
    payments: payments.map(p => ({ ...p, metadata: tryParse(p.metadata, {}) })),
    total, limit, offset,
  });
});

// === GET /api/users/me/interesses ===
// Retorna o array de IDs de segmentos que o usuário marcou como interesse.
router.get('/me/interesses', requireAuth, (req, res) => {
  const row = db.prepare('SELECT interesses FROM users WHERE id = ?').get(req.user.id);
  let lista = [];
  try { lista = JSON.parse(row?.interesses || '[]'); } catch {}
  res.json({ interesses: Array.isArray(lista) ? lista : [] });
});

// === PUT /api/users/me/interesses ===
// Salva o array de IDs de segmentos que o usuário marcou como interesse.
// Body: { interesses: ['acougue', 'padaria', ...] }
const interessesSchema = z.object({
  interesses: z.array(z.string().max(60)).max(100),
});
router.put('/me/interesses', requireAuth, (req, res) => {
  const parse = interessesSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });
  const lista = parse.data.interesses;
  db.prepare('UPDATE users SET interesses = ?, atualizado_em = ? WHERE id = ?')
    .run(JSON.stringify(lista), agora(), req.user.id);
  service.auditar({
    user_id: req.user.id, actor_id: req.user.id, acao: 'user.interesses_updated',
    recurso: `user:${req.user.id}`, dados: { quantidade: lista.length },
    ip: req.ip, user_agent: req.headers['user-agent'],
  });
  res.json({ ok: true, interesses: lista });
});

// === GET /api/plans — lista planos ativos (público, pra mostrar na página de upgrade) ===
router.get('/plans', (req, res) => {
  const planos = db.prepare(`
    SELECT id, slug, nome, descricao, preco_mensal_centavos, preco_anual_centavos,
           limites, recursos, ordem
    FROM plans WHERE ativo = 1 ORDER BY ordem ASC, preco_mensal_centavos ASC
  `).all();
  res.json({
    plans: planos.map(p => ({
      ...p,
      limites: tryParse(p.limites, {}),
      recursos: tryParse(p.recursos, []),
    })),
  });
});

module.exports = router;
