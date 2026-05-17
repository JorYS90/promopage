import { useState, useEffect } from 'react';

// Modal grande pra trocar a cor de fundo do card de produto.
// Layout: [prévia ao vivo do card] | [opções de aplicação + paleta + transparência]
//
// Props:
//   produto: produto sendo editado
//   idx: índice
//   produtos: lista completa (pra aplicar em vários)
//   aoMudar: (idx, novosDados) — atualiza um produto
//   aoMudarMultiplos: (filtro, novosDados) — atualiza vários (filtro é função (p, i) => bool)
//   aoFechar: fecha modal

// Tipos especiais (linha 1 da paleta)
const TIPOS_ESPECIAIS = [
  { id: 'padrao-branco', nome: 'Padrão',     bgClass: 'bg-padrao-branco', textColor: '#1f2937' },
  { id: 'padrao-preto',  nome: 'Padrão',     bgClass: 'bg-padrao-preto',  textColor: '#ffffff' },
  { id: 'sem-fundo',     nome: 'Sem Fundo',  bgClass: 'bg-sem-fundo',     textColor: '#1f2937' },
];

// Paleta organizada em GRUPOS por família, cada uma com 30+ tons.
// Cada família vai do mais CLARO ao mais ESCURO + variações (pastel, neon, vibrante).
const PALETA_GRUPOS = [
  {
    familia: '☀️ Amarelos',
    cores: [
      '#fef9e7', '#fef9c3', '#fef3c7', '#fef08a', '#fde68a',
      '#fde047', '#fcd34d', '#facc15', '#fbbf24', '#f59e0b',
      '#eab308', '#d97706', '#ca8a04', '#b45309', '#a16207',
      '#854d0e', '#fff7d0', '#ffe066', '#ffd43b', '#ffc107',
      '#ffb300', '#ffa000', '#fcec85', '#f0d264', '#d4a017',
      '#b8860b', '#daa520', '#f7df8c', '#fbeebd', '#f0e68c',
    ],
  },
  {
    familia: '🍊 Laranjas',
    cores: [
      '#fff3e6', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c',
      '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12',
      '#ffe0b5', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800',
      '#fb8c00', '#f57c00', '#ef6c00', '#e65100', '#ffac4f',
      '#ff8a00', '#ff7300', '#d2691e', '#cd853f', '#ff7f50',
      '#ff6347', '#f4a460', '#ffa07a', '#fa8072', '#e9967a',
    ],
  },
  {
    familia: '🔴 Vermelhos',
    cores: [
      '#fff5f5', '#fee2e2', '#fecaca', '#fca5a5', '#f87171',
      '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
      '#ef0000', '#e60023', '#d50000', '#c62828', '#b71c1c',
      '#ff5252', '#ff1744', '#f44336', '#e53935', '#d32f2f',
      '#c10015', '#af1e2d', '#960018', '#800020', '#722f37',
      '#ff6b6b', '#ee5253', '#cc2222', '#a01818', '#8b0000',
    ],
  },
  {
    familia: '💗 Rosas / Magentas',
    cores: [
      '#fff0f7', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
      '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843',
      '#ff5e9b', '#ff66cc', '#ff007f', '#e91e63', '#c2185b',
      '#ad1457', '#880e4f', '#ffd0e0', '#ffb6c1', '#ff69b4',
      '#ff1493', '#db7093', '#c71585', '#ff00ff', '#d100b5',
      '#b8138e', '#f43f5e', '#fda4af', '#fb7185', '#e11d48',
    ],
  },
  {
    familia: '💜 Roxos / Violetas',
    cores: [
      '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc',
      '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87',
      '#3b0764', '#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa',
      '#9c27b0', '#ab47bc', '#ba68c8', '#ce93d8', '#e1bee7',
      '#4527a0', '#5e35b1', '#673ab7', '#7e57c2', '#9575cd',
      '#b39ddb', '#d1c4e9', '#6f42c1', '#8a2be2', '#9370db',
    ],
  },
  {
    familia: '🌊 Azuis',
    cores: [
      '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa',
      '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
      '#172554', '#0d47a1', '#1565c0', '#1976d2', '#1e88e5',
      '#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb',
      '#283593', '#303f9f', '#3949ab', '#3f51b5', '#5c6bc0',
      '#7986cb', '#9fa8da', '#c5cae9', '#4169e1', '#002fa7',
    ],
  },
  {
    familia: '🩵 Cianos / Turquesas',
    cores: [
      '#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee',
      '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#5eead4',
      '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a',
      '#006064', '#00838f', '#0097a7', '#00acc1', '#00bcd4',
      '#26c6da', '#4dd0e1', '#80deea', '#b2ebf2', '#e0f7fa',
      '#00695c', '#00796b', '#009688', '#20c997', '#5dd0c0',
    ],
  },
  {
    familia: '🌿 Verdes',
    cores: [
      '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
      '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
      '#052e16', '#1b5e20', '#2e7d32', '#388e3c', '#43a047',
      '#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9',
      '#33691e', '#558b2f', '#689f38', '#7cb342', '#8bc34a',
      '#9ccc65', '#aed581', '#c5e1a5', '#228b22', '#006400',
    ],
  },
  {
    familia: '🍫 Marrons / Terras',
    cores: [
      '#fff8f3', '#f5e6d3', '#e8d5b7', '#d4a574', '#c19a6b',
      '#b08968', '#a0764c', '#92400e', '#78350f', '#451a03',
      '#5d4037', '#4e342e', '#3e2723', '#6d4c41', '#795548',
      '#8d6e63', '#a1887f', '#bcaaa4', '#d7ccc8', '#efebe9',
      '#8b4513', '#a52a2a', '#6f4e37', '#964b00', '#826644',
      '#5e2612', '#704214', '#c87533', '#b87333', '#cd7f32',
    ],
  },
  {
    familia: '⚫ Neutros / Cinzas',
    cores: [
      '#ffffff', '#fafafa', '#f5f5f5', '#f3f4f6', '#f0f0f0',
      '#e5e7eb', '#e0e0e0', '#d4d4d4', '#d1d5db', '#c4c4c4',
      '#a3a3a3', '#9ca3af', '#8a8a8a', '#737373', '#6b7280',
      '#525252', '#4b5563', '#404040', '#374151', '#262626',
      '#1f2937', '#171717', '#111827', '#0a0a0a', '#000000',
      '#708090', '#696969', '#2f4f4f', '#36454f', '#555555',
    ],
  },
];

// Aplicar em (radio)
const APLICAR_OPCOES = [
  { id: 'destaques', label: 'Aplicar aos destaques' },
  { id: 'posicao',   label: 'Aplicar à posição' },
  { id: 'produto',   label: 'Aplicar ao produto' },
  { id: 'encarte',   label: 'Aplicar ao encarte' },
];

export default function ModalCorFundo({
  produto, idx, produtos,
  aoMudar, aoMudarMultiplos,
  aoFechar,
}) {
  // Estado inicial: o que o produto já tem
  const [tipo, setTipo] = useState(produto.corFundoTipo || 'cor');
  const [cor, setCor] = useState(produto.corFundoCustom || '#fde047');
  const [transparencia, setTransparencia] = useState(produto.corFundoTransparencia ?? 100);
  const [aplicarEm, setAplicarEm] = useState('produto');

  // Cor do texto (nome do produto) calculada automaticamente pra ter contraste
  // máximo com a cor de fundo escolhida (preto sobre claro, branco sobre escuro).
  // Calculada via luminância YIQ.
  const corTexto = (() => {
    if (tipo === 'sem-fundo') return '#1f2937';   // canvas é branco → texto escuro
    if (tipo === 'padrao-branco') return '#1f2937';
    if (tipo === 'padrao-preto') return '#ffffff';
    return textoSobreCor(cor);
  })();

  const escolherEspecial = (especialId) => {
    setTipo(especialId);
    if (especialId === 'padrao-branco') setCor('#ffffff');
    else if (especialId === 'padrao-preto') setCor('#000000');
    // 'sem-fundo' não mexe na cor — usa transparente
  };

  const escolherCor = (hex) => {
    setTipo('cor');
    setCor(hex);
  };

  const resetar = () => {
    setTipo('cor');
    setCor('');
    setTransparencia(100);
  };

  const salvar = () => {
    // IMPORTANTE: salva também a corTextoCustom calculada por contraste.
    // Isso faz o nome do produto se ajustar automaticamente pra ficar legível.
    const novosDados = {
      corFundoTipo: tipo,
      corFundoCustom: tipo === 'sem-fundo' ? '' : cor,
      corFundoTransparencia: transparencia,
      corTextoCustom: corTexto,
    };
    if (aplicarEm === 'encarte') {
      aoMudarMultiplos(() => true, novosDados);
    } else if (aplicarEm === 'destaques') {
      // Destaques são tipicamente os 2 primeiros produtos no layout assimétrico
      aoMudarMultiplos((p, i) => i < 2, novosDados);
    } else if (aplicarEm === 'posicao') {
      // Mesma "posição" no grid: produtos com mesmo idx % 2 (par/ímpar)
      const meuMod = idx % 2;
      aoMudarMultiplos((p, i) => i % 2 === meuMod, novosDados);
    } else {
      // Apenas esse produto
      aoMudar(idx, { ...produto, ...novosDados });
    }
    aoFechar();
  };

  // Estilo computado da prévia do card (ao vivo)
  const corPreview = (() => {
    if (tipo === 'sem-fundo') return 'transparent';
    if (transparencia < 100) {
      return hexToRgba(cor, transparencia / 100);
    }
    return cor;
  })();

  const preview = (
    <div className="cf-preview-card" style={{ background: corPreview }}>
      {/* Nome do produto na cor calculada (contraste automático) */}
      <div className="cf-preview-nome" style={{ color: corTexto }}>
        {(produto.nome || 'PRODUTO').toUpperCase()}
      </div>
      {produto.imagem && (
        <img src={produto.imagem} alt={produto.nome} className="cf-preview-img" />
      )}
      {/* Tag mock */}
      <div className="cf-preview-tag">
        <span className="cf-pt-rs">R$</span>
        <span className="cf-pt-valor">{produto.preco || '13,99'}</span>
        {produto.unidadeAbrev && (
          <span className="cf-pt-un">{produto.unidadeAbrev.toUpperCase()}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-cor-fundo" onClick={e => e.stopPropagation()}>
        <button className="cf-fechar" onClick={aoFechar} aria-label="Fechar">✕</button>

        <div className="cf-grid">
          {/* COLUNA ESQUERDA: prévia ao vivo */}
          <div className="cf-preview">
            <div className="cf-preview-wrap">{preview}</div>
          </div>

          {/* COLUNA DIREITA: opções */}
          <div className="cf-opcoes">
            {/* Aplicar em */}
            <div className="cf-secao">
              <div className="cf-titulo">Aplicar em:</div>
              {APLICAR_OPCOES.map(opt => (
                <label key={opt.id} className="cf-radio">
                  <input
                    type="checkbox"
                    checked={aplicarEm === opt.id}
                    onChange={() => setAplicarEm(opt.id)}
                  />
                  <span>{opt.label}</span>
                  {opt.id === 'encarte' && (
                    <button
                      type="button"
                      className="cf-resetar"
                      onClick={(e) => { e.preventDefault(); resetar(); }}
                    >
                      ✕ Resetar
                    </button>
                  )}
                </label>
              ))}
            </div>

            {/* Cor de fundo */}
            <div className="cf-secao">
              <div className="cf-titulo">Cor de Fundo:</div>
              <div className="cf-paleta-wrap">
                {/* Tipos especiais — sempre no topo, fora dos grupos */}
                <div className="cf-paleta-especiais">
                  {TIPOS_ESPECIAIS.map(esp => (
                    <button
                      key={esp.id}
                      className={`cf-cor cf-cor-especial ${esp.bgClass} ${tipo === esp.id ? 'ativo' : ''}`}
                      onClick={() => escolherEspecial(esp.id)}
                      style={{ color: esp.textColor }}
                    >
                      <span className="cf-cor-label">{esp.nome}</span>
                    </button>
                  ))}
                </div>

                {/* Grupos por família, cada um com cabeçalho sticky */}
                {PALETA_GRUPOS.map((grupo) => (
                  <div key={grupo.familia} className="cf-grupo">
                    <div className="cf-grupo-header">
                      {grupo.familia}
                      <span className="cf-grupo-contador">{grupo.cores.length}</span>
                    </div>
                    <div className="cf-grupo-grid">
                      {grupo.cores.map((hex, i) => (
                        <button
                          key={`${hex}-${i}`}
                          className={`cf-cor ${tipo === 'cor' && cor === hex ? 'ativo' : ''}`}
                          style={{ background: hex }}
                          onClick={() => escolherCor(hex)}
                          title={hex}
                        >
                          <span
                            className="cf-cor-label"
                            style={{ color: textoSobreCor(hex) }}
                          >Texto</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transparência */}
            <div className="cf-secao">
              <div className="cf-titulo">Transparência:</div>
              <div className="cf-slider-wrap">
                <input
                  type="range"
                  min="0" max="100"
                  value={transparencia}
                  onChange={e => setTransparencia(parseInt(e.target.value, 10))}
                  className="cf-slider"
                />
                <span className="cf-slider-val">{transparencia}%</span>
              </div>
            </div>

            {/* Salvar */}
            <button className="cf-btn-salvar" onClick={salvar}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

// Converte hex (#rrggbb) pra rgba(r, g, b, a)
function hexToRgba(hex, alpha) {
  const m = (hex || '').replace('#', '');
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Decide se texto sobreposto à cor deve ser branco ou preto (baseado em luminância)
function textoSobreCor(hex) {
  const m = (hex || '').replace('#', '');
  if (m.length !== 6) return '#000';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // Luminância YIQ
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#1f2937' : '#ffffff';
}
