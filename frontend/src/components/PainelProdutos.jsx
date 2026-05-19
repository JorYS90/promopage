import { useState } from 'react';
import ModalEscolherImagem from './ModalEscolherImagem.jsx';

export default function PainelProdutos({ produtosAtuais, aoAdicionar, aoAdicionarTudo, aoEditar, fetchAuth, user }) {
  const [modalImg, setModalImg] = useState({ aberto: false, query: '', idx: -1 });
  const [tab, setTab] = useState('pesquisar');
  const [linhas, setLinhas] = useState('');
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  // fetchAuth opcional pra compat — sem ele, cai pra fetch normal (deslogado vai dar 401)
  const httpAuth = fetchAuth || ((url, opts) => fetch(url, opts));

  const buscar = async () => {
    if (!linhas.trim()) return;
    if (!user) { alert('Faça login pra pesquisar e adicionar produtos.'); return; }
    setCarregando(true);
    try {
      const r = await httpAuth('/api/produtos/buscar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas }),
      });
      // Lê como texto primeiro pra evitar "Unexpected end of JSON input" se vier vazio
      const txt = await r.text();
      if (!txt) {
        alert(`Erro ao buscar: backend não respondeu (status ${r.status}). Verifique se o servidor está rodando.`);
        return;
      }
      let json;
      try { json = JSON.parse(txt); }
      catch {
        alert('Erro ao buscar: resposta inválida do servidor.\n\n' + txt.slice(0, 200));
        return;
      }
      if (!r.ok) {
        // 401 com user definido = token expirou OU JS cacheado sem auth.
        // Dá mensagem actionable em vez do genérico "Não autenticado".
        if (r.status === 401) {
          alert('Sua sessão expirou. Faça logout, recarregue a página (Ctrl+Shift+R) e entre novamente.');
        } else {
          alert('Erro ao buscar: ' + (json.error || `status ${r.status}`));
        }
        return;
      }
      setResultados(json.resultados || []);
    } catch (e) {
      alert('Erro ao buscar: ' + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const adicionarUm = (idx) => {
    aoAdicionar(resultados[idx].produto);
    setResultados(prev => prev.filter((_, i) => i !== idx));
  };

  const adicionarTodos = () => {
    aoAdicionarTudo(resultados.map(r => r.produto));
    setResultados([]);
  };

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'pesquisar' ? 'active' : ''}`} onClick={() => setTab('pesquisar')}>
          Pesquisar Produtos
        </div>
        <div className={`tab ${tab === 'meus' ? 'active' : ''}`} onClick={() => setTab('meus')}>
          Meus Produtos
        </div>
      </div>

      {tab === 'pesquisar' && (
        <>
          <div className="busca-card">
            <div className="titulo">Digite ou Cole uma lista de produtos</div>
            <div className="exemplo">Ex: Cerveja Brahma Lata de R$ 4,99 por R$ 3,99</div>
            <textarea
              placeholder="Cole / Escreva a lista aqui. Ex: Picanha kg R$ 49,90"
              value={linhas}
              onChange={e => setLinhas(e.target.value)}
            />
            <button className="btn-buscar" onClick={buscar} disabled={carregando}>
              {carregando ? (
                <>⏳ Buscando...</>
              ) : (
                <>🔍 Buscar Produtos</>
              )}
            </button>
          </div>

          {/* Dicas premium na área vazia — só aparecem quando não há resultados */}
          {resultados.length === 0 && (
            <div className="pp-dicas">
              <div className="pp-dicas-header">
                <span className="pp-dicas-titulo">💡 Dicas rápidas</span>
                <span className="pp-dicas-sub">Cola uma lista direto do WhatsApp ou planilha</span>
              </div>

              <div className="pp-dica-card">
                <div className="pp-dica-icon">📋</div>
                <div className="pp-dica-conteudo">
                  <div className="pp-dica-titulo">Cole de qualquer lugar</div>
                  <div className="pp-dica-desc">Lista do WhatsApp, Excel, Word ou bloco de notas — a IA entende o formato.</div>
                </div>
              </div>

              <div className="pp-dica-card">
                <div className="pp-dica-icon">⚡</div>
                <div className="pp-dica-conteudo">
                  <div className="pp-dica-titulo">Imagens automáticas</div>
                  <div className="pp-dica-desc">Cada produto recebe foto profissional — sem você fazer nada.</div>
                </div>
              </div>

              <div className="pp-dica-card">
                <div className="pp-dica-icon">💰</div>
                <div className="pp-dica-conteudo">
                  <div className="pp-dica-titulo">Preços de/por aceitos</div>
                  <div className="pp-dica-desc">Formatos "R$ 4,99 por R$ 3,99" são reconhecidos como oferta.</div>
                </div>
              </div>

              <div className="pp-dica-card">
                <div className="pp-dica-icon">📦</div>
                <div className="pp-dica-conteudo">
                  <div className="pp-dica-titulo">Unidades automáticas</div>
                  <div className="pp-dica-desc">"kg", "un", "pct", "L" — detectado e aplicado no balão de preço.</div>
                </div>
              </div>

              <div className="pp-exemplo-bloco">
                <div className="pp-exemplo-label">Exemplo de lista válida:</div>
                <pre className="pp-exemplo-codigo">{`Picanha kg R$ 49,90
Coca-Cola 2L R$ 8,99 por R$ 6,99
Pão Francês kg R$ 12,90
Sabão em pó OMO 1kg R$ 15,99`}</pre>
              </div>
            </div>
          )}

          {resultados.length > 0 && (
            <>
              <div className="resultado-header">
                ▾ Resultado da Busca <span className="badge-novo">Novo</span>
              </div>
              <div className="resultado-info">Você pode trocar as imagens após a escolha dos produtos.</div>
              <button className="btn-adicionar-tudo" onClick={adicionarTodos}>
                Adicionar tudo »
              </button>
              {resultados.map((r, i) => (
                <div key={i} className="resultado-card">
                  <div
                    className="img-wrapper"
                    onClick={() => setModalImg({ aberto: true, query: r.produto.nome, idx: i })}
                    title="Clique para escolher outra imagem"
                  >
                    {r.produto.imagem ? (
                      <img src={r.produto.imagem} alt={r.produto.nome}
                        onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{width:'100%',height:'100%',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>
                    )}
                    <div className="overlay-trocar">TROCAR<br/>IMAGEM</div>
                  </div>
                  <div className="info">
                    <div className="nome">{r.produto.nome.toUpperCase()}</div>
                    <div className="oferta">
                      Oferta: {r.produto.preco ? `R$ ${r.produto.preco}` : '--'}
                    </div>
                  </div>
                  <button className="btn-add" onClick={() => adicionarUm(i)}>+ ADICIONAR</button>
                </div>
              ))}
              <button className="btn-adicionar-tudo" onClick={adicionarTodos}>Adicionar tudo »</button>
            </>
          )}
        </>
      )}

      {tab === 'meus' && (
        <>
          <div style={{fontSize:13,marginBottom:8}}>
            Produtos no encarte: <b>{produtosAtuais.length}</b>
          </div>
          {produtosAtuais.length === 0 && (
            <div style={{fontSize:12,color:'#9ca3af',textAlign:'center',padding:20}}>
              Nenhum produto adicionado.<br/>
              Vá em <b>Pesquisar Produtos</b> para começar.
            </div>
          )}
          {produtosAtuais.map((p, i) => (
            <div key={i} className="resultado-card" onClick={() => aoEditar(i)} style={{cursor:'pointer'}}>
              {p.imagem ? (
                <img src={p.imagem} alt={p.nome} />
              ) : (
                <div style={{width:56,height:56,background:'#f3f4f6',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>
              )}
              <div className="info">
                <div className="nome">{p.nome.toUpperCase()}</div>
                <div className="oferta">{p.preco ? `R$ ${p.preco}` : 'Sem preço'}</div>
              </div>
            </div>
          ))}
          {produtosAtuais.length > 0 && (
            <button className="btn-adicionar-tudo" style={{background:'#ef0000',marginTop:12}} onClick={() => aoEditar(-1)}>
              ✏️ Editar todos
            </button>
          )}
        </>
      )}

      <ModalEscolherImagem
        aberto={modalImg.aberto}
        queryInicial={modalImg.query}
        aoFechar={() => setModalImg({ aberto: false, query: '', idx: -1 })}
        aoEscolher={(novaUrl) => {
          // Atualiza a imagem do resultado escolhido
          const nomeProduto = resultados[modalImg.idx]?.produto?.nome;
          setResultados(prev => prev.map((r, i) => i === modalImg.idx
            ? { ...r, produto: { ...r.produto, imagem: novaUrl } }
            : r
          ));
          // ESCOLHA EXPLÍCITA = peso 10 (forte). Sobrescreve seed automático (peso 1).
          if (nomeProduto && novaUrl && !novaUrl.includes('/api/placeholder')) {
            fetch('/api/produtos/registrar-imagem', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nome: nomeProduto, imagemUrl: novaUrl, peso: 10 }),
            }).catch(() => {});
          }
        }}
      />
    </div>
  );
}
