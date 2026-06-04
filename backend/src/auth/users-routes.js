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
const fs = require('fs');
const path = require('path');
const db = require('../db/schema');
const service = require('./service');
const { requireAuth } = require('./middleware');

// Diretório raiz de uploads (mesma constante usada em server.js).
// Cada user tem subpasta /uploads/<user_id>/ — removida no DELETE /me.
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
// Diretório de projetos salvos por user (caso exista — alguns deployments têm).
const PROJETOS_DIR = path.join(__dirname, '..', '..', 'projetos');

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

// === DELETE /api/users/me — exclusão definitiva da conta (LGPD Art. 18 VI) ===
// Validação dupla pra evitar exclusão acidental:
//   1. Senha atual (mesma proteção do troca-senha)
//   2. String literal "EXCLUIR" digitada manualmente
//
// Limpeza:
//   - Tabelas com FK CASCADE: subscriptions, payments, sessions, password_resets,
//     email_verifications, produtos, projetos, categorias_custom, temas_favoritos
//     (10 tabelas limpas automaticamente pelo DELETE da row em `users`).
//   - Audit logs: SET NULL (não apaga, anonimiza — necessário pra forense/compliance).
//   - Disk: remove /uploads/<user_id>/ (imagens enviadas) e /projetos/<user_id>/.
//
// Após sucesso, o frontend é responsável por descartar o token JWT do localStorage.
const excluirContaSchema = z.object({
  senha: z.string().min(1, 'Senha obrigatória'),
  confirmacao: z.literal('EXCLUIR', { errorMap: () => ({ message: 'Digite "EXCLUIR" pra confirmar' }) }),
});
router.delete('/me', requireAuth, async (req, res) => {
  const parse = excluirContaSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Dados inválidos', detalhes: parse.error.errors });
  }

  // Proteção: super_admin não pode auto-excluir (evita ficar sem nenhum admin)
  if (req.user.role_nome === 'super_admin') {
    return res.status(403).json({
      error: 'Conta de super admin não pode ser auto-excluída. Peça pra outro super admin.',
    });
  }

  // Valida senha atual
  const user = db.prepare('SELECT id, senha_hash, email FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const ok = await bcrypt.compare(parse.data.senha, user.senha_hash);
  if (!ok) return res.status(400).json({ error: 'Senha incorreta' });

  // Audita ANTES de deletar (depois o user_id seria null no audit_logs)
  service.auditar({
    user_id: req.user.id, actor_id: req.user.id, acao: 'user.account_deleted',
    recurso: `user:${req.user.id}`,
    dados: { email: user.email },
    ip: req.ip, user_agent: req.headers['user-agent'],
  });

  // Cleanup do disco — tolerante a falhas (não bloqueia a exclusão se arquivo
  // não existir ou não puder ser removido por permissão). Logs servem pra
  // debug posterior se o cleanup falhar.
  try {
    const uploadsDoUser = path.join(UPLOADS_DIR, String(req.user.id));
    if (fs.existsSync(uploadsDoUser)) {
      fs.rmSync(uploadsDoUser, { recursive: true, force: true });
      console.log(`[user.delete] uploads removidos: ${uploadsDoUser}`);
    }
  } catch (e) {
    console.warn(`[user.delete] falha ao remover uploads do user ${req.user.id}: ${e.message}`);
  }
  try {
    const projetosDoUser = path.join(PROJETOS_DIR, String(req.user.id));
    if (fs.existsSync(projetosDoUser)) {
      fs.rmSync(projetosDoUser, { recursive: true, force: true });
      console.log(`[user.delete] projetos removidos: ${projetosDoUser}`);
    }
  } catch (e) {
    console.warn(`[user.delete] falha ao remover projetos do user ${req.user.id}: ${e.message}`);
  }

  // DELETE da row em users — CASCADE limpa 10 tabelas relacionadas.
  // Em uma transação só, pra atomicidade.
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  if (result.changes === 0) {
    return res.status(500).json({ error: 'Falha ao excluir conta' });
  }

  res.json({
    ok: true,
    message: 'Conta excluída. Todos os seus dados foram removidos da plataforma.',
  });
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
    SELECT id, slug, nome, descricao,
           preco_mensal_centavos, preco_trimestral_centavos,
           preco_semestral_centavos, preco_anual_centavos,
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
