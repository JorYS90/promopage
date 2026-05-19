import { useEffect, useRef, useState } from 'react';
import { removerFundoDeUrl, uploadBlobProcessado } from '../editor/remover-fundo.js';

// Modal que abre depois do upload da logo. Mostra preview, permite recortar
// (drag dos cantos) e oferece remoção automática do fundo.
//
// Props:
//   urlOriginal — URL da imagem recém-uploaded
//   aoFechar    — fecha sem aplicar (descarta o upload)
//   aoSalvar(novaUrl) — confirma e retorna a URL final
export default function ModalRecortarLogo({ urlOriginal, aoFechar, aoSalvar, fetchAuth }) {
  // Crop em valores 0..1 (fração da imagem)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [removerFundo, setRemoverFundo] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState('');
  // Tamanho natural da imagem (carregado async)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = urlOriginal;
  }, [urlOriginal]);

  // Helpers de drag — converte mouse delta em delta de crop (0..1)
  const obterRetImg = () => containerRef.current?.querySelector('.mrl-img-wrap')?.getBoundingClientRect();

  const aoMouseDown = (e, tipo) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = obterRetImg();
    if (!rect) return;
    dragRef.current = {
      tipo,
      startCrop: { ...crop },
      startMouse: { x: e.clientX, y: e.clientY },
      rect,
    };
    window.addEventListener('mousemove', aoMouseMove);
    window.addEventListener('mouseup', aoMouseUp);
  };

  const aoMouseMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startMouse.x) / d.rect.width;
    const dy = (e.clientY - d.startMouse.y) / d.rect.height;
    const min = 0.05;
    let novo = { ...d.startCrop };
    if (d.tipo === 'mover') {
      novo.x = Math.max(0, Math.min(1 - d.startCrop.w, d.startCrop.x + dx));
      novo.y = Math.max(0, Math.min(1 - d.startCrop.h, d.startCrop.y + dy));
    } else if (d.tipo === 'tl') {
      const nx = Math.max(0, Math.min(d.startCrop.x + d.startCrop.w - min, d.startCrop.x + dx));
      const ny = Math.max(0, Math.min(d.startCrop.y + d.startCrop.h - min, d.startCrop.y + dy));
      novo.w = d.startCrop.x + d.startCrop.w - nx;
      novo.h = d.startCrop.y + d.startCrop.h - ny;
      novo.x = nx;
      novo.y = ny;
    } else if (d.tipo === 'tr') {
      const ny = Math.max(0, Math.min(d.startCrop.y + d.startCrop.h - min, d.startCrop.y + dy));
      const nw = Math.max(min, Math.min(1 - d.startCrop.x, d.startCrop.w + dx));
      novo.y = ny;
      novo.h = d.startCrop.y + d.startCrop.h - ny;
      novo.w = nw;
    } else if (d.tipo === 'bl') {
      const nx = Math.max(0, Math.min(d.startCrop.x + d.startCrop.w - min, d.startCrop.x + dx));
      const nh = Math.max(min, Math.min(1 - d.startCrop.y, d.startCrop.h + dy));
      novo.x = nx;
      novo.w = d.startCrop.x + d.startCrop.w - nx;
      novo.h = nh;
    } else if (d.tipo === 'br') {
      novo.w = Math.max(min, Math.min(1 - d.startCrop.x, d.startCrop.w + dx));
      novo.h = Math.max(min, Math.min(1 - d.startCrop.y, d.startCrop.h + dy));
    }
    setCrop(novo);
  };

  const aoMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener('mousemove', aoMouseMove);
    window.removeEventListener('mouseup', aoMouseUp);
  };

  const cropFoiAlterado = !(crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1);

  const confirmar = async () => {
    if (processando) return;
    setProcessando(true);
    setProgresso('preparando...');
    try {
      let urlAtual = urlOriginal;

      // 1. Aplica crop SE foi alterado (caso contrário, pula essa etapa)
      if (cropFoiAlterado) {
        setProgresso('recortando...');
        const img = await carregarImagem(urlOriginal);
        const cw = Math.round(img.naturalWidth * crop.w);
        const ch = Math.round(img.naturalHeight * crop.h);
        const cx = Math.round(img.naturalWidth * crop.x);
        const cy = Math.round(img.naturalHeight * crop.y);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
        const blobCrop = await new Promise(r => canvas.toBlob(r, 'image/png', 1));
        urlAtual = await uploadBlobProcessado(blobCrop, 'logo-recortada.png', fetchAuth);
      }

      // 2. (opcional) Remover fundo
      if (removerFundo) {
        setProgresso('removendo fundo...');
        const blobSemFundo = await removerFundoDeUrl(urlAtual, {
          onProgress: (etapa, atual, total) => {
            setProgresso(`removendo fundo... ${etapa} ${Math.round((atual / total) * 100)}%`);
          },
        });
        urlAtual = await uploadBlobProcessado(blobSemFundo, 'logo-sem-fundo.png', fetchAuth);
      }

      aoSalvar(urlAtual);
      aoFechar();
    } catch (e) {
      console.error('[recortar logo]', e);
      alert('Erro ao processar: ' + (e?.message || 'desconhecido'));
    } finally {
      setProcessando(false);
      setProgresso('');
    }
  };

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="mrl-modal" onClick={e => e.stopPropagation()}>
        <div className="mrl-area" ref={containerRef}>
          {/* Wrapper com aspect-ratio da imagem — garante que o crop fique alinhado */}
          <div
            className="mrl-img-wrap"
            style={imgSize.w && imgSize.h
              ? { aspectRatio: `${imgSize.w} / ${imgSize.h}` }
              : undefined}
          >
            <img className="mrl-img" src={urlOriginal} alt="Logo" draggable={false} />
            {/* Caixa de crop com handles nos 4 cantos */}
            <div
              className="mrl-crop"
              style={{
                left:   `${crop.x * 100}%`,
                top:    `${crop.y * 100}%`,
                width:  `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
              onMouseDown={(e) => aoMouseDown(e, 'mover')}
            >
              <span className="mrl-handle tl" onMouseDown={(e) => aoMouseDown(e, 'tl')} />
              <span className="mrl-handle tr" onMouseDown={(e) => aoMouseDown(e, 'tr')} />
              <span className="mrl-handle bl" onMouseDown={(e) => aoMouseDown(e, 'bl')} />
              <span className="mrl-handle br" onMouseDown={(e) => aoMouseDown(e, 'br')} />
            </div>
          </div>
        </div>

        <div className="mrl-toolbar">
          <label className="mrl-checkbox">
            <input
              type="checkbox"
              checked={removerFundo}
              onChange={(e) => setRemoverFundo(e.target.checked)}
            />
            <span>Remover Fundo da Imagem</span>
          </label>

          <div className="mrl-acoes">
            <button
              type="button"
              className="mrl-btn mrl-btn-cancel"
              onClick={aoFechar}
              disabled={processando}
              title="Cancelar"
            >✕</button>
            <button
              type="button"
              className="mrl-btn mrl-btn-ok"
              onClick={confirmar}
              disabled={processando}
              title="Confirmar"
            >
              {processando ? '⏳' : '✓'}
            </button>
          </div>

          {processando && (
            <div className="mrl-progresso">{progresso}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
