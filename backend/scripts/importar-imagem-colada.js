// Importa imagens COLADAS no chat (que ficam gravadas como base64 no transcript
// .jsonl da sessão do Claude Code) e salva como arquivos no disco — sem custo de API.
//
// Uso:
//   node scripts/importar-imagem-colada.js <transcript.jsonl> <linha> <destino-sem-ext>
//
// Ex: node scripts/importar-imagem-colada.js "C:\...\8bdb3384.jsonl" 124 mundo-pet
//
// Salva todas as imagens daquela linha como <destino>-img0.png, -img1.png, etc.
// em uploads/ai/ no tamanho NATIVO. O redimensionamento final é feito depois.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sharp = require('sharp');

const AI_DIR = path.join(__dirname, '..', 'uploads', 'ai');

async function main() {
  const [tpath, linhaStr, destino] = process.argv.slice(2);
  if (!tpath || !linhaStr || !destino) {
    console.error('Uso: node scripts/importar-imagem-colada.js <transcript.jsonl> <linha> <destino>');
    process.exit(1);
  }
  const alvo = parseInt(linhaStr, 10);
  fs.mkdirSync(AI_DIR, { recursive: true });

  const rl = readline.createInterface({ input: fs.createReadStream(tpath) });
  let n = 0;
  const imgs = [];
  for await (const l of rl) {
    n++;
    if (n !== alvo) continue;
    const o = JSON.parse(l);
    const c = o.message && o.message.content;
    if (Array.isArray(c)) {
      for (const b of c) {
        if (b.type === 'image' && b.source && b.source.data) imgs.push(b.source);
      }
    }
    break;
  }
  console.log(`Imagens na linha ${alvo}: ${imgs.length}`);
  for (let i = 0; i < imgs.length; i++) {
    const buf = Buffer.from(imgs[i].data, 'base64');
    const m = await sharp(buf).metadata();
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transp = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] < 10) transp++;
    const frac = (transp / (info.width * info.height)).toFixed(2);
    const out = path.join(AI_DIR, `${destino}-img${i}.png`);
    await sharp(buf).png().toFile(out);
    console.log(`#${i} ${m.width}x${m.height} alpha=${m.hasAlpha} transpFrac=${frac} -> ${out}`);
  }
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
