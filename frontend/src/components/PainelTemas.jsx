import { useEffect, useState } from 'react';
import ModalCriarTema from './ModalCriarTema.jsx';
import ModalMeusInteresses from '../auth/ModalMeusInteresses.jsx';
import ModalSolicitarTema from './ModalSolicitarTema.jsx';

export default function PainelTemas({ temaAtivo, aoEscolher, user, fetchAuth, abrirFavoritosTicker = 0 }) {
  // Só admin/super_admin podem criar/editar/excluir temas — temas são globais
  // (afetam todos os clientes da plataforma), portanto não são self-service.
  const ehAdmin = user?.role_nome === 'admin' || user?.role_nome === 'super_admin';
  // fetch autenticado (com Bearer token). Usa fetchAuth se disponível, senão fetch normal.
  const httpAuth = fetchAuth || ((url, opts) => fetch(url, opts));
  // View "Novos Temas" — mostra só temas com flag .novo (últimos adicionados)
  const [verNovos, setVerNovos] = useState(false);
  // View "Meus Favoritos" — mostra só temas favoritados pelo user.
  // abrirFavoritosTicker: prop externa que incrementa toda vez que o user
  // clica em "Meus Temas Favoritos" no menu do user. useEffect abaixo reage
  // a cada incremento abrindo a view. Usar number em vez de boolean garante
  // que cliques REPETIDOS sempre disparem (boolean true→true não dispara).
  const [verFavoritos, setVerFavoritos] = useState(false);
  // Set de IDs dos temas favoritados — mantido em memória pra render rápida.
  // Carregado do backend no mount (se user logado).
  const [favoritos, setFavoritos] = useState(new Set());
  // Modal "Meus Interesses"
  const [interessesAberto, setInteressesAberto] = useState(false);
  // Modal "Solicitar tema" (formulário que envia e-mail pro admin)
  const [solicitarAberto, setSolicitarAberto] = useState(false);
  const [temas, setTemas] = useState([]);
  const [busca, setBusca] = useState('');
  const [criarAberto, setCriarAberto] = useState(false);
  const [temaEditando, setTemaEditando] = useState(null);
  // Categoria aberta em MODAL "Ver Tudo" — null = nenhum modal
  const [categoriaModal, setCategoriaModal] = useState(null);

  const carregar = () => {
    fetch('/api/templates').then(r => r.json()).then(setTemas);
  };

  // Carrega favoritos do backend (idempotente — só roda se logado).
  // Resposta: { favoritos: ["slug1", "slug2", ...] }
  const carregarFavoritos = async () => {
    if (!user) { setFavoritos(new Set()); return; }
    try {
      const r = await httpAuth('/api/temas-favoritos');
      if (!r.ok) return;
      const d = await r.json();
      setFavoritos(new Set(d.favoritos || []));
    } catch (e) {
      console.warn('[favoritos] falha ao carregar:', e?.message);
    }
  };

  // Toggle coração: optimistic update (UI atualiza na hora) + chamada API.
  // Se a API falhar, reverte o estado local. Stops propagation pra não
  // disparar o onClick do card (que aplica o tema).
  const toggleFavorito = async (t, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!user) {
      alert('Faça login pra favoritar temas!');
      return;
    }
    const jaEra = favoritos.has(t.id);
    // Optimistic update
    const novoSet = new Set(favoritos);
    if (jaEra) novoSet.delete(t.id); else novoSet.add(t.id);
    setFavoritos(novoSet);
    try {
      const r = jaEra
        ? await httpAuth(`/api/temas-favoritos/${encodeURIComponent(t.id)}`, { method: 'DELETE' })
        : await httpAuth('/api/temas-favoritos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temaId: t.id }),
          });
      if (!r.ok && r.status !== 404) {
        // Reverte se API falhou (404 no DELETE é OK — já não estava lá)
        setFavoritos(favoritos);
      }
    } catch (err) {
      console.warn('[favoritos] toggle falhou:', err?.message);
      setFavoritos(favoritos);
    }
  };

  // "Recente" = tem flag novo:true E foi criado nos últimos 5 dias.
  // Templates antigos sem criadoEm caem fora (não são contados como recentes),
  // mesmo que tenham novo:true do seed inicial. Templates criados via API
  // novos aparecem por 5 dias e depois saem do contador automaticamente.
  const JANELA_RECENTE_MS = 5 * 24 * 60 * 60 * 1000;
  const ehRecente = (tema) => {
    if (!tema?.novo || !tema?.criadoEm) return false;
    const idade = Date.now() - new Date(tema.criadoEm).getTime();
    return idade >= 0 && idade < JANELA_RECENTE_MS;
  };

  useEffect(() => {
    carregar();
  }, []);

  // Re-carrega favoritos quando user muda (login/logout).
  useEffect(() => {
    carregarFavoritos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Toda vez que o ticker incrementa (menu do user "Meus Temas Favoritos"
  // clicado), abre a view "Meus Favoritos". Ignora o valor inicial (0) pra
  // não abrir favoritos sempre que o painel é montado.
  useEffect(() => {
    if (abrirFavoritosTicker > 0) setVerFavoritos(true);
  }, [abrirFavoritosTicker]);

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

  // Botão coração reutilizável (overlay sobre a thumb). SVG inline pra ter
  // duas variações (filled = favoritado, outline = não-favoritado) sem image
  // assets. Visível só pra users logados.
  const renderHeart = (t) => {
    if (!user) return null;
    const isFav = favoritos.has(t.id);
    return (
      <button
        type="button"
        className={`tema-card-heart ${isFav ? 'favoritado' : ''}`}
        onClick={(e) => toggleFavorito(t, e)}
        title={isFav ? 'Remover dos favoritos' : 'Salvar como favorito'}
        aria-label={isFav ? 'Remover dos favoritos' : 'Salvar como favorito'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24"
             fill={isFav ? 'currentColor' : 'none'}
             stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    );
  };

  // Componente reutilizável de card individual.
  // Imagens carregam com loading="lazy" — só busca quando entra na viewport (antes
  // todas as previews carregavam de uma vez como background-image, lento em listas grandes).
  const renderCard = (t) => {
    const imgFundo = t.capa?.imagemFundo;
    const imgTitulo = t.capa?.imagemTitulo;
    const usaImagem = !!imgFundo;
    const styleThumb = usaImagem ? {} : { background: corThumb(t) };
    return (
      <div
        key={t.id}
        className={`tema-card ${temaAtivo === t.id ? 'active' : ''}`}
        onClick={() => aoEscolher(t.id)}
      >
        {t.premium && <span className="badge">PREMIUM</span>}
        {ehRecente(t) && <span className="badge novo">NOVO</span>}
        {renderHeart(t)}
        {ehAdmin && (
          <div className="tema-card-acoes" onClick={e => e.stopPropagation()}>
            <button className="tc-btn tc-btn-edit" onClick={(e) => abrirEdicao(t.id, e)} title="Editar tema">✏️</button>
            <button className="tc-btn tc-btn-dup" onClick={(e) => duplicarTema(t, e)} title="Duplicar tema">📋</button>
            <button className="tc-btn tc-btn-del" onClick={(e) => removerTema(t, e)} title="Remover tema">🗑</button>
          </div>
        )}
        <div className={`thumb ${usaImagem ? 'com-imagem' : ''}`} style={styleThumb}>
          {usaImagem && (
            <img className="thumb-fundo" src={`/api/thumb?url=${encodeURIComponent(imgFundo)}&w=300&q=70`} alt="" loading="lazy" decoding="async" />
          )}
          {imgTitulo
            ? <img className="thumb-titulo" src={`/api/thumb?url=${encodeURIComponent(imgTitulo)}&w=300&q=70`} alt={t.nome} loading="lazy" decoding="async" />
            : <span className="thumb-nome">{t.nome.toUpperCase()}</span>
          }
        </div>
        <div className="nome">{t.nome}</div>
        <div className="previa">Prévia</div>
      </div>
    );
  };

  // === View "Meus Favoritos" — temas que o user curtiu (heart icon) ===
  // Mesma estrutura visual da "Novos Temas" pra coerência. Filtra os temas
  // já carregados pela lista de IDs favoritados.
  if (verFavoritos) {
    const favs = filtrados.filter(t => favoritos.has(t.id));
    return (
      <div>
        <div className="novos-temas-header">
          <button
            type="button"
            className="novos-temas-voltar"
            onClick={() => setVerFavoritos(false)}
            title="Voltar"
            aria-label="Voltar pra lista de temas"
          >
            ‹
          </button>
          <h2 style={{ margin: 0, flex: 1 }}>💖 Meus Temas Favoritos</h2>
          <span className="novos-temas-count">{favs.length}</span>
        </div>
        {!user ? (
          <div className="painel-temas-info" style={{ textAlign: 'center', padding: '40px 20px' }}>
            Faça login pra ver seus temas favoritos.
          </div>
        ) : favs.length === 0 ? (
          <div className="painel-temas-info" style={{ textAlign: 'center', padding: '40px 20px', lineHeight: 1.6 }}>
            Você ainda não favoritou nenhum tema.<br />
            <small style={{ color: '#9ca3af' }}>
              Volte pra lista de temas e clique no <b>♡</b> do card pra salvar como favorito.
            </small>
          </div>
        ) : (
          <div className="tema-grid">
            {favs.map(renderCard)}
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

  // === View "Novos Temas" — listagem dedicada dos temas com flag .novo ===
  if (verNovos) {
    const novos = filtrados.filter(ehRecente);
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
        <span
          className="tema-link-secundario"
          style={{float:'right'}}
          onClick={() => setSolicitarAberto(true)}
          title="Pedir um tema novo — envia direto pra nossa equipe"
        >Solicitações</span>
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
        Lançamos <b>{temas.filter(ehRecente).length} temas recentes</b>! ✨
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

      {user && (
        <button
          className="btn-favoritos-temas"
          onClick={() => setVerFavoritos(true)}
          title="Ver meus temas favoritos"
        >
          💖 MEUS FAVORITOS {favoritos.size > 0 && <span className="bft-count">{favoritos.size}</span>}
        </button>
      )}

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
                // Versão maior do card pro modal — mesma estratégia lazy do renderCard
                const imgFundo = t.capa?.imagemFundo;
                const imgTitulo = t.capa?.imagemTitulo;
                const usaImagem = !!imgFundo;
                const styleThumb = usaImagem ? {} : { background: corThumb(t) };
                return (
                  <div
                    key={t.id}
                    className={`tema-card mvt-card ${temaAtivo === t.id ? 'active' : ''}`}
                    onClick={() => { aoEscolher(t.id); fecharModalCategoria(); }}
                  >
                    {t.premium && <span className="badge">PREMIUM</span>}
                    {ehRecente(t) && <span className="badge novo">NOVO</span>}
                    {renderHeart(t)}
                    {ehAdmin && (
                      <div className="tema-card-acoes" onClick={e => e.stopPropagation()}>
                        <button className="tc-btn tc-btn-edit" onClick={(e) => abrirEdicao(t.id, e)} title="Editar tema">✏️</button>
                        <button className="tc-btn tc-btn-dup" onClick={(e) => duplicarTema(t, e)} title="Duplicar tema">📋</button>
                        <button className="tc-btn tc-btn-del" onClick={(e) => removerTema(t, e)} title="Remover tema">🗑</button>
                      </div>
                    )}
                    <div className={`thumb ${usaImagem ? 'com-imagem' : ''}`} style={styleThumb}>
                      {usaImagem && (
                        <img className="thumb-fundo" src={`/api/thumb?url=${encodeURIComponent(imgFundo)}&w=300&q=70`} alt="" loading="lazy" decoding="async" />
                      )}
                      {imgTitulo
                        ? <img className="thumb-titulo" src={`/api/thumb?url=${encodeURIComponent(imgTitulo)}&w=300&q=70`} alt={t.nome} loading="lazy" decoding="async" />
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

      <ModalSolicitarTema
        aberto={solicitarAberto}
        aoFechar={() => setSolicitarAberto(false)}
        user={user}
        fetchAuth={fetchAuth}
      />
    </div>
  );
}
