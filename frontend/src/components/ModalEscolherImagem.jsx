import { useEffect, useRef, useState } from 'react';

export default function ModalEscolherImagem({ aberto, queryInicial, aoFechar, aoEscolher }) {
  const [query, setQuery] = useState(queryInicial || '');
  const [imagens, setImagens] = useState([]);
  const [populares, setPopulares] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoPopulares, setCarregandoPopulares] = useState(false);
  const [selecionada, setSelecionada] = useState(null);
  const [origemSelecionada, setOrigemSelecionada] = useState(null); // 'populares' ou 'busca'
  const [enviandoUpload, setEnviandoUpload] = useState(false);
  const inputFileRef = useRef(null);

  useEffect(() => {
    if (aberto && queryInicial) {
      setQuery(queryInicial);
      buscarPopulares(queryInicial);
      buscar(queryInicial);
    }
  }, [aberto, queryInicial]);

  // Busca imagens populares (banco interno) — instantâneo
  const buscarPopulares = async (q) => {
    if (!q.trim()) return;
    setCarregandoPopulares(true);
    try {
      const r = await fetch(`/api/produtos/imagens-populares?q=${encodeURIComponent(q)}&limite=8`);
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
    setOrigemSelecionada(null);
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

  const selecionarPopular = (i) => {
    setSelecionada(i);
    setOrigemSelecionada('populares');
  };

  const selecionarBusca = (i) => {
    setSelecionada(i);
    setOrigemSelecionada('busca');
  };

  const confirmarEscolha = () => {
    if (selecionada === null) return;
    const url = origemSelecionada === 'populares'
      ? populares[selecionada].url
      : imagens[selecionada].url;
    aoEscolher(url);
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
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
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

  return (
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

        {/* Seção de IMAGENS POPULARES (mais usadas pelos usuários) */}
        {populares.length > 0 && (
          <>
            <div className="secao-populares-header">
              <span className="badge-populares">⭐ MAIS USADAS</span>
              <span className="info">Imagens já escolhidas por outros usuários para "{queryInicial}"</span>
            </div>
            <div className="grid-imagens grid-imagens-populares">
              {populares.map((img, i) => (
                <div
                  key={`pop-${i}`}
                  className={`img-card popular ${origemSelecionada === 'populares' && selecionada === i ? 'selecionada' : ''}`}
                  onClick={() => selecionarPopular(i)}
                  title={`${img.usos} uso${img.usos > 1 ? 's' : ''}`}
                >
                  <img
                    src={img.url}
                    alt=""
                    onError={(e) => { e.target.parentElement.style.opacity = 0.3; }}
                  />
                  <span className="contador-usos">{img.usos}×</span>
                  {origemSelecionada === 'populares' && selecionada === i && (
                    <button className="btn-criar" onClick={(e) => { e.stopPropagation(); confirmarEscolha(); }}>
                      ✓ USAR
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Seção de IMAGENS DA INTERNET (Bing, Google, etc) */}
        <div style={{fontSize:13,color:'#6b7280',margin:'14px 0 8px'}}>
          🌐 {carregando ? 'Buscando na internet...' : `Imagens da internet (${imagens.length})`}
        </div>

        <div className="grid-imagens">
          {imagens.map((img, i) => (
            <div
              key={`web-${i}`}
              className={`img-card ${origemSelecionada === 'busca' && selecionada === i ? 'selecionada' : ''}`}
              onClick={() => selecionarBusca(i)}
              title={img.titulo || ''}
            >
              <img
                src={`/api/proxy-imagem-direto?url=${encodeURIComponent(img.url)}`}
                alt={img.titulo || ''}
                onError={(e) => { e.target.parentElement.style.opacity = 0.3; }}
              />
              {origemSelecionada === 'busca' && selecionada === i && (
                <button className="btn-criar" onClick={(e) => { e.stopPropagation(); confirmarEscolha(); }}>
                  ✓ CRIAR
                </button>
              )}
            </div>
          ))}
          {!carregando && imagens.length === 0 && populares.length === 0 && (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:30,color:'#9ca3af'}}>
              Nenhuma imagem encontrada. Tente refinar a busca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
