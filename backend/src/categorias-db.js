// Banco de categorias de temas. Permite ao admin criar/remover categorias
// que aparecem como agrupamento nos cards de temas.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'categorias.json');

// Categorias padrão criadas se o arquivo não existir
const PADRAO = [
  'Temas Grátis',
  'Datas Comemorativas',
  'Açougue',
  'Hortifruti',
  'Bebidas',
  'Padaria',
  'Mercearia',
  'Limpeza',
  'Sazonais',
  'Meus Temas',
];

function carregar() {
  if (!fs.existsSync(DB_FILE)) {
    const inicial = PADRAO.map(nome => ({ nome, criadoEm: new Date().toISOString(), padrao: true }));
    salvar(inicial);
    return inicial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('[categorias-db] erro lendo:', e.message);
    return [];
  }
}

function salvar(lista) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(lista, null, 2), 'utf8');
  } catch (e) {
    console.error('[categorias-db] erro gravando:', e.message);
  }
}

function listar() {
  return carregar();
}

function adicionar(nome) {
  const limpo = (nome || '').toString().trim();
  if (!limpo) throw new Error('Nome da categoria é obrigatório');
  if (limpo.length > 60) throw new Error('Nome muito longo (máx 60 caracteres)');
  const lista = carregar();
  // Caso-insensitivo: evita "Bebidas" e "bebidas" como duplicatas
  const ja = lista.find(c => c.nome.toLowerCase() === limpo.toLowerCase());
  if (ja) return ja;
  const nova = { nome: limpo, criadoEm: new Date().toISOString(), padrao: false };
  lista.push(nova);
  salvar(lista);
  return nova;
}

function remover(nome) {
  const lista = carregar();
  const idx = lista.findIndex(c => c.nome.toLowerCase() === (nome || '').toLowerCase());
  if (idx < 0) return false;
  lista.splice(idx, 1);
  salvar(lista);
  return true;
}

module.exports = { listar, adicionar, remover };
