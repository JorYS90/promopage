import { useEffect, useMemo, useState } from 'react';

// Extrai o tom (HSL hue 0-360) DOMINANTE de uma imagem URL.
// Carrega async, desenha em canvas pequeno, calcula média ponderada das cores
// dos pixels NÃO-transparentes. Retorna { hue, sat, light, isNeutro }
// (isNeutro = true se sat baixa: preto/branco/cinza).
function extrairTomDominante(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const W = 32, H = 32;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        let data;
        try { data = ctx.getImageData(0, 0, W, H).data; }
        catch { resolve({ hue: 999, sat: 0, light: 0, isNeutro: true }); return; }
        let r = 0, g = 0, b = 0, total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 128) continue;  // ignora transparente
          // Pondera: cores SATURADAS pesam mais (descarta neutros/sombras)
          const px = [data[i], data[i + 1], data[i + 2]];
          const max = Math.max(...px), min = Math.min(...px);
          const peso = (max - min) + 1;  // saturação aproximada
          r += px[0] * peso;
          g += px[1] * peso;
          b += px[2] * peso;
          total += peso;
        }
        if (total === 0) { resolve({ hue: 999, sat: 0, light: 0, isNeutro: true }); return; }
        r /= total; g /= total; b /= total;
        // Converte RGB → HSL
        const rN = r / 255, gN = g / 255, bN = b / 255;
        const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
        const light = (max + min) / 2;
        let hue, sat;
        if (max === min) { hue = 0; sat = 0; }
        else {
          const d = max - min;
          sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case rN: hue = ((gN - bN) / d + (gN < bN ? 6 : 0)); break;
            case gN: hue = (bN - rN) / d + 2; break;
            default: hue = (rN - gN) / d + 4;
          }
          hue *= 60;
        }
        resolve({ hue, sat, light, isNeutro: sat < 0.20 });
      } catch {
        resolve({ hue: 999, sat: 0, light: 0, isNeutro: true });
      }
    };
    img.onerror = () => resolve({ hue: 999, sat: 0, light: 0, isNeutro: true });
    img.src = url;
  });
}

// Chave de ordenação por tom: neutros vão pro fim, coloridos ordenados por hue.
function chaveOrdenacao(tom) {
  if (!tom || tom.isNeutro) return 1000 + (tom?.light || 0);  // neutros depois
  return tom.hue;
}

// Modal pra escolher a ETIQUETA (balão de oferta / tag de preço) do produto.
// Mostra TODOS os balões de TODOS os temas existentes + uma biblioteca built-in.
// Permite aplicar em destaques, posição, produto único ou encarte inteiro.
//
// Inclui também o toggle "Tamanho da Fonte de Preço" (config do encarte):
//   - OFF (padrão): centavos menores que o real (estilo "13,99" → "13" grande, ",99" pequeno)
//   - ON: ambos do mesmo tamanho

// Galeria de balões agora vem APENAS dos temas (sem built-ins).
// Cada tema cadastrado pode subir seu próprio PNG/SVG de balão.
const BALOES_BUILTIN = [];

// Aplicar em (radio behavior, mas visual de checkbox)
const APLICAR_OPCOES = [
  { id: 'destaques', label: 'Aplicar aos destaques' },
  { id: 'posicao',   label: 'Aplicar à posição' },
  { id: 'produto',   label: 'Aplicar ao produto' },
  { id: 'encarte',   label: 'Aplicar ao encarte' },
];

export default function ModalEtiqueta({
  produto, idx,
  configs,                  // configs do encarte (pra precoCentavosMesmoTamanho)
  destaqueIndices = [],     // índices dos produtos em boxes de destaque na grade atual
  aoMudar, aoMudarMultiplos,
  aoMudarConfigs,           // pra atualizar configs do encarte
  aoFechar,
}) {
  const [aplicarEm, setAplicarEm] = useState('produto');
  // Balão atualmente selecionado
  const [balaoEscolhido, setBalaoEscolhido] = useState(produto.balaoCustom || '');
  // "Sem balão" — usa pílula vermelha padrão (valor especial '__padrao__')
  const [usarPadrao, setUsarPadrao] = useState(!produto.balaoCustom);
  // Toggle do tamanho da fonte de preço (config do encarte)
  const [centavosMesmoTamanho, setCentavosMesmoTamanho] = useState(
    configs?.precoCentavosMesmoTamanho ?? false
  );

  // Balões custom (de templates criados pelo usuário)
  const [baloesCustom, setBaloesCustom] = useState([]);
  // Map URL → { hue, sat, light, isNeutro } (preenchido async ao carregar a lista)
  const [tons, setTons] = useState({});

  useEffect(() => {
    fetch('/api/baloes-tema')
      .then(r => r.json())
      .then(data => setBaloesCustom(data.baloes || []))
      .catch(() => setBaloesCustom([]));
  }, []);

  // Lista combinada + DEDUP por URL (templates diferentes podem usar mesmo balão)
  const baloesRaw = useMemo(() => {
    const visto = new Set();
    const lista = [];
    for (const b of [...BALOES_BUILTIN, ...baloesCustom.map(b => ({ url: b.url, nome: b.temaNome || 'Customizado', custom: true }))]) {
      if (!b.url || visto.has(b.url)) continue;
      visto.add(b.url);
      lista.push(b);
    }
    return lista;
  }, [baloesCustom]);

  // Extrai tom dominante de cada balão assim que a lista chega (uma vez por URL).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      for (const b of baloesRaw) {
        if (!b.url || tons[b.url]) continue;
        const tom = await extrairTomDominante(b.url);
        if (cancelado) return;
        setTons(prev => ({ ...prev, [b.url]: tom }));
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baloesRaw]);

  // Lista ORDENADA por tom: vermelho → laranja → amarelo → verde → ciano → azul → roxo → magenta → neutros
  const todosBaloes = useMemo(() => {
    // Espera todos os tons serem carregados antes de ordenar (evita re-shuffle visual chato)
    const todosCarregados = baloesRaw.every(b => tons[b.url]);
    if (!todosCarregados) return baloesRaw;
    return [...baloesRaw].sort((a, b) => {
      const ka = chaveOrdenacao(tons[a.url]);
      const kb = chaveOrdenacao(tons[b.url]);
      return ka - kb;
    });
  }, [baloesRaw, tons]);

  const escolherBalao = (url) => {
    setBalaoEscolhido(url);
    setUsarPadrao(false);
  };

  const escolherPadrao = () => {
    setBalaoEscolhido('');
    setUsarPadrao(true);
  };

  const resetar = () => {
    setBalaoEscolhido('');
    setUsarPadrao(true);
    setCentavosMesmoTamanho(false);
  };

  const salvar = () => {
    // Atualiza config do encarte (afeta todos os produtos visualmente)
    if (aoMudarConfigs && centavosMesmoTamanho !== (configs?.precoCentavosMesmoTamanho ?? false)) {
      aoMudarConfigs(prev => ({ ...prev, precoCentavosMesmoTamanho: centavosMesmoTamanho }));
    }

    const novosDados = {
      balaoCustom: usarPadrao ? '' : balaoEscolhido,
    };
    if (aplicarEm === 'encarte') {
      aoMudarMultiplos(() => true, novosDados);
    } else if (aplicarEm === 'destaques') {
      // Aplica nos produtos cujo box é destaque na grade ATIVA.
      // Antes era hardcoded `i < 2` — quebrava em grades com destaque em outras posições
      // (ex: g_6_dest_topo_baixo_stories tem destaques em 0 e 5).
      const setDestaques = new Set(destaqueIndices);
      aoMudarMultiplos((p, i) => setDestaques.has(i), novosDados);
    } else if (aplicarEm === 'posicao') {
      const meuMod = idx % 2;
      aoMudarMultiplos((p, i) => i % 2 === meuMod, novosDados);
    } else {
      aoMudar(idx, { ...produto, ...novosDados });
    }
    aoFechar();
  };

  // Componente de thumbnail do balão (com mock R$ 13,99 KG sobreposto)
  const ThumbBalao = ({ url, ativo, onClick }) => (
    <button
      className={`et-thumb ${ativo ? 'ativo' : ''}`}
      onClick={onClick}
      title={url}
    >
      <div className="et-balao" style={url ? { backgroundImage: `url(${url})` } : null}>
        {!url && <span className="et-balao-padrao-bg" />}
        <span className="et-balao-rs">R$</span>
        <span className="et-balao-valor">13,99</span>
        <span className="et-balao-un">KG</span>
      </div>
    </button>
  );

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-etiqueta" onClick={e => e.stopPropagation()}>
        <button className="cf-fechar" onClick={aoFechar} aria-label="Fechar">✕</button>

        <div className="et-conteudo">
          {/* Aplicar em */}
          <div className="cf-secao">
            <div className="cf-titulo">Aplicar em:</div>
            {APLICAR_OPCOES.map(opt => (
              <label key={opt.id} className="cf-radio">
                <input
                  type="checkbox"
                  checked={aplicarEm === opt.id}
                  onChange={() => setAplicarEm(opt.id)}
                />
                <span>{opt.label}</span>
                {opt.id === 'encarte' && (
                  <button
                    type="button"
                    className="cf-resetar"
                    onClick={(e) => { e.preventDefault(); resetar(); }}
                  >
                    ✕ Resetar
                  </button>
                )}
              </label>
            ))}
          </div>

          {/* Tamanho da Fonte de Preço */}
          <div className="cf-secao">
            <div className="cf-titulo">Tamanho da Fonte de Preço</div>
            <div className="et-explicacao">
              Por padrão, a fonte dos <b>Centavos</b> é um pouco menor que do <b>Real</b>.
              Você pode optar por deixá-los do mesmo tamanho.
              <br />A opção será aplicada a todos os produtos deste encarte.
            </div>
            <label className="et-toggle-wrap">
              <input
                type="checkbox"
                checked={centavosMesmoTamanho}
                onChange={e => setCentavosMesmoTamanho(e.target.checked)}
                className="et-toggle-input"
              />
              <span className="et-toggle-slider" />
              <span className="et-toggle-label">Fontes no mesmo tamanho</span>
            </label>
          </div>

          {/* Galeria de etiquetas */}
          <div className="cf-secao">
            <div className="cf-titulo">Etiquetas:</div>
            <div className="et-grid">
              {/* Padrão (pílula vermelha do tema) */}
              <ThumbBalao
                url=""
                ativo={usarPadrao}
                onClick={escolherPadrao}
              />
              {/* Built-ins + custom */}
              {todosBaloes.map((b, i) => (
                <ThumbBalao
                  key={`${b.url}-${i}`}
                  url={b.url}
                  ativo={!usarPadrao && balaoEscolhido === b.url}
                  onClick={() => escolherBalao(b.url)}
                />
              ))}
            </div>
          </div>

          {/* Salvar */}
          <button className="cf-btn-salvar" onClick={salvar}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
