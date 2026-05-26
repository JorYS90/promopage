import { useEffect, useState } from 'react';
import LogoPromoPage from '../components/LogoPromoPage.jsx';
import { SEGMENTOS } from './segmentos.js';

// Modal "Meus Interesses" — usuário marca os segmentos da empresa dele.
// Os interesses são usados pra:
//   1. Recomendar temas (que combinam com categoria do segmento)
//   2. Filtros e ordenação na vitrine de temas
//   3. Analytics agregado (admin)
//
// Pode ser aberto de 2 lugares:
//   - Link "Meus Interesses" no header de Temas (usuário logado)
//   - Step opcional pós-cadastro (incentiva o usuário a marcar antes de usar)

export default function ModalMeusInteresses({
  aberto,
  aoFechar,
  fetchAuth,
  modoSignup = false,    // se true: estilo diferente (welcome)
  aoSalvar,              // callback opcional após salvar
}) {
  const [selecionados, setSelecionados] = useState(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Carrega interesses atuais do servidor ao abrir
  useEffect(() => {
    if (!aberto || !fetchAuth) return;
    setCarregando(true);
    fetchAuth('/api/users/me/interesses')
      .then(r => r.ok ? r.json() : { interesses: [] })
      .then(d => setSelecionados(new Set(d.interesses || [])))
      .catch(() => setSelecionados(new Set()))
      .finally(() => setCarregando(false));
  }, [aberto, fetchAuth]);

  const toggle = (id) => {
    setSelecionados(prev => {
      const novo = new Set(prev);
      // Lógica especial: clicar em "todos" seleciona ou limpa todos
      if (id === 'todos') {
        if (novo.has('todos')) {
          return new Set();
        }
        return new Set(SEGMENTOS.map(s => s.id));
      }
      if (novo.has(id)) {
        novo.delete(id);
        novo.delete('todos');
      } else {
        novo.add(id);
        // Se selecionou todos os não-todos, marca "todos" também
        const semTodos = SEGMENTOS.filter(s => s.id !== 'todos').map(s => s.id);
        if (semTodos.every(sId => novo.has(sId))) novo.add('todos');
      }
      return novo;
    });
  };

  const salvar = async () => {
    if (!fetchAuth) return;
    // Obrigatório no cadastro: mínimo 3 segmentos ('todos' é meta-seletor, não conta).
    const qtdReais = Array.from(selecionados).filter(id => id !== 'todos').length;
    if (modoSignup && qtdReais < 3) return;
    setSalvando(true);
    try {
      const lista = Array.from(selecionados);
      const r = await fetchAuth('/api/users/me/interesses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interesses: lista }),
      });
      if (!r.ok) throw new Error('Falha ao salvar');
      aoSalvar?.(lista);
      aoFechar();
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) return null;

  const qtdSelecionados = selecionados.size - (selecionados.has('todos') ? 1 : 0);

  return (
    <div className="modal-overlay" onClick={modoSignup ? undefined : aoFechar}>
      <div className="modal modal-interesses" onClick={e => e.stopPropagation()}>
        {!modoSignup && (
          <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>
        )}

        <div className="mi-header">
          <div>
            <h2 className="mi-titulo">
              {modoSignup
                ? <>Bem-vindo ao PromoPage! 🎉</>
                : <>Selecione <b>tudo</b> que for do seu interesse.</>}
            </h2>
            <p className="mi-sub">
              {modoSignup
                ? <>Antes de começar, conta pra gente: quais segmentos sua empresa atua? Vamos recomendar os melhores temas pra você.</>
                : <>Quanto mais segmentos você selecionar, mais precisas serão as recomendações de temas para sua conta.</>}
            </p>
          </div>
          {!modoSignup && (
            <div className="mi-logo">
              <LogoPromoPage size={48} />
            </div>
          )}
        </div>

        <div className="mi-instruction">
          Selecione todos os <span className="mi-tag">segmentos</span>,{' '}
          <span className="mi-tag">categorias</span> ou{' '}
          <span className="mi-tag">linha de produtos</span> da sua empresa:
        </div>

        {carregando ? (
          <div className="mi-vazio">Carregando...</div>
        ) : (
          <div className="mi-grid">
            {SEGMENTOS.map(s => {
              const ativo = selecionados.has(s.id);
              return (
                <label key={s.id} className={`mi-segmento ${ativo ? 'ativo' : ''} ${s.especial ? 'especial' : ''}`}>
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="mi-check">
                    {ativo && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  <span className="mi-nome">{s.nome}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className="mi-footer">
          <div className="mi-contador">
            <b>{qtdSelecionados}</b> segmento{qtdSelecionados !== 1 ? 's' : ''} selecionado{qtdSelecionados !== 1 ? 's' : ''}
            {modoSignup && qtdSelecionados < 3 && (
              <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: 6 }}>
                · selecione pelo menos 3 pra continuar
              </span>
            )}
          </div>
          <div className="mi-acoes">
            {/* No cadastro (modoSignup) é OBRIGATÓRIO escolher 3+ — sem botão "Pular". */}
            <button
              className="mi-btn-salvar"
              onClick={salvar}
              disabled={salvando || carregando || (modoSignup && qtdSelecionados < 3)}
            >
              {salvando ? 'Salvando...' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
