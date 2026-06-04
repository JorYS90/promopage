import BotaoAuthTopbar from '../auth/BotaoAuthTopbar.jsx';
import LogoPromoPage from './LogoPromoPage.jsx';
import LogoPromoVideo from './LogoPromoVideo.jsx';

export default function Topbar({
  aoAbrirCampanhas, qtdCampanhas = 0,
  user, aoLogin, aoSignup, aoLogout, aoAbrirConta, aoAbrirPlanos, aoAbrirAdmin,
  aoAbrirFavoritos,
  aoAbrirPreviewLayouts,
  aoVoltarHome,
  aoIniciarTour, // 🎓 dispara tour interativo guiado
}) {
  return (
    <div className="topbar">
      {/* Logos lado a lado: PromoPage (app atual, click = home) + PromoVideo
          (sister-app, click abre videos.promopage.com.br em nova aba).
          Separadas por divisor sutil pra ficar visualmente claro que são apps diferentes. */}
      <div className="topbar-logos">
        <LogoPromoPage size={40} aoClick={aoVoltarHome} />
        <span className="topbar-logo-divisor" aria-hidden="true" />
        <LogoPromoVideo size={40} />
      </div>
      <div className="topbar-menu">
        {/* Cada botão tem ícone (::before via CSS em mobile/tablet) e label.
            Em telas pequenas o texto some e fica só o ícone — todos os botões
            permanecem acessíveis. data-icon define o emoji pro ::before. */}
        <button
          type="button"
          className="topbar-neon-btn topbar-btn-campanhas"
          onClick={aoAbrirCampanhas}
          title="Gerenciar minhas campanhas"
          data-tour="campanhas"
          data-icon="📋"
        >
          <span className="topbar-btn-label">Minhas Campanhas</span>
          {qtdCampanhas > 0 && <span className="badge">{qtdCampanhas}</span>}
        </button>
        {aoIniciarTour && (
          <button
            type="button"
            className="topbar-neon-btn topbar-tour-btn topbar-btn-tour"
            onClick={aoIniciarTour}
            title="Tour guiado: aprenda a usar o PromoPage em 2 minutos"
            data-icon="🎓"
          >
            <span className="topbar-btn-label">🎓 Tour</span>
          </button>
        )}
        <button
          type="button"
          className="topbar-neon-btn topbar-btn-planos"
          onClick={aoAbrirPlanos}
          title="Ver planos e recursos disponíveis"
          data-icon="💎"
        >
          <span className="topbar-btn-label">Recursos e Planos</span>
        </button>
        <button
          type="button"
          className="topbar-neon-btn topbar-btn-atendimento"
          onClick={() => { window.location.href = 'mailto:atendimento@promopage.com.br?subject=Contato%20PromoPage'; }}
          title="Fale com a gente: atendimento@promopage.com.br"
          data-icon="💬"
        >
          <span className="topbar-btn-label">Central de Atendimento</span>
        </button>
      </div>
      <div className="spacer" />
      <BotaoAuthTopbar
        user={user}
        aoLogin={aoLogin}
        aoSignup={aoSignup}
        aoLogout={aoLogout}
        aoAbrirConta={aoAbrirConta}
        aoAbrirAdmin={aoAbrirAdmin}
        aoAbrirFavoritos={aoAbrirFavoritos}
      />
    </div>
  );
}
