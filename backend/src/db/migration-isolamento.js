// Migration one-shot: produtos/projetos/categorias custom dos arquivos JSON
// (compartilhados entre todos os users — bug histórico de privacidade)
// pras tabelas SQLite com user_id FK.
//
// Estratégia:
//   - Todos os dados existentes são atribuídos ao user_id=1 (assume guadagnin
//     super_admin, conforme decisão do owner). Outros users começam zerados.
//   - Arquivos JSON ORIGINAIS são PRESERVADOS (renomeados pra .migrated)
//     pra rollback manual se algo der errado.
//   - Idempotente: marca como concluído em /app/data/.migration-isolamento-done.
//     Se a flag existir, skip total.
//   - Roda no startup do server.js, ANTES de aceitar conexões.

const fs = require('fs');
const path = require('path');
const db = require('./schema');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PROJETOS_DIR = path.join(__dirname, '..', '..', 'projetos');
const FLAG_FILE = path.join(DATA_DIR, '.migration-isolamento-done');
const PRODUTOS_FILE = path.join(DATA_DIR, 'produtos.json');
const CATEGORIAS_FILE = path.join(DATA_DIR, 'categorias.json');

const OWNER_LEGADO = 1; // user_id do super_admin (guadagnin)

function jaConcluida() {
  return fs.existsSync(FLAG_FILE);
}

function marcarConcluida(resumo) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FLAG_FILE, JSON.stringify({
      concluidaEm: new Date().toISOString(),
      ...resumo,
    }, null, 2));
  } catch (e) {
    console.error('[migration-isolamento] falha ao gravar flag:', e.message);
  }
}

function migrarProdutos() {
  if (!fs.existsSync(PRODUTOS_FILE)) return { total: 0, motivo: 'arquivo-inexistente' };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(PRODUTOS_FILE, 'utf8')); }
  catch (e) { return { total: 0, erro: 'JSON inválido: ' + e.message }; }
  const lista = Array.isArray(raw?.produtos) ? raw.produtos : [];
  if (lista.length === 0) return { total: 0 };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO produtos (id, user_id, nome, marca, categoria, codigo_barras,
      imagem, preco, preco_de, fonte, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((items) => {
    let count = 0;
    for (const p of items) {
      if (!p?.id || !p?.nome) continue;
      insert.run(
        p.id, OWNER_LEGADO, p.nome, p.marca || '', p.categoria || 'Geral',
        p.codigoBarras || '', p.imagem || '', p.preco || '', p.precoDe || '',
        p.fonte || 'manual',
        p.criadoEm || new Date().toISOString(),
        p.atualizadoEm || p.criadoEm || new Date().toISOString(),
      );
      count++;
    }
    return count;
  });
  const migrados = tx(lista);

  // Preserva o JSON original como backup (rollback manual)
  try { fs.renameSync(PRODUTOS_FILE, PRODUTOS_FILE + '.migrated'); } catch {}
  return { total: lista.length, migrados };
}

function migrarProjetos() {
  if (!fs.existsSync(PROJETOS_DIR)) return { total: 0, motivo: 'pasta-inexistente' };
  const arquivos = fs.readdirSync(PROJETOS_DIR).filter(f => f.endsWith('.json'));
  if (arquivos.length === 0) return { total: 0 };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO projetos (id, user_id, nome, categoria, observacoes, tema,
      configs, produtos, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((arqs) => {
    let count = 0;
    for (const arq of arqs) {
      let json;
      try { json = JSON.parse(fs.readFileSync(path.join(PROJETOS_DIR, arq), 'utf8')); }
      catch { continue; }
      const id = path.basename(arq, '.json');
      // Tema pode vir como { id: "..." } ou string direta. Normaliza.
      const temaId = typeof json.tema === 'string' ? json.tema : (json.tema?.id || null);
      // configs e produtos são objetos complexos — serializamos como JSON string
      const configs = JSON.stringify(json.configs || {});
      const produtos = JSON.stringify(json.produtos || []);
      insert.run(
        id, OWNER_LEGADO,
        json.nome || '',
        json.categoria || '',
        json.observacoes || '',
        temaId,
        configs, produtos,
        json.criadoEm || new Date().toISOString(),
        json.atualizadoEm || json.criadoEm || new Date().toISOString(),
      );
      count++;
    }
    return count;
  });
  const migrados = tx(arquivos);

  // Renomeia arquivos pra .migrated (preserva conteúdo, mas backend não lê mais)
  for (const arq of arquivos) {
    try {
      fs.renameSync(path.join(PROJETOS_DIR, arq), path.join(PROJETOS_DIR, arq + '.migrated'));
    } catch {}
  }
  return { total: arquivos.length, migrados };
}

function migrarCategoriasCustom() {
  if (!fs.existsSync(CATEGORIAS_FILE)) return { total: 0, motivo: 'arquivo-inexistente' };
  let lista;
  try { lista = JSON.parse(fs.readFileSync(CATEGORIAS_FILE, 'utf8')); }
  catch { return { total: 0, erro: 'JSON inválido' }; }
  if (!Array.isArray(lista)) return { total: 0, erro: 'esperado array' };

  // Categorias com padrao:true são do sistema (seed) — NÃO migra. Só custom.
  const custom = lista.filter(c => c?.nome && !c.padrao);
  if (custom.length === 0) return { total: 0, motivo: 'só categorias padrão' };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO categorias_custom (user_id, nome, criado_em)
    VALUES (?, ?, ?)
  `);
  const tx = db.transaction((items) => {
    let count = 0;
    for (const c of items) {
      insert.run(OWNER_LEGADO, c.nome, c.criadoEm || new Date().toISOString());
      count++;
    }
    return count;
  });
  const migrados = tx(custom);

  // Renomeia pra .migrated
  try { fs.renameSync(CATEGORIAS_FILE, CATEGORIAS_FILE + '.migrated'); } catch {}
  return { total: custom.length, migrados, ignoradas_padrao: lista.length - custom.length };
}

function rodar() {
  if (jaConcluida()) {
    console.log('[migration-isolamento] já concluída anteriormente, skip');
    return;
  }
  console.log('[migration-isolamento] iniciando — atribuindo dados legados ao user_id=' + OWNER_LEGADO);

  // Garante que o user_id=1 existe (super_admin). Se não, skip a migration
  // (não tem destino válido).
  const owner = db.prepare('SELECT id, email FROM users WHERE id = ?').get(OWNER_LEGADO);
  if (!owner) {
    console.warn('[migration-isolamento] user_id=' + OWNER_LEGADO + ' não existe ainda. Skip — vai rodar na próxima inicialização após cadastrar.');
    return;
  }
  console.log('[migration-isolamento] owner legado: id=' + owner.id + ' email=' + owner.email);

  const resumo = {
    produtos: migrarProdutos(),
    projetos: migrarProjetos(),
    categorias: migrarCategoriasCustom(),
  };
  console.log('[migration-isolamento] resumo:', JSON.stringify(resumo, null, 2));

  marcarConcluida(resumo);
  console.log('[migration-isolamento] concluída — flag gravada em', FLAG_FILE);
}

module.exports = { rodar };
