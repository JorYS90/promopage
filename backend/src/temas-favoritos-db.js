// Temas favoritados pelo usuário (heart icon nos cards de tema).
//
// tema_id é o slug do template (filesystem-based, ex: "ofertas-relampago"),
// não tem FK pra tabela templates porque os templates vivem em arquivos JSON.
// O frontend valida que o slug existe antes de favoritar.
//
// Padrões: mirror de categorias-db.js / produtos-db.js — userId obrigatório
// pra mutations, userId=null no listar permite admin ver todos.

const db = require('./db/schema');

// Lista IDs dos temas favoritados pelo user (apenas IDs, ordenados por mais
// recente primeiro). Retorna array de strings.
function listar(userId) {
  if (!userId) {
    // Admin/sem user: retorna lista vazia (favoritos são sempre per-user).
    // Pra debug global, query direto no SQLite.
    return [];
  }
  const rows = db
    .prepare('SELECT tema_id FROM temas_favoritos WHERE user_id = ? ORDER BY criado_em DESC')
    .all(userId);
  return rows.map(r => r.tema_id);
}

// Adiciona um tema aos favoritos. Idempotente — se já existe, retorna sem
// erro (UNIQUE constraint trata duplicata).
function adicionar(temaId, userId) {
  if (!userId) throw new Error('userId obrigatório pra favoritar tema');
  const id = (temaId || '').toString().trim();
  if (!id) throw new Error('temaId é obrigatório');
  if (id.length > 200) throw new Error('temaId muito longo');

  try {
    db.prepare(
      'INSERT INTO temas_favoritos (user_id, tema_id, criado_em) VALUES (?, ?, ?)'
    ).run(userId, id, new Date().toISOString());
    return { adicionado: true, temaId: id };
  } catch (e) {
    // UNIQUE constraint violado = já era favorito. Sucesso silencioso.
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { adicionado: false, temaId: id, jaExistia: true };
    }
    throw e;
  }
}

// Remove um tema dos favoritos. Idempotente — não erra se não existir.
function remover(temaId, userId) {
  if (!userId) throw new Error('userId obrigatório pra desfavoritar tema');
  const id = (temaId || '').toString().trim();
  if (!id) throw new Error('temaId é obrigatório');

  const result = db
    .prepare('DELETE FROM temas_favoritos WHERE user_id = ? AND tema_id = ?')
    .run(userId, id);
  return { removido: result.changes > 0, temaId: id };
}

// Conta quantos favoritos o user tem (pra mostrar no menu/badge).
function contar(userId) {
  if (!userId) return 0;
  const row = db
    .prepare('SELECT COUNT(*) as total FROM temas_favoritos WHERE user_id = ?')
    .get(userId);
  return row?.total || 0;
}

module.exports = { listar, adicionar, remover, contar };
