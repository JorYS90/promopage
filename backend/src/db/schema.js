// Schema do banco SQLite — tabelas pra auth, usuários, planos, assinaturas, logs.
// Roda automaticamente na inicialização (idempotente: só cria se não existir).
//
// Por que SQLite e não Postgres? Em dev, SQLite = zero setup, arquivo único, migra
// fácil. Quando for pra produção, troca o driver pra Postgres (Prisma ou pg)
// e mantém o mesmo schema (compatível 90%).
//
// Estrutura:
//   users         — conta do usuário (com cpf/cnpj, telefone, empresa)
//   roles         — super_admin, admin, moderador, cliente
//   plans         — Básico, Profissional, Premium (limites + preços)
//   subscriptions — assinatura ATIVA do usuário (1 por user)
//   payments      — histórico de pagamentos (cada cobrança)
//   sessions      — refresh tokens (1 por device, revogáveis)
//   password_resets — tokens de "esqueci senha"
//   audit_logs    — histórico de ações sensíveis (admin, pagamento, login)

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'saas.db');

// Garante que a pasta existe
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');     // melhor pra concorrência
db.pragma('foreign_keys = ON');      // ativa FK enforcement

// === Tabelas ===
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL,
    descricao TEXT,
    permissoes TEXT NOT NULL DEFAULT '[]'  -- JSON array de strings tipo "users:create"
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    empresa TEXT,
    telefone TEXT,
    documento TEXT,                     -- CPF ou CNPJ
    role_id INTEGER NOT NULL DEFAULT 4, -- 4 = cliente (default)
    email_verificado INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1,   -- 0 = suspenso
    motivo_suspensao TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_ativo ON users(ativo);

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,            -- "basico", "pro", "premium"
    nome TEXT NOT NULL,
    descricao TEXT,
    preco_mensal_centavos INTEGER NOT NULL,
    preco_anual_centavos INTEGER NOT NULL,
    limites TEXT NOT NULL DEFAULT '{}',   -- JSON: {"encartesPorMes":10,"templatesProprios":3}
    recursos TEXT NOT NULL DEFAULT '[]',  -- JSON array de strings tipo "pdf_export"
    stripe_price_id_mensal TEXT,
    stripe_price_id_anual TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    status TEXT NOT NULL,                  -- 'trial','ativo','pendente','cancelado','expirado','suspenso'
    ciclo TEXT NOT NULL DEFAULT 'mensal',  -- 'mensal' ou 'anual'
    inicio TEXT NOT NULL,
    vencimento TEXT NOT NULL,
    cancelada_em TEXT,
    motivo_cancelamento TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
  );

  CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
  CREATE INDEX IF NOT EXISTS idx_subs_venc ON subscriptions(vencimento);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    valor_centavos INTEGER NOT NULL,
    moeda TEXT NOT NULL DEFAULT 'BRL',
    metodo TEXT NOT NULL,                 -- 'stripe_card','pix','boleto','mp_card'
    status TEXT NOT NULL,                 -- 'pendente','pago','falhou','reembolsado','cancelado'
    gateway TEXT NOT NULL,                -- 'stripe','mercado_pago'
    gateway_payment_id TEXT,              -- ID do pagamento no gateway
    gateway_invoice_id TEXT,
    metadata TEXT DEFAULT '{}',           -- JSON livre (último 4 dígitos, parcelas, etc.)
    pago_em TEXT,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                  -- nanoid usado como JTI do refresh token
    user_id INTEGER NOT NULL,
    refresh_token_hash TEXT NOT NULL,     -- hash do refresh token (sha256)
    user_agent TEXT,
    ip TEXT,
    expira_em TEXT NOT NULL,
    revogada_em TEXT,
    criada_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,          -- sha256 do token enviado por email
    user_id INTEGER NOT NULL,
    expira_em TEXT NOT NULL,
    usado_em TEXT,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expira_em TEXT NOT NULL,
    usado_em TEXT,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                      -- nullable: ações de webhook não têm user logado
    actor_id INTEGER,                     -- quem executou (admin, sistema, etc.)
    acao TEXT NOT NULL,                   -- 'user.created','plan.changed','payment.received'
    recurso TEXT,                         -- 'user:42', 'subscription:7'
    dados TEXT DEFAULT '{}',              -- JSON com contexto
    ip TEXT,
    user_agent TEXT,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_logs(acao);
  CREATE INDEX IF NOT EXISTS idx_audit_criado ON audit_logs(criado_em);

  CREATE TABLE IF NOT EXISTS rate_limits (
    chave TEXT PRIMARY KEY,                -- ex: "login:email@x.com" ou "signup:ip"
    tentativas INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TEXT,
    atualizado_em TEXT NOT NULL
  );

  -- Cache persistente de buscas de imagens externas (Bing, OFF, Wikimedia).
  -- Evita repetir scraping/HTTP em fontes externas pra produtos já consultados.
  -- TTL gerenciado pelo módulo cache-imagens.js (hit/placeholder = TTLs diferentes).
  CREATE TABLE IF NOT EXISTS cache_busca_imagens (
    query_normalizada TEXT PRIMARY KEY,    -- lowercase, trim, espaços colapsados
    imagem TEXT NOT NULL,                  -- URL externa OU path local /uploads/...
    codigo_barras TEXT,                    -- só preenchido se fonte = openfoodfacts
    fonte TEXT NOT NULL,                   -- 'bing','openfoodfacts','wikimedia','placeholder','populares','local'
    criado_em TEXT NOT NULL,
    expira_em TEXT NOT NULL                -- ISO date — após isso é considerado miss
  );
  CREATE INDEX IF NOT EXISTS idx_cache_busca_expira ON cache_busca_imagens(expira_em);

  -- ============================================================================
  -- ISOLAMENTO POR USUÁRIO (introduzido 2026-05-19)
  -- ============================================================================
  -- Até então produtos/projetos/categorias eram arquivos JSON COMPARTILHADOS
  -- entre todos os users (bug de privacidade: Bruno via dados do jaopaulinho).
  -- Migrado pra SQLite com user_id FK + ON DELETE CASCADE (deletar user limpa
  -- catálogo dele). Admin/super_admin enxerga tudo via filtro do endpoint.

  -- Produtos cadastrados (catálogo pessoal do lojista)
  CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY,                -- nanoid(10), gerado no app
    user_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    marca TEXT NOT NULL DEFAULT '',
    categoria TEXT NOT NULL DEFAULT 'Geral',
    codigo_barras TEXT NOT NULL DEFAULT '',
    imagem TEXT NOT NULL DEFAULT '',
    preco TEXT NOT NULL DEFAULT '',
    preco_de TEXT NOT NULL DEFAULT '',
    fonte TEXT NOT NULL DEFAULT 'manual',
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_produtos_user ON produtos(user_id);
  CREATE INDEX IF NOT EXISTS idx_produtos_codbarras ON produtos(user_id, codigo_barras)
    WHERE codigo_barras != '';

  -- Projetos / encartes salvos
  CREATE TABLE IF NOT EXISTS projetos (
    id TEXT PRIMARY KEY,                -- nanoid(10), preservado do nome do JSON antigo
    user_id INTEGER NOT NULL,
    nome TEXT NOT NULL DEFAULT '',
    categoria TEXT NOT NULL DEFAULT '',
    observacoes TEXT NOT NULL DEFAULT '',
    tema TEXT,                          -- id do template usado
    configs TEXT NOT NULL DEFAULT '{}', -- JSON serializado (settings do canvas)
    produtos TEXT NOT NULL DEFAULT '[]',-- JSON serializado (lista de produtos)
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_projetos_user ON projetos(user_id);
  CREATE INDEX IF NOT EXISTS idx_projetos_user_atualizado ON projetos(user_id, atualizado_em);

  -- Categorias customizadas por usuário (além das padrão do app)
  CREATE TABLE IF NOT EXISTS categorias_custom (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, nome)               -- mesmo user não cria 2 categorias iguais
  );
  CREATE INDEX IF NOT EXISTS idx_categorias_custom_user ON categorias_custom(user_id);

  -- Temas favoritados pelo usuário. tema_id é o slug do template (filesystem-based,
  -- ex: "ofertas-relampago"). Sem FK pra templates porque eles vivem no disco, não
  -- no DB. UNIQUE evita o mesmo user favoritar duas vezes o mesmo tema.
  CREATE TABLE IF NOT EXISTS temas_favoritos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tema_id TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, tema_id)
  );
  CREATE INDEX IF NOT EXISTS idx_temas_favoritos_user ON temas_favoritos(user_id);
`);

// === Migração idempotente: adiciona colunas novas em tabelas existentes ===
// SQLite não tem "ALTER TABLE IF NOT EXISTS COLUMN", então checamos via PRAGMA.
function adicionarColunaSeNecessario(tabela, coluna, definicao) {
  const cols = db.prepare(`PRAGMA table_info(${tabela})`).all();
  if (!cols.some(c => c.name === coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    console.log(`[db] migração: coluna ${tabela}.${coluna} adicionada`);
  }
}
adicionarColunaSeNecessario('users', 'interesses', "TEXT NOT NULL DEFAULT '[]'");

// === Seed inicial — só roda se as tabelas estiverem vazias ===
function seedInicial() {
  const agora = new Date().toISOString();

  // Roles (idempotente via INSERT OR IGNORE)
  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles (id, nome, descricao, permissoes)
    VALUES (?, ?, ?, ?)
  `);
  insertRole.run(1, 'super_admin', 'Acesso total ao sistema', JSON.stringify(['*']));
  insertRole.run(2, 'admin', 'Gerencia clientes e pagamentos', JSON.stringify([
    'users:read', 'users:update', 'users:suspend', 'users:reactivate',
    'subscriptions:read', 'subscriptions:update',
    'payments:read', 'payments:refund',
    'plans:read', 'reports:read',
  ]));
  insertRole.run(3, 'moderador', 'Suporte a clientes', JSON.stringify([
    'users:read', 'subscriptions:read', 'payments:read',
  ]));
  insertRole.run(4, 'cliente', 'Cliente final do SaaS', JSON.stringify([
    'self:read', 'self:update', 'encartes:create', 'encartes:read', 'encartes:update', 'encartes:delete',
  ]));

  // Planos default — pode editar/desativar via admin depois
  const countPlans = db.prepare('SELECT COUNT(*) as c FROM plans').get().c;
  if (countPlans === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO plans (slug, nome, descricao, preco_mensal_centavos, preco_anual_centavos, limites, recursos, ordem, ativo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    insertPlan.run(
      'basico', 'Básico', 'Pra começar a publicar encartes',
      2990, 29900,
      JSON.stringify({ encartesPorMes: 10, templatesProprios: 3, paginasPorEncarte: 1 }),
      JSON.stringify(['pdf_export', 'png_export', 'temas_gratis']),
      1, agora,
    );
    insertPlan.run(
      'pro', 'Profissional', 'Pra lojistas que postam todos os dias',
      6990, 69900,
      JSON.stringify({ encartesPorMes: 50, templatesProprios: 20, paginasPorEncarte: 3 }),
      JSON.stringify(['pdf_export', 'png_export', 'temas_gratis', 'temas_premium', 'remover_fundo', 'busca_avancada']),
      2, agora,
    );
    insertPlan.run(
      'premium', 'Premium', 'Pra redes e franquias',
      14990, 149900,
      JSON.stringify({ encartesPorMes: -1, templatesProprios: -1, paginasPorEncarte: -1 }),
      JSON.stringify(['pdf_export', 'png_export', 'temas_gratis', 'temas_premium', 'remover_fundo', 'busca_avancada', 'whatsapp_post', 'multi_loja', 'api_access']),
      3, agora,
    );
    console.log('[db] 3 planos default criados (basico, pro, premium)');
  }

  console.log('[db] schema inicializado em', DB_FILE);
}

seedInicial();

module.exports = db;
