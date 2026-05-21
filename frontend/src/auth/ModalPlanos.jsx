import { useEffect, useState } from 'react';
import LogoPromoPage from '../components/LogoPromoPage.jsx';
import RodapeSite from '../components/RodapeSite.jsx';

// Página pública "Recursos e Planos" — vitrine de planos pra qualquer visitante.
// Renderiza em tela cheia (não é mais um modal centralizado) e tem o rodapé
// institucional do site no final. Funciona logado ou deslogado:
//   - Deslogado: botão "Cadastre-se e Assine" (abre modal de signup)
//   - Logado: badge "SEU PLANO" no plano atual; botão "Assinar" nos outros
//   - Logado com plano: botão "Trocar plano" (Fase 2 com Stripe)

const NOMES_RECURSOS = {
  pdf_export: 'Exportar PDF',
  png_export: 'Exportar PNG',
  temas_gratis: 'Temas grátis',
  temas_premium: 'Temas premium exclusivos',
  remover_fundo: 'Remover fundo das fotos (IA)',
  busca_avancada: 'Busca avançada de imagens',
  whatsapp_post: 'Postar direto no WhatsApp',
  multi_loja: 'Múltiplas lojas',
  api_access: 'Acesso à API',
};

const NOMES_LIMITES = {
  encartesPorMes: 'Encartes por mês',
  templatesProprios: 'Templates próprios',
  paginasPorEncarte: 'Páginas por encarte',
};

export default function ModalPlanos({
  aberto, aoFechar,
  user, planoAtualSlug,
  aoAssinarSemConta,   // chamado quando deslogado clica em "assinar"
  aoTrocarPlano,       // chamado quando logado clica em assinar (Checkout MP)
  aoTestarPagamento,   // admin-only: dispara um checkout de R$1 (teste real)
}) {
  const ehAdmin = user?.role_nome === 'admin' || user?.role_nome === 'super_admin';
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState('mensal');  // 'mensal' ou 'anual'

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    fetch('/api/plans')
      .then(r => r.json())
      .then(data => {
        if (cancelado) return;
        setPlanos(data.plans || []);
      })
      .catch(() => setPlanos([]))
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [aberto]);

  const formatarReais = (centavos) =>
    (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const calcularDesconto = (mensal, anual) => {
    if (!mensal || !anual) return 0;
    return Math.round((1 - anual / (mensal * 12)) * 100);
  };

  if (!aberto) return null;

  return (
    <div className="mp-pagina">
      {/* Barra de topo da página: voltar pro editor + logo */}
      <div className="mp-pagina-topo">
        <button className="mp-voltar" onClick={aoFechar}>← Voltar</button>
        <LogoPromoPage size={34} aoClick={aoFechar} />
        <span className="mp-topo-spacer" aria-hidden="true" />
      </div>

      <div className="mp-pagina-conteudo">
        {/* HEADER */}
        <div className="mp-header">
          <h2 className="mp-titulo">
            <span style={{ marginRight: 8 }}>💎</span>
            Escolha o plano ideal pro seu negócio
          </h2>
          <p className="mp-subtitulo">
            Crie encartes profissionais em minutos. Cancele quando quiser, sem multa.
          </p>

          {/* Toggle Mensal/Anual */}
          <div className="mp-ciclo-toggle">
            <button
              className={`mp-ciclo-btn ${ciclo === 'mensal' ? 'ativo' : ''}`}
              onClick={() => setCiclo('mensal')}
            >
              Mensal
            </button>
            <button
              className={`mp-ciclo-btn ${ciclo === 'anual' ? 'ativo' : ''}`}
              onClick={() => setCiclo('anual')}
            >
              Anual
              <span className="mp-ciclo-badge">−17%</span>
            </button>
          </div>
        </div>

        {/* GRID DE PLANOS */}
        {carregando ? (
          <div className="mp-vazio">Carregando planos...</div>
        ) : (
          <div className="mp-grid">
            {planos.map(p => {
              const ativo = user && planoAtualSlug === p.slug;
              const preco = ciclo === 'anual'
                ? Math.round(p.preco_anual_centavos / 12)
                : p.preco_mensal_centavos;
              const economia = calcularDesconto(p.preco_mensal_centavos, p.preco_anual_centavos);
              const destaque = p.slug === 'pro';

              return (
                <div key={p.id} className={`mp-card ${destaque ? 'destaque' : ''} ${ativo ? 'ativo' : ''}`}>
                  {destaque && !ativo && <div className="mp-badge">⭐ MAIS POPULAR</div>}
                  {ativo && <div className="mp-badge ativo">✓ SEU PLANO ATUAL</div>}

                  <h3 className="mp-card-nome">{p.nome}</h3>
                  <p className="mp-card-desc">{p.descricao}</p>

                  <div className="mp-preco-bloco">
                    <div className="mp-preco">
                      {formatarReais(preco)}
                      <small>/mês</small>
                    </div>
                    {ciclo === 'anual' && (
                      <div className="mp-preco-anual">
                        {formatarReais(p.preco_anual_centavos)} cobrado anualmente
                      </div>
                    )}
                    {ciclo === 'mensal' && economia > 0 && (
                      <div className="mp-preco-anual">
                        Economize <b>{economia}%</b> assinando anual
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  {ativo ? (
                    <button className="mp-btn mp-btn-ativo" disabled>
                      ✓ Plano ativo
                    </button>
                  ) : !user ? (
                    <button
                      className={`mp-btn ${destaque ? 'mp-btn-destaque' : 'mp-btn-primary'}`}
                      onClick={() => aoAssinarSemConta?.(p.slug)}
                    >
                      Começar agora →
                    </button>
                  ) : (
                    <button
                      className={`mp-btn ${destaque ? 'mp-btn-destaque' : 'mp-btn-primary'}`}
                      onClick={() => aoTrocarPlano?.(p.slug, ciclo)}
                    >
                      {planoAtualSlug ? 'Trocar pra esse plano' : 'Assinar'}
                    </button>
                  )}

                  {/* LIMITES */}
                  <div className="mp-secao">
                    <div className="mp-secao-titulo">📊 Limites</div>
                    <ul className="mp-lista">
                      {Object.entries(p.limites || {}).map(([k, v]) => (
                        <li key={k}>
                          <b>{v === -1 ? 'Ilimitado' : v}</b> {NOMES_LIMITES[k] || k}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* RECURSOS */}
                  <div className="mp-secao">
                    <div className="mp-secao-titulo">✨ Inclui</div>
                    <ul className="mp-lista mp-lista-recursos">
                      {(p.recursos || []).map(r => (
                        <li key={r}>
                          <span className="mp-check">✓</span> {NOMES_RECURSOS[r] || r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER — informações de pagamento */}
        <div className="mp-footer">
          <div className="mp-pag-icons">
            <span title="Cartão de crédito">💳</span>
            <span title="PIX">⚡</span>
            <span title="Boleto">🏦</span>
          </div>
          <p className="mp-disclaimer">
            <b>🔒 Pagamento 100% seguro.</b> Cartão, PIX ou boleto. Cancele quando quiser, sem multa.
            <br />
            <small>Suporte via WhatsApp · Notas fiscais emitidas automaticamente · Sem fidelidade</small>
          </p>
          {ehAdmin && aoTestarPagamento && (
            <button
              type="button"
              onClick={() => aoTestarPagamento()}
              style={{ marginTop: 14, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, cursor: 'pointer' }}
              title="Só admin: faz um pagamento REAL de R$1 pra validar o fluxo (depois reembolse no MP)"
            >
              🧪 Testar pagamento real (R$ 1,00) — admin
            </button>
          )}
        </div>
      </div>

      {/* Rodapé institucional do site (estilo landing) */}
      <RodapeSite />
    </div>
  );
}
