// Remove o fundo BRANCO de um título (logo) por flood-fill a partir das bordas.
// Só apaga o branco/near-white CONECTADO à borda (o fundo) — preserva os
// contornos brancos INTERNOS das letras (eles ficam cercados por cor).
//
// Uso: node scripts/remover-fundo-branco.js <input.png> [output.png]
// Se output omitido, sobrescreve o input.

const sharp = require('sharp');

const THRESH = 238;   // canal >= isso em R,G,B = "branco"
const FEATHER = 250;  // pixels >= isso viram semi-transparentes na borda (anti-halo)

async function main() {
  const [input, outputArg] = process.argv.slice(2);
  if (!input) { console.error('Uso: node scripts/remover-fundo-branco.js <input.png> [output.png]'); process.exit(1); }
  const output = outputArg || input;

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const idx = (x, y) => (y * W + x) * 4;
  const isWhite = (x, y) => {
    const i = idx(x, y);
    return data[i] >= THRESH && data[i + 1] >= THRESH && data[i + 2] >= THRESH && data[i + 3] > 0;
  };

  const visited = new Uint8Array(W * H);
  const stack = [];
  // semente: todas as bordas que forem brancas
  for (let x = 0; x < W; x++) { stack.push([x, 0]); stack.push([x, H - 1]); }
  for (let y = 0; y < H; y++) { stack.push([0, y]); stack.push([W - 1, y]); }

  let removidos = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (visited[p]) continue;
    visited[p] = 1;
    if (!isWhite(x, y)) continue;
    data[idx(x, y) + 3] = 0; // transparente
    removidos++;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  // anti-halo: pixels claros (não totalmente brancos) na fronteira do que foi removido
  // ganham alpha proporcional (suaviza a borda serrilhada)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (data[i + 3] === 0) continue;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum >= FEATHER) {
        // se vizinho já é transparente, suaviza
        let vizTransp = false;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x+dx, ny = y+dy;
          if (nx>=0&&ny>=0&&nx<W&&ny<H && data[idx(nx,ny)+3]===0) { vizTransp = true; break; }
        }
        if (vizTransp) data[i + 3] = Math.round(data[i + 3] * 0.35);
      }
    }
  }

  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
    .png().toFile(output + '.tmp.png');
  // troca atomica
  require('fs').renameSync(output + '.tmp.png', output);

  const pct = (100 * removidos / (W * H)).toFixed(1);
  console.log(`✅ ${input} -> ${output} | removido ${pct}% (fundo branco)`);
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
