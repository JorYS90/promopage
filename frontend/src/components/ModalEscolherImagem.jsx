import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ModalEscolherImagem({ aberto, queryInicial, aoFechar, aoEscolher, fetchAuth }) {
  const [query, setQuery] = useState(queryInicial || '');
  const [imagens, setImagens] = useState([]);
  const [populares, setPopulares] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoPopulares, setCarregandoPopulares] = useState(false);
  const [selecionada, setSelecionada] = useState(null); // índice na lista combinada
  const [enviandoUpload, setEnviandoUpload] = useState(false);
  const inputFileRef = useRef(null);
  // /api/upload exige auth; outros endpoints daqui (populares/buscar-imagens) são públicos.
  const httpAuth = fetchAuth || ((url, opts) => fetch(url, opts));

  useEffect(() => {
    if (aberto && queryInicial) {
      setQuery(queryInicial);
      buscarPopulares(queryInicial);
      buscar(queryInicial);
    }
  }, [aberto, queryInicial]);

  // Busca imagens populares (banco interno) — instantâneo.
  // Limite 20: regra do user é "sempre populares; se tiver 20+ não busca internet
  // nenhuma". Backend filtra os 20 mais usados por nome de produto.
  const buscarPopulares = async (q) => {
    if (!q.trim()) return;
    setCarregandoPopulares(true);
    try {
      const r = await fetch(`/api/produtos/imagens-populares?q=${encodeURIComponent(q)}&limite=20`);
      const json = await r.json();
      setPopulares(json.imagens || []);
    } catch {
      setPopulares([]);
    } finally {
      setCarregandoPopulares(false);
    }
  };

  // Busca imagens externas (Bing, Google, etc) — pode demorar alguns segundos
  const buscar = async (q) => {
    if (!q.trim()) return;
    setCarregando(true);
    setSelecionada(null);
    try {
      const r = await fetch(`/api/produtos/buscar-imagens?q=${encodeURIComponent(q)}&limite=12`);
      const json = await r.json();
      setImagens(json.imagens || []);
    } catch (e) {
      alert('Erro ao buscar imagens: ' + e.message);
    } finally {
      setCarregando(false);
    }
  };

  // Lista única combinada (max 20 cards):
  // 1. Populares primeiro (já ordenadas por uso desc no backend)
  // 2. Completa com imagens da internet APENAS se faltar pra chegar em 20
  //    (se tem 20+ populares, NÃO mostra nenhuma internet)
  // Dedup por URL — se a mesma URL aparece nos 2, conta uma vez só.
  const MAX_TOTAL = 20;
  const listaCombinada = (() => {
    const vistas = new Set();
    const out = [];
    for (const p of populares) {
      if (out.length >= MAX_TOTAL) break;
      if (!p.url || vistas.has(p.url)) continue;
      vistas.add(p.url);
      out.push({ url: p.url, titulo: '', isPopular: true });
    }
    const restante = MAX_TOTAL - out.length;
    if (restante > 0) {
      for (const w of imagens) {
        if (out.length >= MAX_TOTAL) break;
        if (!w.url || vistas.has(w.url)) continue;
        vistas.add(w.url);
        out.push({ url: w.url, titulo: w.titulo || '', isPopular: false });
      }
    }
    return out;
  })();

  const selecionar = (i) => setSelecionada(i);

  const confirmarEscolha = () => {
    if (selecionada === null) return;
    const item = listaCombinada[selecionada];
    if (!item) return;
    aoEscolher(item.url);
    aoFechar();
  };

  // Upload de imagem do PC do usuário — sinal MAIS forte de aprendizado.
  // Sobe pro backend, registra no banco de populares com peso 5 (máximo) e usa.
  const aoSelecionarArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Valida tamanho ANTES de enviar (limite do backend é 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo 10MB.\n\nReduza a foto antes de subir (ex: salvar em qualidade média no celular).`);
      if (inputFileRef.current) inputFileRef.current.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert(`Arquivo não é uma imagem (tipo: ${file.type || 'desconhecido'}). Use .jpg, .png ou .webp.`);
      if (inputFileRef.current) inputFileRef.current.value = '';
      return;
    }
    setEnviandoUpload(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const r = await httpAuth('/api/upload', { method: 'POST', body: fd });
      if (!r.ok) {
        // Tenta ler corpo da resposta pra mostrar erro REAL do backend
        let detalhe = '';
        try {
          const txt = await r.text();
          if (txt) {
            try { detalhe = JSON.parse(txt).error || txt.slice(0, 200); }
            catch { detalhe = txt.slice(0, 200); }
          }
        } catch {}
        throw new Error(`HTTP ${r.status} ${r.statusText}${detalhe ? ' — ' + detalhe : ''}`);
      }
      const json = await r.json();
      const url = json.url;
      // Registra com peso 20 (sinal MAIS forte possível: usuário subiu a foto exata).
      // Esse peso sobrescreve qualquer seed automático (peso 1) e ações anteriores.
      const nome = (queryInicial || query || '').trim();
      if (nome && url) {
        const r2 = await fetch('/api/produtos/registrar-imagem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, imagemUrl: url, peso: 20 }),
        }).catch(() => null);
        if (r2 && r2.ok) {
          console.log(`[upload] foto registrada como "${nome}" — próximas buscas vão priorizar essa imagem`);
        }
      }
      aoEscolher(url);
      aoFechar();
    } catch (err) {
      alert('Erro ao subir imagem: ' + (err.message || err));
    } finally {
      setEnviandoUpload(false);
      // Reset input pra permitir re-selecionar mesmo arquivo
      if (inputFileRef.current) inputFileRef.current.value = '';
    }
  };

  if (!aberto) return null;

  // Renderiza via portal direto no <body>: este modal é montado dentro do
  // PainelProdutos (sidebar do editor), e o canvas do editor usa transform (zoom),
  // que cria um stacking context e prende o position:fixed do overlay dentro do
  // editor — fazendo o canvas cobrir o topo do modal no mobile. O portal escapa
  // desse container e garante overlay em tela cheia de verdade.
  return createPortal(
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal escolher-imagem" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        <h2 style={{margin:'0 0 16px',fontSize:22}}>
          Produto: <b>{queryInicial}</b>
        </h2>

        <div className="busca-imagens">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (buscarPopulares(query), buscar(query))}
            placeholder="Refine a busca..."
          />
          <button onClick={() => { buscarPopulares(query); buscar(query); }} disabled={carregando}>
            {carregando ? 'Buscando...' : 'Pesquisar'}
          </button>
          {/* Upload de imagem própria — sinal mais forte (peso 5) pro banco de populares */}
          <button
            onClick={() => inputFileRef.current?.click()}
            disabled={enviandoUpload}
            style={{ background: '#16a34a', color: '#fff', whiteSpace: 'nowrap' }}
            title="Suba a foto correta do seu PC. Será salva e priorizada nas próximas buscas pelo mesmo produto."
          >
            {enviandoUpload ? 'Enviando...' : '📤 Subir foto minha'}
          </button>
          <input
            ref={inputFileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={aoSelecionarArquivo}
          />
        </div>

        {/* Status de busca — discreto. Sem distinguir populares vs internet
            (decisão UX 2026-05-18: user pediu grid uniforme). */}
        <div style={{fontSize:13,color:'#6b7280',margin:'14px 0 8px'}}>
          {carregando
            ? '🔎 Buscando imagens...'
            : `${listaCombinada.length} imagem${listaCombinada.length === 1 ? '' : 'ns'} encontrada${listaCombinada.length === 1 ? '' : 's'}`}
        </div>

        {/* Grid ÚNICA: populares (do banco) primeiro, internet depois.
            Internamente continua ordenando por relevância; visualmente uniforme. */}
        <div className="grid-imagens">
          {listaCombinada.map((img, i) => (
            <div
              key={`img-${i}`}
              className={`img-card ${selecionada === i ? 'selecionada' : ''}`}
              onClick={() => selecionar(i)}
              title={img.titulo}
            >
              <img
                src={img.isPopular ? img.url : `/api/proxy-imagem-direto?url=${encodeURIComponent(img.url)}`}
                alt={img.titulo}
                onError={(e) => { e.target.parentElement.style.opacity = 0.3; }}
              />
              {selecionada === i && (
                <button className="btn-criar" onClick={(e) => { e.stopPropagation(); confirmarEscolha(); }}>
                  ✓ USAR
                </button>
              )}
            </div>
          ))}
          {!carregando && listaCombinada.length === 0 && (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:30,color:'#9ca3af'}}>
              Nenhuma imagem encontrada. Tente refinar a busca.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
