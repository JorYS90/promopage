// LAYOUT STUDIO — inspirado em Figma / Framer
// - Dark mode total (#0d0d0f)
// - Toolbar densa no topo (logo + tools + share + user)
// - Sidebar de TOOLS à esquerda (estreita, só ícones)
// - Right panel: propriedades + camadas
// - Canvas central GRANDE com fundo escuro pra valorizar o encarte
// - Floating panels com sombras profundas
// - Accent azul vibrante (#3b82f6)

export default function LayoutStudio() {
  return (
    <div className="ls-app">
      {/* TOOLBAR DENSA */}
      <div className="ls-toolbar">
        <div className="ls-toolbar-left">
          <div className="ls-logo">
            <div className="ls-logo-mark">QR</div>
            <span>OFERTAS</span>
          </div>
          <div className="ls-menu">
            <button className="ls-menu-btn">File</button>
            <button className="ls-menu-btn">Edit</button>
            <button className="ls-menu-btn">View</button>
            <button className="ls-menu-btn">Insert</button>
          </div>
        </div>
        <div className="ls-toolbar-center">
          <div className="ls-tool-group">
            <button className="ls-tool ativo" title="Mover">↗</button>
            <button className="ls-tool" title="Selecionar"><Icon name="cursor"/></button>
            <button className="ls-tool" title="Texto">T</button>
            <button className="ls-tool" title="Forma">▢</button>
            <button className="ls-tool" title="Imagem"><Icon name="image"/></button>
          </div>
          <div className="ls-tool-divider" />
          <div className="ls-tool-group">
            <button className="ls-tool" title="Zoom out">−</button>
            <span className="ls-zoom-label">80%</span>
            <button className="ls-tool" title="Zoom in">+</button>
            <button className="ls-tool" title="Fit"><Icon name="fit"/></button>
          </div>
        </div>
        <div className="ls-toolbar-right">
          <div className="ls-collab">
            <div className="ls-collab-avatar" style={{background:'#f59e0b'}}>M</div>
            <div className="ls-collab-avatar" style={{background:'#10b981'}}>R</div>
            <div className="ls-collab-avatar" style={{background:'#ec4899'}}>+2</div>
          </div>
          <button className="ls-btn-ghost">Pré-visualizar</button>
          <button className="ls-btn-share">Share ▾</button>
          <div className="ls-user-avatar">JP</div>
        </div>
      </div>

      {/* SIDEBAR DE TOOLS (esquerda) */}
      <aside className="ls-tools">
        <button className="ls-tools-item ativo" title="Encartes"><Icon name="grid"/></button>
        <button className="ls-tools-item" title="Produtos"><Icon name="package"/></button>
        <button className="ls-tools-item" title="Temas"><Icon name="palette"/></button>
        <button className="ls-tools-item" title="Imagens"><Icon name="image"/></button>
        <button className="ls-tools-item" title="Texto"><Icon name="text"/></button>
        <button className="ls-tools-item" title="Camadas"><Icon name="layers"/></button>
        <div className="ls-tools-spacer" />
        <button className="ls-tools-item" title="Settings"><Icon name="settings"/></button>
      </aside>

      {/* CANVAS */}
      <main className="ls-canvas">
        <div className="ls-canvas-grid">
          {/* Floating: tab de página atual */}
          <div className="ls-page-tab">
            <span className="ls-page-name">Página 1</span>
            <button className="ls-page-add">+</button>
          </div>

          {/* O encarte */}
          <div className="ls-encarte-frame">
            <div className="ls-encarte-capa">
              <div className="ls-encarte-titulo">DIA DAS MÃES</div>
              <div className="ls-encarte-sub">com desconto</div>
            </div>
            <div className="ls-encarte-grid">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="ls-encarte-prod">
                  <div className="ls-encarte-foto" />
                  <div className="ls-encarte-nome" />
                  <div className="ls-encarte-preco">R$ {(9 + i * 2).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating: controles abaixo do encarte */}
          <div className="ls-canvas-controls">
            <button className="ls-cc-btn"><Icon name="undo"/></button>
            <button className="ls-cc-btn"><Icon name="redo"/></button>
            <div className="ls-cc-sep" />
            <button className="ls-cc-btn"><Icon name="ruler"/></button>
            <button className="ls-cc-btn"><Icon name="grid-toggle"/></button>
          </div>
        </div>
      </main>

      {/* RIGHT PANEL — props/layers */}
      <aside className="ls-right">
        <div className="ls-right-tabs">
          <button className="ls-rt ativo">Design</button>
          <button className="ls-rt">Camadas</button>
          <button className="ls-rt">Comentários</button>
        </div>
        <div className="ls-right-content">
          <div className="ls-section">
            <h4 className="ls-section-titulo">Tema</h4>
            <div className="ls-theme-grid">
              <div className="ls-theme-tile" style={{background:'linear-gradient(135deg,#f9a8d4,#ec4899)'}}>Mães</div>
              <div className="ls-theme-tile" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>Açougue</div>
              <div className="ls-theme-tile" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Verde</div>
              <div className="ls-theme-tile" style={{background:'linear-gradient(135deg,#f59e0b,#f97316)'}}>Festa</div>
            </div>
          </div>
          <div className="ls-section">
            <h4 className="ls-section-titulo">Grade</h4>
            <select className="ls-select">
              <option>11 Produtos · 3 destaques topo</option>
            </select>
          </div>
          <div className="ls-section">
            <h4 className="ls-section-titulo">Cores</h4>
            <div className="ls-cores-row">
              <label><span>Primária</span><div className="ls-cor-swatch" style={{background:'#ec4899'}} /></label>
              <label><span>Acento</span><div className="ls-cor-swatch" style={{background:'#fbbf24'}} /></label>
            </div>
            <div className="ls-cores-row">
              <label><span>Card</span><div className="ls-cor-swatch" style={{background:'#fde047'}} /></label>
              <label><span>Texto</span><div className="ls-cor-swatch" style={{background:'#1f2937'}} /></label>
            </div>
          </div>
          <div className="ls-section">
            <h4 className="ls-section-titulo">Tamanho</h4>
            <div className="ls-tamanho-grid">
              <button className="ls-tam ativo">Facebook</button>
              <button className="ls-tam">Stories</button>
              <button className="ls-tam">A4</button>
            </div>
          </div>
          <div className="ls-section">
            <h4 className="ls-section-titulo">Exportar</h4>
            <button className="ls-btn-export-big">⬇ Baixar PDF</button>
            <button className="ls-btn-export-secondary">PNG · JPG · Share</button>
          </div>
        </div>
      </aside>

      <style>{cssStudio}</style>
    </div>
  );
}

function Icon({ name }) {
  const stroke = 'currentColor';
  const sw = 1.6;
  const ICONS = {
    cursor: <><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></>,
    fit: <><path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    package: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></>,
    palette: <><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></>,
    text: <><path d="M4 7V4h16v3M9 20h6M12 4v16"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    undo: <><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8"/></>,
    redo: <><path d="M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8"/></>,
    ruler: <><path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/></>,
    'grid-toggle': <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const cssStudio = `
.ls-app {
  --bg: #0d0d0f;
  --surface: #1c1c20;
  --surface-2: #26262c;
  --border: #2a2a31;
  --text: #f0f0f3;
  --muted: #71717a;
  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
  width: 100%; height: 100%;
  display: grid;
  grid-template-columns: 56px 1fr 280px;
  grid-template-rows: 48px 1fr;
}
.ls-toolbar {
  grid-column: 1 / -1;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 12px;
  gap: 24px;
}
.ls-toolbar-left { display: flex; align-items: center; gap: 18px; }
.ls-logo { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 12px; letter-spacing: 1px; }
.ls-logo-mark {
  background: var(--accent); color: #fff;
  padding: 4px 7px; border-radius: 5px;
  font-size: 11px; font-weight: 800;
}
.ls-menu { display: flex; gap: 2px; }
.ls-menu-btn {
  background: transparent; border: none; color: var(--muted);
  padding: 5px 10px; border-radius: 4px; cursor: pointer;
  font-size: 12.5px;
}
.ls-menu-btn:hover { background: var(--surface-2); color: var(--text); }
.ls-toolbar-center {
  margin: 0 auto;
  display: flex; align-items: center; gap: 8px;
  background: var(--bg); padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.ls-tool-group { display: flex; gap: 2px; align-items: center; }
.ls-tool-divider { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
.ls-tool {
  background: transparent; border: none;
  width: 28px; height: 28px; border-radius: 4px;
  color: var(--text); cursor: pointer;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.ls-tool:hover { background: var(--surface-2); }
.ls-tool.ativo { background: var(--accent); color: #fff; }
.ls-zoom-label { font-size: 11.5px; color: var(--muted); padding: 0 6px; min-width: 36px; text-align: center; }
.ls-toolbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.ls-collab { display: flex; }
.ls-collab-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  color: #fff; font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--surface); margin-left: -8px;
}
.ls-collab-avatar:first-child { margin-left: 0; }
.ls-btn-ghost {
  background: transparent; border: 1px solid var(--border);
  color: var(--text); padding: 5px 12px; border-radius: 5px;
  font-size: 12px; cursor: pointer; font-weight: 500;
}
.ls-btn-ghost:hover { background: var(--surface-2); }
.ls-btn-share {
  background: var(--accent); color: #fff; border: none;
  padding: 6px 14px; border-radius: 5px;
  font-size: 12px; font-weight: 700; cursor: pointer;
}
.ls-btn-share:hover { background: var(--accent-hover); }
.ls-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #f97316, #ec4899);
  color: #fff; font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.ls-tools {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; align-items: center;
  padding: 12px 0; gap: 4px;
}
.ls-tools-item {
  width: 36px; height: 36px;
  background: transparent; border: none;
  border-radius: 6px; color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ls-tools-item:hover { background: var(--surface-2); color: var(--text); }
.ls-tools-item.ativo { background: var(--accent); color: #fff; }
.ls-tools-spacer { flex: 1; }
.ls-canvas {
  background: var(--bg);
  overflow: auto;
  position: relative;
  background-image: radial-gradient(circle, #2a2a31 1px, transparent 1px);
  background-size: 24px 24px;
  display: flex; align-items: center; justify-content: center;
  padding: 40px;
}
.ls-canvas-grid {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
}
.ls-page-tab {
  position: absolute; top: -24px; left: 0;
  background: var(--surface); color: var(--text);
  padding: 4px 10px 4px 8px; border-radius: 5px 5px 0 0;
  font-size: 11px; display: flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); border-bottom: none;
}
.ls-page-add { background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.ls-encarte-frame {
  width: 420px; background: #fef9f3;
  border-radius: 4px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px var(--accent);
}
.ls-encarte-capa {
  background: linear-gradient(135deg, #f9a8d4 0%, #ec4899 50%, #be185d 100%);
  color: #fff; padding: 30px 20px;
  text-align: center;
}
.ls-encarte-titulo { font-size: 24px; font-weight: 900; letter-spacing: 1px; }
.ls-encarte-sub { font-size: 11px; margin-top: 4px; opacity: 0.9; font-style: italic; }
.ls-encarte-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; }
.ls-encarte-prod {
  background: #fde047; padding: 8px; border-radius: 3px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.ls-encarte-foto { width: 100%; aspect-ratio: 1; background: rgba(255,255,255,0.6); border-radius: 2px; }
.ls-encarte-nome { width: 70%; height: 4px; background: #1f2937; border-radius: 2px; }
.ls-encarte-preco { background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 8px; }
.ls-canvas-controls {
  position: absolute; bottom: -50px; left: 50%; transform: translateX(-50%);
  background: var(--surface); padding: 6px;
  border-radius: 8px; display: flex; gap: 2px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  border: 1px solid var(--border);
}
.ls-cc-btn {
  width: 28px; height: 28px; background: transparent; border: none;
  border-radius: 4px; color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ls-cc-btn:hover { background: var(--surface-2); color: var(--text); }
.ls-cc-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; align-self: center; }
.ls-right {
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  display: flex; flex-direction: column;
}
.ls-right-tabs { display: flex; border-bottom: 1px solid var(--border); }
.ls-rt {
  flex: 1; background: transparent; border: none; color: var(--muted);
  padding: 12px 4px; font-size: 11.5px; font-weight: 600; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.ls-rt.ativo { color: var(--text); border-bottom-color: var(--accent); }
.ls-right-content { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.ls-section-titulo {
  margin: 0 0 10px; font-size: 11px; font-weight: 700;
  color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;
}
.ls-theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ls-theme-tile {
  aspect-ratio: 16/9; border-radius: 6px; color: #fff;
  font-size: 11px; font-weight: 700; padding: 8px; cursor: pointer;
  display: flex; align-items: flex-end;
}
.ls-select {
  width: 100%; padding: 8px 10px; border-radius: 5px;
  background: var(--surface-2); border: 1px solid var(--border);
  color: var(--text); font-size: 12px;
}
.ls-cores-row { display: flex; gap: 8px; margin-bottom: 8px; }
.ls-cores-row label {
  flex: 1; display: flex; align-items: center; gap: 6px;
  background: var(--surface-2); padding: 5px 8px; border-radius: 5px;
  font-size: 11.5px; cursor: pointer;
}
.ls-cores-row label span { color: var(--muted); }
.ls-cor-swatch { width: 18px; height: 18px; border-radius: 3px; margin-left: auto; }
.ls-tamanho-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.ls-tam {
  background: var(--surface-2); border: 1px solid var(--border);
  color: var(--muted); padding: 8px; border-radius: 5px;
  font-size: 11px; cursor: pointer; font-weight: 600;
}
.ls-tam.ativo { background: var(--accent); border-color: var(--accent); color: #fff; }
.ls-btn-export-big {
  width: 100%; background: var(--accent); color: #fff; border: none;
  padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 700;
  cursor: pointer; margin-bottom: 6px;
}
.ls-btn-export-big:hover { background: var(--accent-hover); }
.ls-btn-export-secondary {
  width: 100%; background: var(--surface-2); color: var(--text);
  border: 1px solid var(--border); padding: 8px; border-radius: 5px;
  font-size: 11px; cursor: pointer;
}
`;
