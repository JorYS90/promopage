// ModalGestorImpressao — Gestor de Impressões PremoPage estilo qrofertas.com/print.
// Permite imprimir o encarte em folha A4/A3/A5/Carta com N artes por folha,
// margens e espaçamento configuráveis. Gera PDF multi-página com layout calculado.
//
// Multi-página REAL: pra projeto com 4 produtos paginado (2 produtos por arte),
// gera PDF de 2 páginas com 2 artes cada uma (4 produtos diferentes total).
//
// Visual: paleta dark premium combinando com o site (slate-900 fundo + acentos
// azul/cyan/roxo). Botão Imprimir em gradient red→orange neon.

import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  PAPEIS,
  MARGENS_PRESETS,
  QUANTIDADES_ARTES,
  calcularLayoutImpressao,
} from '../editor/print-layout.js';

const MM_TO_PX_PREVIEW = 96 / 25.4;  // ~3.78 px/mm pra preview tela
const ESC_KEY = 27;

// === Componente: ícone SVG da grade (cells × rows) que representa a folha ===
// Mostra visualmente como as artes ficarão distribuídas: 2 = 1×2 vertical,
// 4 = 2×2, 6 = 2×3, etc. Adapta automaticamente à orientação (paisagem transpõe).
function IconeGradeArtes({ qtd, orientacao, ativo }) {
  // Mapeia qtd → combo (cols × rows) na orientação retrato. Paisagem transpõe.
  const COMBOS_ICONE = {
    1:  { cols: 1, rows: 1 },
    2:  { cols: 1, rows: 2 },
    4:  { cols: 2, rows: 2 },
    6:  { cols: 2, rows: 3 },
    9:  { cols: 3, rows: 3 },
    12: { cols: 3, rows: 4 },
    16: { cols: 4, rows: 4 },
    20: { cols: 4, rows: 5 },
  };
  const baseCombo = COMBOS_ICONE[qtd] || { cols: 1, rows: qtd };
  const combo = orientacao === 'paisagem'
    ? { cols: baseCombo.rows, rows: baseCombo.cols }
    : baseCombo;
  // Dimensões SVG — proporção da folha (retrato = mais alto, paisagem = mais largo)
  const W = orientacao === 'paisagem' ? 30 : 24;
  const H = orientacao === 'paisagem' ? 24 : 30;
  const padding = 2;
  const gap = 1;
  const innerW = W - padding * 2;
  const innerH = H - padding * 2;
  const cellW = (innerW - gap * (combo.cols - 1)) / combo.cols;
  const cellH = (innerH - gap * (combo.rows - 1)) / combo.rows;
  const corBorda = ativo ? '#60a5fa' : 'rgba(148,163,184,0.5)';
  const corCell = ativo ? 'rgba(59,130,246,0.7)' : 'rgba(148,163,184,0.25)';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      {/* Contorno da folha */}
      <rect x="0.75" y="0.75" width={W - 1.5} height={H - 1.5} rx="1.5"
        stroke={corBorda} strokeWidth="1" fill={ativo ? 'rgba(59,130,246,0.06)' : 'transparent'} />
      {/* Células da grade */}
      {Array.from({ length: combo.rows }).map((_, r) =>
        Array.from({ length: combo.cols }).map((_, c) => (
          <rect key={`${r}-${c}`}
            x={padding + c * (cellW + gap)}
            y={padding + r * (cellH + gap)}
            width={cellW} height={cellH}
            fill={corCell} rx="0.5"
          />
        ))
      )}
    </svg>
  );
}

export default function ModalGestorImpressao({
  aberto, aoFechar,
  gerarPngArte,                // (numeroPagina) => Promise<dataUrl>
  totalPaginasProjeto = 1,
  arteLarguraPx = 794,
  arteAlturaPx = 1123,
  nomeProjeto = 'encarte',
}) {
  // === Configs ===
  const [papel, setPapel] = useState('A4');
  const [orientacao, setOrientacao] = useState('retrato');
  const [qtdArtes, setQtdArtes] = useState(2);
  const [modoCor, setModoCor] = useState('colorido'); // colorido | cinza | pb
  const [margemPreset, setMargemPreset] = useState('normal');
  const [margens, setMargens] = useState(MARGENS_PRESETS.normal);
  const [espacamento, setEspacamento] = useState(0);
  const [abaDobra, setAbaDobra] = useState(false);
  // repetirArte: quando true, sobra espaço na folha = repete a mesma arte.
  // Útil pra imprimir múltiplas cópias do mesmo encarte numa folha A4 só.
  // Default true (comportamento mais comum em impressão de varejo).
  const [repetirArte, setRepetirArte] = useState(true);
  const [paginaPreview, setPaginaPreview] = useState(1);
  const [zoomPreview, setZoomPreview] = useState(0.65);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [pngsCache, setPngsCache] = useState({}); // cache de PNGs por num pra preview
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  const arteAspect = arteLarguraPx / arteAlturaPx;

  // Layout calculado em tempo real
  const layout = useMemo(() => calcularLayoutImpressao({
    papel, orientacao, qtdArtes, margens, espacamento,
    arteAspectRatio: arteAspect,
    abaDobra,
  }), [papel, orientacao, qtdArtes, margens, espacamento, arteAspect, abaDobra]);

  const totalArtes = totalPaginasProjeto;
  // Quando o projeto tem 1 arte só E repetirArte está on, preenchemos TODAS
  // as células da folha com a mesma arte (cópias múltiplas). Sai 1 folha só.
  // Caso contrário, segue sequencial (cada arte uma vez).
  const modoRepeticao = repetirArte && totalArtes === 1;
  const totalFolhas = modoRepeticao ? 1 : Math.ceil(totalArtes / qtdArtes);
  // Mapeia (folha, slot) → número da arte do projeto a renderizar nessa célula
  const numArteParaCelula = (folha, slot) => {
    if (modoRepeticao) return 1;          // sempre arte 1
    const idx = (folha - 1) * qtdArtes + slot + 1;
    return idx > totalArtes ? null : idx; // null = célula vazia
  };

  // Reset página preview quando totalFolhas muda
  useEffect(() => {
    if (paginaPreview > totalFolhas) setPaginaPreview(1);
  }, [totalFolhas, paginaPreview]);

  // Atalho Esc fecha modal
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => { if (e.keyCode === ESC_KEY && !gerando) aoFechar?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, gerando, aoFechar]);

  // Carrega PNGs da página preview atual sob demanda (cacheia)
  useEffect(() => {
    if (!aberto || !gerarPngArte) return;
    const faltam = new Set();
    for (let i = 0; i < qtdArtes; i++) {
      const numArte = numArteParaCelula(paginaPreview, i);
      if (numArte && !pngsCache[numArte]) faltam.add(numArte);
    }
    if (faltam.size === 0) return;

    let cancelado = false;
    (async () => {
      setCarregandoPreview(true);
      const novosPngs = {};
      for (const idx of faltam) {
        if (cancelado) break;
        try {
          const png = await gerarPngArte(idx);
          if (png) novosPngs[idx] = png;
        } catch { /* ignore */ }
      }
      if (!cancelado) {
        setPngsCache(prev => ({ ...prev, ...novosPngs }));
        setCarregandoPreview(false);
      }
    })();
    return () => { cancelado = true; setCarregandoPreview(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, paginaPreview, qtdArtes, totalArtes, gerarPngArte, pngsCache, modoRepeticao]);

  // Reseta cache quando modal abre (config pode ter mudado)
  useEffect(() => {
    if (aberto) setPngsCache({});
  }, [aberto]);

  const aplicarPresetMargem = (preset) => {
    setMargemPreset(preset);
    setMargens(MARGENS_PRESETS[preset]);
  };

  const setMargemCampo = (campo, valor) => {
    setMargemPreset('custom');
    setMargens(prev => ({ ...prev, [campo]: Math.max(0, parseInt(valor) || 0) }));
  };

  // === Gera PDF ===
  const gerarPdf = async () => {
    if (!gerarPngArte) { alert('Geração de arte indisponível.'); return null; }
    const pdf = new jsPDF({
      orientation: orientacao === 'paisagem' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: papel.toLowerCase(),
    });

    for (let folha = 1; folha <= totalFolhas; folha++) {
      if (folha > 1) pdf.addPage();
      setProgresso({ atual: folha, total: totalFolhas });

      for (let slot = 0; slot < layout.posicoes.length; slot++) {
        const pos = layout.posicoes[slot];
        const numArte = numArteParaCelula(folha, slot);
        if (numArte == null) continue; // célula vazia (sequencial, última folha)
        // Usa cache; senão gera (re-renderiza canvas)
        let png = pngsCache[numArte];
        if (!png) {
          png = await gerarPngArte(numArte);
          if (png) {
            // Já que gerou, vai pro cache pra próxima célula reutilizar
            setPngsCache(prev => ({ ...prev, [numArte]: png }));
          }
        }
        if (png && png.length > 200) {
          // Aplica filtro de cor (cinza/PB) via canvas off-screen se necessário
          const pngFinal = (modoCor === 'colorido') ? png : await aplicarFiltroCor(png, modoCor);
          pdf.addImage(pngFinal || png, 'PNG', pos.x, pos.y, pos.w, pos.h);
          // Aba de dobra LATERAL — faixa vertical à direita da arte
          if (abaDobra && pos.abaW > 0) {
            // Fundo branco/cinza claro pra aba
            pdf.setFillColor(252, 252, 252);
            pdf.rect(pos.abaX, pos.abaY, pos.abaW, pos.abaH, 'F');
            // Linha pontilhada vertical separando arte da aba (linha de dobra)
            pdf.setLineDashPattern([1.5, 1], 0);
            pdf.setDrawColor(120, 120, 120);
            pdf.line(pos.abaX, pos.abaY, pos.abaX, pos.abaY + pos.abaH);
            pdf.setLineDashPattern([], 0);
            // Texto "↓ DOBRE AQUI" vertical na faixa (rotacionado 90° anti-horário)
            pdf.setFontSize(7);
            pdf.setTextColor(80, 80, 80);
            const cx = pos.abaX + pos.abaW / 2;
            const cy = pos.abaY + pos.abaH / 2;
            pdf.text('↓ DOBRE AQUI ↓', cx, cy, { align: 'center', angle: 90 });
          }
        }
      }
    }
    return pdf;
  };

  // Helper: aplica filtro cinza/P&B numa imagem via canvas
  async function aplicarFiltroCor(dataUrl, modo) {
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      // CSS filters disponíveis no canvas via ctx.filter
      ctx.filter = modo === 'pb'
        ? 'grayscale(1) contrast(1.6) brightness(0.95)'
        : 'grayscale(1)';
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch { return null; }
  }

  const salvarPdf = async () => {
    setGerando(true);
    setProgresso({ atual: 0, total: totalFolhas });
    try {
      const pdf = await gerarPdf();
      if (pdf) pdf.save(`${nomeProjeto}_${papel}_${qtdArtes}por-folha.pdf`);
    } catch (e) {
      console.error('[GestorImpressao]', e);
      alert('Erro ao gerar PDF: ' + (e.message || e));
    } finally { setGerando(false); setProgresso({ atual: 0, total: 0 }); }
  };

  const imprimirAgora = async () => {
    setGerando(true);
    setProgresso({ atual: 0, total: totalFolhas });
    try {
      const pdf = await gerarPdf();
      if (pdf) {
        const url = pdf.output('bloburl');
        const w = window.open(url, '_blank');
        // Após PDF carregar, dispara print automático
        if (w) setTimeout(() => { try { w.print(); } catch {} }, 800);
      }
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally { setGerando(false); setProgresso({ atual: 0, total: 0 }); }
  };

  if (!aberto) return null;

  return (
    <div className="gi-overlay">
      <div className="gi-app">
        {/* TOPO */}
        <div className="gi-topo">
          <button className="gi-voltar" onClick={aoFechar} disabled={gerando}>
            ← Voltar
          </button>
          <div className="gi-titulo">
            <div className="gi-logo-wrap">
              <span className="gi-logo">PP</span>
              <span className="gi-logo-glow" />
            </div>
            <div>
              <div className="gi-titulo-txt">
                Gestor de Impressões
                <span className="gi-beta">BETA</span>
              </div>
              <div className="gi-titulo-sub">Imprime seu encarte em folha A4/A3 com várias artes por página</div>
            </div>
          </div>
          <div className="gi-topo-spacer" />
          <div className="gi-topo-info">
            <span className="gi-mini-chip">{nomeProjeto}</span>
            <span className="gi-mini-chip">{totalArtes} {totalArtes === 1 ? 'arte' : 'artes'}</span>
          </div>
        </div>

        <div className="gi-corpo">
          {/* === SIDEBAR ESQUERDA: configs === */}
          <aside className="gi-sidebar">
            {/* Papel e Orientação */}
            <details open className="gi-secao">
              <summary><span className="gi-summary-icone">📄</span> Papel e Orientação</summary>
              <div className="gi-secao-conteudo">
                <div className="gi-label">TAMANHO DO PAPEL</div>
                <div className="gi-grid-papel">
                  {Object.entries(PAPEIS).map(([id, p]) => (
                    <button key={id}
                      data-papel={id}
                      className={`gi-papel-card ${papel === id ? 'ativo' : ''}`}
                      onClick={() => setPapel(id)}
                      type="button">
                      <div className="gi-papel-icone" />
                      <div className="gi-papel-nome">{p.nome}</div>
                      <div className="gi-papel-medida">{p.label}</div>
                    </button>
                  ))}
                </div>
                <div className="gi-label">ORIENTAÇÃO</div>
                <div className="gi-grid-orient">
                  <button type="button"
                    className={`gi-orient ${orientacao === 'retrato' ? 'ativo' : ''}`}
                    onClick={() => setOrientacao('retrato')}>
                    <div className="gi-orient-icone retrato" /> Retrato
                  </button>
                  <button type="button"
                    className={`gi-orient ${orientacao === 'paisagem' ? 'ativo' : ''}`}
                    onClick={() => setOrientacao('paisagem')}>
                    <div className="gi-orient-icone paisagem" /> Paisagem
                  </button>
                </div>
              </div>
            </details>

            {/* Artes por Folha */}
            <details open className="gi-secao">
              <summary><span className="gi-summary-icone">🔢</span> Artes por Folha</summary>
              <div className="gi-secao-conteudo">
                <div className="gi-label">QUANTIDADE DE ARTES POR FOLHA</div>
                <div className="gi-grid-qtd">
                  {QUANTIDADES_ARTES.map(q => (
                    <button key={q.qtd} type="button"
                      className={`gi-qtd-card ${qtdArtes === q.qtd ? 'ativo' : ''}`}
                      onClick={() => setQtdArtes(q.qtd)}>
                      {q.popular && <span className="gi-pop">Popular</span>}
                      <div className="gi-qtd-grade">
                        <IconeGradeArtes qtd={q.qtd} orientacao={orientacao} ativo={qtdArtes === q.qtd} />
                      </div>
                      <div className="gi-qtd-num">{q.qtd}</div>
                    </button>
                  ))}
                </div>
                <div className="gi-aviso">
                  ℹ️ <b>Distribuição automática:</b> {layout.rows} × {layout.cols} ({layout.rows * layout.cols} células) no papel {papel} {orientacao}, com aproveitamento máximo da arte.
                </div>
                {totalArtes === 1 && qtdArtes > 1 && (
                  <label className="gi-toggle-row" style={{ marginTop: 10 }}>
                    <div className="gi-toggle-txt">
                      <div className="gi-toggle-titulo">Repetir arte na folha</div>
                      <div className="gi-toggle-sub">Seu encarte tem só 1 arte. Quer imprimir múltiplas cópias da MESMA arte numa folha (economia de papel)?</div>
                    </div>
                    <div className={`gi-switch ${repetirArte ? 'on' : ''}`} onClick={() => setRepetirArte(!repetirArte)}>
                      <div className="gi-switch-knob" />
                    </div>
                  </label>
                )}
              </div>
            </details>

            {/* Cor */}
            <details className="gi-secao">
              <summary><span className="gi-summary-icone">🎨</span> Cor</summary>
              <div className="gi-secao-conteudo">
                <div className="gi-label">MODO DE COR</div>
                <div className="gi-grid-cor">
                  {[
                    { id: 'colorido', label: 'Colorido' },
                    { id: 'cinza', label: 'Cinza' },
                    { id: 'pb', label: 'P&B' },
                  ].map(c => (
                    <button key={c.id} type="button"
                      className={`gi-cor-card gi-cor-${c.id} ${modoCor === c.id ? 'ativo' : ''}`}
                      onClick={() => setModoCor(c.id)}>
                      <div className="gi-cor-amostra" />
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="gi-hint">
                  ℹ️ Modo cinza/P&B aplica filtro só no preview e no PDF. Útil pra economizar tinta em impressões teste.
                </div>
              </div>
            </details>

            {/* Aba de Dobra */}
            <details className="gi-secao">
              <summary><span className="gi-summary-icone">📐</span> Aba de Dobra (Cartaz)</summary>
              <div className="gi-secao-conteudo">
                <label className="gi-toggle-row">
                  <div className="gi-toggle-txt">
                    <div className="gi-toggle-titulo">Adicionar Aba "Dobre Aqui"</div>
                    <div className="gi-toggle-sub">Faixa dobrável no topo de cada arte — encaixa o cartaz nas gôndolas</div>
                  </div>
                  <div className={`gi-switch ${abaDobra ? 'on' : ''}`} onClick={() => setAbaDobra(!abaDobra)}>
                    <div className="gi-switch-knob" />
                  </div>
                  <input type="checkbox" checked={abaDobra} onChange={e => setAbaDobra(e.target.checked)} style={{ display: 'none' }} />
                </label>
              </div>
            </details>

            {/* Margens */}
            <details className="gi-secao">
              <summary><span className="gi-summary-icone">📏</span> Margens</summary>
              <div className="gi-secao-conteudo">
                <div className="gi-label">PREDEFINIÇÕES</div>
                <div className="gi-grid-margem">
                  {Object.entries(MARGENS_PRESETS).map(([id, m]) => (
                    <button key={id} type="button"
                      className={`gi-margem-btn ${margemPreset === id ? 'ativo' : ''}`}
                      onClick={() => aplicarPresetMargem(id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="gi-label">MARGENS PERSONALIZADAS (mm)</div>
                <div className="gi-grid-margem-custom">
                  {['top', 'bottom', 'left', 'right'].map(c => (
                    <div key={c} className="gi-campo">
                      <label>{c === 'top' ? 'SUPERIOR' : c === 'bottom' ? 'INFERIOR' : c === 'left' ? 'ESQUERDA' : 'DIREITA'}</label>
                      <input type="number" min="0" max="100" value={margens[c]}
                        onChange={e => setMargemCampo(c, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="gi-label" style={{ marginTop: 12 }}>ESPAÇAMENTO ENTRE ARTES (mm)</div>
                <div className="gi-range-wrap">
                  <input type="range" min="0" max="20" value={espacamento}
                    onChange={e => setEspacamento(parseInt(e.target.value))} className="gi-range" />
                  <span className="gi-range-valor">{espacamento}mm</span>
                </div>
                <div className="gi-hint">Margem interna aplicada entre as artes na folha.</div>
              </div>
            </details>
          </aside>

          {/* === PREVIEW CENTRAL === */}
          <main className="gi-preview">
            <div className="gi-preview-topo">
              <div className="gi-preview-titulo">PRÉ-VISUALIZAÇÃO</div>
              {totalFolhas > 1 && (
                <div className="gi-preview-paginacao">
                  <button onClick={() => setPaginaPreview(p => Math.max(1, p - 1))} disabled={paginaPreview <= 1}>‹</button>
                  <span>Página <b>{paginaPreview}</b> de <b>{totalFolhas}</b></span>
                  <button onClick={() => setPaginaPreview(p => Math.min(totalFolhas, p + 1))} disabled={paginaPreview >= totalFolhas}>›</button>
                </div>
              )}
              <div className="gi-preview-info">
                <span className="gi-chip">{papel} · {orientacao === 'retrato' ? 'Retrato' : 'Paisagem'}</span>
                <span className="gi-chip">{qtdArtes} por página</span>
                <span className="gi-chip verde">Arte: {layout.arteW.toFixed(0)} × {layout.arteH.toFixed(1)} mm</span>
              </div>
              <div className="gi-zoom">
                <button onClick={() => setZoomPreview(z => Math.max(0.2, +(z - 0.1).toFixed(2)))} title="Diminuir">−</button>
                <span className="gi-zoom-pct">{Math.round(zoomPreview * 100)}%</span>
                <button onClick={() => setZoomPreview(z => Math.min(2, +(z + 0.1).toFixed(2)))} title="Aumentar">+</button>
                <button onClick={() => setZoomPreview(0.65)} className="gi-zoom-fit">Ajustar</button>
              </div>
            </div>

            {/* PREVIEW DA FOLHA */}
            <div className="gi-preview-area">
              {carregandoPreview && (
                <div className="gi-preview-loading">
                  <div className="gi-spinner" />
                  <span>Gerando preview...</span>
                </div>
              )}
              <FolhaPreview
                layout={layout}
                zoom={zoomPreview}
                pagina={paginaPreview}
                modoCor={modoCor}
                abaDobra={abaDobra}
                pngsCache={pngsCache}
                numArteParaCelula={numArteParaCelula}
              />
            </div>
          </main>
        </div>

        {/* === FOOTER === */}
        <div className="gi-footer">
          <div className="gi-footer-info">
            <span><b>{qtdArtes}</b> encartes/folha</span>
            <span className="gi-footer-sep">·</span>
            <span>Arte <b>{layout.arteW.toFixed(0)} × {layout.arteH.toFixed(1)} mm</b></span>
            <span className="gi-footer-sep">·</span>
            <span>{papel} · {orientacao === 'retrato' ? 'Retrato' : 'Paisagem'}</span>
            <span className="gi-footer-sep">·</span>
            <span><b>{totalFolhas}</b> folha{totalFolhas !== 1 ? 's' : ''}</span>
            <span className="gi-footer-sep">·</span>
            <span>300 DPI · sRGB</span>
          </div>
          <div className="gi-footer-acoes">
            <button className="gi-btn gi-btn-secundario" onClick={aoFechar} disabled={gerando}>
              Voltar
            </button>
            <button className="gi-btn gi-btn-primario" onClick={salvarPdf} disabled={gerando}>
              {gerando ? (
                <>⏳ Folha {progresso.atual}/{progresso.total}...</>
              ) : (
                <>💾 Salvar PDF</>
              )}
            </button>
            <button className="gi-btn gi-btn-imprimir" onClick={imprimirAgora} disabled={gerando}>
              🖨️ Imprimir Agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Preview da folha (visual da página com as artes posicionadas) ===
function FolhaPreview({ layout, zoom, pagina, modoCor, abaDobra, pngsCache, numArteParaCelula }) {
  const mm = (v) => v * MM_TO_PX_PREVIEW * zoom;
  const folhaW = mm(layout.papel.largura);
  const folhaH = mm(layout.papel.altura);

  const filtroCor = modoCor === 'cinza' ? 'grayscale(1)'
    : modoCor === 'pb' ? 'grayscale(1) contrast(1.6) brightness(0.95)'
    : 'none';

  return (
    <div className="gi-folha" style={{ width: folhaW, height: folhaH }}>
      {/* Linhas de margem (guia visual sutil) */}
      <div className="gi-folha-margem" style={{
        left: mm(layout.areaUtil.x),
        top: mm(layout.areaUtil.y),
        width: mm(layout.areaUtil.w),
        height: mm(layout.areaUtil.h),
      }} />

      {layout.posicoes.map((pos, i) => {
        const numArte = numArteParaCelula(pagina, i);
        if (numArte == null) return null; // célula vazia
        const png = pngsCache[numArte];
        return (
          <div key={i}>
            <div className="gi-arte-celula" style={{
              left: mm(pos.x), top: mm(pos.y),
              width: mm(pos.w), height: mm(pos.h),
              filter: filtroCor,
            }}>
              {png ? (
                <img src={png} alt={`Arte ${numArte}`} className="gi-arte-png" />
              ) : (
                <div className="gi-arte-placeholder">
                  <div className="gi-arte-skeleton" />
                  <small>Carregando...</small>
                </div>
              )}
              <div className="gi-arte-num">{numArte}</div>
            </div>
            {/* Aba de dobra LATERAL — só renderiza se abaDobra e pos.abaW>0 */}
            {abaDobra && pos.abaW > 0 && (
              <div className="gi-arte-aba-lateral" style={{
                left: mm(pos.abaX), top: mm(pos.abaY),
                width: mm(pos.abaW), height: mm(pos.abaH),
              }}>
                <span className="gi-arte-aba-texto">↓ DOBRE AQUI ↓</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
