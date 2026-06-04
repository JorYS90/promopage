// Rotas de pagamento — Mercado Pago Checkout Pro.
//   POST /api/pagamentos/checkout  (auth) — cria preferência, devolve init_point
//   POST /api/pagamentos/webhook   (público) — MP notifica status do pagamento
//
// Fluxo: usuário clica "Assinar" → /checkout cria preferência + payment 'pendente'
// → redireciona pro MP → paga → MP chama /webhook → confirmamos via API do MP
// → marca payment 'pago' + ativa a assinatura.

const { Router } = require('express');
const db = require('./db/schema');
const { requireAuth } = require('./auth/middleware');
const mp = require('./lib/mercadopago');

const router = Router();
const agora = () => new Date().toISOString();

// Base do FRONTEND (back_urls) e da API (webhook). Em produção ambos são o
// domínio (mesmo host serve front + /api). Em dev, front=5173 / api via proxy.
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');

// 4 ciclos suportados: mensal (30d) | trimestral (90d) | semestral (180d) | anual (365d)
const CICLOS_VALIDOS = ['mensal', 'trimestral', 'semestral', 'anual'];
const DIAS_POR_CICLO = { mensal: 30, trimestral: 90, semestral: 180, anual: 365 };
const COLUNA_PRECO_POR_CICLO = {
  mensal: 'preco_mensal_centavos',
  trimestral: 'preco_trimestral_centavos',
  semestral: 'preco_semestral_centavos',
  anual: 'preco_anual_centavos',
};

function ativarAssinatura(userId, planId, ciclo) {
  const inicio = agora();
  const dias = DIAS_POR_CICLO[ciclo] || 30;
  const vencimento = new Date(Date.now() + dias * 86400000).toISOString();
  // cancela assinatura ativa anterior (troca de plano / renovação)
  db.prepare(`
    UPDATE subscriptions SET status='cancelado', cancelada_em=?, motivo_cancelamento='Nova assinatura paga', atualizado_em=?
    WHERE user_id=? AND status IN ('ativo','trial')
  `).run(inicio, inicio, userId);
  const r = db.prepare(`
    INSERT INTO subscriptions (user_id, plan_id, status, ciclo, inicio, vencimento, criado_em, atualizado_em)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(userId, planId, 'ativo', ciclo, inicio, vencimento, inicio, inicio);
  return r.lastInsertRowid;
}

// === POST /api/pagamentos/checkout ===
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    if (!mp.configurado()) {
      return res.status(503).json({ error: 'Pagamentos indisponíveis no momento.' });
    }
    const slug = (req.body?.slug || '').toString();
    const cicloRaw = (req.body?.ciclo || 'mensal').toString();
    const ciclo = CICLOS_VALIDOS.includes(cicloRaw) ? cicloRaw : 'mensal';

    const plan = db.prepare('SELECT * FROM plans WHERE slug = ? AND ativo = 1').get(slug);
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });

    const colunaPreco = COLUNA_PRECO_POR_CICLO[ciclo];
    const valorCentavos = plan[colunaPreco];
    if (!valorCentavos || valorCentavos <= 0) {
      return res.status(400).json({ error: `Plano sem preço definido pra ciclo ${ciclo}` });
    }

    // Valor de TESTE (somente admin/super_admin): permite validar um pagamento
    // real com valor mínimo (R$1 a R$10) sem criar plano público. Usuários
    // normais SEMPRE pagam o preço do plano.
    let valorCobranca = valorCentavos;
    let ehTeste = false;
    const ehAdmin = req.user.role_nome === 'admin' || req.user.role_nome === 'super_admin';
    if (ehAdmin && req.body?.valorTesteCentavos != null) {
      const vt = parseInt(req.body.valorTesteCentavos, 10);
      if (Number.isFinite(vt) && vt >= 100 && vt <= 1000) { valorCobranca = vt; ehTeste = true; }
    }

    // Registra pagamento PENDENTE (vincula o resto via external_reference)
    const pag = db.prepare(`
      INSERT INTO payments (user_id, valor_centavos, moeda, metodo, status, gateway, metadata, criado_em)
      VALUES (?, ?, 'BRL', 'mercado_pago', 'pendente', 'mercado_pago', ?, ?)
    `).run(req.user.id, valorCobranca, JSON.stringify({ plan_id: plan.id, ciclo, teste: ehTeste }), agora());
    const payRow = pag.lastInsertRowid;

    // external_reference: u<userId>:p<planId>:<ciclo>:pay<paymentRowId>
    const externalReference = `u${req.user.id}:p${plan.id}:${ciclo}:pay${payRow}`;

    const labelCiclo = ciclo === 'anual' ? 'Anual'
      : ciclo === 'semestral' ? 'Semestral'
      : ciclo === 'trimestral' ? 'Trimestral'
      : 'Mensal';
    const pref = await mp.criarPreferencia({
      titulo: ehTeste
        ? `PromoPage — Teste de pagamento (${plan.nome})`
        : `PromoPage ${plan.nome} — ${labelCiclo}`,
      valorCentavos: valorCobranca,
      payerEmail: req.user.email,
      externalReference,
      backUrls: {
        success: `${APP_BASE_URL}/?pagamento=sucesso`,
        pending: `${APP_BASE_URL}/?pagamento=pendente`,
        failure: `${APP_BASE_URL}/?pagamento=falha`,
      },
      notificationUrl: `${APP_BASE_URL}/api/pagamentos/webhook`,
    });

    db.prepare('UPDATE payments SET gateway_invoice_id = ? WHERE id = ?').run(String(pref.id), payRow);

    res.json({ init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point });
  } catch (e) {
    console.error('[pagamentos/checkout] erro:', e.message);
    res.status(500).json({ error: 'Falha ao iniciar o pagamento.' });
  }
});

// === POST /api/pagamentos/webhook ===
router.post('/webhook', async (req, res) => {
  // MP exige 200 rápido — responde já e processa em seguida.
  res.sendStatus(200);
  try {
    if (!mp.configurado()) return;
    const tipo = req.body?.type || req.query?.type || req.query?.topic;
    const paymentId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
    if (tipo !== 'payment' || !paymentId) return;

    // Confirma o status DE VERDADE consultando o MP (não confia só na notificação).
    const pg = await mp.obterPagamento(paymentId);
    const status = pg.status; // approved, pending, in_process, rejected, cancelled, refunded
    const extRef = pg.external_reference || '';
    const m = /^u(\d+):p(\d+):(mensal|trimestral|semestral|anual):pay(\d+)$/.exec(extRef);
    if (!m) { console.warn('[webhook] external_reference inválido:', extRef); return; }
    const userId = parseInt(m[1], 10);
    const planId = parseInt(m[2], 10);
    const ciclo = m[3];
    const payRow = parseInt(m[4], 10);

    const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(payRow);
    if (!pay) { console.warn('[webhook] payment row não encontrado:', payRow); return; }

    if (status === 'approved') {
      if (pay.status === 'pago') return; // idempotência: já processado
      const subId = ativarAssinatura(userId, planId, ciclo);
      db.prepare(`
        UPDATE payments SET status='pago', subscription_id=?, gateway_payment_id=?, metodo=?, pago_em=?, metadata=?
        WHERE id=?
      `).run(subId, String(paymentId), pg.payment_type_id || 'mercado_pago', agora(),
            JSON.stringify({ plan_id: planId, ciclo, mp_status: status }), payRow);
      console.log(`[webhook] APROVADO: user=${userId} plan=${planId} ciclo=${ciclo} pay=${paymentId}`);
    } else if (status === 'pending' || status === 'in_process') {
      db.prepare(`UPDATE payments SET status='pendente', gateway_payment_id=? WHERE id=?`).run(String(paymentId), payRow);
    } else if (status === 'rejected' || status === 'cancelled') {
      db.prepare(`UPDATE payments SET status='falhou', gateway_payment_id=? WHERE id=?`).run(String(paymentId), payRow);
    } else if (status === 'refunded' || status === 'charged_back') {
      db.prepare(`UPDATE payments SET status='reembolsado', gateway_payment_id=? WHERE id=?`).run(String(paymentId), payRow);
    }
  } catch (e) {
    console.error('[pagamentos/webhook] erro:', e.message);
  }
});

module.exports = router;
