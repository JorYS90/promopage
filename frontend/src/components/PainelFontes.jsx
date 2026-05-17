import { useEffect, useMemo, useState } from 'react';
import { FONTES, FONTE_TARGETS, carregarTodasFontes, carregarFontesGoogle } from './fontes-catalogo.js';

const STORAGE_KEY = 'encarte-builder:fontes';

const DADOS_VAZIOS = {
  // Cada chave = um target (nome, preco, frase, rodape) → font ID
  nome:   'Anton',
  preco:  'Helvetica Neue',
  frase:  'Arial',
  rodape: 'Arial',
};

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DADOS_VAZIOS;
    return { ...DADOS_VAZIOS, ...JSON.parse(raw) };
  } catch {
    return DADOS_VAZIOS;
  }
}

export default function PainelFontes({ aoAtualizar }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);
  // Targets selecionados pra aplicar a próxima fonte (checkboxes)
  const [targetsSelecionados, setTargetsSelecionados] = useState(new Set());
  // Filtros do dropdown
  const [filtroPeso, setFiltroPeso] = useState('Todos');
  const [filtroEstilo, setFiltroEstilo] = useState('Todos');
  const [filtroNome, setFiltroNome] = useState('');

  useEffect(() => {
    const inicial = carregar();
    setDados(inicial);
    aoAtualizar?.(inicial);
    // Pré-carrega fontes do Google pra preview
    carregarTodasFontes();
  }, []);

  const salvar = (novo) => {
    setDados(novo);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(novo)); } catch {}
    aoAtualizar?.(novo);
  };

  // Toggle de checkbox (target)
  const toggleTarget = (key) => {
    setTargetsSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(key)) novo.delete(key);
      else novo.add(key);
      return novo;
    });
  };

  // Aplica fonte aos targets marcados.
  // IMPORTANTE: aguarda a fonte do Google carregar ANTES de salvar — assim o re-render
  // do canvas mede com a fonte correta e o auto-shrink funciona certinho.
  const aplicarFonte = async (fontId) => {
    if (targetsSelecionados.size === 0) {
      alert('Marque pelo menos um item (checkbox) antes de escolher uma fonte.');
      return;
    }
    // Garante que o CSS da fonte foi injetado
    carregarFontesGoogle([fontId]);
    // Aguarda a fonte estar disponível pra medição (até 2s)
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([
          document.fonts.load(`900 32px "${fontId}"`),
          new Promise(r => setTimeout(r, 2000)),
        ]);
      }
    } catch {}
    const novo = { ...dados };
    targetsSelecionados.forEach(key => { novo[key] = fontId; });
    salvar(novo);
  };

  // Lista filtrada
  const fontesFiltradas = useMemo(() => {
    return FONTES.filter(f => {
      if (filtroEstilo !== 'Todos' && f.estilo !== filtroEstilo) return false;
      if (filtroPeso !== 'Todos' && String(f.peso) !== filtroPeso) return false;
      if (filtroNome && !f.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
      return true;
    });
  }, [filtroEstilo, filtroPeso, filtroNome]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Opções fontes</h2>
        <span
          title="Marque os itens que quer alterar e depois clique numa fonte da lista pra aplicá-la a todos eles."
          style={{
            background: '#fbbf24', color: '#000', borderRadius: '50%',
            width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, cursor: 'help', flexShrink: 0,
          }}
        >?</span>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 0, marginBottom: 14, lineHeight: 1.4 }}>
        Altere o par de fontes dos produtos do seu encarte ou cartaz.
      </p>

      {/* Filtros */}
      <div className="fontes-filtros">
        <div className="fonte-filtro">
          <label>Peso:</label>
          <select value={filtroPeso} onChange={e => setFiltroPeso(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="400">Regular</option>
            <option value="700">Bold</option>
            <option value="800">Extra Bold</option>
            <option value="900">Black</option>
          </select>
        </div>
        <div className="fonte-filtro">
          <label>Estilo:</label>
          <select value={filtroEstilo} onChange={e => setFiltroEstilo(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="condensada">Condensada</option>
            <option value="bold">Bold/Display</option>
            <option value="redonda">Sans-serif</option>
            <option value="serif">Serif</option>
            <option value="script">Script</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div className="fonte-filtro">
          <label>Nome:</label>
          <input
            type="text"
            value={filtroNome}
            onChange={e => setFiltroNome(e.target.value)}
            placeholder="Buscar..."
          />
        </div>
      </div>

      {/* Targets (checkboxes) */}
      <div className="fonte-targets">
        <div className="fonte-targets-titulo">Marque os itens para alterar.</div>
        {FONTE_TARGETS.map(t => {
          const fontAtual = dados[t.key] || t.padrao;
          const ativo = targetsSelecionados.has(t.key);
          return (
            <label key={t.key} className="fonte-target-linha">
              <input
                type="checkbox"
                checked={ativo}
                onChange={() => toggleTarget(t.key)}
              />
              <span className="fonte-target-label">{t.label}</span>
              <span className="fonte-target-atual">{fontAtual}</span>
            </label>
          );
        })}
      </div>

      {/* Lista de fontes (cards de preview) */}
      <div className="fontes-lista">
        {fontesFiltradas.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 20 }}>
            Nenhuma fonte encontrada com esses filtros.
          </div>
        )}
        {fontesFiltradas.map(f => (
          <button
            key={f.id}
            type="button"
            className="fonte-card"
            onClick={() => aplicarFonte(f.id)}
          >
            <div className="fonte-card-header">
              <span className="fonte-card-nome">{f.nome}</span>
              <span className="fonte-card-info">
                <span className="fonte-card-peso">{f.peso}</span>
                <span className="fonte-card-estilo">normal</span>
              </span>
            </div>
            <div
              className="fonte-card-preview"
              style={{ fontFamily: `"${f.id}", sans-serif`, fontWeight: f.peso }}
            >
              FILE PEITO
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
