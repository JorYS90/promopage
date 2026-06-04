// Cota mensal de vídeos do PromoVideo — gerenciada CENTRALMENTE pelo PromoPage.
//
// Cada user tem um limite por mês definido pelo plano (limites.videosPorMes):
//   - 0  = sem PromoVideo (não pode gerar vídeo)
//   - 30 = plano "Ilimitado + 30 Vídeos"
//   - 100= plano "Ilimitado + 100 Vídeos"
//   - -1 = ilimitado (super_admin/admin)
//
// Tabela video_usage tem 1 linha por (user, ano_mes). count incrementa a cada
// vídeo gerado. Mês novo = linha nova (reset implícito). Histórico preservado.
//
// Uso do PromoVideo:
//   GET  /api/me/video-quota          → frontend mostra "X/30"
//   POST /api/me/consumir-video       → antes de enfileirar render

const db = require('./db/schema');

const agora = () => new Date().toISOString();
const anoMesAtual = (date = new Date()) => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
};

// Lê o limite de vídeos do user a partir do plano ATIVO.
// Retorna 0 se sem assinatura ativa ou plano sem PromoVideo.
// Admin/super_admin: -1 (ilimitado) — pra teste sem bloqueio.
function limiteDoUser(userId) {
  const user = db.prepare(`
    SELECT u.id, u.role_id, r.nome AS role_nome
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(userId);
  if (!user) return 0;
  if (user.role_nome === 'super_admin' || user.role_nome === 'admin') return -1;

  const sub = db.prepare(`
    SELECT s.plan_id, p.limites
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status IN ('ativo','trial')
    ORDER BY s.criado_em DESC LIMIT 1
  `).get(userId);
  if (!sub) return 0;
  try {
    const limites = JSON.parse(sub.limites || '{}');
    const v = limites.videosPorMes;
    if (v === -1) return -1;
    return typeof v === 'number' && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

// Quantidade já usada no mês atual (ou no mês passado em ref).
function usoNoMes(userId, anoMes = anoMesAtual()) {
  const row = db.prepare(`
    SELECT count FROM video_usage WHERE user_id = ? AND ano_mes = ?
  `).get(userId, anoMes);
  return row ? row.count : 0;
}

// Status completo pra UI: { limite, usado, restante, anoMes, podeGerar }
function statusDoUser(userId) {
  const limite = limiteDoUser(userId);
  const anoMes = anoMesAtual();
  const usado = usoNoMes(userId, anoMes);
  const ilimitado = limite === -1;
  const restante = ilimitado ? -1 : Math.max(0, limite - usado);
  const podeGerar = ilimitado || (limite > 0 && usado < limite);
  return { limite, usado, restante, anoMes, podeGerar, ilimitado };
}

// Incrementa o contador do mês atual. Atômico via UPSERT.
// Retorna { ok: true, ...status } se sucesso, ou
//         { ok: false, motivo: 'NO_PLAN'|'QUOTA_EXCEEDED', ...status } se bloqueado.
function consumirUm(userId) {
  const status = statusDoUser(userId);
  if (status.limite === 0) {
    return { ok: false, motivo: 'NO_PLAN', ...status };
  }
  if (!status.podeGerar) {
    return { ok: false, motivo: 'QUOTA_EXCEEDED', ...status };
  }
  const anoMes = status.anoMes;
  // UPSERT atômico (better-sqlite3 é síncrono — sem race condition em single-process)
  db.prepare(`
    INSERT INTO video_usage (user_id, ano_mes, count, atualizado_em)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id, ano_mes) DO UPDATE SET
      count = count + 1,
      atualizado_em = excluded.atualizado_em
  `).run(userId, anoMes, agora());
  // Re-lê pro número exato após incremento
  const novoStatus = statusDoUser(userId);
  return { ok: true, ...novoStatus };
}

module.exports = {
  statusDoUser,
  consumirUm,
  limiteDoUser,
  usoNoMes,
  anoMesAtual,
};
