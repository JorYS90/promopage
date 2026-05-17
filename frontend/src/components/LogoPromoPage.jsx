// Logo do PromoPage — só o ÍCONE (sem texto). Clicável: funciona como HOME.
// Arquivo: public/logo-promopage.png (ícone-only)
//
// Props:
//   size: altura do ícone em px (default 40)
//   aoClick: handler chamado ao clicar (geralmente "voltar pra home")

export default function LogoPromoPage({ size = 40, aoClick }) {
  return (
    <button
      type="button"
      className="logo-promopage logo-promopage-btn"
      onClick={aoClick}
      title="Voltar pra página inicial"
      aria-label="PromoPage — voltar pra página inicial"
    >
      <img
        src="/logo-promopage.png"
        alt="PromoPage"
        className="logo-promopage-img"
        style={{ height: size + 'px', width: 'auto' }}
        draggable="false"
      />
    </button>
  );
}
