// Projetos (encartes salvos) por usuário — SQLite com user_id FK.
// Migrado de projetos/*.json (compartilhados) em 2026-05-19.
//
// Campos complexos (configs e produtos) são objetos arbitrários grandes,
// serializados como JSON dentro de TEXT. Não usamos JSON1 do SQLite porque
// não precisamos consultar por campos internos.

const { nanoid } = require('nanoid');
const db = require('./db/schema');

function rowParaProjeto(r) {
  if (!r) return null;
  let configs = {};
  let produtos = [];
  try { configs = JSON.parse(r.configs || '{}'); } catch {}
  try { produtos = JSON.parse(r.produtos || '[]'); } catch {}
  return {
    id: r.id,
    nome: r.nome,
    categoria: r.categoria,
    observacoes: r.observacoes,
    tema: r.tema,
    configs,
    produtos,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    userId: r.user_id,
  };
}

// ---------- Reads ----------

/**
 * Lista metadata dos projetos do user (sem configs/produtos completos).
 * Admin com userId=null lista de todos.
 */
function listar(userId) {
  const stmt = userId
    ? db.prepare(`
        SELECT id, user_id, nome, categoria, tema,
               json_array_length(produtos) as qtd_produtos,
               criado_em, atualizado_em
        FROM projetos WHERE user_id = ?
        ORDER BY atualizado_em DESC
      `)
    : db.prepare(`
        SELECT id, user_id, nome, categoria, tema,
               json_array_length(produtos) as qtd_produtos,
               criado_em, atualizado_em
        FROM projetos
        ORDER BY atualizado_em DESC
      `);
  const rows = userId ? stmt.all(userId) : stmt.all();
  return rows.map(r => ({
    id: r.id,
    nome: r.nome || 'Sem nome',
    categoria: r.categoria || '',
    tema: r.tema || null,
    qtdProdutos: r.qtd_produtos || 0,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    userId: r.user_id,
  }));
}

function obter(id, userId) {
  const stmt = userId
    ? db.prepare('SELECT * FROM projetos WHERE id = ? AND user_id = ?')
    : db.prepare('SELECT * FROM projetos WHERE id = ?');
  const row = userId ? stmt.get(id, userId) : stmt.get(id);
  return rowParaProjeto(row);
}

// ---------- Writes ----------

/**
 * Salva projeto. Se id existir e pertencer ao user (ou admin estiver salvando),
 * atualiza. Senão cria novo.
 * Retorna { id, criado: bool, projeto }.
 */
function salvar(id, data, userId) {
  if (!userId) throw new Error('userId obrigatório pra salvar projeto');
  const projId = id || nanoid(10);
  const existente = obter(projId, userId);
  const agora = new Date().toISOString();

  // Tema pode vir como objeto ou string — normaliza pra id (string)
  const temaId = typeof data.tema === 'string' ? data.tema : (data.tema?.id || null);

  // produtos antigos pra aprendizado passivo (caller usa)
  const produtosAntigos = existente?.produtos || [];

  if (existente) {
    db.prepare(`
      UPDATE projetos SET
        nome = ?, categoria = ?, observacoes = ?, tema = ?,
        configs = ?, produtos = ?, atualizado_em = ?
      WHERE id = ? AND user_id = ?
    `).run(
      data.nome || existente.nome,
      data.categoria ?? existente.categoria,
      data.observacoes ?? existente.observacoes,
      temaId,
      JSON.stringify(data.configs || existente.configs || {}),
      JSON.stringify(data.produtos || existente.produtos || []),
      agora,
      projId, existente.userId, // usa userId do dono real (caso admin esteja salvando alheio)
    );
    return { id: projId, criado: false, projeto: obter(projId, null), produtosAntigos };
  }

  db.prepare(`
    INSERT INTO projetos (id, user_id, nome, categoria, observacoes, tema,
      configs, produtos, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projId, userId,
    data.nome || 'Sem nome',
    data.categoria || '',
    data.observacoes || '',
    temaId,
    JSON.stringify(data.configs || {}),
    JSON.stringify(data.produtos || []),
    agora, agora,
  );
  return { id: projId, criado: true, projeto: obter(projId, null), produtosAntigos: [] };
}

function remover(id, userId) {
  if (!userId) throw new Error('userId obrigatório');
  const r = db.prepare('DELETE FROM projetos WHERE id = ? AND user_id = ?').run(id, userId);
  return r.changes > 0;
}

module.exports = { listar, obter, salvar, remover };
