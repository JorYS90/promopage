// Deriva cor escura do rodapé a partir da paleta primária de cada tema.
//
// Templates IA novos foram criados com rodape.fundo = "#7f1d1d" (vinho fixo),
// que não combina com paletas laranja/vermelha/etc. Esse script substitui
// pelo MESMO matiz da primária, só mais escuro (~28% do brilho).
//
// Pra cada template:
//   - rodape.faixaSuperior = paleta.primaria (cor viva)
//   - rodape.fundo         = paleta.primaria escurecida 72% (mesma família)
//
// Só atualiza se rodape.fundo for o placeholder #7f1d1d — preserva temas
// que já têm rodapé custom feito à mão pelo designer original.
//
// Rodar: node scripts/corrigir-rodape-templates.js [--dry-run] [--forcar]
//   --forcar: aplica em TODOS os templates, não só os com #7f1d1d

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCAR = process.argv.includes('--forcar');
const PLACEHOLDER = '#7f1d1d'; // vinho escuro que setei como default

// === Util cor ===
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHex({ r, g, b }) {
  const h = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

// Escurece a cor multiplicando RGB por um fator. Mantém o matiz da cor
// (matemática simples sem espaço HSL — bom o suficiente pro caso de uso).
// fator 0.28 = ~72% mais escuro, dá um tom "rodapé" sólido sem ficar preto.
function escurecer(hex, fator = 0.28) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * fator, g: g * fator, b: b * fator });
}

// === Main ===
const arquivos = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
console.log(`📋 ${arquivos.length} templates encontrados${DRY_RUN ? ' (DRY-RUN)' : ''}${FORCAR ? ' [FORÇADO]' : ''}\n`);

const resultados = [];
let pulados = 0;

for (const arq of arquivos) {
  const fullPath = path.join(TEMPLATES_DIR, arq);
  const tpl = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  if (!tpl.paleta?.primaria || !tpl.rodape) continue;

  const primaria = tpl.paleta.primaria;
  const rodapeAtual = tpl.rodape.fundo || '';

  // Só processa se for placeholder OU se forçado
  const usarPlaceholder = rodapeAtual.toLowerCase() === PLACEHOLDER.toLowerCase();
  if (!usarPlaceholder && !FORCAR) {
    pulados++;
    continue;
  }

  // Estratégia conservativa: deriva o fundo da FAIXA SUPERIOR se ela já
  // estiver definida e diferente da primária (designer escolheu de propósito).
  // Senão usa primária. Mantém faixaSuperior como está — só toca no .fundo.
  const corBase = tpl.rodape.faixaSuperior && tpl.rodape.faixaSuperior !== PLACEHOLDER
    ? tpl.rodape.faixaSuperior
    : primaria;
  const novoFundo = escurecer(corBase, 0.28);

  resultados.push({
    arq,
    primaria,
    base: corBase,
    fundoAntes: rodapeAtual,
    fundoDepois: novoFundo,
    faixaAntes: tpl.rodape.faixaSuperior || '(nenhuma)',
    faixaDepois: tpl.rodape.faixaSuperior || '(mantida)',
  });

  if (!DRY_RUN) {
    tpl.rodape.fundo = novoFundo;
    // NÃO sobrescrever faixaSuperior — preservar customização do designer
    tpl.atualizadoEm = new Date().toISOString();
    fs.writeFileSync(fullPath, JSON.stringify(tpl, null, 2) + '\n', 'utf-8');
  }
}

console.log('Template'.padEnd(40), 'Primária'.padEnd(10), '→ Rodapé Fundo'.padEnd(18), '+ Faixa Superior');
console.log('-'.repeat(100));
for (const r of resultados) {
  console.log(
    r.arq.padEnd(40),
    r.primaria.padEnd(10),
    `${r.fundoAntes} → ${r.fundoDepois}`.padEnd(22),
    r.faixaDepois
  );
}
console.log('-'.repeat(100));
console.log(`✅ ${resultados.length} ${DRY_RUN ? 'analisados' : 'atualizados'}, ${pulados} mantidos (já tinham cor custom)`);
