import { useEffect, useState } from 'react';

// Categorias agora vêm do backend (são gerenciáveis dinamicamente)
const CATEGORIAS_FALLBACK = ['Meus Temas']; // usado se /api/categorias falhar

// Upload helper. fetchAuth opcional pra autenticar (endpoint exige auth).
async function uploadArquivo(file, fetchAuth) {
  const fd = new FormData();
  fd.append('imagem', file);
  const http = fetchAuth || ((url, opts) => fetch(url, opts));
  const r = await http('/api/upload', { method: 'POST', body: fd });
  const json = await r.json();
  if (!json.url) throw new Error(json.error || 'falha no upload');
  return json.url;
}

// Componente reusável de zona de upload com preview
function ZonaUpload({ titulo, subtitulo, dimensaoRecomendada, dica, valor, aoMudar, accept, fetchAuth }) {
  const [enviando, setEnviando] = useState(false);
  const [nomeArq, setNomeArq] = useState('');

  const aoSelecionar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const url = await uploadArquivo(file, fetchAuth);
      setNomeArq(file.name);
      aoMudar(url);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const id = `upload-${titulo.replace(/\s+/g, '-')}`;
  return (
    <div className="zona-upload-tema">
      <div className="zu-header">
        <div className="zu-titulo">{titulo}</div>
        <div className="zu-sub">{subtitulo}</div>
      </div>
      <div className="zu-medida">
        📐 Recomendado: <b>{dimensaoRecomendada}</b>
      </div>
      <div className="zu-dica">{dica}</div>

      {valor ? (
        <div className="zu-preview">
          <img src={valor} alt="Prévia" />
          <div className="zu-preview-info">
            <span>{nomeArq || 'imagem.png'}</span>
            <button onClick={() => { aoMudar(''); setNomeArq(''); }}>✕ Trocar</button>
          </div>
        </div>
      ) : (
        <div className="zu-drop">
          <input
            id={id}
            type="file"
            accept={accept || 'image/png,image/jpeg,image/webp'}
            onChange={aoSelecionar}
            style={{ display: 'none' }}
          />
          <label htmlFor={id} className="zu-btn">
            {enviando ? '⏳ Enviando...' : '📤 Escolher arquivo'}
          </label>
        </div>
      )}
    </div>
  );
}

export default function ModalCriarTema({ aoFechar, aoSalvar, temaInicial, fetchAuth }) {
  // Endpoint /api/templates é restrito a admin/super_admin; usa fetchAuth se
  // tiver disponível (com Bearer token), senão cai pro fetch padrão.
  const httpAuth = fetchAuth || ((url, opts) => fetch(url, opts));
  // Modo edição: temaInicial é { id, nome, categoria, capa, rodape, paleta }
  const editando = !!temaInicial?.id;
  const [salvando, setSalvando] = useState(false);

  // Categorias dinâmicas (carregadas do backend)
  const [categorias, setCategorias] = useState(CATEGORIAS_FALLBACK);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [adicionandoCategoria, setAdicionandoCategoria] = useState(false);

  // Pré-preenchimento quando editando
  const [nome, setNome] = useState(temaInicial?.nome || '');
  const [categoria, setCategoria] = useState(temaInicial?.categoria || 'Meus Temas');

  const [imagemFundo, setImagemFundo] = useState(temaInicial?.capa?.imagemFundo || '');
  const [imagemTitulo, setImagemTitulo] = useState(temaInicial?.capa?.imagemTitulo || '');
  const [posicaoTitulo, setPosicaoTitulo] = useState(temaInicial?.capa?.posicaoTitulo || 'centro');
  const [balaoOferta, setBalaoOferta] = useState(temaInicial?.paleta?.balaoOferta || '');

  // Fundo do encarte (área dos produtos) — cor sólida OU imagem tileada (infinita)
  const [fundoEncarteTipo, setFundoEncarteTipo] = useState(temaInicial?.fundoEncarte?.tipo || 'cor');
  const [fundoEncarteCor, setFundoEncarteCor] = useState(temaInicial?.fundoEncarte?.cor || '#ffffff');
  const [fundoEncarteImagem, setFundoEncarteImagem] = useState(temaInicial?.fundoEncarte?.imagem || '');

  // Cores dos cards
  const [corFundoBox, setCorFundoBox] = useState(temaInicial?.paleta?.fundoBox || '#fde047');
  const [corTextoNome, setCorTextoNome] = useState(temaInicial?.paleta?.textoNome || '#1f2937');
  // Cor do NOME apenas em produtos em destaque (cards grandes / destaque máximo)
  const [corTextoNomeDestaque, setCorTextoNomeDestaque] = useState(temaInicial?.paleta?.textoNomeDestaque || '#ffffff');
  const [corTagPreco, setCorTagPreco] = useState(temaInicial?.paleta?.tagPreco || '#ef0000');
  const [corTextoValor, setCorTextoValor] = useState(temaInicial?.paleta?.textoPreco || '#ffffff');
  // Cor do valor APENAS para produtos em destaque (cards grandes / destaque maximo)
  const [corTextoValorDestaque, setCorTextoValorDestaque] = useState(temaInicial?.paleta?.textoPrecoDestaque || '#1f2937');

  // Rodapé
  const [rodapeFundo, setRodapeFundo] = useState(temaInicial?.rodape?.fundo || '#ef0000');
  const [rodapeFaixa, setRodapeFaixa] = useState(temaInicial?.rodape?.faixaSuperior || '#fbbf24');
  // Campos de "Texto à esquerda/direita" do rodapé removidos.
  // Esses dados agora vêm de outras fontes: PainelEmpresa (telefone/loja)
  // e configs do encarte. Evita duplicação de configuração.

  // Carrega categorias do backend (GET é público; usa httpAuth pra incluir
  // custom do user logado — sem auth, vem só as padrão).
  const carregarCategorias = () => {
    httpAuth('/api/categorias')
      .then(r => r.json())
      .then(lista => {
        if (Array.isArray(lista) && lista.length > 0) {
          setCategorias(lista.map(c => typeof c === 'string' ? { nome: c, padrao: false } : c));
        }
      })
      .catch(() => { /* fallback já em uso */ });
  };

  useEffect(() => {
    carregarCategorias();
  }, []);

  // Adiciona categoria inline (POST exige auth)
  const handleAdicionarCategoria = async () => {
    const limpo = novaCategoria.trim();
    if (!limpo) return;
    try {
      const r = await httpAuth('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: limpo }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'falha');
      }
      setNovaCategoria('');
      setAdicionandoCategoria(false);
      carregarCategorias();
      setCategoria(limpo); // já seleciona a recém-criada
    } catch (e) {
      alert('Erro ao adicionar categoria: ' + e.message);
    }
  };

  // Remove categoria (DELETE exige auth)
  const handleRemoverCategoria = async (nomeCat) => {
    if (!confirm(`Remover a categoria "${nomeCat}"?\nTemas dessa categoria não serão deletados, mas ficarão sem agrupamento.`)) return;
    try {
      const r = await httpAuth(`/api/categorias/${encodeURIComponent(nomeCat)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('falha');
      carregarCategorias();
      if (categoria === nomeCat) setCategoria('Meus Temas');
    } catch (e) {
      alert('Erro ao remover: ' + e.message);
    }
  };

  const salvar = async () => {
    if (!nome.trim()) {
      alert('Dê um nome ao tema.');
      return;
    }
    if (!imagemFundo && !imagemTitulo) {
      if (!confirm('Você não enviou nenhuma imagem. Salvar mesmo assim?')) return;
    }
    setSalvando(true);
    const payload = {
      // Em modo edição, manda o id pra atualizar o JSON existente em vez de criar duplicata
      id: editando ? temaInicial.id : undefined,
      nome: nome.trim(),
      categoria,
      capa: {
        tipo: 'imagens',
        // altura é definida em runtime pelo renderizarEncarte (~30% da altura do canvas)
        fundo: '#ef0000', // cor de fallback se a imagem do fundo não carregar
        imagemFundo: imagemFundo || undefined,
        imagemTitulo: imagemTitulo || undefined,
        posicaoTitulo,  // 'esquerda' | 'centro' | 'direita'
        elementos: [],
      },
      rodape: {
        tipo: 'redondo-grande',
        altura: 80,
        fundo: rodapeFundo,
        faixaSuperior: rodapeFaixa,
      },
      paleta: {
        primaria: corTagPreco,
        secundaria: rodapeFaixa,
        fundoBox: corFundoBox,
        fundoBoxSecundario: rodapeFaixa,
        textoNome: corTextoNome,
        textoNomeDestaque: corTextoNomeDestaque,
        textoPreco: corTextoValor,
        textoPrecoDestaque: corTextoValorDestaque,
        tagPreco: corTagPreco,
        balaoOferta: balaoOferta || undefined,
      },
      fundoEncarte: {
        tipo: fundoEncarteTipo,                                  // 'cor' ou 'imagem'
        cor: fundoEncarteTipo === 'cor' ? fundoEncarteCor : undefined,
        imagem: fundoEncarteTipo === 'imagem' ? fundoEncarteImagem : undefined,
      },
    };
    try {
      const r = await httpAuth('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (r.ok && json.id) {
        aoSalvar?.(json.id);
        aoFechar();
      } else {
        alert('Falha ao salvar: ' + (json.error || 'desconhecido'));
      }
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-criar-tema" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{editando ? '✏️ Editar Tema' : '➕ Criar Tema'}</h2>
            <div className="sub">
              {editando
                ? `Editando "${temaInicial.nome}". As mudanças são salvas no mesmo tema.`
                : 'Anexe uma imagem de fundo e uma imagem de título (logo). O sistema redimensiona pra qualquer formato.'}
            </div>
          </div>
          <div>
            <button className="btn-fechar" onClick={aoFechar} disabled={salvando}>Cancelar</button>
            <button className="btn-salvar-tema" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : (editando ? '💾 Salvar Alterações' : '💾 Salvar Tema')}
            </button>
          </div>
        </div>

        <div className="conteudo-tema">
          {/* Linha 1: Nome + Categoria */}
          <div className="linha-dupla">
            <div className="campo-tema">
              <label>Nome do Tema *</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Black Friday Outubro"
                maxLength={50}
              />
            </div>
            <div className="campo-tema">
              <label>
                Categoria
                <button
                  type="button"
                  className="link-mini"
                  onClick={() => setAdicionandoCategoria(!adicionandoCategoria)}
                >
                  {adicionandoCategoria ? '✕ cancelar' : '+ nova'}
                </button>
              </label>
              {adicionandoCategoria ? (
                <div className="linha-cor">
                  <input
                    type="text"
                    value={novaCategoria}
                    onChange={e => setNovaCategoria(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdicionarCategoria()}
                    placeholder="Nome da nova categoria"
                    maxLength={60}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-mini-add"
                    onClick={handleAdicionarCategoria}
                  >
                    ✓ Adicionar
                  </button>
                </div>
              ) : (
                <div className="select-com-acoes">
                  <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                    {categorias.map(c => {
                      const nomeCat = typeof c === 'string' ? c : c.nome;
                      return <option key={nomeCat} value={nomeCat}>{nomeCat}</option>;
                    })}
                  </select>
                  {/* Botão remover só aparece pra categorias NÃO-padrão */}
                  {categorias.find(c => (typeof c === 'string' ? c : c.nome) === categoria && c.padrao === false) && (
                    <button
                      type="button"
                      className="btn-mini-del"
                      onClick={() => handleRemoverCategoria(categoria)}
                      title="Remover esta categoria"
                    >
                      🗑
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Uploads da capa */}
          <div className="secao-titulo">🖼️ Imagens da Capa</div>
          <div className="grade-uploads">
            <ZonaUpload fetchAuth={fetchAuth}
              titulo="Imagem de Fundo"
              subtitulo="Preenche todo o fundo da capa"
              dimensaoRecomendada="2400 × 800 px (aspecto 3:1)"
              dica="JPG, PNG ou WebP. O sistema recorta o que sobrar pra preencher a área da capa em qualquer formato (modo COVER)."
              valor={imagemFundo}
              aoMudar={setImagemFundo}
            />
            <ZonaUpload fetchAuth={fetchAuth}
              titulo="Imagem do Título"
              subtitulo="Logo/escrita principal sobreposta"
              dimensaoRecomendada="1500 × 500 px (PNG transparente)"
              dica="Use PNG com fundo TRANSPARENTE. O sistema posiciona conforme alinhamento escolhido e ajusta o tamanho mantendo a proporção (~98% da capa)."
              valor={imagemTitulo}
              aoMudar={setImagemTitulo}
              accept="image/png"
            />
          </div>

          {/* Posição do título dentro da capa */}
          {imagemTitulo && (
            <div className="campo-tema posicao-titulo">
              <label>Posição do Título na Capa</label>
              <div className="pos-grupo">
                {[
                  { id: 'esquerda', label: '⬅️ Esquerda' },
                  { id: 'centro',   label: '⬛ Centro'   },
                  { id: 'direita',  label: '➡️ Direita'  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`pos-btn ${posicaoTitulo === opt.id ? 'ativo' : ''}`}
                    onClick={() => setPosicaoTitulo(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Balão de oferta — apenas upload customizado */}
          <div className="secao-titulo">💰 Balão de Oferta (Tag de Preço)</div>

          <div className="grade-uploads grade-uploads-1">
            <ZonaUpload fetchAuth={fetchAuth}
              titulo="Imagem do Balão"
              subtitulo="Forma/etiqueta onde o preço aparece"
              dimensaoRecomendada="600 × 150 px (aspecto 4:1, PNG transparente)"
              dica="⚠️ PNG TRANSPARENTE e SEM TEXTO. Apenas a forma colorida (paralelograma, etiqueta, ribbon...) — o sistema escreve 'R$ X,XX' por cima dinamicamente. ✂️ DICA: corte a imagem RENTE à arte (sem espaço transparente em volta) — o sistema detecta automaticamente, mas quanto menos padding melhor o resultado. Se ficar vazio, usa a pílula vermelha padrão."
              valor={balaoOferta}
              aoMudar={setBalaoOferta}
              accept="image/png"
            />
          </div>

          {/* Preview combinado */}
          {(imagemFundo || imagemTitulo || balaoOferta) && (
            <div className="preview-combinado">
              <div className="pc-label">Prévia (proporção variará por formato)</div>
              <div className={`pc-area pc-pos-${posicaoTitulo}`} style={{ background: imagemFundo ? `url(${imagemFundo}) center/cover` : '#ef0000' }}>
                {imagemTitulo && <img className="pc-titulo" src={imagemTitulo} alt="Título" />}
              </div>
              {balaoOferta && (
                <div className="pc-balao-wrap">
                  <div className="pc-label" style={{marginTop:8}}>Balão de oferta com preço dinâmico:</div>
                  <div className="pc-balao" style={{ backgroundImage: `url(${balaoOferta})` }}>
                    <span className="pc-balao-rs">R$</span>
                    <span className="pc-balao-valor">14,99</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cores dos cards */}
          <div className="secao-titulo">🎨 Cores dos Cards de Produto</div>
          <div className="linha-quadrupla">
            <div className="campo-tema">
              <label>Fundo do card</label>
              <div className="linha-cor">
                <input type="color" value={corFundoBox} onChange={e => setCorFundoBox(e.target.value)} />
                <input type="text" value={corFundoBox} onChange={e => setCorFundoBox(e.target.value)} maxLength={20} />
              </div>
            </div>
            <div className="campo-tema">
              <label>Texto do nome</label>
              <div className="linha-cor">
                <input type="color" value={corTextoNome} onChange={e => setCorTextoNome(e.target.value)} />
                <input type="text" value={corTextoNome} onChange={e => setCorTextoNome(e.target.value)} maxLength={20} />
              </div>
            </div>
            <div className="campo-tema">
              <label>Tag de preço</label>
              <div className="linha-cor">
                <input type="color" value={corTagPreco} onChange={e => setCorTagPreco(e.target.value)} />
                <input type="text" value={corTagPreco} onChange={e => setCorTagPreco(e.target.value)} maxLength={20} />
              </div>
            </div>
            <div className="campo-tema">
              <label>Texto do valor</label>
              <div className="linha-cor">
                <input type="color" value={corTextoValor} onChange={e => setCorTextoValor(e.target.value)} />
                <input type="text" value={corTextoValor} onChange={e => setCorTextoValor(e.target.value)} maxLength={20} />
              </div>
            </div>
          </div>
          <div className="linha-quadrupla">
            <div className="campo-tema">
              <label>Texto do nome (destaque)</label>
              <div className="linha-cor">
                <input type="color" value={corTextoNomeDestaque} onChange={e => setCorTextoNomeDestaque(e.target.value)} />
                <input type="text" value={corTextoNomeDestaque} onChange={e => setCorTextoNomeDestaque(e.target.value)} maxLength={20} />
                <span className="hint">Cor do nome nos produtos em destaque (cards grandes).</span>
              </div>
            </div>
            <div className="campo-tema">
              <label>Texto do valor (destaque)</label>
              <div className="linha-cor">
                <input type="color" value={corTextoValorDestaque} onChange={e => setCorTextoValorDestaque(e.target.value)} />
                <input type="text" value={corTextoValorDestaque} onChange={e => setCorTextoValorDestaque(e.target.value)} maxLength={20} />
                <span className="hint">Cor do preço nos produtos em destaque (cards grandes).</span>
              </div>
            </div>
          </div>

          {/* Fundo do Encarte (área dos produtos) */}
          <div className="secao-titulo">🖼️ Fundo do Encarte (área dos produtos)</div>
          <div className="fe-toggle-grupo">
            <button
              type="button"
              className={`fe-tipo-btn ${fundoEncarteTipo === 'cor' ? 'ativo' : ''}`}
              onClick={() => setFundoEncarteTipo('cor')}
            >🎨 Cor sólida</button>
            <button
              type="button"
              className={`fe-tipo-btn ${fundoEncarteTipo === 'imagem' ? 'ativo' : ''}`}
              onClick={() => setFundoEncarteTipo('imagem')}
            >🖼️ Imagem (tileada)</button>
          </div>

          {fundoEncarteTipo === 'cor' && (
            <div className="campo-tema" style={{ marginBottom: 14 }}>
              <label>Cor de fundo da área dos produtos</label>
              <div className="linha-cor">
                <input type="color" value={fundoEncarteCor} onChange={e => setFundoEncarteCor(e.target.value)} />
                <input type="text" value={fundoEncarteCor} onChange={e => setFundoEncarteCor(e.target.value)} maxLength={20} />
                <span className="hint">Aplicada no espaço entre a capa e o rodapé.</span>
              </div>
            </div>
          )}

          {fundoEncarteTipo === 'imagem' && (
            <div className="grade-uploads grade-uploads-1" style={{ marginBottom: 14 }}>
              <ZonaUpload fetchAuth={fetchAuth}
                titulo="Imagem do Fundo do Encarte"
                subtitulo="Será REPETIDA (tileada) infinitamente pra preencher qualquer formato"
                dimensaoRecomendada="400 × 400 px (textura sem bordas visíveis = tile perfeito)"
                dica="🔁 A imagem é REPETIDA em mosaico. Use texturas seamless (sem bordas aparentes) pra um resultado limpo. Padrões geométricos, marmorizados, papel kraft, papel quadriculado funcionam bem. Evite imagens com bordas claras."
                valor={fundoEncarteImagem}
                aoMudar={setFundoEncarteImagem}
              />
            </div>
          )}

          {/* Rodapé */}
          <div className="secao-titulo">🦶 Rodapé</div>
          <div className="linha-dupla">
            <div className="campo-tema">
              <label>Cor do rodapé</label>
              <div className="linha-cor">
                <input type="color" value={rodapeFundo} onChange={e => setRodapeFundo(e.target.value)} />
                <input type="text" value={rodapeFundo} onChange={e => setRodapeFundo(e.target.value)} maxLength={20} />
              </div>
            </div>
            <div className="campo-tema">
              <label>Faixa fina superior</label>
              <div className="linha-cor">
                <input type="color" value={rodapeFaixa} onChange={e => setRodapeFaixa(e.target.value)} />
                <input type="text" value={rodapeFaixa} onChange={e => setRodapeFaixa(e.target.value)} maxLength={20} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
