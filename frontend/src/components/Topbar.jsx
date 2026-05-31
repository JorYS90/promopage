import BotaoAuthTopbar from '../auth/BotaoAuthTopbar.jsx';
import LogoPromoPage from './LogoPromoPage.jsx';
import LogoPromoVideo from './LogoPromoVideo.jsx';

export default function Topbar({
  aoAbrirCampanhas, qtdCampanhas = 0,
  user, aoLogin, aoSignup, aoLogout, aoAbrirConta, aoAbrirPlanos, aoAbrirAdmin,
  aoAbrirFavoritos,
  aoAbrirPreviewLayouts,
  aoVoltarHome,
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
        <button
          type="button"
          className="topbar-neon-btn"
          onClick={aoAbrirCampanhas}
          title="Gerenciar minhas campanhas"
        >
          <span>Minhas Campanhas</span>
          {qtdCampanhas > 0 && <span className="badge">{qtdCampanhas}</span>}
        </button>
        <button
          type="button"
          className="topbar-neon-btn"
          onClick={aoAbrirPlanos}
          title="Ver planos e recursos disponíveis"
        >
          <span>Recursos e Planos</span>
        </button>
        <button
          type="button"
          className="topbar-neon-btn"
          title="Central de Atendimento"
        >
          <span>Central de Atendimento</span>
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
