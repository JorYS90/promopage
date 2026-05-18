// Cache persistente de buscas de imagens externas em SQLite.
//
// Fluxo no endpoint de busca:
//   1. cacheGet(query) → se hit válido, retorna direto (sub-ms)
//   2. miss → executa pipeline Bing/OFF/Wikimedia normal
//   3. cacheSet(query, resultado) → salva pra próximas requisições
//
// TTLs diferenciados:
//   - Hits (achou imagem real): 30 dias — produto mudar de URL é raro
//   - Placeholder (nada achou): 1 dia — pode aparecer em fontes externas depois

const db = require('./schema');

const TTL_DIAS_HIT = 30;
const TTL_DIAS_MISS = 1;

function normalizar(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // colapsa espaços múltiplos
}

function diasAFrente(dias) {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Busca no cache. Retorna { imagem, codigo_barras, fonte } ou null.
 * Auto-deleta entrada expirada (lazy cleanup).
 */
function cacheGet(query) {
  const q = normalizar(query);
  if (!q) return null;

  const row = db.prepare(`
    SELECT imagem, codigo_barras, fonte, expira_em
    FROM cache_busca_imagens
    WHERE query_normalizada = ?
  `).get(q);

  if (!row) return null;

  // Expirado: deleta sob demanda e retorna miss
  if (new Date(row.expira_em) < new Date()) {
    db.prepare('DELETE FROM cache_busca_imagens WHERE query_normalizada = ?').run(q);
    return null;
  }

  return {
    imagem: row.imagem,
    codigoBarras: row.codigo_barras || '',
    fonte: row.fonte,
  };
}

/**
 * Salva no cache. Sobrescreve entrada existente (REPLACE).
 * Auto-detecta se é placeholder e usa TTL menor.
 */
function cacheSet(query, { imagem, codigoBarras = '', fonte }) {
  const q = normalizar(query);
  if (!q || !imagem || !fonte) return;

  const isPlaceholder = fonte === 'placeholder';
  const ttl = isPlaceholder ? TTL_DIAS_MISS : TTL_DIAS_HIT;

  db.prepare(`
    INSERT OR REPLACE INTO cache_busca_imagens
      (query_normalizada, imagem, codigo_barras, fonte, criado_em, expira_em)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(q, imagem, codigoBarras || null, fonte, new Date().toISOString(), diasAFrente(ttl));
}

/**
 * Invalida (deleta) uma entrada — usado quando user troca a imagem manualmente,
 * pra próxima busca não retornar a imagem antiga do cache.
 */
function cacheInvalidate(query) {
  const q = normalizar(query);
  if (!q) return 0;
  return db.prepare('DELETE FROM cache_busca_imagens WHERE query_normalizada = ?').run(q).changes;
}

/**
 * Stats — pra monitorar tamanho do cache e hit rate (manual via admin endpoint).
 */
function cacheStats() {
  const total = db.prepare('SELECT COUNT(*) as c FROM cache_busca_imagens').get().c;
  const expirados = db.prepare(`
    SELECT COUNT(*) as c FROM cache_busca_imagens WHERE expira_em < ?
  `).get(new Date().toISOString()).c;
  const porFonte = db.prepare(`
    SELECT fonte, COUNT(*) as c FROM cache_busca_imagens
    GROUP BY fonte ORDER BY c DESC
  `).all();
  return { total, expirados, validos: total - expirados, porFonte };
}

/**
 * Cleanup batch — deleta todos os expirados de uma vez.
 * Pode ser chamado periodicamente (cron) ou manualmente via admin.
 */
function cacheCleanup() {
  const r = db.prepare('DELETE FROM cache_busca_imagens WHERE expira_em < ?')
    .run(new Date().toISOString());
  return r.changes;
}

module.exports = { cacheGet, cacheSet, cacheInvalidate, cacheStats, cacheCleanup, normalizar };
