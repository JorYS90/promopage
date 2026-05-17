// LAYOUT PULSE — inspirado em Linear / Vercel
// - Sidebar fina à esquerda (60px) com ícones grandes monoline
// - Topbar minimalista só com search + user
// - Conteúdo amplo, whitespace abundante
// - Cards com bordas sutis (1px), sem sombras pesadas
// - Tipografia Inter, peso 500/600
// - Accent único (azul) + monocromático

export default function LayoutPulse() {
  return (
    <div className="lp-app">
      {/* SIDEBAR FINA */}
      <aside className="lp-sidebar">
        <div className="lp-sidebar-logo">QR</div>
        <nav className="lp-sidebar-nav">
          <button className="lp-nav-item ativo" title="Encartes"><Icon name="layout" /></button>
          <button className="lp-nav-item" title="Produtos"><Icon name="package" /></button>
          <button className="lp-nav-item" title="Temas"><Icon name="palette" /></button>
          <button className="lp-nav-item" title="Imagens"><Icon name="image" /></button>
          <button className="lp-nav-item" title="Empresa"><Icon name="building" /></button>
          <button className="lp-nav-item" title="Datas"><Icon name="calendar" /></button>
        </nav>
        <div className="lp-sidebar-bottom">
          <button className="lp-nav-item" title="Configurações"><Icon name="settings" /></button>
          <button className="lp-nav-item" title="Ajuda"><Icon name="help" /></button>
        </div>
      </aside>

      {/* TOPBAR MÍNIMA */}
      <header className="lp-topbar">
        <div className="lp-breadcrumb">
          <span className="lp-bc-item">Encartes</span>
          <span className="lp-bc-sep">/</span>
          <span className="lp-bc-item ativo">Promoção Dia das Mães</span>
        </div>
        <div className="lp-topbar-right">
          <div className="lp-search">
            <Icon name="search" />
            <input placeholder="Buscar produtos, temas, projetos..." />
            <kbd>⌘K</kbd>
          </div>
          <button className="lp-btn-save">Salvar</button>
          <button className="lp-btn-export">Exportar</button>
          <div className="lp-avatar">JP</div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="lp-main">
        <div className="lp-page-header">
          <div>
            <h1>Promoção Dia das Mães</h1>
            <div className="lp-page-meta">
              <span className="lp-status">● Rascunho</span>
              <span className="lp-meta-sep">·</span>
              <span>11 produtos</span>
              <span className="lp-meta-sep">·</span>
              <span>Atualizado há 2 minutos</span>
            </div>
          </div>
          <div className="lp-page-actions">
            <button className="lp-btn-ghost">Visualizar</button>
            <button className="lp-btn-primary">Publicar →</button>
          </div>
        </div>

        <div className="lp-grid">
          {/* Coluna esquerda — preview do encarte */}
          <section className="lp-canvas-card">
            <div className="lp-canvas-toolbar">
              <button className="lp-tool"><Icon name="grid" /> Grade 3×4</button>
              <button className="lp-tool"><Icon name="page" /> Página 1 de 1</button>
              <button className="lp-tool"><Icon name="zoom" /> 80%</button>
            </div>
            <div className="lp-canvas-preview">
              <div className="lp-mini-encarte">
                <div className="lp-mini-capa">DIA DAS MÃES</div>
                <div className="lp-mini-grid">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="lp-mini-card">
                      <div className="lp-mini-foto" />
                      <div className="lp-mini-nome" />
                      <div className="lp-mini-balao">R$ 9,99</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Coluna direita — properties panel */}
          <aside className="lp-side-panel">
            <div className="lp-panel-tabs">
              <button className="lp-panel-tab ativo">Produtos</button>
              <button className="lp-panel-tab">Estilo</button>
              <button className="lp-panel-tab">Datas</button>
            </div>
            <div className="lp-panel-content">
              <div className="lp-panel-search">
                <input placeholder="Adicionar produto..." />
              </div>
              <div className="lp-prod-list">
                {[
                  'Coxinha da asa', 'Meio da Asa', 'Contra Filé', 'Pizza Seara',
                  'Linguiça Seara', 'Coxa Sobrecoxa', 'Bistequinha Sadia', 'Bacon Paleta',
                  'Milho Quero Lata', 'Ervilha Quero Lata', 'Heinz Sache',
                ].map((nome, i) => (
                  <div key={i} className="lp-prod-row">
                    <div className="lp-prod-thumb" />
                    <div className="lp-prod-info">
                      <div className="lp-prod-nome">{nome}</div>
                      <div className="lp-prod-preco">R$ {(9 + i * 2).toFixed(2)}</div>
                    </div>
                    <button className="lp-prod-acao"><Icon name="more" /></button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* STATUS BAR */}
      <footer className="lp-statusbar">
        <span><Icon name="check" /> Salvo automaticamente</span>
        <span>·</span>
        <span>11 produtos</span>
        <span>·</span>
        <span>Plano <b>Profissional</b></span>
      </footer>

      <style>{cssPulse}</style>
    </div>
  );
}

// Ícones SVG monoline (estilo Lucide)
function Icon({ name }) {
  const stroke = 'currentColor';
  const sw = 1.7;
  const ICONS = {
    layout: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
    package: <><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></>,
    palette: <><circle cx="13.5" cy="6.5" r=".5" fill={stroke}/><circle cx="17.5" cy="10.5" r=".5" fill={stroke}/><circle cx="8.5" cy="7.5" r=".5" fill={stroke}/><circle cx="6.5" cy="12.5" r=".5" fill={stroke}/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    page: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    zoom: <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></>,
    more: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// === CSS específico do Pulse (inline pra ficar self-contained) ===
const cssPulse = `
.lp-app {
  --bg: #fafafa;
  --surface: #fff;
  --border: #e5e5e5;
  --text: #18181b;
  --muted: #71717a;
  --accent: #3b82f6;
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 60px 1fr;
  grid-template-rows: 56px 1fr 32px;
}
.lp-sidebar {
  grid-row: 1 / -1;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0;
}
.lp-sidebar-logo {
  width: 36px; height: 36px;
  background: var(--text);
  color: #fff;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 13px;
  margin-bottom: 24px;
}
.lp-sidebar-nav {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1;
}
.lp-sidebar-bottom {
  display: flex; flex-direction: column; gap: 4px;
}
.lp-nav-item {
  width: 36px; height: 36px;
  background: transparent; border: none;
  border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
.lp-nav-item:hover { background: #f4f4f5; color: var(--text); }
.lp-nav-item.ativo { background: #ecfdf5; color: #059669; }
.lp-topbar {
  grid-column: 2;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center;
  padding: 0 24px; gap: 24px;
}
.lp-breadcrumb {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px;
}
.lp-bc-item { color: var(--muted); }
.lp-bc-item.ativo { color: var(--text); font-weight: 600; }
.lp-bc-sep { color: var(--border); }
.lp-topbar-right {
  margin-left: auto;
  display: flex; align-items: center; gap: 10px;
}
.lp-search {
  display: flex; align-items: center; gap: 8px;
  background: #f4f4f5; padding: 6px 12px;
  border-radius: 6px; min-width: 280px;
  color: var(--muted);
}
.lp-search input {
  border: none; background: transparent; outline: none;
  font-size: 13px; flex: 1; color: var(--text);
}
.lp-search kbd {
  background: #fff; border: 1px solid var(--border);
  border-radius: 4px; padding: 1px 6px; font-size: 11px;
  color: var(--muted); font-family: inherit;
}
.lp-btn-save, .lp-btn-export, .lp-btn-ghost {
  background: transparent; border: 1px solid var(--border);
  padding: 6px 14px; border-radius: 6px; font-weight: 600;
  font-size: 13px; color: var(--text); cursor: pointer;
}
.lp-btn-save:hover, .lp-btn-export:hover { background: #f4f4f5; }
.lp-btn-primary {
  background: var(--text); color: #fff; border: none;
  padding: 6px 14px; border-radius: 6px; font-weight: 600;
  font-size: 13px; cursor: pointer;
}
.lp-avatar {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, #6366f1, #ec4899);
  color: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
  margin-left: 4px;
}
.lp-main {
  grid-column: 2;
  overflow-y: auto;
  padding: 32px 40px;
}
.lp-page-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 28px;
}
.lp-page-header h1 {
  margin: 0 0 6px; font-size: 24px; font-weight: 700;
  letter-spacing: -0.4px;
}
.lp-page-meta {
  display: flex; gap: 8px; font-size: 13px; color: var(--muted);
}
.lp-status { color: #f59e0b; font-weight: 500; }
.lp-meta-sep { color: var(--border); }
.lp-page-actions { display: flex; gap: 8px; }
.lp-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 24px;
  align-items: start;
}
.lp-canvas-card, .lp-side-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.lp-canvas-toolbar {
  display: flex; gap: 4px; padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.lp-tool {
  background: transparent; border: none;
  padding: 4px 10px; border-radius: 5px;
  font-size: 12px; color: var(--muted); cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.lp-tool:hover { background: #f4f4f5; color: var(--text); }
.lp-canvas-preview {
  padding: 24px; background: #f4f4f5;
  display: flex; justify-content: center;
  min-height: 460px;
}
.lp-mini-encarte {
  width: 340px; background: #fef9f3;
  border-radius: 6px; overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.lp-mini-capa {
  background: linear-gradient(135deg, #f9a8d4, #ec4899);
  color: #fff; padding: 24px; font-weight: 800;
  font-size: 16px; text-align: center;
}
.lp-mini-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 4px; padding: 4px;
}
.lp-mini-card {
  background: #fff; padding: 6px; border-radius: 3px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.lp-mini-foto { width: 100%; aspect-ratio: 1; background: #f4f4f5; border-radius: 2px; }
.lp-mini-nome { width: 80%; height: 4px; background: #e5e5e5; border-radius: 2px; }
.lp-mini-balao { background: #ef4444; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 8px; }
.lp-panel-tabs {
  display: flex; border-bottom: 1px solid var(--border);
}
.lp-panel-tab {
  flex: 1; background: transparent; border: none;
  padding: 12px 8px; font-size: 12px; font-weight: 600;
  color: var(--muted); cursor: pointer;
  border-bottom: 2px solid transparent;
}
.lp-panel-tab.ativo { color: var(--text); border-bottom-color: var(--text); }
.lp-panel-search { padding: 12px 14px; }
.lp-panel-search input {
  width: 100%; box-sizing: border-box;
  padding: 7px 10px; border: 1px solid var(--border);
  border-radius: 5px; font-size: 12.5px;
}
.lp-prod-list { padding: 0 6px 6px; max-height: 480px; overflow-y: auto; }
.lp-prod-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: 5px; cursor: pointer;
}
.lp-prod-row:hover { background: #f4f4f5; }
.lp-prod-thumb { width: 32px; height: 32px; background: #e5e5e5; border-radius: 4px; flex-shrink: 0; }
.lp-prod-info { flex: 1; min-width: 0; }
.lp-prod-nome { font-size: 12.5px; font-weight: 500; }
.lp-prod-preco { font-size: 11px; color: var(--muted); }
.lp-prod-acao {
  background: transparent; border: none; cursor: pointer;
  padding: 4px; color: var(--muted); border-radius: 4px;
}
.lp-prod-acao:hover { background: #e5e5e5; color: var(--text); }
.lp-statusbar {
  grid-column: 2;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex; align-items: center; gap: 12px;
  padding: 0 24px; font-size: 12px; color: var(--muted);
}
.lp-statusbar svg { color: #16a34a; }
`;
