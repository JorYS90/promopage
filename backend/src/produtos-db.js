const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const DB_FILE = path.join(__dirname, '..', 'data', 'produtos.json');

function carregar() {
  if (!fs.existsSync(DB_FILE)) return { produtos: [] };
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Erro lendo produtos.json:', e.message);
    return { produtos: [] };
  }
}

function salvar(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalizar(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Termos genéricos que NÃO devem decidir um match (unidades, quantidades, etc.)
const TERMOS_GENERICOS = new Set([
  'kg','g','ml','l','lt','un','unid','unidade','pct','pacote','caixa','cx',
  'lata','garrafa','litro','litros','grama','gramas','kilo','quilo',
  'de','do','da','com','sem','para','por','e','o','a','os','as'
]);

function termosRelevantes(query) {
  return normalizar(query).split(/\s+/).filter(t => t && !TERMOS_GENERICOS.has(t));
}

function buscarLocal(query) {
  const db = carregar();
  if (!query) return db.produtos;
  const termos = normalizar(query).split(/\s+/).filter(Boolean);
  return db.produtos.filter(p => {
    const alvo = normalizar(`${p.nome} ${p.marca} ${p.codigoBarras}`);
    return termos.every(t => alvo.includes(t));
  });
}

// Busca com score: usa apenas termos RELEVANTES (ignora kg, ml, g, etc.)
// Bônus se TODOS os termos relevantes casarem. Retorna { produto, score } ordenado.
function buscarLocalComScore(query) {
  const db = carregar();
  const termos = termosRelevantes(query);
  if (!termos.length) return [];

  const ranked = db.produtos.map(p => {
    const alvo = normalizar(`${p.nome} ${p.marca}`);
    let score = 0;
    let casaram = 0;
    for (const t of termos) {
      if (alvo.includes(t)) { score++; casaram++; }
    }
    if (casaram === termos.length) score += 2;
    if (alvo.startsWith(termos[0])) score += 1;
    return { produto: p, score, casaram, total: termos.length };
  });

  return ranked
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function adicionar(produto) {
  const db = carregar();
  const existente = db.produtos.find(p =>
    (produto.codigoBarras && p.codigoBarras === produto.codigoBarras) ||
    (p.nome === produto.nome && p.marca === produto.marca)
  );
  if (existente) {
    Object.assign(existente, produto, { atualizadoEm: new Date().toISOString() });
    salvar(db);
    return existente;
  }
  const novo = {
    id: produto.id || nanoid(10),
    nome: produto.nome || 'Sem nome',
    marca: produto.marca || '',
    categoria: produto.categoria || 'Geral',
    codigoBarras: produto.codigoBarras || '',
    imagem: produto.imagem || '',
    preco: produto.preco || '',
    precoDe: produto.precoDe || '',
    fonte: produto.fonte || 'manual',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  db.produtos.push(novo);
  salvar(db);
  return novo;
}

function atualizar(id, dados) {
  const db = carregar();
  const idx = db.produtos.findIndex(p => p.id === id);
  if (idx < 0) return null;
  db.produtos[idx] = { ...db.produtos[idx], ...dados, atualizadoEm: new Date().toISOString() };
  salvar(db);
  return db.produtos[idx];
}

function remover(id) {
  const db = carregar();
  db.produtos = db.produtos.filter(p => p.id !== id);
  salvar(db);
}

function obter(id) {
  const db = carregar();
  return db.produtos.find(p => p.id === id);
}

module.exports = { carregar, buscarLocal, buscarLocalComScore, adicionar, atualizar, remover, obter };
