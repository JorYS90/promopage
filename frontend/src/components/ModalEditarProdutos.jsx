import { useState } from 'react';
import { removerFundoDeUrl, uploadBlobProcessado } from '../editor/remover-fundo.js';
import ModalEscolherImagem from './ModalEscolherImagem.jsx';

// Lista de unidades com abreviações padrão de varejo brasileiro (SI + comum no setor)
const UNIDADES = [
  { nome: 'Barra',      abrev: 'bar' },
  { nome: 'Bola',       abrev: 'bla' },
  { nome: 'Caixa',      abrev: 'cx' },
  { nome: 'Centímetro', abrev: 'cm' },
  { nome: 'Cubo',       abrev: 'cb' },
  { nome: 'Dúzia',      abrev: 'dz' },
  { nome: 'Fardo',      abrev: 'fd' },
  { nome: 'Fatia',      abrev: 'ft' },
  { nome: 'Saco',       abrev: 'sc' },
  { nome: 'Grama',      abrev: 'g' },
  { nome: '100 Gramas', abrev: '100g' },
  { nome: 'Galão',      abrev: 'gal' },
  { nome: 'Garrafa',    abrev: 'grf' },
  { nome: 'Jarra',      abrev: 'jr' },
  { nome: 'Kilo',       abrev: 'kg' },
  { nome: 'Litro',      abrev: 'L' },
  { nome: 'Maço',       abrev: 'mç' },
  { nome: 'Metro',      abrev: 'm' },
  { nome: 'Pacote',     abrev: 'pct' },
  { nome: 'Tambor',     abrev: 'tb' },
  { nome: 'Par',        abrev: 'par' },
  { nome: 'Peça',       abrev: 'pç' },
  { nome: 'Porção',     abrev: 'porç' },
  { nome: 'Kit',        abrev: 'kit' },
  { nome: 'Prato',      abrev: 'pr' },
  { nome: 'Quilo',      abrev: 'kg' },
  { nome: 'Unidade',    abrev: 'un' },
  { nome: 'Ml',         abrev: 'ml' },
  { nome: 'M²',         abrev: 'm²' },
  { nome: 'Tela',       abrev: 'tl' },
  { nome: 'Lata',       abrev: 'lt' },
  { nome: 'Vaso',       abrev: 'vs' },
  { nome: 'Bandeja',    abrev: 'bdj' },
  { nome: 'Sachê',      abrev: 'sch' },
  { nome: 'Milheiro',   abrev: 'mil' },
  { nome: 'Rolo',       abrev: 'rl' },
  { nome: 'Cento',      abrev: 'cto' },
  { nome: 'Cada',       abrev: 'cd' },
  { nome: 'Libra',      abrev: 'lb' },
  { nome: 'Display',    abrev: 'dpy' },
  { nome: 'Combo',      abrev: 'cb' },
  { nome: 'Cartela',    abrev: 'cart' },
  { nome: 'Tonelada',   abrev: 't' },
  { nome: 'Balde',      abrev: 'bld' },
  { nome: 'Pote',       abrev: 'pt' },
  { nome: 'Polegada',   abrev: 'pol' },
  { nome: 'Pé',         abrev: 'pé' },
  { nome: 'Jarda',      abrev: 'yd' },
];

export default function ModalEditarProdutos({ produtos, aoFechar, aoMudar, aoRemover, aoRemoverTodos, aoTrocarImagem, aoReordenar, fetchAuth }) {
  const [processando, setProcessando] = useState({});  // { idx: { progresso } }
  const [modalImg, setModalImg] = useState({ aberto: false, idx: -1, query: '' });
  const [arrastandoIdx, setArrastandoIdx] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  // Auto-remoção de fundo após trocar imagem.
  // Usa chroma key rápido (~100ms). Se fundo não é uniforme, NÃO chama IA
  // automaticamente (congelaria UI). User pode refinar com botão "Refinar IA"
  // depois se o resultado não ficar bom.
  const autoRemoverFundo = async (idx, novaUrl, nome) => {
    setProcessando(prev => ({ ...prev, [idx]: { progresso: 0, label: 'Removendo fundo...' } }));
    try {
      const blob = await removerFundoDeUrl(novaUrl, {
        onProgress: (key, current, total) => {
          const progresso = total > 0 ? Math.round((current / total) * 100) : 0;
          setProcessando(prev => ({ ...prev, [idx]: { progresso, label: 'Removendo fundo...' } }));
        },
      });
      const urlFinal = await uploadBlobProcessado(blob, `${(nome || 'produto').replace(/[^a-z0-9]/gi, '_')}_sem_fundo.png`, fetchAuth);
      const p = produtos[idx];
      aoMudar(idx, { ...p, imagem: urlFinal, fundoRemovido: true });
    } catch (e) {
      console.warn('Auto-remoção falhou:', e.message);
    } finally {
      setProcessando(prev => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    }
  };

  // Refinamento MANUAL com IA — user clica no botão quando o recorte rápido
  // (chroma key) não satisfaz. Força IA (pularIA: false). Demora 3-5s mas é
  // muito mais robusto pra produtos com detalhes finos da mesma cor do fundo
  // (ranhuras brancas em tampa, texto branco em fundo claro, etc.).
  const refinarComIA = async (idx, urlAtual, nome) => {
    setProcessando(prev => ({ ...prev, [idx]: { progresso: 0, label: '✨ Refinando com IA... (5-15s na 1ª vez, depois +rápido)' } }));
    try {
      const blob = await removerFundoDeUrl(urlAtual, {
        pularIA: false,    // FORÇA IA
        modeloIA: 'precise', // usa isnet FULL (~160MB) em vez do fp16 — mais preciso
                              // pra ranhuras finas, texto e bordas suaves
        onProgress: (key, current, total) => {
          const progresso = total > 0 ? Math.round((current / total) * 100) : 0;
          setProcessando(prev => ({ ...prev, [idx]: { progresso, label: '✨ Refinando com IA...' } }));
        },
      });
      if (!blob) throw new Error('IA não retornou imagem');
      const urlFinal = await uploadBlobProcessado(blob, `${(nome || 'produto').replace(/[^a-z0-9]/gi, '_')}_ia.png`, fetchAuth);
      const p = produtos[idx];
      aoMudar(idx, { ...p, imagem: urlFinal, fundoRemovido: true });
    } catch (e) {
      alert('Não foi possível refinar com IA: ' + (e.message || e));
    } finally {
      setProcessando(prev => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    }
  };

  // Quando o usuário escolhe uma imagem do modal de seleção
  const aoEscolherImagem = async (novaUrlExterna) => {
    const idx = modalImg.idx;
    if (idx < 0) return;
    const p = produtos[idx];

    // Cacheia via proxy (evita CORS depois)
    let urlLocal = novaUrlExterna;
    try {
      const r = await fetch(`/api/proxy-imagem?url=${encodeURIComponent(novaUrlExterna)}`);
      if (r.ok) {
        const json = await r.json();
        urlLocal = json.url;
      }
    } catch {}

    // pesoExplicito: true → registra com peso 3 no banco de populares
    // (sinal mais forte que adicionar produto via busca automática)
    aoMudar(idx, { ...p, imagem: urlLocal, fundoRemovido: false }, { pesoExplicito: true });
    setModalImg({ aberto: false, idx: -1, query: '' });
    // Dispara auto-remoção de fundo
    autoRemoverFundo(idx, urlLocal, p.nome);
  };

  return (
    <>
      <div className="modal-overlay" onClick={aoFechar}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>Editar Produtos</h2>
              <div className="sub">Edite os dados dos produtos de sua oferta. A foto é processada automaticamente sem fundo.</div>
            </div>
            <div>
              <button className="btn-remover-todos" onClick={() => {
                if (confirm('Remover todos os produtos?')) aoRemoverTodos();
              }}>🗑 Remover Todos os Produtos</button>
              <button className="btn-fechar" onClick={aoFechar}>Concluir</button>
            </div>
          </div>

          <div className="modal-counter">{produtos.length} Produtos Selecionados</div>

          {produtos.map((p, idx) => {
            const proc = processando[idx];
            const sendoArrastado = arrastandoIdx === idx;
            const ehAlvoHover = hoverIdx === idx && arrastandoIdx !== null && arrastandoIdx !== idx;
            return (
              <div
                key={p.id || idx}
                className={`editar-row ${sendoArrastado ? 'arrastando' : ''} ${ehAlvoHover ? 'drop-alvo' : ''}`}
                draggable={true}
                onDragStart={(e) => {
                  setArrastandoIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                  // Cria um "ghost" visual da linha sendo arrastada
                  if (e.dataTransfer.setDragImage && e.currentTarget) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.dataTransfer.setDragImage(e.currentTarget, rect.width / 2, 30);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (hoverIdx !== idx) setHoverIdx(idx);
                }}
                onDragLeave={() => {
                  if (hoverIdx === idx) setHoverIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const de = parseInt(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(de) && de !== idx && aoReordenar) {
                    aoReordenar(de, idx);
                  }
                  setArrastandoIdx(null);
                  setHoverIdx(null);
                }}
                onDragEnd={() => {
                  setArrastandoIdx(null);
                  setHoverIdx(null);
                }}
              >
                <div className="col-img">
                  <div className="img-wrapper-grande" onClick={() => setModalImg({ aberto: true, idx, query: p.nome })}>
                    {p.imagem ? (
                      <img
                        src={p.imagem}
                        alt={p.nome}
                        style={{ background: p.fundoRemovido ? 'repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 50% / 16px 16px' : '#f3f4f6' }}
                      />
                    ) : (
                      <div className="sem-img">📦</div>
                    )}
                    {proc && (
                      <div className="overlay-processando">
                        <div>{proc.label || 'Removendo fundo...'}</div>
                        <div className="progresso">{proc.progresso}%</div>
                      </div>
                    )}
                    {!proc && <div className="overlay-trocar-grande">TROCAR IMAGEM</div>}
                    {p.fundoRemovido && !proc && <span className="badge-sem-fundo">SEM FUNDO</span>}
                  </div>
                  <button className="link-acao" onClick={() => aoTrocarImagem(idx)}>🔍 Enviar Imagem</button>
                  {/* Refinar com IA — só aparece se já tem imagem e não está processando.
                      Útil quando o recorte rápido (chroma key) não satisfaz. Avisa que demora. */}
                  {p.imagem && !proc && (
                    <button
                      className="link-acao"
                      onClick={() => {
                        if (confirm('Refinar com IA leva 3-5 segundos e a tela vai travar nesse tempo. Continuar?')) {
                          refinarComIA(idx, p.imagem, p.nome);
                        }
                      }}
                      title="Usa IA pra recortar produtos com detalhes finos que o algoritmo rápido não pega bem (ex: tampa branca em fundo amarelo)"
                      style={{ marginTop: 4 }}
                    >
                      ✨ Refinar com IA
                    </button>
                  )}
                </div>

                <div>
                  <div className="editar-campo">
                    <label>Produto</label>
                    <input
                      type="text"
                      value={p.nome}
                      onChange={e => aoMudar(idx, { ...p, nome: e.target.value })}
                    />
                  </div>
                  <div className="editar-campo">
                    <label>Preço Oferta</label>
                    <div style={{display:'flex',gap:4,alignItems:'center'}}>
                      <span style={{background:'#f3f4f6',padding:'5px 10px',borderRadius:4,fontSize:11,fontWeight:'bold'}}>R$</span>
                      <input
                        type="text"
                        value={p.preco || ''}
                        placeholder="0,00"
                        onChange={e => aoMudar(idx, { ...p, preco: e.target.value })}
                        style={{flex:1}}
                      />
                    </div>
                  </div>
                  <div className="editar-campo">
                    <label>Texto de Observação</label>
                    <input
                      type="text"
                      value={p.observacao || ''}
                      placeholder="Ex: próximo ao vencimento"
                      onChange={e => aoMudar(idx, { ...p, observacao: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <div style={{fontSize:11,fontWeight:'bold',marginBottom:6}}>⚙ Opções de Preço <span style={{color:'#ef0000',fontWeight:'normal'}}>Preço Simples</span></div>
                  <div className="editar-campo">
                    <label>Unidade</label>
                    <select
                      value={p.unidade || ''}
                      onChange={e => {
                        const nome = e.target.value;
                        const u = UNIDADES.find(x => x.nome === nome);
                        aoMudar(idx, {
                          ...p,
                          unidade: nome,
                          unidadeAbrev: u ? u.abrev : '',
                        });
                      }}
                    >
                      <option value="">Escolha...</option>
                      {UNIDADES.map(u => (
                        <option key={u.nome} value={u.nome}>
                          {u.nome} ({u.abrev})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,marginTop:6}}>
                    <input
                      type="checkbox"
                      id={`m18-${idx}`}
                      checked={!!p.maioresDe18}
                      onChange={e => aoMudar(idx, { ...p, maioresDe18: e.target.checked })}
                    />
                    <label htmlFor={`m18-${idx}`}>Apenas Maiores de 18</label>
                  </div>
                </div>

                <div className="editar-acoes">
                  <button className="btn-arraste">↕ ARRASTE</button>
                  <button className="btn-ver" onClick={aoFechar} title="Fechar e voltar para o encarte">👁 VER</button>
                  <button className="btn-remover" onClick={() => aoRemover(idx)}>🗑 Remover</button>
                </div>
              </div>
            );
          })}

          {produtos.length === 0 && (
            <div style={{textAlign:'center',padding:30,color:'#9ca3af'}}>
              Nenhum produto. Adicione um produto no menu Produtos.
            </div>
          )}
        </div>
      </div>

      <ModalEscolherImagem
        aberto={modalImg.aberto}
        queryInicial={modalImg.query}
        aoFechar={() => setModalImg({ aberto: false, idx: -1, query: '' })}
        aoEscolher={aoEscolherImagem}
        fetchAuth={fetchAuth}
      />
    </>
  );
}
