// Wrapper de envio de email via Resend.
// Em dev (sem RESEND_API_KEY): não envia, só loga — útil pra desenvolvimento.
// Em prod: requer RESEND_API_KEY e EMAIL_FROM configurados.

const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn('[email] RESEND_API_KEY ausente — emails não serão enviados (modo dev)');
}

async function enviarEmail({ to, subject, html }) {
  if (!resend) {
    console.log(`[email][dev] (não enviado) to=${to} subject="${subject}"`);
    return { skipped: true };
  }
  const result = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  if (result.error) {
    throw new Error(`Resend falhou: ${result.error.message || JSON.stringify(result.error)}`);
  }
  console.log(`[email] enviado id=${result.data?.id} to=${to} subject="${subject}"`);
  return { id: result.data?.id };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

async function enviarReset({ to, token, link }) {
  const tokenSafe = escapeHtml(token);
  const linkSafe = escapeHtml(link);
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f6fa;margin:0;padding:24px">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <tr><td>
      <h1 style="font-size:20px;margin:0 0 16px;color:#0a1428">Reset de senha — PromoPage</h1>
      <p style="font-size:15px;line-height:1.5;color:#333">Você solicitou um reset de senha. Use o link abaixo (válido por 1 hora):</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${linkSafe}" style="background:#1f4ed8;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600">Resetar minha senha</a>
      </p>
      <p style="font-size:13px;color:#666;margin-top:24px">Se o botão não funcionar, abra o site e cole esse token na tela de reset:</p>
      <p style="background:#f0f3f9;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;word-break:break-all;color:#1f4ed8">${tokenSafe}</p>
      <p style="font-size:12px;color:#999;margin-top:32px">Se você não solicitou este reset, ignore este email.</p>
    </td></tr>
  </table>
</body></html>`;

  return enviarEmail({
    to,
    subject: 'Reset de senha — PromoPage',
    html,
  });
}

module.exports = { enviarEmail, enviarReset };
