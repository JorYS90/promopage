// Cálculo de layout de impressão — dado papel/orientação/N-artes-por-folha,
// calcula a melhor distribuição (linhas × colunas) e tamanho de cada arte.
//
// Usado pelo Gestor de Impressões pra montar PDF multi-página com N artes
// por folha, respeitando margens e espaçamento entre artes.

// === Tamanhos de papel em mm (padrões ABNT/ISO) ===
export const PAPEIS = {
  A4:    { largura: 210, altura: 297, nome: 'A4',    label: '210 × 297 mm' },
  A3:    { largura: 297, altura: 420, nome: 'A3',    label: '297 × 420 mm' },
  A5:    { largura: 148, altura: 210, nome: 'A5',    label: '148 × 210 mm' },
  CARTA: { largura: 216, altura: 279, nome: 'CARTA', label: '216 × 279 mm' },
};

// === Margens predefinidas em mm ===
export const MARGENS_PRESETS = {
  sem_margem: { top: 0,  bottom: 0,  left: 0,  right: 0,  label: 'Sem margens' },
  estreita:   { top: 5,  bottom: 5,  left: 5,  right: 5,  label: 'Estreita' },
  normal:     { top: 10, bottom: 10, left: 10, right: 10, label: 'Normal' },
  larga:      { top: 20, bottom: 20, left: 20, right: 20, label: 'Larga' },
};

// === Quantidade de artes por folha (popular = 2) ===
export const QUANTIDADES_ARTES = [
  { qtd: 1,  label: '1' },
  { qtd: 2,  label: '2', popular: true },
  { qtd: 4,  label: '4' },
  { qtd: 6,  label: '6' },
  { qtd: 9,  label: '9' },
  { qtd: 12, label: '12' },
  { qtd: 16, label: '16' },
  { qtd: 20, label: '20' },
];

// Combinações pré-definidas de (cols × rows) por qtd — escolhemos o que melhor
// aproveita a folha A4. Pra orientações diferentes invertemos cols/rows.
const COMBOS = {
  1:  [{ cols: 1, rows: 1 }],
  2:  [{ cols: 1, rows: 2 }, { cols: 2, rows: 1 }],
  4:  [{ cols: 2, rows: 2 }],
  6:  [{ cols: 2, rows: 3 }, { cols: 3, rows: 2 }],
  9:  [{ cols: 3, rows: 3 }],
  12: [{ cols: 3, rows: 4 }, { cols: 4, rows: 3 }],
  16: [{ cols: 4, rows: 4 }],
  20: [{ cols: 4, rows: 5 }, { cols: 5, rows: 4 }],
};

// Calcula o melhor combo (rows × cols) pra dado:
//  - papel (largura × altura em mm)
//  - quantidade de artes
//  - aspect ratio da arte (largura/altura em pixels)
// Retorna o combo que dá maior área individual por arte (sobra menos espaço).
function escolherMelhorCombo(papelW, papelH, qtdArtes, artAspectRatio, espacamento) {
  const combos = COMBOS[qtdArtes] || [{ cols: 1, rows: qtdArtes }];
  let melhor = null;
  let maiorArea = 0;
  for (const c of combos) {
    const arteW = (papelW - espacamento * (c.cols - 1)) / c.cols;
    const arteH = (papelH - espacamento * (c.rows - 1)) / c.rows;
    // Aplica aspect ratio: se a arte é "mais alta" que a célula, encolhe pela altura.
    let realW, realH;
    if (artAspectRatio > arteW / arteH) {
      // arte mais larga que célula — limita largura
      realW = arteW;
      realH = realW / artAspectRatio;
    } else {
      realH = arteH;
      realW = realH * artAspectRatio;
    }
    const area = realW * realH;
    if (area > maiorArea) { maiorArea = area; melhor = { ...c, arteW: realW, arteH: realH }; }
  }
  return melhor;
}

// === API principal: calcula tudo o que o PDF precisa saber ===
//
// Entrada:
//   - papel: 'A4' | 'A3' | 'A5' | 'CARTA'
//   - orientacao: 'retrato' | 'paisagem'
//   - qtdArtes: 1, 2, 4, 6, 9, 12, 16 ou 20
//   - margens: { top, bottom, left, right } em mm
//   - espacamento: mm entre as artes
//   - arteAspectRatio: width/height da arte original (px)
//
// Saída:
//   {
//     papel: { largura, altura },         // mm
//     orientacao, qtdArtes, margens, espacamento,
//     cols, rows,                          // distribuição da grade
//     arteW, arteH,                        // mm de cada arte (já com aspect ratio)
//     areaUtil: { x, y, w, h },           // área útil dentro das margens (mm)
//     posicoes: [{ x, y, w, h, idx }],   // posição de cada arte na folha (mm)
//   }
export function calcularLayoutImpressao({
  papel = 'A4',
  orientacao = 'retrato',
  qtdArtes = 2,
  margens = MARGENS_PRESETS.normal,
  espacamento = 0,
  arteAspectRatio = 794 / 1123,  // default A4 retrato em px
}) {
  const p = PAPEIS[papel] || PAPEIS.A4;
  const isRetrato = orientacao !== 'paisagem';
  const papelW = isRetrato ? p.largura : p.altura;
  const papelH = isRetrato ? p.altura : p.largura;

  const areaW = papelW - margens.left - margens.right;
  const areaH = papelH - margens.top - margens.bottom;

  const combo = escolherMelhorCombo(areaW, areaH, qtdArtes, arteAspectRatio, espacamento);

  // Largura/altura de cada CÉLULA (a arte preenche dentro respeitando aspect)
  const celulaW = (areaW - espacamento * (combo.cols - 1)) / combo.cols;
  const celulaH = (areaH - espacamento * (combo.rows - 1)) / combo.rows;

  // Centraliza arte dentro da célula
  const offsetX = (celulaW - combo.arteW) / 2;
  const offsetY = (celulaH - combo.arteH) / 2;

  const posicoes = [];
  for (let r = 0; r < combo.rows; r++) {
    for (let c = 0; c < combo.cols; c++) {
      posicoes.push({
        x: margens.left + c * (celulaW + espacamento) + offsetX,
        y: margens.top + r * (celulaH + espacamento) + offsetY,
        w: combo.arteW,
        h: combo.arteH,
        idx: r * combo.cols + c,
      });
    }
  }

  return {
    papel: { largura: papelW, altura: papelH, nome: p.nome },
    orientacao,
    qtdArtes,
    margens,
    espacamento,
    cols: combo.cols,
    rows: combo.rows,
    arteW: combo.arteW,
    arteH: combo.arteH,
    celulaW,
    celulaH,
    areaUtil: { x: margens.left, y: margens.top, w: areaW, h: areaH },
    posicoes,
  };
}

// Helper: descreve a distribuição em texto humano
// Ex: "1 × 2 (2 células) no papel A4 retrato"
export function descreverLayout(layout) {
  const orientLabel = layout.orientacao === 'paisagem' ? 'paisagem' : 'retrato';
  const celulas = layout.cols * layout.rows;
  return `${layout.rows} × ${layout.cols} (${celulas} célula${celulas !== 1 ? 's' : ''}) no papel ${layout.papel.nome} ${orientLabel}, com aproveitamento máximo da arte.`;
}
