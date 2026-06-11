// Gera as 2 imagens de capa de um tema (fundo + título) via API de Imagens da
// OpenAI (gpt-image-1) e salva em uploads/ai/ nos tamanhos certos com sharp.
//
// Uso:
//   node scripts/gerar-imagens-tema.js <slug> "<prompt do fundo>" "<prompt do titulo>"
//
// Requer OPENAI_API_KEY no backend/.env (a mesma já usada pra legendas).
// gpt-image-1 suporta background transparente — usado no título (logo).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_DIR = path.join(__dirname, '..', 'uploads', 'ai');

if (!OPENAI_API_KEY.startsWith('sk-')) {
  console.error('❌ OPENAI_API_KEY ausente/inválida no .env');
  process.exit(1);
}

// Chama a API de imagens e devolve um Buffer PNG.
// background: 'transparent' | 'opaque'
async function gerarImagem({ prompt, size, background }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size,                 // '1536x1024' (paisagem) | '1024x1024' | '1024x1536'
      n: 1,
      background,           // 'transparent' p/ logo, 'opaque' p/ fundo
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('resposta sem b64_json');
  return Buffer.from(b64, 'base64');
}

async function main() {
  const [slug, promptFundo, promptTitulo] = process.argv.slice(2);
  if (!slug || !promptFundo || !promptTitulo) {
    console.error('Uso: node scripts/gerar-imagens-tema.js <slug> "<prompt fundo>" "<prompt titulo>"');
    process.exit(1);
  }
  fs.mkdirSync(AI_DIR, { recursive: true });

  // FUNDO — paisagem 1536x1024, depois cover-crop pra 2400x800 (3:1)
  console.log('🎨 Gerando fundo...');
  const rawFundo = await gerarImagem({ prompt: promptFundo, size: '1536x1024', background: 'opaque' });
  const outFundo = path.join(AI_DIR, `${slug}-fundo.png`);
  await sharp(rawFundo).resize(2400, 800, { fit: 'cover', position: 'centre' }).png().toFile(outFundo);
  console.log('✅ ' + outFundo);

  // TÍTULO — transparente 1536x1024, depois contain pra 1500x500 mantendo alpha
  console.log('🎨 Gerando título (transparente)...');
  const rawTitulo = await gerarImagem({ prompt: promptTitulo, size: '1536x1024', background: 'transparent' });
  const outTitulo = path.join(AI_DIR, `${slug}-titulo.png`);
  await sharp(rawTitulo)
    .resize(1500, 500, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outTitulo);
  console.log('✅ ' + outTitulo);

  console.log('\n🏁 Pronto! Aponte o tema para:');
  console.log(`   /uploads/ai/${slug}-fundo.png`);
  console.log(`   /uploads/ai/${slug}-titulo.png`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
