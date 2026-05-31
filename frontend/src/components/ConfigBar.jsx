import { useState } from 'react';
import { LAYOUTS_NOMEADOS } from '../editor/auto-layout.js';

// Valores discretos pra os botões − e + do controle de zoom (estilo Figma/Photoshop).
// "auto" fica entre 80% e 100% — clicar + a partir de auto vai pra 100%, − vai pra 80%.
const ZOOM_STEPS = ['0.25', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1', '1.25', '1.5'];

export default function ConfigBar({ configs, aoMudar }) {
  const set = (k, v) => aoMudar({ ...configs, [k]: v });

  // No mobile (≤1024px) a barra pode ser recolhida pra dar mais espaço ao canvas.
  // No desktop o toggle fica escondido (CSS) e os campos aparecem sempre.
  // Começa recolhida no mobile; lembra a preferência via localStorage.
  const [aberto, setAberto] = useState(() => {
    try { return localStorage.getItem('encarte-builder:configbar-aberto') === '1'; } catch { return false; }
  });
  const toggleBarra = () => setAberto(a => {
    const nv = !a;
    try { localStorage.setItem('encarte-builder:configbar-aberto', nv ? '1' : '0'); } catch {}
    return nv;
  });

  // Helper pra clicar nos botões − e + de zoom
  const zoomLabel = (val) => val === 'auto' ? 'Auto' : `${Math.round(parseFloat(val) * 100)}%`;
  const proxZoom = (atual, direcao) => {
    if (atual === 'auto') return direcao > 0 ? '1' : '0.8';
    const idx = ZOOM_STEPS.indexOf(String(atual));
    if (idx === -1) return atual;
    const novoIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + direcao));
    return ZOOM_STEPS[novoIdx];
  };

  // Filtra layouts disponíveis pelo formato atual.
  // - `apenasFormatos: [...]` → grade só aparece nesses modelos (whitelist)
  // - `excluirFormatos: [...]` → grade NÃO aparece nesses modelos (blacklist)
  // - sem nenhuma das duas → aparece em todos os modelos
  // CARTAZ_*: pôster de produto único — só mostra grades de 1 produto (pedido cliente).
  const isCartaz = configs.modelo === 'CARTAZ_HORIZONTAL' || configs.modelo === 'CARTAZ_VERTICAL';
  // TV_*: whitelist por modelo (pedido cliente). Pra TV, o whitelist BYPASSA o
  // apenasFormatos/excluirFormatos — assim grades originalmente STORIES (g_1x2,
  // g_1x3, g_7_1_dest_topo) podem aparecer em TV_VERTICAL também.
  const TV_HORIZONTAL_WHITELIST = new Set([
    'g_1x1', 'g_2x1', 'g_3x1', 'g_2x2',
    'g_5_dest_esq', 'g_5_dest_dir',
    'g_3x2', 'g_6_2_dest_lat',
    'g_4x2',
    'lista_10', 'lista_20',
  ]);
  const TV_VERTICAL_WHITELIST = new Set([
    'g_1x1', 'g_2x1', 'g_1x2', 'g_3x1', 'g_1x3', 'g_2x2',
    'g_5_dest_esq', 'g_5_dest_dir',
    'g_3x2', 'g_6_2_dest_lat',
    'g_7_1_dest_topo',
    'g_4x2', 'g_3x3',
    'g_11_3_dest_topo',
    'g_4x3',
    'g_17_1_dest_4x4',
    'lista_10', 'lista_20',
  ]);
  const tvWhitelist = configs.modelo === 'TV_HORIZONTAL' ? TV_HORIZONTAL_WHITELIST
    : configs.modelo === 'TV_VERTICAL' ? TV_VERTICAL_WHITELIST
    : null;
  const layoutsDisponiveis = LAYOUTS_NOMEADOS.filter(l => {
    // TV: whitelist puro (bypassa apenasFormatos pra permitir STORIES-specific em TV_VERTICAL)
    if (tvWhitelist) return tvWhitelist.has(l.id);
    if (l.apenasFormatos && !l.apenasFormatos.includes(configs.modelo)) return false;
    if (l.excluirFormatos && l.excluirFormatos.includes(configs.modelo)) return false;
    if (isCartaz && l.quantidade !== 1) return false;
    return true;
  });
  // Separa em "Grades" (grids) e "Listas" (tabelas) e ORDENA por quantidade de produtos
  // (sort estável → grades com a mesma quantidade mantêm a ordem do array).
  const grades = layoutsDisponiveis
    .filter(l => l.tipo !== 'lista')
    .sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0));
  const listas = layoutsDisponiveis
    .filter(l => l.tipo === 'lista')
    .sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0));

  return (
    <div className={`config-bar ${aberto ? 'aberto' : 'fechado'}`}>
      {/* Toggle: aparece só no mobile (CSS). Recolhe/expande os campos. */}
      <button
        type="button"
        className="config-bar-toggle"
        onClick={toggleBarra}
        aria-expanded={aberto}
      >
        <span className="cbt-label">⚙ Modelo, grade, texto e zoom</span>
        <span className="cbt-chevron" aria-hidden="true">{aberto ? '▲' : '▼'}</span>
      </button>

      <div className="config-bar-campos">
      <div className="field">
        <label>Modelo:</label>
        <select value={configs.modelo} onChange={e => set('modelo', e.target.value)}>
          <optgroup label="REDES SOCIAIS">
            <option value="FACEBOOK_QUADRADO">Encarte feed facebook quadrado</option>
            <option value="STORIES">Formato para status e stories</option>
            <option value="REELS_INSTAGRAM">Formato feed/reels instagram</option>
          </optgroup>
          <optgroup label="ENCARTES">
            <option value="ENCARTE_GRANDE">Encarte grande para impressão</option>
            <option value="A4_RETRATO">Encarte a4 para impressão</option>
            <option value="A4_PAISAGEM">Encarte a4 horizontal para impressão</option>
          </optgroup>
          <optgroup label="CARTAZES">
            <option value="CARTAZ_VERTICAL">Cartaz a4 vertical para impressão</option>
            <option value="CARTAZ_HORIZONTAL">Cartaz a4 horizontal para impressão</option>
          </optgroup>
          <optgroup label="TVs">
            <option value="TV_HORIZONTAL">Formato para tv horizontal</option>
            <option value="TV_VERTICAL">Formato para tv vertical</option>
          </optgroup>
        </select>
      </div>
      <div className="field">
        <label>Grade:</label>
        <select value={configs.grade} onChange={e => set('grade', e.target.value)}>
          <optgroup label="Grades">
            {grades.map(g => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </optgroup>
          {listas.length > 0 && (
            <optgroup label="Listas">
              {listas.map(g => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="field">
        <label>Texto:</label>
        <select value={configs.texto} onChange={e => set('texto', e.target.value)}>
          <option value="pequeno">Texto pequeno</option>
          <option value="medio">Texto médio</option>
          <option value="grande">Texto grande</option>
        </select>
      </div>
      {/* "Cores" removido — paleta agora vem do tema (editor de tema). */}
      {/* "Gerar Capa" removido — sempre tem capa (não há opção sem capa) */}
      {/* "Rodapé" removido — agora vem do tema (editor de tema). */}
      <div className="field">
        <label>Zoom:</label>
        <div className="zoom-stepper">
          <button
            type="button"
            className="zoom-btn"
            onClick={() => set('zoom', proxZoom(configs.zoom, -1))}
            disabled={configs.zoom !== 'auto' && ZOOM_STEPS.indexOf(String(configs.zoom)) <= 0}
            title="Diminuir zoom"
            aria-label="Diminuir zoom"
          >−</button>
          <button
            type="button"
            className="zoom-display"
            onClick={() => set('zoom', configs.zoom === 'auto' ? '1' : 'auto')}
            title="Clique pra alternar entre Auto e 100%"
          >
            {zoomLabel(configs.zoom)}
          </button>
          <button
            type="button"
            className="zoom-btn"
            onClick={() => set('zoom', proxZoom(configs.zoom, +1))}
            disabled={configs.zoom !== 'auto' && ZOOM_STEPS.indexOf(String(configs.zoom)) >= ZOOM_STEPS.length - 1}
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >+</button>
        </div>
      </div>
      </div>
    </div>
  );
}
