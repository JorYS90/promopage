// Logo do PromoVideo — sister-app do PromoPage. Click abre o app de vídeos
// em nova aba. URL muda por ambiente:
//   - Produção: https://videos.promopage.com.br (subdomínio dedicado)
//   - Dev local: http://localhost:5175 (frontend Vite do PromoVideo)
//
// Arquivo: public/promovideo-logo.png (copiado do projeto irmão Promopage Videos).
//
// Props:
//   size: altura do ícone em px (default 40)

const URL_PROMOVIDEO = import.meta.env.PROD
  ? 'https://videos.promopage.com.br'
  : 'http://localhost:5175';

export default function LogoPromoVideo({ size = 40 }) {
  return (
    <a
      href={URL_PROMOVIDEO}
      target="_blank"
      rel="noopener noreferrer"
      className="logo-promovideo logo-promovideo-btn"
      title="Abrir PromoVideo — gerador de vídeos promocionais"
      aria-label="PromoVideo — abrir gerador de vídeos"
    >
      <img
        src="/promovideo-logo.png"
        alt="PromoVideo"
        className="logo-promovideo-img"
        style={{ height: size + 'px', width: 'auto' }}
        draggable="false"
      />
    </a>
  );
}
