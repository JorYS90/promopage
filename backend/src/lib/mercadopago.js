// Wrapper Mercado Pago — Checkout Pro.
// Cria preferências de pagamento (redirect pro checkout do MP) e consulta
// pagamentos no webhook. Lê MP_ACCESS_TOKEN do env:
//   - Teste:    TEST-...     (sandbox, não cobra de verdade)
//   - Produção: APP_USR-...  (cobra real)
// Em dev sem token: desativado (configurado() === false).

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
let client = null;
if (MP_ACCESS_TOKEN) {
  client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
} else {
  console.warn('[mercadopago] MP_ACCESS_TOKEN ausente — pagamentos desativados (modo dev)');
}

function configurado() {
  return !!client;
}

/**
 * Cria uma preferência de Checkout Pro.
 * Por padrão o MP oferece todos os métodos habilitados na conta (PIX, cartão,
 * boleto). Retorna { id, init_point, sandbox_init_point }.
 */
async function criarPreferencia({ titulo, valorCentavos, payerEmail, externalReference, backUrls, notificationUrl }) {
  if (!client) throw new Error('Mercado Pago não configurado (MP_ACCESS_TOKEN ausente)');
  const pref = new Preference(client);
  const body = {
    items: [{
      id: externalReference || 'plano',
      title: titulo,
      quantity: 1,
      unit_price: Math.round(valorCentavos) / 100, // MP usa reais (float)
      currency_id: 'BRL',
    }],
    external_reference: externalReference,
    back_urls: backUrls,
    auto_return: 'approved',
    notification_url: notificationUrl,
    statement_descriptor: 'PROMOPAGE',
  };
  if (payerEmail) body.payer = { email: payerEmail };
  const result = await pref.create({ body });
  return {
    id: result.id,
    init_point: result.init_point,
    sandbox_init_point: result.sandbox_init_point,
  };
}

/**
 * Consulta um pagamento por ID no MP. Usado no webhook pra confirmar o status
 * de verdade (não confiamos só no corpo da notificação).
 */
async function obterPagamento(paymentId) {
  if (!client) throw new Error('Mercado Pago não configurado');
  const payment = new Payment(client);
  return await payment.get({ id: paymentId });
}

module.exports = { configurado, criarPreferencia, obterPagamento };
