import { useState, useRef, useEffect } from 'react';

// Menu flutuante de 4 ações que aparece quando o usuário passa o mouse
// sobre um card de produto no canvas.
//
// Comportamento:
// - Cada ação é um ícone redondo
// - Ao passar mouse no ícone, ele EXPANDE pra mostrar o label
// - Click no ícone abre um popover ou modal pra configurar a ação
//
// Posicionamento: top-left do card (em coords de tela, position: fixed)
//
// Props:
//   posicao: { x, y } — coordenadas de tela do canto superior esquerdo do card
//   produto: o produto atual
//   idx: índice do produto na lista
//   aoMudarProduto: callback (idx, novosDados) pra atualizar o produto
//   aoAbrirEditor: callback (idx) pra abrir o ModalEditarProdutos focado nesse produto
//   onMouseEnter / onMouseLeave: pra cancelar/disparar timer de hide do overlay

const ACOES = [
  { id: 'cor',      icone: '🎨', label: 'Trocar Cor de fundo' },
  { id: 'preco',    icone: '⚙',  label: 'Opções de Preço' },
  { id: 'etiqueta', icone: '🏷', label: 'Etiqueta' },
  { id: 'desconto', icone: '🎟', label: 'Balão de desconto' },
];

export default function OverlayProduto({
  posicao,
  produto,
  idx,
  aoMudarProduto,
  aoAbrirEditor,
  aoAbrirCorFundo,    // dispara modal grande de cor
  aoAbrirEtiqueta,    // dispara modal grande de etiqueta (balão de oferta)
  onMouseEnter,
  onMouseLeave,
}) {
  const [popoverAberto, setPopoverAberto] = useState(null); // 'desconto' | null
  const containerRef = useRef(null);

  // Fecha popover ao mudar de produto
  useEffect(() => {
    setPopoverAberto(null);
  }, [idx]);

  if (!posicao || !produto) return null;

  const aoClicar = (acaoId) => {
    if (acaoId === 'preco') {
      aoAbrirEditor?.(idx);
      return;
    }
    if (acaoId === 'cor') {
      aoAbrirCorFundo?.(idx);
      return;
    }
    if (acaoId === 'etiqueta') {
      aoAbrirEtiqueta?.(idx);
      return;
    }
    // Outros toggle popover (desconto)
    setPopoverAberto(prev => prev === acaoId ? null : acaoId);
  };

  return (
    <div
      ref={containerRef}
      className="overlay-produto"
      style={{
        position: 'fixed',
        left: posicao.x + 8,
        top: posicao.y + 8,
        zIndex: 50,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="op-icones">
        {ACOES.map(a => (
          <button
            key={a.id}
            className={`op-btn ${popoverAberto === a.id ? 'ativo' : ''}`}
            onClick={() => aoClicar(a.id)}
            title={a.label}
          >
            <span className="op-icone">{a.icone}</span>
            <span className="op-label">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Popover de balão de desconto */}
      {popoverAberto === 'desconto' && (
        <div className="op-popover">
          <div className="op-pop-header">🎟 Balão de desconto</div>
          <div className="op-pop-campo">
            <label>Percentual</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                min="0" max="99" step="1"
                value={produto.desconto?.percentual || ''}
                onChange={e => {
                  const v = e.target.value;
                  aoMudarProduto(idx, {
                    ...produto,
                    desconto: v ? { percentual: parseInt(v, 10) } : null,
                  });
                }}
                placeholder="20"
                style={{ width: 80 }}
              />
              <span style={{ fontWeight: 'bold', fontSize: 18, color: '#374151' }}>% OFF</span>
            </div>
          </div>
          {produto.desconto?.percentual ? (
            <button
              className="op-pop-btn-reset"
              onClick={() => aoMudarProduto(idx, { ...produto, desconto: null })}
            >
              ✕ Remover desconto
            </button>
          ) : (
            <div className="op-pop-dica">
              💡 Aparece como uma estrela amarela no canto do produto.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
