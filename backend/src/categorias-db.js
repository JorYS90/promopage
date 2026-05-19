// Categorias de temas — padrão (sistema, global, hardcoded) + customizadas (por user, SQLite).
//
// Migrado de categorias.json (compartilhado) em 2026-05-19.
// Categorias `padrao: true` são as do sistema (lista hardcoded abaixo).
// Categorias custom (criadas via API) ficam na tabela categorias_custom com
// user_id FK — cada user vê só as próprias custom + todas as padrão.
//
// Admin com userId=null vê padrão + custom de todo mundo.

const db = require('./db/schema');

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

const padraoComoObj = () =>
  PADRAO.map(nome => ({ nome, padrao: true, criadoEm: null, userId: null }));

function listar(userId) {
  const padroes = padraoComoObj();
  const stmt = userId
    ? db.prepare('SELECT nome, criado_em, user_id FROM categorias_custom WHERE user_id = ? ORDER BY nome')
    : db.prepare('SELECT nome, criado_em, user_id FROM categorias_custom ORDER BY user_id, nome');
  const customRows = userId ? stmt.all(userId) : stmt.all();
  const customs = customRows.map(r => ({
    nome: r.nome,
    padrao: false,
    criadoEm: r.criado_em,
    userId: r.user_id,
  }));
  // Junta padrão + custom, deduplicando por nome (caso-insensitivo).
  // Se user criou custom com mesmo nome que padrão, padrão ganha.
  const vistas = new Set(padroes.map(c => c.nome.toLowerCase()));
  const filtradas = customs.filter(c => !vistas.has(c.nome.toLowerCase()));
  return [...padroes, ...filtradas];
}

function adicionar(nome, userId) {
  if (!userId) throw new Error('userId obrigatório pra adicionar categoria custom');
  const limpo = (nome || '').toString().trim();
  if (!limpo) throw new Error('Nome da categoria é obrigatório');
  if (limpo.length > 60) throw new Error('Nome muito longo (máx 60 caracteres)');

  // Se já é padrão (caso-insensitivo), retorna a padrão sem criar custom duplicada.
  const ehPadrao = PADRAO.some(p => p.toLowerCase() === limpo.toLowerCase());
  if (ehPadrao) {
    return { nome: PADRAO.find(p => p.toLowerCase() === limpo.toLowerCase()), padrao: true };
  }

  // Insere se não existir (UNIQUE constraint user_id+nome trata duplicata).
  try {
    db.prepare(`
      INSERT INTO categorias_custom (user_id, nome, criado_em)
      VALUES (?, ?, ?)
    `).run(userId, limpo, new Date().toISOString());
  } catch (e) {
    // Provável conflito UNIQUE — user já tem essa categoria
    if (!/UNIQUE/i.test(e.message)) throw e;
  }
  return { nome: limpo, padrao: false, userId };
}

function remover(nome, userId) {
  if (!userId) throw new Error('userId obrigatório pra remover categoria custom');
  // Padrão não pode ser removida (são do sistema)
  if (PADRAO.some(p => p.toLowerCase() === (nome || '').toLowerCase())) {
    return false;
  }
  const r = db.prepare(`
    DELETE FROM categorias_custom WHERE user_id = ? AND lower(nome) = lower(?)
  `).run(userId, nome || '');
  return r.changes > 0;
}

module.exports = { listar, adicionar, remover };
