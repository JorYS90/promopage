// Rotas /api/me — informações e ações sobre o usuário LOGADO.
// Hoje: cota de vídeos do PromoVideo (sister-app consulta aqui pra checar limite).
//
// Por que aqui e não em auth/routes.js? auth é sobre login/senha/sessão.
// /api/me/* é sobre estado do user em recursos do produto (cota, assinatura, etc).

const { Router } = require('express');
const { requireAuth } = require('./auth/middleware');
const videoUsage = require('./videos-usage-db');

const router = Router();

// GET /api/me/video-quota — leitura, não bloqueia. Frontend mostra "X/30 vídeos".
router.get('/video-quota', requireAuth, (req, res) => {
  const status = videoUsage.statusDoUser(req.user.id);
  res.json(status);
});

// POST /api/me/consumir-video — checa+incrementa atômico. PromoVideo backend
// chama isso ANTES de enfileirar render. Se exceder, retorna 429 e PromoVideo
// devolve erro pro frontend.
router.post('/consumir-video', requireAuth, (req, res) => {
  const resultado = videoUsage.consumirUm(req.user.id);
  if (!resultado.ok) {
    const status = resultado.motivo === 'NO_PLAN' ? 403 : 429;
    const mensagem = resultado.motivo === 'NO_PLAN'
      ? 'Seu plano não inclui o PromoVideo. Faça upgrade pra "Ilimitado + 30 Vídeos" ou superior.'
      : `Você atingiu o limite de ${resultado.limite} vídeos neste mês. Faça upgrade ou aguarde o próximo mês.`;
    return res.status(status).json({
      error: mensagem,
      code: resultado.motivo,
      ...resultado,
    });
  }
  console.log(`[video-quota] user=${req.user.id} consumiu 1 vídeo (${resultado.usado}/${resultado.limite === -1 ? '∞' : resultado.limite})`);
  res.json(resultado);
});

module.exports = router;
