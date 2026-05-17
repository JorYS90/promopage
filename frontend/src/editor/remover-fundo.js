// Remoção de fundo HÍBRIDA:
//  1. Tenta chroma key (fundo uniforme branco/cinza) — instantâneo (~5ms)
//  2. Se fundo não é uniforme, cai na IA (@imgly) — ~3-5s
//
// Pra fotos de catálogo de varejo (fundo branco/cinza), o chroma key é MUITO melhor:
// preserva 100% do produto e roda em milissegundos. A IA só entra quando precisa.

let removeBackgroundFn = null;

async function carregarBibliotecaIA() {
  if (removeBackgroundFn) return removeBackgroundFn;
  const mod = await import('@imgly/background-removal');
  removeBackgroundFn = mod.removeBackground;
  return removeBackgroundFn;
}

// ---------- Helpers ----------
function blobParaImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasParaBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
}

// Lê amostra das 4 bordas e retorna { r, g, b, variacao }
// variacao baixa = fundo uniforme = bom candidato pra chroma key
function analisarFundo(ctx, w, h) {
  const amostras = [];
  const passo = Math.max(1, Math.floor(Math.min(w, h) / 50));
  // Bordas top/bottom
  for (let x = 0; x < w; x += passo) {
    amostras.push(ctx.getImageData(x, 0, 1, 1).data);
    amostras.push(ctx.getImageData(x, h - 1, 1, 1).data);
  }
  // Bordas left/right
  for (let y = 0; y < h; y += passo) {
    amostras.push(ctx.getImageData(0, y, 1, 1).data);
    amostras.push(ctx.getImageData(w - 1, y, 1, 1).data);
  }

  let sumR = 0, sumG = 0, sumB = 0;
  for (const a of amostras) {
    sumR += a[0]; sumG += a[1]; sumB += a[2];
  }
  const n = amostras.length;
  const r = sumR / n, g = sumG / n, b = sumB / n;

  // Variância: o quanto as amostras se afastam da média
  let varTotal = 0;
  for (const a of amostras) {
    varTotal += Math.abs(a[0] - r) + Math.abs(a[1] - g) + Math.abs(a[2] - b);
  }
  const variacao = varTotal / n; // 0 = totalmente uniforme

  return { r, g, b, variacao, claro: (r + g + b) / 3 > 200 };
}

// ---------- Flood fill a partir das bordas ----------
// Remove APENAS pixels conectados às bordas que combinam com a cor de fundo.
// Pixels brancos DENTRO do produto (texto, áreas claras) ficam preservados.
// Tolerância conservadora + erosão da máscara para não vazar pelas bordas suaves.
async function removerFundoChromaKey(blob, opts = {}) {
  const img = await blobParaImage(blob);
  const canvas = document.createElement('canvas');
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const fundo = analisarFundo(ctx, W, H);
  if (fundo.variacao > 25) {
    return { sucesso: false, motivo: 'fundo-nao-uniforme', variacao: fundo.variacao };
  }

  // Tolerância conservadora — preserva mais do produto.
  // Se fundo for MUITO uniforme (variação < 5), pode ser um pouco mais permissivo.
  const tolBase = opts.tolerancia ?? (fundo.variacao < 5 ? 28 : 22);

  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const mask = new Uint8Array(W * H); // 0=não testado, 1=fundo, 2=produto

  const ehFundo = (idx, tol) => {
    const i = idx * 4;
    const dr = px[i]     - fundo.r;
    const dg = px[i + 1] - fundo.g;
    const db = px[i + 2] - fundo.b;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= tol;
  };

  // BFS partindo das 4 bordas
  const fila = [];
  for (let x = 0; x < W; x++) {
    fila.push(x);
    fila.push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    fila.push(y * W);
    fila.push(y * W + (W - 1));
  }

  let cabeca = 0;
  while (cabeca < fila.length) {
    const idx = fila[cabeca++];
    if (mask[idx]) continue;
    if (ehFundo(idx, tolBase)) {
      mask[idx] = 1;
      const x = idx % W;
      const y = (idx - x) / W;
      if (x > 0)     fila.push(idx - 1);
      if (x < W - 1) fila.push(idx + 1);
      if (y > 0)     fila.push(idx - W);
      if (y < H - 1) fila.push(idx + W);
    } else {
      mask[idx] = 2;
    }
  }

  // 2º PASSE: EXPANSÃO POR TEXTURA — pega pontos da textura do fundo (ex: pontos
  // brancos sobre amarelo) que estão CERCADOS por pixels já marcados como fundo.
  // Tolerância maior, mas só expande a partir do fundo (não vaza pro produto).
  const tolExpansao = opts.tolerancia2 ?? Math.max(50, tolBase * 2.2);
  const passesExpansao = opts.passesExpansao ?? 4;
  for (let passo = 0; passo < passesExpansao; passo++) {
    let mudou = false;
    const novaMask = new Uint8Array(mask);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (mask[idx] !== 2) continue; // só mexe em pixels de produto
        // Conta vizinhos de fundo
        const fundoVizinhos =
          (mask[idx - 1] === 1 ? 1 : 0) +
          (mask[idx + 1] === 1 ? 1 : 0) +
          (mask[idx - W] === 1 ? 1 : 0) +
          (mask[idx + W] === 1 ? 1 : 0);
        // Pixel cercado por fundo (3+ vizinhos de fundo) E próximo da cor de fundo
        // com tolerância maior → é parte da textura do fundo
        if (fundoVizinhos >= 3 && ehFundo(idx, tolExpansao)) {
          novaMask[idx] = 1;
          mudou = true;
        }
      }
    }
    mask.set(novaMask);
    if (!mudou) break;
  }

  // EROSÃO DEFENSIVA: pixels de fundo que tocam pixels de produto viram "transição"
  // (mantêm cor original mas alpha 0). Protege o produto de ter pixels comidos
  // por causa de bordas anti-aliased.
  const erosao = opts.erosao ?? 1;
  for (let passo = 0; passo < erosao; passo++) {
    const novaMask = new Uint8Array(mask);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (mask[idx] !== 1) continue;
        // Apenas se a maioria dos vizinhos é PRODUTO (não só 1) — protege bordas finas
        const produtoVizinhos =
          (mask[idx - 1] === 2 ? 1 : 0) +
          (mask[idx + 1] === 2 ? 1 : 0) +
          (mask[idx - W] === 2 ? 1 : 0) +
          (mask[idx + W] === 2 ? 1 : 0);
        if (produtoVizinhos >= 3) novaMask[idx] = 2; // promove a "produto" - preserva
      }
    }
    mask.set(novaMask);
  }

  // Aplica máscara
  for (let idx = 0; idx < mask.length; idx++) {
    if (mask[idx] === 1) {
      px[idx * 4 + 3] = 0;
    }
  }

  // Suavização de borda: anti-aliasing nas transições
  const passes = opts.suavizar ?? 4;
  for (let pass = 0; pass < passes; pass++) {
    const novoAlpha = new Uint8Array(W * H);
    for (let idx = 0; idx < mask.length; idx++) novoAlpha[idx] = px[idx * 4 + 3];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const a = px[idx * 4 + 3];
        if (a === 0) continue;
        const transparentes =
          (px[(idx - 1) * 4 + 3] < 128 ? 1 : 0) +
          (px[(idx + 1) * 4 + 3] < 128 ? 1 : 0) +
          (px[(idx - W) * 4 + 3] < 128 ? 1 : 0) +
          (px[(idx + W) * 4 + 3] < 128 ? 1 : 0);
        if (transparentes > 0) {
          novoAlpha[idx] = Math.round(a * (1 - transparentes * 0.10));
        }
      }
    }
    for (let idx = 0; idx < mask.length; idx++) px[idx * 4 + 3] = novoAlpha[idx];
  }

  ctx.putImageData(data, 0, 0);
  const blobOut = await canvasParaBlob(canvas);
  return { sucesso: true, blob: blobOut, variacao: fundo.variacao, tolerancia: tolBase };
}

// ---------- IA fallback ----------
async function removerFundoIA(blob, opts = {}) {
  const removeBackground = await carregarBibliotecaIA();
  // Modelo isnet_fp16 = balanceado e mais conservador que 'isnet' full
  // (não fragmenta tanto fotos com múltiplos objetos visuais)
  const config = {
    model: 'isnet_fp16',
    output: { format: 'image/png', quality: 1 },
    progress: opts.onProgress,
  };
  return await removeBackground(blob, config);
}

// ---------- API pública ----------
export async function removerFundo(urlOuBlob, opts = {}) {
  // Garante que temos um Blob
  let blob = urlOuBlob;
  if (typeof urlOuBlob === 'string') {
    const r = await fetch(urlOuBlob);
    blob = await r.blob();
  }

  // 1) Tenta chroma key primeiro (rápido + conservador)
  try {
    if (opts.onProgress) opts.onProgress('chroma_key', 0, 100);
    const ck = await removerFundoChromaKey(blob, opts);
    if (ck.sucesso) {
      if (opts.onProgress) opts.onProgress('chroma_key', 100, 100);
      console.log('[bg-removal] chroma key aplicado (variação: ' + ck.variacao.toFixed(1) + ')');
      return ck.blob;
    }
    // Fluxo automático: se chroma key não rola, NÃO cai em IA (WASM single-thread
    // congela a UI durante segundos). Retorna null e quem chamou mantém a imagem original.
    if (opts.pularIA) {
      console.log('[bg-removal] fundo não uniforme (variação: ' + ck.variacao.toFixed(1) + '), pulando IA (auto)');
      return null;
    }
    console.log('[bg-removal] fundo não uniforme (variação: ' + ck.variacao.toFixed(1) + '), usando IA');
  } catch (e) {
    if (opts.pularIA) {
      console.warn('[bg-removal] chroma key falhou, pulando IA (auto):', e.message);
      return null;
    }
    console.warn('[bg-removal] chroma key falhou, usando IA:', e.message);
  }

  // 2) Fallback: IA com modelo conservador (só se opts.pularIA não estiver setado)
  return await removerFundoIA(blob, opts);
}

// Mesmas funções de antes pra compatibilidade
export async function removerFundoDeUrl(url, opts = {}) {
  let urlLocal = url;
  if (/^https?:\/\//.test(url)) {
    const r = await fetch(`/api/proxy-imagem?url=${encodeURIComponent(url)}`);
    if (!r.ok) throw new Error('Falha ao baixar via proxy');
    const json = await r.json();
    urlLocal = json.url;
  }
  const r2 = await fetch(urlLocal);
  if (!r2.ok) throw new Error('Falha ao carregar imagem local');
  const blob = await r2.blob();
  return removerFundo(blob, opts);
}

export async function uploadBlobProcessado(blob, nomeArquivo = 'sem-fundo.png') {
  const fd = new FormData();
  fd.append('imagem', blob, nomeArquivo);
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Falha no upload');
  const json = await r.json();
  return json.url;
}
