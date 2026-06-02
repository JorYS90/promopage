import { fabric } from 'fabric';
import { calcularBoxes, TAMANHOS_TEXTO, PALETAS_PREDEFINIDAS, TABELA_HEADER_H } from './auto-layout.js';
import { obterFormaPagamento } from '../components/formas-pagamento.js';

// ============================================================================
// 🔒 NÍVEL 2 — FÓRMULAS BASE DOS RENDERIZADORES (TRAVADO — NÃO MEXER)
// ----------------------------------------------------------------------------
// As constantes de fonte dentro das funções renderizar* deste arquivo
// (ex: `nomeAreaH * 0.73`, `bottomH * 0.75`, `ts.preco * ... * 1.56`)
// afetam TODAS as grades de uma vez. Foram fixadas em 2026-05-14 como base
// neutra estável.
//
// ⚠️ Pra ajustar o tamanho de UMA grade específica, NÃO mexa aqui.
//    Mexa nos multiplicadores do BOX daquela grade em auto-layout.js:
//      multNome / multBalao / multValor / multFoto  (Nível 1 — isolado)
//
// Só altere as fórmulas base se quiser recalibrar o site INTEIRO.
// ============================================================================

// Multiplicadores de fonte POR FORMATO. Permite ajustar cada modelo individualmente
// sem afetar os outros. Ajuste fino: aumenta/diminui as fontes do encarte só naquele formato.
const FONTE_MULTIPLICADOR_POR_FORMATO = {
  FACEBOOK_QUADRADO: 1.10,  // ajustado fino
  STORIES:           0.82,  // diminuído pra acomodar o aspecto vertical alto
  REELS_INSTAGRAM:   1.00,  // referência
  ENCARTE_GRANDE:    0.92,  // levemente menor — canvas grande mas com muitos produtos
  A4_RETRATO:        0.92,  // levemente menor — cards mais estreitos no vertical
  A4_PAISAGEM:       1.33,  // bem maior — cards mais largos
  CARTAZ_VERTICAL:   0.92,  // mesmo do A4 retrato
  CARTAZ_HORIZONTAL: 1.33,  // mesmo do A4 paisagem
  TV_HORIZONTAL:     1.33,  // bem maior — cards bem espaçosos
  TV_VERTICAL:       0.82,  // diminuído — vertical alto
};

// Compara duas cores hex e retorna distância no espaço RGB (0-441 aprox).
// Usado pra detectar quando fundoBox e corPrimaria são tão similares que
// destaque e não-destaque ficam visualmente iguais.
function distanciaCor(a, b) {
  if (!a || !b) return Infinity;
  const parse = (h) => {
    const c = (h || '').replace('#', '').slice(0, 6);
    if (c.length !== 6) return null;
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  };
  const c1 = parse(a), c2 = parse(b);
  if (!c1 || !c2) return Infinity;
  return Math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2);
}
// IA de contraste: dado uma cor de fundo, retorna preto (#1f2937) pra fundos
// claros e branco (#ffffff) pra fundos escuros. Aceita hex, rgb/rgba, ou
// transparent. Difere de corTextoContraste(): retorna #1f2937 (preto suave)
// em vez de #000000 puro pra ficar mais agradável visualmente em cards.
//
// REGRAS DE NEGÓCIO (override de luminância):
//   - Cor REDDISH (R dominante) → SEMPRE branco. Resolve casos como pílula
//     vermelha onde luminância pode dar threshold borderline mas o "padrão"
//     visual de catálogo é sempre texto branco em vermelho.
//   - Cor amarela / clara → preto (via luminância)
function corContrastanteParaTexto(corFundo, claro = '#ffffff', escuro = '#1f2937') {
  if (!corFundo || corFundo === 'transparent') return escuro;
  let r, g, b;
  // rgb()/rgba() — pra fundos com aplicarAlpha
  const m = String(corFundo).match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    r = +m[1]; g = +m[2]; b = +m[3];
  } else {
    let hex = String(corFundo).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length < 6) return escuro;
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return escuro;
  }
  // OVERRIDE 1: Reddish dominante (R > G e R > B por margem) → SEMPRE branco.
  // Cobre #ef0000, #cc0000, #ff5544, #d22, etc — qualquer pílula vermelha.
  if (r > g + 40 && r > b + 40 && r > 130) return claro;
  // OVERRIDE 2: Azul/roxo escuro → branco também
  if (b > 100 && r < b && g < b && (r + g + b) < 360) return claro;
  // Caso geral: luminância (ITU-R BT.709). Threshold 0.55.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? escuro : claro;
}

// Variante PERMISSIVA da IA: threshold 0.70 (vs 0.55 do padrão). Retorna
// branco em mais casos — útil pra pílulas/banners de preço coloridos onde o
// padrão de catálogo é texto branco (mesmo em verdes/amarelo-esverdeados que
// teriam luminância no meio). Reservar pra balão/banner; pra TEXTO sobre
// fundos claros (nome do produto), usar a versão padrão.
function corContrastanteParaTextoPermissivo(corFundo, claro = '#ffffff', escuro = '#1f2937') {
  if (!corFundo || corFundo === 'transparent') return escuro;
  let r, g, b;
  const m = String(corFundo).match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    r = +m[1]; g = +m[2]; b = +m[3];
  } else {
    let hex = String(corFundo).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length < 6) return escuro;
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return escuro;
  }
  // Reddish dominante → sempre branco
  if (r > g + 40 && r > b + 40 && r > 130) return claro;
  // Threshold 0.75 — só amarelo MUITO claro e branco-cinza ficam escuros
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.75 ? escuro : claro;
}

// Se a cor for similar ao contraste (distância < 220 OU ambas reddish ESTRITO),
// retorna o fallback contrastante.
function corContrastanteSeNecessario(cor, corContraste, fallback = '#fde047') {
  if (distanciaCor(cor, corContraste) < 220) return fallback;
  const parseRGB = (h) => {
    const c = (h || '').replace('#', '').slice(0, 6);
    if (c.length !== 6) return null;
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  };
  const c1 = parseRGB(cor), c2 = parseRGB(corContraste);
  if (c1 && c2) {
    // ESTRITO: reddish = R dominante E G/B BAIXOS (<110). Antes pegava amarelo
    // (R alto, G alto) por engano.
    const isReddishEstrito = ([r, g, b]) =>
      r > g + 50 && r > b + 50 && r > 120 && g < 110 && b < 110;
    if (isReddishEstrito(c1) && isReddishEstrito(c2)) return fallback;
  }
  return cor;
}

// Aplica transparência (alpha 0..1) a uma cor — aceita hex (#rrggbb), rgb(), ou retorna a cor sem alpha
function aplicarAlpha(cor, alpha) {
  if (!cor || cor === 'transparent') return cor;
  // Hex (#rrggbb ou #rrggbbaa)
  const hex = cor.replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // Já é rgba/rgb? Substitui o alpha
  const m = cor.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map(s => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return cor;
}

// Cache de bbox não-transparente por URL — evita recomputar pra cada produto.
const CACHE_BBOX_BALAO = new Map();

// ===== HELPERS DE FAIXA DE OBSERVAÇÃO (ex: "data curta", "últimas unidades") =====
// Centraliza cálculo + render pra todos os renderers de card (renderizarBoxProduto,
// CardBanner, HorizontalTopo, DestaqueMaximo, etc.). A faixa fica ABAIXO do balão
// de preço, dentro do card, em magenta com texto branco bold.

// Calcula altura/fonte da faixa de observação. Usado pelos renderers ANTES de
// posicionar o tagY do balão — assim o balão sobe pra dar espaço pra faixa.
// Retorna { temObs, obsTexto, obsFonte, obsAltura, obsGap }.
function calcularObsFaixa(produto, fonteValor) {
  const obsTexto = (produto?.observacao || '').trim();
  const temObs = !!obsTexto;
  const obsFonte = temObs ? Math.max(11, fonteValor * 0.32) : 0;
  const obsAltura = temObs ? obsFonte * 1.7 : 0;
  const obsGap = temObs ? 4 : 0;
  return { temObs, obsTexto, obsFonte, obsAltura, obsGap };
}

// Determina cor inteligente da faixa de observação baseada nas cores do tema.
// Prioridade: tema define explicitamente uma cor SECUNDÁRIA que harmoniza com o balão.
// - Se tema tem cor "tagPrecoSecundaria" → usa direto
// - Senão, escurece/aclara levemente o tagPreco pra criar contraste sutil dentro
//   da mesma família cromática (faixa fica "irmã" do balão)
// - Texto: contraste automático contra a cor escolhida
function escolherCorFaixaObs(paleta) {
  // 1. Cor explícita do tema (futuro)
  if (paleta?.obsFaixa) {
    return {
      fundo: paleta.obsFaixa,
      texto: paleta.obsFaixaTexto || corContrastanteParaTexto(paleta.obsFaixa),
    };
  }
  // 2. Deriva do tagPreco: usa a MESMA cor do balão (faixa parece extensão)
  const base = paleta?.tagPreco || '#ec4899';
  // Texto: contraste forte (branco em fundos escuros, escuro em fundos claros)
  const texto = paleta?.textoPreco
    || paleta?.textoPrecoDestaque
    || corContrastanteParaTexto(base);
  return { fundo: base, texto };
}

// Renderiza um selo circular "+18" no canto superior direito do card quando o
// produto está marcado como `maioresDe18`. Visual: círculo vermelho com borda
// branca + sombra sutil + texto "+18" branco bold no centro. Aplicável a qualquer
// layout — chamado pelos renderers de card após desenhar o conteúdo principal.
// Renderiza o selo "XX% OFF" amarelo posicionado ACIMA do balão de preço.
// Se `tagBox` (posição do balão) for fornecido, ancora o selo no canto superior
// direito do balão. Se não, fallback no canto superior direito do card.
function renderizarSeloDesconto(canvas, box, produto, tagBox = null) {
  const pct = produto?.desconto?.percentual;
  if (!pct) return;
  // Tamanho proporcional à menor dimensão do card (mesmo critério do +18)
  const ref = Math.min(box.w, box.h);
  const dRaio = Math.max(20, Math.min(50, ref * 0.115));
  const dFonte = dRaio / 1.6;
  const margem = Math.max(6, dRaio * 0.20);
  let dX, dY;
  if (tagBox && Number.isFinite(tagBox.x) && Number.isFinite(tagBox.y)) {
    // Acima do balão: alinhado ao canto direito do balão, raio acima do topo.
    // Sobrepõe levemente o balão (cy = tagBox.y) pra parecer "selo grudado" no balão.
    dX = tagBox.x + tagBox.w - dRaio * 0.3;
    dY = tagBox.y - dRaio * 0.3;
    // Clampa pra não sair do card pelo topo
    if (dY - dRaio < box.y) dY = box.y + dRaio + 2;
    // Clampa pra não sair pelo lado direito
    if (dX + dRaio > box.x + box.w) dX = box.x + box.w - dRaio - 2;
  } else {
    // Fallback: canto superior direito do card
    dX = box.x + box.w - dRaio - margem;
    dY = box.y + dRaio + margem;
  }
  const seloCirc = new fabric.Circle({
    left: dX, top: dY,
    radius: dRaio,
    originX: 'center', originY: 'center',
    fill: '#fbbf24',
    stroke: '#ffffff', strokeWidth: 3,
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 6, offsetY: 2 }),
    selectable: false, evented: false,
  });
  canvas.add(seloCirc);
  // "XX%" um pouco menor pra abrir respiração entre as 2 linhas
  const fontePct = dFonte * 0.85;
  const fonteOff = dFonte * 0.45;
  const seloPct = new fabric.Text(`${pct}%`, {
    left: dX,
    top: dY - fontePct * 0.78,  // sobe mais (centro da linha de cima)
    fontSize: fontePct,
    fontFamily: _FONTE_PRECO_HELPER,
    fontWeight: 900,
    fill: '#1f2937',
    originX: 'center',
    selectable: false, evented: false,
  });
  canvas.add(seloPct);
  const seloOff = new fabric.Text('OFF', {
    left: dX,
    top: dY + fonteOff * 0.10,  // desce (deixa gap maior entre % e OFF)
    fontSize: fonteOff,
    fontFamily: _FONTE_PRECO_HELPER,
    fontWeight: 900,
    fill: '#1f2937',
    originX: 'center',
    selectable: false, evented: false,
  });
  canvas.add(seloOff);
  canvas.bringToFront(seloCirc);
  canvas.bringToFront(seloPct);
  canvas.bringToFront(seloOff);
}

function renderizarSeloMaior18(canvas, box, produto) {
  if (!produto?.maioresDe18) return;
  // Tamanho: ~10% da menor dimensão do card, clampado entre 18px e 46px.
  const ref = Math.min(box.w, box.h);
  const raio = Math.max(18, Math.min(46, ref * 0.10));
  const margem = Math.max(6, raio * 0.25);
  // Posicionado ENTRE o nome (topo) e a foto (meio), no canto DIREITO do card.
  // Y ~22% do topo deixa o selo abaixo da área do nome (~15-20%) e ao lado da
  // foto, sem cobrir o nome do produto.
  let cx = box.x + box.w - raio - margem;
  const cy = box.y + box.h * 0.22;
  if (produto.desconto?.percentual) {
    // Selo de desconto fica no canto superior direito; +18 desloca pra esquerda dele
    cx = cx - raio * 2 - 4;
  }
  const circulo = new fabric.Circle({
    left: cx, top: cy,
    radius: raio,
    originX: 'center', originY: 'center',
    fill: '#dc2626',  // vermelho forte (alerta de idade)
    stroke: '#ffffff', strokeWidth: 3,
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.35)', blur: 6, offsetY: 2 }),
    selectable: false, evented: false,
  });
  canvas.add(circulo);
  const txt = new fabric.Text('+18', {
    left: cx,
    top: cy,
    originX: 'center', originY: 'center',
    fontSize: raio * 0.85,
    fontFamily: _FONTE_PRECO_HELPER,
    fontWeight: 900,
    fill: '#ffffff',
    selectable: false, evented: false,
  });
  canvas.add(txt);
  canvas.bringToFront(circulo);
  canvas.bringToFront(txt);
}

// Renderiza a faixa com a observação dentro do card, INTEGRADA na BORDA INFERIOR
// (cola em box.y + box.h - obsAltura, sem padding abaixo). Largura total do card,
// sem stroke. Cor vem do tema via escolherCorFaixaObs(paleta).
// Retorna [bg, txt] pra que o caller possa fazer bringToFront no z-order final.
function renderizarFaixaObs(canvas, box, produto, tagY, tagAltura, fonteValor, padding, paleta) {
  const { temObs, obsTexto, obsFonte, obsAltura } = calcularObsFaixa(produto, fonteValor);
  if (!temObs) return [];
  const { fundo: corFundo, texto: corTexto } = escolherCorFaixaObs(paleta);
  // Faixa COLA na borda inferior do card pra otimizar espaço — sem padding abaixo.
  const obsY = box.y + box.h - obsAltura;
  const obsBg = new fabric.Rect({
    left: box.x,
    top: obsY,
    width: box.w,
    height: obsAltura,
    fill: corFundo,
    selectable: false, evented: false,
  });
  canvas.add(obsBg);
  const obsTxt = new fabric.Text(obsTexto, {
    left: box.x + box.w / 2,
    top: obsY + obsAltura / 2 - obsFonte * 0.55,
    fontSize: obsFonte,
    fontFamily: _FONTE_PRECO_HELPER,
    fontWeight: 'bold',
    fill: corTexto,
    originX: 'center',
    selectable: false, evented: false,
  });
  canvas.add(obsTxt);
  return [obsBg, obsTxt];
}

// ===== TRAVA DE SEGURANÇA: preço NUNCA passa do balão =====
// Recebe os objetos fabric do preço (R$, valor, centavos, unidade) JÁ criados e
// posicionados, mais os limites do balão (x, w, y, h). Mede o bounding box REAL
// do conjunto e, se estourar a borda do balão em LARGURA ou ALTURA, encolhe a
// fonte de TODOS proporcionalmente (usa a menor escala dos 2 eixos) e reposiciona
// ancorado no centro do balão. Garantia final independente do capFonteValorOverflow.
// Aplicado em TODOS os renderers de card.
function clampPrecoNoBalao(objs, tagX, tagW, tagY, tagH) {
  const validos = (objs || []).filter(Boolean);
  if (validos.length < 1) return;
  let minL = Infinity, maxR = -Infinity, minT = Infinity, maxB = -Infinity;
  for (const o of validos) {
    const w = o.width || 0;
    const h = o.height || 0;
    if (o.left < minL) minL = o.left;
    if (o.left + w > maxR) maxR = o.left + w;
    if (o.top < minT) minT = o.top;
    if (o.top + h > maxB) maxB = o.top + h;
  }
  const larguraReal = maxR - minL;
  const alturaReal = maxB - minT;
  if (larguraReal <= 0) return;
  // Margens internas do balão (5% horizontal, 10% vertical de cada lado)
  const margemX = Math.max(6, tagW * 0.05);
  const dispW = tagW - margemX * 2;
  const temAltura = Number.isFinite(tagH) && tagH > 0;
  const margemY = temAltura ? Math.max(4, tagH * 0.10) : 0;
  const dispH = temAltura ? tagH - margemY * 2 : Infinity;
  // Escala necessária pra caber em CADA eixo — usa a MENOR (pra caber nos dois)
  const escW = larguraReal > dispW ? dispW / larguraReal : 1;
  const escH = (temAltura && alturaReal > dispH) ? dispH / alturaReal : 1;
  const escala = Math.min(escW, escH);
  if (escala >= 1) return;  // já cabe nos dois eixos — nada a fazer
  // Encolhe a fonte de todos proporcionalmente e reposiciona ancorado no
  // centro do balão (X e Y), mantendo o espaçamento relativo.
  const centroTextoX = minL + larguraReal / 2;
  const centroTextoY = minT + alturaReal / 2;
  const centroBalaoX = tagX + tagW / 2;
  const centroBalaoY = temAltura ? tagY + tagH / 2 : centroTextoY;
  for (const o of validos) {
    o.set({
      left: centroBalaoX + (o.left - centroTextoX) * escala,
      top: centroBalaoY + (o.top - centroTextoY) * escala,
      fontSize: Math.max(6, (o.fontSize || 12) * escala),
    });
  }
}

// Famílias de fonte (definidas mais embaixo também, redeclaradas aqui pra disponibilidade)
const _FONTE_PRECO_HELPER = '"Helvetica Neue", Arial, Helvetica, sans-serif';
const _FONTE_PRECO_WEIGHT_HELPER = 'bold';

/**
 * Ajusta a fonte do preço pra caber EXATAMENTE dentro de um balão alvo.
 *
 * O balão é o "molde" e o texto se adapta pra encaixar com margem interna.
 * - Inicia com fonte máxima que cabe na ALTURA disponível.
 * - Se o texto excede a LARGURA, reduz proporcionalmente.
 *
 * @param {number} targetW - Largura alvo do balão (px)
 * @param {number} targetH - Altura alvo do balão (px)
 * @param {string} valorTexto - Ex: "13,99"
 * @param {string} unidAbrev - Ex: "KG"
 * @param {object} configs - Config do encarte (precoCentavosMesmoTamanho)
 * @param {CanvasRenderingContext2D} ctx - Pra medir texto
 * @returns Tudo pronto pra renderizar: fonteValor, fonteRS, fonteCentavos, etc.
 */
function ajustarPrecoParaTag(targetW, targetH, valorTexto, unidAbrev, configs = {}, ctx = null) {
  // Margem interna do balão (10% horizontal, 18% vertical)
  const margemH = 0.10;
  const margemV = 0.18;
  const maxTextW = targetW * (1 - margemH * 2);
  const maxTextH = targetH * (1 - margemV * 2);

  const [reaisTexto, centavosNum] = (valorTexto || '0,00').split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  const unidUpper = (unidAbrev || '').toUpperCase();

  const fatorRS = 0.55;
  const fatorCentavos = configs.precoCentavosMesmoTamanho ? 1.0 : 0.65;
  const fatorUnid = 0.35;

  function medir(fv) {
    if (!ctx) {
      // Fallback: estimativa grosseira
      const lr = reaisTexto.length * fv * 0.55;
      const lc = centavosTexto.length * fv * fatorCentavos * 0.55;
      const lu = unidUpper.length * fv * fatorUnid * 0.55;
      const lrs = 2 * fv * fatorRS * 0.55;
      const total = lrs + fv * 0.10 + lr + lc + (unidUpper ? fv * 0.06 : 0) + lu;
      return { total, lrs, lr, lc, lu };
    }
    ctx.save();
    ctx.font = `${_FONTE_PRECO_WEIGHT_HELPER} ${fv * fatorRS}px ${_FONTE_PRECO_HELPER}`;
    const lrs = ctx.measureText('R$').width;
    ctx.font = `${_FONTE_PRECO_WEIGHT_HELPER} ${fv}px ${_FONTE_PRECO_HELPER}`;
    const lr = ctx.measureText(reaisTexto).width;
    let lc = 0, lu = 0;
    if (temCentavos) {
      ctx.font = `${_FONTE_PRECO_WEIGHT_HELPER} ${fv * fatorCentavos}px ${_FONTE_PRECO_HELPER}`;
      lc = ctx.measureText(centavosTexto).width;
    }
    if (unidUpper) {
      ctx.font = `${_FONTE_PRECO_WEIGHT_HELPER} ${fv * fatorUnid}px ${_FONTE_PRECO_HELPER}`;
      lu = ctx.measureText(unidUpper).width;
    }
    ctx.restore();
    const espRs = fv * 0.10;
    const espUnid = unidUpper ? fv * 0.06 : 0;
    const total = lrs + espRs + lr + lc + espUnid + lu;
    return { total, lrs, lr, lc, lu, espRs, espUnid };
  }

  // Inicia pelo limite da altura disponível
  let fonteValor = maxTextH;
  let m = medir(fonteValor);

  // Se largura excede, reduz proporcionalmente
  if (m.total > maxTextW) {
    fonteValor *= maxTextW / m.total;
    m = medir(fonteValor);
  }

  return {
    fonteValor,
    fonteRS: fonteValor * fatorRS,
    fonteCentavos: fonteValor * fatorCentavos,
    fonteUnid: fonteValor * fatorUnid,
    larguraRs: m.lrs,
    larguraReais: m.lr,
    larguraCentavos: m.lc,
    larguraUnid: m.lu,
    espacoRsValor: m.espRs ?? fonteValor * 0.10,
    espacoValorUnid: m.espUnid ?? (unidUpper ? fonteValor * 0.06 : 0),
    larguraTextoTotal: m.total,
    reaisTexto, centavosTexto, temCentavos, unidUpper,
  };
}

/**
 * CAP de overflow: garante que o texto do preço caiba dentro do card.
 *
 * Recebe a fonteValor inicial (calculada pelo renderer) e retorna a MENOR
 * entre ela e a fonteValor que cabe na largura disponível. Se o texto não
 * iria estourar, retorna a fonte original. Se iria, retorna uma menor.
 *
 * Esse helper é a "margem do balão" automática — o texto se adapta ao
 * espaço disponível, sem precisar ajustar mults manualmente.
 */
function capFonteValorOverflow(fonteValor, maxLarguraDisponivel, paddingExtRel, valorTexto, unidAbrev, configs, ctx) {
  if (fonteValor <= 0) return fonteValor;
  const padRel = paddingExtRel || 0;
  // Modo PÍLULA (padRel >= 0.20): balão cresce com texto, padding = padRel * fv por lado.
  // Garante: texto + 2*padding <= maxLarguraDisponivel.
  // Como padding e texto ambos escalam linearmente com fv, resolve direto:
  //   tagW = K*fv + 2*padRel*fv = (K + 2*padRel) * fv
  //   fv <= maxLargura / (K + 2*padRel)
  // onde K = larguraTextoTotal / fv (taxa, independente de fv pra mesma string)
  if (padRel >= 0.20) {
    // Mede texto em uma fonte de referência (largura virtualmente infinita pra não capar)
    const targetH = fonteValor * 1.40;
    const ref = ajustarPrecoParaTag(
      1e7,  // largura "infinita"
      targetH, valorTexto, unidAbrev, configs, ctx
    );
    if (!ref || !ref.fonteValor || ref.fonteValor <= 0) return fonteValor;
    const K = ref.larguraTextoTotal / ref.fonteValor;
    const fvMax = maxLarguraDisponivel / (K + 2 * padRel);
    return Math.min(fonteValor, fvMax);
  }
  // Modo BALÃO IMAGEM (padRel < 0.20): maxLargura já é a largura total do balão.
  // ajustarPrecoParaTag usa 10% de margem interna por lado.
  const targetH = fonteValor * 1.40;
  const ajusteAutoFit = ajustarPrecoParaTag(
    maxLarguraDisponivel,
    targetH,
    valorTexto,
    unidAbrev,
    configs,
    ctx
  );
  return Math.min(fonteValor, ajusteAutoFit.fonteValor);
}

// Pre-carrega um balão e detecta sua bbox (aspecto natural). Cacheado por URL.
// Retorna uma Promise que resolve quando o cache está populado.
function preloadBalao(url) {
  if (!url) return Promise.resolve(null);
  if (CACHE_BBOX_BALAO.has(url)) return Promise.resolve(CACHE_BBOX_BALAO.get(url));
  return new Promise((resolve) => {
    fabric.Image.fromURL(url, (img) => {
      let bbox = null;
      if (img && img.width) {
        bbox = detectarBboxNaoTransparente(img);
      }
      CACHE_BBOX_BALAO.set(url, bbox);
      resolve(bbox);
    }, { crossOrigin: 'anonymous' });
  });
}

// Detecta a bounding box da região NÃO-TRANSPARENTE de uma fabric.Image.
// SMART: detecta o conteúdo real do produto MESMO em PNGs com fundo BRANCO/CINZA
// (não só transparente). Faz auto-detecção da cor de fundo amostrando os 4 cantos
// da imagem — se forem similares (uniformes), trata todos os pixels dessa cor
// como background e crop pra fora.
// Retorna { x, y, w, h } do conteúdo real, ou null se não detectou.
function detectarBboxConteudoReal(img) {
  try {
    const el = img._element || img.getElement?.();
    if (!el) return null;
    const w = el.naturalWidth || img.width;
    const h = el.naturalHeight || img.height;
    if (!w || !h) return null;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(el, 0, 0, w, h);
    let imgData;
    try { imgData = ctx.getImageData(0, 0, w, h); } catch { return null; }
    const data = imgData.data;
    const px = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i+1], data[i+2], data[i+3]];
    };
    // Amostra os 4 cantos com inset de 5px (evita bordas anti-aliased)
    const inset = 5;
    const cantos = [
      px(inset, inset), px(w - 1 - inset, inset),
      px(inset, h - 1 - inset), px(w - 1 - inset, h - 1 - inset),
    ];
    // Se algum canto for transparente, usa modo "transparência" puro (alpha threshold)
    const algumTransparente = cantos.some(c => c[3] < 30);
    let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
    if (!algumTransparente) {
      // Todos os cantos têm alpha — calcula cor média de fundo
      for (const c of cantos) { bgR += c[0]; bgG += c[1]; bgB += c[2]; bgA += c[3]; }
      bgR /= 4; bgG /= 4; bgB /= 4; bgA /= 4;
    }
    // Tolerância de cor (distância RGB <= 40)
    const TOLERANCIA = 40;
    // Alpha threshold AGRESSIVO: 100 (era 30). Sombras desfocadas têm alpha 50-180,
    // ficavam sendo contadas como "conteúdo" inflando o bbox e fazendo o produto
    // parecer pequeno. Threshold 100 corta sombras leves mantendo as bordas reais.
    const ALPHA_THRESHOLD = 100;
    const ehBackground = (r, g, b, a) => {
      if (a < ALPHA_THRESHOLD) return true;  // transparente OU sombra desfocada
      if (algumTransparente) return false;
      const dr = r - bgR, dg = g - bgG, db = b - bgB;
      return Math.sqrt(dr*dr + dg*dg + db*db) <= TOLERANCIA;
    };
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (!ehBackground(r, g, b, a)) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    // Margem mínima de 2px ao redor (não corta nada coladíssimo)
    const margin = 2;
    return {
      x: Math.max(0, minX - margin),
      y: Math.max(0, minY - margin),
      w: Math.min(w, maxX - minX + 1 + margin * 2),
      h: Math.min(h, maxY - minY + 1 + margin * 2),
    };
  } catch { return null; }
}

// Útil pra remover padding transparente em PNGs de balão de oferta.
// Retorna { x, y, w, h } em pixels da imagem original, ou null se a imagem é totalmente transparente.
function detectarBboxNaoTransparente(img, threshold = 10) {
  try {
    const el = img._element || img.getElement?.();
    if (!el) return null;
    const w = el.naturalWidth || img.width;
    const h = el.naturalHeight || img.height;
    if (!w || !h) return null;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(el, 0, 0, w, h);
    let imgData;
    try { imgData = ctx.getImageData(0, 0, w, h); }
    catch (e) {
      // CORS taint — não conseguimos ler pixels. Retorna null pra usar a imagem inteira.
      return null;
    }
    const data = imgData.data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > threshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch (e) {
    console.warn('[bbox] detecção falhou:', e?.message);
    return null;
  }
}

// Formatos disponíveis com categorias (igual qrofertas)
export const PAGE_SIZES = {
  // Redes Sociais
  FACEBOOK_QUADRADO: { largura: 1080, altura: 1080, nome: 'Encarte feed facebook quadrado', categoria: 'Redes Sociais' },
  STORIES:           { largura: 1080, altura: 1920, nome: 'Formato para status e stories', categoria: 'Redes Sociais' },
  REELS_INSTAGRAM:   { largura: 1080, altura: 1350, nome: 'Formato feed/reels instagram', categoria: 'Redes Sociais' },

  // Encartes
  ENCARTE_GRANDE:    { largura: 1240, altura: 1754, nome: 'Encarte grande para impressão', categoria: 'Encartes' },
  A4_RETRATO:        { largura: 794,  altura: 1123, nome: 'Encarte a4 para impressão', categoria: 'Encartes' },
  A4_PAISAGEM:       { largura: 1123, altura: 794,  nome: 'Encarte a4 horizontal para impressão', categoria: 'Encartes' },

  // Cartazes
  CARTAZ_VERTICAL:   { largura: 794,  altura: 1123, nome: 'Cartaz a4 vertical para impressão', categoria: 'Cartazes' },
  CARTAZ_HORIZONTAL: { largura: 1123, altura: 794,  nome: 'Cartaz a4 horizontal para impressão', categoria: 'Cartazes' },

  // TVs
  TV_HORIZONTAL:     { largura: 1920, altura: 1080, nome: 'Formato para tv horizontal', categoria: 'TVs' },
  TV_VERTICAL:       { largura: 1080, altura: 1920, nome: 'Formato para tv vertical', categoria: 'TVs' },
};

export function createCanvas(elId, largura, altura) {
  return new fabric.Canvas(elId, {
    width: largura,
    height: altura,
    backgroundColor: '#ffffff',
    // selection: false desabilita rubber-band (multi-select), MAS objetos com
    // selectable:true ainda podem ser clicados/manipulados individualmente.
    selection: false,
    // skipTargetFind:false → mantém detecção de target pra mousedown handlers
    // (produtos abrem modal de edição) E pra seleção de objetos manipuláveis (logo).
    skipTargetFind: false,
    preserveObjectStacking: true,
  });
}

// ---------- Capa ----------
function aplicarFundoCapa(rect, fundoStr) {
  // Suporta "linear-gradient(...)" e cores sólidas
  if (fundoStr && fundoStr.startsWith('linear-gradient')) {
    // Extrai paradas: linear-gradient(135deg, #c40000 0%, #ef0000 50%, #ff8a00 100%)
    const m = fundoStr.match(/linear-gradient\(([^,]+),\s*(.+)\)/);
    if (m) {
      const angulo = parseFloat(m[1]) || 135;
      const stops = m[2].split(/,\s*(?=#|rgb)/).map(s => {
        const [cor, pos] = s.trim().split(/\s+/);
        return { offset: parseFloat(pos) / 100, color: cor };
      });
      const rad = (angulo - 90) * Math.PI / 180;
      const x1 = rect.width / 2 - Math.cos(rad) * rect.width / 2;
      const y1 = rect.height / 2 - Math.sin(rad) * rect.height / 2;
      const x2 = rect.width / 2 + Math.cos(rad) * rect.width / 2;
      const y2 = rect.height / 2 + Math.sin(rad) * rect.height / 2;
      rect.set('fill', new fabric.Gradient({
        type: 'linear',
        coords: { x1, y1, x2, y2 },
        colorStops: stops,
      }));
      return;
    }
  }
  rect.set('fill', fundoStr || '#ef0000');
}

// Carrega imagem da capa em modo COVER (preenche todo o retângulo, recortando o overflow)
// ou CONTAIN (cabe inteira dentro, podendo sobrar margem).
//
// Quando autoCrop=true (padrão para CONTAIN), detecta a área não-transparente da
// PNG e descarta o padding em volta — assim o conteúdo VISÍVEL do título preenche
// muito mais a capa, sem ficar minúsculo no meio do nada.
//
// posicaoH: 'esquerda' | 'centro' | 'direita' — alinhamento horizontal (default: 'centro').
//
// IMPORTANTE: aplica clipPath para garantir que a imagem NÃO extrapole a área da capa.
function adicionarImagemCapa(canvas, url, modo, areaW, areaH, areaX, areaY, fundoRef, escalaMax, autoCrop = false, posicaoH = 'centro') {
  if (!url) return;
  const myGen = canvas.__renderGen || 0;
  fabric.Image.fromURL(url, (img) => {
    try {
      if (!img || !img.width) return;
      if ((canvas.__renderGen || 0) !== myGen) return;

      // Auto-crop pra área não-transparente (descarta padding da PNG).
      // Útil principalmente pro TÍTULO, que costuma vir centralizado em PNG maior.
      let visualW = img.width;
      let visualH = img.height;
      if (autoCrop) {
        // Cacheia bbox por URL pra não recalcular toda vez
        let bbox = CACHE_BBOX_BALAO.get(url);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(url, bbox);
        }
        if (bbox) {
          img.set({
            cropX: bbox.x,
            cropY: bbox.y,
            width: bbox.w,
            height: bbox.h,
          });
          visualW = bbox.w;
          visualH = bbox.h;
        }
      }

      // Quando posicionado à esquerda ou direita, limita a largura máxima a 55%
      // da área. Sem isso, imagens largas (como títulos com ornamentos) ocupam
      // ~95% da capa e o alinhamento à lateral fica imperceptível.
      const ehLateral = posicaoH === 'esquerda' || posicaoH === 'direita';
      const larguraMaxima = ehLateral ? areaW * 0.55 : areaW;
      const escalaX = larguraMaxima / visualW;
      const escalaY = areaH / visualH;
      let escala;
      if (modo === 'cover') {
        escala = Math.max(escalaX, escalaY);
      } else {
        // contain: cabe dentro com margem
        escala = Math.min(escalaX, escalaY);
        // Aplica zoom adicional se escalaMax for menor (ex: título usa só X% da capa)
        if (escalaMax && escalaMax < 1) escala *= escalaMax;
      }
      img.scale(escala);
      const w = visualW * escala;
      const h = visualH * escala;
      // Alinhamento horizontal: esquerda, centro (default) ou direita.
      // Margem mínima de 4% da largura na esquerda/direita pra não colar nas bordas.
      const margemH = areaW * 0.04;
      let leftPos;
      if (posicaoH === 'esquerda') {
        leftPos = areaX + margemH;
      } else if (posicaoH === 'direita') {
        leftPos = areaX + areaW - w - margemH;
      } else {
        leftPos = areaX + (areaW - w) / 2;  // centro (default)
      }
      img.set({
        left: leftPos,
        top: areaY + (areaH - h) / 2,
        selectable: false,
        evented: false,
        // Recorta a imagem ao retângulo exato da capa (evita transbordar pros produtos).
        // absolutePositioned: true faz o clipPath usar coordenadas do canvas (não locais).
        clipPath: new fabric.Rect({
          left: areaX,
          top: areaY,
          width: areaW,
          height: areaH,
          absolutePositioned: true,
        }),
      });
      canvas.add(img);
      // Posiciona logo acima do fundo (ou logo acima do que já estiver lá)
      if (fundoRef) {
        const fundoIdx = canvas.getObjects().indexOf(fundoRef);
        if (fundoIdx >= 0) {
          const idxImg = canvas.getObjects().indexOf(img);
          const targetIdx = modo === 'cover' ? fundoIdx + 1 : Math.max(fundoIdx + 2, idxImg);
          canvas.moveTo(img, targetIdx);
        }
      }
      canvas.requestRenderAll();
    } catch (e) {
      console.warn('[render] capa imagem falhou:', e?.message);
    }
  }, { crossOrigin: 'anonymous' });
}

function renderizarCapa(canvas, capa, larguraCanvas) {
  if (!capa) return 0;
  const altura = capa.altura || 220;
  const fundo = new fabric.Rect({
    left: 0, top: 0, width: larguraCanvas, height: altura,
    selectable: false, evented: false,
  });
  aplicarFundoCapa(fundo, capa.fundo);
  canvas.add(fundo);

  // Imagem de fundo (COVER): preenche TODO o retângulo da capa, recortando overflow
  if (capa.imagemFundo) {
    adicionarImagemCapa(canvas, capa.imagemFundo, 'cover', larguraCanvas, altura, 0, 0, fundo);
  }

  // Imagem de título/logo (CONTAIN + AUTO-CROP): detecta região não-transparente
  // da PNG, descarta padding e ocupa ~98% da capa com o conteúdo visível.
  // Resultado: título sempre grande, mesmo se a PNG tem muito espaço em volta.
  // Posição (esquerda/centro/direita) configurável no tema.
  if (capa.imagemTitulo) {
    const posicao = capa.posicaoTitulo || 'centro';
    adicionarImagemCapa(canvas, capa.imagemTitulo, 'contain', larguraCanvas, altura, 0, 0, fundo, 0.85, true, posicao);
  }

  for (const el of capa.elementos || []) {
    if (el.tipo === 'texto') {
      const t = new fabric.Text(el.texto || '', {
        left: el.x ?? 80, top: el.y ?? 50,
        fontSize: el.fontSize ?? 36,
        fontWeight: el.fontWeight ?? 'normal',
        fontFamily: el.fontFamily ?? 'Arial',
        fontStyle: el.fontStyle ?? 'normal',
        fill: el.fill ?? '#ffffff',
        stroke: el.stroke || null,
        strokeWidth: el.strokeWidth ?? 0,
        opacity: el.opacity ?? 1,
        selectable: false, evented: false,
      });
      canvas.add(t);
    }
  }
  return altura;
}

// ---------- Rodapé ----------
// ---------- Logo Customizado ----------
// Renderiza a logo SELECIONÁVEL sobreposta à capa, com fundo opcional e
// manipulação livre (drag/resize). Quando o usuário move ou redimensiona,
// chama `aoMudarLogo` com a nova posição/escala.
//
// fundoTipo: 'transparente' | 'claro' | 'escuro' | 'claro-redondo' | 'escuro-redondo'
//            (compat: 'branco' = 'claro', 'circulo-branco' = 'claro-redondo', 'cor')
// corBorda: cor do tema (paleta.primaria) usada como contorno do fundo
function renderizarLogoCustom(canvas, logo, larguraCanvas, alturaCapa, aoMudarLogo, corBorda) {
  if (!logo?.url) return;
  const myGen = canvas.__renderGen || 0;
  const fundoTipo = logo.fundoTipo || 'transparente';
  // Borda inteligente: usa cor do tema (passada) ou default vermelho
  const corContorno = corBorda || '#ef4444';
  // Altura total do canvas (pra limites de movimento da logo)
  const alturaCanvas = canvas.getHeight() / (canvas.getZoom() || 1);

  fabric.Image.fromURL(logo.url, (img) => {
    try {
      if (!img || !img.width) {
        console.warn('[logo] imagem não carregou:', logo.url);
        return;
      }
      if ((canvas.__renderGen || 0) !== myGen) {
        console.log('[logo] gen guard abortou (render mais recente)');
        return;
      }
      console.log('[logo] imagem carregada, dim:', img.width, 'x', img.height);

      // Auto-crop bbox não-transparente (descarta padding da PNG)
      let bbox = CACHE_BBOX_BALAO.get(logo.url);
      if (bbox === undefined) {
        try {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(logo.url, bbox);
        } catch (e) {
          console.warn('[logo] auto-crop falhou (provável CORS):', e?.message);
          bbox = null;
        }
      }
      if (bbox) {
        img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
      }
      const visW = bbox ? bbox.w : img.width;
      const visH = bbox ? bbox.h : img.height;

      // ---------- POSIÇÃO/TAMANHO ----------
      // Se o usuário JÁ moveu/redimensionou (logo.x/y/escala salvos), usa esses valores.
      // Caso contrário, calcula posição/tamanho padrão baseado em logo.posicao + logo.tamanho.
      let escala, x, y;
      // Usa coords salvas se forem números finitos válidos. Caso contrário (corrompidas
      // ou primeira renderização), recalcula posição padrão.
      const temCoordsValidas =
        Number.isFinite(logo.x) &&
        Number.isFinite(logo.y) &&
        Number.isFinite(logo.escala) &&
        logo.escala > 0;
      if (temCoordsValidas) {
        escala = logo.escala;
        x = logo.x;
        y = logo.y;
      } else {
        const tamanhoPercent = (logo.tamanho || 100) / 100;
        const tamanhoBase = Math.min(larguraCanvas, alturaCapa) * 0.22 * tamanhoPercent;
        escala = Math.min(tamanhoBase / visW, tamanhoBase / visH);
        const w0 = visW * escala;
        const h0 = visH * escala;
        const margem = larguraCanvas * 0.04;
        const posicao = logo.posicao || 'capa-direita';
        if (posicao === 'capa-esquerda') x = margem;
        else if (posicao === 'capa-direita') x = larguraCanvas - w0 - margem;
        else x = (larguraCanvas - w0) / 2;
        y = (alturaCapa - h0) / 2;
      }
      // ---------- CLAMP DE SEGURANÇA ----------
      // Garante que a logo SEMPRE caiba e fique DENTRO do canvas, mesmo com coords
      // antigas salvas em localStorage que poderiam tê-la deixado fora da viewport.
      // Resolve "logo não aparece" quando o canvas muda de tamanho, zoom muda, ou
      // quando coords salvas ficam obsoletas.
      let wTemp = visW * escala;
      let hTemp = visH * escala;
      // Se a logo for maior que o canvas, reduz escala uniformemente até caber
      if (wTemp > larguraCanvas || hTemp > alturaCanvas) {
        const escalaCabe = Math.min(larguraCanvas / visW, alturaCanvas / visH) * 0.9;
        if (escalaCabe > 0 && escalaCabe < escala) {
          escala = escalaCabe;
          wTemp = visW * escala;
          hTemp = visH * escala;
        }
      }
      img.scale(escala);
      const w = wTemp;
      const h = hTemp;
      // Clampa posição pra ficar 100% dentro do canvas
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x + w > larguraCanvas) x = larguraCanvas - w;
      if (y + h > alturaCanvas) y = alturaCanvas - h;

      // ---------- FUNDO + LOGO em um GROUP selecionável ----------
      const objs = [];
      const padFundo = h * 0.18;
      const espessuraBorda = Math.max(3, Math.min(w, h) * 0.04);
      // Ajuste especial pra cor='claro' (branco): usa borda mais fina pra não dominar
      const usarBorda = fundoTipo !== 'transparente';

      // Helper pra construir Rect (quadrado arredondado) com borda do tema
      const fazerRect = (fill) => new fabric.Rect({
        left: -padFundo, top: -padFundo,
        width: w + padFundo * 2, height: h + padFundo * 2,
        fill, rx: 12, ry: 12,
        stroke: usarBorda ? corContorno : null,
        strokeWidth: usarBorda ? espessuraBorda : 0,
        originX: 'left', originY: 'top',
      });
      // Helper pra construir Circle (redondo) com borda do tema
      const fazerCircle = (fill) => {
        const lado = Math.max(w, h) + padFundo * 2;
        return new fabric.Circle({
          left: w / 2 - lado / 2, top: h / 2 - lado / 2,
          radius: lado / 2, fill,
          stroke: usarBorda ? corContorno : null,
          strokeWidth: usarBorda ? espessuraBorda : 0,
          originX: 'left', originY: 'top',
        });
      };

      // Mapeia fundoTipo → forma + cor
      if (fundoTipo === 'claro' || fundoTipo === 'branco') {
        objs.push(fazerRect('#ffffff'));
      } else if (fundoTipo === 'escuro') {
        objs.push(fazerRect('#1f2937'));
      } else if (fundoTipo === 'claro-redondo') {
        objs.push(fazerCircle('#ffffff'));
      } else if (fundoTipo === 'escuro-redondo' || fundoTipo === 'circulo-branco') {
        // 'circulo-branco' = compat reversa (era branco; agora respeita cor escura também)
        const fill = fundoTipo === 'circulo-branco' ? '#ffffff' : '#1f2937';
        objs.push(fazerCircle(fill));
      } else if (fundoTipo === 'cor') {
        // Compat reversa: cor customizada
        objs.push(fazerRect(logo.fundoCor || '#ffffff'));
      }
      // 'transparente' (sem fundo) não desenha nada
      // Imagem em coords locais (0,0) dentro do grupo
      img.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
      objs.push(img);

      const grupo = new fabric.Group(objs, {
        left: x, top: y,
        originX: 'left', originY: 'top',
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockScalingFlip: true,
        cornerStyle: 'circle',
        cornerColor: '#ffffff',
        cornerStrokeColor: '#1f2937',
        cornerSize: 14,
        transparentCorners: false,
        borderColor: '#1f2937',
        borderDashArray: [4, 4],
        // Mostra controles em todos os cantos + meio
        hoverCursor: 'move',
      });
      grupo.set('__tipo', 'logo');

      // ---------- LIMITES: confina o grupo dentro do canvas ----------
      // Durante o drag (event 'moving'): clampa left/top pra que a bbox não saia.
      // Defensivo: só roda se grupo tem dimensões válidas.
      grupo.on('moving', () => {
        if (!grupo.width || !grupo.height) return;
        const w = grupo.width * (grupo.scaleX || 1);
        const h = grupo.height * (grupo.scaleY || 1);
        if (grupo.left < 0) grupo.left = 0;
        if (grupo.top < 0) grupo.top = 0;
        if (grupo.left + w > larguraCanvas) grupo.left = larguraCanvas - w;
        if (grupo.top + h > alturaCanvas) grupo.top = alturaCanvas - h;
      });
      // Durante o resize (event 'scaling'): reduz escala uniforme se ultrapassa borda.
      grupo.on('scaling', () => {
        if (!grupo.width || !grupo.height) return;
        const wAtual = grupo.width * (grupo.scaleX || 1);
        const hAtual = grupo.height * (grupo.scaleY || 1);
        let escalaMax = grupo.scaleX || 1;
        if (grupo.left + wAtual > larguraCanvas) {
          escalaMax = Math.min(escalaMax, (larguraCanvas - grupo.left) / grupo.width);
        }
        if (grupo.top + hAtual > alturaCanvas) {
          escalaMax = Math.min(escalaMax, (alturaCanvas - grupo.top) / grupo.height);
        }
        if (escalaMax < (grupo.scaleX || 1) && escalaMax > 0) {
          grupo.scaleX = escalaMax;
          grupo.scaleY = escalaMax;
        }
        if (grupo.left < 0) grupo.left = 0;
        if (grupo.top < 0) grupo.top = 0;
      });

      // Persiste mudanças de posição/tamanho no state da app.
      // Quando o usuário move OU redimensiona, salva as novas coords.
      const persistir = () => {
        if (!aoMudarLogo) return;
        const novoX = grupo.left;
        const novoY = grupo.top;
        const novaEscala = escala * (grupo.scaleX || 1);
        // Safety: só persiste se os valores são números finitos válidos
        if (!Number.isFinite(novoX) || !Number.isFinite(novoY) || !Number.isFinite(novaEscala) || novaEscala <= 0) {
          return;
        }
        aoMudarLogo({ x: novoX, y: novoY, escala: novaEscala });
      };
      grupo.on('modified', persistir);

      canvas.add(grupo);
      // Garante que a logo fique no TOPO do z-order (acima de fundo encarte, faixas, etc.)
      // pra não ser bloqueada por outros elementos no clique.
      try { canvas.bringToFront(grupo); } catch {}
      canvas.requestRenderAll();
    } catch (e) {
      console.warn('[logo] render falhou:', e?.message);
    }
  }, { crossOrigin: 'anonymous' });
}

// ---------- Faixa Empresa ----------
// Calcula luminância relativa de uma cor hex (0=preto, 1=branco). Usa coeficientes
// ITU-R BT.709 (mesma fórmula que CSS usa pra accessibility/WCAG).
function luminanciaCor(hex) {
  if (!hex || typeof hex !== 'string') return 0.5;
  // Suporta #rgb, #rrggbb, com ou sem #
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return 0.5;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Retorna #000 ou #fff conforme melhor contraste com o fundo
function corTextoContraste(corFundo) {
  return luminanciaCor(corFundo) > 0.55 ? '#000000' : '#ffffff';
}

// Pra uma cor de destaque (ex: paleta.secundaria usada como título), garante
// contraste mínimo com o fundo. Se a diferença de luminância for baixa, troca
// por um fallback (amarelo se fundo escuro, azul-escuro se fundo claro).
function corDestaqueComContraste(corDesejada, corFundo, fallbackEscuro = '#fbbf24', fallbackClaro = '#1e40af') {
  const lumCor = luminanciaCor(corDesejada);
  const lumFundo = luminanciaCor(corFundo);
  if (Math.abs(lumCor - lumFundo) < 0.30) {
    return lumFundo < 0.5 ? fallbackEscuro : fallbackClaro;
  }
  return corDesejada;
}

// Ajusta o brilho de uma cor hex. delta ∈ [-1, +1].
//   +0.20 → 20% mais clara (mistura com branco)
//   -0.15 → 15% mais escura (mistura com preto)
function ajustarBrilho(hex, delta) {
  if (!hex || typeof hex !== 'string') return hex;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return hex;
  let r = parseInt(m[1], 16);
  let g = parseInt(m[2], 16);
  let b = parseInt(m[3], 16);
  if (delta >= 0) {
    r = Math.round(r + (255 - r) * delta);
    g = Math.round(g + (255 - g) * delta);
    b = Math.round(b + (255 - b) * delta);
  } else {
    const f = 1 + delta;  // delta negativo → f < 1
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  }
  const toHex = n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Desenha um ícone circular em (cx, cy) com diâmetro `d` e glyph dentro.
function desenharIconeRedondo(canvas, cx, cy, d, corFundo, corGlyph, glyph) {
  const r = d / 2;
  canvas.add(new fabric.Circle({
    left: cx - r, top: cy - r, radius: r,
    fill: corFundo,
    selectable: false, evented: false,
  }));
  const t = new fabric.Text(glyph, {
    fontSize: d * 0.62,
    fontFamily: 'Segoe UI Symbol, Apple Symbols, Arial, sans-serif',
    fontWeight: 'bold',
    fill: corGlyph,
    selectable: false, evented: false,
  });
  t.set({
    left: cx - t.width / 2,
    top:  cy - t.height / 2 - d * 0.04,
  });
  canvas.add(t);
}

// SVG path do logo WhatsApp (24x24 viewbox) — bubble com phone receiver dentro.
const PATH_WHATSAPP = 'M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.264 8.264 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.183 8.183 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43-.14 0-.31-.02-.48-.02-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.16-.47-.28z';

// Desenha ícone WhatsApp completo (círculo verde + logo branco no centro)
function desenharIconeWhatsapp(canvas, cx, cy, d) {
  const r = d / 2;
  // Círculo verde de fundo
  canvas.add(new fabric.Circle({
    left: cx - r, top: cy - r, radius: r,
    fill: '#25D366',
    selectable: false, evented: false,
  }));
  // Logo branco centralizado (path tem viewbox 24x24)
  const scale = (d * 0.72) / 24;
  const path = new fabric.Path(PATH_WHATSAPP, {
    fill: '#ffffff',
    originX: 'center', originY: 'center',
    left: cx, top: cy,
    scaleX: scale, scaleY: scale,
    selectable: false, evented: false,
  });
  canvas.add(path);
}

// Desenha um ícone "brand" genérico: círculo colorido + logo SVG branco carregado
// async do Simple Icons CDN. Enquanto o SVG não carrega, mostra um glyph fallback
// pra evitar buraco visual.
function desenharIconeBrand(canvas, cx, cy, d, corFundo, slugSimpleIcons, glyphFallback) {
  const r = d / 2;
  const myGenSnap = canvas.__renderGen || 0;
  // Círculo de fundo
  canvas.add(new fabric.Circle({
    left: cx - r, top: cy - r, radius: r,
    fill: corFundo,
    selectable: false, evented: false,
  }));
  // Glyph fallback (texto) — fica visível enquanto carrega ou se SVG falhar
  const fallback = new fabric.Text(glyphFallback, {
    fontSize: d * 0.62,
    fontFamily: 'Segoe UI Symbol, Apple Symbols, Arial, sans-serif',
    fontWeight: 'bold',
    fill: '#ffffff',
    selectable: false, evented: false,
  });
  fallback.set({
    left: cx - fallback.width / 2,
    top:  cy - fallback.height / 2 - d * 0.04,
  });
  canvas.add(fallback);
  // Carrega SVG do CDN (monochrome branco) e sobrepõe ao fallback
  try {
    const url = `https://cdn.simpleicons.org/${slugSimpleIcons}/ffffff`;
    fabric.loadSVGFromURL(url, (objects, opts) => {
      try {
        if ((canvas.__renderGen || 0) !== myGenSnap) return;
        if (!objects || !objects.length) return;
        const grupo = fabric.util.groupSVGElements(objects, opts);
        const escala = (d * 0.62) / Math.max(grupo.width, grupo.height);
        grupo.scale(escala);
        grupo.set({
          left: cx - (grupo.width * escala) / 2,
          top:  cy - (grupo.height * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(grupo);
        fallback.set('visible', false);
        canvas.requestRenderAll();
      } catch {}
    });
  } catch {}
}

// Faixa amarela acima do rodapé com dados da empresa que estiverem ativos.
// Renderiza só os campos com `mostrar[key] = true` E que tenham valor preenchido.
// Retorna a altura usada (ou 0 se nada pra mostrar).
// Formata data ISO ('YYYY-MM-DD') para BR ('DD/MM/YYYY')
function formatarDataBR(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function renderizarFaixaEmpresa(canvas, empresa, larguraCanvas, alturaCanvas, alturaRodape, paleta, datas) {
  // empresa pode estar vazia: as regras de Datas (datas / frase promocional /
  // advertência de medicamento) são INDEPENDENTES dos dados de empresa e
  // precisam renderizar mesmo quando o painel Empresa não foi preenchido.
  // Por isso NÃO retornamos cedo aqui — `m` vira {} (nenhum item de empresa) e
  // o early-return real, mais abaixo, considera também temFaixaDatas /
  // temAdvMed / temFrasePromocional. Todos os acessos a empresa.X estão
  // protegidos por `m.X && empresa.X` (curto-circuito), então m={} é seguro.
  const m = (empresa && empresa.mostrar) || {};
  // Tipos de ícone: 'whatsapp' (verde), 'telefone' (preto), 'localizacao', etc.
  // Cada item: { tipo, texto, legenda? } — legenda aparece em fonte menor acima do texto.
  const mostrarLegendas = !!m.legendaTelefones;
  const itens = [];
  if (m.whatsapp && empresa.whatsapp) {
    itens.push({
      tipo: 'whatsapp',
      texto: empresa.whatsapp,
      legenda: mostrarLegendas ? (empresa.legendaWhatsapp || '') : '',
    });
  }
  if (m.telefone && empresa.telefone) {
    itens.push({
      tipo: 'telefone',
      texto: empresa.telefone,
      legenda: mostrarLegendas ? (empresa.legendaTelefone || '') : '',
    });
  }
  // Ordem: Facebook → Instagram (faixa amarela superior — redes sociais)
  if (m.facebook && empresa.facebook) itens.push({ tipo: 'facebook', texto: empresa.facebook });
  if (m.instagram && empresa.instagram) itens.push({ tipo: 'instagram', texto: empresa.instagram });
  // Website fica na faixa inferior (junto com endereço — ambos são "localização")
  // Faixa preta (abaixo da amarela): nome em destaque + slogan + observação de pagamento.
  // Cada um vai numa linha SEPARADA quando ativo:
  //   linha 1 (grande, amarelo): nome
  //   linha 2 (médio, branco):   slogan
  //   linha 3 (médio, branco):   observação de pagamento
  const linhaPretaNome = (m.nome && empresa.nome) ? empresa.nome : '';
  const linhaPretaSlogan = (m.slogan && empresa.slogan) ? empresa.slogan : '';
  const linhaPretaObs = (m.obsPagamento && empresa.obsPagamento) ? empresa.obsPagamento : '';
  const linhasPreta = [linhaPretaNome, linhaPretaSlogan, linhaPretaObs].filter(Boolean);
  const temLinhaPreta = linhasPreta.length > 0;

  // Formas de pagamento (faixa branca/clara separada com ícones coloridos)
  const formasIds = (m.formasPagamento && Array.isArray(empresa.formasPagamento))
    ? empresa.formasPagamento : [];
  const temFormasPagamento = formasIds.length > 0;

  // Faixa inferior: endereço (pin) + website (globo). Renderizada se algum dos dois ativo.
  const temEndereco = !!(m.endereco && empresa.endereco);
  const temWebsite = !!(m.website && empresa.website);
  const temFaixaLocalizacao = temEndereco || temWebsite;

  // Faixa de datas: "Ofertas Válidas de DD/MM/YYYY até DD/MM/YYYY"
  // Só renderiza se toggle ON e tiver pelo menos data inicial preenchida.
  const dataInicioBR = formatarDataBR(datas?.dataInicio);
  const dataFinalBR = formatarDataBR(datas?.dataFinal);
  const temDatas = !!(datas?.mostrar?.datas && (dataInicioBR || dataFinalBR));
  // Sufixo opcional na mesma faixa: "ou enquanto durarem os estoques"
  const temEnquantoDurar = !!datas?.mostrar?.enquantoDurarem;
  // A faixa de datas pode aparecer SÓ pra mostrar "Enquanto durarem os estoques",
  // mesmo sem datas preenchidas (toggle independente)
  const temFaixaDatas = temDatas || temEnquantoDurar;
  // Advertência de medicamento (faixa branca fina com texto ANVISA-style)
  const temAdvMed = !!datas?.mostrar?.advertenciaMedicamento;
  // Frase promocional (faixa amarela no TOPO de tudo, texto em destaque)
  const temFrasePromocional = !!(datas?.mostrar?.frasePromocional && datas?.frasePromocional?.trim());
  const fraseTexto = (datas?.frasePromocional || '').trim();

  if (!itens.length && !temLinhaPreta && !temFormasPagamento && !temFaixaLocalizacao && !temFaixaDatas && !temAdvMed && !temFrasePromocional) return 0;

  const corFundo = paleta?.secundaria || '#fde047';
  // Cor de variação: oposto do brilho da base. Cria alternância visual entre faixas
  // (ex: tema vermelho-escuro → variação um pouco mais clara; tema amarelo claro →
  // variação um pouco mais escura).
  const lumBase = luminanciaCor(corFundo);
  const corFundoVariacao = ajustarBrilho(corFundo, lumBase < 0.5 ? +0.18 : -0.12);
  // Cor inteligente de texto: preto em fundo claro, branco em fundo escuro
  const corTexto = corTextoContraste(corFundo);
  const corTextoVar = corTextoContraste(corFundoVariacao);
  // Cor da legenda (Delivery, Pedidos): suave mas sempre legível
  const corLegenda = corTextoContraste(corFundo) === '#000000' ? '#374151' : '#e5e7eb';
  // Cor do glyph dentro dos círculos brand (whatsapp, instagram, etc) sempre branco
  // (fundo dos círculos é colorido por marca)
  const corGlyphCirculo = '#ffffff';
  // Se algum item tem legenda, a linha de ícones fica um pouco mais alta
  const temLegenda = itens.some(it => it.legenda);
  const linhaIconesH = temLegenda ? 50 : 38;
  // Faixa preta: altura cresce com a quantidade de linhas (nome + slogan + obs)
  const numLinhasPreta = linhasPreta.length;
  const linhaPretaH = numLinhasPreta === 0 ? 0
    : numLinhasPreta === 1 ? 40
    : numLinhasPreta === 2 ? 60
    : 80;  // 3 linhas
  // Sub-zonas do lado DIREITO da área combinada (empilhadas verticalmente):
  //   topo   → datas + "enquanto durarem"
  //   meio   → ícones de pagamento
  //   base   → advertência de medicamento
  // Cada uma só ocupa altura se o respectivo toggle/dado estiver ativo.
  const subDatasH    = temFaixaDatas ? 28 : 0;
  const subPagH      = temFormasPagamento ? 38 : 0;
  const subAdvMedH   = temAdvMed ? 22 : 0;
  const ladoDireitoH = subDatasH + subPagH + subAdvMedH;
  const temLadoDireito = ladoDireitoH > 0;
  // Lado ESQUERDO: caixa preta com nome/slogan/obs
  const ladoEsquerdoH = temLinhaPreta ? linhaPretaH : 0;
  // Área COMBINADA (lado a lado quando ambos têm conteúdo)
  const linhaCombinada = temLinhaPreta && temLadoDireito;
  const linhaCombinadaH = Math.max(ladoEsquerdoH, ladoDireitoH);
  // Faixa de localização (amarela com globo + pin)
  const linhaLocH = temFaixaLocalizacao ? 38 : 0;
  // Faixa de frase promocional (amarela no topo, destaque grande)
  const linhaFraseH = temFrasePromocional ? 44 : 0;

  const alturaTotal = linhaFraseH + (itens.length > 0 ? linhaIconesH : 0) + linhaCombinadaH + linhaLocH;

  // Posições (de cima pra baixo, acima do rodapé):
  //   amarela (telefones)
  //   combined: ESQUERDA = preta | DIREITA = datas/pagamentos/advMed empilhados
  //   loc (website + endereço)
  //   rodape
  const topLoc = alturaCanvas - alturaRodape - linhaLocH;
  const topCombined = topLoc - linhaCombinadaH;
  // No lado esquerdo a preta ocupa toda a altura combinada
  const topPreta = topCombined;
  // No lado direito as 3 sub-zonas empilham
  const topSubDatas    = topCombined;
  const topSubPag      = topSubDatas + subDatasH;
  const topSubAdvMed   = topSubPag + subPagH;
  // Manter aliases pras renderizações existentes
  const topPagamentos = topSubPag;
  const topAdvMed = topSubAdvMed;
  const topDatas = topSubDatas;
  const topAmarela = topCombined - (itens.length > 0 ? linhaIconesH : 0);
  // Frase promocional: NO TOPO de tudo (acima dos telefones)
  const topFrase = topAmarela - linhaFraseH;

  // === FAIXA PRETA: nome (destaque) + slogan + observação ===
  // Quando combinada com lado direito, ocupa ~38% à esquerda com altura total combinada.
  const larguraPreta = linhaCombinada ? larguraCanvas * 0.38 : larguraCanvas;
  const alturaPreta = linhaCombinada ? linhaCombinadaH : ladoEsquerdoH;
  if (temLinhaPreta) {
    canvas.add(new fabric.Rect({
      left: 0, top: topPreta, width: larguraPreta, height: alturaPreta,
      fill: '#000000',
      selectable: false, evented: false,
    }));
    // Cor do nome inteligente: usa paleta.secundaria, MAS se ela tiver pouco contraste
    // com o fundo preto (ex: tema vermelho-escuro), troca pra amarelo padrão.
    const corNome = corDestaqueComContraste(paleta?.secundaria || '#fbbf24', '#000000', '#fbbf24', '#fbbf24');
    const corSub = '#ffffff';

    // Em modo combinado, fontes ligeiramente menores pra caber em largura reduzida
    const fontNome = linhaCombinada ? 16 : 20;
    const fontSub  = linhaCombinada ? 12 : 14;
    const linhasParaRenderizar = [];
    if (linhaPretaNome) linhasParaRenderizar.push({ texto: linhaPretaNome, fontSize: fontNome, weight: 'bold', cor: corNome });
    if (linhaPretaSlogan) linhasParaRenderizar.push({ texto: linhaPretaSlogan, fontSize: fontSub, weight: 'normal', cor: corSub });
    if (linhaPretaObs) linhasParaRenderizar.push({ texto: linhaPretaObs, fontSize: fontSub, weight: 'normal', cor: corSub });

    const gapEntreLinhas = 3;
    const alturaTextos = linhasParaRenderizar.reduce((acc, l) => acc + l.fontSize, 0)
      + gapEntreLinhas * (linhasParaRenderizar.length - 1);
    let yCursor = topPreta + (alturaPreta - alturaTextos) / 2;
    for (const l of linhasParaRenderizar) {
      const t = new fabric.Text(l.texto, {
        fontSize: l.fontSize, fontWeight: l.weight,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fill: l.cor,
        selectable: false, evented: false,
      });
      // Centraliza dentro da largura disponível (full ou só os 38%)
      t.set({
        left: (larguraPreta - t.width) / 2,
        top: yCursor,
      });
      canvas.add(t);
      yCursor += l.fontSize + gapEntreLinhas;
    }
  }

  // === FAIXA DE FRASE PROMOCIONAL (topo): variação da cor base pra contraste ===
  if (temFrasePromocional) {
    canvas.add(new fabric.Rect({
      left: 0, top: topFrase, width: larguraCanvas, height: linhaFraseH,
      fill: corFundoVariacao,
      selectable: false, evented: false,
    }));
    let fontSizeFrase = 22;
    const ctxMedFrase = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    const medirFrase = (txt, size) => {
      if (!ctxMedFrase) return txt.length * size * 0.6;
      ctxMedFrase.save();
      ctxMedFrase.font = `bold ${size}px Arial, Helvetica, sans-serif`;
      const w = ctxMedFrase.measureText(txt).width;
      ctxMedFrase.restore();
      return w;
    };
    let larguraFrase = medirFrase(fraseTexto, fontSizeFrase);
    const paddingFrase = 16;
    const larguraMaxFrase = larguraCanvas - paddingFrase * 2;
    if (larguraFrase > larguraMaxFrase) {
      const escala = larguraMaxFrase / larguraFrase;
      fontSizeFrase = Math.max(11, fontSizeFrase * escala);
      larguraFrase = medirFrase(fraseTexto, fontSizeFrase);
    }
    const tFrase = new fabric.Text(fraseTexto, {
      fontSize: fontSizeFrase, fontWeight: 'bold',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: corTextoVar,
      selectable: false, evented: false,
    });
    tFrase.set({
      left: (larguraCanvas - tFrase.width) / 2,
      top:  topFrase + (linhaFraseH - tFrase.height) / 2,
    });
    canvas.add(tFrase);
  }

  // === FAIXA AMARELA (linha 1): ícones brand + (legenda + número) ===
  if (itens.length > 0) {
    canvas.add(new fabric.Rect({
      left: 0, top: topAmarela, width: larguraCanvas, height: linhaIconesH,
      fill: corFundo,
      selectable: false, evented: false,
    }));
    const yCentro = topAmarela + linhaIconesH / 2;
    let fontSize = 16;
    let fontSizeLegenda = 10;
    let iconeD = temLegenda ? 28 : 24;
    const padding = 16;
    let gapIconeTexto = 8;
    let gapEntreItens = 26;

    const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    const medirTexto = (txt, size, weight = 'bold') => {
      if (!ctxMed) return txt.length * size * 0.6;
      ctxMed.save();
      ctxMed.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
      const w = ctxMed.measureText(txt).width;
      ctxMed.restore();
      return w;
    };

    const calcLarguraTotal = () => {
      let total = 0;
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        if (it.tipo) total += iconeD + gapIconeTexto;
        const wTexto = medirTexto(it.texto, fontSize, 'bold');
        const wLegenda = it.legenda ? medirTexto(it.legenda, fontSizeLegenda, 'normal') : 0;
        total += Math.max(wTexto, wLegenda);
        if (i < itens.length - 1) total += gapEntreItens;
      }
      return total;
    };

    let larguraTotal = calcLarguraTotal();
    // Auto-shrink: se ultrapassa a largura disponível, reduz fonte/ícones/gaps
    // proporcionalmente (com piso mínimo pra não ficar ilegível).
    const larguraMax = larguraCanvas - padding * 2;
    if (larguraTotal > larguraMax) {
      const escala = larguraMax / larguraTotal;
      // Aplica escala mas respeita mínimos pra não ficar ilegível
      fontSize        = Math.max(11, fontSize * escala);
      fontSizeLegenda = Math.max(8,  fontSizeLegenda * escala);
      iconeD          = Math.max(18, iconeD * escala);
      gapIconeTexto   = Math.max(4,  gapIconeTexto * escala);
      gapEntreItens   = Math.max(12, gapEntreItens * escala);
      larguraTotal    = calcLarguraTotal();
      // 2ª passada caso os mínimos ainda excedam — reduz só os gaps pro último ajuste
      if (larguraTotal > larguraMax) {
        gapEntreItens = Math.max(8, gapEntreItens * (larguraMax / larguraTotal));
        larguraTotal = calcLarguraTotal();
      }
    }

    let xCursor = Math.max(padding, (larguraCanvas - larguraTotal) / 2);
    for (const it of itens) {
      // Ícone (centralizado na altura da linha)
      if (it.tipo === 'whatsapp') {
        desenharIconeWhatsapp(canvas, xCursor + iconeD/2, yCentro, iconeD);
        xCursor += iconeD + gapIconeTexto;
      } else if (it.tipo === 'telefone') {
        // Telefone: glyph na cor inteligente (preto em fundo claro, branco em fundo escuro)
        const phone = new fabric.Text('☎', {
          fontSize: iconeD * 0.95, fill: corTexto, fontWeight: 'bold',
          fontFamily: 'Segoe UI Symbol, Apple Symbols, Arial, sans-serif',
          selectable: false, evented: false,
        });
        phone.set({ left: xCursor, top: yCentro - phone.height / 2 - 2 });
        canvas.add(phone);
        xCursor += iconeD + gapIconeTexto;
      } else if (it.tipo === 'endereco') {
        desenharIconeRedondo(canvas, xCursor + iconeD/2, yCentro, iconeD, '#ef4444', '#ffffff', '◉');
        xCursor += iconeD + gapIconeTexto;
      } else if (it.tipo === 'instagram') {
        desenharIconeBrand(canvas, xCursor + iconeD/2, yCentro, iconeD, '#E4405F', 'instagram', '◎');
        xCursor += iconeD + gapIconeTexto;
      } else if (it.tipo === 'facebook') {
        desenharIconeBrand(canvas, xCursor + iconeD/2, yCentro, iconeD, '#1877F2', 'facebook', 'f');
        xCursor += iconeD + gapIconeTexto;
      } else if (it.tipo === 'website') {
        desenharIconeBrand(canvas, xCursor + iconeD/2, yCentro, iconeD, '#0ea5e9', 'googlechrome', '⊕');
        xCursor += iconeD + gapIconeTexto;
      }

      // Bloco de texto: legenda pequena no topo + número grande embaixo
      const wTexto = medirTexto(it.texto, fontSize, 'bold');
      const wLegenda = it.legenda ? medirTexto(it.legenda, fontSizeLegenda, 'normal') : 0;
      const blocoW = Math.max(wTexto, wLegenda);

      if (it.legenda) {
        // Legenda pequena com cor inteligente baseada no fundo
        const tLeg = new fabric.Text(it.legenda, {
          fontSize: fontSizeLegenda, fontWeight: 'normal',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fill: corLegenda,
          selectable: false, evented: false,
        });
        // Offset proporcional: legenda fica acima do número, com gap pequeno
        tLeg.set({ left: xCursor, top: yCentro - fontSize / 2 - fontSizeLegenda - 2 });
        canvas.add(tLeg);
      }
      // Número/texto principal
      const t = new fabric.Text(it.texto, {
        fontSize, fontWeight: 'bold',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fill: corTexto,
        selectable: false, evented: false,
      });
      // Se tem legenda, número fica embaixo (proporcional); senão, centralizado
      const yTexto = it.legenda ? yCentro - fontSize / 2 + 2 : yCentro - t.height / 2;
      t.set({ left: xCursor, top: yTexto });
      canvas.add(t);
      xCursor += blocoW + gapEntreItens;
      if (xCursor > larguraCanvas - padding) break;  // overflow safety
    }
  }

  // === FAIXA DE PAGAMENTOS: ícones coloridos lado a lado ===
  // Em modo combinado, ocupa só a parte direita (após os 38% da preta), no fundo amarelo.
  if (temFormasPagamento) {
    const xInicioPag = linhaCombinada ? larguraCanvas * 0.38 : 0;
    const larguraPag = linhaCombinada ? larguraCanvas * 0.62 : larguraCanvas;
    const alturaPag = subPagH;
    // Fundo: variação da cor base quando combinada (alterna com datas acima);
    // cinza claro quando full-width (sem combinação).
    canvas.add(new fabric.Rect({
      left: xInicioPag, top: topPagamentos, width: larguraPag, height: alturaPag,
      fill: linhaCombinada ? corFundoVariacao : '#f3f4f6',
      selectable: false, evented: false,
    }));

    const formas = formasIds.map(id => obterFormaPagamento(id)).filter(Boolean);
    const iconeH = 28;
    const iconeW = 50;
    const gapPag = 6;
    const paddingPag = 14;
    const yIcone = topPagamentos + (alturaPag - iconeH) / 2;

    // Largura total dos ícones — se passar do espaço, encolhe a largura proporcionalmente
    let larguraTotalIcones = formas.length * iconeW + (formas.length - 1) * gapPag;
    let iconeWReal = iconeW;
    const espacoDisponivel = larguraPag - paddingPag * 2;
    if (larguraTotalIcones > espacoDisponivel) {
      const escala = espacoDisponivel / larguraTotalIcones;
      iconeWReal = Math.max(24, iconeW * escala);
      larguraTotalIcones = formas.length * iconeWReal + (formas.length - 1) * gapPag;
    }

    let xPag = xInicioPag + (larguraPag - larguraTotalIcones) / 2;
    const myGenSnap = canvas.__renderGen || 0;
    for (const f of formas) {
      // Caixinha colorida do ícone (sempre desenhada — funciona como fundo do logo
      // ou fallback quando não há iconeUrl / quando a imagem demora pra carregar).
      canvas.add(new fabric.Rect({
        left: xPag, top: yIcone,
        width: iconeWReal, height: iconeH,
        fill: f.cor,
        rx: 3, ry: 3,
        selectable: false, evented: false,
      }));
      // Texto fallback (preto em cima da caixa colorida)
      const fontSizeIcone = Math.min(11, iconeWReal * 0.18);
      const tIcone = new fabric.Text(f.textoIcone, {
        fontSize: fontSizeIcone,
        fontWeight: 'bold',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fill: '#ffffff',
        selectable: false, evented: false,
      });
      tIcone.set({
        left: xPag + (iconeWReal - tIcone.width) / 2,
        top: yIcone + (iconeH - tIcone.height) / 2,
      });
      canvas.add(tIcone);

      // Se tem URL de logo real, carrega o SVG por cima e esconde o texto
      if (f.iconeUrl) {
        const xPagSnap = xPag;  // captura pro async
        const tIconeSnap = tIcone;
        try {
          fabric.loadSVGFromURL(f.iconeUrl, (objects, opts) => {
            try {
              if ((canvas.__renderGen || 0) !== myGenSnap) return;  // render guard
              if (!objects || !objects.length) return;
              const grupo = fabric.util.groupSVGElements(objects, opts);
              // Escala pra caber dentro da caixa (deixando padding interno de ~20%)
              const padInterno = 0.20;
              const maxW = iconeWReal * (1 - padInterno);
              const maxH = iconeH * (1 - padInterno);
              const escala = Math.min(maxW / grupo.width, maxH / grupo.height);
              grupo.scale(escala);
              grupo.set({
                left: xPagSnap + (iconeWReal - grupo.width * escala) / 2,
                top:  yIcone   + (iconeH    - grupo.height * escala) / 2,
                selectable: false, evented: false,
              });
              canvas.add(grupo);
              // Esconde o texto fallback
              tIconeSnap.set('visible', false);
              canvas.requestRenderAll();
            } catch {}
          });
        } catch {}
      }

      xPag += iconeWReal + gapPag;
    }
  }

  // === FAIXA DE DATAS (sub-zona TOPO do lado direito): "Ofertas Válidas de [DD] até [DD]" ===
  if (temFaixaDatas) {
    // Lado direito: 62% (à direita da preta) quando combinada; full-width se sozinha
    const xInicioDatas = linhaCombinada ? larguraCanvas * 0.38 : 0;
    const larguraFaixaDatas = linhaCombinada ? larguraCanvas * 0.62 : larguraCanvas;
    // Datas usa cor BASE; pagamentos abaixo usará VARIAÇÃO (alternância)
    canvas.add(new fabric.Rect({
      left: xInicioDatas, top: topDatas, width: larguraFaixaDatas, height: subDatasH,
      fill: corFundo,
      selectable: false, evented: false,
    }));
    const yCentroDatas = topDatas + subDatasH / 2;
    let fontSizeDatas = 12;
    const ctxMedDatas = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    const medirDatas = (txt, size, weight = 'bold') => {
      if (!ctxMedDatas) return txt.length * size * 0.6;
      ctxMedDatas.save();
      ctxMedDatas.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
      const w = ctxMedDatas.measureText(txt).width;
      ctxMedDatas.restore();
      return w;
    };

    // Monta a sequência de tokens: prefixo, [data], conector, [data], sufixo
    // - sem dataFinal: "Ofertas Válidas a partir de [data]"
    // - sem dataInicio: "Ofertas Válidas até [data]"
    // - ambos: "Ofertas Válidas de [data1] até [data2]"
    // - sem datas + enquantoDurar: só "Enquanto durarem os estoques."
    const tokens = [];
    if (temDatas) {
      const prefixo = (dataInicioBR && dataFinalBR) ? 'Ofertas Válidas de'
        : dataInicioBR ? 'Ofertas Válidas a partir de'
        : 'Ofertas Válidas até';
      tokens.push({ tipo: 'texto', texto: prefixo });
      if (dataInicioBR) tokens.push({ tipo: 'tag', texto: dataInicioBR });
      if (dataInicioBR && dataFinalBR) tokens.push({ tipo: 'texto', texto: 'até' });
      if (dataFinalBR) tokens.push({ tipo: 'tag', texto: dataFinalBR });
      if (temEnquantoDurar) tokens.push({ tipo: 'texto', texto: 'ou enquanto durarem os estoques.' });
    } else if (temEnquantoDurar) {
      // Sem datas, só o aviso
      tokens.push({ tipo: 'texto', texto: 'Enquanto durarem os estoques.' });
    }

    // Calcula largura total
    const padTagH = 8;    // padding horizontal interno da tag (menor pra caber)
    const padTagV = 3;    // padding vertical interno
    const gap = 6;
    const calcLargD = () => {
      let total = 0;
      for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        if (tk.tipo === 'texto') total += medirDatas(tk.texto, fontSizeDatas, 'bold');
        else total += medirDatas(tk.texto, fontSizeDatas, 'bold') + padTagH * 2;
        if (i < tokens.length - 1) total += gap;
      }
      return total;
    };
    let larguraTotalD = calcLargD();
    // Auto-shrink baseado no espaço disponível (não no canvas total)
    const padding = 8;
    const larguraMax = larguraFaixaDatas - padding * 2;
    if (larguraTotalD > larguraMax) {
      const escala = larguraMax / larguraTotalD;
      fontSizeDatas = Math.max(8, fontSizeDatas * escala);
      larguraTotalD = calcLargD();
    }

    let xCursorD = xInicioDatas + (larguraFaixaDatas - larguraTotalD) / 2;
    const tagH = fontSizeDatas + padTagV * 2;
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.tipo === 'texto') {
        const t = new fabric.Text(tk.texto, {
          fontSize: fontSizeDatas, fontWeight: 'bold',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fill: corTexto,
          selectable: false, evented: false,
        });
        t.set({ left: xCursorD, top: yCentroDatas - t.height / 2 });
        canvas.add(t);
        xCursorD += t.width;
      } else {
        // Tag: retângulo branco com borda + texto preto centralizado
        const wTexto = medirDatas(tk.texto, fontSizeDatas, 'bold');
        const tagW = wTexto + padTagH * 2;
        canvas.add(new fabric.Rect({
          left: xCursorD, top: yCentroDatas - tagH / 2,
          width: tagW, height: tagH,
          fill: '#ffffff',
          stroke: '#d1d5db', strokeWidth: 1,
          rx: 4, ry: 4,
          selectable: false, evented: false,
        }));
        const t = new fabric.Text(tk.texto, {
          fontSize: fontSizeDatas, fontWeight: 'bold',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fill: '#000000',  // preto sólido na tag branca
          selectable: false, evented: false,
        });
        t.set({
          left: xCursorD + padTagH,
          top:  yCentroDatas - t.height / 2,
        });
        canvas.add(t);
        xCursorD += tagW;
      }
      if (i < tokens.length - 1) xCursorD += gap;
    }
  }

  // === ADVERTÊNCIA DE MEDICAMENTO (sub-zona BASE do lado direito, fundo branco) ===
  if (temAdvMed) {
    const TEXTO_ADV_MED = 'O produto aqui anunciado é um medicamento. Seu uso pode trazer riscos. Procure o médico e o farmacêutico. Leia a bula';
    const xInicioAdv = linhaCombinada ? larguraCanvas * 0.38 : 0;
    const larguraAdvF = linhaCombinada ? larguraCanvas * 0.62 : larguraCanvas;
    canvas.add(new fabric.Rect({
      left: xInicioAdv, top: topAdvMed, width: larguraAdvF, height: subAdvMedH,
      fill: '#ffffff',
      selectable: false, evented: false,
    }));
    let fontSizeAdv = 11;
    const ctxMedAdv = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    const medirAdv = (txt, size) => {
      if (!ctxMedAdv) return txt.length * size * 0.55;
      ctxMedAdv.save();
      ctxMedAdv.font = `normal ${size}px Arial, Helvetica, sans-serif`;
      const w = ctxMedAdv.measureText(txt).width;
      ctxMedAdv.restore();
      return w;
    };
    let larguraAdv = medirAdv(TEXTO_ADV_MED, fontSizeAdv);
    const paddingAdv = 8;
    const larguraMaxAdv = larguraAdvF - paddingAdv * 2;
    if (larguraAdv > larguraMaxAdv) {
      const escala = larguraMaxAdv / larguraAdv;
      fontSizeAdv = Math.max(7, fontSizeAdv * escala);
      larguraAdv = medirAdv(TEXTO_ADV_MED, fontSizeAdv);
    }
    const tAdv = new fabric.Text(TEXTO_ADV_MED, {
      fontSize: fontSizeAdv, fontWeight: 'normal',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      selectable: false, evented: false,
    });
    tAdv.set({
      left: xInicioAdv + (larguraAdvF - tAdv.width) / 2,
      top:  topAdvMed + (subAdvMedH - tAdv.height) / 2,
    });
    canvas.add(tAdv);
  }

  // === FAIXA DE LOCALIZAÇÃO: globo (website) + pin (endereço), centralizados ===
  // Usa cor de variação pra alternar visualmente com a faixa de telefones acima.
  if (temFaixaLocalizacao) {
    canvas.add(new fabric.Rect({
      left: 0, top: topLoc, width: larguraCanvas, height: linhaLocH,
      fill: corFundoVariacao,
      selectable: false, evented: false,
    }));
    const yCentroLoc = topLoc + linhaLocH / 2;
    let fontSizeLoc = 16;
    let iconeDLoc = 22;
    let gapIconeLoc = 8;
    let gapEntreLoc = 28;
    const paddingLoc = 18;

    // Itens de localização nessa faixa: website primeiro, depois endereço
    const itensLoc = [];
    if (temWebsite)  itensLoc.push({ tipo: 'website',  texto: empresa.website,  cor: '#0ea5e9', glyph: '⊕', slug: 'googlechrome' });
    if (temEndereco) itensLoc.push({ tipo: 'endereco', texto: empresa.endereco, cor: '#ef4444', glyph: '◉', slug: null });

    const ctxMedLoc = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    const medirLoc = (txt, size) => {
      if (!ctxMedLoc) return txt.length * size * 0.55;
      ctxMedLoc.save();
      ctxMedLoc.font = `bold ${size}px Arial, Helvetica, sans-serif`;
      const w = ctxMedLoc.measureText(txt).width;
      ctxMedLoc.restore();
      return w;
    };
    const calcLargLoc = () =>
      itensLoc.reduce((acc, it, i) => acc + iconeDLoc + gapIconeLoc + medirLoc(it.texto, fontSizeLoc) + (i < itensLoc.length - 1 ? gapEntreLoc : 0), 0);

    let larguraTotalLoc = calcLargLoc();
    // Auto-shrink se ultrapassa
    const larguraMaxLoc = larguraCanvas - paddingLoc * 2;
    if (larguraTotalLoc > larguraMaxLoc) {
      const escala = larguraMaxLoc / larguraTotalLoc;
      fontSizeLoc  = Math.max(10, fontSizeLoc * escala);
      iconeDLoc    = Math.max(16, iconeDLoc * escala);
      gapIconeLoc  = Math.max(4,  gapIconeLoc * escala);
      gapEntreLoc  = Math.max(12, gapEntreLoc * escala);
      larguraTotalLoc = calcLargLoc();
      if (larguraTotalLoc > larguraMaxLoc) {
        gapEntreLoc = Math.max(8, gapEntreLoc * (larguraMaxLoc / larguraTotalLoc));
        larguraTotalLoc = calcLargLoc();
      }
    }

    let xCursorLoc = (larguraCanvas - larguraTotalLoc) / 2;
    for (let i = 0; i < itensLoc.length; i++) {
      const it = itensLoc[i];
      // Ícone (slug = brand do simpleicons; sem slug = só glyph + círculo)
      if (it.slug) {
        desenharIconeBrand(canvas, xCursorLoc + iconeDLoc/2, yCentroLoc, iconeDLoc, it.cor, it.slug, it.glyph);
      } else {
        desenharIconeRedondo(canvas, xCursorLoc + iconeDLoc/2, yCentroLoc, iconeDLoc, it.cor, '#ffffff', it.glyph);
      }
      xCursorLoc += iconeDLoc + gapIconeLoc;
      // Texto: usa contraste do fundo de variação (faixa loc usa corFundoVariacao)
      const tLoc = new fabric.Text(it.texto, {
        fontSize: fontSizeLoc, fontWeight: 'bold',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fill: corTextoVar,
        selectable: false, evented: false,
      });
      tLoc.set({
        left: xCursorLoc,
        top:  yCentroLoc - tLoc.height / 2,
      });
      canvas.add(tLoc);
      xCursorLoc += tLoc.width + (i < itensLoc.length - 1 ? gapEntreLoc : 0);
    }
  }

  return alturaTotal;
}

function renderizarRodape(canvas, rodape, larguraCanvas, alturaCanvas, modelo = null) {
  if (!rodape) return 0;
  const altura = rodape.altura || 80;
  const top = alturaCanvas - altura;
  // Modo slim: quando altura < 35, escala fontes pra caber sem cortar
  const ehSlim = altura < 35;
  const fontSizeEsq = ehSlim ? Math.max(10, altura * 0.55) : 14;
  // Pedido do cliente: "*Imagens Meramente Ilustrativas" (textoDireito) maior em formatos
  // de canvas alto onde 12px fica ilegível: STORIES ≈ 2.03 ; REELS_INSTAGRAM +60% (1.60) ;
  // ENCARTE_GRANDE +80% (1.80).
  const multDir = modelo === 'STORIES' ? 2.03
    : modelo === 'REELS_INSTAGRAM' ? 1.60
    : modelo === 'ENCARTE_GRANDE' ? 1.80
    : 1.0;
  const fontSizeDir = (ehSlim ? Math.max(9,  altura * 0.50) : 12) * multDir;

  if (rodape.faixaSuperior) {
    canvas.add(new fabric.Rect({
      left: 0, top: top - 6, width: larguraCanvas, height: 6,
      fill: rodape.faixaSuperior,
      selectable: false, evented: false,
    }));
  }

  canvas.add(new fabric.Rect({
    left: 0, top, width: larguraCanvas, height: altura,
    fill: rodape.fundo || '#ef0000',
    selectable: false, evented: false,
  }));

  // IA de contraste: detecta luminância do fundo do rodapé e escolhe automaticamente
  // entre texto claro (branco) ou escuro (cinza-quase-preto) pra garantir legibilidade
  // em QUALQUER cor de tema. Substitui o branco fixo, que ficava invisível em rodapés
  // amarelos/claros (#fde047 do tema "Ouro & Real", por ex).
  const corRodape = rodape.fundo || '#ef0000';
  const corTextoRodape = corContrastanteParaTexto(corRodape, '#ffffff', '#1f2937');

  if (rodape.textoEsquerdo) {
    const tE = new fabric.Text(rodape.textoEsquerdo, {
      left: 20, fontSize: fontSizeEsq, fontWeight: 'bold', fill: corTextoRodape,
      selectable: false, evented: false,
    });
    tE.set('top', top + (altura - tE.height) / 2);
    canvas.add(tE);
  }
  if (rodape.textoDireito) {
    const t = new fabric.Text(rodape.textoDireito, {
      fontSize: fontSizeDir, fill: corTextoRodape, fontStyle: 'italic',
      selectable: false, evented: false,
    });
    t.set('left', larguraCanvas - t.width - 20);
    t.set('top', top + (altura - t.height) / 2);
    canvas.add(t);
  }

  return altura;
}

// ---------- Card de Produto ----------
// Layout do card (estilo qrofertas):
//   ┌──────────────────────────┐
//   │  NOME DO PRODUTO         │  ← topo, Anton bold caps
//   ├──────────────────────────┤
//   │       [foto]             │  ← centro, foto sem fundo
//   │                          │
//   ├──────────────────────────┤
//   │  ╭─────────────────╮     │  ← tag pílula vermelha com sombra
//   │  │ R$ 12,99        │     │     "R$" pequeno + número grande
//   │  ╰─────────────────╯     │
//   └──────────────────────────┘
// Defaults usados quando o usuário não escolheu uma fonte custom no PainelFontes.
// TESTE de tipografia: Arial Black pro nome, Arial pra R$/unidade, Arial Black pro valor
const FONTE_PRODUTO_BASE = '"Arial Black", "Arial Bold", Arial, Impact, sans-serif';
// "Preço" como categoria base — o RS e UNIDADE pegam Arial puro, o VALOR pega Arial Black
const FONTE_PRECO_BASE   = 'Arial, Helvetica, sans-serif';
const FONTE_VALOR_BASE   = '"Arial Black", "Arial Bold", Arial, Helvetica, sans-serif';
const FONTE_PRECO_WEIGHT = 'bold';

// Helpers DINÂMICOS que retornam a fonte ativa baseada no canvas.__fontes (sobreescrita
// do user via PainelFontes) OU cai no default. Aceita target: 'nome' | 'preco' | 'frase' | 'rodape'.
// Usa nas chamadas do renderer onde é prático trocar — não substitui todas as 91 referências
// existentes pra evitar refactor massivo. Apenas as principais.
function fonteAtual(canvas, target, fallback) {
  const id = canvas?.__fontes?.[target];
  if (id) return `"${id}", ${fallback}`;
  return fallback;
}

// Helper específico pra família de fonte do VALOR (números 9,99). Usa FONTE_VALOR_BASE
// (Arial Black) em vez do FONTE_PRECO_BASE (Arial puro) usado em R$ e KG.
function fonteFamilyValor(canvas) {
  const id = canvas?.__fontes?.['preco'];
  if (id) return `"${id}", ${FONTE_VALOR_BASE}`;
  return FONTE_VALOR_BASE;
}

// ---------- Layout TABELA (lista de produtos sem foto) ----------
// Header: faixa vermelha com "Produtos" à esquerda e "Por" à direita.
function renderizarTabelaHeader(canvas, x, y, w, h, paleta) {
  const corHeader = paleta.tagPreco || '#dc2626';
  // Background vermelho
  canvas.add(new fabric.Rect({
    left: x, top: y, width: w, height: h,
    fill: corHeader,
    selectable: false, evented: false,
  }));
  // "Produtos" à esquerda
  canvas.add(new fabric.Text('Produtos', {
    left: x + 16,
    top: y + h / 2 - 13,
    fontSize: 22,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: 900,
    fill: '#ffffff',
    selectable: false, evented: false,
  }));
  // "Por" à direita
  const por = new fabric.Text('Por', {
    top: y + h / 2 - 13,
    fontSize: 22,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: 900,
    fill: '#ffffff',
    selectable: false, evented: false,
  });
  por.set('left', x + w - por.width - 16);
  canvas.add(por);
}

// Linha de tabela: NOME bold à esquerda + PREÇO à direita (sem foto)
function renderizarLinhaLista(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const corFundoBase = paleta.fundoBox || '#fde047';
  const corNomeBase = paleta.textoNome || '#1f2937';

  // Cor de fundo (com suporte a custom + transparência)
  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else {
    const corBase = produto.corFundoCustom || corFundoBase;
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(corBase, transp / 100) : corBase;
  }
  const corNome = produto.corTextoCustom || corNomeBase;

  // Fundo da linha
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  const padding = 16;
  const centroY = box.y + box.h / 2;

  // === NOME (esquerda, BIG bold uppercase) ===
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  // Usa fonte pré-calculada (consistente em todas as linhas) se vier de cima.
  // Senão, calcula auto-shrink só pra ESSA linha (modo standalone).
  let fonteSizeNome = configs._fonteSizeNomeListaConsistente;
  if (!fonteSizeNome) {
    // multNome aplicado como escala FINAL — o shrink-por-largura abaixo é
    // width-bound; se multNome entrasse antes, seria "engolido" pelo shrink.
    fonteSizeNome = box.h * 0.62;
    // orçamento de largura efetivo: render final é (fonte * multNome), então
    // a decisão de shrink usa maxLargura / multNome.
    const maxLarguraNome = (box.w * 0.55) / (box.multNome || 1.0);
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${fonteSizeNome}px ${fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE)}`;
        let larg = ctx.measureText(textoNome).width;
        while (larg > maxLarguraNome && fonteSizeNome > 12) {
          fonteSizeNome *= 0.95;
          ctx.font = `900 ${fonteSizeNome}px ${fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE)}`;
          larg = ctx.measureText(textoNome).width;
        }
        ctx.restore();
      }
    } catch {}
    fonteSizeNome *= (box.multNome || 1.0);
  }

  const nome = new fabric.Text(textoNome, {
    left: box.x + padding,
    top: centroY - fonteSizeNome / 2 - fonteSizeNome * 0.05,
    fontSize: fonteSizeNome,
    fontFamily: fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE),
    fontWeight: 900,
    fill: corNome,
    selectable: false,
  });
  nome.set('boxIdx', idx);
  nome.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(nome);

  // === PREÇO (direita): R$ pequeno + valor grande + centavos médio ===
  // Pedido do cliente: valores no STORIES ajustados (0.80 → 0.68 → 0.74) — menor que o
  // original mas legível também nas tabelas com muitas linhas (ex: 20 produtos).
  const _fatorValorLista = configs?.modelo === 'STORIES' ? 0.74 : 0.80;
  let fonteValor = box.h * _fatorValorLista * (box.multValor || 1.0);
  fonteValor = capFonteValorOverflow(
    fonteValor,
    box.w * 0.42,  // ~42% da row pra preço (resto é nome)
    0.10,
    produto.preco,
    produto.unidadeAbrev,
    configs,
    canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d')
  );
  const fonteRS = fonteValor * 0.45;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  const fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  // Unidade (KG/UN/etc) — faltava na tabela; renderiza pequena tipo expoente após o preço.
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();
  const fonteUnid = fonteValor * 0.42;

  // Mede larguras — usa fonteAtual (mesma fonte do render dessa função)
  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  const espacoRsValor = fonteValor * 0.10;
  const espacoValorUnid = unidAbrev ? fonteValor * 0.08 : 0;
  const larguraTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  // Posição: alinhado à direita
  const startX = box.x + box.w - padding - larguraTotal;
  const corPreco = corNome;  // mesma cor do nome (preto)

  // R$ pequeno
  canvas.add(new fabric.Text('R$', {
    left: startX,
    top: centroY - fonteValor * 0.30,
    fontSize: fonteRS,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: FONTE_PRECO_WEIGHT,
    fill: corPreco,
    selectable: false, evented: false,
  }));
  // REAIS
  canvas.add(new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroY - fonteValor * 0.55,
    fontSize: fonteValor,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: FONTE_PRECO_WEIGHT,
    fill: corPreco,
    selectable: false, evented: false,
  }));
  // CENTAVOS
  if (temCentavos) {
    canvas.add(new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroY - fonteValor * 0.55 : centroY - fonteValor * 0.30,
      fontSize: fonteCentavos,
      fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
      fontWeight: FONTE_PRECO_WEIGHT,
      fill: corPreco,
      selectable: false, evented: false,
    }));
  }
  // UNIDADE (KG/UN/etc) — expoente pequeno após o preço (alinhado no topo do número)
  if (unidAbrev) {
    canvas.add(new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroY - fonteValor * 0.50,
      fontSize: fonteUnid,
      fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
      fontWeight: FONTE_PRECO_WEIGHT,
      fill: corPreco,
      selectable: false, evented: false,
    }));
  }
}

// ---------- Layout HORIZONTAL: card largo e baixo (W > H) ----------
// Foto à ESQUERDA, NOME no topo direita, BALÃO bottom direita.
// Usado em layouts onde os cards 1×1 ficam achatados (ex: g_11_dest_central).
//
//   ┌──────────────────────────────────┐
//   │             NOME DO PRODUTO      │  ← top right
//   │  [photo]                         │
//   │  [photo]    [R$ X,XX KG]         │  ← bottom right
//   └──────────────────────────────────┘
// Layout STACK VERTICAL: cards portrait (h > w) — usado automaticamente em
// formatos verticais (stories, A4 retrato, cartaz vertical) quando o card fica alto demais
// pra um split horizontal foto|texto fazer sentido.
//
//   ┌──────────────────┐
//   │   NOME PRODUTO   │  ← topo, full-width, centralizado
//   │                  │
//   │   ┌──────────┐   │
//   │   │  FOTO    │   │  ← centro, foto grande
//   │   │  GRANDE  │   │
//   │   └──────────┘   │
//   │                  │
//   │  [R$ X,XX KG]    │  ← fundo, balão centralizado
//   └──────────────────┘
function renderizarBoxStackVertical(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;
  const ehDestaque = box.destaque === true;

  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corFundoNormal = paleta.fundoBox || '#fcd34d';
  const corFundoDestaque = corPrimaria;
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const corNomeDestaque = '#ffffff';
  const corTextoTag = ehDestaque
    ? (paleta.textoPrecoDestaque || paleta.textoPreco || '#ffffff')
    : (paleta.textoPreco || '#ffffff');

  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else {
    const corBase = produto.corFundoCustom || (ehDestaque ? corFundoDestaque : corFundoNormal);
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(corBase, transp / 100) : corBase;
  }
  const corNome = produto.corTextoCustom || (ehDestaque ? corNomeDestaque : corNomeNormal);

  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: ehDestaque ? '#ffffff' : corPrimaria,
    strokeWidth: ehDestaque ? 0 : 3,
    rx: 4, ry: 4,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // ===== Regiões verticais =====
  const padding = 8;
  const nomeAreaH = box.h * 0.15;
  const balaoAreaH = box.h * 0.18;
  const fotoAreaY = box.y + padding + nomeAreaH;
  const fotoAreaH = box.h - nomeAreaH - balaoAreaH - padding * 2;
  const fotoAreaW = box.w - padding * 2;

  // ===== NOME (topo, full-width, centralizado) =====
  // Respeita TAMANHOS_TEXTO (Pequeno/Médio/Grande no ConfigBar)
  const fatorTextoSizeSV = (ts.nome || 24) / 24;
  const ehDestaqueSV = box.destaque === true;
  const boostDestaqueSV = ehDestaqueSV ? 1.9 : 1.0;
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  // multNome aplicado como escala FINAL — o shrink-por-largura abaixo é
  // width-bound; se multNome entrasse antes, seria "engolido" pelo shrink.
  let fonteSizeNome = nomeAreaH * 0.57 * fatorTextoSizeSV * boostDestaqueSV;  // 0.95 → 0.57 (-40%) + boost destaque
  // orçamento efetivo: render final é (fonte * multNome) → maxLargura / multNome.
  const maxLargNome = ((box.w - padding * 2) * 0.95) / (box.multNome || 1.0);
  let nomeWidth = 0;
  try {
    const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctxMed) {
      ctxMed.save();
      ctxMed.font = `900 ${fonteSizeNome}px ${fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE)}`;
      let larg = ctxMed.measureText(textoNome).width;
      while (larg > maxLargNome && fonteSizeNome > 10) {
        fonteSizeNome *= 0.92;
        ctxMed.font = `900 ${fonteSizeNome}px ${fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE)}`;
        larg = ctxMed.measureText(textoNome).width;
      }
      nomeWidth = larg;
      ctxMed.restore();
    }
  } catch {}
  fonteSizeNome *= (box.multNome || 1.0);
  nomeWidth *= (box.multNome || 1.0);
  const nome = new fabric.Text(textoNome, {
    left: box.x + (box.w - nomeWidth) / 2,
    top: box.y + padding + (nomeAreaH - fonteSizeNome) / 2,
    fontSize: fonteSizeNome,
    fontFamily: fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE),
    fontWeight: 900,
    fill: corNome,
    selectable: false,
  });
  nome.set('boxIdx', idx);
  nome.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(nome);

  // ===== FOTO (centro, grande) =====
  if (produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;
        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(produto.imagem);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(produto.imagem, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}
        const escala = Math.min(fotoAreaW / visualW, fotoAreaH / visualH) * 0.87 * (box.multFoto || 1.0);  // 0.95 → 0.87 (-8%)
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        img.set({
          left: box.x + (box.w - w) / 2,
          top: fotoAreaY + (fotoAreaH - h) / 2,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fundoIdxAtual = canvas.getObjects().indexOf(fundo);
        if (fundoIdxAtual >= 0) canvas.moveTo(img, fundoIdxAtual + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render stack] foto falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== BALÃO + PREÇO (fundo, centralizado) =====
  let fonteValor = balaoAreaH * 0.83 * (box.multValor || 1.0);  // 0.69 → 0.83 (+20%)
  fonteValor = capFonteValorOverflow(
    fonteValor,
    fotoAreaW * 0.95,
    0.55 * (box.multBalao || 1.0),
    produto.preco,
    produto.unidadeAbrev,
    configs,
    canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d')
  );
  const fonteRS = fonteValor * 0.55;
  const fonteUnid = fonteValor * 0.35;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  const fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();

  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  const espacoRsValor = fonteValor * 0.10;
  const espacoValorUnid = unidAbrev ? fonteValor * 0.06 : 0;
  const larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  const multBalao = box.multBalao || 1.0;
  const tagPaddingH = fonteValor * 0.55 * multBalao;
  const tagH = fonteValor * 1.50 * multBalao;  // 1.75 → 1.50 (pílula mais compacta)
  let tagW = larguraTextoTotal + tagPaddingH * 2;
  if (tagW > fotoAreaW * 0.95) tagW = fotoAreaW * 0.95;

  const tagX = box.x + (box.w - tagW) / 2;
  // Reserva espaço pra faixa de observação COLADA na borda inferior do card.
  // Quando há obs, padding inferior é zerado (balão fica imediatamente acima da faixa).
  const _obsSV = calcularObsFaixa(produto, fonteValor);
  const _padInfSV = _obsSV.temObs ? 0 : padding;
  const tagY = box.y + box.h - _padInfSV - balaoAreaH + (balaoAreaH - tagH) / 2 - _obsSV.obsAltura;

  const sombraS = new fabric.Rect({
    left: tagX + 2, top: tagY + 3,
    width: tagW, height: tagH,
    fill: 'rgba(0,0,0,0.25)',
    rx: tagH / 2, ry: tagH / 2,
    selectable: false, evented: false,
  });
  canvas.add(sombraS);
  const pilulaS = new fabric.Rect({
    left: tagX, top: tagY,
    width: tagW, height: tagH,
    fill: corPrimaria,
    rx: tagH / 2, ry: tagH / 2,
    stroke: '#ffffff', strokeWidth: 2,
    selectable: false, evented: false,
  });
  canvas.add(pilulaS);

  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;
  if (balaoUrl) {
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width || (canvas.__renderGen || 0) !== myGen) return;
        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(balaoUrl, bbox);
        }
        let visW = img.width, visH = img.height;
        if (bbox) {
          img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
          visW = bbox.w; visH = bbox.h;
        }
        const escala = Math.min(tagW / visW, tagH / visH);
        img.set({
          scaleX: escala, scaleY: escala,
          left: tagX + (tagW - visW * escala) / 2,
          top: tagY + (tagH - visH * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(img);
        sombraS.set('visible', false);
        pilulaS.set('visible', false);
        const objs = canvas.getObjects();
        const rsRef = objs.find(o => o.boxIdx === idx && o.text === 'R$');
        if (rsRef) {
          const rsIdx = canvas.getObjects().indexOf(rsRef);
          if (rsIdx >= 0) canvas.moveTo(img, rsIdx);
        }
        canvas.requestRenderAll();
      } catch {}
    }, { crossOrigin: 'anonymous' });
  }

  const startX = tagX + (tagW - larguraTextoTotal) / 2;
  const centroTagY = tagY + tagH / 2;

  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroTagY - fonteValor * 0.30,
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  rsObj.set('boxIdx', idx);
  canvas.add(rsObj);

  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroTagY - fonteValor * 0.55,
    fontSize: fonteValor, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  canvas.add(reaisObj);

  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroTagY - fonteValor * 0.55 : centroTagY - fonteValor * 0.30,
      fontSize: fonteCentavos, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroTagY - fonteValor * 0.55,
      fontSize: fonteUnid, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(unidObj);
  }
  // TRAVA: garante que o preço não passe do balão
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], tagX, tagW, tagY, tagH);

  // ===== FAIXA DE OBSERVAÇÃO (logo abaixo do balão) =====
  const _objsObsSV = renderizarFaixaObs(canvas, box, produto, tagY, tagH, fonteValor, padding, paleta);
  _objsObsSV.forEach(o => canvas.bringToFront(o));
  // Selo de desconto (% OFF) acima do balão + Selo +18
  renderizarSeloDesconto(canvas, box, produto, { x: tagX, y: tagY, w: tagW, h: tagH });
  renderizarSeloMaior18(canvas, box, produto);
}

function renderizarBoxHorizontal(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  // Cards portrait (h > w * 1.2): split horizontal foto|texto desperdiça espaço.
  // Roteia pra layout vertical empilhado (nome topo / foto centro / balão fundo).
  if (box.h > box.w * 1.2) {
    return renderizarBoxStackVertical(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }

  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;
  const ehDestaque = box.destaque === true;

  // ===== Cores =====
  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corFundoNormal = paleta.fundoBox || '#fcd34d';
  const corFundoDestaque = corPrimaria;
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const corNomeDestaque = '#ffffff';
  const corTextoTag = ehDestaque
    ? (paleta.textoPrecoDestaque || paleta.textoPreco || '#ffffff')
    : (paleta.textoPreco || '#ffffff');

  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else {
    const corBase = produto.corFundoCustom || (ehDestaque ? corFundoDestaque : corFundoNormal);
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(corBase, transp / 100) : corBase;
  }
  const corNome = produto.corTextoCustom || (ehDestaque ? corNomeDestaque : corNomeNormal);

  // ===== Fundo do card =====
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: ehDestaque ? '#ffffff' : corPrimaria,
    strokeWidth: ehDestaque ? 0 : 3,
    rx: 4, ry: 4,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // ===== Layout das regiões =====
  const padding = 6;
  const leftW = box.w * 0.45;        // foto ocupa 45% à esquerda
  const rightX = box.x + leftW;
  const rightW = box.w - leftW - padding;

  // Foto (esquerda)
  const photoAreaY = box.y + padding;
  const photoAreaH = box.h - padding * 2;
  const photoAreaW = leftW - padding;

  // ===== FOTO (left) =====
  if (produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;

        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(produto.imagem);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(produto.imagem, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}

        let escala = Math.min(photoAreaW / visualW, photoAreaH / visualH) * (box.multFoto || 1.0);
        // CAP DE SEGURANÇA: a foto NUNCA pode ser maior que o card inteiro — sem isso,
        // multFoto > 1.0 + foto vertical (garrafa, lata alta) estourava pra fora do card,
        // invadindo o card vizinho. (Bug observado em g_11_dest_central com SACHE HEINZ.)
        const escalaMaxCard = Math.min(
          (box.w - padding * 2) / visualW,
          (box.h - padding * 2) / visualH,
        );
        if (escala > escalaMaxCard) escala = escalaMaxCard;
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        // Posição clampada — nunca passa das bordas internas do card
        let imgLeft = box.x + padding + (photoAreaW - w) / 2;
        let imgTop = photoAreaY + (photoAreaH - h) / 2;
        imgLeft = Math.max(box.x + padding, Math.min(imgLeft, box.x + box.w - padding - w));
        imgTop = Math.max(box.y + padding, Math.min(imgTop, box.y + box.h - padding - h));
        img.set({
          left: imgLeft,
          top: imgTop,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fundoIdxAtual = canvas.getObjects().indexOf(fundo);
        if (fundoIdxAtual >= 0) canvas.moveTo(img, fundoIdxAtual + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render horizontal] foto falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== NOME (right top, 1 ou 2 linhas balanceadas) =====
  // Respeita TAMANHOS_TEXTO (Pequeno/Médio/Grande no ConfigBar)
  const fatorTextoSizeH = (ts.nome || 24) / 24;
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  const palavras = textoNome.split(/\s+/).filter(Boolean);
  const fonteFamiliaNome = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);
  const nomeAreaH = box.h * 0.45;
  // orçamento efetivo: render final é (fonte * multNome) → largura / multNome.
  const maxLargNome = (rightW * 0.92) / (box.multNome || 1.0);
  // Paridade com outros renderers: 0.55 × 2.77 ≈ 1.52 (aumentos cumulativos prévios)
  const ehDestaqueH = box.destaque === true;
  const boostDestaqueH = ehDestaqueH ? 1.9 : 1.0;
  // multNome aplicado como escala FINAL (pós-shrink) — ver nota em renderizarBoxCardBanner.
  const fonteNatural1L = nomeAreaH * 0.50 * fatorTextoSizeH * boostDestaqueH;  // 0.84 → 0.50 (-40%)
  let nomeLinhas = [textoNome];
  let fonteSizeNome = fonteNatural1L;

  const ctxMedNome = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMedNome) {
    try {
      ctxMedNome.save();
      ctxMedNome.font = `900 ${fonteSizeNome}px ${fonteFamiliaNome}`;
      const larguraNatural = ctxMedNome.measureText(textoNome).width;

      if (larguraNatural <= maxLargNome) {
        // 1 linha cabe natural
      } else if (palavras.length >= 2) {
        // ANTES de quebrar em 2 linhas, tenta encolher a fonte de 1 linha até 65%
        // do alvo. Se couber em 1 linha com esse shrink moderado, MANTÉM 1 linha.
        let fonte1L = fonteSizeNome;
        const piso1L = fonteSizeNome * 0.65;
        let larg1L = larguraNatural;
        while (larg1L > maxLargNome && fonte1L > piso1L) {
          fonte1L *= 0.96;
          ctxMedNome.font = `900 ${fonte1L}px ${fonteFamiliaNome}`;
          larg1L = ctxMedNome.measureText(textoNome).width;
        }
        if (larg1L <= maxLargNome) {
          fonteSizeNome = fonte1L;  // coube em 1 linha
        } else {
        // Quebra em 2 linhas balanceadas (split que minimiza diferença de largura)
        let melhorSplit = 1;
        let melhorDelta = Infinity;
        for (let i = 1; i < palavras.length; i++) {
          const l1 = palavras.slice(0, i).join(' ');
          const l2 = palavras.slice(i).join(' ');
          const dl = Math.abs(ctxMedNome.measureText(l1).width - ctxMedNome.measureText(l2).width);
          if (dl < melhorDelta) { melhorDelta = dl; melhorSplit = i; }
        }
        nomeLinhas = [
          palavras.slice(0, melhorSplit).join(' '),
          palavras.slice(melhorSplit).join(' '),
        ];
        fonteSizeNome = nomeAreaH * 0.37 * fatorTextoSizeH * boostDestaqueH;  // 0.61 → 0.37 (-40%)
        const medirMax = () => {
          ctxMedNome.font = `900 ${fonteSizeNome}px ${fonteFamiliaNome}`;
          return Math.max(...nomeLinhas.map(l => ctxMedNome.measureText(l).width));
        };
        let largMax = medirMax();
        while (largMax > maxLargNome && fonteSizeNome > 10) {
          fonteSizeNome *= 0.95;
          largMax = medirMax();
        }
        }  // fecha o else (não coube em 1 linha)
      } else {
        // 1 palavra só — encolhe até caber
        let larg = larguraNatural;
        while (larg > maxLargNome && fonteSizeNome > 10) {
          fonteSizeNome *= 0.92;
          ctxMedNome.font = `900 ${fonteSizeNome}px ${fonteFamiliaNome}`;
          larg = ctxMedNome.measureText(textoNome).width;
        }
      }
      ctxMedNome.restore();
    } catch {}
  }

  // Nome CONSISTENTE (opt-in via box.nomeConsistente): padroniza o tamanho do nome
  // em TODOS os irmãos — replica a lógica de shrink/wrap pra cada nome de configs._nomesProdutos
  // e usa o MENOR. Sem isso, nomes curtos (PIZZA, BACON) ficam grandes e longos
  // (BISTEQUINHA SADIA, SACHE HEINZ) pequenos — fonts discrepantes por falta de letras.
  if (box.nomeConsistente && Array.isArray(configs._nomesProdutos) && configs._nomesProdutos.length > 1) {
    const _ctxNC = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (_ctxNC) {
      try {
        _ctxNC.save();
        let _menorFonte = Infinity;
        for (const _nm of configs._nomesProdutos) {
          const _t = (_nm || 'PRODUTO').toUpperCase();
          const _pal = _t.split(/\s+/).filter(Boolean);
          let _f = fonteNatural1L;
          _ctxNC.font = `900 ${_f}px ${fonteFamiliaNome}`;
          const _largNat = _ctxNC.measureText(_t).width;
          let _coube1L = false;
          if (_largNat <= maxLargNome) {
            _coube1L = true;
          } else if (_pal.length >= 2) {
            let _f1L = _f, _piso = _f * 0.65, _lg = _largNat;
            while (_lg > maxLargNome && _f1L > _piso) {
              _f1L *= 0.96;
              _ctxNC.font = `900 ${_f1L}px ${fonteFamiliaNome}`;
              _lg = _ctxNC.measureText(_t).width;
            }
            if (_lg <= maxLargNome) { _f = _f1L; _coube1L = true; }
          }
          if (!_coube1L && _pal.length >= 2) {
            // 2 linhas balanceadas — encolhe até caber
            let _mS = 1, _mD = Infinity;
            for (let i = 1; i < _pal.length; i++) {
              const _dl = Math.abs(_ctxNC.measureText(_pal.slice(0, i).join(' ')).width - _ctxNC.measureText(_pal.slice(i).join(' ')).width);
              if (_dl < _mD) { _mD = _dl; _mS = i; }
            }
            const _lns = [_pal.slice(0, _mS).join(' '), _pal.slice(_mS).join(' ')];
            _f = nomeAreaH * 0.37 * fatorTextoSizeH * boostDestaqueH;
            const _medMax = () => {
              _ctxNC.font = `900 ${_f}px ${fonteFamiliaNome}`;
              return Math.max(..._lns.map(l => _ctxNC.measureText(l).width));
            };
            let _lg2 = _medMax();
            while (_lg2 > maxLargNome && _f > 10) { _f *= 0.95; _lg2 = _medMax(); }
          } else if (!_coube1L) {
            // 1 palavra só — shrink até caber
            let _lg = _largNat;
            while (_lg > maxLargNome && _f > 10) {
              _f *= 0.92;
              _ctxNC.font = `900 ${_f}px ${fonteFamiliaNome}`;
              _lg = _ctxNC.measureText(_t).width;
            }
          }
          if (_f < _menorFonte) _menorFonte = _f;
        }
        _ctxNC.restore();
        if (_menorFonte !== Infinity) fonteSizeNome = _menorFonte;
      } catch {}
    }
  }

  // multNome aplicado como escala FINAL — garante que reduzir multNome SEMPRE
  // reduz o nome, mesmo quando o shrink acima o encolheu por largura.
  fonteSizeNome *= (box.multNome || 1.0);

  // Renderiza linhas centralizadas
  const lineGapH = 0.10;
  const totalLinhasH = nomeLinhas.length;
  // nomeOffsetTop: empurra o nome pra baixo (fração da nomeAreaH). 0=colado no topo (default).
  const _nomeOffsetTopH = (box.nomeOffsetTop || 0) * nomeAreaH;
  const yInicialNomeH = box.y + padding + _nomeOffsetTopH;  // 0=colado no topo → mais espaço pra foto
  nomeLinhas.forEach((linha, i) => {
    let largLinha = 0;
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${fonteSizeNome}px ${fonteFamiliaNome}`;
        largLinha = ctx.measureText(linha).width;
        ctx.restore();
      }
    } catch {}
    const txt = new fabric.Text(linha, {
      left: rightX + (rightW - largLinha) / 2,
      top: yInicialNomeH + i * fonteSizeNome * (1 + lineGapH),
      fontSize: fonteSizeNome,
      fontFamily: fonteFamiliaNome,
      fontWeight: 900,
      fill: corNome,
      selectable: false,
    });
    txt.set('boxIdx', idx);
    txt.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(txt);
  });

  // ===== BALÃO + PREÇO (right bottom) =====
  let fonteValor = box.h * 0.47 * (box.multValor || 1.0);  // 0.39 → 0.47 (+20%)
  // Cap considera o padding do balão (0.55 * multBalao por lado): balão = texto + 2*padding
  // precisa caber em rightW * 0.95.
  fonteValor = capFonteValorOverflow(
    fonteValor,
    rightW * 0.95,
    0.55 * (box.multBalao || 1.0),
    produto.preco,
    produto.unidadeAbrev,
    configs,
    canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d')
  );
  const fonteRS = fonteValor * 0.55;
  const fonteUnid = fonteValor * 0.35;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  const fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();

  // Mede larguras
  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  // Tamanho do balão
  const espacoRsValor = fonteValor * 0.10;
  const espacoValorUnid = unidAbrev ? fonteValor * 0.06 : 0;
  const larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  const multBalao = box.multBalao || 1.0;
  const tagPaddingH = fonteValor * 0.55 * multBalao;
  const tagH = fonteValor * 1.50 * multBalao;  // 1.75 → 1.50 (pílula mais compacta)
  let tagW = larguraTextoTotal + tagPaddingH * 2;
  // Cap pela largura disponível
  if (tagW > rightW * 0.95) tagW = rightW * 0.95;

  const tagX = rightX + (rightW - tagW) / 2;
  // Faixa cola na borda inferior — quando há obs, balão fica imediatamente acima.
  const _obsH = calcularObsFaixa(produto, fonteValor);
  const _padInfH = _obsH.temObs ? 0 : padding;
  const tagY = box.y + box.h - _padInfH - tagH - _obsH.obsAltura;

  // Pílula default (fallback)
  const sombraH = new fabric.Rect({
    left: tagX + 2, top: tagY + 3,
    width: tagW, height: tagH,
    fill: 'rgba(0,0,0,0.25)',
    rx: tagH / 2, ry: tagH / 2,
    selectable: false, evented: false,
  });
  canvas.add(sombraH);

  const pilulaH = new fabric.Rect({
    left: tagX, top: tagY,
    width: tagW, height: tagH,
    fill: corPrimaria,
    rx: tagH / 2, ry: tagH / 2,
    stroke: '#ffffff', strokeWidth: 2,
    selectable: false, evented: false,
  });
  canvas.add(pilulaH);

  // Balão custom (async, esconde fallback se carregar)
  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;
  if (balaoUrl) {
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width || (canvas.__renderGen || 0) !== myGen) return;
        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(balaoUrl, bbox);
        }
        let visW = img.width, visH = img.height;
        if (bbox) {
          img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
          visW = bbox.w; visH = bbox.h;
        }
        const escala = Math.min(tagW / visW, tagH / visH);
        img.set({
          scaleX: escala, scaleY: escala,
          left: tagX + (tagW - visW * escala) / 2,
          top: tagY + (tagH - visH * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(img);
        sombraH.set('visible', false);
        pilulaH.set('visible', false);
        const objs = canvas.getObjects();
        const rsRef = objs.find(o => o.boxIdx === idx && o.text === 'R$');
        if (rsRef) {
          const rsIdx = canvas.getObjects().indexOf(rsRef);
          if (rsIdx >= 0) canvas.moveTo(img, rsIdx);
        }
        canvas.requestRenderAll();
      } catch {}
    }, { crossOrigin: 'anonymous' });
  }

  // R$ + valor + centavos + unidade
  const startX = tagX + (tagW - larguraTextoTotal) / 2;
  const centroTagY = tagY + tagH / 2;

  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroTagY - fonteValor * 0.30,
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  rsObj.set('boxIdx', idx);
  canvas.add(rsObj);

  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroTagY - fonteValor * 0.55,
    fontSize: fonteValor, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  canvas.add(reaisObj);

  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroTagY - fonteValor * 0.55 : centroTagY - fonteValor * 0.30,
      fontSize: fonteCentavos, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroTagY - fonteValor * 0.55,
      fontSize: fonteUnid, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(unidObj);
  }
  // TRAVA: garante que o preço não passe do balão
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], tagX, tagW, tagY, tagH);

  // ===== FAIXA DE OBSERVAÇÃO (logo abaixo do balão) =====
  const _objsObsH = renderizarFaixaObs(canvas, box, produto, tagY, tagH, fonteValor, padding, paleta);
  _objsObsH.forEach(o => canvas.bringToFront(o));
  // Selo de desconto (% OFF) acima do balão + Selo +18
  renderizarSeloDesconto(canvas, box, produto, { x: tagX, y: tagY, w: tagW, h: tagH });
  renderizarSeloMaior18(canvas, box, produto);
}

// ---------- Layout HORIZONTAL-TOPO: nome topo centro, foto esquerda + balão direita ----------
//
//   ┌────────────────────────────────┐
//   │       NOME DO PRODUTO          │  ← topo centralizado
//   │                                │
//   │  [photo]      [R$ X,XX KG]     │  ← bottom: foto esq + balão dir
//   └────────────────────────────────┘
function renderizarBoxHorizontalTopo(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;
  const ehDestaque = box.destaque === true;

  // Cores
  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corFundoNormal = paleta.fundoBox || '#fcd34d';
  const corFundoDestaque = corPrimaria;
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const corNomeDestaque = '#ffffff';
  const corTextoTag = ehDestaque
    ? (paleta.textoPrecoDestaque || paleta.textoPreco || '#ffffff')
    : (paleta.textoPreco || '#ffffff');

  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else {
    const corBase = produto.corFundoCustom || (ehDestaque ? corFundoDestaque : corFundoNormal);
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(corBase, transp / 100) : corBase;
  }
  const corNome = produto.corTextoCustom || (ehDestaque ? corNomeDestaque : corNomeNormal);

  // Fundo
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: ehDestaque ? '#ffffff' : corPrimaria,
    strokeWidth: ehDestaque ? 0 : 3,
    rx: 4, ry: 4,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // ===== Layout das regiões =====
  const padding = 8;
  const nomeAreaH = box.h * 0.32;       // topo: 32% da altura pro nome
  const bottomY = box.y + nomeAreaH + padding;
  const bottomH = box.h - nomeAreaH - padding * 2;

  // Layout: foto à ESQUERDA + balão à DIREITA. Default 45/55. Override per-box
  // via box.balaoAreaFrac (fração da largura útil pro balão, 0–1). Útil pra
  // grades que precisam de balão GRANDE — aumentar fração libera o cap horizontal
  // (capFonteValorOverflow) e font cresce de verdade.
  const _balaoFrac = box.balaoAreaFrac ?? 0.55;
  const photoAreaW = (box.w - padding * 3) * (1 - _balaoFrac);
  const balaoAreaW = (box.w - padding * 3) * _balaoFrac;
  const halfW = balaoAreaW;  // legacy alias usado em capFonteValorOverflow
  const photoX = box.x + padding;
  const balaoX = box.x + padding + photoAreaW + padding;

  // ===== NOME (topo, 1 ou 2 linhas balanceadas, centralizado) =====
  // Respeita TAMANHOS_TEXTO (pequeno/médio/grande) — multiplicador relativo ao médio.
  const fatorTextoSizeHT = (ts.nome || 24) / 24;
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  const palavrasHT = textoNome.split(/\s+/).filter(Boolean);
  const fonteFamiliaHT = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);
  // orçamento efetivo: render final é (fonte * multNome) → largura / multNome.
  const maxLargNomeHT = ((box.w - padding * 2) * 0.95) / (box.multNome || 1.0);
  // Paridade com outros renderers: 0.65 × 2.77 ≈ 1.80 (aumentos cumulativos prévios)
  const ehDestaqueHT = box.destaque === true;
  const boostDestaqueHT = ehDestaqueHT ? 1.9 : 1.0;
  // multNome aplicado como escala FINAL (pós-shrink) — ver nota em renderizarBoxCardBanner.
  const fonteNatural1LHT = nomeAreaH * 0.59 * fatorTextoSizeHT * boostDestaqueHT;  // 0.99 → 0.59 (-40%)
  let nomeLinhasHT = [textoNome];
  let fonteSizeNome = fonteNatural1LHT;

  const ctxMedHT = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMedHT) {
    try {
      ctxMedHT.save();
      ctxMedHT.font = `900 ${fonteSizeNome}px ${fonteFamiliaHT}`;
      const larguraNatural = ctxMedHT.measureText(textoNome).width;

      if (larguraNatural <= maxLargNomeHT) {
        // 1 linha cabe natural
      } else if (palavrasHT.length >= 2) {
        // ANTES de quebrar em 2 linhas, tenta encolher a fonte de 1 linha até 70%
        // do natural. Se couber em 1 linha com esse shrink moderado, MANTÉM 1 linha
        // (nomes tipo "ERVILHA QUERO LATA" cabem em 1 linha sem ficar minúsculos).
        let fonte1L = fonteNatural1LHT;
        const piso1L = fonteNatural1LHT * 0.70;
        let larg1L = larguraNatural;
        while (larg1L > maxLargNomeHT && fonte1L > piso1L) {
          fonte1L *= 0.96;
          ctxMedHT.font = `900 ${fonte1L}px ${fonteFamiliaHT}`;
          larg1L = ctxMedHT.measureText(textoNome).width;
        }
        if (larg1L <= maxLargNomeHT) {
          // Coube em 1 linha com shrink moderado — mantém 1 linha
          fonteSizeNome = fonte1L;
        } else {
          // Não coube nem encolhendo — quebra em 2 linhas balanceadas
          let melhorSplit = 1;
          let melhorDelta = Infinity;
          for (let i = 1; i < palavrasHT.length; i++) {
            const l1 = palavrasHT.slice(0, i).join(' ');
            const l2 = palavrasHT.slice(i).join(' ');
            const dl = Math.abs(ctxMedHT.measureText(l1).width - ctxMedHT.measureText(l2).width);
            if (dl < melhorDelta) { melhorDelta = dl; melhorSplit = i; }
          }
          nomeLinhasHT = [
            palavrasHT.slice(0, melhorSplit).join(' '),
            palavrasHT.slice(melhorSplit).join(' '),
          ];
          fonteSizeNome = nomeAreaH * 0.41 * fatorTextoSizeHT * boostDestaqueHT;  // 0.69 → 0.41 (-40%)
          const medirMaxHT = () => {
            ctxMedHT.font = `900 ${fonteSizeNome}px ${fonteFamiliaHT}`;
            return Math.max(...nomeLinhasHT.map(l => ctxMedHT.measureText(l).width));
          };
          let largMax = medirMaxHT();
          while (largMax > maxLargNomeHT && fonteSizeNome > 10) {
            fonteSizeNome *= 0.95;
            largMax = medirMaxHT();
          }
        }
      } else {
        let larg = larguraNatural;
        while (larg > maxLargNomeHT && fonteSizeNome > 10) {
          fonteSizeNome *= 0.95;
          ctxMedHT.font = `900 ${fonteSizeNome}px ${fonteFamiliaHT}`;
          larg = ctxMedHT.measureText(textoNome).width;
        }
      }
      ctxMedHT.restore();
    } catch {}
  }

  // Nome CONSISTENTE (opt-in via box.nomeConsistente): padroniza o tamanho do nome
  // em TODOS os irmãos — replica o shrink/wrap pra cada nome de configs._nomesProdutos
  // e usa o MENOR. Resolve fonts discrepantes (PIZZA grande, BISTEQUINHA SADIA pequeno).
  if (box.nomeConsistente && Array.isArray(configs._nomesProdutos) && configs._nomesProdutos.length > 1) {
    const _ctxNC = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (_ctxNC) {
      try {
        _ctxNC.save();
        let _menorFonte = Infinity;
        for (const _nm of configs._nomesProdutos) {
          const _t = (_nm || 'PRODUTO').toUpperCase();
          const _pal = _t.split(/\s+/).filter(Boolean);
          let _f = fonteNatural1LHT;
          _ctxNC.font = `900 ${_f}px ${fonteFamiliaHT}`;
          const _largNat = _ctxNC.measureText(_t).width;
          let _coube1L = false;
          if (_largNat <= maxLargNomeHT) {
            _coube1L = true;
          } else if (_pal.length >= 2) {
            let _f1L = _f, _piso = _f * 0.70, _lg = _largNat;
            while (_lg > maxLargNomeHT && _f1L > _piso) {
              _f1L *= 0.96;
              _ctxNC.font = `900 ${_f1L}px ${fonteFamiliaHT}`;
              _lg = _ctxNC.measureText(_t).width;
            }
            if (_lg <= maxLargNomeHT) { _f = _f1L; _coube1L = true; }
          }
          if (!_coube1L && _pal.length >= 2) {
            // 2 linhas balanceadas — encolhe até caber
            let _mS = 1, _mD = Infinity;
            for (let i = 1; i < _pal.length; i++) {
              const _dl = Math.abs(_ctxNC.measureText(_pal.slice(0, i).join(' ')).width - _ctxNC.measureText(_pal.slice(i).join(' ')).width);
              if (_dl < _mD) { _mD = _dl; _mS = i; }
            }
            const _lns = [_pal.slice(0, _mS).join(' '), _pal.slice(_mS).join(' ')];
            _f = nomeAreaH * 0.41 * fatorTextoSizeHT * boostDestaqueHT;
            const _medMax = () => {
              _ctxNC.font = `900 ${_f}px ${fonteFamiliaHT}`;
              return Math.max(..._lns.map(l => _ctxNC.measureText(l).width));
            };
            let _lg2 = _medMax();
            while (_lg2 > maxLargNomeHT && _f > 10) { _f *= 0.95; _lg2 = _medMax(); }
          } else if (!_coube1L) {
            let _lg = _largNat;
            while (_lg > maxLargNomeHT && _f > 10) {
              _f *= 0.95;
              _ctxNC.font = `900 ${_f}px ${fonteFamiliaHT}`;
              _lg = _ctxNC.measureText(_t).width;
            }
          }
          if (_f < _menorFonte) _menorFonte = _f;
        }
        _ctxNC.restore();
        if (_menorFonte !== Infinity) fonteSizeNome = _menorFonte;
      } catch {}
    }
  }

  // multNome aplicado como escala FINAL — garante que reduzir multNome SEMPRE
  // reduz o nome, mesmo quando o shrink acima o encolheu por largura.
  fonteSizeNome *= (box.multNome || 1.0);

  // Renderiza linhas centralizadas
  const lineGapHT = 0.10;
  const totalLinhasHT = nomeLinhasHT.length;
  const alturaBlocoHT = fonteSizeNome * totalLinhasHT + fonteSizeNome * lineGapHT * (totalLinhasHT - 1);
  // nomeOffsetTop em horizontal-topo: 0=padrão (centralizado em nomeAreaH),
  // positivo=desloca pra baixo, negativo=pra cima. Fração da nomeAreaH.
  const _nomeOffsetTopHT = (box.nomeOffsetTop || 0) * nomeAreaH;
  // Clamp: nunca acima do topo do card (offset negativo grande não joga o nome
  // pra cima da capa/borda). No máximo "colado" no topo, com 4px de respiro.
  const _yPropostoHT = box.y + (nomeAreaH - alturaBlocoHT) / 2 + _nomeOffsetTopHT;
  const yInicialHT = Math.max(box.y + 4, _yPropostoHT);
  nomeLinhasHT.forEach((linha, i) => {
    let largLinha = 0;
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${fonteSizeNome}px ${fonteFamiliaHT}`;
        largLinha = ctx.measureText(linha).width;
        ctx.restore();
      }
    } catch {}
    const txt = new fabric.Text(linha, {
      left: box.x + (box.w - largLinha) / 2,
      top: yInicialHT + i * fonteSizeNome * (1 + lineGapHT),
      fontSize: fonteSizeNome,
      fontFamily: fonteFamiliaHT,
      fontWeight: 900,
      fill: corNome,
      selectable: false,
    });
    txt.set('boxIdx', idx);
    txt.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(txt);
  });

  // ===== FOTO (bottom esquerda) =====
  if (produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;

        let visualW = img.width, visualH = img.height;
        try {
          // smartFoto: usa detector que ENTENDE o conteúdo real do produto
          // (ignora tanto transparente quanto fundo branco/cinza uniforme) — chave
          // pra normalizar tamanhos quando PNGs têm paddings diferentes.
          const cacheKey = box.smartFoto ? `${produto.imagem}:conteudoReal` : produto.imagem;
          let bbox = CACHE_BBOX_BALAO.get(cacheKey);
          if (bbox === undefined) {
            bbox = box.smartFoto
              ? detectarBboxConteudoReal(img)
              : detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(cacheKey, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}

        // multFoto AMPLIA a foto. BUG-FIX: antes só ampliava fotoAreaW (largura),
        // então fotos height-bound (tall/aspect ratio que limita pela altura) não
        // respondiam ao multFoto. Agora multiplica a escala diretamente, com cap
        // no tamanho máximo do card pra não estourar a borda.
        const mf = box.multFoto || 1.0;
        const fotoAreaW = photoAreaW;
        const fotoAreaH = bottomH;  // bottomH inteiro — costuma ter folga vertical
        const escalaContain = Math.min(fotoAreaW / visualW, fotoAreaH / visualH);
        // smartFoto: aplica boost adaptativo pra normalizar tamanho VISUAL — fotos
        // com aspect-ratio diferente (boards horizontais vs latas verticais) saem
        // com peso semelhante no card. Sem smartFoto, mantém contain puro.
        let smartBoost = 1.0;
        if (box.smartFoto) {
          const areaImg = (visualW * escalaContain) * (visualH * escalaContain);
          const areaTarget = fotoAreaW * fotoAreaH;
          const fillRatio = areaImg / Math.max(1, areaTarget);
          const FILL_IDEAL = 0.88;
          if (fillRatio < FILL_IDEAL) {
            smartBoost = Math.min(Math.sqrt(FILL_IDEAL / fillRatio), 1.35);
          }
        }
        let escala = escalaContain * mf * smartBoost;
        // CAP DE SEGURANÇA: a foto nunca pode ser maior que o card inteiro
        const escalaMaxCard = Math.min(
          (box.w - padding * 2) / visualW,
          (box.h - padding * 2) / visualH,
        );
        if (escala > escalaMaxCard) escala = escalaMaxCard;
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        // Posição centralizada na área da foto, mas CLAMPADA pra nunca passar
        // das bordas internas do card (esquerda/topo/direita/baixo).
        // fotoOffsetX: per-box (fração de fotoAreaW). 0=centro (default), 0.5=mais à direita.
        // Útil pra grades onde a área do balão é estreita e a foto pode ocupar mais espaço.
        const _fotoOffsetX = (box.fotoOffsetX || 0) * fotoAreaW;
        let imgLeft = photoX + (fotoAreaW - w) / 2 + _fotoOffsetX;
        let imgTop = bottomY + (fotoAreaH - h) / 2;
        imgLeft = Math.max(box.x + padding, Math.min(imgLeft, box.x + box.w - padding - w));
        imgTop = Math.max(box.y + padding, Math.min(imgTop, box.y + box.h - padding - h));
        img.set({
          left: imgLeft,
          top: imgTop,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fundoIdxAtual = canvas.getObjects().indexOf(fundo);
        if (fundoIdxAtual >= 0) canvas.moveTo(img, fundoIdxAtual + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render horizontal-topo] foto falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== BALÃO + PREÇO (bottom direita) =====
  let fonteValor = bottomH * 0.75 * (box.multValor || 1.0);  // 0.61 → 0.75 (+23%)
  // Cap considera padding do balão — REDUZIDO 0.55 → 0.30 pra texto preencher mais
  fonteValor = capFonteValorOverflow(
    fonteValor,
    halfW * 0.98,
    0.30 * (box.multBalao || 1.0),
    produto.preco,
    produto.unidadeAbrev,
    configs,
    canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d')
  );
  // LET (não const) porque a safety check abaixo pode encolher fonteValor proporcionalmente
  // se o balão estourar a largura disponível.
  let fonteRS = fonteValor * 0.55;
  let fonteUnid = fonteValor * 0.35;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  let fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();

  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  let espacoRsValor = fonteValor * 0.10;
  let espacoValorUnid = unidAbrev ? fonteValor * 0.10 : 0;  // 0.06 → 0.10 (mais respiro antes da unidade)
  let larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  const multBalao = box.multBalao || 1.0;
  let tagPaddingH = fonteValor * 0.55 * multBalao;
  let tagH = fonteValor * 1.50 * multBalao;  // 1.75 → 1.50 (pílula mais compacta)
  // Folga de segurança extra quando há unidade — evita o "CX/KG" estourar a borda
  // direita do balão (a unidade fica em estilo expoente e pode vazar sem essa margem).
  // balaoFixo: todas as pílulas no mesmo layout ficam idênticas (largura não depende
  // do texto). Fonte é capada pra caber via capFonteValorOverflow anterior.
  let tagW;
  if (box.balaoFixo) {
    tagW = halfW * 0.85 * multBalao;
  } else {
    tagW = larguraTextoTotal + tagPaddingH * 2 + (unidAbrev ? larguraUnid * 0.6 : 0);
  }

  // Safety: se o balão quer ser maior que o espaço disponível, encolhe TUDO proporcional
  // (fonte + fontes derivadas + larguras + padding). Antes só capava tagW deixando texto vazar.
  if (tagW > halfW * 0.98) {
    const scale = (halfW * 0.98) / tagW;
    fonteValor *= scale;
    fonteRS *= scale;
    fonteUnid *= scale;
    fonteCentavos *= scale;
    larguraRs *= scale;
    larguraReais *= scale;
    larguraCentavos *= scale;
    larguraUnid *= scale;
    espacoRsValor *= scale;
    espacoValorUnid *= scale;
    tagPaddingH *= scale;
    tagH *= scale;
    larguraTextoTotal *= scale;
    tagW = halfW * 0.98;
  }

  // balaoBoost (opt-in, default 1.0): escala TUDO do balão (fonte, padding, largura,
  // altura) APÓS o cap. Permite balão crescer pra dentro da área da foto (mas ainda
  // limitado à largura do card). Útil quando o cap natural fica pequeno demais.
  // Hard cap: balão nunca passa de (box.w - padding*2) pra não estourar a borda.
  const balaoBoost = box.balaoBoost ?? 1.0;
  if (balaoBoost !== 1.0) {
    const maxBoostW = (box.w - padding * 2) / tagW;
    const boostReal = Math.min(balaoBoost, maxBoostW);
    if (boostReal > 1.0) {
      fonteValor *= boostReal;
      fonteRS *= boostReal;
      fonteUnid *= boostReal;
      fonteCentavos *= boostReal;
      larguraRs *= boostReal;
      larguraReais *= boostReal;
      larguraCentavos *= boostReal;
      larguraUnid *= boostReal;
      espacoRsValor *= boostReal;
      espacoValorUnid *= boostReal;
      tagPaddingH *= boostReal;
      tagH *= boostReal;
      larguraTextoTotal *= boostReal;
      tagW *= boostReal;
    }
  }

  // Balão alinhado horizontalmente na sua área (40% à direita). Default 0.5 (centro).
  // box.balaoAlignX: 0=esquerda, 0.5=centro, 1=direita. Permite empurrar o balão
  // pro canto direito (alinhado com a borda direita do card, estilo qrofertas).
  const _balaoAlignX = box.balaoAlignX ?? 0.5;
  const tagX = balaoX + (balaoAreaW - tagW) * _balaoAlignX;
  // Faixa cola na borda inferior — quando há obs, balão fica imediatamente acima.
  const _obsHT = calcularObsFaixa(produto, fonteValor);
  const _padInfHT = _obsHT.temObs ? 0 : padding;
  const tagY = box.y + box.h - tagH - _padInfHT - _obsHT.obsAltura;

  // Pílula fallback
  const sombraHT = new fabric.Rect({
    left: tagX + 2, top: tagY + 3,
    width: tagW, height: tagH,
    fill: 'rgba(0,0,0,0.25)',
    rx: tagH / 2, ry: tagH / 2,
    selectable: false, evented: false,
  });
  canvas.add(sombraHT);

  const pilulaHT = new fabric.Rect({
    left: tagX, top: tagY,
    width: tagW, height: tagH,
    fill: corPrimaria,
    rx: tagH / 2, ry: tagH / 2,
    stroke: '#ffffff', strokeWidth: 2,
    selectable: false, evented: false,
  });
  canvas.add(pilulaHT);

  // Balão custom (async)
  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;
  if (balaoUrl) {
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width || (canvas.__renderGen || 0) !== myGen) return;
        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(balaoUrl, bbox);
        }
        let visW = img.width, visH = img.height;
        if (bbox) {
          img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
          visW = bbox.w; visH = bbox.h;
        }
        const escala = Math.min(tagW / visW, tagH / visH);
        img.set({
          scaleX: escala, scaleY: escala,
          left: tagX + (tagW - visW * escala) / 2,
          top: tagY + (tagH - visH * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(img);
        sombraHT.set('visible', false);
        pilulaHT.set('visible', false);
        const objs = canvas.getObjects();
        const rsRef = objs.find(o => o.boxIdx === idx && o.text === 'R$');
        if (rsRef) {
          const rsIdx = canvas.getObjects().indexOf(rsRef);
          if (rsIdx >= 0) canvas.moveTo(img, rsIdx);
        }
        canvas.requestRenderAll();
      } catch {}
    }, { crossOrigin: 'anonymous' });
  }

  // Texto R$/valor/centavos/unidade
  const startX = tagX + (tagW - larguraTextoTotal) / 2;
  const centroTagY = tagY + tagH / 2;

  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroTagY - fonteValor * 0.30,
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  rsObj.set('boxIdx', idx);
  canvas.add(rsObj);

  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroTagY - fonteValor * 0.55,
    fontSize: fonteValor, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  canvas.add(reaisObj);

  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroTagY - fonteValor * 0.55 : centroTagY - fonteValor * 0.30,
      fontSize: fonteCentavos, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroTagY - fonteValor * 0.55,
      fontSize: fonteUnid, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(unidObj);
  }
  // TRAVA: garante que o conjunto do preço não passe do balão (encolhe se preciso)
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], tagX, tagW, tagY, tagH);

  // ===== FAIXA DE OBSERVAÇÃO (logo abaixo do balão) =====
  const _objsObsHT = renderizarFaixaObs(canvas, box, produto, tagY, tagH, fonteValor, padding, paleta);
  _objsObsHT.forEach(o => canvas.bringToFront(o));
  // Selo de desconto (% OFF) acima do balão + Selo +18
  renderizarSeloDesconto(canvas, box, produto, { x: tagX, y: tagY, w: tagW, h: tagH });
  renderizarSeloMaior18(canvas, box, produto);
}

// ---------- Layout especial: DESTAQUE MÁXIMO (1 produto por página) ----------
// Foto grande no topo, NOME bottom-left (gigante), TAG bottom-right.
// Estilo qrofertas pra grade "1 Produto - 1x1".
//
//   ┌──────────────────────────────┐
//   │                              │
//   │         [Foto grande]        │
//   │                              │
//   │                              │
//   ├──────────────────┬───────────┤
//   │  FILE PEITO      │ R$ 13,99  │
//   └──────────────────┴───────────┘
function renderizarDestaqueMaximo(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;

  // ===== Cores =====
  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corFundoBase = paleta.fundoBox || '#fde047';
  const corNomeBase = paleta.textoNome || '#1f2937';
  // destaque-maximo é sempre destaque — usa a cor de valor de destaque do tema
  const corTextoTag = paleta.textoPrecoDestaque || paleta.textoPreco || '#ffffff';
  // Quando box.destaque, usa fundo vermelho (igual card-banner com destaque).
  // Sem isso, ao switchar pra destaque-maximo via perModelo, destaque perdia o
  // fundo vermelho característico (ficava igual aos não-destaque).
  const ehDestaqueDM = box.destaque === true;
  const corFundoDestaqueDM = corPrimaria;
  const corNomeDestaqueDM = '#ffffff';

  // Cor de fundo (com suporte a custom + transparência)
  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else {
    const corBase = produto.corFundoCustom || (ehDestaqueDM ? corFundoDestaqueDM : corFundoBase);
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(corBase, transp / 100) : corBase;
  }
  const corNome = produto.corTextoCustom || (ehDestaqueDM ? corNomeDestaqueDM : corNomeBase);

  // ===== Fundo do card =====
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: corPrimaria, strokeWidth: 4,
    rx: 4, ry: 4,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // ===== Layout das regiões (estilo qrofertas: nome topo, foto centro, balão fundo direita) =====
  // box.semFoto (opt-in): pula a foto e expande nome+balão pra preencher o card.
  // - VERTICAL (h>w): nome topo + balão bottom (stacked)
  // - HORIZONTAL (w>h*1.3): nome ESQUERDA + balão DIREITA (side-by-side)
  // box.fotoEsquerda (opt-in): foto na metade ESQUERDA (full height) + nome topo
  // + balão bottom na metade DIREITA. Usado em TV_HORIZONTAL pra card de 1 produto.
  const padding = 12;
  const cartazHoriz = box.semFoto && box.w > box.h * 1.3;
  const fotoEsq = box.fotoEsquerda && !box.semFoto;
  // Destaque em destaque-maximo (sem fotoEsq/semFoto): dá mais espaço pro nome
  // pra não encostar na foto (topStripH 22% em vez de 16%).
  const destaqueStacked = box.destaque && !box.semFoto && !fotoEsq;
  const topStripH = cartazHoriz ? (box.h - padding * 2)
    : box.semFoto ? box.h * 0.45
    : destaqueStacked ? box.h * 0.22
    : box.h * 0.16;
  const balaoStripH = cartazHoriz ? (box.h - padding * 2) : (box.semFoto ? box.h * 0.50 : (fotoEsq ? box.h * 0.45 : box.h * 0.25));
  const balaoY = cartazHoriz ? (box.y + padding) : (box.y + box.h - balaoStripH);

  // Photo region: meio (entre nome topo e balão fundo) OU left half se fotoEsq
  const photoAreaY = fotoEsq ? (box.y + padding) : (box.y + padding + topStripH);
  const photoAreaH = fotoEsq ? (box.h - padding * 2) : (balaoY - photoAreaY - padding);
  const photoAreaW = fotoEsq ? ((box.w / 2) - padding * 2) : (box.w - padding * 2);

  // ===== FOTO (top, grande) — pula se box.semFoto =====
  if (!box.semFoto && produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;

        // Auto-crop bbox não-transparente
        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(produto.imagem);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(produto.imagem, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}

        let escala = Math.min(photoAreaW / visualW, photoAreaH / visualH) * 0.87 * (box.multFoto || 1.0);  // 0.95 → 0.87 (-8%)
        // Safety clamp: foto nunca pode passar do photoArea (multFoto alto + foto pequena
        // estourava pra fora do card no modo fotoEsq).
        const escalaMaxArea = Math.min(photoAreaW / visualW, photoAreaH / visualH);
        if (escala > escalaMaxArea) escala = escalaMaxArea;
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        // fotoEsq: foto centralizada na metade ESQUERDA. Default: centralizada no card todo.
        const fotoLeftPos = fotoEsq
          ? box.x + padding + (photoAreaW - w) / 2
          : box.x + (box.w - w) / 2;
        img.set({
          left: fotoLeftPos,
          top: photoAreaY + (photoAreaH - h) / 2,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fundoIdxAtual = canvas.getObjects().indexOf(fundo);
        if (fundoIdxAtual >= 0) canvas.moveTo(img, fundoIdxAtual + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render destaque] foto falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== NOME (TOPO full-width, GIGANTE — estilo qrofertas) =====
  // Suporta 1 ou 2 linhas balanceadas. Centralizado horizontalmente.
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  const palavras = textoNome.split(/\s+/).filter(Boolean);
  const fonteFamilia = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);
  // orçamento efetivo: render final é (fonte * multNome) → largura / multNome.
  // cartazHoriz: nome ocupa só a metade ESQUERDA do card (balão fica na direita).
  // fotoEsq: nome ocupa só a metade DIREITA (foto à esquerda).
  const maxLarguraNome = (cartazHoriz || fotoEsq)
    ? ((box.w / 2 - padding * 2) * 0.95) / (box.multNome || 1.0)
    : ((box.w - padding * 2) * 0.95) / (box.multNome || 1.0);
  // multNome aplicado como escala FINAL (pós-shrink) — ver nota em renderizarBoxCardBanner.
  const fonteNatural1L = topStripH * 0.78;
  let nomeLinhas = [textoNome];
  let fonteSizeNome = fonteNatural1L;

  const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMed) {
    try {
      ctxMed.save();
      ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
      const larguraNatural = ctxMed.measureText(textoNome).width;

      if (larguraNatural <= maxLarguraNome) {
        // Cabe em 1 linha sem encolher — mantém
      } else if (palavras.length >= 2) {
        // ANTES de quebrar em 2 linhas, tenta encolher a fonte de 1 linha até 65%
        // do alvo. Se couber em 1 linha com esse shrink moderado, MANTÉM 1 linha.
        let fonte1L = fonteSizeNome;
        const piso1L = fonteSizeNome * 0.65;
        let larg1L = larguraNatural;
        while (larg1L > maxLarguraNome && fonte1L > piso1L) {
          fonte1L *= 0.96;
          ctxMed.font = `900 ${fonte1L}px ${fonteFamilia}`;
          larg1L = ctxMed.measureText(textoNome).width;
        }
        if (larg1L <= maxLarguraNome) {
          fonteSizeNome = fonte1L;  // coube em 1 linha
        } else {
        // Tentar quebrar em 2 linhas — divide no ponto que minimiza diferença de largura
        // entre as duas linhas (split balanceado).
        let melhorSplit = 1;
        let melhorDelta = Infinity;
        for (let i = 1; i < palavras.length; i++) {
          const l1 = palavras.slice(0, i).join(' ');
          const l2 = palavras.slice(i).join(' ');
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          const dl = Math.abs(ctxMed.measureText(l1).width - ctxMed.measureText(l2).width);
          if (dl < melhorDelta) { melhorDelta = dl; melhorSplit = i; }
        }
        const linha1 = palavras.slice(0, melhorSplit).join(' ');
        const linha2 = palavras.slice(melhorSplit).join(' ');
        nomeLinhas = [linha1, linha2];
        // Em 2 linhas, cada linha pode ser ~52% da topStripH (com gap de 10% entre elas)
        fonteSizeNome = topStripH * 0.52;
        // Encolhe se a linha mais larga ainda passar do limite
        const medirLargMax = () => {
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          return Math.max(ctxMed.measureText(linha1).width, ctxMed.measureText(linha2).width);
        };
        let largMax = medirLargMax();
        while (largMax > maxLarguraNome && fonteSizeNome > 10) {
          fonteSizeNome *= 0.95;
          largMax = medirLargMax();
        }
        }  // fecha o else (não coube em 1 linha)
      } else {
        // 1 palavra só — encolhe até caber
        let largura = larguraNatural;
        while (largura > maxLarguraNome && fonteSizeNome > 12) {
          fonteSizeNome *= 0.95;
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          largura = ctxMed.measureText(textoNome).width;
        }
      }
      ctxMed.restore();
    } catch {}
  }

  // multNome aplicado como escala FINAL — garante que reduzir multNome SEMPRE
  // reduz o nome, mesmo quando o shrink acima o encolheu por largura.
  fonteSizeNome *= (box.multNome || 1.0);

  // Renderiza 1 ou 2 linhas no TOPO, centralizadas horizontal e verticalmente
  const lineGap = 0.10;
  const totalLinhas = nomeLinhas.length;
  const alturaBlocoNome = fonteSizeNome * totalLinhas + fonteSizeNome * lineGap * (totalLinhas - 1);
  // cartazHoriz: nome centralizado VERTICALMENTE na metade esquerda do card.
  // fotoEsq: nome centralizado VERTICALMENTE na metade SUPERIOR direita (entre topo
  // e meio do card) — pra não ficar colado no topo e nem encostar no balão embaixo.
  // Default: colado no topo.
  const yInicialNome = cartazHoriz
    ? box.y + (box.h - alturaBlocoNome) / 2
    : fotoEsq
      ? box.y + (box.h / 2 - alturaBlocoNome) / 2 + box.h * 0.05
      : box.y + padding;
  nomeLinhas.forEach((linha, i) => {
    // Mede largura desta linha pra centralizar
    let largLinha = 0;
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
        largLinha = ctx.measureText(linha).width;
        ctx.restore();
      }
    } catch {}
    const yLinha = yInicialNome + i * fonteSizeNome * (1 + lineGap);
    // cartazHoriz: nome centralizado na metade ESQUERDA do card.
    // fotoEsq: nome centralizado na metade DIREITA.
    const leftPos = cartazHoriz
      ? box.x + (box.w / 2 - largLinha) / 2
      : fotoEsq
        ? box.x + box.w / 2 + (box.w / 2 - largLinha) / 2
        : box.x + (box.w - largLinha) / 2;
    const txt = new fabric.Text(linha, {
      left: leftPos,
      top: yLinha,
      fontSize: fonteSizeNome,
      fontFamily: fonteFamilia,
      fontWeight: 900,
      fill: corNome,
      selectable: false,
    });
    txt.set('boxIdx', idx);
    txt.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(txt);
  });

  // ===== BALÃO (bottom-right, GIGANTE — estilo qrofertas) =====
  // - cartazHoriz: balão na METADE DIREITA do card, BEM grande (centralizado vertical)
  // - semFoto vertical: balão CENTRALIZADO bottom, ~85% largura
  // - fotoEsq: balão na metade DIREITA bottom (nome topo direito + balão bottom direito)
  // - Default: bottom-right 55% (qrofertas style)
  const tagW = cartazHoriz ? (box.w / 2 - padding * 2) * 0.95
    : fotoEsq ? (box.w / 2 - padding * 2) * 0.95
    : box.semFoto ? box.w * 0.85
    : destaqueStacked ? box.w * 0.75   // destaque stacked: balão maior + centralizado
    : box.w * 0.55;
  const tagH = cartazHoriz ? box.h * 0.50 : balaoStripH * 0.92;
  const tagX = cartazHoriz
    ? box.x + box.w / 2 + (box.w / 2 - tagW) / 2
    : fotoEsq
      ? box.x + box.w / 2 + (box.w / 2 - tagW) / 2
      : (box.semFoto || destaqueStacked || box.balaoCentralizado) ? box.x + (box.w - tagW) / 2
      : box.x + box.w - tagW - padding;
  const tagY = cartazHoriz
    ? box.y + (box.h - tagH) / 2
    : balaoY + (balaoStripH - tagH) / 2;

  // SEMPRE desenha pílula default (sombra + retângulo) como FALLBACK.
  // Se houver balão custom, ele é carregado async e SUBSTITUI sombra+pílula.
  // Sem isso, se o balão custom falha em carregar, ficaria sem nada visível.
  const sombraFallback = new fabric.Rect({
    left: tagX + 2, top: tagY + 3,
    width: tagW, height: tagH,
    fill: 'rgba(0,0,0,0.25)',
    rx: tagH / 2, ry: tagH / 2,
    selectable: false, evented: false,
  });
  canvas.add(sombraFallback);
  const pilulaFallback = new fabric.Rect({
    left: tagX, top: tagY,
    width: tagW, height: tagH,
    fill: corPrimaria,
    rx: tagH / 2, ry: tagH / 2,
    stroke: '#ffffff', strokeWidth: 2,
    selectable: false, evented: false,
  });
  canvas.add(pilulaFallback);

  // Se tem balão custom, carrega async e ESCONDE sombra + pílula fallback
  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;
  if (balaoUrl) {
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width || (canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(pilulaFallback) < 0) return;

        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(balaoUrl, bbox);
        }
        let visW = img.width, visH = img.height;
        if (bbox) {
          img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
          visW = bbox.w; visH = bbox.h;
        }
        const escala = Math.min(tagW / visW, tagH / visH);
        img.set({
          scaleX: escala, scaleY: escala,
          left: tagX + (tagW - visW * escala) / 2,
          top: tagY + (tagH - visH * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(img);
        // Esconde TANTO a sombra QUANTO a pílula fallback
        sombraFallback.set('visible', false);
        pilulaFallback.set('visible', false);
        // Move balão pra ficar atrás dos textos do tag
        const objs = canvas.getObjects();
        const rsRef = objs.find(o => o.boxIdx === idx && o.text === 'R$');
        if (rsRef) {
          const rsIdx = canvas.getObjects().indexOf(rsRef);
          if (rsIdx >= 0) canvas.moveTo(img, rsIdx);
        }
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render destaque] balão custom falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== R$ + valor + centavos + unidade dentro do tag =====
  // BUG-FIX: ajustarPrecoParaTag calcula a fonte que cabe EXATO no tagW.
  // Antes multiplicávamos por multValor DEPOIS — jogando 10-20% pra fora.
  // Visível em "FILÉ MERLUZA R$ 27,90 KG" no g_1x1 (multValor=1.20) onde o
  // texto estourava a borda direita do balão.
  // FIX: passa tagW REDUZIDO pra ajustar (tagW / multValor). Aí multiplica
  // a fonte por multValor e o resultado CABE no balão real.
  const ctxFonteDM = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  const multValorDM = box.multValor || 1.0;
  const tagWParaCalculo = multValorDM > 1.0 ? tagW / multValorDM : tagW;
  const ajusteFonteDM = ajustarPrecoParaTag(tagWParaCalculo, tagH, produto.preco, produto.unidadeAbrev, configs, ctxFonteDM);
  let fonteValor = (ajusteFonteDM?.fonteValor || tagH * 0.55) * multValorDM;
  // let (não const) porque o safety abaixo pode reduzir proporcionalmente
  let fonteRS = fonteValor * 0.50;
  let fonteUnid = fonteValor * 0.32;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  let fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();

  // Mede com canvas context
  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  let espacoRsValor = fonteValor * 0.10;
  let espacoValorUnid = unidAbrev ? fonteValor * 0.06 : 0;
  let larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;

  // SAFETY FINAL: se ainda estoura (com 4% margem cada lado), encolhe TUDO
  // proporcional. Protege contra edge cases não cobertos pelo ajustarPrecoParaTag
  // (ex: unidade muito grande "BANDEJ", multValor extremo, font fallback diferente).
  const margemSeg = tagW * 0.04;
  const limiteSegW = tagW - margemSeg * 2;
  if (larguraTextoTotal > limiteSegW) {
    const scale = limiteSegW / larguraTextoTotal;
    fonteValor *= scale;
    fonteRS *= scale;
    fonteUnid *= scale;
    fonteCentavos *= scale;
    larguraRs *= scale;
    larguraReais *= scale;
    larguraCentavos *= scale;
    larguraUnid *= scale;
    espacoRsValor *= scale;
    espacoValorUnid *= scale;
    larguraTextoTotal *= scale;
  }
  const startX = tagX + (tagW - larguraTextoTotal) / 2;
  const centroTagY = tagY + tagH / 2;

  // R$
  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroTagY - fonteValor * 0.30,
    fontSize: fonteRS,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag,
    selectable: false, evented: false,
  });
  rsObj.set('boxIdx', idx);
  canvas.add(rsObj);

  // Reais (parte inteira)
  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroTagY - fonteValor * 0.55,
    fontSize: fonteValor,
    fontFamily: fonteFamilyValor(canvas),
    fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag,
    selectable: false, evented: false,
  });
  reaisObj.set('boxIdx', idx);
  canvas.add(reaisObj);

  // Centavos
  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroTagY - fonteValor * 0.55 : centroTagY - fonteValor * 0.30,
      fontSize: fonteCentavos,
      fontFamily: fonteFamilyValor(canvas),
      fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag,
      selectable: false, evented: false,
    });
    centavosObj.set('boxIdx', idx);
    canvas.add(centavosObj);
  }

  // Unidade
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroTagY - fonteValor * 0.55,
      fontSize: fonteUnid,
      fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
      fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag,
      selectable: false, evented: false,
    });
    unidObj.set('boxIdx', idx);
    canvas.add(unidObj);
  }
  // TRAVA: garante que o preço não passe do balão
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], tagX, tagW, tagY, tagH);

  // ===== FAIXA DE OBSERVAÇÃO (ABOVE do balão, no topo da balaoStrip) =====
  // Em destaque-máximo o balão fica numa strip inferior — posicionamos a obs
  // logo ACIMA da strip do balão pra ficar VISÍVEL e não estourar o card.
  const { temObs: _temObsDM, obsTexto: _obsTxtDM, obsFonte: _obsFonteDM, obsAltura: _obsAltDM } = calcularObsFaixa(produto, fonteValor);
  if (_temObsDM) {
    const { fundo: _corFundoDM, texto: _corTextoDM } = escolherCorFaixaObs(paleta);
    const _obsYDM = balaoY - _obsAltDM - 4;
    const _bgDM = new fabric.Rect({
      left: box.x, top: _obsYDM,
      width: box.w, height: _obsAltDM,
      fill: _corFundoDM,
      selectable: false, evented: false,
    });
    canvas.add(_bgDM);
    const _txtDM = new fabric.Text(_obsTxtDM, {
      left: box.x + box.w / 2,
      top: _obsYDM + _obsAltDM / 2 - _obsFonteDM * 0.55,
      fontSize: _obsFonteDM,
      fontFamily: _FONTE_PRECO_HELPER,
      fontWeight: 'bold',
      fill: _corTextoDM,
      originX: 'center',
      selectable: false, evented: false,
    });
    canvas.add(_txtDM);
    canvas.bringToFront(_bgDM);
    canvas.bringToFront(_txtDM);
  }
  // Selo de desconto (% OFF) acima do balão + Selo +18
  renderizarSeloDesconto(canvas, box, produto, { x: tagX, y: tagY, w: tagW, h: tagH });
  renderizarSeloMaior18(canvas, box, produto);
}

// Layout CARD-BANNER: estilo qrofertas — card branco com nome topo, foto centro grande,
// e banner vermelho FULL-WIDTH no fundo (em vez de pílula centralizada).
//
//   ┌──────────────────┐
//   │   FILE PEITO     │  ← nome topo (1 ou 2 linhas balanceadas)
//   │                  │
//   │   ┌──────────┐   │
//   │   │   FOTO   │   │  ← foto centro grande (~60% da altura)
//   │   └──────────┘   │
//   │ ████████████████ │  ← banner vermelho full-width
//   │ █  R$ 13,99 KG█  │
//   └──────────────────┘  (cantos inferiores arredondados acompanham o card)
function renderizarBoxCardBanner(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;

  // Cores
  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const ehDestaqueCB = box.destaque === true;
  // PRIORIDADE: cor manual do tema (textoPrecoDestaque > textoPreco) > IA > fallback.
  // Respeita a escolha do usuário no editor de tema. Só usa IA quando tema NÃO
  // define cor explicitamente.
  const corTextoTag = paleta.textoPrecoDestaque
    || paleta.textoPreco
    || corContrastanteParaTextoPermissivo(corPrimaria);

  // Card: DESTAQUE usa cor primária (vermelho do tema), NORMAL usa fundoBox (amarelo).
  // Custom do produto sempre ganha. Antes o card-banner ignorava o destaque — bug.
  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else if (produto.corFundoCustom) {
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(produto.corFundoCustom, transp / 100) : produto.corFundoCustom;
  } else if (ehDestaqueCB) {
    fundoBox = paleta.fundoBoxDestaque || corPrimaria;  // destaque = fundo vermelho
  } else {
    fundoBox = paleta.fundoBox || '#fcd34d';  // normal = amarelo
  }
  // Nome: branco no destaque (sobre fundo vermelho), cor do tema no normal.
  const corNome = produto.corTextoCustom
    || (ehDestaqueCB ? (paleta.textoNomeDestaque || '#ffffff') : corNomeNormal);
  const cardRx = 8;

  // ===== Card outer =====
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: corPrimaria, strokeWidth: 2,
    rx: cardRx, ry: cardRx,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // ===== Regiões =====
  const padding = 10;
  const nomeAreaH = box.h * 0.28;     // 26% → 28% — ainda mais espaço pro nome
  // Banner reduzido AGRESSIVAMENTE: muitos layouts têm multBalao=1.30 que anulava
  // reduções anteriores. Agora base 0.14, com multBalao 1.30 dá ~0.18 efetivo
  // (vs 0.31 original) — banner ~40% menor visível.
  const bannerAreaH = box.h * 0.14 * (box.multBalao || 1.0);
  const fotoAreaY = box.y + padding + nomeAreaH;
  const fotoAreaH = box.h - nomeAreaH - bannerAreaH - padding * 2;
  const fotoAreaW = box.w - padding * 2;

  // ===== NOME (topo, 1 ou 2 linhas balanceadas, centralizado) =====
  // Tamanho é dirigido por TAMANHOS_TEXTO (Pequeno/Médio/Grande no ConfigBar):
  // multiplicador relativo ao médio (16/24/48 → 0.67×/1×/2×). Mantém base
  // proporcional à altura do card pra preservar layout.
  const fatorTextoSize = (ts.nome || 24) / 24;
  // ehDestaqueCB já definido no topo da função (junto com as cores)
  // Destaque ganha boost de 1.9x no nome (fica visualmente proeminente)
  const boostDestaqueCB = ehDestaqueCB ? 1.9 : 1.0;
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  const palavras = textoNome.split(/\s+/).filter(Boolean);
  const fonteFamilia = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);
  const maxLargNome = (box.w - padding * 2) * 0.95;
  // multNome é escala FINAL (aplicada no fim), NÃO entra na fonte aqui — senão o
  // shrink-por-largura "engole" o multNome (0.40 e 0.36 convergiam pro mesmo
  // tamanho width-bound). Mas a decisão "1 vs 2 linhas" PRECISA considerar o
  // tamanho real: como o render final é (fonte * multNome), o orçamento de
  // largura efetivo é maxLargNome / multNome. Com multNome baixo, cabe mais
  // texto por linha → nomes que apareciam em 2 linhas voltam pra 1.
  const multNomeCB = box.multNome || 1.0;
  // BUG-FIX: antes era `maxLargNome / multNomeCB` sempre. Quando multNome<1, isso
  // DUPLICAVA o orçamento → shrink convergia pra mesma largura saturada, e o post-scale
  // cancelava exatamente. Agora só divide quando multNome>1 (pra fit considerar o
  // tamanho final). Pra multNome<1 usa o limite natural; o post-scale × multNome
  // reduz proporcionalmente o nome.
  const maxLargNomeEff = multNomeCB > 1 ? maxLargNome / multNomeCB : maxLargNome;
  const fonteNatural1L = nomeAreaH * 0.73 * fatorTextoSize * boostDestaqueCB;
  let nomeLinhas = [textoNome];
  let fonteSizeNome = fonteNatural1L;

  const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMed) {
    try {
      ctxMed.save();
      ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
      const larguraNatural = ctxMed.measureText(textoNome).width;

      if (larguraNatural <= maxLargNomeEff) {
        // 1 linha cabe no orçamento efetivo (maxLargNome / multNome) ✓
      } else if (palavras.length >= 2) {
        // ANTES de quebrar em 2 linhas, tenta encolher a fonte de 1 linha até 65%
        // do alvo. Se couber em 1 linha com esse shrink moderado, MANTÉM 1 linha
        // (nomes tipo "PIZZA SEARA" cabem em 1 linha sem ficar minúsculos).
        let fonte1L = fonteNatural1L;
        const piso1L = fonteNatural1L * 0.65;
        let larg1L = larguraNatural;
        while (larg1L > maxLargNomeEff && fonte1L > piso1L) {
          fonte1L *= 0.96;
          ctxMed.font = `900 ${fonte1L}px ${fonteFamilia}`;
          larg1L = ctxMed.measureText(textoNome).width;
        }
        if (larg1L <= maxLargNomeEff) {
          // Coube em 1 linha com shrink moderado — mantém 1 linha
          fonteSizeNome = fonte1L;
          // nomeLinhas continua [textoNome] (1 linha)
        } else {
        // Não coube nem encolhendo — quebra em 2 linhas balanceadas
        let melhorSplit = 1;
        let melhorDelta = Infinity;
        for (let i = 1; i < palavras.length; i++) {
          const l1 = palavras.slice(0, i).join(' ');
          const l2 = palavras.slice(i).join(' ');
          const dl = Math.abs(ctxMed.measureText(l1).width - ctxMed.measureText(l2).width);
          if (dl < melhorDelta) { melhorDelta = dl; melhorSplit = i; }
        }
        nomeLinhas = [
          palavras.slice(0, melhorSplit).join(' '),
          palavras.slice(melhorSplit).join(' '),
        ];
        fonteSizeNome = nomeAreaH * 0.52 * fatorTextoSize * boostDestaqueCB;
        const medirMax = () => {
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          return Math.max(...nomeLinhas.map(l => ctxMed.measureText(l).width));
        };
        let largMax = medirMax();
        // shrink só se 2 linhas ainda não couberem no orçamento efetivo
        while (largMax > maxLargNomeEff && fonteSizeNome > 10) {
          fonteSizeNome *= 0.95;
          largMax = medirMax();
        }
        }  // fecha o else (não coube em 1 linha → 2 linhas)
      } else {
        // 1 palavra só — encolhe até caber
        let larg = larguraNatural;
        while (larg > maxLargNomeEff && fonteSizeNome > 12) {
          fonteSizeNome *= 0.95;
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          larg = ctxMed.measureText(textoNome).width;
        }
      }
      ctxMed.restore();
    } catch {}
  }

  // multNome aplicado como escala FINAL — garante que reduzir multNome SEMPRE
  // reduz o nome, mesmo quando o shrink acima encolheu a fonte por largura.
  fonteSizeNome *= multNomeCB;

  // SAFETY pós-escala: garante que cada linha do nome cabe em maxLargNome.
  // Necessário quando multNome alto + nome longo: o shrink anterior tem piso e
  // pode parar antes de fitar. Sem essa safety o texto extrapola o card.
  try {
    const ctxSafe = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctxSafe) {
      ctxSafe.save();
      ctxSafe.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
      let largMaxFinal = Math.max(...nomeLinhas.map(l => ctxSafe.measureText(l).width));
      let iter = 0;
      while (largMaxFinal > maxLargNome && fonteSizeNome > 8 && iter < 30) {
        fonteSizeNome *= 0.95;
        ctxSafe.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
        largMaxFinal = Math.max(...nomeLinhas.map(l => ctxSafe.measureText(l).width));
        iter++;
      }
      ctxSafe.restore();
    }
  } catch {}

  const lineGap = 0.10;
  const totalLinhasNome = nomeLinhas.length;
  const alturaBlocoNome = fonteSizeNome * totalLinhasNome + fonteSizeNome * lineGap * (totalLinhasNome - 1);
  // nomeOffsetTop: per-box (e per-modelo) — empurra o nome pra baixo dentro da nomeArea.
  // 0=colado no topo (default), valor positivo desloca proporcionalmente à nomeAreaH.
  const _nomeOffsetTop = (box.nomeOffsetTop || 0) * nomeAreaH;
  const yInicialNome = box.y + padding + _nomeOffsetTop;
  nomeLinhas.forEach((linha, i) => {
    let largLinha = 0;
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
        largLinha = ctx.measureText(linha).width;
        ctx.restore();
      }
    } catch {}
    const txt = new fabric.Text(linha, {
      left: box.x + (box.w - largLinha) / 2,
      top: yInicialNome + i * fonteSizeNome * (1 + lineGap),
      fontSize: fonteSizeNome,
      fontFamily: fonteFamilia,
      fontWeight: 900,
      fill: corNome,
      selectable: false,
    });
    txt.set('boxIdx', idx);
    txt.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(txt);
  });

  // ===== FOTO (centro, grande) =====
  if (produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;
        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(produto.imagem);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(produto.imagem, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}
        const escalaContain = Math.min(fotoAreaW / visualW, fotoAreaH / visualH);
        let escala = escalaContain * 0.87 * (box.multFoto || 1.0);  // 0.95 → 0.87 (-8%)
        // SAFETY: multFoto > 1.0 + foto horizontal larga = transbordamento lateral
        // (foto sai do card). Cap escala pra foto SEMPRE caber na largura.
        // fotoCapW (por box) sobe o teto: default 0.98; ex. 1.08 deixa a foto encher
        // a largura do card (resolve "foto não cresce" quando multFoto satura no cap).
        const _capWFator = (box.fotoCapW != null) ? box.fotoCapW : 0.98;
        const maxEscalaW = (fotoAreaW * _capWFator) / visualW;
        if (escala > maxEscalaW) escala = maxEscalaW;
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        // fotoPosY: 0=topo da área, 0.5=centro (default), 1=embaixo. Permite
        // ajustar o "centro" visual da foto por box/modelo via grade.
        const _fotoPosYCB = (box.fotoPosY == null) ? 0.5 : box.fotoPosY;
        img.set({
          left: box.x + (box.w - w) / 2,
          top: fotoAreaY + (fotoAreaH - h) * _fotoPosYCB,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fundoIdx = canvas.getObjects().indexOf(fundo);
        if (fundoIdx >= 0) canvas.moveTo(img, fundoIdx + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render card-banner] foto falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== BALÃO PÍLULA CENTRALIZADA (GRANDE — estilo qrofertas) =====
  // Pílula rounded centralizada no fundo. 90% de largura (qrofertas usa ~90% pra
  // cards estreitos como 3x1; mais que 78% original que era apertado em coluna fina).
  const bH = bannerAreaH * 0.95;
  const bW = box.w * 0.90;
  const bX = box.x + (box.w - bW) / 2;
  // Faixa cola na borda inferior — quando há obs, balão fica imediatamente acima.
  const _obsCB = calcularObsFaixa(produto, bH * 0.55);
  const _padInfCB = _obsCB.temObs ? 0 : padding;
  // balaoOffsetY: fração da altura do card pra SUBIR o balão (positivo = sobe). Default 0.
  // Move a pílula inteira (sombra, fundo, balão custom e preço, que usam bY como base).
  const _balaoOffsetYCB = (box.balaoOffsetY || 0) * box.h;
  const bY = box.y + box.h - _padInfCB - bH - _obsCB.obsAltura - _balaoOffsetYCB;

  // Sombra + pílula DEFAULT (sempre desenha como fallback). Se balão custom carregar,
  // sombra e pílula são escondidos.
  const sombraCB = new fabric.Rect({
    left: bX + 3, top: bY + 4,
    width: bW, height: bH,
    fill: 'rgba(0,0,0,0.20)',
    rx: bH * 0.35, ry: bH * 0.35,
    selectable: false, evented: false,
  });
  canvas.add(sombraCB);
  const banner = new fabric.Rect({
    left: bX, top: bY,
    width: bW, height: bH,
    fill: corPrimaria,
    rx: bH * 0.35, ry: bH * 0.35,
    stroke: '#ffffff', strokeWidth: 2,
    selectable: false, evented: false,
  });
  canvas.add(banner);

  // Balão CUSTOM (PNG do tema escolhido pelo usuário) — substitui a pílula
  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;
  if (balaoUrl) {
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width || (canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(banner) < 0) return;
        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(balaoUrl, bbox);
        }
        let visW = img.width, visH = img.height;
        if (bbox) {
          img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
          visW = bbox.w; visH = bbox.h;
        }
        const escala = Math.min(bW / visW, bH / visH);
        img.set({
          scaleX: escala, scaleY: escala,
          left: bX + (bW - visW * escala) / 2,
          top: bY + (bH - visH * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(img);
        sombraCB.set('visible', false);
        banner.set('visible', false);
        // Move balão custom pra ficar atrás dos textos do preço
        const objs = canvas.getObjects();
        const rsRef = objs.find(o => o.boxIdx === idx && o.text === 'R$');
        if (rsRef) {
          const rsIdx = canvas.getObjects().indexOf(rsRef);
          if (rsIdx >= 0) canvas.moveTo(img, rsIdx);
        }
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render card-banner] balão custom falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== R$ + valor + centavos + unidade dentro do banner =====
  // Usa ajustarPrecoParaTag pra ENCHER o balão (em vez de cap downwards baseado em altura).
  // Isso faz o texto crescer até preencher 80% da largura ou 64% da altura — o que limitar primeiro.
  // Resultado: balão grande não fica com texto pequeno no meio sobrando espaço vermelho.
  const ctxFonte = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  const ajusteFonte = ajustarPrecoParaTag(bW, bH, produto.preco, produto.unidadeAbrev, configs, ctxFonte);
  let fonteValor = (ajusteFonte?.fonteValor || bH * 0.62) * (box.multValor || 1.0);
  // Valor CONSISTENTE (opt-in via box.valorConsistente): usa a fonte que cabe o preço MAIS
  // "exigente" entre os irmãos (configs._precosValores) no balão DESTE box — assim os
  // destaques mostram o preço no MESMO tamanho (não varia por unidade/dígitos).
  if (box.valorConsistente && Array.isArray(configs._precosValores) && configs._precosValores.length > 1) {
    let _menorFV = fonteValor;
    for (const _pr of configs._precosValores) {
      const _aj = ajustarPrecoParaTag(bW, bH, _pr?.preco, _pr?.unidadeAbrev, configs, ctxFonte);
      const _f = (_aj?.fonteValor || bH * 0.62) * (box.multValor || 1.0);
      if (_f < _menorFV) _menorFV = _f;
    }
    fonteValor = _menorFV;
  }
  const fonteRS = fonteValor * 0.55;
  const fonteUnid = fonteValor * 0.32;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  const fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();

  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  const espacoRsValor = fonteValor * 0.10;
  const espacoValorUnid = unidAbrev ? fonteValor * 0.08 : 0;
  const larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  const startX = bX + (bW - larguraTextoTotal) / 2;
  const centroBannerY = bY + bH / 2;

  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroBannerY - fonteValor * 0.30,
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  rsObj.set('boxIdx', idx);
  canvas.add(rsObj);

  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroBannerY - fonteValor * 0.55,
    fontSize: fonteValor, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  canvas.add(reaisObj);

  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroBannerY - fonteValor * 0.55 : centroBannerY - fonteValor * 0.30,
      fontSize: fonteCentavos, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroBannerY - fonteValor * 0.55,
      fontSize: fonteUnid, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(unidObj);
  }
  // TRAVA: garante que o preço não passe do balão
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], bX, bW, bY, bH);

  // ===== FAIXA DE OBSERVAÇÃO (logo abaixo do balão) =====
  const _objsObsCB = renderizarFaixaObs(canvas, box, produto, bY, bH, fonteValor, padding, paleta);
  _objsObsCB.forEach(o => canvas.bringToFront(o));
  // Selo de desconto (% OFF) acima do balão + Selo +18
  renderizarSeloDesconto(canvas, box, produto, { x: bX, y: bY, w: bW, h: bH });
  renderizarSeloMaior18(canvas, box, produto);
}

// Layout CARD-BANNER-H (horizontal): estilo qrofertas — foto esquerda + nome topo direita
// + banner vermelho retangular no canto inferior direito.
//
//   ┌──────────────────────────────────┐
//   │   ┌────────┐   FILE PEITO        │  ← nome topo direita
//   │   │  FOTO  │                     │
//   │   │ GRANDE │   ████████████████  │  ← banner vermelho (rounded rect)
//   │   │        │   █  R$ 13,99 KG █  │
//   │   └────────┘   ████████████████  │
//   └──────────────────────────────────┘
function renderizarBoxCardBannerH(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;
  const ehDestaqueBHcard = box.destaque === true;

  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const corTextoTag = paleta.textoPrecoDestaque || paleta.textoPreco || '#ffffff';

  // DESTAQUE: usa cor primária (vermelho do tema) + texto branco. Sem isso, cards
  // marcados como destaque ficavam com fundo branco normal — mesmo "estilo" do não-destaque.
  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else if (produto.corFundoCustom) {
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(produto.corFundoCustom, transp / 100) : produto.corFundoCustom;
  } else if (ehDestaqueBHcard) {
    fundoBox = paleta.fundoBoxDestaque || corPrimaria;
  } else {
    fundoBox = paleta.fundoBox || '#ffffff';
  }
  const corNome = produto.corTextoCustom
    || (ehDestaqueBHcard ? (paleta.textoNomeDestaque || '#ffffff') : corNomeNormal);
  const cardRx = 8;

  // Card outer
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: corPrimaria, strokeWidth: 2,
    rx: cardRx, ry: cardRx,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // Regiões: foto LEFT (mais larga pra dar protagonismo), text+banner RIGHT
  const padding = 12;
  const leftW = box.w * 0.52;
  const rightX = box.x + leftW + padding;
  const rightW = box.w - leftW - padding * 2;

  // Foto à esquerda (full height do card)
  const photoAreaY = box.y + padding;
  const photoAreaH = box.h - padding * 2;
  const photoAreaW = leftW - padding;

  // Right column: nome topo + banner fundo (compactos pra foto dominar)
  const rightAreaY = box.y + padding;
  const rightAreaH = box.h - padding * 2;
  const nomeAreaH = rightAreaH * 0.45;
  // BUG-FIX: bannerAreaH era hardcoded em 0.38 e ignorava multBalao — então
  // mudanças no multBalao não tinham efeito visual no banner. Agora multBalao
  // escala o banner, com cap em 70% do rightAreaH pra não invadir o nome.
  const bannerAreaH = Math.min(
    rightAreaH * 0.38 * (box.multBalao || 1.0),
    rightAreaH * 0.70,
  );
  // Faixa cola na borda inferior — quando há obs, banner fica imediatamente acima.
  const _obsBH = calcularObsFaixa(produto, bannerAreaH * 0.48);
  const _padInfBH = _obsBH.temObs ? 0 : padding;
  const bannerY = box.y + box.h - _padInfBH - bannerAreaH - _obsBH.obsAltura;

  // ===== FOTO (esquerda) =====
  if (produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;
        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(produto.imagem);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(produto.imagem, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}
        const escala = Math.min(photoAreaW / visualW, photoAreaH / visualH) * 0.87 * (box.multFoto || 1.0);  // 0.95 → 0.87 (-8%)
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        img.set({
          left: box.x + padding + (photoAreaW - w) / 2,
          top: photoAreaY + (photoAreaH - h) / 2,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fundoIdx = canvas.getObjects().indexOf(fundo);
        if (fundoIdx >= 0) canvas.moveTo(img, fundoIdx + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render card-banner-h] foto falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // ===== NOME (topo direita, 1-2 linhas balanceadas, centralizado no espaço) =====
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  // Respeita TAMANHOS_TEXTO (Pequeno/Médio/Grande no ConfigBar)
  const fatorTextoSizeBH = (ts.nome || 24) / 24;
  const ehDestaqueBH = box.destaque === true;
  const boostDestaqueBH = ehDestaqueBH ? 1.9 : 1.0;
  const palavras = textoNome.split(/\s+/).filter(Boolean);
  const fonteFamilia = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);
  // orçamento efetivo: render final é (fonte * multNome) → largura / multNome.
  const maxLargNome = (rightW * 0.95) / (box.multNome || 1.0);
  // multNome aplicado como escala FINAL (pós-shrink) — ver nota em renderizarBoxCardBanner.
  const fonteNatural1L = nomeAreaH * 0.41 * fatorTextoSizeBH * boostDestaqueBH;  // 0.69 → 0.41 (-40%) + boost destaque
  let nomeLinhas = [textoNome];
  let fonteSizeNome = fonteNatural1L;

  const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMed) {
    try {
      ctxMed.save();
      ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
      const larguraNatural = ctxMed.measureText(textoNome).width;

      if (larguraNatural <= maxLargNome) {
        // 1 linha cabe
      } else if (palavras.length >= 2) {
        // ANTES de quebrar em 2 linhas, tenta encolher a fonte de 1 linha até 65%
        // do alvo. Se couber em 1 linha com esse shrink moderado, MANTÉM 1 linha.
        let fonte1L = fonteSizeNome;
        const piso1L = fonteSizeNome * 0.65;
        let larg1L = larguraNatural;
        while (larg1L > maxLargNome && fonte1L > piso1L) {
          fonte1L *= 0.96;
          ctxMed.font = `900 ${fonte1L}px ${fonteFamilia}`;
          larg1L = ctxMed.measureText(textoNome).width;
        }
        if (larg1L <= maxLargNome) {
          fonteSizeNome = fonte1L;  // coube em 1 linha
        } else {
        let melhorSplit = 1;
        let melhorDelta = Infinity;
        for (let i = 1; i < palavras.length; i++) {
          const l1 = palavras.slice(0, i).join(' ');
          const l2 = palavras.slice(i).join(' ');
          const dl = Math.abs(ctxMed.measureText(l1).width - ctxMed.measureText(l2).width);
          if (dl < melhorDelta) { melhorDelta = dl; melhorSplit = i; }
        }
        nomeLinhas = [
          palavras.slice(0, melhorSplit).join(' '),
          palavras.slice(melhorSplit).join(' '),
        ];
        fonteSizeNome = nomeAreaH * 0.34 * fatorTextoSizeBH;
        const medirMax = () => {
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          return Math.max(...nomeLinhas.map(l => ctxMed.measureText(l).width));
        };
        let largMax = medirMax();
        while (largMax > maxLargNome && fonteSizeNome > 10) {
          fonteSizeNome *= 0.95;
          largMax = medirMax();
        }
        }  // fecha o else (não coube em 1 linha)
      } else {
        let larg = larguraNatural;
        while (larg > maxLargNome && fonteSizeNome > 12) {
          fonteSizeNome *= 0.95;
          ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
          larg = ctxMed.measureText(textoNome).width;
        }
      }
      ctxMed.restore();
    } catch {}
  }

  // multNome aplicado como escala FINAL — garante que reduzir multNome SEMPRE
  // reduz o nome, mesmo quando o shrink acima o encolheu por largura.
  fonteSizeNome *= (box.multNome || 1.0);

  const lineGap = 0.10;
  const totalLinhasN = nomeLinhas.length;
  const alturaBlocoN = fonteSizeNome * totalLinhasN + fonteSizeNome * lineGap * (totalLinhasN - 1);
  // nomeOffsetTop: empurra o nome pra baixo (fração da nomeAreaH). 0=colado no topo (default).
  const _nomeOffsetTopBH = (box.nomeOffsetTop || 0) * nomeAreaH;
  const yInicialN = rightAreaY + _nomeOffsetTopBH;  // 0=colado no topo → mais espaço pra foto
  nomeLinhas.forEach((linha, i) => {
    let largLinha = 0;
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
        largLinha = ctx.measureText(linha).width;
        ctx.restore();
      }
    } catch {}
    const txt = new fabric.Text(linha, {
      left: rightX + (rightW - largLinha) / 2,
      top: yInicialN + i * fonteSizeNome * (1 + lineGap),
      fontSize: fonteSizeNome,
      fontFamily: fonteFamilia,
      fontWeight: 900,
      fill: corNome,
      selectable: false,
    });
    txt.set('boxIdx', idx);
    txt.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(txt);
  });

  // ===== BANNER (fundo direita, retângulo arredondado, full right width) =====
  // Lógica de cor:
  // - Card normal (fundo branco/amarelo): banner vermelho, texto branco.
  // - Card destaque (fundo vermelho) COM balão imagem: banner pode ficar vermelho
  //   (a imagem cobre por cima); texto branco fica sobre a imagem vermelha.
  // - Card destaque SEM balão imagem: banner inverte pra amarelo pra dar contraste
  //   contra o fundo vermelho do card; texto fica vermelho sobre o amarelo.
  const balaoUrlBH = produto.balaoCustom || paleta.balaoOferta;
  const bannerFill = (ehDestaqueBHcard && !balaoUrlBH)
    ? (paleta.fundoBox || '#fcd34d')
    : corPrimaria;
  // Só desenha o retângulo quando NÃO há imagem do balão. Quando tem imagem (etiqueta),
  // ela é o balão visível — sem o retângulo embaixo que aparecia como "segundo balão".
  let banner = null;
  if (!balaoUrlBH) {
    banner = new fabric.Rect({
      left: rightX, top: bannerY,
      width: rightW, height: bannerAreaH,
      fill: bannerFill,
      rx: bannerAreaH * 0.18, ry: bannerAreaH * 0.18,
      selectable: false, evented: false,
    });
    canvas.add(banner);
  }
  // ===== BALÃO CUSTOM (etiqueta) — opcional =====
  // Se o produto/tema tem balão custom, renderiza a imagem (sem retângulo embaixo).
  // Aborta cedo se o canvas re-renderizou pra evitar imagem órfã.
  if (balaoUrlBH) {
    const balaoGenBH = canvas.__renderGen || 0;
    // Guarda referência ao fundo do card pra checar se ainda está na tela.
    const fundoRef = fundo;
    fabric.Image.fromURL(balaoUrlBH, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== balaoGenBH) return;
        if (canvas.getObjects().indexOf(fundoRef) < 0) return;
        // Auto-crop transparente (cacheado)
        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(balaoUrlBH);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img);
            CACHE_BBOX_BALAO.set(balaoUrlBH, bbox);
          }
          if (bbox) {
            img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h });
            visualW = bbox.w; visualH = bbox.h;
          }
        } catch {}
        // Scaling uniforme — preserva aspecto. Cabe dentro da área (rightW × bannerAreaH).
        const escala = Math.min(rightW / visualW, bannerAreaH / visualH);
        img.set({
          scaleX: escala, scaleY: escala,
          left: rightX + (rightW - visualW * escala) / 2,
          top:  bannerY + (bannerAreaH - visualH * escala) / 2,
          selectable: false, evented: false,
        });
        canvas.add(img);
        // Coloca a imagem acima do fundo do card mas abaixo do texto (R$/valor)
        const fundoIdx = canvas.getObjects().indexOf(fundoRef);
        if (fundoIdx >= 0) canvas.moveTo(img, fundoIdx + 1);
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[card-banner-h] balão custom falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }
  // Cor do texto dentro do banner: vermelho só quando banner é amarelo (destaque sem
  // imagem). Quando tem imagem do balão (vermelha), texto branco mantém contraste.
  const corTextoBanner = (ehDestaqueBHcard && !balaoUrlBH) ? corPrimaria : corTextoTag;

  // Preço dentro do banner (menor pra dar protagonismo à foto)
  let fonteValor = bannerAreaH * 0.65 * (box.multValor || 1.0);  // 0.54 → 0.65 (+20%)
  fonteValor = capFonteValorOverflow(
    fonteValor,
    rightW * 0.90,
    0.20,
    produto.preco,
    produto.unidadeAbrev,
    configs,
    canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d')
  );
  const fonteRS = fonteValor * 0.55;
  const fonteUnid = fonteValor * 0.32;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  const fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();

  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}

  const espacoRsValor = fonteValor * 0.10;
  const espacoValorUnid = unidAbrev ? fonteValor * 0.08 : 0;
  const larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  const startX = rightX + (rightW - larguraTextoTotal) / 2;
  const centroBannerY = bannerY + bannerAreaH / 2;

  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroBannerY - fonteValor * 0.30,
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoBanner, selectable: false, evented: false,
  });
  rsObj.set('boxIdx', idx);
  canvas.add(rsObj);

  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor,
    top: centroBannerY - fonteValor * 0.55,
    fontSize: fonteValor, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoBanner, selectable: false, evented: false,
  });
  canvas.add(reaisObj);

  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroBannerY - fonteValor * 0.55 : centroBannerY - fonteValor * 0.30,
      fontSize: fonteCentavos, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoBanner, selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroBannerY - fonteValor * 0.55,
      fontSize: fonteUnid, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoBanner, selectable: false, evented: false,
    });
    canvas.add(unidObj);
  }
  // TRAVA: garante que o preço não passe do banner
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], rightX, rightW, bannerY, bannerAreaH);

  // ===== FAIXA DE OBSERVAÇÃO (logo abaixo do banner) =====
  // Largura limitada à RIGHT column (banner não ocupa o card todo)
  const _objsObsBH = renderizarFaixaObs(canvas, { x: rightX - padding, y: box.y, w: rightW + padding * 2, h: box.h }, produto, bannerY, bannerAreaH, fonteValor, padding, paleta);
  _objsObsBH.forEach(o => canvas.bringToFront(o));
  // Selo de desconto (% OFF) acima do banner + Selo +18
  renderizarSeloDesconto(canvas, box, produto, { x: rightX, y: bannerY, w: rightW, h: bannerAreaH });
  renderizarSeloMaior18(canvas, box, produto);
}

// Renderer ESTILO qrofertas: foto TOPO (full-width) + nome BOTTOM-ESQ + balão BOTTOM-DIR.
// Layout invertido em relação ao horizontal-topo (que tem nome topo + foto-bal bottom).
function renderizarCardFotoTopo(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const myGen = canvas.__renderGen || 0;
  const ehDestaque = box.destaque === true;

  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corFundoNormal = paleta.fundoBox || '#fcd34d';
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const corTextoTag = ehDestaque
    ? (paleta.textoPrecoDestaque || paleta.textoPreco || '#ffffff')
    : (paleta.textoPreco || '#ffffff');

  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') fundoBox = 'transparent';
  else if (produto.corFundoCustom) {
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(produto.corFundoCustom, transp / 100) : produto.corFundoCustom;
  } else if (ehDestaque) fundoBox = corPrimaria;
  else fundoBox = corFundoNormal;
  const corNome = produto.corTextoCustom || (ehDestaque ? '#ffffff' : corNomeNormal);

  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: ehDestaque ? '#ffffff' : corPrimaria,
    strokeWidth: ehDestaque ? 0 : 3,
    rx: 4, ry: 4, selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  // Regiões: FOTO topo (full-width) + STRIP bottom dividido em nome esq + balão dir
  const padding = 8;
  const bottomH = box.h * 0.28;
  const fotoAreaY = box.y + padding;
  const fotoAreaH = box.h - bottomH - padding * 3;
  const bottomY = box.y + box.h - bottomH - padding;
  const nomeAreaW = (box.w - padding * 3) * 0.45;
  const balaoAreaW = (box.w - padding * 3) * 0.55;
  const halfW = balaoAreaW;
  const nomeX = box.x + padding;
  const balaoX = box.x + padding + nomeAreaW + padding;

  // FOTO topo (full-width)
  if (produto.imagem) {
    fabric.Image.fromURL(produto.imagem, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== myGen) return;
        if (canvas.getObjects().indexOf(fundo) < 0) return;
        let visualW = img.width, visualH = img.height;
        try {
          let bbox = CACHE_BBOX_BALAO.get(produto.imagem);
          if (bbox === undefined) {
            bbox = detectarBboxNaoTransparente(img, 15);
            CACHE_BBOX_BALAO.set(produto.imagem, bbox);
          }
          if (bbox) { img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h }); visualW = bbox.w; visualH = bbox.h; }
        } catch {}
        const mf = box.multFoto || 1.0;
        const fotoAreaW_full = box.w - padding * 2;
        let escala = Math.min(fotoAreaW_full / visualW, fotoAreaH / visualH) * mf;
        const escalaMax = Math.min((box.w - padding * 2) / visualW, fotoAreaH / visualH);
        if (escala > escalaMax) escala = escalaMax;
        img.scale(escala);
        const w = visualW * escala, h = visualH * escala;
        const _foX = (box.fotoOffsetX || 0) * fotoAreaW_full;
        let imgLeft = box.x + (box.w - w) / 2 + _foX;
        let imgTop = fotoAreaY + (fotoAreaH - h) / 2;
        imgLeft = Math.max(box.x + padding, Math.min(imgLeft, box.x + box.w - padding - w));
        imgTop = Math.max(box.y + padding, Math.min(imgTop, box.y + fotoAreaH - h));
        img.set({ left: imgLeft, top: imgTop, selectable: false });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fIdx = canvas.getObjects().indexOf(fundo);
        if (fIdx >= 0) canvas.moveTo(img, fIdx + 1);
        canvas.requestRenderAll();
      } catch (e) { console.warn('[card-foto-topo] foto falhou:', e?.message); }
    }, { crossOrigin: 'anonymous' });
  }

  // NOME bottom-esquerda
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  const palavras = textoNome.split(/\s+/).filter(Boolean);
  const fonteFamilia = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);
  const maxLargNome = nomeAreaW * 0.95;
  // Orçamento EFETIVO de largura: render final é (fonte * multNome). Pra que o
  // shrink/wrap decida corretamente, divide a largura disponível por multNome.
  // Sem isso, multNome > 1 faz o nome invadir o balão depois do post-scale.
  const _multNomeCF = box.multNome || 1.0;
  const maxLargNomeEff = maxLargNome / _multNomeCF;
  const fatorTextoSize = (ts.nome || 24) / 24;
  let fonteSizeNome = bottomH * 0.50 * fatorTextoSize;
  let nomeLinhas = [textoNome];
  const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMed) {
    try {
      ctxMed.save();
      ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
      let larg = ctxMed.measureText(textoNome).width;
      // Se tem 2+ palavras e não cabe em 1 linha no orçamento efetivo, quebra ANTES de shrinkar
      if (larg > maxLargNomeEff && palavras.length >= 2) {
        let mS = 1, mD = Infinity;
        for (let i = 1; i < palavras.length; i++) {
          const l1 = palavras.slice(0, i).join(' ');
          const l2 = palavras.slice(i).join(' ');
          const dl = Math.abs(ctxMed.measureText(l1).width - ctxMed.measureText(l2).width);
          if (dl < mD) { mD = dl; mS = i; }
        }
        nomeLinhas = [palavras.slice(0, mS).join(' '), palavras.slice(mS).join(' ')];
        // Mede a maior das 2 linhas pro shrink (caso ainda exceda)
        larg = Math.max(...nomeLinhas.map(l => ctxMed.measureText(l).width));
      }
      // Shrink final se ainda não couber
      while (larg > maxLargNomeEff && fonteSizeNome > 10) {
        fonteSizeNome *= 0.92;
        ctxMed.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
        larg = Math.max(...nomeLinhas.map(l => ctxMed.measureText(l).width));
      }
      ctxMed.restore();
    } catch {}
  }
  // Nome CONSISTENTE (opt-in via box.nomeConsistente): padroniza o tamanho do nome em TODOS
  // os produtos — usa a fonte que cabe o nome MAIS LONGO entre os irmãos (configs._nomesProdutos).
  // Sem isso, nomes curtos ficam grandes e longos pequenos ("discrepante por falta de letras").
  if (box.nomeConsistente && Array.isArray(configs._nomesProdutos) && configs._nomesProdutos.length > 1) {
    const _ctxN = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (_ctxN) {
      try {
        _ctxN.save();
        let _menorFonte = Infinity;
        for (const _nm of configs._nomesProdutos) {
          const _t = (_nm || 'PRODUTO').toUpperCase();
          const _pal = _t.split(/\s+/).filter(Boolean);
          let _f = bottomH * 0.50 * fatorTextoSize;
          _ctxN.font = `900 ${_f}px ${fonteFamilia}`;
          let _lns = [_t];
          let _lg = _ctxN.measureText(_t).width;
          if (_lg > maxLargNomeEff && _pal.length >= 2) {
            let _mS = 1, _mD = Infinity;
            for (let i = 1; i < _pal.length; i++) {
              const _dl = Math.abs(_ctxN.measureText(_pal.slice(0, i).join(' ')).width - _ctxN.measureText(_pal.slice(i).join(' ')).width);
              if (_dl < _mD) { _mD = _dl; _mS = i; }
            }
            _lns = [_pal.slice(0, _mS).join(' '), _pal.slice(_mS).join(' ')];
            _lg = Math.max(..._lns.map(l => _ctxN.measureText(l).width));
          }
          while (_lg > maxLargNomeEff && _f > 10) {
            _f *= 0.92;
            _ctxN.font = `900 ${_f}px ${fonteFamilia}`;
            _lg = Math.max(..._lns.map(l => _ctxN.measureText(l).width));
          }
          if (_f < _menorFonte) _menorFonte = _f;
        }
        _ctxN.restore();
        if (_menorFonte !== Infinity) fonteSizeNome = _menorFonte;
      } catch {}
    }
  }
  fonteSizeNome *= _multNomeCF;
  const lineGap = 0.10;
  const alturaBloco = fonteSizeNome * nomeLinhas.length + fonteSizeNome * lineGap * (nomeLinhas.length - 1);
  const _nomeOffsetTopBot = (box.nomeOffsetTop || 0) * bottomH;
  const yInicialNome = bottomY + (bottomH - alturaBloco) / 2 + _nomeOffsetTopBot;
  // nomeAlignX: 0=esquerda (default), 0.5=centro, 1=direita.
  const _nAlign = box.nomeAlignX ?? 0;
  const ctxN = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  nomeLinhas.forEach((linha, i) => {
    let largLinha = 0;
    if (ctxN && _nAlign !== 0) {
      try {
        ctxN.save();
        ctxN.font = `900 ${fonteSizeNome}px ${fonteFamilia}`;
        largLinha = ctxN.measureText(linha).width;
        ctxN.restore();
      } catch {}
    }
    const txt = new fabric.Text(linha, {
      left: nomeX + (nomeAreaW - largLinha) * _nAlign,
      top: yInicialNome + i * fonteSizeNome * (1 + lineGap),
      fontSize: fonteSizeNome, fontFamily: fonteFamilia, fontWeight: 900,
      fill: corNome, selectable: false,
    });
    txt.set('boxIdx', idx);
    txt.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(txt);
  });

  // BALÃO + preço (bottom-direita)
  let fonteValor = bottomH * 0.75 * (box.multValor || 1.0);
  fonteValor = capFonteValorOverflow(
    fonteValor, halfW * 0.98, 0.30 * (box.multBalao || 1.0),
    produto.preco, produto.unidadeAbrev, configs,
    canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d')
  );
  let fonteRS = fonteValor * 0.55;
  let fonteUnid = fonteValor * 0.35;
  const valorTexto = produto.preco || '0,00';
  const [reaisTexto, centavosNum] = valorTexto.split(',');
  const temCentavos = centavosNum !== undefined;
  const centavosTexto = temCentavos ? ',' + centavosNum : '';
  let fonteCentavos = configs.precoCentavosMesmoTamanho ? fonteValor : fonteValor * 0.65;
  const unidAbrev = (produto.unidadeAbrev || '').toUpperCase();
  let larguraRs = 0, larguraReais = 0, larguraCentavos = 0, larguraUnid = 0;
  try {
    const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRs = ctx.measureText('R$').width;
      ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteFamilyValor(canvas)}`;
      larguraReais = ctx.measureText(reaisTexto).width;
      if (temCentavos) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteFamilyValor(canvas)}`;
        larguraCentavos = ctx.measureText(centavosTexto).width;
      }
      if (unidAbrev) {
        ctx.font = `${FONTE_PRECO_WEIGHT} ${fonteUnid}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnid = ctx.measureText(unidAbrev).width;
      }
      ctx.restore();
    }
  } catch {}
  let espacoRsValor = fonteValor * 0.10;
  let espacoValorUnid = unidAbrev ? fonteValor * 0.10 : 0;
  let larguraTextoTotal = larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid + larguraUnid;
  const multBalao = box.multBalao || 1.0;
  let tagPaddingH = fonteValor * 0.55 * multBalao;
  let tagH = fonteValor * 1.50 * multBalao;
  let tagW;
  if (box.balaoFixo) tagW = halfW * 0.85 * multBalao;
  else tagW = larguraTextoTotal + tagPaddingH * 2 + (unidAbrev ? larguraUnid * 0.6 : 0);
  if (tagW > halfW * 0.98) {
    const sc = (halfW * 0.98) / tagW;
    fonteValor *= sc; fonteRS *= sc; fonteUnid *= sc; fonteCentavos *= sc;
    larguraRs *= sc; larguraReais *= sc; larguraCentavos *= sc; larguraUnid *= sc;
    espacoRsValor *= sc; espacoValorUnid *= sc;
    tagPaddingH *= sc; tagH *= sc; larguraTextoTotal *= sc;
    tagW = halfW * 0.98;
  }
  const _bAlignX = box.balaoAlignX ?? 0.5;
  const tagX = balaoX + (balaoAreaW - tagW) * _bAlignX;
  const tagY = bottomY + (bottomH - tagH) / 2;

  // Balão imagem opcional (etiqueta) — desenha SÓ a imagem quando existe (sem pílula+sombra
  // por baixo, senão a sobra aparece em volta da imagem aspect-preserved).
  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;
  let pilula = null;
  if (!balaoUrl) {
    const sombra = new fabric.Rect({
      left: tagX + 2, top: tagY + 3, width: tagW, height: tagH,
      fill: 'rgba(0,0,0,0.25)', rx: tagH / 2, ry: tagH / 2,
      selectable: false, evented: false,
    });
    canvas.add(sombra);
    pilula = new fabric.Rect({
      left: tagX, top: tagY, width: tagW, height: tagH,
      fill: corPrimaria, rx: tagH / 2, ry: tagH / 2,
      stroke: '#ffffff', strokeWidth: 2, selectable: false,
    });
    pilula.set('boxIdx', idx);
    pilula.on('mousedown', () => aoClicar && aoClicar(idx));
    canvas.add(pilula);
  }

  if (balaoUrl) {
    const bGen = canvas.__renderGen || 0;
    const fundoRefBal = fundo;
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== bGen) return;
        if (canvas.getObjects().indexOf(fundoRefBal) < 0) return;
        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) { bbox = detectarBboxNaoTransparente(img); CACHE_BBOX_BALAO.set(balaoUrl, bbox); }
        let visW, visH;
        if (bbox) { img.set({ cropX: bbox.x, cropY: bbox.y, width: bbox.w, height: bbox.h }); visW = bbox.w; visH = bbox.h; }
        else { visW = img.width; visH = img.height; }
        const esc = Math.min(tagW / visW, tagH / visH);
        img.set({
          scaleX: esc, scaleY: esc,
          left: tagX + (tagW - visW * esc) / 2, top: tagY + (tagH - visH * esc) / 2,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        const fIdxBal = canvas.getObjects().indexOf(fundoRefBal);
        if (fIdxBal >= 0) canvas.moveTo(img, fIdxBal + 1);
        canvas.requestRenderAll();
      } catch {}
    }, { crossOrigin: 'anonymous' });
  }

  // Texto preço dentro do balão
  const startX = tagX + (tagW - larguraTextoTotal) / 2;
  const centroTagY = tagY + tagH / 2;
  const rsObj = new fabric.Text('R$', {
    left: startX, top: centroTagY - fonteValor * 0.30,
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  canvas.add(rsObj);
  const reaisObj = new fabric.Text(reaisTexto, {
    left: startX + larguraRs + espacoRsValor, top: centroTagY - fonteValor * 0.55,
    fontSize: fonteValor, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoTag, selectable: false, evented: false,
  });
  canvas.add(reaisObj);
  let centavosObj = null;
  if (temCentavos) {
    centavosObj = new fabric.Text(centavosTexto, {
      left: startX + larguraRs + espacoRsValor + larguraReais,
      top: configs.precoCentavosMesmoTamanho ? centroTagY - fonteValor * 0.55 : centroTagY - fonteValor * 0.30,
      fontSize: fonteCentavos, fontFamily: fonteFamilyValor(canvas), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }
  let unidObj = null;
  if (unidAbrev) {
    unidObj = new fabric.Text(unidAbrev, {
      left: startX + larguraRs + espacoRsValor + larguraReais + larguraCentavos + espacoValorUnid,
      top: centroTagY - fonteValor * 0.55,
      fontSize: fonteUnid, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoTag, selectable: false, evented: false,
    });
    canvas.add(unidObj);
  }
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidObj], tagX, tagW, tagY, tagH);
  renderizarSeloDesconto(canvas, box, produto, { x: tagX, y: tagY, w: tagW, h: tagH });
  renderizarSeloMaior18(canvas, box, produto);
}

function renderizarBoxProduto(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs = {}) {
  if (!produto) return;

  // ROTEAMENTO: layouts com tipo especial usam funções dedicadas
  if (box.layoutTipo === 'destaque-maximo') {
    return renderizarDestaqueMaximo(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }
  if (box.layoutTipo === 'card-banner') {
    return renderizarBoxCardBanner(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }
  if (box.layoutTipo === 'card-banner-h') {
    return renderizarBoxCardBannerH(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }
  if (box.layoutTipo === 'card-foto-topo') {
    return renderizarCardFotoTopo(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }
  if (box.layoutTipo === 'horizontal') {
    return renderizarBoxHorizontal(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }
  if (box.layoutTipo === 'horizontal-topo') {
    return renderizarBoxHorizontalTopo(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }
  if (box.tipo === 'lista') {
    return renderizarLinhaLista(canvas, box, produto, idx, paleta, tamanhoTexto, aoClicar, configs);
  }

  const ts = TAMANHOS_TEXTO[tamanhoTexto] || TAMANHOS_TEXTO.medio;
  const ehDestaque = box.destaque === true;
  // Captura a geração ATUAL do render. Se o canvas for re-renderizado antes
  // da imagem async chegar, abortamos pra não poluir o novo render.
  const myGen = canvas.__renderGen || 0;

  // ===== Cores do tema — RESPEITA INTEGRALMENTE a escolha do usuário =====
  // Antes havia uma "IA de contraste" que substituía o fundoBox por amarelo
  // se ele fosse parecido com a tagPreco. Isso atrapalha quando o usuário
  // escolhe explicitamente cores próximas (ex: cream + branco). Agora trust
  // total no tema. O usuário é responsável por escolher cores legíveis.
  const corPrimaria = paleta.tagPreco || '#ef0000';
  const corFundoNormal = paleta.fundoBox || '#fcd34d';   // EXATO o que o tema definiu
  const corFundoDestaque = corPrimaria;
  const corNomeNormal = paleta.textoNome || '#1f2937';
  const corNomeDestaque = paleta.textoNomeDestaque || '#ffffff';
  const corTagNormal = corPrimaria;
  const corTagDestaque = paleta.fundoBox || '#fcd34d';
  const corTextoTagNormal = paleta.textoPreco || '#ffffff';
  const corTextoTagDestaque = paleta.textoPrecoDestaque || '#1f2937';

  // Cor de fundo do card:
  //   1. produto.corFundoTipo === 'sem-fundo' → transparente
  //   2. box.forceFundoColor (override do layout) → essa cor
  //   3. produto.corFundoCustom (override per-produto) → essa cor
  //   4. fallback → cor do tema (corFundoNormal / corFundoDestaque)
  let fundoBox;
  if (produto.corFundoTipo === 'sem-fundo') {
    fundoBox = 'transparent';
  } else if (box.forceFundoColor) {
    fundoBox = box.forceFundoColor;
  } else {
    const corBase = produto.corFundoCustom || (ehDestaque ? corFundoDestaque : corFundoNormal);
    const transp = produto.corFundoTransparencia ?? 100;
    fundoBox = transp < 100 ? aplicarAlpha(corBase, transp / 100) : corBase;
  }
  // Cor do nome:
  //   1. produto.corTextoCustom (override per-produto) → essa cor
  //   2. forceFundoColor ativo (layout override) → IA contraste (porque a cor
  //      do layout é independente do tema, então IA é única forma de garantir leitura)
  //   3. tema → corNomeBase EXATO do tema (respeita escolha do usuário)
  const corNomeBase = ehDestaque ? corNomeDestaque : corNomeNormal;
  const corNome = produto.corTextoCustom
    || (box.forceFundoColor ? corContrastanteParaTexto(fundoBox) : corNomeBase);
  const corTag    = ehDestaque ? corTagDestaque   : corTagNormal;
  // Texto da pílula/balão:
  //   PRIORIDADE: cor manual do tema > IA de contraste > fallback fixo.
  //   - Se o tema definiu paleta.textoPreco (não-destaque) ou
  //     paleta.textoPrecoDestaque (destaque), RESPEITA a escolha do usuário.
  //   - Senão, usa IA de contraste contra a cor real da pílula.
  //   - Em último caso: branco (não-destaque) ou preto (destaque).
  const corTextoT = ehDestaque
    ? (paleta.textoPrecoDestaque || corContrastanteParaTexto(corTag, '#ffffff', '#1f2937'))
    : (paleta.textoPreco         || corContrastanteParaTexto(corTag, '#ffffff', '#1f2937'));

  // 1) Fundo do card
  const fundo = new fabric.Rect({
    left: box.x, top: box.y, width: box.w, height: box.h,
    fill: fundoBox,
    stroke: ehDestaque ? '#ffffff' : corPrimaria,
    strokeWidth: ehDestaque ? 0 : 3,
    rx: 4, ry: 4,
    selectable: false,
  });
  fundo.set('boxIdx', idx);
  fundo.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(fundo);

  const padding = 6;

  // ===== ESCALA POR TAMANHO DE CARD + AJUSTE POR FORMATO =====
  // Fontes escalam proporcionalmente ao card E recebem ajuste fino por formato
  // (configs.modelo). Cada formato tem seu próprio multiplicador na tabela
  // FONTE_MULTIPLICADOR_POR_FORMATO no topo do arquivo.
  const REF_CARD_DIM_NOME = 380;  // calibração compatível com a do preço
  const dimCardNome = Math.sqrt(Math.max(1, box.w * box.h));
  const escalaCardNome = dimCardNome / REF_CARD_DIM_NOME;
  const multFormato = FONTE_MULTIPLICADOR_POR_FORMATO[configs.modelo] ?? 1.0;

  // Nome: destaque é 1.6x maior que normal — escalado por tamanho do card e formato.
  // multNome aplicado como escala FINAL (pós-shrink) — ver nota em renderizarBoxCardBanner.
  const fonteSizeNome = ts.nome * escalaCardNome * multFormato * (ehDestaque ? 1.50 : 0.88);  // -40%: destaque 2.5→1.50, normal 1.46→0.88
  const multNomeBP = box.multNome || 1.0;
  const linhasNome = (produto.nome || '').toUpperCase().length > 14 ? 2 : 1;
  const alturaNome = fonteSizeNome * multNomeBP * linhasNome * 1.05 + 4;

  // 2) NOME — centralização robusta com measureText nativo do canvas
  const textoNome = (produto.nome || 'PRODUTO').toUpperCase();
  const maxLargura = box.w - padding * 2;
  const centroXCard = box.x + box.w / 2;
  const familiaFonteNome = fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE);

  // Mede a largura REAL do texto usando o context do canvas com a MESMA fonte do render.
  // Auto-shrink ADAPTATIVO: o piso mínimo da fonte depende do tamanho escolhido
  // pelo usuário (pequeno/médio/grande) — assim a diferença entre opções fica
  // VISÍVEL mesmo quando o nome do produto é longo.
  let fonteSizeNomeFinal = fonteSizeNome;
  let larguraReal = 0;
  const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  if (ctxMed) {
    try {
      ctxMed.save();
      ctxMed.font = `${fonteSizeNomeFinal}px ${familiaFonteNome}`;
      larguraReal = ctxMed.measureText(textoNome).width;
      // Piso adaptativo: 40% do tamanho original (em vez de 10px fixo).
      // Assim "grande" sempre fica visualmente maior que "médio" mesmo após shrink.
      const pisoMinimo = Math.max(10, fonteSizeNome * 0.40);
      // BUG-FIX: o limite era dividido por multNomeBP, fazendo o shrink convergir pra
      // largura-bound — multNome 1.29 e 1.55 saturavam no mesmo tamanho. Agora o shrink
      // só ajusta a fonte natural pra caber; depois multNome escala como post-scale.
      // Se o resultado ultrapassar maxLargura, o ramo do Textbox abaixo quebra em 2 linhas.
      const limite = maxLargura * 0.92;
      let iter = 0;
      while (larguraReal > limite && fonteSizeNomeFinal > pisoMinimo && iter < 12) {
        fonteSizeNomeFinal *= 0.92;
        ctxMed.font = `${fonteSizeNomeFinal}px ${familiaFonteNome}`;
        larguraReal = ctxMed.measureText(textoNome).width;
        iter++;
      }
      ctxMed.restore();
    } catch {}
  }

  // multNome aplicado como escala FINAL — garante que reduzir multNome SEMPRE
  // reduz o nome, mesmo quando o shrink acima o encolheu por largura.
  fonteSizeNomeFinal *= multNomeBP;
  larguraReal *= multNomeBP;

  // SAFETY pós-escala: garante que o nome cabe em maxLargura. Quando multNome
  // é alto e nome longo, o shrink anterior tem piso e pode parar antes de fitar.
  // Sem isso o texto extrapola o card (visível especialmente em destaques).
  try {
    const ctxSafeBP = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctxSafeBP && larguraReal > maxLargura) {
      ctxSafeBP.save();
      let iter = 0;
      while (larguraReal > maxLargura && fonteSizeNomeFinal > 8 && iter < 30) {
        fonteSizeNomeFinal *= 0.95;
        ctxSafeBP.font = `${fonteSizeNomeFinal}px ${familiaFonteNome}`;
        larguraReal = ctxSafeBP.measureText(textoNome).width;
        iter++;
      }
      ctxSafeBP.restore();
    }
  } catch {}

  // nomeOffsetTop: empurra o nome pra baixo (fração de ~30% da altura do card).
  // Permite per-box (via grade) ajustar o posicionamento vertical do nome sem
  // mudar o renderer. nomeOffsetTop=0.60 → desloca 18% da altura do card pra baixo.
  const _nomeOffsetTopBP = (box.nomeOffsetTop || 0) * box.h * 0.30;
  let nome;
  if (larguraReal > 0 && larguraReal <= maxLargura) {
    // Single-line com left calculado matematicamente (largura real medida pelo canvas)
    nome = new fabric.Text(textoNome, {
      left: centroXCard - larguraReal / 2,
      top: box.y + padding + _nomeOffsetTopBP,
      fontSize: fonteSizeNomeFinal,
      fontFamily: familiaFonteNome,
      fill: corNome,
      selectable: false,
    });
  } else {
    // Texto não cabe single-line ou medida falhou: usa Textbox com wrap
    nome = new fabric.Textbox(textoNome, {
      width: maxLargura,
      left: box.x + padding,
      top: box.y + padding + _nomeOffsetTopBP,
      fontSize: fonteSizeNomeFinal,
      fontFamily: familiaFonteNome,
      fill: corNome,
      textAlign: 'center',
      lineHeight: 0.95,
      selectable: false,
    });
  }
  nome.set('boxIdx', idx);
  nome.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(nome);

  console.log(`[nome] "${textoNome}" type=${nome.type} larguraMedida=${Math.round(larguraReal)} left=${Math.round(nome.left)} cardCentro=${Math.round(centroXCard)} maxLarg=${Math.round(maxLargura)}`);

  // 3) TAG — fonte do valor ESCALADA ao tamanho do card.
  // Calibração feita em Facebook Quadrado (~520×320 = média 408). Pra outros formatos
  // (Stories, A4, TV horizontal, etc), font escala proporcionalmente, mantendo o
  // mesmo equilíbrio visual independente do tamanho do canvas.
  const REF_CARD_DIM = 380;  // antes 408 — diminuído pra fonte ficar maior em todos os formatos
  const dimCard = Math.sqrt(Math.max(1, box.w * box.h));
  const escalaCard = dimCard / REF_CARD_DIM;
  // Aplica ajuste fino por formato + mult do layout
  const _ctxFV = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
  const _multValorPR = box.multValor || 1.0;
  let fonteValor = ts.preco * escalaCard * multFormato * (ehDestaque ? 2.28 : 1.56) * _multValorPR;
  // CAP DE OVERFLOW: reduz fonte automaticamente se texto não couber.
  // balaoFixo: pílula tem largura FIXA (todas as pílulas iguais), então o cap
  // usa a largura da pílula como limite — fonte se ajusta pra caber nela.
  const _multBalaoPR = box.multBalao || 1.0;
  const _capWidth = box.balaoFixo
    ? (box.w - padding * 2) * 0.85 * _multBalaoPR
    : (box.w - padding * 2) * 0.92;
  fonteValor = capFonteValorOverflow(
    fonteValor,
    _capWidth,
    0.10,
    produto.preco,
    produto.unidadeAbrev,
    configs,
    _ctxFV,
  );
  // FIX: o cap acima IGNORA multValor quando o preço estoura a largura — retorna
  // sempre "o que cabe". Então, quando multValor < 1 (usuário quer DIMINUIR o balão),
  // recalcula a fonte-que-cabe SEM multValor e aplica o fator de redução por cima.
  // Assim o ajuste por grade SEMPRE tem efeito ao reduzir.
  if (_multValorPR < 1) {
    const fonteCabeSemMult = capFonteValorOverflow(
      ts.preco * escalaCard * multFormato * (ehDestaque ? 2.28 : 1.56),
      _capWidth,
      0.10,
      produto.preco,
      produto.unidadeAbrev,
      configs,
      _ctxFV,
    );
    fonteValor = fonteCabeSemMult * _multValorPR;
  }
  // Valor CONSISTENTE (opt-in via box.valorConsistente): usa a fonte que cabe o preço
  // MAIS LARGO entre todos os irmãos (configs._precosValores) e aplica igual em todos —
  // assim todos os balões mostram o valor no MESMO tamanho (não cresce pros preços curtos).
  if (box.valorConsistente && Array.isArray(configs._precosValores) && configs._precosValores.length > 1) {
    const _baseSemMult = ts.preco * escalaCard * multFormato * (ehDestaque ? 2.28 : 1.56);
    let _menorFV = Infinity;
    for (const _pr of configs._precosValores) {
      const _f = capFonteValorOverflow(_baseSemMult, _capWidth, 0.10, _pr?.preco, _pr?.unidadeAbrev, configs, _ctxFV);
      if (_f < _menorFV) _menorFV = _f;
    }
    if (_menorFV !== Infinity) fonteValor = _menorFV * _multValorPR;
  }
  const fonteRS    = fonteValor * 0.55;  // R$ proporcional ao valor
  const valorTexto = produto.preco || '0,00';

  // SPLIT do valor em REAIS e CENTAVOS pra renderizar com tamanhos diferentes.
  // Por padrão: centavos menor que reais (estilo qrofertas). Toggle do encarte
  // desliga essa diferença (configs.precoCentavosMesmoTamanho = true).
  const [valorReaisTexto, valorCentavosNum] = valorTexto.split(',');
  const temCentavos = valorCentavosNum !== undefined;
  const valorCentavosTexto = temCentavos ? ',' + valorCentavosNum : '';
  const fonteCentavos = configs.precoCentavosMesmoTamanho
    ? fonteValor
    : fonteValor * 0.65;  // 65% do tamanho dos reais

  // Pre-computa UNIDADE também — precisa entrar no cálculo de largura do tag,
  // senão tag fica estreito e texto+unidade extrapolam (ex: "R$ 23,90 FD").
  const unidadeAbrev = (produto.unidadeAbrev || '').toUpperCase();
  const fonteUnidade = fonteValor * 0.35;

  // Mede o texto pra dimensionar a pílula
  const reaisMed = new fabric.Text(valorReaisTexto, {
    fontSize: fonteValor, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), selectable: false, evented: false,
  });
  const centavosMed = new fabric.Text(valorCentavosTexto, {
    fontSize: fonteCentavos, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), selectable: false, evented: false,
  });
  const valorMedWidth = reaisMed.width + centavosMed.width;
  const rsMed = new fabric.Text('R$', {
    fontSize: fonteRS, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), selectable: false, evented: false,
  });
  let unidadeMedWidth = 0;
  if (unidadeAbrev) {
    const unidadeMed = new fabric.Text(unidadeAbrev, {
      fontSize: fonteUnidade, fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE), selectable: false, evented: false,
    });
    unidadeMedWidth = unidadeMed.width;
  }
  const espacoEntre = fonteValor * 0.10;
  const espacoValorUnPre = unidadeAbrev ? fonteValor * 0.06 : 0;
  // INCLUI unidade no total — fix: antes não incluía e tag ficava estreito demais
  const larguraTextoTotal = rsMed.width + espacoEntre + valorMedWidth + espacoValorUnPre + unidadeMedWidth;

  // Tag: dimensões adaptam à proporção natural do balão (se existir).
  // Sem balão: tag compacta baseada no texto (aspecto livre).
  // Com balão: tag tem mesmo aspecto que o balão → balão renderiza SEM distorção.
  // Prioridade: produto.balaoCustom (override per-produto) > paleta.balaoOferta (do tema).
  const balaoUrl_pre = produto.balaoCustom || paleta.balaoOferta;
  const balaoBboxCacheado = balaoUrl_pre ? CACHE_BBOX_BALAO.get(balaoUrl_pre) : null;
  const balaoAspect = balaoBboxCacheado ? (balaoBboxCacheado.w / balaoBboxCacheado.h) : 4.0;

  // Padding e altura do tag, escalados por multBalao (mult específico do layout)
  const multBalao = box.multBalao || 1.0;
  const tagPaddingH = (balaoUrl_pre ? fonteValor * 0.85 : fonteValor * 0.45) * multBalao;
  const tagAlturaMin = fonteValor * 1.50 * multBalao;  // 1.75 → 1.50 (pílula mais compacta)
  const tagWMin = larguraTextoTotal + tagPaddingH * 2;  // mínimo pra texto caber
  const tagWMax = (box.w - padding * 2) * 0.95;

  let tagW, tagAltura;
  if (box.balaoFixo) {
    // Pílula FIXA tem PRIORIDADE (mesmo com balão custom do tema): largura uniforme em
    // todas as pílulas. Antes o balaoUrl_pre vinha primeiro e o balaoFixo era IGNORADO
    // quando o tema tinha paleta.balaoOferta, deixando as larguras diferentes conforme
    // o texto/unidade do preço. O balão custom (se houver) é desenhado dentro dessa largura.
    tagAltura = tagAlturaMin;
    tagW = (box.w - padding * 2) * 0.85 * multBalao;
  } else if (balaoUrl_pre) {
    // Modo balão: tag respeita aspecto do balão. Começa pela altura mínima.
    tagAltura = tagAlturaMin;
    tagW = tagAltura * balaoAspect;
    const tagWAspect = tagW;  // guarda referência aspect-driven (já com multBalao)
    if (tagW < tagWMin) {
      // Texto não cabe na largura — expande mantendo o aspecto.
      // BUG-FIX: tagWMin é dirigido pelo texto e quase não responde a multBalao
      // (só via padding ~5%). Aplica multBalao ao tagWMin pra ter efeito real
      // ao reduzir o balão. Piso no tamanho aspect-driven (já tem multBalao)
      // pra não ficar minúsculo. Texto encolhe via clampPrecoNoBalao se preciso.
      tagW = multBalao < 1
        ? Math.max(tagWMin * multBalao, tagWAspect)
        : tagWMin;
      tagAltura = tagW / balaoAspect;
    }
    if (tagW > tagWMax) {
      // Cap pela largura máxima — reduz altura proporcionalmente.
      // BUG-FIX 1: quando o balão bate no cap, multBalao era "engolido" (qualquer
      // valor <1 saturava no mesmo cap). Aplica multBalao ao próprio cap.
      // BUG-FIX 2: idem pra multBalao >1 — 1.02 e 1.20 davam o mesmo cap. Agora
      // multBalao escala diretamente (acima de 1 cresce até a borda do card,
      // que é o limite duro pra não sair fora).
      const tagWScaled = tagWMax * multBalao;
      const tagWLimite = box.w - padding * 2;  // borda dura: não passa da largura do card
      tagW = Math.min(tagWScaled, tagWLimite);
      tagAltura = tagW / balaoAspect;
    }
  } else {
    // Modo pílula: largura baseada em texto, altura fixa
    tagAltura = tagAlturaMin;
    tagW = Math.max((box.w - padding * 2) * 0.45, Math.min(tagWMax, tagWMin));
  }

  // Reserva espaço pra FAIXA DE OBSERVAÇÃO (ex: "data curta") COLADA na borda inferior.
  // Quando há obs, padding inferior é zerado e o balão fica imediatamente acima da faixa.
  const obsTexto = (produto.observacao || '').trim();
  const temObs = !!obsTexto;
  const obsFonte = temObs ? Math.max(11, fonteValor * 0.32) : 0;
  const obsAltura = temObs ? obsFonte * 1.7 : 0;
  const _padInfPR = temObs ? 0 : padding;

  const tagX = box.x + (box.w - tagW) / 2;
  // balaoOffsetY: fração da altura do card pra SUBIR o balão (positivo = sobe).
  // Default 0 = balão colado na base (comportamento original de todos os layouts).
  const _balaoOffsetYPR = (box.balaoOffsetY || 0) * box.h;
  const tagY = box.y + box.h - tagAltura - _padInfPR - obsAltura - _balaoOffsetYPR;
  const centroX = box.x + box.w / 2;

  // 4) FOTO — centralizada VERTICALMENTE no espaço entre nome e tag
  const cellRefH = box.cellH || box.h;
  const targetH_base = cellRefH * 0.55 * (ehDestaque ? 1.2 : 1.0);
  const targetW = (box.w - padding * 2) * 0.95;

  // Gaps mínimos reservados (foto não chega mais perto do nome que isso)
  const gapNomeFoto = 1.3;

  // FOTO PODE SOBREPOR O TAG — extende até quase a base do card (com pequena margem),
  // ignorando onde o tag começa. O tag é desenhado depois com z-order acima da foto,
  // então fica visível por cima. Resultado: tag e foto maiores ao mesmo tempo.
  const photoAreaY = box.y + padding + alturaNome + gapNomeFoto;
  // RESERVA pro balão: 22% normal, 18% pra cards smartFoto.
  // Antes era 14% mas fotos cresciam DEMAIS e iam atrás do balão.
  // 18% deixa espaço extra pro balão (que ainda pode ter sombra/borda).
  const balaoEstimatedH = box.h * (box.smartFoto ? 0.18 : 0.22);
  const photoAreaBottom = box.y + box.h - padding - balaoEstimatedH;
  const photoAreaH = Math.max(box.h * 0.30, photoAreaBottom - photoAreaY);
  const photoAreaW = box.w - padding * 2;

  // Foto cresce pra preencher TODO o photoArea (gaps mínimos já descontados)
  const targetH = Math.max(targetH_base, photoAreaH);

  if (produto.imagem) {
    try {
      fabric.Image.fromURL(produto.imagem, (img) => {
        try {
          if (!img || !img.width) return;
          // GUARD: se o canvas foi re-renderizado depois que esse load começou,
          // abortar — senão a imagem é adicionada a um canvas com layout novo,
          // ficando "flutuando" sobre boxes que mudaram de posição/conteúdo.
          if ((canvas.__renderGen || 0) !== myGen) return;
          // GUARD 2: se o fundo desse card foi removido (canvas.clear), abortar.
          const fundoIdxAtual = canvas.getObjects().indexOf(fundo);
          if (fundoIdxAtual < 0) return;

          // AUTO-CROP: detecta a área não-transparente da imagem do produto
          // (especialmente útil pra fotos com fundo removido — descarta o padding
          // transparente em volta e amplia o produto visível). Cacheado por URL.
          let visualW = img.width;
          let visualH = img.height;
          try {
            // smartFoto: usa detector que ENTENDE o conteúdo real do produto, ignorando
            // tanto pixels transparentes quanto fundo branco/cinza uniforme (auto-detectado
            // amostrando os cantos da imagem). Isso resolve PNGs com fundo branco que
            // antes faziam o produto parecer pequeno (porque o bbox incluía o fundo branco).
            const cacheKey = box.smartFoto ? `${produto.imagem}:conteudoReal` : produto.imagem;
            let bbox = CACHE_BBOX_BALAO.get(cacheKey);
            if (bbox === undefined) {
              bbox = box.smartFoto
                ? detectarBboxConteudoReal(img)
                : detectarBboxNaoTransparente(img, 15);
              CACHE_BBOX_BALAO.set(cacheKey, bbox);
            }
            if (bbox) {
              img.set({
                cropX: bbox.x,
                cropY: bbox.y,
                width: bbox.w,
                height: bbox.h,
              });
              visualW = bbox.w;
              visualH = bbox.h;
            }
          } catch { /* se CORS bloquear ou erro, segue com imagem inteira */ }

          const fatorDestaque = ehDestaque ? 0.78 : 1.0;
          const multFoto = box.multFoto || 1.0;
          // ===== INTELIGÊNCIA DE TAMANHO (OPT-IN via box.smartFoto) =====
          // Aplica boost adaptativo SÓ quando o layout pede explicitamente (smartFoto: true).
          // Outros layouts mantêm comportamento contain padrão (foto cabe inteira sem boost).
          // Razão: cada grid tem proporção própria; boost universal estourava cards menores.
          const escalaContain = Math.min(photoAreaW / visualW, photoAreaH / visualH);
          let smartBoost = 1.0;
          if (box.smartFoto) {
            const areaImagemContain = (visualW * escalaContain) * (visualH * escalaContain);
            const areaPhoto = photoAreaW * photoAreaH;
            const fillRatio = areaImagemContain / Math.max(1, areaPhoto);
            const FILL_IDEAL = 0.92;  // alvo agressivo
            if (fillRatio < FILL_IDEAL) {
              smartBoost = Math.sqrt(FILL_IDEAL / fillRatio);
            }
            // Cap 1.40 (era 1.60) — overflow ainda menor pra evitar foto
            // descer demais pro balão e dar a impressão de "centro baixo".
            smartBoost = Math.min(smartBoost, 1.40);
          }
          let escala = escalaContain * fatorDestaque * multFoto * smartBoost;
          // SAFETY CAP: foto NUNCA pode passar das bordas do card. Antes, smartBoost
          // (até +40%) × multFoto alto fazia foto estourar pra cards vizinhos
          // (visível em g_4x3 TV_VERTICAL: PIZZA invadia BACON, COXA invadia BISTEQUINHA).
          // Cap usa (box.w/h - 4) pra deixar 2px de margem da borda do card.
          const escalaMaxCardSafe = Math.min(
            (box.w - 4) / visualW,
            (box.h - 4) / visualH,
          );
          if (escala > escalaMaxCardSafe) escala = escalaMaxCardSafe;
          img.scale(escala);
          const w = visualW * escala;
          const h = visualH * escala;
          // POSIÇÃO ADAPTATIVA:
          // - smartFoto ativo:
          //   * SEM overflow: fator 0 (foto pequena cola embaixo do nome)
          //   * COM overflow: fator 0.30 — meio-termo. (photoAreaH-h) é
          //     negativo no overflow, então fator 0.30 SUBTRAI 30% do
          //     overflow do top, deslocando a foto MODERADAMENTE pra cima
          //     (perto do nome) sem extrapolar o card (que era o problema do
          //     fator 0.65). Cap 1.40 do smartBoost garante overflow pequeno.
          // - destaque: centralizada (50%)
          // - default: 25% do topo (perto do nome)
          const overflowH = h > photoAreaH;
          let fatorTopoFoto;
          // Override per-box: box.fotoPosY (0=topo, 0.5=centro, 1=embaixo). Quando
          // definido, ignora as heurísticas e usa o valor explícito do layout.
          if (box.fotoPosY !== undefined && box.fotoPosY !== null) {
            fatorTopoFoto = overflowH ? Math.min(box.fotoPosY, 0.95) : box.fotoPosY;
          } else if (box.smartFoto) {
            fatorTopoFoto = overflowH ? 0.95 : 0;
          } else if (overflowH) {
            fatorTopoFoto = 0;
          } else if (ehDestaque) {
            fatorTopoFoto = 0.50;
          } else {
            fatorTopoFoto = 0.25;
          }
          // Calcula posição final E aplica SAFETY CLAMP: foto top não pode
          // ficar acima do limite do card (box.y + 2). Sem o clamp, fator
          // alto + overflow grande empurra a foto pra fora do card (atrás do
          // header da página), fazendo ela "sumir".
          const topProposto = photoAreaY + (photoAreaH - h) * fatorTopoFoto;
          const topMin = box.y + 2;  // 2px de margem do topo do card
          img.set({
            left: box.x + (box.w - w) / 2,
            top: Math.max(topMin, topProposto),
            selectable: false,
          });
          img.set('boxIdx', idx);
          img.on('mousedown', () => aoClicar && aoClicar(idx));
          canvas.add(img);
          // Move a imagem pra ficar EXATAMENTE acima do fundo desse card
          // (atrás de nome, sombra, pílula, R$, valor, unidade). moveTo é
          // atômico — não tem o overhead de N sendBackwards e não dá race.
          canvas.moveTo(img, fundoIdxAtual + 1);
          canvas.requestRenderAll();
        } catch (e) {
          console.warn('[render] falha imagem', produto.nome, e?.message);
        }
      }, { crossOrigin: 'anonymous' });
    } catch (e) {
      console.warn('[render] erro fromURL', e?.message);
    }
  }

  // 5) Preço "de" riscado (acima da pílula)
  if (produto.precoDe) {
    const precoDeFontSize = fonteValor * 0.30;
    canvas.add(new fabric.Text(`DE R$ ${produto.precoDe}`, {
      left: centroX, top: tagY - precoDeFontSize - 2,
      originX: 'center',
      fontSize: precoDeFontSize,
      fill: corNome,
      linethrough: true,
      fontWeight: 'bold',
      fontFamily: fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE),
      selectable: false, evented: false,
    }));
  }

  // 6) BALÃO DE OFERTA
  // SEMPRE desenha pílula+sombra fallback. Se houver balão custom, ele substitui
  // ambos (escondendo-os) quando carregar. Se falhar, fallback fica visível.
  const balaoUrl = produto.balaoCustom || paleta.balaoOferta;

  const sombraDef = new fabric.Rect({
    left: tagX + 2, top: tagY + 3,
    width: tagW, height: tagAltura,
    fill: 'rgba(0,0,0,0.25)',
    rx: tagAltura / 2, ry: tagAltura / 2,
    selectable: false, evented: false,
  });
  canvas.add(sombraDef);

  const pilulaDef = new fabric.Rect({
    left: tagX, top: tagY,
    width: tagW, height: tagAltura,
    fill: corTag,
    rx: tagAltura / 2, ry: tagAltura / 2,
    stroke: '#ffffff', strokeWidth: 2,
    selectable: false,
  });
  pilulaDef.set('boxIdx', idx);
  pilulaDef.on('mousedown', () => aoClicar && aoClicar(idx));
  canvas.add(pilulaDef);

  if (balaoUrl) {
    // Customizado: carrega o balão PNG do tema, auto-crop, e renderiza com
    // SCALING UNIFORME (preserva proporção). Como o tag já foi calculado com
    // o aspecto do balão, o balão preenche exatamente sem distorção.
    const balaoGen = canvas.__renderGen || 0;
    fabric.Image.fromURL(balaoUrl, (img) => {
      try {
        if (!img || !img.width) return;
        if ((canvas.__renderGen || 0) !== balaoGen) return;

        // Pega bbox do cache (preloadBalao já populou em renderizarEncarte)
        let bbox = CACHE_BBOX_BALAO.get(balaoUrl);
        if (bbox === undefined) {
          bbox = detectarBboxNaoTransparente(img);
          CACHE_BBOX_BALAO.set(balaoUrl, bbox);
        }

        // Aplica crop ao bbox (descarta padding transparente)
        let visualW, visualH;
        if (bbox) {
          img.set({
            cropX: bbox.x,
            cropY: bbox.y,
            width: bbox.w,
            height: bbox.h,
          });
          visualW = bbox.w;
          visualH = bbox.h;
        } else {
          visualW = img.width;
          visualH = img.height;
        }

        // SCALING UNIFORME — preserva aspecto. Como tagW/tagAltura já está no
        // mesmo aspecto do bbox, X e Y dão o mesmo valor. Zero distorção.
        const escalaUniforme = Math.min(tagW / visualW, tagAltura / visualH);
        img.set({
          scaleX: escalaUniforme,
          scaleY: escalaUniforme,
          // Centralizado dentro da área do tag (caso aspecto não bata 100%)
          left: tagX + (tagW - visualW * escalaUniforme) / 2,
          top: tagY + (tagAltura - visualH * escalaUniforme) / 2,
          selectable: false,
        });
        img.set('boxIdx', idx);
        img.on('mousedown', () => aoClicar && aoClicar(idx));
        canvas.add(img);
        // Esconde fallback (sombra + pílula) agora que o balão custom carregou
        sombraDef.set('visible', false);
        pilulaDef.set('visible', false);
        // Move o balão pra ficar ABAIXO do texto R$/valor/unidade
        const objs = canvas.getObjects();
        const rsRef = objs.find(o =>
          o.boxIdx === idx && o.type === 'text' && o.text === 'R$'
        );
        if (rsRef) {
          const rsIdx = canvas.getObjects().indexOf(rsRef);
          if (rsIdx >= 0) canvas.moveTo(img, rsIdx);
        }
        canvas.requestRenderAll();
      } catch (e) {
        console.warn('[render] balão falhou:', e?.message);
      }
    }, { crossOrigin: 'anonymous' });
  }

  // 6.5) FAIXA DE OBSERVAÇÃO — COLADA na borda inferior do card (otimiza espaço).
  // Sem padding/stroke, largura total. Cor inteligente: usa tagPreco do tema.
  let obsBgRef = null;
  let obsTxtRef = null;
  if (temObs) {
    const { fundo: corFundoObs, texto: corTextoObs } = escolherCorFaixaObs(paleta);
    const obsY = box.y + box.h - obsAltura;
    obsBgRef = new fabric.Rect({
      left: box.x,
      top: obsY,
      width: box.w,
      height: obsAltura,
      fill: corFundoObs,
      selectable: false, evented: false,
    });
    canvas.add(obsBgRef);
    obsTxtRef = new fabric.Text(obsTexto, {
      left: box.x + box.w / 2,
      top: obsY + obsAltura / 2 - obsFonte * 0.55,
      fontSize: obsFonte,
      fontFamily: fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE),
      fontWeight: 'bold',
      fill: corTextoObs,
      originX: 'center',
      selectable: false, evented: false,
    });
    canvas.add(obsTxtRef);
  }

  // 7) "R$" pequeno + valor grande + unidade abreviada (se houver)
  // unidadeAbrev e fonteUnidade já foram definidos no topo da função (cálculo do tag).

  // Mede larguras reais com measureText (Arial bold) — REAIS e CENTAVOS separados
  let larguraRsReal = 0;
  let larguraReais = 0;
  let larguraCentavos = 0;
  let larguraUnidadeReal = 0;
  try {
    const ctxMed = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
    if (ctxMed) {
      ctxMed.save();
      ctxMed.font = `${FONTE_PRECO_WEIGHT} ${fonteRS}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraRsReal = ctxMed.measureText('R$').width;
      ctxMed.font = `${FONTE_PRECO_WEIGHT} ${fonteValor}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
      larguraReais = ctxMed.measureText(valorReaisTexto).width;
      if (temCentavos) {
        ctxMed.font = `${FONTE_PRECO_WEIGHT} ${fonteCentavos}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraCentavos = ctxMed.measureText(valorCentavosTexto).width;
      }
      if (unidadeAbrev) {
        ctxMed.font = `${FONTE_PRECO_WEIGHT} ${fonteUnidade}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraUnidadeReal = ctxMed.measureText(unidadeAbrev).width;
      }
      ctxMed.restore();
    }
  } catch {}

  const larguraValorReal = larguraReais + larguraCentavos;
  const espacoRsValor = fonteValor * 0.10;
  const espacoValorUn = unidadeAbrev ? fonteValor * 0.06 : 0;
  const larguraTextoConjunto = larguraRsReal + espacoRsValor + larguraValorReal + espacoValorUn + larguraUnidadeReal;

  const startX = tagX + (tagW - larguraTextoConjunto) / 2;
  const centroPilulaY = tagY + tagAltura / 2;

  // R$ pequeno alinhado à esquerda do valor (estilo expoente, alinhado com topo do valor)
  const rsObj = new fabric.Text('R$', {
    left: startX,
    top: centroPilulaY - fonteValor * 0.30,
    fontSize: fonteRS,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoT,
    selectable: false, evented: false,
  });
  canvas.add(rsObj);

  // REAIS (parte inteira) — fonte grande, baseline mais baixo
  const reaisObj = new fabric.Text(valorReaisTexto, {
    left: startX + larguraRsReal + espacoRsValor,
    top: centroPilulaY - fonteValor * 0.55,
    fontSize: fonteValor,
    fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
    fontWeight: FONTE_PRECO_WEIGHT,
    fill: corTextoT,
    selectable: false, evented: false,
  });
  canvas.add(reaisObj);

  // CENTAVOS (",99") — menor por padrão. Alinhado pelo TOPO do reais quando menor,
  // ou pelo mesmo baseline quando configs.precoCentavosMesmoTamanho está ativo.
  let centavosObj = null;
  if (temCentavos) {
    const topCentavos = configs.precoCentavosMesmoTamanho
      ? centroPilulaY - fonteValor * 0.55  // mesmo baseline
      : centroPilulaY - fonteValor * 0.30; // alinhado mais baixo (look mais "natural")
    centavosObj = new fabric.Text(valorCentavosTexto, {
      left: startX + larguraRsReal + espacoRsValor + larguraReais,
      top: topCentavos,
      fontSize: fonteCentavos,
      fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
      fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoT,
      selectable: false, evented: false,
    });
    canvas.add(centavosObj);
  }

  // Unidade UPPERCASE no canto SUPERIOR DIREITO do valor (estilo expoente)
  let unidadeObj = null;
  if (unidadeAbrev) {
    unidadeObj = new fabric.Text(unidadeAbrev, {
      left: startX + larguraRsReal + espacoRsValor + larguraValorReal + espacoValorUn,
      top: centroPilulaY - fonteValor * 0.55,
      fontSize: fonteUnidade,
      fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
      fontWeight: FONTE_PRECO_WEIGHT,
      fill: corTextoT,
      selectable: false, evented: false,
    });
    canvas.add(unidadeObj);
  }

  // Marca os objetos de texto da tag com boxIdx pra que o callback async do balão
  // consiga achar o rsObj e posicionar o balão atrás dele.
  rsObj.set('boxIdx', idx);
  reaisObj.set('boxIdx', idx);
  if (centavosObj) centavosObj.set('boxIdx', idx);
  if (unidadeObj) unidadeObj.set('boxIdx', idx);

  // TRAVA: garante que o preço não passe do balão (encolhe se preciso)
  clampPrecoNoBalao([rsObj, reaisObj, centavosObj, unidadeObj], tagX, tagW, tagY, tagAltura);

  // Z-ORDER FINAL (de baixo pra cima): fundo → foto → [sombra+pílula OU balão] → R$ → valor → unidade → nome
  canvas.bringToFront(rsObj);
  canvas.bringToFront(reaisObj);
  if (centavosObj) canvas.bringToFront(centavosObj);
  if (unidadeObj) canvas.bringToFront(unidadeObj);
  canvas.bringToFront(nome);
  // Faixa de observação ABAIXO do balão — sempre por cima da foto/fundo
  if (obsBgRef) canvas.bringToFront(obsBgRef);
  if (obsTxtRef) canvas.bringToFront(obsTxtRef);
  // Sombra+pílula (modo padrão) ficam atrás do texto. Já estão acima do fundo
  // pela ordem de inserção, e o bringToFront acima dos textos garante que os
  // textos fiquem por cima delas.

  // 8) ETIQUETA — selo opcional no canto superior esquerdo (ex: "NOVO", "OFERTA")
  if (produto.etiqueta?.texto) {
    const etxt = produto.etiqueta.texto.toUpperCase();
    const ecor = produto.etiqueta.cor || '#ef0000';
    const efonte = ts.preco * 0.4;  // ~40% do tamanho do preço
    // Mede largura
    let larguraEtiq = 0;
    try {
      const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `900 ${efonte}px ${fonteAtual(canvas, 'preco', FONTE_PRECO_BASE)}`;
        larguraEtiq = ctx.measureText(etxt).width;
        ctx.restore();
      }
    } catch {}
    const padEtiqH = efonte * 0.5;
    const padEtiqV = efonte * 0.25;
    const etiqW = larguraEtiq + padEtiqH * 2;
    const etiqH = efonte + padEtiqV * 2;
    const etiqX = box.x + 4;  // canto superior esquerdo do card
    const etiqY = box.y + 4;
    const etiqRect = new fabric.Rect({
      left: etiqX, top: etiqY,
      width: etiqW, height: etiqH,
      fill: ecor,
      rx: 4, ry: 4,
      stroke: '#ffffff', strokeWidth: 2,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 4, offsetY: 2 }),
      selectable: false, evented: false,
    });
    canvas.add(etiqRect);
    const etiqTxt = new fabric.Text(etxt, {
      left: etiqX + padEtiqH,
      top: etiqY + padEtiqV * 0.7,
      fontSize: efonte,
      fontFamily: fonteAtual(canvas, 'preco', FONTE_PRECO_BASE),
      fontWeight: 900,
      fill: '#ffffff',
      selectable: false, evented: false,
    });
    canvas.add(etiqTxt);
    canvas.bringToFront(etiqRect);
    canvas.bringToFront(etiqTxt);
  }

  // 9) BALÃO DE DESCONTO — selo amarelo com "X% OFF" acima do balão de preço
  renderizarSeloDesconto(canvas, box, produto, { x: tagX, y: tagY, w: tagW, h: tagAltura });

  // 10) SELO +18 — círculo vermelho com "+18" no lado direito, entre nome e foto
  renderizarSeloMaior18(canvas, box, produto);
}

// ---------- Estado Vazio ----------
function renderizarEstadoVazio(canvas, areaX, areaY, areaW, areaH, aoClicar) {
  // Fundo com pontilhado
  const fundo = new fabric.Rect({
    left: areaX, top: areaY, width: areaW, height: areaH,
    fill: '#f3f4f6',
    selectable: false, hoverCursor: 'pointer',
  });
  fundo.on('mousedown', () => aoClicar && aoClicar());
  canvas.add(fundo);

  // Card branco central com sombra
  const cardW = Math.min(380, areaW * 0.55);
  const cardH = Math.min(380, areaH * 0.7);
  const cardX = areaX + (areaW - cardW) / 2;
  const cardY = areaY + (areaH - cardH) / 2;

  const card = new fabric.Rect({
    left: cardX, top: cardY, width: cardW, height: cardH,
    fill: '#ffffff',
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 30, offsetY: 8 }),
    rx: 16, ry: 16,
    selectable: false, hoverCursor: 'pointer',
  });
  card.on('mousedown', () => aoClicar && aoClicar());
  canvas.add(card);

  // "+"
  const plus = new fabric.Text('+', {
    left: cardX + cardW / 2, top: cardY + cardH * 0.28,
    originX: 'center',
    fontSize: cardW * 0.35, fontWeight: '300', fill: '#1f2937',
    fontFamily: 'Arial',
    selectable: false, evented: false,
  });
  canvas.add(plus);

  // "ADICIONE SEUS PRODUTOS"
  const txt = new fabric.Textbox('ADICIONE SEUS\nPRODUTOS', {
    left: cardX, top: cardY + cardH * 0.65,
    width: cardW,
    fontSize: cardW * 0.075, fontWeight: 'bold', fill: '#1f2937',
    textAlign: 'center', fontFamily: 'Arial',
    selectable: false, evented: false,
  });
  canvas.add(txt);
}

// ---------- Render principal ----------
// Aplica watermark "QR OFERTAS" repetido em diagonal sobre o canvas.
// Usado pra temas pagos quando o usuário não tem assinatura ativa (ou nem tá logado).
// Cobre todo o canvas com texto translúcido que dificulta uso comercial sem pagar.
function aplicarWatermarkBloqueio(canvas) {
  const W = canvas.getWidth() / canvas.getZoom();
  const H = canvas.getHeight() / canvas.getZoom();
  const TEXTO = 'PROMOPAGE';
  // Tamanho da fonte AUMENTADO (era 0.06, agora 0.075 do menor lado, mín 36px)
  const fonteSize = Math.max(36, Math.min(W, H) * 0.075);
  // Espaçamento MENOR pra cobrir mais densamente
  const stepX = fonteSize * 7.5;
  const stepY = fonteSize * 4;
  const angulo = -20;

  let linha = 0;
  for (let y = -stepY; y < H + stepY; y += stepY) {
    const offsetX = (linha % 2 === 0) ? 0 : stepX / 2;
    for (let x = -stepX + offsetX; x < W + stepX; x += stepX) {
      const wm = new fabric.Text(TEXTO, {
        left: x,
        top: y,
        fontSize: fonteSize,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 900,
        // Opacidade BEM MAIS FORTE (era 0.55 fill / 0.35 stroke):
        // - Fill branco semi-opaco (85%)
        // - Stroke preto sólido bem mais visível
        // - Sombra leve pra criar profundidade e dificultar remoção via filtros
        fill: 'rgba(255,255,255,0.85)',
        stroke: 'rgba(0,0,0,0.80)',
        strokeWidth: 2.5,
        shadow: 'rgba(0,0,0,0.40) 2px 2px 4px',
        angle: angulo,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
      });
      wm.set('__watermark', true);
      canvas.add(wm);
    }
    linha++;
  }
  canvas.requestRenderAll();
}

export async function renderizarEncarte(canvas, { tema, produtos, configs, empresa, datas, logo, fontes, aoClicarBox, aoClicarPlaceholder, aoMudarLogo, temAcesso = true, gratis = false }) {
  // Stash fontes customizadas no canvas pra os helpers acessarem sem mudar todas as assinaturas
  canvas.__fontes = fontes || {};
  if (!canvas) return;

  // Generation guard: bumpa primeiro pra invalidar callbacks antigos
  canvas.__renderGen = (canvas.__renderGen || 0) + 1;
  const meuGen = canvas.__renderGen;

  // Pre-carrega TODOS os balões usados (do tema + custom de cada produto)
  // pra detectar aspectos naturais antes de renderizar. Sem isso o tag
  // ficaria com tamanho errado e distorceria o balão.
  const baloesUrls = new Set();
  if (tema?.paleta?.balaoOferta) baloesUrls.add(tema.paleta.balaoOferta);
  for (const p of produtos || []) {
    if (p?.balaoCustom) baloesUrls.add(p.balaoCustom);
  }
  for (const url of baloesUrls) {
    if (!CACHE_BBOX_BALAO.has(url)) {
      await preloadBalao(url);
      if (canvas.__renderGen !== meuGen) return;
    }
  }

  try {
    // Limpa o canvas SEM zerar o fundo branco (evita "piscar" entre clear() e
    // setBackgroundColor — durante o gap o canvas ficava transparente).
    canvas.renderOnAddRemove = false;
    canvas.discardActiveObject();
    const objetosAntigos = canvas.getObjects().slice();
    for (const o of objetosAntigos) canvas.remove(o);
    canvas.backgroundColor = '#ffffff';
    canvas.renderOnAddRemove = true;
    canvas.requestRenderAll();

    const W = canvas.getWidth() / canvas.getZoom();
    const H = canvas.getHeight() / canvas.getZoom();

    // Capa e rodapé com altura proporcional ao tamanho do canvas
    let alturaCapa = 0;
    if (configs.gerarCapa !== false && tema?.capa) {
      try {
        // Altura da capa proporcional ao canvas, ajustada por modelo pra dar
        // melhor presença visual à imagem de fundo do tema (modo cover — sem
        // distorcer, sem vão, corta o mínimo possível).
        //   - FB quadrado:    40% (banner ~2.5:1)
        //   - A4 paisagem:    38% (banner mais alto, encarte impresso pede destaque)
        //   - Stories/Reels:  28% (verticais — capa não pode comer muito espaço)
        //   - Outros:         30%
        const FATOR_CAPA_POR_MODELO = {
          FACEBOOK_QUADRADO: 0.40,
          A4_PAISAGEM:       0.38,
          CARTAZ_HORIZONTAL: 0.38,  // mesmas dims do A4 paisagem
          A4_RETRATO:        0.26,  // vertical (alto) — 26% já é bem mais que 30% horizontal
          CARTAZ_VERTICAL:   0.26,  // mesmas dims do A4 retrato
          TV_HORIZONTAL:     0.48,  // 16:9 (1920x1080) — TV tem muito espaço vertical, capa pode ser bem alta
          TV_VERTICAL:       0.24,  // 9:16 (1080x1920) vertical alto
          STORIES:           0.28,
          REELS_INSTAGRAM:   0.28,
        };
        const fatorCapa = FATOR_CAPA_POR_MODELO[configs.modelo] ?? 0.30;
        // Cap máx subido pra 640 — permite que TV horizontal (1080*0.48=518) e
        // formatos verticais (1920*0.28=538) usem o valor cheio sem clamp.
        const alturaCapaProporcional = Math.max(180, Math.min(H * fatorCapa, 640));
        const capaAjustada = { ...tema.capa, altura: alturaCapaProporcional };
        alturaCapa = renderizarCapa(canvas, capaAjustada, W);
      } catch (e) { console.warn('[render] capa falhou:', e?.message); }
    }

    // ===== LOGO CUSTOMIZADO (sobreposto à capa, manipulável) =====
    // Renderiza mesmo sem capa — usa fallback pra posicionar no topo do canvas.
    if (logo?.url) {
      try {
        const corBordaTema = tema?.paleta?.primaria || tema?.paleta?.tagPreco || '#ef4444';
        // Se não tem capa, usa 30% da altura do canvas como "área de capa virtual"
        const alturaCapaEfetiva = alturaCapa > 0 ? alturaCapa : H * 0.30;
        renderizarLogoCustom(canvas, logo, W, alturaCapaEfetiva, aoMudarLogo, corBordaTema);
      } catch (e) { console.warn('[render] logo custom falhou:', e?.message); }
    }

    // Detecta se a empresa tem ALGUM campo ativo (qualquer toggle on com valor preenchido).
    // Quando há, o rodapé fica fininho (só "*Imagens Meramente Ilustrativas") pra ceder
    // espaço pras faixas de empresa.
    const temEmpresaVisivel = (() => {
      const m = empresa?.mostrar;
      if (m) {
        if (m.whatsapp && empresa.whatsapp) return true;
        if (m.telefone && empresa.telefone) return true;
        if (m.facebook && empresa.facebook) return true;
        if (m.instagram && empresa.instagram) return true;
        if (m.website && empresa.website) return true;
        if (m.endereco && empresa.endereco) return true;
        if (m.nome && empresa.nome) return true;
        if (m.slogan && empresa.slogan) return true;
        if (m.obsPagamento && empresa.obsPagamento) return true;
        if (m.formasPagamento && Array.isArray(empresa.formasPagamento) && empresa.formasPagamento.length > 0) return true;
      }
      // Datas / regras
      if (datas?.mostrar?.datas && (datas.dataInicio || datas.dataFinal)) return true;
      if (datas?.mostrar?.enquantoDurarem) return true;
      if (datas?.mostrar?.advertenciaMedicamento) return true;
      if (datas?.mostrar?.frasePromocional && datas?.frasePromocional?.trim()) return true;
      return false;
    })();

    // "*Imagens Meramente Ilustrativas": vem LIGADO por padrão em TODO encarte.
    // O toggle (imagensIlustrativas) é a fonte da verdade — antes ele não
    // controlava nada (o texto dependia do tema ter rodape.textoDireito). Agora:
    //   ON (default, inclusive quando datas/toggle nem existe) → mostra o aviso
    //   OFF (usuário desativou manualmente) → esconde, mesmo se o tema trouxer
    const mostrarIlustrativas = datas?.mostrar?.imagensIlustrativas !== false;
    const textoIlustrativas = mostrarIlustrativas ? '*Imagens Meramente Ilustrativas' : '';

    let alturaRodape = 0;
    try {
      let rodapeAjustado = null;
      if (tema?.rodape) {
        if (temEmpresaVisivel) {
          // Rodapé SLIM: só "*Imagens..." à direita; sem faixa superior; altura mínima
          // Reduzido 50% (era 26 → 13)
          rodapeAjustado = {
            ...tema.rodape,
            altura: 13,
            textoEsquerdo: '',     // esconde "Feito com promopage.com"
            faixaSuperior: null,   // remove faixa amarela superior
            textoDireito: textoIlustrativas,
          };
        } else {
          // Reduzido 50% (era max(50, 6%) → max(25, 3%))
          rodapeAjustado = { ...tema.rodape, altura: Math.max(25, H * 0.03), textoDireito: textoIlustrativas };
        }
      } else if (mostrarIlustrativas) {
        // Tema sem rodapé próprio: cria um rodapé mínimo só pra garantir que o
        // aviso apareça (regra: default em todo encarte).
        const corRodape = tema?.paleta?.primaria || tema?.paleta?.tagPreco || '#ef4444';
        rodapeAjustado = {
          altura: temEmpresaVisivel ? 13 : Math.max(25, H * 0.03),
          fundo: corRodape,
          textoEsquerdo: '',
          textoDireito: textoIlustrativas,
        };
      }
      alturaRodape = renderizarRodape(canvas, rodapeAjustado, W, H, configs?.modelo);
    } catch (e) { console.warn('[render] rodapé falhou:', e?.message); }

    // Faixa empresa (telefone, whatsapp, etc) acima do rodapé.
    // Soma à altura "ocupada" pelo rodapé pra área dos produtos não invadir.
    let alturaFaixaEmpresa = 0;
    try {
      alturaFaixaEmpresa = renderizarFaixaEmpresa(canvas, empresa, W, H, alturaRodape, tema?.paleta, datas);
    } catch (e) { console.warn('[render] faixa empresa falhou:', e?.message); }
    alturaRodape += alturaFaixaEmpresa;

    // Fundo do encarte (área dos produtos) — entre a capa e o rodapé.
    // Pode ser cor sólida ou imagem TILEADA (repetida pra preencher infinitamente).
    if (tema?.fundoEncarte) {
      try {
        const fundoY = alturaCapa;
        const fundoH = H - alturaCapa - alturaRodape;
        const rectFundo = new fabric.Rect({
          left: 0, top: fundoY, width: W, height: fundoH,
          fill: tema.fundoEncarte.cor || '#ffffff',
          selectable: false, evented: false,
        });
        canvas.add(rectFundo);

        // Se for imagem tileada, carrega e aplica como pattern (repeat)
        if (tema.fundoEncarte.tipo === 'imagem' && tema.fundoEncarte.imagem) {
          const fundoGen = canvas.__renderGen || 0;
          fabric.Image.fromURL(tema.fundoEncarte.imagem, (img) => {
            try {
              if (!img || !img.width) return;
              if ((canvas.__renderGen || 0) !== fundoGen) return;
              const elem = img._element || img.getElement?.();
              if (!elem) return;
              rectFundo.set('fill', new fabric.Pattern({
                source: elem,
                repeat: 'repeat',
              }));
              canvas.requestRenderAll();
            } catch (e) {
              console.warn('[render] fundo encarte (imagem) falhou:', e?.message);
            }
          }, { crossOrigin: 'anonymous' });
        }
      } catch (e) {
        console.warn('[render] fundo encarte falhou:', e?.message);
      }
    }

    const areaY = alturaCapa + 4;  // antes 8 — gap menor entre capa e produtos
    const areaH = H - alturaCapa - alturaRodape - 8;  // antes 16 — só 4 em cima e 4 embaixo
    const areaX = 8;
    const areaW = W - 16;

    const paletaTema = tema?.paleta || PALETAS_PREDEFINIDAS.vermelho;
    const paleta = (configs.cores && configs.cores !== 'inteligente' && PALETAS_PREDEFINIDAS[configs.cores])
      ? { ...paletaTema, ...PALETAS_PREDEFINIDAS[configs.cores] }
      : paletaTema;

    const produtosValidos = (produtos || []).filter(Boolean);

    if (produtosValidos.length === 0) {
      renderizarEstadoVazio(canvas, areaX, areaY, areaW, areaH, aoClicarPlaceholder);
    } else {
      const { boxes, tipo } = calcularBoxes(
        produtosValidos.length,
        areaX, areaY, areaW, areaH,
        configs.grade || 'automatico',
        configs.boxes || 'inteligente',
        configs.modelo,
      );
      // Header da tabela (só pra layouts tipo 'lista')
      // _precosValores: lista de preços de todos os produtos — usado pra "valor consistente"
      // (box.valorConsistente) deixar o tamanho do preço igual em todos os cards.
      let configsLista = { ...configs, _precosValores: produtosValidos.map(p => ({ preco: p?.preco, unidadeAbrev: p?.unidadeAbrev })), _nomesProdutos: produtosValidos.map(p => p?.nome) };
      if (tipo === 'lista') {
        try {
          renderizarTabelaHeader(canvas, areaX, areaY, areaW, TABELA_HEADER_H, paleta);
        } catch (e) { console.warn('[render] header tabela falhou:', e?.message); }

        // Pre-calcula uma fonte CONSISTENTE pra TODOS os nomes da tabela.
        // Pega o tamanho que cabe pro nome mais longo, e usa em todas as linhas.
        // Sem isso, cada linha auto-shrinkria diferente e ficaria desalinhado.
        try {
          const padding = 16;
          const maxLargura = (boxes[0].w - padding * 2) * 0.55;
          let fonteSize = boxes[0].h * 0.62;
          const ctx = canvas.contextContainer || canvas.lowerCanvasEl?.getContext('2d');
          if (ctx) {
            ctx.save();
            // Encontra o NOME mais longo
            for (const p of produtosValidos) {
              const txt = (p?.nome || '').toUpperCase();
              ctx.font = `900 ${fonteSize}px ${fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE)}`;
              let larg = ctx.measureText(txt).width;
              while (larg > maxLargura && fonteSize > 10) {
                fonteSize *= 0.96;
                ctx.font = `900 ${fonteSize}px ${fonteAtual(canvas, 'nome', FONTE_PRODUTO_BASE)}`;
                larg = ctx.measureText(txt).width;
              }
            }
            ctx.restore();
          }
          configsLista = { ...configs, _fonteSizeNomeListaConsistente: fonteSize };
        } catch (e) { console.warn('[render] pre-calc fonte tabela falhou:', e?.message); }
      }
      boxes.forEach((box, i) => {
        try {
          renderizarBoxProduto(canvas, box, produtosValidos[i], i, paleta, configs.texto || 'medio', aoClicarBox, configsLista);
        } catch (e) {
          console.warn('[render] box falhou para produto', i, ':', e?.message);
        }
      });
    }

    // Watermark de bloqueio: aplicado depois de tudo (fica POR CIMA do conteúdo).
    // Só renderiza se o tema é PAGO E o usuário NÃO tem acesso.
    // Casos:
    //   - tema gratis=true       → sem watermark (mesmo deslogado)
    //   - temAcesso=true         → sem watermark (cliente pagante)
    //   - tema pago + sem acesso → COM watermark
    if (!gratis && !temAcesso) {
      aplicarWatermarkBloqueio(canvas);
    }

    canvas.requestRenderAll();
  } catch (e) {
    console.error('[render] erro fatal no encarte:', e?.message || e);
  }
}

export function exportarPNG(canvas) {
  // BUG-FIX (mobile baixa qualidade): App.jsx aplica zoom de preview via setWidth/
  // setHeight. multiplier = 2 / zoom mantém o export em 2× resolução NATIVA.
  //
  // CAP em 8: se zoom muito baixo (tela pequena + canvas grande tipo TV_VERTICAL),
  // multiplier pode passar de 13× → fabric.js tenta alocar canvas gigante na
  // memória do browser → falha silenciosa OU SecurityError no toDataURL.
  // Cap em 8× = output máximo 8× do canvas atual (~64MB de pixels — seguro).
  const zoom = canvas.getZoom() || 1;
  const multiplier = Math.min(8, 2 / zoom);
  return canvas.toDataURL({ format: 'png', quality: 1, multiplier });
}
