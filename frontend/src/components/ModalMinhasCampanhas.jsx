import { useEffect, useState } from 'react';

// Modal "Minhas Campanhas": grid de cards estilo qrofertas.
// Cada card mostra: thumbnail (capa do tema) + botão amarelo EDITAR CAMPANHA +
// ações compactas (duplicar, excluir) + metadata (datas + nome + qtd produtos).
//
// Backend já tem CRUD completo em /api/projetos:
//   GET  /api/projetos       → lista com metadata enriquecido (capa, qtdProdutos, datas)
//   GET  /api/projetos/:id   → projeto completo
//   POST /api/projetos       → cria/atualiza
//   DELETE /api/projetos/:id → remove

export default function ModalMinhasCampanhas({
  aberto,
  aoFechar,
  aoCarregarProjeto,
  aoCriarNovo,
}) {
  const [projetos, setProjetos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const r = await fetch('/api/projetos');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const lista = await r.json();
      setProjetos(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar campanhas');
      setProjetos([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto]);

  const abrirProjeto = async (id) => {
    try {
      const r = await fetch(`/api/projetos/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const projeto = await r.json();
      aoCarregarProjeto(projeto);
      aoFechar();
    } catch (e) {
      alert('Erro ao abrir campanha: ' + (e.message || e));
    }
  };

  const excluir = async (id, nome, evt) => {
    evt?.stopPropagation();
    if (!confirm(`Excluir a campanha "${nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      const r = await fetch(`/api/projetos/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      carregar();
    } catch (e) {
      alert('Erro ao excluir: ' + (e.message || e));
    }
  };

  const duplicar = async (id, evt) => {
    evt?.stopPropagation();
    try {
      const rGet = await fetch(`/api/projetos/${id}`);
      if (!rGet.ok) throw new Error(`HTTP ${rGet.status}`);
      const projeto = await rGet.json();
      const copia = {
        ...projeto,
        id: undefined,
        criadoEm: undefined,
        nome: (projeto.nome || 'Encarte') + ' (cópia)',
      };
      const rPost = await fetch('/api/projetos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copia),
      });
      if (!rPost.ok) throw new Error(`HTTP ${rPost.status}`);
      carregar();
    } catch (e) {
      alert('Erro ao duplicar: ' + (e.message || e));
    }
  };

  // Formata "DD/MM/AA HH:mm:ss" (estilo qrofertas)
  const formatarDataHora = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
    } catch { return iso; }
  };

  // Formata só "DD/MM/AAAA"
  const formatarData = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR');
    } catch { return iso; }
  };

  const stats = {
    criadas: projetos.length,
    ativas: 0,
    publicadas: 0,
    excluidas: 0,
  };

  const projetosFiltrados = filtro
    ? projetos.filter(p =>
        (p.nome || '').toLowerCase().includes(filtro.toLowerCase()) ||
        (p.temaNome || '').toLowerCase().includes(filtro.toLowerCase()))
    : projetos;

  if (!aberto) return null;

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-campanhas-v2" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        {/* HEADER */}
        <div className="mc2-header">
          <div className="mc2-titulo-bloco">
            <h2 className="mc2-titulo">Minhas Campanhas</h2>
            <div className="mc2-subtitulo">
              O gerenciamento completo de todas suas campanhas criadas no <b>PromoPage</b>
            </div>
          </div>
          <div className="mc2-header-acoes">
            <button
              className="mc2-btn-criar"
              onClick={() => { aoCriarNovo(); aoFechar(); }}
            >
              <span className="mc2-plus">⊕</span> CRIAR NOVA CAMPANHA
            </button>
            <div className="mc2-links">
              <button className="mc2-link" onClick={() => { aoCriarNovo(); aoFechar(); }}>
                <span className="mc2-plus">⊕</span> CRIAR CARTAZ
              </button>
              <button className="mc2-link" onClick={() => { aoCriarNovo(); aoFechar(); }}>
                <span className="mc2-plus">⊕</span> CRIAR ENCARTE
              </button>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mc2-stats">
          <div className="mc2-stat">
            <div className="mc2-stat-num">{stats.criadas}</div>
            <div className="mc2-stat-label">Campanhas<br /><b>Criadas</b></div>
          </div>
          <div className="mc2-stat">
            <div className="mc2-stat-num">{stats.ativas}</div>
            <div className="mc2-stat-label">Campanhas<br /><b>Ativas</b></div>
          </div>
          <div className="mc2-stat">
            <div className="mc2-stat-num">{stats.publicadas}</div>
            <div className="mc2-stat-label">Publicados no<br /><b>Portal de Ofertas</b></div>
          </div>
          <div className="mc2-stat">
            <div className="mc2-stat-num">{stats.excluidas}</div>
            <div className="mc2-stat-label">Campanhas<br /><b>Excluídas</b></div>
          </div>
        </div>

        {/* BUSCA opcional */}
        {projetos.length > 8 && (
          <div className="mc2-busca">
            <input
              type="text"
              placeholder="🔍 Buscar campanhas por nome ou tema..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
          </div>
        )}

        {/* GRID DE CARDS */}
        <div className="mc2-grid-wrap">
          {carregando && <div className="mc2-vazio">Carregando campanhas...</div>}
          {erro && <div className="mc2-vazio mc2-erro">⚠ {erro}</div>}
          {!carregando && !erro && projetosFiltrados.length === 0 && (
            <div className="mc2-vazio">
              {filtro
                ? `Nenhuma campanha encontrada com "${filtro}"`
                : 'Nenhuma campanha criada ainda. Clique em CRIAR NOVA CAMPANHA pra começar.'}
            </div>
          )}
          {!carregando && !erro && projetosFiltrados.length > 0 && (
            <div className="mc2-grid">
              {projetosFiltrados.map(p => (
                <div key={p.id} className="mc2-card" onClick={() => abrirProjeto(p.id)}>
                  {/* THUMBNAIL — capa pode ser string (URL direta) ou objeto do tema */}
                  <div className="mc2-thumb">
                    {(() => {
                      // Extrai a melhor URL disponível na capa do tema
                      let url = null;
                      let bgColor = null;
                      if (typeof p.capa === 'string') {
                        url = p.capa;
                      } else if (p.capa && typeof p.capa === 'object') {
                        url = p.capa.imagemFundo || p.capa.imagemTitulo || null;
                        bgColor = p.capa.fundo || null;
                      }
                      return url ? (
                        <img
                          src={url}
                          alt={p.temaNome || p.nome}
                          style={bgColor ? { background: bgColor } : null}
                        />
                      ) : (
                        <div
                          className="mc2-thumb-placeholder"
                          style={bgColor ? { background: bgColor, color: '#fff' } : null}
                        >
                          <span>📋</span>
                          <small>{p.temaNome || 'Sem tema'}</small>
                        </div>
                      );
                    })()}
                  </div>

                  {/* AÇÕES */}
                  <div className="mc2-acoes">
                    <button
                      className="mc2-btn-editar"
                      onClick={(e) => { e.stopPropagation(); abrirProjeto(p.id); }}
                    >
                      ✏ Editar Campanha
                    </button>
                    <button
                      className="mc2-btn-icon"
                      onClick={(e) => duplicar(p.id, e)}
                      title="Duplicar"
                    >
                      ⧉
                    </button>
                    <button
                      className="mc2-btn-icon mc2-btn-icon-danger"
                      onClick={(e) => excluir(p.id, p.nome, e)}
                      title="Excluir"
                    >
                      🗑
                    </button>
                  </div>

                  {/* METADATA */}
                  <div className="mc2-info">
                    <div className="mc2-data">{formatarDataHora(p.atualizadoEm)}</div>
                    <div className="mc2-nome">
                      {p.nome || 'Sem nome'} - {p.qtdProdutos} Produto{p.qtdProdutos !== 1 ? 's' : ''}
                    </div>
                    <div className="mc2-periodo">
                      <div>Iniciou em {formatarData(p.criadoEm || p.atualizadoEm)}</div>
                      <div>Vencida em {formatarData(p.vencidaEm || p.atualizadoEm)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
