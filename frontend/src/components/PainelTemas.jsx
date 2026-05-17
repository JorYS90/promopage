import { useEffect, useState } from 'react';
import ModalCriarTema from './ModalCriarTema.jsx';
import ModalMeusInteresses from '../auth/ModalMeusInteresses.jsx';

export default function PainelTemas({ temaAtivo, aoEscolher, user, fetchAuth }) {
  // Só admin/super_admin podem criar/editar/excluir temas — temas são globais
  // (afetam todos os clientes da plataforma), portanto não são self-service.
  const ehAdmin = user?.role_nome === 'admin' || user?.role_nome === 'super_admin';
  // fetch autenticado (com Bearer token). Usa fetchAuth se disponível, senão fetch normal.
  const httpAuth = fetchAuth || ((url, opts) => fetch(url, opts));
  // View "Novos Temas" — mostra só temas com flag .novo (últimos adicionados)
  const [verNovos, setVerNovos] = useState(false);
  // Modal "Meus Interesses"
  const [interessesAberto, setInteressesAberto] = useState(false);
  const [temas, setTemas] = useState([]);
  const [busca, setBusca] = useState('');
  const [criarAberto, setCriarAberto] = useState(false);
  const [temaEditando, setTemaEditando] = useState(null);
  // Categoria aberta em MODAL "Ver Tudo" — null = nenhum modal
  const [categoriaModal, setCategoriaModal] = useState(null);

  const carregar = () => {
    fetch('/api/templates').then(r => r.json()).then(setTemas);
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirEdicao = async (id, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    try {
      const r = await fetch(`/api/templates/${id}`);
      if (!r.ok) throw new Error('falha ao carregar tema');
      const tema = await r.json();
      setTemaEditando({ ...tema, id });
      setCriarAberto(true);
    } catch (err) {
      alert('Erro ao abrir edição: ' + err.message);
    }
  };

  const removerTema = async (t, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!confirm(`Remover o tema "${t.nome}"?\n\nEssa ação não pode ser desfeita.`)) return;
    try {
      const r = await httpAuth(`/api/templates/${t.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'falha');
      }
      carregar();
      if (temaAtivo === t.id) aoEscolher(null);
    } catch (err) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  const duplicarTema = async (t, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    try {
      const novoNome = prompt('Nome do novo tema:', `Cópia de ${t.nome}`);
      if (!novoNome || !novoNome.trim()) return;
      const r = await fetch(`/api/templates/${t.id}`);
      if (!r.ok) throw new Error('falha ao carregar tema original');
      const original = await r.json();
      const payload = {
        nome: novoNome.trim(),
        categoria: original.categoria || 'Meus Temas',
        capa: original.capa || null,
        rodape: original.rodape || null,
        paleta: original.paleta || {},
        fundoEncarte: original.fundoEncarte || null,
      };
      const resp = await httpAuth('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok || !json.id) throw new Error(json.error || 'falha ao salvar duplicata');
      carregar();
      aoEscolher(json.id);
    } catch (err) {
      alert('Erro ao duplicar: ' + err.message);
    }
  };

  const abrirModalCategoria = (cat) => setCategoriaModal(cat);
  const fecharModalCategoria = () => setCategoriaModal(null);

  const filtrados = busca
    ? temas.filter(t => t.nome.toLowerCase().includes(busca.toLowerCase()) || (t.categoria || '').toLowerCase().includes(busca.toLowerCase()))
    : temas;

  const porCategoria = {};
  for (const t of filtrados) {
    const cat = t.categoria || 'Outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  }
  const ORDEM_CATEGORIAS = [
    'Temas Grátis',
    'Datas Comemorativas',
    'Meus Temas',
    'Açougue',
    'Hortifruti',
    'Bebidas',
    'Padaria',
    'Mercearia',
    'Limpeza',
    'Sazonais',
  ];
  const categorias = Object.keys(porCategoria).sort((a, b) => {
    const ai = ORDEM_CATEGORIAS.indexOf(a);
    const bi = ORDEM_CATEGORIAS.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const corThumb = (t) => {
    const p = t.paleta || {};
    const fundo = p.primaria || '#ef0000';
    const fundo2 = p.secundaria || '#fbbf24';
    return `linear-gradient(135deg, ${fundo} 0%, ${fundo2} 100%)`;
  };

  // Componente reutilizável de card individual
  const renderCard = (t) => {
    const imgFundo = t.capa?.imagemFundo;
    const imgTitulo = t.capa?.imagemTitulo;
    const usaImagem = !!imgFundo;
    const styleThumb = usaImagem
      ? { backgroundImage: `url(${imgFundo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: corThumb(t) };
    return (
      <div
        key={t.id}
        className={`tema-card ${temaAtivo === t.id ? 'active' : ''}`}
        onClick={() => aoEscolher(t.id)}
      >
        {t.premium && <span className="badge">PREMIUM</span>}
        {t.novo && <span className="badge novo">NOVO</span>}
        {ehAdmin && (
          <div className="tema-card-acoes" onClick={e => e.stopPropagation()}>
            <button className="tc-btn tc-btn-edit" onClick={(e) => abrirEdicao(t.id, e)} title="Editar tema">✏️</button>
            <button className="tc-btn tc-btn-dup" onClick={(e) => duplicarTema(t, e)} title="Duplicar tema">📋</button>
            <button className="tc-btn tc-btn-del" onClick={(e) => removerTema(t, e)} title="Remover tema">🗑</button>
          </div>
        )}
        <div className={`thumb ${usaImagem ? 'com-imagem' : ''}`} style={styleThumb}>
          {imgTitulo
            ? <img className="thumb-titulo" src={imgTitulo} alt={t.nome} />
            : <span className="thumb-nome">{t.nome.toUpperCase()}</span>
          }
        </div>
        <div className="nome">{t.nome}</div>
        <div className="previa">Prévia</div>
      </div>
    );
  };

  // === View "Novos Temas" — listagem dedicada dos temas com flag .novo ===
  if (verNovos) {
    const novos = filtrados.filter(t => t.novo);
    return (
      <div>
        <div className="novos-temas-header">
          <button
            type="button"
            className="novos-temas-voltar"
            onClick={() => setVerNovos(false)}
            title="Voltar"
            aria-label="Voltar pra lista de temas"
          >
            ‹
          </button>
          <h2 style={{ margin: 0, flex: 1 }}>Novos Temas</h2>
          <span className="novos-temas-count">{novos.length}</span>
        </div>
        {novos.length === 0 ? (
          <div className="painel-temas-info" style={{ textAlign: 'center', padding: '40px 20px' }}>
            Nenhum tema novo no momento. Volte em breve! ✨
          </div>
        ) : (
          <div className="tema-grid">
            {novos.map(renderCard)}
          </div>
        )}

        {criarAberto && (
          <ModalCriarTema
            temaInicial={temaEditando}
            fetchAuth={fetchAuth}
            aoFechar={() => { setCriarAberto(false); setTemaEditando(null); }}
            aoSalvar={(novoId) => {
              carregar();
              aoEscolher(novoId);
              setTemaEditando(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>
        Temas
        <span className="tema-link-secundario" style={{float:'right'}}>Solicitações</span>
        <span
          className="tema-link-secundario"
          style={{float:'right',marginRight:12}}
          onClick={() => setInteressesAberto(true)}
          title="Selecionar segmentos do seu interesse pra receber recomendações de temas"
        >
          Meus Interesses
        </span>
      </h2>
      <div className="tema-busca">
        <input
          type="text"
          placeholder="Pesquisa de TEMAS Ex: Quinta do Frango"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <button>BUSCAR</button>
      </div>
      <div className="painel-temas-info">
        Lançamos <b>{temas.filter(t => t.novo).length} temas novos</b> hoje! ✨
      </div>

      {ehAdmin && (
        <button className="btn-criar-tema" onClick={() => { setTemaEditando(null); setCriarAberto(true); }}>
          ➕ CRIAR MEU TEMA
        </button>
      )}

      <button
        className="btn-novos-temas"
        onClick={() => setVerNovos(true)}
        title="Ver últimos temas adicionados"
      >
        VER NOVOS TEMAS ▸
      </button>

      {categorias.map(cat => {
        const lista = porCategoria[cat];
        return (
          <div key={cat} className="tema-categoria">
            <div className="header">
              <span className="nome">{cat}</span>
              <button
                type="button"
                className="ver-tudo"
                onClick={() => abrirModalCategoria(cat)}
              >
                Ver Tudo
              </button>
            </div>
            <div className="tema-scroll">
              {lista.map(renderCard)}
              {lista.length > 2 && (
                <button
                  type="button"
                  className="tema-vertudo-end"
                  onClick={() => abrirModalCategoria(cat)}
                  title={`Ver todos os ${lista.length} temas de ${cat}`}
                >
                  <span className="vt-arrow">›</span>
                  <span className="vt-label">Ver Tudo</span>
                </button>
              )}
            </div>
          </div>
        );
      })}

      {categorias.length === 0 && <div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:20}}>Nenhum tema encontrado.</div>}

      {/* Modal "Ver Tudo": mostra TODOS os temas de uma categoria em grid grande */}
      {categoriaModal && (
        <div className="modal-overlay" onClick={fecharModalCategoria}>
          <div className="modal modal-vertudo-temas" onClick={e => e.stopPropagation()}>
            <button className="btn-fechar-x" onClick={fecharModalCategoria} aria-label="Fechar">✕</button>
            <div className="mvt-header">
              <div>
                <h2 className="mvt-titulo">🎨 {categoriaModal}</h2>
                <div className="mvt-sub">
                  {(porCategoria[categoriaModal] || []).length} tema{(porCategoria[categoriaModal] || []).length !== 1 ? 's' : ''} disponíve{(porCategoria[categoriaModal] || []).length !== 1 ? 'is' : 'l'}
                </div>
              </div>
            </div>
            <div className="mvt-grid">
              {(porCategoria[categoriaModal] || []).map(t => {
                // Versão maior do card pro modal
                const imgFundo = t.capa?.imagemFundo;
                const imgTitulo = t.capa?.imagemTitulo;
                const usaImagem = !!imgFundo;
                const styleThumb = usaImagem
                  ? { backgroundImage: `url(${imgFundo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: corThumb(t) };
                return (
                  <div
                    key={t.id}
                    className={`tema-card mvt-card ${temaAtivo === t.id ? 'active' : ''}`}
                    onClick={() => { aoEscolher(t.id); fecharModalCategoria(); }}
                  >
                    {t.premium && <span className="badge">PREMIUM</span>}
                    {t.novo && <span className="badge novo">NOVO</span>}
                    {ehAdmin && (
                      <div className="tema-card-acoes" onClick={e => e.stopPropagation()}>
                        <button className="tc-btn tc-btn-edit" onClick={(e) => abrirEdicao(t.id, e)} title="Editar tema">✏️</button>
                        <button className="tc-btn tc-btn-dup" onClick={(e) => duplicarTema(t, e)} title="Duplicar tema">📋</button>
                        <button className="tc-btn tc-btn-del" onClick={(e) => removerTema(t, e)} title="Remover tema">🗑</button>
                      </div>
                    )}
                    <div className={`thumb ${usaImagem ? 'com-imagem' : ''}`} style={styleThumb}>
                      {imgTitulo
                        ? <img className="thumb-titulo" src={imgTitulo} alt={t.nome} />
                        : <span className="thumb-nome">{t.nome.toUpperCase()}</span>
                      }
                    </div>
                    <div className="nome">{t.nome}</div>
                    <div className="previa">Prévia</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {criarAberto && (
        <ModalCriarTema
          temaInicial={temaEditando}
          fetchAuth={fetchAuth}
          aoFechar={() => { setCriarAberto(false); setTemaEditando(null); }}
          aoSalvar={(novoId) => {
            carregar();
            aoEscolher(novoId);
            setTemaEditando(null);
          }}
        />
      )}

      <ModalMeusInteresses
        aberto={interessesAberto}
        aoFechar={() => setInteressesAberto(false)}
        fetchAuth={fetchAuth}
      />
    </div>
  );
}
