// Sistema de grades nomeadas: cada layout tem id, nome e estrutura de boxes.
// Permite escolher disposições específicas (ex: "5 produtos + 1 destaque esquerdo").

// Helper: gera grade simétrica simples (cols × rows, todos boxes 1x1)
function gradeSimples(cols, rows, quantidade = cols * rows) {
  const boxes = [];
  let count = 0;
  for (let r = 0; r < rows && count < quantidade; r++) {
    for (let c = 0; c < cols && count < quantidade; c++) {
      boxes.push({ col: c, row: r, colSpan: 1, rowSpan: 1 });
      count++;
    }
  }
  return { cols, rows, boxes };
}

// Registro de TODAS as grades disponíveis no dropdown.
// Cada entrada: { id, nome, quantidade, cols, rows, boxes, tipo? }
// tipo === 'lista' = tabela horizontal (renderizada diferente)
export const LAYOUTS_NOMEADOS = [
  // Auto
  { id: 'automatico', nome: 'Automático' },

  // === GRADES SIMPLES (1-4) ===
  // 1x1 usa layoutTipo "destaque-maximo": foto grande no topo, nome bottom-left, tag bottom-right
  { id: 'g_1x1', nome: '1 Produto - 1x1', quantidade: 1, cols: 1, rows: 1,
    multValor: 1.20,   // valor 20% maior que o padrão
    multNome: 0.95,    // nome -5%
    multBalao: 1.05,   // balão +5%
    boxes: [{ col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'destaque-maximo' }] },
  { id: 'g_2x1',  nome: '2 Produtos - 2x1', quantidade: 2,
    cols: 2, rows: 1, boxes: [
      // Estilo qrofertas: card branco + nome topo + foto centro grande + banner vermelho fundo
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner' },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner' },
    ],
    // BASE — usado quando o modelo não tem override em perModelo
    multFoto: 0.88,   // foto +10%
    multBalao: 1.22,  // balão
    multNome: 0.82,   // nome -10%
    // Overrides per-modelo (só lista o que muda; resto herda do base)
    perModelo: {
      STORIES: {
        // Acumulado: +18% foto, +10% balão, -15% nome, nome deslocado pra baixo
        multFoto: 1.12,        // 0.88 base, foto cresceu pro stories
        multBalao: 1.34,       // 1.22 base * 1.10
        multNome: 0.70,        // 0.82 base, nome menor
        nomeOffsetTop: 0.35,   // empurra nome ~35% da nomeAreaH pra baixo
      },
      REELS_INSTAGRAM: {
        nomeOffsetTop: 0.20,   // nome um pouco mais pra baixo
      },
      ENCARTE_GRANDE: {
        nomeOffsetTop: 0.20,   // nome um pouco mais pra baixo
        multFoto: 1.01,        // 0.88 base +15%
      },
    },
  },
  // 2 produtos empilhados verticalmente (ideal pra stories/portrait)
  // Estilo qrofertas: foto à esquerda, nome topo direita, banner vermelho fundo direita
  { id: 'g_1x2', nome: '2 Produtos - 1x2', quantidade: 2,
    apenasFormatos: ['STORIES'],
    cols: 1, rows: 2, boxes: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h' },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h' },
    ],
    multFoto: 1.19,   // 0.85 → 1.19 (+40%)
    multNome: 1.25,   // 1.0 → 1.25 (+25%)
    multBalao: 1.25,  // 1.0 → 1.25 (+25%, "ajusta balão pra preencher mais")
  },
  // 3 produtos empilhados verticalmente (stories) — estilo qrofertas:
  // card amarelo full-width, foto à esquerda, nome topo-direita, balão vermelho grande bottom-direita
  { id: 'g_1x3', nome: '3 Produtos - 1x3', quantidade: 3,
    apenasFormatos: ['STORIES'],
    cols: 1, rows: 3, boxes: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h' },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h' },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h' },
    ],
    multFoto: 1.10,
    multNome: 1.15,
    multBalao: 1.20,
    nomeOffsetTop: 0.12,  // Pedido do cliente (STORIES): nome dos produtos um pouco mais baixo
  },
  { id: 'g_3x1',  nome: '3 Produtos - 3x1', quantidade: 3,
    excluirFormatos: ['STORIES'],  // STORIES usa g_1x3 (1×3 empilhado)
    cols: 3, rows: 1, boxes: [
      // Cards estreitos: card-banner (nome topo, foto centro, balão GRANDE no fundo — estilo qrofertas)
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner' },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner' },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner' },
    ],
    multFoto: 1.05,   // foto
    multNome: 0.65,   // nome
    multBalao: 1.08,  // balão
    perModelo: {
      REELS_INSTAGRAM: {
        nomeOffsetTop: 0.20,   // nome um pouco mais pra baixo
      },
      ENCARTE_GRANDE: {
        nomeOffsetTop: 0.20,   // nome um pouco mais pra baixo
        multFoto: 1.16,        // 1.05 base +10%
      },
    },
  },
  { id: 'g_2x2',  nome: '4 Produtos - 2x2', quantidade: 4,
    cols: 2, rows: 2, boxes: [
      // Estilo qrofertas (default): NOME TOPO full-width + FOTO esquerda + BALÃO direita
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo',
        multBalao: 1.30, multValor: 0.94, multNome: 0.72, multFoto: 1.38,
        // STORIES: usa renderer padrão (nome topo + foto centro + balão pílula embaixo,
        // estilo qrofertas que casa melhor com cards verticais altos do stories)
        perModelo: {
          STORIES: { layoutTipo: null, multBalao: 0.89, multValor: 1.0, multNome: 3.25, multFoto: 0.86, nomeOffsetTop: 0.10 },
          REELS_INSTAGRAM: { multFoto: 1.79, multNome: 0.70, multBalao: 0.89, multValor: 1.0, balaoFixo: true, balaoAlignX: 1 },
          ENCARTE_GRANDE: { multFoto: 1.59, fotoOffsetX: 0.20 },
          // Pedido do cliente: nome um pouco mais pra cima só no FACEBOOK_QUADRADO
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.5 },
        },
      },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo',
        multBalao: 1.30, multValor: 0.94, multNome: 0.72, multFoto: 1.38,
        perModelo: {
          STORIES: { layoutTipo: null, multBalao: 0.89, multValor: 1.0, multNome: 3.25, multFoto: 0.86, nomeOffsetTop: 0.10 },
          REELS_INSTAGRAM: { multFoto: 1.79, multNome: 0.70, multBalao: 0.89, multValor: 1.0, balaoFixo: true, balaoAlignX: 1 },
          ENCARTE_GRANDE: { multFoto: 1.59, fotoOffsetX: 0.20 },
          // Pedido do cliente: nome um pouco mais pra cima só no FACEBOOK_QUADRADO
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.5 },
        },
      },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo',
        multBalao: 1.30, multValor: 0.94, multNome: 0.72, multFoto: 1.38,
        perModelo: {
          STORIES: { layoutTipo: null, multBalao: 0.89, multValor: 1.0, multNome: 3.25, multFoto: 0.86, nomeOffsetTop: 0.10 },
          REELS_INSTAGRAM: { multFoto: 1.79, multNome: 0.70, multBalao: 0.89, multValor: 1.0, balaoFixo: true, balaoAlignX: 1 },
          ENCARTE_GRANDE: { multFoto: 1.59, fotoOffsetX: 0.20 },
          // Pedido do cliente: nome um pouco mais pra cima só no FACEBOOK_QUADRADO
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.5 },
        },
      },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo',
        multBalao: 1.30, multValor: 0.94, multNome: 0.72, multFoto: 1.38,
        perModelo: {
          STORIES: { layoutTipo: null, multBalao: 0.89, multValor: 1.0, multNome: 3.25, multFoto: 0.86, nomeOffsetTop: 0.10 },
          REELS_INSTAGRAM: { multFoto: 1.79, multNome: 0.70, multBalao: 0.89, multValor: 1.0, balaoFixo: true, balaoAlignX: 1 },
          ENCARTE_GRANDE: { multFoto: 1.59, fotoOffsetX: 0.20 },
          // Pedido do cliente: nome um pouco mais pra cima só no FACEBOOK_QUADRADO
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.5 },
        },
      },
    ]},

  // === 5 PRODUTOS ===
  { id: 'g_5_dest_esq', nome: '5 Produtos - 4 produtos + 1 destaque Esquerdo', quantidade: 5,
    // STORIES → g_5_dest_esq_stories (35%), REELS → g_5_dest_esq_reels (44%), ENCARTE_GRANDE → g_5_dest_esq_encarte (42.5%)
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM', 'ENCARTE_GRANDE'],
    // Destaque -10% de LARGURA (45% em vez de 50%). Grid cols=40: destaque=18 (45%),
    // 4 produtos = 2 colunas de 11 (27.5% cada). Pedido do cliente.
    cols: 40, rows: 2, boxes: [
      // Destaque grande à ESQUERDA (45%): nome reduzido, balão +15%
      { col: 0, row: 0, colSpan: 18, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.39, multValor: 1.0, multBalao: 1.15,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      // 4 produtos pequenos à direita (2 colunas de 27.5%)
      { col: 18, row: 0, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      { col: 29, row: 0, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      { col: 18, row: 1, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      { col: 29, row: 1, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
    ]},
  // Variante STORIES do g_5_dest_esq: destaque com 42.5% de largura (15% menor que
  // os 50% do original). Grid em cols=80 pra granularidade fina sem afetar layout.
  { id: 'g_5_dest_esq_stories', nome: '5 Produtos - 4 produtos + 1 destaque Esquerdo', quantidade: 5,
    apenasFormatos: ['STORIES'],
    cols: 80, rows: 2, boxes: [
      // Destaque à esquerda: colSpan 28 = 35% (cumulativo -30% vs g_5_dest_esq 50%)
      // foto +10%, nome deslocado pra baixo pra preencher melhor
      // Pedido do cliente (STORIES): nome do destaque +60% e depois +40% (≈ 0.87)
      { col: 0, row: 0, colSpan: 28, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.87, multValor: 1.0, multBalao: 1.15, multFoto: 1.21, nomeOffsetTop: 0.30 },
      // 4 produtos pequenos à direita: colSpan 26 cada (32.5% cada), 2 cols × 2 rows
      // Pedido do cliente (STORIES): nome dos 4 produtos um pouco mais alto (0.30 → 0.20)
      { col: 28, row: 0, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      { col: 54, row: 0, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      { col: 28, row: 1, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      { col: 54, row: 1, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
    ]},
  // Variante ENCARTE_GRANDE: destaque com 42.5% de largura (15% menor que 50% original).
  { id: 'g_5_dest_esq_encarte', nome: '5 Produtos - 4 produtos + 1 destaque Esquerdo', quantidade: 5,
    apenasFormatos: ['ENCARTE_GRANDE'],
    cols: 80, rows: 2, boxes: [
      // Destaque à esquerda: colSpan 34 = 42.5% (era 50% no g_5_dest_esq → -15%)
      { col: 0, row: 0, colSpan: 34, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.39, multValor: 1.0, multBalao: 1.15, nomeOffsetTop: 0.20 },
      // 4 produtos pequenos à direita: colSpan 23 cada (28.75% cada)
      { col: 34, row: 0, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      { col: 57, row: 0, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      { col: 34, row: 1, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      { col: 57, row: 1, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
    ]},
  // Variante REELS_INSTAGRAM: destaque com 44% de largura (12% menor que 50% original).
  // Grid em cols=25 pra granularidade. Inclui nomeOffsetTop herdado da calibração anterior.
  { id: 'g_5_dest_esq_reels', nome: '5 Produtos - 4 produtos + 1 destaque Esquerdo', quantidade: 5,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 25, rows: 2, boxes: [
      // Destaque à esquerda: colSpan 11 = 44% (era 50% no g_5_dest_esq → -12%)
      { col: 0, row: 0, colSpan: 11, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.39, multValor: 1.0, multBalao: 1.15, nomeOffsetTop: 0.25 },
      // 4 produtos pequenos à direita: colSpan 7 cada (28% cada), 2 cols × 2 rows
      { col: 11, row: 0, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      { col: 18, row: 0, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      { col: 11, row: 1, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      { col: 18, row: 1, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
    ]},
  { id: 'g_5_dest_dir', nome: '5 Produtos - 4 produtos + 1 destaque Direito', quantidade: 5,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM', 'ENCARTE_GRANDE'],  // STORIES, REELS, ENCARTE_GRANDE usam variantes próprias
    // Destaque -10% de LARGURA (45% em vez de 50%) — espelho do g_5_dest_esq.
    // Grid cols=40: 4 produtos = 2 colunas de 11 (27.5%), destaque=18 (45%).
    cols: 40, rows: 2, boxes: [
      // 4 produtos pequenos à ESQUERDA (2 colunas de 27.5%)
      { col: 0, row: 0, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      { col: 11, row: 0, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      { col: 0, row: 1, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      { col: 11, row: 1, colSpan: 11, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
      // Destaque grande à DIREITA (45%): nome -20%
      { col: 22, row: 0, colSpan: 18, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.39, multValor: 1.0, multBalao: 1.15,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 } } },
    ]},
  // Variante STORIES do g_5_dest_dir: espelho do g_5_dest_esq_stories
  // (destaque colSpan 28 = 35%, foto +21%, nome deslocado pra baixo; 4 produtos colSpan 26 com foto +5%)
  { id: 'g_5_dest_dir_stories', nome: '5 Produtos - 4 produtos + 1 destaque Direito', quantidade: 5,
    apenasFormatos: ['STORIES'],
    cols: 80, rows: 2, boxes: [
      // 4 produtos pequenos à esquerda
      { col: 0, row: 0, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      { col: 26, row: 0, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      { col: 0, row: 1, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      { col: 26, row: 1, colSpan: 26, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.57, multValor: 1.0, multBalao: 1.45, multFoto: 1.11, nomeOffsetTop: 0.12 },
      // Destaque à DIREITA: colSpan 28 = 35%
      // Pedido do cliente (STORIES): mesmos ajustes do espelho esquerdo — nome do destaque ≈ +124% (0.39 → 0.87)
      { col: 52, row: 0, colSpan: 28, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.87, multValor: 1.0, multBalao: 1.15, multFoto: 1.21, nomeOffsetTop: 0.30 },
    ]},
  // Variante ENCARTE_GRANDE espelho de g_5_dest_esq_encarte (destaque à direita 42.5%)
  { id: 'g_5_dest_dir_encarte', nome: '5 Produtos - 4 produtos + 1 destaque Direito', quantidade: 5,
    apenasFormatos: ['ENCARTE_GRANDE'],
    cols: 80, rows: 2, boxes: [
      // 4 produtos à esquerda (28.75% cada, 2 cols × 2 rows)
      { col: 0, row: 0, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      { col: 23, row: 0, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      { col: 0, row: 1, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      { col: 23, row: 1, colSpan: 23, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.20 },
      // Destaque à DIREITA: colSpan 34 = 42.5%
      { col: 46, row: 0, colSpan: 34, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.39, multValor: 1.0, multBalao: 1.15, nomeOffsetTop: 0.20 },
    ]},
  // Variante REELS_INSTAGRAM espelho de g_5_dest_esq_reels (destaque à direita 44%)
  { id: 'g_5_dest_dir_reels', nome: '5 Produtos - 4 produtos + 1 destaque Direito', quantidade: 5,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 25, rows: 2, boxes: [
      // 4 produtos à esquerda (28% cada, 2 cols × 2 rows)
      { col: 0, row: 0, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      { col: 7, row: 0, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      { col: 0, row: 1, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      { col: 7, row: 1, colSpan: 7, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.65, multValor: 1.0, multBalao: 1.45, multFoto: 1.06, nomeOffsetTop: 0.25 },
      // Destaque à direita: colSpan 11 = 44%
      { col: 14, row: 0, colSpan: 11, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.39, multValor: 1.0, multBalao: 1.15, nomeOffsetTop: 0.25 },
    ]},

  // === 6 PRODUTOS ===
  { id: 'g_3x2', nome: '6 Produtos - 3x2', quantidade: 6,
    cols: 3, rows: 2, boxes: [
      // Estilo qrofertas: card-banner em todos. Conteúdo um pouco menor + balão maior
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.63, multValor: 1.0, multBalao: 1.68, multFoto: 1.25,
        perModelo: { STORIES: { nomeOffsetTop: 0.30 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.63, multValor: 1.0, multBalao: 1.68, multFoto: 1.25,
        perModelo: { STORIES: { nomeOffsetTop: 0.30 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.63, multValor: 1.0, multBalao: 1.68, multFoto: 1.25,
        perModelo: { STORIES: { nomeOffsetTop: 0.30 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.63, multValor: 1.0, multBalao: 1.68, multFoto: 1.25,
        perModelo: { STORIES: { nomeOffsetTop: 0.30 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.63, multValor: 1.0, multBalao: 1.68, multFoto: 1.25,
        perModelo: { STORIES: { nomeOffsetTop: 0.30 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner',
        multNome: 0.63, multValor: 1.0, multBalao: 1.68, multFoto: 1.25,
        perModelo: { STORIES: { nomeOffsetTop: 0.30 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
    ],
  },
  // Estilo qrofertas pra STORIES: 1 destaque full-width topo + 4 produtos 2×2 meio + 1 destaque full-width baixo
  { id: 'g_6_dest_topo_baixo_stories', nome: '6 Produtos - 1 destaque topo + 4 produtos + 1 destaque baixo',
    quantidade: 6,
    apenasFormatos: ['STORIES'],
    cols: 2, rows: 4, boxes: [
      // Destaque topo (full-width)
      { col: 0, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: true,
        multNome: 0.85, multValor: 1.0, multBalao: 1.60, multFoto: 1.10 },
      // 4 produtos 2×2 no meio (yellow cards)
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.30, multFoto: 1.0 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.30, multFoto: 1.0 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.30, multFoto: 1.0 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.30, multFoto: 1.0 },
      // Destaque baixo (full-width)
      { col: 0, row: 3, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: true,
        multNome: 0.85, multValor: 1.0, multBalao: 1.60, multFoto: 1.10 },
    ]},
  { id: 'g_6_2_dest_lat', nome: '6 Produtos - 4 produtos + 2 destaques laterais', quantidade: 6,
    excluirFormatos: ['STORIES'],  // grade horizontal — não combina com canvas vertical do stories
    // Grid de 8 cols pra dar destaques mais ESTREITOS (25% cada vs 33% antes).
    // Estilo qrofertas: destaques laterais finos + 4 produtos mais largos no meio.
    cols: 8, rows: 2, boxes: [
      // Destaque esquerdo (col 0-1, full height): destaque EXPLÍCITO
      { col: 0, row: 0, colSpan: 2, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.79, multValor: 1.0, multFoto: 1.17,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome mais baixo + foto melhor centralizada
          FACEBOOK_QUADRADO: { nomeOffsetTop: 0.22, fotoPosY: 0.55 } } },
      // 4 produtos no meio: destaque: false EXPLÍCITO — sem isso o auto-detect
      // (colSpan>1) marcava como destaque e aplicava boost 1.9 no nome.
      { col: 2, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.55, multValor: 1.0, multBalao: 1.50, multFoto: 1.09,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome maior + mais baixo + foto melhor centralizada
          FACEBOOK_QUADRADO: { multNome: 0.72, nomeOffsetTop: 0.22, fotoPosY: 0.60 } } },
      { col: 4, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.55, multValor: 1.0, multBalao: 1.50, multFoto: 1.09,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome maior + mais baixo + foto melhor centralizada
          FACEBOOK_QUADRADO: { multNome: 0.72, nomeOffsetTop: 0.22, fotoPosY: 0.60 } } },
      { col: 2, row: 1, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.55, multValor: 1.0, multBalao: 1.50, multFoto: 1.09,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome maior + mais baixo + foto melhor centralizada
          FACEBOOK_QUADRADO: { multNome: 0.72, nomeOffsetTop: 0.22, fotoPosY: 0.60 } } },
      { col: 4, row: 1, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.55, multValor: 1.0, multBalao: 1.50, multFoto: 1.09,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome maior + mais baixo + foto melhor centralizada
          FACEBOOK_QUADRADO: { multNome: 0.72, nomeOffsetTop: 0.22, fotoPosY: 0.60 } } },
      // Destaque direito (col 6-7, full height): destaque EXPLÍCITO
      { col: 6, row: 0, colSpan: 2, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.79, multValor: 1.0, multFoto: 1.17,
        perModelo: { REELS_INSTAGRAM: { nomeOffsetTop: 0.25 }, ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome mais baixo + foto melhor centralizada
          FACEBOOK_QUADRADO: { nomeOffsetTop: 0.22, fotoPosY: 0.55 } } },
    ]},

  // === 7 PRODUTOS ===
  { id: 'g_7_3_dest_topo', nome: '7 Produtos - 3 Destaques no topo e 4 produtos', quantidade: 7,
    excluirFormatos: ['STORIES'],
    cols: 12, rows: 4, boxes: [
      // 3 destaques no topo: destaque EXPLÍCITO (fundo vermelho)
      { col: 0, row: 0, colSpan: 4, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.36, multValor: 1.0, multBalao: 1.49, multFoto: 1.18,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome + balão do destaque maiores (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.62, multBalao: 1.70 } } },
      { col: 4, row: 0, colSpan: 4, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.36, multValor: 1.0, multBalao: 1.49, multFoto: 1.18,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome + balão do destaque maiores (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.62, multBalao: 1.70 } } },
      { col: 8, row: 0, colSpan: 4, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.36, multValor: 1.0, multBalao: 1.49, multFoto: 1.18,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome + balão do destaque maiores (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.62, multBalao: 1.70 } } },
      // 4 produtos embaixo: destaque: false EXPLÍCITO (fundo amarelo normal)
      { col: 0, row: 2, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.65, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      { col: 3, row: 2, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.65, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      { col: 6, row: 2, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.65, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      { col: 9, row: 2, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.65, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (espelho de g_7_4_prod_3_dest_baixo)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
    ]},
  { id: 'g_7_4_prod_3_dest_baixo', nome: '7 Produtos - 4 produtos e 3 destaques em baixo', quantidade: 7,
    excluirFormatos: ['STORIES'],
    cols: 12, rows: 4, boxes: [
      // 4 produtos no topo: destaque: false EXPLÍCITO (fundo amarelo normal)
      { col: 0, row: 0, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { multNome: 0.69, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (destaque chama mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      { col: 3, row: 0, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { multNome: 0.69, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (destaque chama mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      { col: 6, row: 0, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { multNome: 0.69, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (destaque chama mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      { col: 9, row: 0, colSpan: 3, rowSpan: 2, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.95, multValor: 1.0, multBalao: 1.38, multFoto: 1.09,
        perModelo: { ENCARTE_GRANDE: { multNome: 0.69, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome dos 4 produtos menor (destaque chama mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.72 } } },
      // 3 destaques embaixo: destaque EXPLÍCITO (fundo vermelho)
      { col: 0, row: 2, colSpan: 4, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.44, multValor: 1.0, multBalao: 1.49, multFoto: 1.18,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome + balão do destaque maiores (chamar mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.62, multBalao: 1.70 } } },
      { col: 4, row: 2, colSpan: 4, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.44, multValor: 1.0, multBalao: 1.49, multFoto: 1.18,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome + balão do destaque maiores (chamar mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.62, multBalao: 1.70 } } },
      { col: 8, row: 2, colSpan: 4, rowSpan: 2, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.44, multValor: 1.0, multBalao: 1.49, multFoto: 1.18,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome + balão do destaque maiores (chamar mais atenção)
          FACEBOOK_QUADRADO: { multNome: 0.62, multBalao: 1.70 } } },
    ]},
  { id: 'g_7_1_dest_lat', nome: '7 Produtos - 1 destaque lateral + 6 produtos', quantidade: 7,
    excluirFormatos: ['STORIES'],  // STORIES usa g_7_1_dest_topo_stories (destaque no topo, vertical)
    // Cols 6 (era 4): destaque cai de 50% pra 33% — fica menos dominante.
    // 6 produtos ocupam 67% em grid 2x3 (cada colSpan 2 de 6).
    cols: 6, rows: 3, boxes: [
      // Destaque lateral (33% × full height): destaque EXPLÍCITO (fundo vermelho)
      { col: 0, row: 0, colSpan: 2, rowSpan: 3, layoutTipo: 'card-banner', destaque: true,
        multNome: 0.86, multValor: 1.10,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      // 6 produtos pequenos: destaque: false EXPLÍCITO (fundo amarelo normal)
      { col: 2, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multFoto: 1.73, multBalao: 1.90,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 4, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multFoto: 1.73, multBalao: 1.90,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 2, row: 1, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multFoto: 1.73, multBalao: 1.90,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 4, row: 1, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multFoto: 1.73, multBalao: 1.90,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 2, row: 2, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multFoto: 1.73, multBalao: 1.90,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
      { col: 4, row: 2, colSpan: 2, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multFoto: 1.73, multBalao: 1.90,
        perModelo: { ENCARTE_GRANDE: { nomeOffsetTop: 0.20 } } },
    ]},
  // 7 produtos (STORIES): estilo qrofertas — 1 destaque grande no topo (foto esquerda +
  // nome+balão amarelo grande à direita) + 6 produtos card-banner abaixo em grid 3×2.
  // Grid em rows=200 pra granularidade fina (destaque 35% altura = 30% menor que 50%).
  { id: 'g_7_1_dest_topo', nome: '7 Produtos - 1 destaque topo + 6 produtos', quantidade: 7,
    apenasFormatos: ['STORIES'],
    cols: 3, rows: 200, boxes: [
      // Destaque topo full-width — card-banner-h (foto esquerda + nome+balão direita)
      // rowSpan 70 = 35% altura (era 50% → -30%)
      { col: 0, row: 0, colSpan: 3, rowSpan: 70, layoutTipo: 'card-banner-h', destaque: true,
        multNome: 1.06, multValor: 1.0, multBalao: 1.40, multFoto: 1.10 },
      // 6 produtos abaixo (3 cols × 2 rows) — rowSpan 65 cada (32.5% cada linha)
      // multBalao: 1.30 → 1.43 (+10%)
      { col: 0, row: 70, colSpan: 1, rowSpan: 65, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multBalao: 1.43, multFoto: 1.20 },
      { col: 1, row: 70, colSpan: 1, rowSpan: 65, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multBalao: 1.43, multFoto: 1.20 },
      { col: 2, row: 70, colSpan: 1, rowSpan: 65, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multBalao: 1.43, multFoto: 1.20 },
      { col: 0, row: 135, colSpan: 1, rowSpan: 65, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multBalao: 1.43, multFoto: 1.20 },
      { col: 1, row: 135, colSpan: 1, rowSpan: 65, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multBalao: 1.43, multFoto: 1.20 },
      { col: 2, row: 135, colSpan: 1, rowSpan: 65, layoutTipo: 'card-banner', destaque: false,
        multNome: 0.70, multValor: 1.0, multBalao: 1.43, multFoto: 1.20 },
    ]},

  // === 8 PRODUTOS ===
  { id: 'g_4x2', nome: '8 Produtos - 4x2', quantidade: 8, ...gradeSimples(4, 2),
    multFoto: 0.88,   // foto 12% menor (8% + 4%)
    multValor: 1.08,  // valor 8% maior (4% + 4%)
    multNome: 1.54,   // nome
    perModelo: {
      STORIES: {
        multNome: 3.05,        // 2.77 + 10%
        multFoto: 0.97,        // Pedido do cliente: foto +5% e +5% (0.88 → 0.97) — ainda < 1.0, não estoura o card
        fotoPosY: 0.60,        // Pedido do cliente: foto um pouco mais pra baixo (centraliza melhor no card)
        nomeOffsetTop: 0.40,   // subiu de 0.60 → 0.40 (nome mais pra cima)
        balaoOffsetY: 0.05,    // Pedido do cliente: balão de preço mais alto
      },
      REELS_INSTAGRAM: {
        multNome: 2.00,        // 1.54 + 30%
        nomeOffsetTop: 0.25,   // nome um pouco mais pra baixo
        fotoPosY: 0.50,        // foto centralizada (era 0.25 default = topo)
      },
      ENCARTE_GRANDE: {
        multNome: 1.77,        // 1.54 + 15%
        nomeOffsetTop: 0.20,
        fotoPosY: 0.50,        // foto centralizada
      },
    },
  },
  { id: 'g_8_3_dest_topo_5', nome: '8 Produtos - 3 destaques no topo e 5 produtos', quantidade: 8,
    excluirFormatos: ['STORIES'],
    cols: 15, rows: 4, boxes: [
      // 3 destaques topo: balão -20%, nome +10%
      { col: 0,  row: 0, colSpan: 5, rowSpan: 2, destaque: true,
        multBalao: 0.52, multValor: 0.80, multNome: 1.19,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.98, multNome: 1.31, nomeOffsetTop: 0.20, balaoFixo: true },
          ENCARTE_GRANDE: { multBalao: 0.88, multNome: 1.39, multFoto: 1.20, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque maior que o dos 5 produtos
          FACEBOOK_QUADRADO: { multBalao: 0.75, multValor: 1.0 },
        } },
      { col: 5,  row: 0, colSpan: 5, rowSpan: 2, destaque: true,
        multBalao: 0.52, multValor: 0.80, multNome: 1.19,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.98, multNome: 1.31, nomeOffsetTop: 0.20, balaoFixo: true },
          ENCARTE_GRANDE: { multBalao: 0.88, multNome: 1.39, multFoto: 1.20, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque maior que o dos 5 produtos
          FACEBOOK_QUADRADO: { multBalao: 0.75, multValor: 1.0 },
        } },
      { col: 10, row: 0, colSpan: 5, rowSpan: 2, destaque: true,
        multBalao: 0.52, multValor: 0.80, multNome: 1.19,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.98, multNome: 1.31, nomeOffsetTop: 0.20, balaoFixo: true },
          ENCARTE_GRANDE: { multBalao: 0.88, multNome: 1.39, multFoto: 1.20, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque maior que o dos 5 produtos
          FACEBOOK_QUADRADO: { multBalao: 0.75, multValor: 1.0 },
        } },
      // 5 produtos pequenos embaixo: nome +40%
      { col: 0,  row: 2, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
        } },
      { col: 3,  row: 2, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
        } },
      { col: 6,  row: 2, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
        } },
      { col: 9,  row: 2, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
        } },
      { col: 12, row: 2, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
        } },
    ]},
  { id: 'g_8_5_prod_3_dest_baixo', nome: '8 Produtos - 5 produtos e 3 destaques em baixo', quantidade: 8,
    excluirFormatos: ['STORIES'],
    cols: 15, rows: 4, boxes: [
      // 5 produtos pequenos topo: nome +40%
      { col: 0,  row: 0, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): foto dos 5 produtos mais baixa, perto do balão
          // + nome levemente abaixado pra descolar do topo do card
          FACEBOOK_QUADRADO: { fotoPosY: 0.85, nomeOffsetTop: 0.06 },
        } },
      { col: 3,  row: 0, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): foto dos 5 produtos mais baixa, perto do balão
          // + nome levemente abaixado pra descolar do topo do card
          FACEBOOK_QUADRADO: { fotoPosY: 0.85, nomeOffsetTop: 0.06 },
        } },
      { col: 6,  row: 0, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): foto dos 5 produtos mais baixa, perto do balão
          // + nome levemente abaixado pra descolar do topo do card
          FACEBOOK_QUADRADO: { fotoPosY: 0.85, nomeOffsetTop: 0.06 },
        } },
      { col: 9,  row: 0, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): foto dos 5 produtos mais baixa, perto do balão
          // + nome levemente abaixado pra descolar do topo do card
          FACEBOOK_QUADRADO: { fotoPosY: 0.85, nomeOffsetTop: 0.06 },
        } },
      { col: 12, row: 0, colSpan: 3, rowSpan: 2, destaque: false, multNome: 1.57,
        perModelo: {
          REELS_INSTAGRAM: { multNome: 1.96, multFoto: 0.95, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          ENCARTE_GRANDE: { multNome: 1.81, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): foto dos 5 produtos mais baixa, perto do balão
          // + nome levemente abaixado pra descolar do topo do card
          FACEBOOK_QUADRADO: { fotoPosY: 0.85, nomeOffsetTop: 0.06 },
        } },
      // 3 destaques embaixo: balão -20%, nome +10%
      { col: 0,  row: 2, colSpan: 5, rowSpan: 2, destaque: true,
        multBalao: 0.52, multValor: 0.80, multNome: 1.19,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.98, multNome: 1.31, nomeOffsetTop: 0.20, balaoFixo: true },
          ENCARTE_GRANDE: { multBalao: 0.88, multNome: 1.39, multFoto: 1.20, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque maior (espelho de g_8_3_dest_topo_5)
          FACEBOOK_QUADRADO: { multBalao: 0.75, multValor: 1.0 },
        } },
      { col: 5,  row: 2, colSpan: 5, rowSpan: 2, destaque: true,
        multBalao: 0.52, multValor: 0.80, multNome: 1.19,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.98, multNome: 1.31, nomeOffsetTop: 0.20, balaoFixo: true },
          ENCARTE_GRANDE: { multBalao: 0.88, multNome: 1.39, multFoto: 1.20, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque maior (espelho de g_8_3_dest_topo_5)
          FACEBOOK_QUADRADO: { multBalao: 0.75, multValor: 1.0 },
        } },
      { col: 10, row: 2, colSpan: 5, rowSpan: 2, destaque: true,
        multBalao: 0.52, multValor: 0.80, multNome: 1.19,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.98, multNome: 1.31, nomeOffsetTop: 0.20, balaoFixo: true },
          ENCARTE_GRANDE: { multBalao: 0.88, multNome: 1.39, multFoto: 1.20, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque maior (espelho de g_8_3_dest_topo_5)
          FACEBOOK_QUADRADO: { multBalao: 0.75, multValor: 1.0 },
        } },
    ]},

  // === 9 PRODUTOS ===
  { id: 'g_3x3', nome: '9 Produtos - 3x3', quantidade: 9,
    cols: 3, rows: 3, boxes: [
      // Estilo qrofertas: nome topo + foto bottom-left + balão bottom-right
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo' },
    ],
    multNome: 0.86,   // nome 14% menor
    multFoto: 1.32,   // foto +32% — área cresce pra direita (entra no espaço do balão);
                      // clamp do renderer impede sair do card.
    multValor: 0.80,  // valor 5% menor
    multBalao: 0.98,  // balão no limite máximo (acima disso a safety encolhe pra caber)
    // STORIES: cards verticais altos — usa renderer card-banner (nome topo + foto centro
    // + balão grande embaixo) ao invés de horizontal-topo, casando com qrofertas.
    perModelo: {
      STORIES: {
        layoutTipo: 'card-banner',
        multNome: 0.88,        // 1.10 → 0.88 (-20%)
        multFoto: 1.45,        // foto grande, preenche o card
        multBalao: 1.35,       // balão proeminente embaixo
        multValor: 1.05,       // valor um pouco maior
      },
      // Pedido do cliente (FACEBOOK_QUADRADO): nome SUBIDO pra perto do topo
      // (negativo = pra cima; nesse renderer o nome é centralizado na faixa do topo) +
      // balões uniformes (balaoFixo) — antes variavam de tamanho conforme o preço.
      FACEBOOK_QUADRADO: {
        nomeOffsetTop: -0.15,
        balaoFixo: true,
      },
    },
  },

  // === 10 PRODUTOS ===
  { id: 'g_10_1_dest_lat', nome: '10 Produtos - 1 destaque lateral + 9 produtos', quantidade: 10,
    excluirFormatos: ['STORIES'],
    // Cols 8 (era 5): destaque cai de 40% pra 25%. 9 produtos ocupam 75% em 3x3.
    // Layouts MANTIDOS no default (renderização original) — só ajustamos largura+mults.
    cols: 8, rows: 3, boxes: [
      // Destaque lateral 25% × full height: destaque EXPLÍCITO (fundo vermelho)
      { col: 0, row: 0, colSpan: 2, rowSpan: 3, destaque: true,
        multBalao: 0.95, multValor: 0.60, multNome: 1.12, multFoto: 1.15, fotoPosY: 0.65,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.09, multValor: 0.95, multNome: 1.55, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.40, multValor: 0.90, multNome: 1.34, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo +
          // balão subido um pouco (balaoOffsetY) + balão +18% (1.14 × 1.18 ≈ 1.35) +
          // preço maior pra preencher o balão (multValor 0.60 → 0.95)
          FACEBOOK_QUADRADO: { multBalao: 1.35, multValor: 0.95, nomeOffsetTop: 0.12, balaoOffsetY: 0.04 },
        } },
      // 9 produtos pequenos (3x3 em 75% da largura): foto −14%, balão +15%
      // destaque: false EXPLÍCITO — auto-detect marcaria como destaque (colSpan>1)
      // e o renderer aplicaria estilo destaque (pílula amarela com texto preto).
      // Esses 9 são cards NORMAIS (pílula vermelha + texto branco).
      { col: 2, row: 0, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 4, row: 0, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 6, row: 0, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 2, row: 1, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 4, row: 1, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 6, row: 1, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 2, row: 2, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 4, row: 2, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
      { col: 6, row: 2, colSpan: 2, rowSpan: 1, destaque: false,
        multFoto: 0.75, multValor: 0.66, multBalao: 0.80, multNome: 1.68, smartFoto: true, balaoFixo: true, fotoPosY: 0.55,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 1.00, multNome: 1.93, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multBalao: 1.04, multNome: 1.85, nomeOffsetTop: 0.20 },
          // Pedido do cliente: balão +18% só no FACEBOOK_QUADRADO desta grade (0.80 × 1.18)
          FACEBOOK_QUADRADO: { multBalao: 0.944 },
        } },
    ]},

  // === 11 PRODUTOS ===
  { id: 'g_11_dest_central', nome: '11 Produtos - destaque central + 2 largos topo/baixo + 8 pequenos', quantidade: 11,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM', 'ENCARTE_GRANDE'],
    // Layout simétrico estilo qrofertas: dest central, 2 largos (topo+baixo no centro),
    // 8 pequenos nas laterais (4 esquerda + 4 direita).
    cols: 4, rows: 4, boxes: [
      // === LINHA 0 ===
      // Pequeno top-esquerdo
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      // LARGO horizontal topo-centro (LINGUIÇA SEARA): destaque: false explícito (auto-detect marcaria)
      { col: 1, row: 0, colSpan: 2, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multNome: 0.85, multValor: 0.61 },  // balão -15%
      // Pequeno top-direito
      { col: 3, row: 0, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      // === LINHAS 1-2: DESTAQUE CENTRAL 2x2 ===
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      // DESTAQUE central (2x2): balão -20% (via multValor), nome +15%
      { col: 1, row: 1, colSpan: 2, rowSpan: 2, destaque: true,
        multBalao: 0.65, multValor: 0.48, multNome: 0.83, multFoto: 1.15,
        // Pedido do cliente (FACEBOOK_QUADRADO): balão +18% (0.77) + foto +14% (1.15×1.14≈1.31) +
        // foto mais baixa (fotoPosY 0.62) + nome mantido no topo (nomeOffsetTop 0 ignora o offset do layout)
        perModelo: { FACEBOOK_QUADRADO: { multBalao: 0.77, multFoto: 1.31, fotoPosY: 0.62, nomeOffsetTop: 0 } } },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      // === LINHA 3 ===
      // Pequeno bottom-esquerdo
      { col: 0, row: 3, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
      // LARGO horizontal bottom-centro (BISTEQUINHA SADIA)
      { col: 1, row: 3, colSpan: 2, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multNome: 0.85, multValor: 0.61 },  // balão -15%
      // Pequeno bottom-direito
      { col: 3, row: 3, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'horizontal', multValor: 0.72 },
    ],
    // Pedido do cliente (FACEBOOK_QUADRADO): nome dos produtos (não-destaque) levemente abaixado.
    // Vale pra todos os boxes 'horizontal'; o destaque neutraliza com nomeOffsetTop:0 no seu perModelo.
    perModelo: { FACEBOOK_QUADRADO: { nomeOffsetTop: 0.10 } },
  },
  // Variante ENCARTE_GRANDE estilo qrofertas: 3 topo + 1 destaque central (col 1) com 2x2 pequenos lateral + 3 baixo
  { id: 'g_11_dest_central_encarte', nome: '11 Produtos - destaque central + 2 largos topo/baixo + 8 pequenos', quantidade: 11,
    apenasFormatos: ['ENCARTE_GRANDE'],
    cols: 3, rows: 4, boxes: [
      // Row 0: 3 pequenos topo
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      // Row 1: pequeno esq, DESTAQUE central (rowSpan 2), pequeno dir
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 2, destaque: true, layoutTipo: 'card-banner',
        multNome: 0.61, multValor: 1.0, multBalao: 1.20, multFoto: 1.15, nomeOffsetTop: 0.20 },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      // Row 2: pequeno esq, [destaque continua], pequeno dir
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      // Row 3: 3 pequenos baixo
      { col: 0, row: 3, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      { col: 1, row: 3, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
      { col: 2, row: 3, colSpan: 1, rowSpan: 1, destaque: false, layoutTipo: 'card-foto-topo',
        multNome: 0.70, multValor: 0.85, multBalao: 1.30, multFoto: 1.15, balaoFixo: true, nomeAlignX: 0.5 },
    ]},
  { id: 'g_11_3_dest_topo', nome: '11 Produtos - 3 destaques topo + 8 produtos', quantidade: 11,
    excluirFormatos: ['ENCARTE_GRANDE'],
    // Layout calibrado conforme print do concorrente qrofertas:
    // destaques topo ~40% da altura, 8 cards (2x4) ~60%. Antes era 50/50.
    cols: 12, rows: 10, boxes: [
      // 3 destaques topo: rowSpan=4 (40% da altura). Balão -15% (1.10→0.94) conforme pedido.
      { col: 0, row: 0, colSpan: 4, rowSpan: 4, destaque: true, layoutTipo: 'horizontal-topo',
        multNome: 0.42, multValor: 0.90, multBalao: 0.94, multFoto: 1.63,
        perModelo: {
          STORIES: { layoutTipo: 'card-banner', multNome: 0.66, multValor: 1.05, multBalao: 1.40, multFoto: 1.40 },
          REELS_INSTAGRAM: { multFoto: 1.79, fotoOffsetX: 0.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque +15% (0.94 × 1.15 ≈ 1.08)
          FACEBOOK_QUADRADO: { multBalao: 1.08 },
        } },
      { col: 4, row: 0, colSpan: 4, rowSpan: 4, destaque: true, layoutTipo: 'horizontal-topo',
        multNome: 0.42, multValor: 0.90, multBalao: 0.94, multFoto: 1.63,
        perModelo: {
          STORIES: { layoutTipo: 'card-banner', multNome: 0.66, multValor: 1.05, multBalao: 1.40, multFoto: 1.40 },
          REELS_INSTAGRAM: { multFoto: 1.79, fotoOffsetX: 0.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque +15% (0.94 × 1.15 ≈ 1.08)
          FACEBOOK_QUADRADO: { multBalao: 1.08 },
        } },
      { col: 8, row: 0, colSpan: 4, rowSpan: 4, destaque: true, layoutTipo: 'horizontal-topo',
        multNome: 0.42, multValor: 0.90, multBalao: 0.94, multFoto: 1.63,
        perModelo: {
          STORIES: { layoutTipo: 'card-banner', multNome: 0.66, multValor: 1.05, multBalao: 1.40, multFoto: 1.40 },
          REELS_INSTAGRAM: { multFoto: 1.79, fotoOffsetX: 0.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): balão do destaque +15% (0.94 × 1.15 ≈ 1.08)
          FACEBOOK_QUADRADO: { multBalao: 1.08 },
        } },
      // 8 produtos: 2 linhas × 4 cards, rowSpan=3 cada. Balão +9% (1.10→1.20) — fica
      // proporcionalmente mais prominente que o destaque, batendo com o print qrofertas.
      { col: 0, row: 4, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 3, row: 4, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 6, row: 4, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 9, row: 4, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 0, row: 7, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 3, row: 7, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 6, row: 7, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
      { col: 9, row: 7, colSpan: 3, rowSpan: 3, destaque: false, layoutTipo: 'horizontal-topo',
        multNome: 0.81, multValor: 0.95, multBalao: 0.95, multFoto: 1.32,
        perModelo: { STORIES: { layoutTipo: 'card-banner', multNome: 0.78, multValor: 1.0, multBalao: 1.30, multFoto: 1.25 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome subido (-0.15) + balão +10% (1.05) +
          // balões uniformes (balaoFixo) — antes variavam de largura conforme o preço.
          FACEBOOK_QUADRADO: { nomeOffsetTop: -0.15, multBalao: 1.05, balaoFixo: true } } },
    ]},

  // === 15 PRODUTOS === (3 destaques topo + 12 produtos 4×3, estilo qrofertas)
  { id: 'g_15_3_dest_topo_12', nome: '15 Produtos - 3 destaques topo + 12 produtos', quantidade: 15,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 12, rows: 4, boxes: [
      // Row 0: 3 destaques (4 cols cada = 33% largura cada) — fundo vermelho + balão amarelo
      { col: 0, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.70, multValor: 1.0, multBalao: 1.20, multFoto: 1.45, fotoOffsetX: 0.20 },
      { col: 4, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.70, multValor: 1.0, multBalao: 1.20, multFoto: 1.45, fotoOffsetX: 0.20 },
      { col: 8, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.70, multValor: 1.0, multBalao: 1.20, multFoto: 1.45, fotoOffsetX: 0.20 },
      // Rows 1-3: 12 produtos (3 cols cada = 25% largura, 4 por linha)
      { col: 0, row: 1, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 3, row: 1, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 6, row: 1, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 9, row: 1, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 0, row: 2, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 3, row: 2, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 6, row: 2, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 9, row: 2, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 0, row: 3, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 3, row: 3, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 6, row: 3, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
      { col: 9, row: 3, colSpan: 3, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.33, fotoOffsetX: 0.20 },
    ]},

  // === 15 PRODUTOS (ENCARTE_GRANDE) === estilo qrofertas: 3 destaques topo + 12 produtos 4×3
  // Destaques: nome topo, foto centro, balão grande embaixo.
  // 12 pequenos: card-foto-topo (foto topo, nome bottom-esq, balão bottom-dir).
  { id: 'g_15_3_dest_topo_12_encarte', nome: '15 Produtos - 3 destaques topo + 12 produtos', quantidade: 15,
    apenasFormatos: ['ENCARTE_GRANDE'],
    cols: 12, rows: 4, boxes: [
      // Row 0: 3 destaques (4 cols cada = 33% largura) — fundo vermelho
      { col: 0, row: 0, colSpan: 4, rowSpan: 1, destaque: true,
        multNome: 1.45, multValor: 1.10, multBalao: 0.60, multFoto: 1.10, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
      { col: 4, row: 0, colSpan: 4, rowSpan: 1, destaque: true,
        multNome: 1.45, multValor: 1.10, multBalao: 0.60, multFoto: 1.10, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
      { col: 8, row: 0, colSpan: 4, rowSpan: 1, destaque: true,
        multNome: 1.45, multValor: 1.10, multBalao: 0.60, multFoto: 1.10, fotoPosY: 0.50, nomeOffsetTop: 0.20 },
      // Rows 1-3: 12 produtos pequenos (3 cols cada = 25% largura, 4 por linha)
      ...Array.from({ length: 12 }, (_, i) => ({
        col: (i % 4) * 3, row: 1 + Math.floor(i / 4), colSpan: 3, rowSpan: 1,
        layoutTipo: 'card-foto-topo', destaque: false,
        multNome: 0.75, multValor: 0.90, multBalao: 1.08, multFoto: 1.10, balaoFixo: true, nomeAlignX: 0.5,
      })),
    ]},

  // === 16 PRODUTOS (ENCARTE_GRANDE) === 4×4 com card-foto-topo (foto topo, nome+balão bottom)
  { id: 'g_16_4x4_encarte', nome: '16 Produtos - 4x4', quantidade: 16,
    apenasFormatos: ['ENCARTE_GRANDE'],
    cols: 4, rows: 4, boxes: Array.from({ length: 16 }, (_, i) => ({
      col: i % 4, row: Math.floor(i / 4), colSpan: 1, rowSpan: 1,
      layoutTipo: 'card-foto-topo', destaque: false,
      multNome: 0.90, multValor: 0.90, multBalao: 1.08, multFoto: 1.10, balaoFixo: true, nomeAlignX: 0.5,
    })) },

  // === 16 PRODUTOS === (4x4 simétrico, estilo qrofertas — todos com foto esq + balão dir)
  { id: 'g_16_4x4_reels', nome: '16 Produtos - 4x4', quantidade: 16,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 4, rows: 4, boxes: [
      // 16 produtos card-banner-h não: usa horizontal-topo (foto esq, nome topo, balão direita)
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 3, row: 0, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 0, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 1, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 2, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
      { col: 3, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.60, multValor: 0.85, multBalao: 1.30, multFoto: 1.57, fotoOffsetX: -0.10 },
    ]},

  // === 17 PRODUTOS === (1 destaque full-width topo + grid 4x4)
  { id: 'g_17_1_dest_4x4', nome: '17 Produtos - 1 destaque no topo + 4x4', quantidade: 17,
    apenasFormatos: ['STORIES'],
    cols: 4, rows: 5, boxes: [
      // Destaque topo full-width — card-banner-h (foto esq + nome+balão dir, estilo qrofertas)
      { col: 0, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'card-banner-h', destaque: true,
        multBalao: 1.69, multValor: 1.0, multNome: 0.85, multFoto: 1.10 },
      // Grid 4x4 abaixo (16 produtos) — card-banner (nome topo + foto + balão bottom)
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 0, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 1, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 2, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 3, row: 3, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 0, row: 4, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 1, row: 4, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 2, row: 4, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
      { col: 3, row: 4, colSpan: 1, rowSpan: 1, layoutTipo: 'card-banner', destaque: false,
        multBalao: 1.54, multValor: 1.0, multNome: 0.80, multFoto: 1.42 },
    ]},

  // === 12 PRODUTOS ===
  { id: 'g_12_4_dest_topo_8', nome: '12 Produtos - 4 destaques topo e 8 produtos', quantidade: 12,
    excluirFormatos: ['STORIES'],
    cols: 4, rows: 4, boxes: [
      // 4 destaques 1x2 (verticais): destaque EXPLÍCITO (fundo vermelho)
      { col: 0, row: 0, colSpan: 1, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + fonte +8%
          FACEBOOK_QUADRADO: { multNome: 1.08, nomeOffsetTop: 0.10 } } },
      { col: 1, row: 0, colSpan: 1, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + fonte +8%
          FACEBOOK_QUADRADO: { multNome: 1.08, nomeOffsetTop: 0.10 } } },
      { col: 2, row: 0, colSpan: 1, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + fonte +8%
          FACEBOOK_QUADRADO: { multNome: 1.08, nomeOffsetTop: 0.10 } } },
      { col: 3, row: 0, colSpan: 1, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + fonte +8%
          FACEBOOK_QUADRADO: { multNome: 1.08, nomeOffsetTop: 0.10 } } },
      // 8 produtos pequenos: nome +50%, balão -40%, foto menor
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 0, row: 3, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 1, row: 3, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 2, row: 3, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 3, row: 3, colSpan: 1, rowSpan: 1, multBalao: 0.77, multValor: 0.75, multFoto: 1.13, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
    ]},
  { id: 'g_4x3', nome: '12 Produtos - 4x3', quantidade: 12, ...gradeSimples(4, 3),
    excluirFormatos: ['STORIES'],
    multBalao: 0.78,  // 0.65 → 0.78 (+20%)
    multValor: 0.69,  // 0.64 → 0.69 (+8% balão)
    multNome: 1.58,   // 1.50 → 1.58 (+5% nome)
    perModelo: {
      ENCARTE_GRANDE: {
        multNome: 1.98,    // 1.58 + 25%
        multBalao: 0.90,   // 0.78 + 15%
        fotoPosY: 0.45,    // foto um pouco mais pra baixo
      },
    },
  },
  { id: 'g_12_8_prod_4_dest_baixo', nome: '12 Produtos - 8 produtos e 4 destaques em baixo', quantidade: 12,
    excluirFormatos: ['STORIES'],
    cols: 4, rows: 4, boxes: [
      // 8 produtos pequenos topo: balão -20%, nome +50%
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 3, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.68, multNome: 1.88,
        perModelo: { ENCARTE_GRANDE: { multFoto: 0.87, multBalao: 0.85, multNome: 1.80, nomeOffsetTop: 0.10, fotoPosY: 0.45 } } },
      // 4 destaques verticais (1x2): destaque EXPLÍCITO (fundo vermelho)
      { col: 0, row: 2, colSpan: 1, rowSpan: 2, destaque: true, multBalao: 0.74, multValor: 0.75, multNome: 1.01,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.89, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, multBalao: 0.95, fotoPosY: 0.65, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + balão +18% (0.74 × 1.18 ≈ 0.87)
          FACEBOOK_QUADRADO: { multBalao: 0.87, nomeOffsetTop: 0.10 },
        } },
      { col: 1, row: 2, colSpan: 1, rowSpan: 2, destaque: true, multBalao: 0.74, multValor: 0.75, multNome: 1.01,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.89, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, multBalao: 0.95, fotoPosY: 0.65, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + balão +18% (0.74 × 1.18 ≈ 0.87)
          FACEBOOK_QUADRADO: { multBalao: 0.87, nomeOffsetTop: 0.10 },
        } },
      { col: 2, row: 2, colSpan: 1, rowSpan: 2, destaque: true, multBalao: 0.74, multValor: 0.75, multNome: 1.01,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.89, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, multBalao: 0.95, fotoPosY: 0.65, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + balão +18% (0.74 × 1.18 ≈ 0.87)
          FACEBOOK_QUADRADO: { multBalao: 0.87, nomeOffsetTop: 0.10 },
        } },
      { col: 3, row: 2, colSpan: 1, rowSpan: 2, destaque: true, multBalao: 0.74, multValor: 0.75, multNome: 1.01,
        perModelo: {
          REELS_INSTAGRAM: { multBalao: 0.89, nomeOffsetTop: 0.25 },
          ENCARTE_GRANDE: { multNome: 1.30, multFoto: 1.18, multBalao: 0.95, fotoPosY: 0.65, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + balão +18% (0.74 × 1.18 ≈ 0.87)
          FACEBOOK_QUADRADO: { multBalao: 0.87, nomeOffsetTop: 0.10 },
        } },
    ]},

  // === 13 PRODUTOS ===
  // Destaque LATERAL ESQUERDO (vertical) + 12 produtos pequenos em grid 4×3
  { id: 'g_13_1_dest_4x3', nome: '13 Produtos - 1 destaque + 4x3', quantidade: 13,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM', 'ENCARTE_GRANDE'],
    cols: 5, rows: 3, boxes: [
      // Destaque lateral esquerdo: 1 coluna × 3 rows (vertical) — foto +44%
      { col: 0, row: 0, colSpan: 1, rowSpan: 3, destaque: true,
        multBalao: 1.04, multValor: 0.65, multNome: 0.75, multFoto: 1.32,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome +25% e depois +20% (≈ 1.13) + nome mais baixo +
        // balão +18% e depois +12% (≈ 1.38) + preço maior pra preencher (0.65 → 0.95) + balão subido (balaoOffsetY)
        perModelo: { FACEBOOK_QUADRADO: { multNome: 1.13, nomeOffsetTop: 0.12, multBalao: 1.38, multValor: 0.95, balaoOffsetY: 0.03 } } },
      // 12 produtos pequenos: 4 cols × 3 rows — balão -20%, nome +60%
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 3, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 4, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 4, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
      { col: 4, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.90, multValor: 0.68, multNome: 1.60 },
    ]},

  // === 14 PRODUTOS ===
  // 2 destaques verticais à esquerda + 12 produtos pequenos em 4 cols × 3 rows
  { id: 'g_14_2_dest_4x3', nome: '14 Produtos - 2 destaques + 4x3', quantidade: 14,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM', 'ENCARTE_GRANDE'],
    cols: 5, rows: 6, boxes: [
      // Destaque 1 (topo esquerdo): 1 col × 3 rows
      { col: 0, row: 0, colSpan: 1, rowSpan: 3, destaque: true,
        multBalao: 1.04, multValor: 0.65, multNome: 0.81, multFoto: 1.30,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome +25% (≈1.01) + balão +15% e depois +15% (≈1.38) +
        // preço acompanha (0.65 → 0.95) + nome mais baixo (nomeOffsetTop) + balão subido (balaoOffsetY)
        perModelo: { FACEBOOK_QUADRADO: { multNome: 1.01, multBalao: 1.38, multValor: 0.95, nomeOffsetTop: 0.12, balaoOffsetY: 0.03 } } },
      // Destaque 2 (base esquerda): 1 col × 3 rows
      { col: 0, row: 3, colSpan: 1, rowSpan: 3, destaque: true,
        multBalao: 1.04, multValor: 0.65, multNome: 0.81, multFoto: 1.30,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome +25% (≈1.01) + balão +15% e depois +15% (≈1.38) +
        // preço acompanha (0.65 → 0.95) + nome mais baixo (nomeOffsetTop) + balão subido (balaoOffsetY)
        perModelo: { FACEBOOK_QUADRADO: { multNome: 1.01, multBalao: 1.38, multValor: 0.95, nomeOffsetTop: 0.12, balaoOffsetY: 0.03 } } },
      // 12 produtos pequenos: 4 cols × 3 (cada 1 col × 2 rows pra alinhar com destaques)
      // destaque: false EXPLÍCITO — sem isso, rowSpan>1 fazia o auto-detect marcar
      // como destaque (fundo vermelho). São cards NORMAIS (fundo amarelo do tema).
      { col: 1, row: 0, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 3, row: 0, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 4, row: 0, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 3, row: 2, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 4, row: 2, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 1, row: 4, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 2, row: 4, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 3, row: 4, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
      { col: 4, row: 4, colSpan: 1, rowSpan: 2, destaque: false, multBalao: 0.78, multValor: 0.77, multFoto: 0.90, multNome: 1.50 },
    ]},
  { id: 'g_14_dest_baixo_centro', nome: '14 Produtos - 13 produtos e 1 destaque central baixo', quantidade: 14,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM'],
    // Pedido do cliente (FACEBOOK_QUADRADO): nos 13 produtos pequenos, foto um pouco mais baixa
    // (fotoPosY 0.45) + balão +12% (0.78 × 1.12 ≈ 0.87). Aplicado por box (perModelo) pra não
    // afetar a grade irmã "destaque central topo", que tem produtos idênticos.
    cols: 5, rows: 3, boxes: [
      // Linha 0: 5 produtos pequenos no topo — foto -12%, nome +50%
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 3, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 4, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      // Linhas 1-2: 4 produtos esquerda + destaque vertical central + 4 produtos direita
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      // destaque central (1 col × 2 rows): nome +15%, foto +10%
      { col: 2, row: 1, colSpan: 1, rowSpan: 2, destaque: true,
        multBalao: 1.26, multValor: 1.30, multNome: 0.86, multFoto: 1.29,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo (0.12) + nome +15%
        // (0.86 × 1.15 ≈ 0.99) + balão subido um pouco (balaoOffsetY). Vale pras 2 grades espelho.
        perModelo: { ENCARTE_GRANDE: { multNome: 2.10, nomeOffsetTop: 0.20 },
          FACEBOOK_QUADRADO: { nomeOffsetTop: 0.12, multNome: 0.99, balaoOffsetY: 0.03 } } },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 4, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 4, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
    ]},
  { id: 'g_14_dest_cima_centro', nome: '14 Produtos - 13 produtos e 1 destaque central cima', quantidade: 14,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM'],
    // Espelho de g_14_dest_baixo_centro — só muda a posição do destaque (topo vs base).
    // Mults idênticos pra render consistente entre as duas grades.
    // Pedido do cliente (FACEBOOK_QUADRADO): mesmos ajustes da g_14_dest_baixo_centro (espelho) —
    // 13 produtos com foto mais baixa (fotoPosY 0.45) + balão +12% (0.87); destaque com nome mais baixo (0.12).
    cols: 5, rows: 3, boxes: [
      // Linhas 0-1: 4 produtos esquerda + destaque vertical central + 4 produtos direita
      { col: 0, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      // destaque central (1 col × 2 rows) no topo
      { col: 2, row: 0, colSpan: 1, rowSpan: 2, destaque: true,
        multBalao: 1.26, multValor: 1.30, multNome: 0.86, multFoto: 1.29,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo (0.12) + nome +15%
        // (0.86 × 1.15 ≈ 0.99) + balão subido um pouco (balaoOffsetY). Vale pras 2 grades espelho.
        perModelo: { ENCARTE_GRANDE: { multNome: 2.10, nomeOffsetTop: 0.20 },
          FACEBOOK_QUADRADO: { nomeOffsetTop: 0.12, multNome: 0.99, balaoOffsetY: 0.03 } } },
      { col: 3, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 4, row: 0, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 3, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 4, row: 1, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      // Linha 2: 5 produtos pequenos na base
      { col: 0, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
      { col: 4, row: 2, colSpan: 1, rowSpan: 1, multBalao: 0.78, multValor: 0.72, multFoto: 0.88, multNome: 1.50,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.98, multNome: 2.25, fotoPosY: 0.50, nomeOffsetTop: 0.20 }, FACEBOOK_QUADRADO: { fotoPosY: 0.45, multBalao: 0.87 } } },
    ]},

  // === 18 PRODUTOS ===
  // Layout: 28 cols × 4 rows. Pequenos = 4 cols × 1 row, Destaques = 7 cols × 2 rows.
  // (LCM entre 7 produtos pequenos por linha e 4 destaques na linha de baixo = 28)
  { id: 'g_18_14_prod_4_dest_baixo', nome: '18 Produtos - 14 produtos e 4 destaques em baixo', quantidade: 18,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM'],
    cols: 28, rows: 4, boxes: [
      // Row 0: 7 produtos pequenos
      { col: 0,  row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 4,  row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 8,  row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 12, row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 16, row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 20, row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 24, row: 0, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      // Row 1: mais 7 produtos pequenos
      { col: 0,  row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 4,  row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 8,  row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 12, row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 16, row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 20, row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 24, row: 1, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      // Rows 2-3: 4 destaques GRANDES
      { col: 0,  row: 2, colSpan: 7, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.15, multFoto: 1.10, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
          FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      { col: 7,  row: 2, colSpan: 7, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.15, multFoto: 1.10, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
          FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      { col: 14, row: 2, colSpan: 7, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.15, multFoto: 1.10, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
          FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      { col: 21, row: 2, colSpan: 7, rowSpan: 2, destaque: true,
        perModelo: { ENCARTE_GRANDE: { multNome: 1.15, multFoto: 1.10, nomeOffsetTop: 0.20 },
          // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
          FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
    ]},
  { id: 'g_18_4_dest_topo_14', nome: '18 Produtos - 4 destaques no topo e 14 produtos', quantidade: 18,
    excluirFormatos: ['STORIES', 'REELS_INSTAGRAM'],
    cols: 28, rows: 4, boxes: [
      // Rows 0-1: 4 destaques GRANDES no topo
      { col: 0,  row: 0, colSpan: 7, rowSpan: 2, destaque: true,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
        perModelo: { FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      { col: 7,  row: 0, colSpan: 7, rowSpan: 2, destaque: true,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
        perModelo: { FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      { col: 14, row: 0, colSpan: 7, rowSpan: 2, destaque: true,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
        perModelo: { FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      { col: 21, row: 0, colSpan: 7, rowSpan: 2, destaque: true,
        // Pedido do cliente (FACEBOOK_QUADRADO): nome do destaque mais baixo + foto +15%
        perModelo: { FACEBOOK_QUADRADO: { multFoto: 1.15, nomeOffsetTop: 0.12 } } },
      // Row 2: 7 produtos pequenos
      { col: 0,  row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 4,  row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 8,  row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 12, row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 16, row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 20, row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 24, row: 2, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      // Row 3: mais 7 produtos pequenos
      { col: 0,  row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 4,  row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 8,  row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 12, row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 16, row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 20, row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
      { col: 24, row: 3, colSpan: 4, rowSpan: 1, destaque: false, multBalao: 0.65, multNome: 2.10,
        perModelo: { ENCARTE_GRANDE: { multBalao: 0.75, multNome: 2.52, multFoto: 0.94, fotoPosY: 0.50 } } },
    ]},

  // === 18 PRODUTOS (REELS) === 2 destaques topo + 16 produtos 4x4
  { id: 'g_18_2_dest_topo_4x4', nome: '18 Produtos - 2 destaque no topo + 4x4', quantidade: 18,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 4, rows: 5, boxes: [
      // 2 destaques topo (colSpan 2 cada = 50% largura) — calibrado qrofertas
      // balaoFixo: largura proporcional a multBalao (sem isso é text-driven e multBalao
      // praticamente não tem efeito visual, só no padding)
      { col: 0, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.65, multValor: 1.10, multBalao: 0.76, multFoto: 1.28, fotoOffsetX: -0.20, balaoFixo: true },
      { col: 2, row: 0, colSpan: 2, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.65, multValor: 1.10, multBalao: 0.76, multFoto: 1.28, fotoOffsetX: -0.20, balaoFixo: true },
      // 16 produtos 4 cols × 4 rows (rows 1-4) — compactos, foto pra esquerda
      ...Array.from({ length: 16 }, (_, i) => ({
        col: i % 4, row: 1 + Math.floor(i / 4), colSpan: 1, rowSpan: 1,
        layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.63, multValor: 0.90, multBalao: 1.35, multFoto: 1.18, fotoOffsetX: -0.10,
      })),
    ]},

  // === 19 PRODUTOS (REELS) === 3 destaques topo + 16 produtos 4x4
  { id: 'g_19_3_dest_topo_4x4', nome: '19 Produtos - 3 destaque no topo + 4x4', quantidade: 19,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 12, rows: 5, boxes: [
      // 3 destaques topo (colSpan 4 cada = 33% largura) — balão -15%
      { col: 0, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.70, multValor: 1.0, multBalao: 0.92, multFoto: 1.16, fotoOffsetX: 0.20, balaoFixo: true },
      { col: 4, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.70, multValor: 1.0, multBalao: 0.92, multFoto: 1.16, fotoOffsetX: 0.20, balaoFixo: true },
      { col: 8, row: 0, colSpan: 4, rowSpan: 1, layoutTipo: 'horizontal-topo', destaque: true,
        multNome: 0.70, multValor: 1.0, multBalao: 0.92, multFoto: 1.16, fotoOffsetX: 0.20, balaoFixo: true },
      // 16 produtos — balão -10%, nome um pouco pra cima (nomeOffsetTop: -0.10)
      ...Array.from({ length: 16 }, (_, i) => ({
        col: (i % 4) * 3, row: 1 + Math.floor(i / 4), colSpan: 3, rowSpan: 1,
        layoutTipo: 'horizontal-topo', destaque: false,
        multNome: 0.66, multValor: 0.85, multBalao: 1.00, multFoto: 1.27, fotoOffsetX: 0.10, balaoFixo: true,
        nomeOffsetTop: -0.10,
      })),
    ]},

  // === 20 PRODUTOS (REELS) === 4x5 simétrico — layout qrofertas (foto topo + nome esq + balão dir)
  { id: 'g_20_4x5', nome: '20 Produtos - 4x5', quantidade: 20,
    apenasFormatos: ['REELS_INSTAGRAM'],
    cols: 4, rows: 5, boxes: Array.from({ length: 20 }, (_, i) => ({
      col: i % 4, row: Math.floor(i / 4), colSpan: 1, rowSpan: 1,
      layoutTipo: 'card-foto-topo', destaque: false,
      multNome: 1.50, multValor: 0.85, multBalao: 1.11, multFoto: 1.41,
      balaoFixo: true, nomeOffsetTop: 0.15,
    })) },

  // === LISTAS (TABELA horizontal) ===
  { id: 'lista_10', nome: '10 Produtos - TABELA de 10 produtos', quantidade: 10, tipo: 'lista', cols: 1, rows: 10,
    boxes: Array.from({ length: 10 }, (_, i) => ({ col: 0, row: i, colSpan: 1, rowSpan: 1 })) },
  { id: 'lista_20', nome: '20 Produtos - TABELA de 20 produtos', quantidade: 20, tipo: 'lista', cols: 1, rows: 20,
    boxes: Array.from({ length: 20 }, (_, i) => ({ col: 0, row: i, colSpan: 1, rowSpan: 1 })) },
];

// Mapa de QUANTIDADE → ID do layout preferido em modo "Automático".
// Quando o usuário escolhe "Automático" e tem N produtos, o sistema usa o
// layout mais bonito/comum pra essa quantidade automaticamente.
// Exemplo: 20 produtos + Automático → lista_20 (TABELA), conforme pediu o usuário.
export const AUTO_LAYOUT_POR_QUANTIDADE = {
  1:  'g_1x1',                     // 1 produto destaque máximo
  2:  'g_2x1',                     // 2 produtos lado a lado
  3:  'g_3x1',                     // 3 produtos em linha
  4:  'g_2x2',                     // 4 produtos quadrado
  5:  'g_5_dest_esq',              // 5: destaque esquerdo + 4 grid
  6:  'g_6_2_dest_lat',            // 6: 2 destaques laterais + 4 grid
  7:  'g_7_1_dest_lat',            // 7: 1 destaque lateral + 6 grid
  8:  'g_4x2',                     // 8: 4×2 simétrico
  9:  'g_3x3',                     // 9: 3×3 simétrico
  10: 'g_10_1_dest_lat',           // 10: 1 destaque lateral + 9 grid
  11: 'g_11_3_dest_topo',          // 11: 3 destaques topo + 8 grid
  12: 'g_4x3',                     // 12: 4×3 simétrico
  13: 'g_13_1_dest_4x3',           // 13: 1 destaque + 4×3
  14: 'g_14_2_dest_4x3',           // 14: 2 destaques + 4×3
  18: 'g_18_14_prod_4_dest_baixo', // 18: 14 grid + 4 destaques baixo
  20: 'lista_20',                  // 20: TABELA (estilo lista)
};

// Auto-detection: melhor disposição de N produtos quando user usa 'automatico'.
// Layouts assimétricos: "1 destaque grande + N pequenos" — fica mais bonito
// quando há um produto principal vs outros (5, 6, 7 produtos).
export function calcularGrade(quantidade, modo = 'automatico') {
  if (modo === 'automatico') {
    if (quantidade <= 1) return { cols: 1, rows: 1 };
    if (quantidade === 2) return { cols: 2, rows: 1 };
    if (quantidade <= 4) return { cols: 2, rows: 2 };
    if (quantidade <= 6) return { cols: 2, rows: 3 };
    if (quantidade <= 8) return { cols: 4, rows: 2 };  // 7 ou 8 produtos: 4 colunas (estilo qrofertas)
    if (quantidade <= 9) return { cols: 3, rows: 3 };
    if (quantidade <= 12) return { cols: 3, rows: 4 };
    if (quantidade <= 16) return { cols: 4, rows: 4 };
    return { cols: 4, rows: Math.ceil(quantidade / 4) };
  }
  const cols = parseInt(modo) || 2;
  return { cols, rows: Math.ceil(quantidade / cols) };
}

// Layouts assimétricos automáticos (usados quando modo === 'automatico' e qtd combina)
const LAYOUTS_ASSIMETRICOS = {
  3: { cols: 3, rows: 2, boxes: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
  5: { cols: 4, rows: 2, boxes: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
  6: { cols: 6, rows: 2, boxes: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 4, row: 0, colSpan: 2, rowSpan: 2 },
  ]},
  7: { cols: 5, rows: 2, boxes: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 4, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 4, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
};

// Calcula posições/dimensões de cada box dentro da área dedicada.
// Aceita modoGrade como:
//   - 'automatico': escolhe layout melhor automaticamente
//   - '<id>': usa LAYOUTS_NOMEADOS pelo id (ex: 'g_5_dest_esq')
//   - '2', '3', '4': legado — número de colunas (string ou number)
export function calcularBoxes(quantidade, areaX, areaY, areaW, areaH, modoGrade = 'automatico', boxesEstilo = 'inteligente', modelo = null) {
  // 1) Se for um layout NOMEADO compatível, usa ele.
  //    - Layouts de GRID: precisam quantidade EXATA
  //    - Layouts de LISTA: aceita qualquer quantidade <= limite (linhas vazias preenchem)
  const layoutNomeado = LAYOUTS_NOMEADOS.find(l => l.id === modoGrade);
  if (layoutNomeado && layoutNomeado.boxes) {
    const matchExato = layoutNomeado.quantidade === quantidade;
    const matchListaFlex = layoutNomeado.tipo === 'lista' && quantidade > 0 && quantidade <= layoutNomeado.quantidade;
    if (matchExato || matchListaFlex) {
      if (layoutNomeado.tipo === 'lista') {
        // Pra listas, recalcula row height baseado na quantidade REAL (sem rows vazias)
        return { boxes: calcularBoxesLista(layoutNomeado, areaX, areaY, areaW, areaH, quantidade), cols: layoutNomeado.cols, rows: quantidade, tipo: 'lista' };
      }
      return { boxes: calcularBoxesPorLayout(layoutNomeado, areaX, areaY, areaW, areaH, modelo), cols: layoutNomeado.cols, rows: layoutNomeado.rows };
    }
  }

  // 2) Se modoGrade é um id de layout NOMEADO mas quantidade NÃO bate, cai pra automático
  // (sem isso, parseInt('g_18_...') = NaN, e cols vira 2 por default — bug do 2×8 grid)
  const eId = layoutNomeado != null;  // achou pelo id mas quantidade não bate
  const modoEfetivo = eId ? 'automatico' : modoGrade;

  // 3) Modo "automatico": tenta usar o layout NOMEADO PREFERIDO pra essa quantidade.
  //    PRIORIDADE: grade exclusiva do modelo atual (apenasFormatos inclui modelo) >
  //                AUTO_LAYOUT_POR_QUANTIDADE genérico.
  //    Ex: STORIES + 3 produtos → g_1x3 (apenasFormatos: ['STORIES']) em vez de g_3x1.
  if ((modoEfetivo === 'automatico' || modoEfetivo === 'auto')) {
    const modeloSpecific = modelo && LAYOUTS_NOMEADOS.find(l =>
      l.boxes && l.quantidade === quantidade && l.apenasFormatos?.includes(modelo)
    );
    if (modeloSpecific) {
      return { boxes: calcularBoxesPorLayout(modeloSpecific, areaX, areaY, areaW, areaH, modelo), cols: modeloSpecific.cols, rows: modeloSpecific.rows };
    }
    const idAuto = AUTO_LAYOUT_POR_QUANTIDADE[quantidade];
    if (idAuto) {
      const layoutAuto = LAYOUTS_NOMEADOS.find(l => l.id === idAuto);
      if (layoutAuto && layoutAuto.boxes) {
        if (layoutAuto.tipo === 'lista') {
          return { boxes: calcularBoxesLista(layoutAuto, areaX, areaY, areaW, areaH, quantidade), cols: layoutAuto.cols, rows: quantidade, tipo: 'lista' };
        }
        return { boxes: calcularBoxesPorLayout(layoutAuto, areaX, areaY, areaW, areaH, modelo), cols: layoutAuto.cols, rows: layoutAuto.rows };
      }
    }
  }

  // 4) Modo "automatico" + estilo "inteligente": usa assimétrico LEGADO se disponível
  //    (apenas pra quantidades sem mapeamento em AUTO_LAYOUT_POR_QUANTIDADE)
  if ((modoEfetivo === 'automatico' || modoEfetivo === 'auto') && boxesEstilo === 'inteligente' && LAYOUTS_ASSIMETRICOS[quantidade]) {
    const layout = LAYOUTS_ASSIMETRICOS[quantidade];
    return { boxes: calcularBoxesPorLayout({ ...layout, quantidade }, areaX, areaY, areaW, areaH, modelo), cols: layout.cols, rows: layout.rows };
  }

  // 5) Fallback: grade simétrica baseada em modoEfetivo (auto ou número de cols)
  const { cols, rows } = calcularGrade(quantidade, modoEfetivo === 'automatico' ? 'automatico' : modoEfetivo);
  const gap = 8;
  const boxW = (areaW - gap * (cols + 1)) / cols;
  const boxH = (areaH - gap * (rows + 1)) / rows;

  const boxes = [];
  for (let i = 0; i < quantidade; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    boxes.push({
      x: areaX + gap + col * (boxW + gap),
      y: areaY + gap + row * (boxH + gap),
      w: boxW,
      h: boxH,
      indice: i,
      destaque: false,
      cellW: boxW,
      cellH: boxH,
      multNome: 1.0, multValor: 1.0, multBalao: 1.0, multFoto: 1.0,
    });
  }
  return { boxes, cols, rows };
}

// Calcula boxes baseado em um layout nomeado (com estrutura {col, row, colSpan, rowSpan})
function calcularBoxesPorLayout(layout, areaX, areaY, areaW, areaH, modelo = null) {
  const gap = 8;
  const colW = (areaW - gap * (layout.cols + 1)) / layout.cols;
  const rowH = (areaH - gap * (layout.rows + 1)) / layout.rows;

  // Per-modelo: cada modelo pode ter overrides isolados em `perModelo[MODELO]`.
  // Resolução: box.perModelo[modelo].X > box.X > layout.perModelo[modelo].X > layout.X > default.
  // Mexer no override de um modelo NÃO afeta os outros.
  const layoutMod = (modelo && layout.perModelo && layout.perModelo[modelo]) || {};
  const pick = (b, bMod, key, def) => {
    if (bMod && bMod[key] !== undefined) return bMod[key];
    if (b[key] !== undefined) return b[key];
    if (layoutMod[key] !== undefined) return layoutMod[key];
    if (layout[key] !== undefined) return layout[key];
    return def;
  };

  return layout.boxes.map((b, i) => {
    const bMod = (modelo && b.perModelo && b.perModelo[modelo]) || null;
    return {
      x: areaX + gap + b.col * (colW + gap),
      y: areaY + gap + b.row * (rowH + gap),
      w: b.colSpan * colW + (b.colSpan - 1) * gap,
      h: b.rowSpan * rowH + (b.rowSpan - 1) * gap,
      indice: i,
      // destaque: SÓ é destaque quando o box marca `destaque: true` EXPLICITAMENTE.
      // Antes havia auto-detect por span (colSpan>1 || rowSpan>1), mas isso marcava
      // produtos normais como destaque erroneamente (cards grandes ≠ destaque).
      // Todos os layouts têm o flag explícito agora.
      destaque: b.destaque === true,
      cellW: colW,
      cellH: rowH,
      // layoutTipo pode ser sobrescrito per-modelo (ex: 'horizontal-topo' por padrão
      // mas null/default no STORIES pra usar renderizarBoxProduto estilo qrofertas).
      layoutTipo: (bMod && 'layoutTipo' in bMod) ? bMod.layoutTipo
                : (layoutMod && 'layoutTipo' in layoutMod) ? layoutMod.layoutTipo
                : b.layoutTipo,
      // Multiplicadores (per box ou per layout, com override per-modelo)
      multNome:  pick(b, bMod, 'multNome',  1.0),
      multValor: pick(b, bMod, 'multValor', 1.0),
      multBalao: pick(b, bMod, 'multBalao', 1.0),
      multFoto:  pick(b, bMod, 'multFoto',  1.0),
      // Flags opcionais que renderers usam pra comportamento smart/override
      smartFoto: pick(b, bMod, 'smartFoto', false),
      balaoFixo: pick(b, bMod, 'balaoFixo', false),
      // fotoPosY: 0=topo, 0.5=centro, 1=embaixo. Sobrescreve fatorTopoFoto do renderer.
      fotoPosY: pick(b, bMod, 'fotoPosY', null),
      // balaoOffsetY: fração da altura do card pra SUBIR o balão (positivo=sobe). Suportado no renderer padrão.
      balaoOffsetY: pick(b, bMod, 'balaoOffsetY', 0),
      // nomeOffsetTop: fração da nomeAreaH adicionada no topo (0=colado, 0.5=meio nome).
      nomeOffsetTop: pick(b, bMod, 'nomeOffsetTop', 0),
      // balaoAlignX: 0=esquerda, 0.5=centro (default), 1=direita.
      balaoAlignX: pick(b, bMod, 'balaoAlignX', null),
      // fotoOffsetX: fração da área da foto pra deslocar lateralmente (suportado em horizontal-topo).
      fotoOffsetX: pick(b, bMod, 'fotoOffsetX', 0),
      // nomeAlignX: 0=esquerda (default), 0.5=centro, 1=direita (suportado em card-foto-topo).
      nomeAlignX: pick(b, bMod, 'nomeAlignX', null),
      forceFundoColor: pick(b, bMod, 'forceFundoColor', null),
    };
  });
}

// Lista (tabela horizontal): cada produto vira uma linha bem larga e baixa.
// Reserva espaço no topo pro header "Produtos | Por" (renderizado em renderizarEncarte).
// qtdReal: quantidade real de produtos (pode ser menor que layout.rows).
const HEADER_TABELA_H = 50;
function calcularBoxesLista(layout, areaX, areaY, areaW, areaH, qtdReal) {
  const bodyAreaY = areaY + HEADER_TABELA_H;
  const bodyAreaH = areaH - HEADER_TABELA_H;
  const numRows = qtdReal || layout.rows;  // usa quantidade real se passada
  const rowH = bodyAreaH / numRows;
  // Gera N boxes (igual ao número real de produtos, não ao max do layout)
  return Array.from({ length: numRows }, (_, i) => ({
    x: areaX,
    y: bodyAreaY + i * rowH,
    w: areaW,
    h: rowH,
    indice: i,
    destaque: false,
    tipo: 'lista',
    cellW: areaW,
    cellH: rowH,
    multNome:  layout.multNome  ?? 1.0,
    multValor: layout.multValor ?? 1.0,
    multBalao: layout.multBalao ?? 1.0,
    multFoto:  layout.multFoto  ?? 1.0,
  }));
}

// Exporta as constantes/dimensões do header pra renderizarEncarte usar
export const TABELA_HEADER_H = HEADER_TABELA_H;

// ============================================================================
// 🔒 NÍVEL 2 — BASE GLOBAL TRAVADA (NÃO MEXER)
// ----------------------------------------------------------------------------
// Estes valores afetam TODAS as grades de uma vez. Foram fixados em 2026-05-14
// como base neutra estável. Pra ajustar tamanho de uma grade específica, mexa
// SOMENTE nos multiplicadores (multNome/multBalao/multValor/multFoto) DO BOX
// daquela grade — isso é o Nível 1 (individual, não afeta outras grades).
//
// Só altere o TAMANHOS_TEXTO abaixo se quiser recalibrar o site INTEIRO.
// ============================================================================
// Tamanhos do texto do produto — controlado via ConfigBar (Texto: pequeno/médio/grande).
// Médio é o padrão. Calibrado pra ter diferenças visíveis mas sem extremos.
export const TAMANHOS_TEXTO = {
  pequeno: { nome: 12, preco: 31, tag: 14 },  // preço 26 → 31 (+20%)
  medio:   { nome: 16, preco: 60, tag: 36 },  // PADRÃO — preço 50 → 60 (+20%)
  grande:  { nome: 24, preco: 72, tag: 38 },  // preço 60 → 72 (+20%)
};

// Paletas harmoniosas — fundo do card combina com a tag de preço sem contraste exagerado.
export const PALETAS_PREDEFINIDAS = {
  inteligente: null,
  vermelho: { fundoBox: '#fbbf24', fundoBoxSecundario: '#fbbf24', tagPreco: '#dc2626', textoPreco: '#ffffff', textoNome: '#1f2937' },
  azul:     { fundoBox: '#bfdbfe', fundoBoxSecundario: '#bfdbfe', tagPreco: '#1d4ed8', textoPreco: '#ffffff', textoNome: '#1e3a8a' },
  verde:    { fundoBox: '#bbf7d0', fundoBoxSecundario: '#bbf7d0', tagPreco: '#15803d', textoPreco: '#ffffff', textoNome: '#14532d' },
  preto:    { fundoBox: '#fbbf24', fundoBoxSecundario: '#fbbf24', tagPreco: '#1f2937', textoPreco: '#fbbf24', textoNome: '#1f2937' },
  rosa:     { fundoBox: '#fbcfe8', fundoBoxSecundario: '#fbcfe8', tagPreco: '#db2777', textoPreco: '#ffffff', textoNome: '#831843' },
};
