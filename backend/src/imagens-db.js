// Banco de imagens-por-produto baseado em uso real dos usuários.
// Quando alguém adiciona "banana 5,99 kg", a imagem escolhida é registrada aqui.
// Próximas buscas por "banana" priorizam imagens já usadas (ordenadas por popularidade),
// agilizando o processo e mantendo consistência visual entre encartes.
//
// Estrutura: { "<nome-normalizado>": [{ url, usos, primeiroUso, ultimoUso }, ...] }

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'imagens-produtos.json');

function carregar() {
  if (!fs.existsSync(DB_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('[imagens-db] erro lendo:', e.message);
    return {};
  }
}

// Salvamento ATÔMICO + backup diário rotativo (mantém últimos 7 dias).
// Atomic write evita corrupção se o processo for interrompido no meio do write.
// Backup diário roda só uma vez por dia (compara mtime do último backup).
const BACKUP_DIR = path.join(path.dirname(DB_FILE), 'backups-imagens');
const DIAS_BACKUP = 7;

function rodarBackupDiarioSeNecessario() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const backupHoje = path.join(BACKUP_DIR, `imagens-produtos.${hoje}.json`);
    if (fs.existsSync(backupHoje)) return; // já tem backup de hoje
    fs.copyFileSync(DB_FILE, backupHoje);
    // Rotação: remove backups com mais de DIAS_BACKUP
    const arquivos = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('imagens-produtos.') && f.endsWith('.json'))
      .map(f => ({ f, full: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of arquivos.slice(DIAS_BACKUP)) {
      try { fs.unlinkSync(old.full); } catch {}
    }
    console.log(`[imagens-db] backup diário criado: ${path.basename(backupHoje)} (${arquivos.length} backups totais)`);
  } catch (e) {
    console.error('[imagens-db] backup falhou:', e.message);
  }
}

function salvar(db) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    // Backup diário ANTES de sobrescrever (preserva versão estável do dia anterior)
    rodarBackupDiarioSeNecessario();
    // Atomic write: escreve em .tmp, fsync, rename. Garante que ou tem versão antiga
    // ou versão nova — nunca arquivo corrompido pela metade.
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (e) {
    console.error('[imagens-db] erro gravando:', e.message);
  }
}

// Termos genéricos que sozinhos não definem o produto.
// Removidos da chave de normalização pra "banana 5kg" e "banana" caírem na mesma chave.
const TERMOS_GENERICOS = new Set([
  'kg', 'g', 'ml', 'l', 'lt', 'un', 'unid', 'unidade', 'pct', 'pacote',
  'caixa', 'cx', 'lata', 'garrafa', 'litro', 'litros', 'grama', 'gramas',
  'kilo', 'kilos', 'quilo', 'quilos', 'duzia', 'duzias', 'dz', 'bandeja',
  'bdj', 'sache', 'sachê', 'sch',
]);

function normalizarChave(nome) {
  if (!nome) return '';
  const limpo = nome.toString()
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Remove números, unidades genéricas e palavras curtas demais
  const tokens = limpo.split(' ').filter(t =>
    t.length > 1 &&
    !/^\d+$/.test(t) &&
    !TERMOS_GENERICOS.has(t)
  );
  return tokens.join(' ');
}

// Registra que uma imagem foi usada para um determinado nome de produto.
// Se já existir, incrementa o contador de usos. Senão, cria entrada nova.
//
// peso (default 1): incremento do contador de usos.
//   - peso 1: aprendizado passivo (encarte salvo)
//   - peso 10: swap explícito (user trocou imagem)
//   - peso 20: upload sem metadata
//   - peso 25+: upload com metadata (sinal mais forte)
//
// Pesos >= 10 ATIVAM "fresh-start mode": a nova imagem garantidamente vira o TOP
// do ranking, ignorando histórico de auto-pick (peso 1) acumulado.
// Sem isso, escolhas explícitas do user competem contra centenas de usos de
// auto-pick errado e nunca vencem (UX confusa: "escolhi essa foto 5x mas o
// sistema continua sugerindo a outra que veio errada do Bing há meses").
//
// Pesos:
//   1  - auto-pick (encarte salvo, escolha automática)
//   10 - escolha explícita no modal (✓ USAR) → vira TOP com margem PEQUENA (+5)
//   20 - upload manual do PC (📤 Subir foto minha) → vira TOP com margem GRANDE (+10)
//
// Margem diferente entre peso 10 e 20 protege uploads contra "guerra de cliques"
// (10 escolhas seguidas vão sempre se sobrepor, mas upload manual fica mais
// estável no topo).
function registrarUso(nome, url, peso = 1) {
  if (!nome || !url) return;
  const chave = normalizarChave(nome);
  if (!chave) return;
  const db = carregar();
  if (!db[chave]) db[chave] = [];
  const agora = new Date().toISOString();

  // Boost pra virar TOP: peso >= 10 (escolha do user, não auto-pick).
  // Calcula o usos MÁXIMO atual entre as OUTRAS imagens. Preserva histórico.
  let pesoEfetivo = peso;
  if (peso >= 10) {
    const existente = db[chave].find(e => e.url === url);
    const usosAtuais = existente?.usos || 0;
    const maxOutros = db[chave]
      .filter(e => e.url !== url)
      .reduce((m, e) => Math.max(m, e.usos || 0), 0);
    // Margem: upload (peso 20) = +10 confortável. Escolha (peso 10) = +5 (vence
    // mas não com tanta folga, dando chance de outra escolha sobrepor depois).
    const margem = peso >= 20 ? 10 : 5;
    const pesoMinimo = Math.max(peso, maxOutros + margem - usosAtuais);
    pesoEfetivo = pesoMinimo;
  }

  const existente = db[chave].find(e => e.url === url);
  if (existente) {
    existente.usos = (existente.usos || 0) + pesoEfetivo;
    existente.ultimoUso = agora;
  } else {
    db[chave].push({ url, usos: pesoEfetivo, primeiroUso: agora, ultimoUso: agora });
  }
  // Mantém só as 20 imagens mais usadas por produto pra evitar inflar o JSON
  db[chave].sort((a, b) => (b.usos || 0) - (a.usos || 0));
  if (db[chave].length > 20) db[chave] = db[chave].slice(0, 20);
  salvar(db);
}

// Busca imagens populares para um nome, ordenadas por número de usos (mais usado primeiro).
// Retorna até `limite` resultados. Vazio se nenhuma imagem foi registrada para esse produto.
function buscarPopulares(nome, limite = 12) {
  const chave = normalizarChave(nome);
  if (!chave) return [];
  const db = carregar();
  // Match exato primeiro
  let resultados = db[chave] || [];
  // Se não achou exato, tenta match parcial (chave do DB contém o termo do query, ou vice-versa)
  if (resultados.length === 0) {
    const tokensQuery = chave.split(' ');
    const candidatos = [];
    for (const [chaveDb, imagens] of Object.entries(db)) {
      const tokensDb = chaveDb.split(' ');
      // Considera match se ao menos UM token relevante coincide
      const interseccao = tokensQuery.filter(t => tokensDb.includes(t));
      if (interseccao.length > 0) {
        candidatos.push({ chaveDb, imagens, score: interseccao.length });
      }
    }
    candidatos.sort((a, b) => b.score - a.score);
    resultados = candidatos.flatMap(c => c.imagens);
  }
  // Ordena por usos e remove duplicatas (mesma URL pode aparecer em chaves diferentes)
  const vistas = new Set();
  return resultados
    .sort((a, b) => (b.usos || 0) - (a.usos || 0))
    .filter(e => {
      if (vistas.has(e.url)) return false;
      vistas.add(e.url);
      return true;
    })
    .slice(0, limite);
}

// Retorna a imagem MAIS popular pra um nome (atalho usado pelo buscar-lote).
function imagemMaisPopular(nome) {
  const populares = buscarPopulares(nome, 1);
  return populares.length > 0 ? populares[0] : null;
}

// Retorna estatísticas do banco (útil pra debug)
function estatisticas() {
  const db = carregar();
  const totalProdutos = Object.keys(db).length;
  let totalImagens = 0;
  let totalUsos = 0;
  for (const imagens of Object.values(db)) {
    totalImagens += imagens.length;
    totalUsos += imagens.reduce((s, i) => s + (i.usos || 0), 0);
  }
  return { totalProdutos, totalImagens, totalUsos };
}

module.exports = {
  normalizarChave,
  registrarUso,
  buscarPopulares,
  imagemMaisPopular,
  estatisticas,
};
