// Catálogo de produtos por usuário (isolamento garantido pelo SQLite + user_id).
//
// Migrado de produtos.json (compartilhado entre todos) pra SQLite em 2026-05-19.
// Cada função aceita `userId` — quando null/undefined, retorna dados de TODOS
// os users (uso restrito a admin/super_admin pra suporte).
//
// API mantida o mais próximo possível da versão JSON pra reduzir impacto nos
// callers. Diferença: userId é parâmetro obrigatório na maioria.

const { nanoid } = require('nanoid');
const db = require('./db/schema');

// ---------- Normalização (mesma lógica do banco antigo) ----------
function normalizar(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const TERMOS_GENERICOS = new Set([
  'kg','g','ml','l','lt','un','unid','unidade','pct','pacote','caixa','cx',
  'lata','garrafa','litro','litros','grama','gramas','kilo','quilo',
  'de','do','da','com','sem','para','por','e','o','a','os','as'
]);

function termosRelevantes(query) {
  return normalizar(query).split(/\s+/).filter(t => t && !TERMOS_GENERICOS.has(t));
}

// ---------- Helper: mapear row SQL → objeto JS no formato esperado pelo app ----------
function rowParaProduto(r) {
  if (!r) return null;
  return {
    id: r.id,
    nome: r.nome,
    marca: r.marca,
    categoria: r.categoria,
    codigoBarras: r.codigo_barras,
    imagem: r.imagem,
    preco: r.preco,
    precoDe: r.preco_de,
    fonte: r.fonte,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    userId: r.user_id,
  };
}

// ---------- Reads ----------

/**
 * Lista todos os produtos do usuário. Se userId for null/undefined, retorna
 * TODOS (admin only — endpoint controla quem chama com null).
 */
function carregar(userId) {
  const stmt = userId
    ? db.prepare('SELECT * FROM produtos WHERE user_id = ? ORDER BY atualizado_em DESC')
    : db.prepare('SELECT * FROM produtos ORDER BY user_id, atualizado_em DESC');
  const rows = userId ? stmt.all(userId) : stmt.all();
  return { produtos: rows.map(rowParaProduto) };
}

function obter(id, userId) {
  // Se userId fornecido, restringe ao dono. Senão (admin), retorna qualquer.
  const stmt = userId
    ? db.prepare('SELECT * FROM produtos WHERE id = ? AND user_id = ?')
    : db.prepare('SELECT * FROM produtos WHERE id = ?');
  const row = userId ? stmt.get(id, userId) : stmt.get(id);
  return rowParaProduto(row);
}

function buscarLocal(query, userId) {
  // Filtro de busca: substring em nome+marca+codbarras. Mantém compatibilidade
  // com o uso antigo (filter em JS sobre o array).
  if (!query) return carregar(userId).produtos;
  const termos = normalizar(query).split(/\s+/).filter(Boolean);
  const todos = carregar(userId).produtos;
  return todos.filter(p => {
    const alvo = normalizar(`${p.nome} ${p.marca} ${p.codigoBarras}`);
    return termos.every(t => alvo.includes(t));
  });
}

function buscarLocalComScore(query, userId) {
  const termos = termosRelevantes(query);
  if (!termos.length) return [];
  const todos = carregar(userId).produtos;
  const ranked = todos.map(p => {
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
  return ranked.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
}

// ---------- Writes ----------

/**
 * Adiciona (ou atualiza se duplicado) produto pra um user específico.
 * Dedup: mesmo user com (codigoBarras igual) OU (nome+marca igual) = update.
 */
function adicionar(produto, userId) {
  if (!userId) throw new Error('userId obrigatório pra adicionar produto');

  // Procura existente do MESMO user
  const existente = db.prepare(`
    SELECT * FROM produtos
    WHERE user_id = ?
      AND (
        (? != '' AND codigo_barras = ?)
        OR (nome = ? AND marca = ?)
      )
    LIMIT 1
  `).get(userId, produto.codigoBarras || '', produto.codigoBarras || '',
         produto.nome, produto.marca || '');

  const agora = new Date().toISOString();

  if (existente) {
    db.prepare(`
      UPDATE produtos SET
        nome=?, marca=?, categoria=?, codigo_barras=?, imagem=?,
        preco=?, preco_de=?, fonte=?, atualizado_em=?
      WHERE id=?
    `).run(
      produto.nome ?? existente.nome,
      produto.marca ?? existente.marca,
      produto.categoria ?? existente.categoria,
      produto.codigoBarras ?? existente.codigo_barras,
      produto.imagem ?? existente.imagem,
      produto.preco ?? existente.preco,
      produto.precoDe ?? existente.preco_de,
      produto.fonte ?? existente.fonte,
      agora,
      existente.id,
    );
    return obter(existente.id, userId);
  }

  const id = produto.id || nanoid(10);
  db.prepare(`
    INSERT INTO produtos (id, user_id, nome, marca, categoria, codigo_barras,
      imagem, preco, preco_de, fonte, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId,
    produto.nome || 'Sem nome',
    produto.marca || '',
    produto.categoria || 'Geral',
    produto.codigoBarras || '',
    produto.imagem || '',
    produto.preco || '',
    produto.precoDe || '',
    produto.fonte || 'manual',
    agora, agora,
  );
  return obter(id, userId);
}

function atualizar(id, dados, userId) {
  if (!userId) throw new Error('userId obrigatório pra atualizar produto');
  const atual = obter(id, userId);
  if (!atual) return null;

  // Merge: dados sobrescreve atual, mantém id e userId
  const merged = { ...atual, ...dados };
  const agora = new Date().toISOString();
  db.prepare(`
    UPDATE produtos SET
      nome=?, marca=?, categoria=?, codigo_barras=?, imagem=?,
      preco=?, preco_de=?, fonte=?, atualizado_em=?
    WHERE id=? AND user_id=?
  `).run(
    merged.nome, merged.marca, merged.categoria, merged.codigoBarras,
    merged.imagem, merged.preco, merged.precoDe, merged.fonte, agora,
    id, userId,
  );
  return obter(id, userId);
}

function remover(id, userId) {
  if (!userId) throw new Error('userId obrigatório pra remover produto');
  const r = db.prepare('DELETE FROM produtos WHERE id = ? AND user_id = ?').run(id, userId);
  return r.changes > 0;
}

module.exports = {
  carregar, buscarLocal, buscarLocalComScore, adicionar, atualizar, remover, obter,
};
