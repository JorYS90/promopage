import { useEffect, useRef, useState } from 'react';
import ModalRecortarLogo from './ModalRecortarLogo.jsx';

// Chave de localStorage agora inclui sufixo do user (2026-05-19) pra isolar
// preferências entre contas no mesmo browser. userId=null/anon = chave pública.
const storageKey = (userId) => `encarte-builder:logo:${userId || 'anon'}`;

const DADOS_VAZIOS = {
  url: '',                  // URL da imagem (vinda do upload)
  fundoTipo: 'transparente', // 'escuro' | 'claro' | 'transparente'
  posicao: 'capa-direita',  // 'capa-esquerda' | 'capa-centro' | 'capa-direita'
  tamanho: 100,             // % (50-150)
};

// Os 5 fundos sugeridos no painel: quadrado/redondo × escuro/claro + sem fundo.
// `shape: 'rect'` desenha retângulo arredondado; 'circle' desenha círculo;
// 'none' não desenha fundo (sem moldura).
const FUNDOS = [
  { id: 'escuro',         label: 'Fundo Escuro',         bg: '#1f2937',     shape: 'rect'   },
  { id: 'escuro-redondo', label: 'Fundo Escuro Redondo', bg: '#1f2937',     shape: 'circle' },
  { id: 'claro',          label: 'Fundo Claro',          bg: '#ffffff',     shape: 'rect'   },
  { id: 'claro-redondo',  label: 'Fundo Claro Redondo',  bg: '#ffffff',     shape: 'circle' },
  { id: 'transparente',   label: 'Sem Fundo',            bg: 'transparent', shape: 'none'   },
];

async function uploadArquivo(file, fetchAuth) {
  const fd = new FormData();
  fd.append('imagem', file);
  // /api/upload exige auth desde isolamento por user (2026-05-19)
  const http = fetchAuth || ((url, opts) => fetch(url, opts));
  const r = await http('/api/upload', { method: 'POST', body: fd });
  const json = await r.json();
  if (!json.url) throw new Error(json.error || 'falha no upload');
  return json.url;
}

function carregar(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DADOS_VAZIOS;
    return { ...DADOS_VAZIOS, ...JSON.parse(raw) };
  } catch {
    return DADOS_VAZIOS;
  }
}

export default function PainelLogo({ aoAtualizar, corBorda = '#ef4444', fetchAuth, userId }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef(null);
  // URL temporária aguardando recorte/remoção de fundo no modal
  const [urlPendente, setUrlPendente] = useState('');

  useEffect(() => {
    const inicial = carregar(userId);
    setDados(inicial);
    aoAtualizar?.(inicial);
    // Recarrega sempre que user muda (login/logout)
  }, [userId]);

  const salvar = (novo) => {
    setDados(novo);
    try { localStorage.setItem(storageKey(userId), JSON.stringify(novo)); } catch {}
    aoAtualizar?.(novo);
  };

  const escolherArquivo = () => {
    fileInputRef.current?.click();
  };

  const aoSelecionar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const url = await uploadArquivo(file, fetchAuth);
      // Não salva direto: abre o modal de recorte/remoção de fundo
      setUrlPendente(url);
    } catch (err) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remover = () => {
    if (!confirm('Remover a logo?')) return;
    salvar({ ...dados, url: '' });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Envie sua Logo</h2>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 0, marginBottom: 14, lineHeight: 1.4 }}>
        Envie sua logo e escolha um fundo mais adequado.
      </p>

      {/* Drop zone — clica pra abrir picker, ou arrasta arquivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={aoSelecionar}
        style={{ display: 'none' }}
      />

      {!dados.url ? (
        <button
          type="button"
          className="logo-drop"
          onClick={escolherArquivo}
          disabled={enviando}
        >
          <div className="logo-drop-icone">
            <div className="logo-drop-rect" />
          </div>
          <div className="logo-drop-texto">
            {enviando ? '⏳ Enviando...' : 'Clique para enviar\nsua logo'}
          </div>
        </button>
      ) : (
        <>
          {/* Card grande com a logo: clique na imagem pra trocar + botão "Usar Logo" */}
          <div className="logo-card-principal">
            <button
              type="button"
              className="logo-imagem-clicavel"
              onClick={escolherArquivo}
              disabled={enviando}
              title="Clique pra trocar a logo"
            >
              <img src={dados.url} alt="Logo" />
            </button>
            <div className="logo-card-instrucao">
              {enviando ? '⏳ Enviando...' : 'Clique na logo para trocar.'}
            </div>
            <button
              type="button"
              className="logo-btn-usar"
              onClick={escolherArquivo}
              disabled={enviando}
            >
              Usar Logo
            </button>
          </div>

          {/* Header: "Escolha o melhor fundo" + ? icon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#fff', fontWeight: 700 }}>Escolha o melhor fundo</h3>
            <span
              title="Sua logo aparece sobre a capa do encarte. Escolha o tipo de fundo que dê melhor contraste com sua logo."
              style={{
                background: '#fbbf24', color: '#000', borderRadius: '50%',
                width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, cursor: 'help', flexShrink: 0,
              }}
            >?</span>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 0, marginBottom: 12, lineHeight: 1.4 }}>
            Escolha em qual tipo de fundo sua logo fica melhor.
          </p>

          {/* Grid com 5 cards de fundo (Escuro/Claro × Quadrado/Redondo + Sem Fundo) */}
          <div className="logo-fundos-cards">
            {FUNDOS.map(f => {
              const ativo = dados.fundoTipo === f.id;
              const ehRedondo = f.shape === 'circle';
              const ehSemFundo = f.shape === 'none';
              // Estilo do preview: cor de fundo + borda da cor do tema
              const previewStyle = {
                ...(f.bg !== 'transparent' ? { background: f.bg } : {}),
                ...(ehRedondo ? { borderRadius: '50%' } : {}),
                ...(ehSemFundo ? {} : { border: `3px solid ${corBorda}` }),
              };
              return (
                <div key={f.id} className={`logo-fundo-card ${ativo ? 'ativo' : ''}`}>
                  <div
                    className="logo-fundo-preview"
                    style={previewStyle}
                  >
                    <img src={dados.url} alt={f.label} />
                  </div>
                  <div className="logo-fundo-label">{f.label}</div>
                  <button
                    type="button"
                    className="logo-fundo-selecionar"
                    onClick={() => salvar({ ...dados, fundoTipo: f.id })}
                  >
                    {ativo ? '✓ Selecionado' : 'Selecionar'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Botão remover logo (discreto) */}
          <button type="button" className="logo-btn-remover" onClick={remover}>
            🗑 Remover logo
          </button>
        </>
      )}

      {urlPendente && (
        <ModalRecortarLogo
          urlOriginal={urlPendente}
          aoFechar={() => setUrlPendente('')}
          aoSalvar={(novaUrl) => salvar({ ...dados, url: novaUrl })}
          fetchAuth={fetchAuth}
        />
      )}
    </div>
  );
}
