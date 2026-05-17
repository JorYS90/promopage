import { useState } from 'react';
import LayoutPulse from './LayoutPulse.jsx';
import LayoutStudio from './LayoutStudio.jsx';
import LayoutAtlas from './LayoutAtlas.jsx';

// Modal que apresenta 3 PROPOSTAS de layout SaaS moderno pro site.
// Cada uma é um mockup FULLSCREEN funcionalmente igual mas com estrutura/visual diferente.
// Usuário pode entrar em cada uma e voltar pra decidir.
//
// Importante: nada disso afeta o site atual — são apenas previews pra escolha.

const LAYOUTS = [
  {
    id: 'pulse',
    nome: 'Pulse',
    estilo: 'Linear / Vercel',
    descricao: 'Ultra-clean, sidebar colapsável, foco no conteúdo. Whitespace abundante, accent único.',
    tags: ['Minimalista', 'Profissional', 'Branco'],
    cores: ['#fafafa', '#18181b', '#3b82f6'],
    Component: LayoutPulse,
  },
  {
    id: 'studio',
    nome: 'Studio',
    estilo: 'Figma / Framer',
    descricao: 'Dark mode tools-first. Toolbar densa, canvas central grande, painel de propriedades à direita.',
    tags: ['Dark', 'Criativo', 'Pro'],
    cores: ['#0d0d0f', '#1c1c20', '#3b82f6'],
    Component: LayoutStudio,
  },
  {
    id: 'atlas',
    nome: 'Atlas',
    estilo: 'Notion / Linear Workspace',
    descricao: 'Workspace lateral largo com busca, breadcrumb navigation, sem topbar. Tudo na sidebar.',
    tags: ['Workspace', 'Friendly', 'Cinza-quente'],
    cores: ['#f7f6f3', '#37352f', '#0f7b6c'],
    Component: LayoutAtlas,
  },
];

export default function ModalPreviewLayouts({ aberto, aoFechar }) {
  const [layoutAtivo, setLayoutAtivo] = useState(null);

  if (!aberto) return null;

  // Se um layout específico foi escolhido, mostra ele em fullscreen
  if (layoutAtivo) {
    const layout = LAYOUTS.find(l => l.id === layoutAtivo);
    const Comp = layout?.Component;
    return (
      <div className="pl-fullscreen">
        <div className="pl-barra-volta">
          <button className="pl-btn-volta" onClick={() => setLayoutAtivo(null)}>
            ← Voltar pra comparação
          </button>
          <div className="pl-barra-info">
            <span className="pl-barra-nome">{layout.nome}</span>
            <span className="pl-barra-estilo">{layout.estilo}</span>
          </div>
          <button className="pl-btn-fechar" onClick={() => { setLayoutAtivo(null); aoFechar(); }}>
            ✕ Fechar preview
          </button>
        </div>
        <div className="pl-fullscreen-content">
          {Comp && <Comp />}
        </div>
      </div>
    );
  }

  // Senão, mostra a galeria de comparação
  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-preview-layouts" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        <div className="pl-header">
          <h2 className="pl-titulo">✨ Novos Layouts — Propostas</h2>
          <p className="pl-sub">
            3 reformulações modernas estilo SaaS pra diferenciar do concorrente.
            Click em <b>"Visualizar"</b> pra entrar em uma versão fullscreen do layout
            e ver como ficaria com seus dados reais.
          </p>
        </div>

        <div className="pl-grid">
          {LAYOUTS.map(l => (
            <div key={l.id} className="pl-card">
              {/* Mini preview do layout */}
              <div className="pl-mini" data-layout={l.id}>
                <div className="pl-mini-topo" />
                <div className="pl-mini-body">
                  <div className="pl-mini-side" />
                  <div className="pl-mini-main">
                    <div className="pl-mini-canvas" />
                  </div>
                  {l.id === 'studio' && <div className="pl-mini-right" />}
                </div>
              </div>

              <div className="pl-info">
                <div className="pl-info-titulo">
                  <h3>{l.nome}</h3>
                  <span className="pl-info-estilo">{l.estilo}</span>
                </div>
                <p className="pl-info-desc">{l.descricao}</p>
                <div className="pl-info-tags">
                  {l.tags.map(t => <span key={t} className="pl-tag">{t}</span>)}
                </div>
                <div className="pl-info-paleta">
                  {l.cores.map((c, i) => (
                    <div key={i} className="pl-cor" style={{ background: c }} title={c} />
                  ))}
                </div>
                <button
                  className="pl-btn-ver"
                  onClick={() => setLayoutAtivo(l.id)}
                >
                  Visualizar fullscreen →
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pl-rodape">
          💡 Depois de comparar, me diga qual escolheu e eu implemento de verdade no site
          (mantendo toda a funcionalidade atual de auth, admin, encartes, etc.)
        </div>
      </div>
    </div>
  );
}
