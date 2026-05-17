// LAYOUT ATLAS — inspirado em Notion / Linear Workspace
// - SEM topbar tradicional, tudo na sidebar
// - Sidebar larga (260px) com workspace switcher + busca + seções expandíveis
// - Conteúdo central com breadcrumb + título grande
// - Right panel: comentários / activity feed (Notion-style)
// - Cores: creme/off-white + sage green + warm grays
// - Tipografia: serif pra títulos (Lora), sans pra body

export default function LayoutAtlas() {
  return (
    <div className="la-app">
      {/* SIDEBAR ESQUERDA LARGA */}
      <aside className="la-sidebar">
        <div className="la-workspace">
          <div className="la-ws-avatar">DL</div>
          <div>
            <div className="la-ws-nome">Delly's Food Service</div>
            <div className="la-ws-plan">Plano Pro · 1 membro</div>
          </div>
          <button className="la-ws-toggle">▾</button>
        </div>
        <div className="la-search">
          <input placeholder="🔍 Buscar..." />
          <kbd>⌘K</kbd>
        </div>
        <button className="la-quick-action">
          <span className="la-qa-icon">＋</span>
          Novo encarte
        </button>

        <nav className="la-nav">
          <div className="la-nav-section">
            <div className="la-nav-section-titulo">FAVORITOS</div>
            <a className="la-nav-item ativo">
              <span className="la-nav-icon">📄</span>
              Promoção Dia das Mães
              <span className="la-nav-meta">Edit</span>
            </a>
            <a className="la-nav-item">
              <span className="la-nav-icon">📄</span>
              Quinta da Carne
            </a>
          </div>

          <div className="la-nav-section">
            <div className="la-nav-section-titulo">CAMPANHAS</div>
            <a className="la-nav-item parent">
              <span className="la-nav-chevron">▾</span>
              <span className="la-nav-icon">📁</span>
              Datas Comemorativas
            </a>
            <a className="la-nav-item child">
              <span className="la-nav-icon">📄</span>
              Dia das Mães 2026
            </a>
            <a className="la-nav-item child">
              <span className="la-nav-icon">📄</span>
              Páscoa
            </a>
            <a className="la-nav-item child">
              <span className="la-nav-icon">📄</span>
              Black Friday
            </a>
            <a className="la-nav-item parent">
              <span className="la-nav-chevron">▸</span>
              <span className="la-nav-icon">📁</span>
              Açougue Semanal
            </a>
          </div>

          <div className="la-nav-section">
            <div className="la-nav-section-titulo">RECURSOS</div>
            <a className="la-nav-item">
              <span className="la-nav-icon">🎨</span>
              Temas <span className="la-nav-badge">25</span>
            </a>
            <a className="la-nav-item">
              <span className="la-nav-icon">📦</span>
              Produtos
            </a>
            <a className="la-nav-item">
              <span className="la-nav-icon">🖼️</span>
              Biblioteca
            </a>
            <a className="la-nav-item">
              <span className="la-nav-icon">🏪</span>
              Empresa
            </a>
          </div>
        </nav>

        <div className="la-user-card">
          <div className="la-user-avatar">JP</div>
          <div className="la-user-info">
            <div className="la-user-nome">João Paulo</div>
            <div className="la-user-email">guadagnin_jp@hotmail.com</div>
          </div>
          <button className="la-user-menu">⋯</button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="la-main">
        <div className="la-breadcrumb">
          <span>Datas Comemorativas</span>
          <span className="la-bc-sep">›</span>
          <span>Dia das Mães</span>
          <span className="la-bc-sep">›</span>
          <span className="la-bc-ativo">Promoção Dia das Mães</span>
          <div className="la-bc-right">
            <button className="la-bc-btn">Compartilhar</button>
            <button className="la-bc-btn primary">⬇ Exportar</button>
          </div>
        </div>

        <div className="la-page">
          <div className="la-page-cover">
            <div className="la-cover-grad" />
            <div className="la-cover-emoji">📄</div>
          </div>

          <div className="la-page-conteudo">
            <h1 className="la-page-titulo">Promoção Dia das Mães</h1>
            <div className="la-page-meta">
              <span className="la-meta-item">📅 27 de abril, 2026 · 14:32</span>
              <span className="la-meta-item">🏷 Datas Comemorativas</span>
              <span className="la-meta-item">⚡ Status: <b>Rascunho</b></span>
            </div>

            <div className="la-page-actions">
              <button className="la-pa-btn">＋ Adicionar produto</button>
              <button className="la-pa-btn">🎨 Mudar tema</button>
              <button className="la-pa-btn">📐 Grade</button>
              <button className="la-pa-btn">📝 Observações</button>
            </div>

            <div className="la-encarte-wrap">
              <div className="la-encarte">
                <div className="la-encarte-capa">
                  <span className="la-capa-tag">DIA DAS</span>
                  <span className="la-capa-titulo">MÃES</span>
                  <span className="la-capa-sub">com desconto</span>
                </div>
                <div className="la-encarte-grid">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="la-encarte-card">
                      <div className="la-card-foto" />
                      <div className="la-card-nome" />
                      <div className="la-card-preco">R$ {(9 + i * 1.5).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="la-section">
              <h3>Observações</h3>
              <p className="la-obs">
                Encarte para divulgação nas redes sociais e WhatsApp. Validade
                até 12/05. Os preços de combo dependem da retirada com cartão
                fidelidade.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* RIGHT PANEL — comentários / activity */}
      <aside className="la-right">
        <div className="la-right-titulo">
          <h4>Atividade</h4>
          <button className="la-right-fechar">×</button>
        </div>
        <div className="la-activity">
          <div className="la-act-item">
            <div className="la-act-avatar" style={{background:'#ec4899'}}>JP</div>
            <div className="la-act-content">
              <div><b>João Paulo</b> alterou o tema para <b>Dia das Mães</b></div>
              <div className="la-act-time">há 2 minutos</div>
            </div>
          </div>
          <div className="la-act-item">
            <div className="la-act-avatar" style={{background:'#10b981'}}>R</div>
            <div className="la-act-content">
              <div><b>Roberta</b> adicionou 3 produtos</div>
              <div className="la-act-time">há 12 minutos</div>
            </div>
          </div>
          <div className="la-act-item">
            <div className="la-act-avatar" style={{background:'#f59e0b'}}>M</div>
            <div className="la-act-content">
              <div><b>Marcos</b> comentou:</div>
              <div className="la-act-comment">"O preço do contrafilé tá certinho? Confirma com o açougueiro."</div>
              <div className="la-act-time">há 1 hora</div>
            </div>
          </div>
        </div>
        <div className="la-novo-comment">
          <input placeholder="Adicionar comentário..." />
          <button className="la-comment-send">↑</button>
        </div>
      </aside>

      <style>{cssAtlas}</style>
    </div>
  );
}

const cssAtlas = `
.la-app {
  --bg: #f7f6f3;
  --surface: #ffffff;
  --sidebar-bg: #f7f6f3;
  --border: #ebe9e3;
  --text: #37352f;
  --muted: #787774;
  --accent: #0f7b6c;
  --accent-bg: #e2efea;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  width: 100%; height: 100%;
  display: grid;
  grid-template-columns: 260px 1fr 320px;
}
.la-sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 10px;
  overflow-y: auto;
}
.la-workspace {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 4px;
  cursor: pointer; margin-bottom: 8px;
}
.la-workspace:hover { background: rgba(0,0,0,0.04); }
.la-ws-avatar {
  width: 26px; height: 26px; border-radius: 4px;
  background: linear-gradient(135deg, #ec4899, #f97316);
  color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.la-ws-nome { font-size: 13px; font-weight: 600; }
.la-ws-plan { font-size: 11px; color: var(--muted); }
.la-ws-toggle { background: transparent; border: none; color: var(--muted); cursor: pointer; margin-left: auto; }
.la-search {
  position: relative; margin-bottom: 6px;
}
.la-search input {
  width: 100%; box-sizing: border-box;
  padding: 6px 36px 6px 10px;
  background: var(--surface);
  border: 1px solid var(--border); border-radius: 4px;
  font-size: 13px; color: var(--text);
}
.la-search kbd {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: var(--border); padding: 1px 5px; border-radius: 3px;
  font-size: 10px; color: var(--muted);
}
.la-quick-action {
  width: 100%; background: var(--surface);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 7px 10px; font-size: 13px; font-weight: 500;
  color: var(--text); cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 14px;
}
.la-quick-action:hover { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.la-qa-icon { color: var(--accent); font-weight: 700; }
.la-nav { flex: 1; }
.la-nav-section { margin-bottom: 18px; }
.la-nav-section-titulo {
  font-size: 11px; color: var(--muted); font-weight: 700;
  padding: 2px 8px; letter-spacing: 0.4px;
  margin-bottom: 4px;
}
.la-nav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: 4px;
  cursor: pointer; font-size: 13px; color: var(--text);
  text-decoration: none;
}
.la-nav-item:hover { background: rgba(0,0,0,0.04); }
.la-nav-item.ativo { background: var(--accent-bg); color: var(--accent); font-weight: 600; }
.la-nav-icon { font-size: 13px; }
.la-nav-chevron { color: var(--muted); width: 14px; text-align: center; }
.la-nav-item.child { padding-left: 28px; font-size: 12.5px; }
.la-nav-meta { margin-left: auto; font-size: 10px; color: var(--muted); }
.la-nav-badge {
  margin-left: auto; background: var(--border); color: var(--muted);
  font-size: 10px; padding: 1px 6px; border-radius: 6px;
}
.la-user-card {
  display: flex; align-items: center; gap: 8px;
  padding: 6px; border-radius: 5px; cursor: pointer;
  border: 1px solid var(--border); background: var(--surface);
  margin-top: 12px;
}
.la-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #ec4899);
  color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.la-user-info { flex: 1; min-width: 0; }
.la-user-nome { font-size: 12.5px; font-weight: 600; }
.la-user-email { font-size: 10.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.la-user-menu {
  background: transparent; border: none; color: var(--muted);
  cursor: pointer; font-size: 16px; padding: 4px;
}

.la-main {
  background: var(--surface);
  overflow-y: auto;
}
.la-breadcrumb {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 50px;
  border-bottom: 1px solid var(--border);
  font-size: 13px; color: var(--muted);
  position: sticky; top: 0; background: var(--surface); z-index: 10;
}
.la-bc-sep { color: var(--border); }
.la-bc-ativo { color: var(--text); font-weight: 500; }
.la-bc-right { margin-left: auto; display: flex; gap: 6px; }
.la-bc-btn {
  background: transparent; border: 1px solid var(--border);
  padding: 4px 12px; border-radius: 4px; font-size: 12.5px;
  cursor: pointer; color: var(--text);
}
.la-bc-btn:hover { background: rgba(0,0,0,0.03); }
.la-bc-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }

.la-page-cover {
  position: relative; height: 140px; overflow: hidden;
}
.la-cover-grad {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%);
}
.la-cover-emoji {
  position: absolute; bottom: -28px; left: 60px;
  width: 56px; height: 56px; background: var(--surface);
  border: 4px solid var(--surface);
  display: flex; align-items: center; justify-content: center;
  font-size: 36px; border-radius: 8px;
}

.la-page-conteudo { padding: 50px 60px 80px; max-width: 900px; }
.la-page-titulo {
  font-family: 'Lora', Georgia, serif;
  font-size: 38px; font-weight: 700;
  margin: 0 0 12px; letter-spacing: -0.5px;
}
.la-page-meta {
  display: flex; gap: 18px; flex-wrap: wrap;
  font-size: 13px; color: var(--muted);
  margin-bottom: 24px;
}
.la-meta-item b { color: var(--text); font-weight: 600; }
.la-page-actions {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-bottom: 32px;
  padding: 6px; background: var(--bg); border-radius: 6px;
}
.la-pa-btn {
  background: transparent; border: none;
  padding: 6px 12px; border-radius: 4px;
  font-size: 13px; color: var(--muted); cursor: pointer;
}
.la-pa-btn:hover { background: var(--surface); color: var(--text); }

.la-encarte-wrap {
  display: flex; justify-content: center; margin-bottom: 36px;
}
.la-encarte {
  width: 440px; background: #fef9f3;
  border-radius: 6px; overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
}
.la-encarte-capa {
  background: linear-gradient(135deg, #f9a8d4, #ec4899);
  color: #fff; padding: 28px 20px; text-align: center;
  display: flex; flex-direction: column; gap: 2px;
}
.la-capa-tag { font-size: 13px; opacity: 0.9; }
.la-capa-titulo { font-size: 32px; font-weight: 900; letter-spacing: 2px; line-height: 1; }
.la-capa-sub { font-size: 12px; opacity: 0.85; font-style: italic; }
.la-encarte-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; }
.la-encarte-card {
  background: #fde047; padding: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  border-radius: 3px;
}
.la-card-foto { width: 100%; aspect-ratio: 1; background: rgba(255,255,255,0.7); border-radius: 2px; }
.la-card-nome { width: 80%; height: 4px; background: #1f2937; border-radius: 2px; }
.la-card-preco { background: #ef4444; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 8px; font-weight: 700; }

.la-section { margin-top: 36px; }
.la-section h3 {
  margin: 0 0 8px; font-family: 'Lora', Georgia, serif;
  font-size: 18px; font-weight: 700;
}
.la-obs {
  margin: 0; line-height: 1.6; color: var(--text);
  padding: 12px 14px; background: var(--bg);
  border-left: 3px solid var(--accent); border-radius: 0 4px 4px 0;
}

.la-right {
  background: var(--sidebar-bg);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 16px;
  overflow-y: auto;
}
.la-right-titulo {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.la-right-titulo h4 { margin: 0; font-size: 14px; font-weight: 700; }
.la-right-fechar { background: transparent; border: none; cursor: pointer; color: var(--muted); font-size: 18px; }
.la-activity { display: flex; flex-direction: column; gap: 14px; flex: 1; }
.la-act-item { display: flex; gap: 8px; }
.la-act-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.la-act-content { font-size: 12.5px; line-height: 1.5; }
.la-act-time { color: var(--muted); font-size: 11px; margin-top: 2px; }
.la-act-comment {
  background: var(--surface);
  padding: 6px 10px; border-radius: 5px;
  margin-top: 4px; font-size: 12px;
  border-left: 2px solid var(--accent);
}
.la-novo-comment {
  display: flex; gap: 6px; margin-top: 14px;
  padding-top: 14px; border-top: 1px solid var(--border);
}
.la-novo-comment input {
  flex: 1; background: var(--surface);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 7px 10px; font-size: 12px;
}
.la-comment-send {
  background: var(--accent); color: #fff; border: none;
  width: 32px; border-radius: 4px; cursor: pointer; font-weight: 700;
}
`;
