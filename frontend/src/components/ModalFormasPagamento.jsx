import { useMemo, useState } from 'react';
import { FORMAS_PAGAMENTO } from './formas-pagamento.js';

export default function ModalFormasPagamento({ aoFechar, aoSalvar, selecionadasIniciais = [] }) {
  const [selecionadas, setSelecionadas] = useState(new Set(selecionadasIniciais));
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    if (!busca.trim()) return FORMAS_PAGAMENTO;
    const q = busca.toLowerCase();
    return FORMAS_PAGAMENTO.filter(f => f.label.toLowerCase().includes(q));
  }, [busca]);

  const toggle = (id) => {
    const novo = new Set(selecionadas);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionadas(novo);
  };

  const salvar = () => {
    aoSalvar(Array.from(selecionadas));
    aoFechar();
  };

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-formas-pagamento" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Formas de pagamentos.</h2>
            <div className="sub">Selecione as formas de pagamentos aceitas pela sua empresa.</div>
          </div>
          <div>
            <button className="btn-fechar" onClick={aoFechar}>Cancelar</button>
            <button className="btn-salvar-tema" onClick={salvar}>
              💾 Salvar ({selecionadas.size})
            </button>
          </div>
        </div>

        <div style={{ padding: '0 20px 14px' }}>
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Pesquisar forma de pagamento..."
            style={{
              width: '100%', padding: '10px 14px',
              background: '#1f2937', color: '#fff',
              border: '1px solid #374151', borderRadius: 8,
              fontSize: 14, outline: 'none',
            }}
          />
        </div>

        <div className="formas-pagamento-grid">
          {filtradas.map(forma => {
            const ativo = selecionadas.has(forma.id);
            return (
              <button
                key={forma.id}
                type="button"
                className={`forma-card ${ativo ? 'ativo' : ''}`}
                onClick={() => toggle(forma.id)}
              >
                <div
                  className="forma-icone"
                  style={{ background: forma.cor }}
                >
                  {forma.iconeUrl ? (
                    <img
                      src={forma.iconeUrl}
                      alt={forma.label}
                      className="forma-icone-img"
                      onError={(e) => {
                        // Fallback: esconde img e mostra texto
                        e.currentTarget.style.display = 'none';
                        const sib = e.currentTarget.nextElementSibling;
                        if (sib) sib.style.display = 'inline-block';
                      }}
                    />
                  ) : null}
                  <span
                    className="forma-icone-texto"
                    style={forma.iconeUrl ? { display: 'none' } : undefined}
                  >
                    {forma.textoIcone}
                  </span>
                </div>
                <div className="forma-label">{forma.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
