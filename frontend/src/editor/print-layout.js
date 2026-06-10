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

// Altura padrão da aba de dobra (em mm). Espaço reservado NO TOPO da arte
// pra faixa "Dobre Aqui" — quando dobrada, vira gancho pra pendurar o cartaz
// na gôndola do supermercado pelo topo. Padrão 12mm (~1.2cm).
export const LARGURA_ABA_DOBRA_MM = 12;

// === API principal: calcula tudo o que o PDF precisa saber ===
//
// Entrada:
//   - papel: 'A4' | 'A3' | 'A5' | 'CARTA'
//   - orientacao: 'retrato' | 'paisagem'
//   - qtdArtes: 1, 2, 4, 6, 9, 12, 16 ou 20
//   - margens: { top, bottom, left, right } em mm
//   - espacamento: mm entre as artes
//   - arteAspectRatio: width/height da arte original (px)
//   - abaDobra: bool — reserva espaço lateral pra faixa "Dobre Aqui"
//   - larguraAbaDobra: mm de largura da aba (default 12)
//
// Saída:
//   {
//     papel: { largura, altura },         // mm
//     orientacao, qtdArtes, margens, espacamento, abaDobra,
//     cols, rows,                          // distribuição da grade
//     arteW, arteH,                        // mm de cada arte (já com aspect ratio)
//     areaUtil: { x, y, w, h },           // área útil dentro das margens (mm)
//     posicoes: [{                         // posição de cada arte na folha (mm)
//       x, y, w, h, idx,                  // arte propriamente dita
//       abaX, abaY, abaW, abaH,           // posição da faixa "Dobre Aqui" (se abaDobra)
//     }],
//   }
export function calcularLayoutImpressao({
  papel = 'A4',
  orientacao = 'retrato',
  qtdArtes = 2,
  margens = MARGENS_PRESETS.normal,
  espacamento = 0,
  arteAspectRatio = 794 / 1123,  // default A4 retrato em px
  abaDobra = false,
  larguraAbaDobra = LARGURA_ABA_DOBRA_MM,
}) {
  const p = PAPEIS[papel] || PAPEIS.A4;
  const isRetrato = orientacao !== 'paisagem';
  const papelW = isRetrato ? p.largura : p.altura;
  const papelH = isRetrato ? p.altura : p.largura;

  const areaW = papelW - margens.left - margens.right;
  const areaH = papelH - margens.top - margens.bottom;

  // Aba de dobra TOPO: reserva mm no topo de cada célula pra faixa "Dobre Aqui"
  // (cartaz pendurado pelo topo na gôndola). Reduz altura útil da arte.
  const reservaAbaTop = abaDobra ? larguraAbaDobra : 0;

  // 🔄 ROTAÇÃO AUTOMÁTICA pra melhor aproveitamento da folha:
  // Avalia tanto o aspect ORIGINAL quanto o ROTACIONADO 90° e escolhe o que
  // dá maior área de arte. Ex: encarte horizontal (16:9) em folha A4 retrato
  // (1:1.4): se rotacionar, ganha mais área. Espelha o comportamento qrofertas.
  const tentarRotacionar = (aspect) => {
    const combo = escolherMelhorCombo(areaW, areaH, qtdArtes, aspect, espacamento);
    const celW = (areaW - espacamento * (combo.cols - 1)) / combo.cols;
    const celH = (areaH - espacamento * (combo.rows - 1)) / combo.rows;
    const arteAreaW = celW;
    const arteAreaH = celH - reservaAbaTop;
    let aw, ah;
    if (aspect > arteAreaW / arteAreaH) { aw = arteAreaW; ah = aw / aspect; }
    else { ah = arteAreaH; aw = ah * aspect; }
    return { combo, celW, celH, arteW: aw, arteH: ah, area: aw * ah };
  };
  const normal     = tentarRotacionar(arteAspectRatio);
  const rotacionado = tentarRotacionar(1 / arteAspectRatio);
  // Só rotaciona se ganho de área for significativo (>5%). Evita rotações
  // mínimas que confundem o user.
  const usarRotacao = rotacionado.area > normal.area * 1.05;
  const escolhido = usarRotacao ? rotacionado : normal;
  const combo = escolhido.combo;
  const celulaW = escolhido.celW;
  const celulaH = escolhido.celH;
  const arteW = escolhido.arteW;
  const arteH = escolhido.arteH;
  const arteAreaW = celulaW;
  const arteAreaH = celulaH - reservaAbaTop;

  // Centraliza arte dentro da área disponível (abaixo da aba se houver)
  const offsetX = (arteAreaW - arteW) / 2;
  const offsetY = (arteAreaH - arteH) / 2;

  const posicoes = [];
  for (let r = 0; r < combo.rows; r++) {
    for (let c = 0; c < combo.cols; c++) {
      const celulaX = margens.left + c * (celulaW + espacamento);
      const celulaY = margens.top + r * (celulaH + espacamento);
      const pos = {
        // Quando tem aba, a arte fica EMPURRADA pra baixo (após a aba do topo)
        x: celulaX + offsetX,
        y: celulaY + reservaAbaTop + offsetY,
        w: arteW,
        h: arteH,
        idx: r * combo.cols + c,
      };
      // Aba ocupa o TOPO da célula (acima da arte), full width pra encaixar dobra
      if (abaDobra) {
        // Aba ocupa toda largura da arte (não da célula) pra ficar visualmente
        // ligada à arte abaixo. Posicionada imediatamente acima.
        pos.abaX = pos.x;
        pos.abaY = celulaY + offsetY; // mesmo Y onde arte começaria sem aba
        pos.abaW = arteW;
        pos.abaH = reservaAbaTop;
      }
      posicoes.push(pos);
    }
  }

  return {
    papel: { largura: papelW, altura: papelH, nome: p.nome },
    orientacao,
    qtdArtes,
    margens,
    espacamento,
    abaDobra,
    larguraAbaDobra: reservaAbaTop,
    cols: combo.cols,
    rows: combo.rows,
    arteW,
    arteH,
    celulaW,
    celulaH,
    arteRotacionada: usarRotacao,  // flag pra render rotacionar a arte 90°
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
