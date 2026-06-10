// Mapeia cada template à pílula de cor + tom mais próximos do banco de 300.
//
// Algoritmo:
//   1. Lê paleta.primaria (hex) de cada template
//   2. Converte pra RGB
//   3. Pra cada uma das 10 categorias de cor (azul/verde/etc):
//      mede distância RGB euclidiana ao tom MEDIANO (15) → escolhe cor mais próxima
//   4. Dentro da cor escolhida: mede distância RGB ao tom específico (1-30)
//      → escolhe tom mais próximo
//   5. Atualiza paleta.balaoOferta com caminho /uploads/baloes/<cor>/<arquivo>.png
//
// Rodar: node scripts/mapear-baloes-templates.js [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const BALOES_DIR = path.join(ROOT, 'uploads', 'baloes');

const DRY_RUN = process.argv.includes('--dry-run');

// === Util cor ===
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// Converte RGB → HSV. H em graus [0,360), S e V em [0,1].
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function distRgb(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Mapeia matiz (0-360) à categoria do banco. Marrom não é matiz puro;
// é tratado abaixo via saturação+brilho baixos em matiz laranja/vermelho.
function categoriaPorMatiz(h) {
  if (h >= 345 || h < 12)  return '03_vermelho';
  if (h <  45)             return '05_laranja';
  if (h <  72)             return '06_amarelo';
  if (h < 170)             return '02_verde';
  if (h < 200)             return '08_ciano';
  if (h < 255)             return '01_azul';
  if (h < 290)             return '04_roxo';
  return '07_rosa';
}

// Escolhe a categoria do banco que melhor representa a cor:
//   - Saturação muito baixa → 09_cinza (cor neutra)
//   - Matiz laranja/vermelho + S baixa + V baixo → 10_marrom (tons terrosos)
//   - Senão: categoriaPorMatiz(H)
function categoriaPraCor({ h, s, v }) {
  // Cinza puro: saturação < 12% (qualquer brilho).
  if (s < 0.12) return '09_cinza';

  // Marrom: matiz vermelho/laranja/amarelo, saturação média, brilho baixo.
  // Cobre vinhos terrosos, marrom-padaria, bordô-vinho.
  const matizQuente = h < 60 || h >= 345;
  if (matizQuente && v < 0.55 && s < 0.6) return '10_marrom';

  return categoriaPorMatiz(h);
}

// === Carrega catálogo de balões ===
// Estrutura: cada arquivo "01_azul_NN_HEXHEX.png" → { cor:"01_azul", tom:NN, hex:HEXHEX, file:... }
function carregarCatalogo() {
  const cores = fs.readdirSync(BALOES_DIR).filter(d =>
    fs.statSync(path.join(BALOES_DIR, d)).isDirectory()
  ).sort();
  const cat = {};
  for (const cor of cores) {
    const arquivos = fs.readdirSync(path.join(BALOES_DIR, cor))
      .filter(f => f.endsWith('.png'))
      .sort();
    cat[cor] = arquivos.map(f => {
      // 01_azul_17_0A72E9.png → cor=01_azul, tom=17, hex=#0A72E9
      const m = f.match(/^(\d+_[a-z]+)_(\d+)_([0-9A-F]{6})\.png$/i);
      if (!m) return null;
      const [, , tomStr, hex] = m;
      return {
        cor,
        tom: parseInt(tomStr, 10),
        hex: '#' + hex,
        rgb: hexToRgb('#' + hex),
        path: `/uploads/baloes/${cor}/${f}`,
      };
    }).filter(Boolean);
  }
  return cat;
}

// === Encontra balão mais próximo da cor primária ===
//
// Pipeline:
//   1. Converte hex → RGB → HSV
//   2. categoriaPraCor(HSV) escolhe a categoria do banco (matiz dominante,
//      ou cinza/marrom em casos especiais). Resolve o problema de
//      "vinho escuro → cinza" do algoritmo RGB-puro.
//   3. Dentro da categoria, escolhe o TOM (1-30) por menor distância RGB.
function encontrarBalaoMaisProximo(corHex, catalogo) {
  const rgb = hexToRgb(corHex);
  const hsv = rgbToHsv(rgb);
  const categoria = categoriaPraCor(hsv);

  // Tom: menor distância RGB dentro da categoria fixa
  let melhorTom = null;
  let menorDistTom = Infinity;
  for (const tom of catalogo[categoria]) {
    const d = distRgb(rgb, tom.rgb);
    if (d < menorDistTom) {
      menorDistTom = d;
      melhorTom = tom;
    }
  }
  return melhorTom;
}

// === Main ===
function main() {
  console.log(`📂 Lendo catálogo de balões em ${BALOES_DIR}...`);
  const catalogo = carregarCatalogo();
  const totalPilulas = Object.values(catalogo).reduce((s, arr) => s + arr.length, 0);
  console.log(`✅ ${Object.keys(catalogo).length} cores × ${totalPilulas / Object.keys(catalogo).length} tons = ${totalPilulas} pílulas\n`);

  const arquivos = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
  console.log(`📋 ${arquivos.length} templates encontrados${DRY_RUN ? ' (DRY-RUN)' : ''}\n`);

  const resultados = [];
  for (const arq of arquivos) {
    const fullPath = path.join(TEMPLATES_DIR, arq);
    const tpl = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    if (!tpl.paleta) continue;

    const primaria = tpl.paleta.primaria;
    if (!primaria || !/^#[0-9a-f]{3,8}$/i.test(primaria)) {
      console.log(`⚠️  ${arq}: paleta.primaria inválida (${primaria})`);
      continue;
    }

    const balao = encontrarBalaoMaisProximo(primaria, catalogo);
    if (!balao) {
      console.log(`❌ ${arq}: nenhum balão encontrado`);
      continue;
    }

    const antes = tpl.paleta.balaoOferta || '(nenhum)';
    const depois = balao.path;
    resultados.push({ arq, primaria, antes, depois, cor: balao.cor, tom: balao.tom });

    if (!DRY_RUN) {
      tpl.paleta.balaoOferta = depois;
      tpl.atualizadoEm = new Date().toISOString();
      fs.writeFileSync(fullPath, JSON.stringify(tpl, null, 2) + '\n', 'utf-8');
    }
  }

  // Tabela resumo
  console.log('\n=== RESUMO ===');
  console.log('Template'.padEnd(45), 'Primária'.padEnd(10), '→ Balão');
  console.log('-'.repeat(95));
  for (const r of resultados) {
    console.log(
      r.arq.padEnd(45),
      r.primaria.padEnd(10),
      `${r.cor} tom ${String(r.tom).padStart(2, '0')}`
    );
  }
  console.log('-'.repeat(95));
  console.log(`✅ Total: ${resultados.length} templates ${DRY_RUN ? 'analisados' : 'atualizados'}`);

  // Distribuição
  const distrib = {};
  for (const r of resultados) {
    distrib[r.cor] = (distrib[r.cor] || 0) + 1;
  }
  console.log('\n=== DISTRIBUIÇÃO POR COR ===');
  for (const cor of Object.keys(distrib).sort()) {
    console.log(`${cor}: ${distrib[cor]} templates`);
  }
}

main();
