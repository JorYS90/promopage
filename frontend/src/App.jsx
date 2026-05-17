import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { PAGE_SIZES, createCanvas, renderizarEncarte, exportarPNG } from './editor/editor.js';
import { LAYOUTS_NOMEADOS } from './editor/auto-layout.js';
import { removerFundoDeUrl, uploadBlobProcessado } from './editor/remover-fundo.js';
import SidebarIcons from './components/SidebarIcons.jsx';
import Topbar from './components/Topbar.jsx';
import ConfigBar from './components/ConfigBar.jsx';
import PainelTemas from './components/PainelTemas.jsx';
import PainelProdutos from './components/PainelProdutos.jsx';
import PainelEmpresa from './components/PainelEmpresa.jsx';
import PainelDatas from './components/PainelDatas.jsx';
import PainelLogo from './components/PainelLogo.jsx';
import PainelFontes from './components/PainelFontes.jsx';
import PainelPostar from './components/PainelPostar.jsx';
import PainelEncarte from './components/PainelEncarte.jsx';
import ModalEditarProdutos from './components/ModalEditarProdutos.jsx';
import OverlayProduto from './components/OverlayProduto.jsx';
import ModalCorFundo from './components/ModalCorFundo.jsx';
import ModalEtiqueta from './components/ModalEtiqueta.jsx';
import ModalMinhasCampanhas from './components/ModalMinhasCampanhas.jsx';
import { useAuth } from './auth/useAuth.js';
import ModalAuth from './auth/ModalAuth.jsx';
import ModalMeusInteresses from './auth/ModalMeusInteresses.jsx';
import ModalContaUsuario from './auth/ModalContaUsuario.jsx';
import ModalPlanos from './auth/ModalPlanos.jsx';
import PainelAdmin from './admin/PainelAdmin.jsx';
import ModalPreviewLayouts from './preview-layouts/ModalPreviewLayouts.jsx';

const CONFIGS_DEFAULT = {
  modelo: 'FACEBOOK_QUADRADO',  // Encarte feed Facebook quadrado (default)
  grade: 'automatico',
  boxes: 'inteligente',
  texto: 'medio',
  cores: 'inteligente',
  gerarCapa: true,  // SEMPRE true — não há opção "sem capa"
  rodape: 'redondo-grande',
  zoom: 'auto',
};

export default function App() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasFabric, setCanvasFabric] = useState(null);

  const [aba, setAba] = useState('produtos');
  const [configs, setConfigs] = useState(CONFIGS_DEFAULT);
  const [tema, setTema] = useState(null);
  const [temaId, setTemaId] = useState(null);
  const [produtos, setProdutos] = useState([]);
  // Dados da empresa (carregados de localStorage no mount; atualizados pelo PainelEmpresa)
  const [empresa, setEmpresa] = useState(() => {
    try {
      const raw = localStorage.getItem('encarte-builder:empresa');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  // Datas e regras adicionais (similar ao empresa)
  const [datas, setDatas] = useState(() => {
    try {
      const raw = localStorage.getItem('encarte-builder:datas');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  // Logo da empresa (URL + opções de fundo/posição/tamanho)
  const [logo, setLogo] = useState(() => {
    try {
      const raw = localStorage.getItem('encarte-builder:logo');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  // Fontes customizadas por target (nome / preco / frase / rodape)
  const [fontes, setFontes] = useState(() => {
    try {
      const raw = localStorage.getItem('encarte-builder:fontes');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  // Trigger pra re-renderizar quando Google Fonts terminarem de carregar
  // (necessário pra medições corretas de largura no canvas)
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  // === Autenticação SaaS ===
  const auth = useAuth();
  const [modalAuth, setModalAuth] = useState({ aberto: false, modo: 'login' });
  // Modal de "Meus Interesses" — aberto automaticamente após signup (modoSignup=true)
  // ou via dropdown do usuário. Persistido por user no DB.
  const [modalInteresses, setModalInteresses] = useState({ aberto: false, signup: false });
  const [modalConta, setModalConta] = useState({ aberto: false, aba: 'perfil' });
  const [modalPlanos, setModalPlanos] = useState(false);
  const [modalAdmin, setModalAdmin] = useState(false);
  // Modal de preview dos novos layouts SaaS propostos
  const [modalPreviewLayouts, setModalPreviewLayouts] = useState(false);
  // Slug do plano atual (vindo de /api/users/me/subscription) — atualiza pra
  // marcar "SEU PLANO" no card e desabilitar o botão Assinar do plano ativo.
  const [planoAtualSlug, setPlanoAtualSlug] = useState(null);

  // Quando o user muda (login/logout), atualiza o plano atual
  useEffect(() => {
    if (!auth.user) { setPlanoAtualSlug(null); return; }
    auth.fetchAuth('/api/users/me/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(d => setPlanoAtualSlug(d?.subscription?.plan_slug || null))
      .catch(() => setPlanoAtualSlug(null));
  }, [auth.user, auth.fetchAuth]);

  const [modalEditar, setModalEditar] = useState(false);
  const [modalCampanhas, setModalCampanhas] = useState(false);
  const [qtdCampanhas, setQtdCampanhas] = useState(0);
  const [nomeProjeto, setNomeProjeto] = useState('Encarte sem nome');
  const [projetoId, setProjetoId] = useState(null);
  // Metadados extras do encarte (aba "Encarte"): observações e categoria
  const [observacoes, setObservacoes] = useState('');
  const [categoria, setCategoria] = useState('');

  // Carrega contagem de campanhas pra mostrar no badge da Topbar
  useEffect(() => {
    const carregarQtd = async () => {
      try {
        const r = await fetch('/api/projetos');
        if (!r.ok) return;
        const lista = await r.json();
        setQtdCampanhas(Array.isArray(lista) ? lista.length : 0);
      } catch {}
    };
    carregarQtd();
    // Recarrega quando o modal de campanhas fechar (pode ter excluído/duplicado)
  }, [modalCampanhas]);

  // Carrega um projeto salvo no app — substitui todos os states relevantes
  const carregarProjeto = (projeto) => {
    if (!projeto) return;
    if (projeto.id) setProjetoId(projeto.id);
    if (projeto.nome) setNomeProjeto(projeto.nome);
    if (projeto.tema) setTemaId(projeto.tema);
    if (projeto.configs) setConfigs({ ...CONFIGS_DEFAULT, ...projeto.configs });
    if (Array.isArray(projeto.produtos)) setProdutos(projeto.produtos);
    setObservacoes(projeto.observacoes || '');
    setCategoria(projeto.categoria || '');
    setPaginaAtual(0);
  };

  // Reseta o app pra um novo encarte (limpa state mas mantém tema/empresa)
  const criarNovo = () => {
    setProjetoId(null);
    setNomeProjeto('Encarte sem nome');
    setProdutos([]);
    setConfigs(CONFIGS_DEFAULT);
    setObservacoes('');
    setCategoria('');
    setPaginaAtual(0);
  };

  // Volta pra "home" — clicar no logo da topbar.
  // Comportamento: confirma se tiver trabalho não salvo, depois reseta pro estado inicial.
  const voltarHome = () => {
    const temTrabalho = produtos.length > 0 || projetoId;
    if (temTrabalho) {
      const ok = confirm('Voltar pra página inicial?\n\nSeu trabalho atual será descartado se não foi salvo.');
      if (!ok) return;
    }
    criarNovo();
    setAba('produtos');
    // Fecha qualquer modal aberto
    setModalCampanhas(false);
    setModalConta({ aberto: false, aba: 'perfil' });
    setModalPlanos(false);
    setModalAdmin(false);
  };

  // Página atual da paginação (0-indexed)
  const [paginaAtual, setPaginaAtual] = useState(0);

  // Tamanho do canvas a partir do modelo
  const tamanho = PAGE_SIZES[configs.modelo] || PAGE_SIZES.A4_RETRATO;

  // ---------- Paginação ----------
  // Quando a grade tem MENOS slots que a quantidade total de produtos, divide
  // automaticamente em múltiplas páginas (igual qrofertas).
  // - Grade "1 Produto" + 18 produtos = 18 páginas
  // - Grade "8 Produtos - 4x2" + 18 produtos = 3 páginas (2 cheias + 1 com 2)
  // - Grade "Automático" + até 20 produtos = 1 página
  // - Grade "Automático" + 21+ produtos = quebra em páginas de 20 (cards não
  //   ficam minúsculos por causa de excesso de produtos numa página só)
  const LIMITE_AUTOMATICO = 20;
  const layoutAtual = LAYOUTS_NOMEADOS.find(l => l.id === configs.grade);
  let produtosPorPagina;
  if (layoutAtual && layoutAtual.quantidade) {
    produtosPorPagina = layoutAtual.quantidade;
  } else if (configs.grade === 'automatico' && produtos.length > LIMITE_AUTOMATICO) {
    produtosPorPagina = LIMITE_AUTOMATICO;
  } else {
    produtosPorPagina = produtos.length || 1;
  }
  const totalPaginas = Math.max(1, Math.ceil(produtos.length / produtosPorPagina));
  // Slice da página atual — useMemo pra evitar criar nova array a cada render
  // (sem isso, o canvas re-renderizaria a cada hover do produto, causando flicker)
  const produtosDaPagina = useMemo(() => {
    return produtos.slice(
      paginaAtual * produtosPorPagina,
      (paginaAtual + 1) * produtosPorPagina
    );
  }, [produtos, paginaAtual, produtosPorPagina]);

  // Reset pra página 1 quando grade muda OU número de produtos diminui abaixo da página atual
  useEffect(() => {
    if (paginaAtual >= totalPaginas) setPaginaAtual(0);
  }, [configs.grade, produtos.length, totalPaginas, paginaAtual]);

  // ---------- Inicialização do canvas ----------
  useEffect(() => {
    if (!canvasRef.current) return;
    const c = createCanvas(canvasRef.current, tamanho.largura, tamanho.altura);

    // Aguarda fontes locais (Anton, Bebas Neue) carregarem antes do 1º render
    // Isso garante que medidas de largura no canvas estejam corretas.
    const init = async () => {
      try { await document.fonts.ready; } catch {}
      setCanvasFabric(c);
      // Carrega tema padrão automaticamente.
      // Ordem: teste-3x (default escolhido pelo user) → demais variantes → fallback.
      const idsTentar = ['teste-3x', 'ofertao-do-dia', 'ofertao-2x', 'ofertao'];
      let temaCarregado = false;
      for (const id of idsTentar) {
        try {
          const r = await fetch(`/api/templates/${id}`);
          if (r.ok) {
            const t = await r.json();
            setTema(t);
            setTemaId(id);
            temaCarregado = true;
            break;
          }
        } catch {}
      }
      // Fallback: se nenhum tema preferido existe, pega o primeiro disponível
      if (!temaCarregado) {
        try {
          const r = await fetch('/api/templates');
          if (r.ok) {
            const lista = await r.json();
            const primeiro = Array.isArray(lista) && lista[0];
            if (primeiro?.id) {
              const tr = await fetch(`/api/templates/${primeiro.id}`);
              if (tr.ok) {
                const t = await tr.json();
                setTema(t);
                setTemaId(primeiro.id);
              }
            }
          }
        } catch {}
      }
    };
    init();

    return () => c.dispose();
  }, []);

  // Atualiza dimensões do canvas quando o modelo muda
  useEffect(() => {
    // Guard extra: HMR pode deixar canvasFabric existindo mas com lowerCanvasEl
    // descartado (zerado pelo dispose). setWidth tenta setar prop em undefined → crash.
    if (!canvasFabric || !canvasFabric.lowerCanvasEl) return;
    try {
      canvasFabric.setWidth(tamanho.largura);
      canvasFabric.setHeight(tamanho.altura);
      aplicarZoom();
    } catch (e) {
      console.warn('[canvas resize] falhou (canvas provavelmente descartado por HMR):', e?.message);
    }
  }, [tamanho.largura, tamanho.altura, canvasFabric]);

  // Aplica zoom calculado.
  // Modo 'auto': calcula o maior zoom que CABE no container (largura E altura).
  // Antes só considerava largura — em formatos verticais (STORIES, A4) o final
  // do encarte ficava abaixo da viewport. Agora usa min(ratioW, ratioH) e tem
  // listener de resize pra reagir quando o usuário maximiza/redimensiona a janela.
  const aplicarZoom = () => {
    // Guard contra canvas descartado por HMR
    if (!canvasFabric || !canvasFabric.lowerCanvasEl) return;
    let zoom = 0.6;
    if (configs.zoom === 'auto') {
      const cont = containerRef.current;
      const dispW = (cont?.clientWidth || 800) - 40;
      // Altura disponível: usa clientHeight do container OU 80% da viewport como fallback.
      const dispH = (cont?.clientHeight || Math.floor(window.innerHeight * 0.80)) - 40;
      const ratioW = dispW / tamanho.largura;
      const ratioH = dispH / tamanho.altura;
      // Cabe nos DOIS eixos, cap em 1.0 pra não ampliar além do tamanho real.
      zoom = Math.min(1, ratioW, ratioH);
      // Piso mínimo pra não ficar minúsculo em telas muito pequenas
      zoom = Math.max(0.15, zoom);
    } else {
      zoom = parseFloat(configs.zoom) || 0.6;
    }
    try {
      canvasFabric.setZoom(zoom);
      canvasFabric.setWidth(tamanho.largura * zoom);
      canvasFabric.setHeight(tamanho.altura * zoom);
      canvasFabric.requestRenderAll();
    } catch (e) {
      console.warn('[aplicarZoom] falhou:', e?.message);
    }
  };

  useEffect(() => { aplicarZoom(); }, [configs.zoom, tamanho.largura, tamanho.altura, canvasFabric]);

  // Recalcula zoom quando a janela redimensiona (só em modo 'auto')
  useEffect(() => {
    if (configs.zoom !== 'auto') return;
    let raf = null;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => aplicarZoom());
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [configs.zoom, tamanho.largura, tamanho.altura, canvasFabric]);

  // Re-renderiza encarte sempre que algo muda (incluindo página atual)
  useEffect(() => {
    if (!canvasFabric) return;
    renderizarEncarte(canvasFabric, {
      tema,
      produtos: produtosDaPagina,  // só os produtos da página atual
      configs,
      empresa,  // dados da empresa (telefone, whatsapp, etc) com toggles de visibilidade
      datas,    // datas/regras (período de oferta, frase promocional, advertências)
      logo,     // logo customizado (sobreposto à capa)
      fontes,   // fontes customizadas por target (nome/preco/frase/rodape)
      // Quando o usuário move/redimensiona a logo direto no canvas, persiste os novos valores.
      // Safety: só persiste se delta tem números finitos (evita corromper estado).
      aoMudarLogo: (delta) => {
        if (!delta) return;
        const validos =
          Number.isFinite(delta.x) &&
          Number.isFinite(delta.y) &&
          Number.isFinite(delta.escala) &&
          delta.escala > 0;
        if (!validos) return;
        setLogo(prev => {
          const novo = { ...(prev || {}), ...delta };
          try { localStorage.setItem('encarte-builder:logo', JSON.stringify(novo)); } catch {}
          return novo;
        });
      },
      aoClicarBox: (idx) => {
        // idx é local da página — converte pro idx GLOBAL na lista de produtos
        const idxGlobal = paginaAtual * produtosPorPagina + idx;
        setModalEditar({ aberto: true, foco: idxGlobal });
      },
      aoClicarPlaceholder: () => setAba('produtos'),
      // Watermark de bloqueio:
      // - Tema gratis (Ofertão do Dia) → sempre sem watermark
      // - Cliente com assinatura ATIVA OU admin/super_admin → sem watermark
      // - Resto (deslogado, ou logado sem assinatura paga) → COM watermark
      gratis: !!tema?.gratis,
      temAcesso: (
        !!planoAtualSlug ||
        auth.user?.role_nome === 'admin' ||
        auth.user?.role_nome === 'super_admin'
      ),
    });
  }, [canvasFabric, tema, produtosDaPagina, configs, empresa, datas, logo, fontes, fontsLoadedTick, paginaAtual, produtosPorPagina, planoAtualSlug, auth.user]);

  // Quando o user troca de fonte (state.fontes muda), aguarda o Google Font carregar
  // de fato e dispara um re-render explícito pra que as medições no canvas usem a
  // métrica correta da fonte (e o auto-shrink calcule largura certinho).
  useEffect(() => {
    if (!fontes) return;
    if (!document.fonts || !document.fonts.load) return;
    const ids = [fontes.nome, fontes.preco, fontes.frase, fontes.rodape].filter(Boolean);
    if (ids.length === 0) return;
    Promise.all(ids.map(id => document.fonts.load(`900 32px "${id}"`).catch(() => null)))
      .then(() => setFontsLoadedTick(t => t + 1));
  }, [fontes]);

  // ---------- Overlay de hover sobre produtos ----------
  // Mostra menu flutuante com 4 ações (cor, preço, etiqueta, desconto)
  // quando o usuário passa o mouse sobre um card.
  const [hoverProduto, setHoverProduto] = useState(null); // { idx, x, y } ou null
  const hoverHideTimerRef = useRef(null);
  // Modal de cor de fundo (idx do produto sendo editado, ou null)
  const [modalCorFundoIdx, setModalCorFundoIdx] = useState(null);
  // Modal de etiqueta/balão (idx do produto sendo editado, ou null)
  const [modalEtiquetaIdx, setModalEtiquetaIdx] = useState(null);

  useEffect(() => {
    if (!canvasFabric) return;

    const cancelarHide = () => {
      if (hoverHideTimerRef.current) {
        clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = null;
      }
    };
    const agendarHide = () => {
      cancelarHide();
      hoverHideTimerRef.current = setTimeout(() => setHoverProduto(null), 300);
    };

    const onMouseOver = (opt) => {
      const target = opt.target;
      if (!target || target.boxIdx === undefined) return;
      cancelarHide();
      const idx = target.boxIdx;
      // Acha o RETÂNGULO de fundo desse card (o objeto fundo, que tem o tamanho total)
      const fundo = canvasFabric.getObjects().find(o =>
        o.boxIdx === idx && o.type === 'rect' && (o.width >= 50 && o.height >= 50)
      );
      if (!fundo) return;
      // Converte coords do canvas pra coords da tela
      const canvasEl = canvasFabric.upperCanvasEl;
      const rect = canvasEl.getBoundingClientRect();
      const zoom = canvasFabric.getZoom();
      setHoverProduto({
        idx,
        x: rect.left + fundo.left * zoom,
        y: rect.top + fundo.top * zoom,
      });
    };

    const onMouseOut = (opt) => {
      // Mouse saiu de um objeto Fabric. Pode ter ido pro overlay (que está em
      // cima do canvas) — nesse caso, o overlay's onMouseEnter cancela o hide.
      if (opt.target?.boxIdx !== undefined) agendarHide();
    };

    canvasFabric.on('mouse:over', onMouseOver);
    canvasFabric.on('mouse:out', onMouseOut);

    return () => {
      canvasFabric.off('mouse:over', onMouseOver);
      canvasFabric.off('mouse:out', onMouseOut);
      cancelarHide();
    };
  }, [canvasFabric]);

  // Handlers passados ao overlay pra manter o menu visível enquanto o mouse
  // está em cima dele
  const overlayHandlers = {
    onMouseEnter: () => {
      if (hoverHideTimerRef.current) {
        clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = null;
      }
    },
    onMouseLeave: () => {
      hoverHideTimerRef.current = setTimeout(() => setHoverProduto(null), 300);
    },
  };

  // ---------- Tema ----------
  // Ao trocar de tema, RESETA escolhas manuais dos produtos:
  //   - balaoCustom (etiqueta escolhida via ModalEtiqueta)
  //   - corFundoCustom (cor de fundo escolhida via ModalCorFundo)
  //   - corTextoCustom (cor de texto manual)
  //   - corFundoTipo / corFundoTransparencia
  // Essas escolhas eram pra o tema ANTERIOR. Pro tema novo, queremos o visual
  // original (balão e cores do tema atual). Cliente pode reescolher depois.
  const escolherTema = async (id) => {
    const r = await fetch(`/api/templates/${id}`);
    const t = await r.json();
    setTema(t);
    setTemaId(id);
    // Limpa overrides per-produto (não muda preço/nome/imagem)
    setProdutos(prev => prev.map(p => {
      if (!p) return p;
      const limpo = { ...p };
      delete limpo.balaoCustom;
      delete limpo.corFundoCustom;
      delete limpo.corTextoCustom;
      delete limpo.corFundoTipo;
      delete limpo.corFundoTransparencia;
      return limpo;
    }));
  };

  // ---------- Produtos ----------
  // Se a imagem é URL externa, baixa via proxy para evitar CORS no <img> e na remoção de fundo.
  const cachearImagem = async (produto) => {
    if (!produto.imagem || !/^https?:\/\//.test(produto.imagem)) return produto;
    try {
      const r = await fetch(`/api/proxy-imagem?url=${encodeURIComponent(produto.imagem)}`);
      if (!r.ok) return produto;
      const json = await r.json();
      return { ...produto, imagem: json.url, imagemOriginal: produto.imagem };
    } catch {
      return produto;
    }
  };

  // Remoção de fundo automática (em background, não bloqueia UI).
  // IMPORTANTE: processa SEQUENCIALMENTE para evitar race condition no WASM
  // do @imgly quando múltiplos produtos rodam em paralelo.
  const autoRemoverFundo = async (produto) => {
    if (!produto || !produto.imagem || produto.fundoRemovido) return;
    if (produto.imagem.includes('/api/placeholder')) return;
    try {
      // pularIA: se o fundo não for uniforme, mantém imagem original em vez de chamar
      // o modelo de IA (WASM single-thread congela a UI por vários segundos por produto).
      const blob = await removerFundoDeUrl(produto.imagem, { pularIA: true });
      if (!blob) {
        // Chroma key não rolou — mantém imagem original, só marca fundoRemovido pra não retentar.
        setProdutos(prev => prev.map(p =>
          p.id === produto.id ? { ...p, fundoRemovido: true } : p
        ));
        return;
      }
      const novaUrl = await uploadBlobProcessado(blob, `${(produto.nome || 'produto').replace(/[^a-z0-9]/gi, '_')}_sem_fundo.png`);
      if (!novaUrl) throw new Error('upload retornou vazio');
      // Atualiza o produto na lista por ID (defensivo: só atualiza se ainda existe)
      setProdutos(prev => prev.map(p =>
        p.id === produto.id
          ? { ...p, imagem: novaUrl, fundoRemovido: true }
          : p
      ));
    } catch (e) {
      console.warn('[auto-bg-removal] falhou para', produto?.nome || '?', ':', e?.message || e);
      // Marca como tentado para não ficar em loop
      setProdutos(prev => prev.map(p =>
        p.id === produto.id ? { ...p, fundoRemovido: true } : p
      ));
    }
  };

  // Processa lista em sequência (uma por vez) com pequena pausa entre elas
  const processarFilaBgRemoval = async (lista) => {
    for (const p of lista) {
      await autoRemoverFundo(p);
      await new Promise(resolve => setTimeout(resolve, 50)); // respiro entre processamentos
    }
  };

  // Registra que essa imagem foi usada pra esse produto (alimenta o banco de
  // imagens populares — próximas buscas pelo mesmo nome priorizam essa imagem).
  // peso 1 = uso normal (busca automática), peso 3 = escolha explícita do usuário.
  const registrarImagemUsada = (produto, peso = 1) => {
    if (!produto?.nome || !produto?.imagem) return;
    if (produto.imagem.includes('/api/placeholder')) return;
    fetch('/api/produtos/registrar-imagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: produto.nome, imagemUrl: produto.imagem, peso }),
    }).catch(() => { /* silencioso — não bloqueia UX */ });
  };

  const adicionarProduto = async (p) => {
    const cacheado = await cachearImagem(p);
    setProdutos(prev => [...prev, cacheado]);
    registrarImagemUsada(cacheado);
    autoRemoverFundo(cacheado).catch(() => {});
  };

  const adicionarTudo = async (lista) => {
    const cacheada = await Promise.all(lista.map(cachearImagem));
    setProdutos(prev => [...prev, ...cacheada]);
    setModalEditar({ aberto: true, foco: -1 });
    // Registra cada imagem usada no banco de populares
    cacheada.forEach(registrarImagemUsada);
    // Processa bg-removal em sequência para evitar race condition WASM
    processarFilaBgRemoval(cacheada).catch(e => console.warn('Fila bg-removal:', e?.message || e));
  };
  const editarProduto = (idx, dados, opts = {}) => {
    setProdutos(prev => prev.map((p, i) => i === idx ? dados : p));
    // Registra a imagem com PESO MAIOR (3) quando vem de troca manual
    // (ModalEscolherImagem). Sinal mais forte que adicionar de busca automática (peso 1).
    if (dados?.nome && dados?.imagem) {
      registrarImagemUsada(dados, opts.pesoExplicito ? 3 : 1);
    }
  };

  // Atualiza múltiplos produtos de uma vez (usado pelo "Aplicar em" do modal de cor).
  // filtro: (produto, idx) => boolean
  // dados: objeto com as propriedades a aplicar
  const editarMultiplosProdutos = (filtro, dados) => {
    setProdutos(prev => prev.map((p, i) => filtro(p, i) ? { ...p, ...dados } : p));
  };
  const removerProduto = (idx) => {
    setProdutos(prev => prev.filter((_, i) => i !== idx));
  };

  // Move produto da posição `de` para `para` na lista (drag-and-drop)
  const reordenarProduto = (de, para) => {
    if (de === para) return;
    setProdutos(prev => {
      if (de < 0 || de >= prev.length || para < 0 || para >= prev.length) return prev;
      const novo = [...prev];
      const [item] = novo.splice(de, 1);
      novo.splice(para, 0, item);
      return novo;
    });
  };
  const removerTodos = () => {
    setProdutos([]);
    setModalEditar(false);
  };

  const trocarImagem = async (idx) => {
    const url = prompt('Cole a URL da nova imagem (ou deixe vazio para enviar arquivo):');
    if (url) {
      editarProduto(idx, { ...produtos[idx], imagem: url });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('imagem', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await r.json();
      editarProduto(idx, { ...produtos[idx], imagem: json.url });
    };
    input.click();
  };

  // ---------- Salvar / Exportar ----------
  const salvar = async () => {
    const payload = {
      id: projetoId,
      nome: nomeProjeto,
      tema: temaId,
      configs,
      produtos,
      observacoes,
      categoria,
    };
    const r = await fetch('/api/projetos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await r.json();
    if (json.id) { setProjetoId(json.id); alert('Projeto salvo!'); }
  };

  const exportarPng = () => {
    const dataUrl = exportarPNG(canvasFabric);
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `${nomeProjeto || 'encarte'}.png`; a.click();
  };

  const exportarPdf = () => {
    const dataUrl = exportarPNG(canvasFabric);
    const pdf = new jsPDF({
      orientation: tamanho.largura > tamanho.altura ? 'landscape' : 'portrait',
      unit: 'px',
      format: [tamanho.largura, tamanho.altura],
      hotfixes: ['px_scaling'],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, tamanho.largura, tamanho.altura);
    pdf.save(`${nomeProjeto || 'encarte'}.pdf`);
  };

  return (
    <div className="app">
      <Topbar
        aoAbrirCampanhas={() => setModalCampanhas(true)}
        qtdCampanhas={qtdCampanhas}
        user={auth.user}
        aoLogin={() => setModalAuth({ aberto: true, modo: 'login' })}
        aoSignup={() => setModalAuth({ aberto: true, modo: 'signup' })}
        aoLogout={auth.logout}
        aoAbrirConta={(aba) => setModalConta({ aberto: true, aba: aba || 'perfil' })}
        aoAbrirPlanos={() => setModalPlanos(true)}
        aoAbrirAdmin={() => setModalAdmin(true)}
        aoAbrirPreviewLayouts={() => setModalPreviewLayouts(true)}
        aoVoltarHome={voltarHome}
      />
      <SidebarIcons ativa={aba} aoMudar={setAba} />

      <div className="sidebar-panel">
        {aba === 'produtos' && (
          <PainelProdutos
            produtosAtuais={produtos}
            aoAdicionar={adicionarProduto}
            aoAdicionarTudo={adicionarTudo}
            aoEditar={(idx) => setModalEditar({ aberto: true, foco: idx })}
          />
        )}
        {aba === 'temas' && (
          <PainelTemas temaAtivo={temaId} aoEscolher={escolherTema} user={auth.user} fetchAuth={auth.fetchAuth} />
        )}
        {aba === 'empresa' && (
          <PainelEmpresa aoAtualizar={setEmpresa} />
        )}
        {aba === 'datas' && (
          <PainelDatas aoAtualizar={setDatas} />
        )}
        {aba === 'logo' && (
          <PainelLogo
            aoAtualizar={setLogo}
            corBorda={tema?.paleta?.primaria || tema?.paleta?.tagPreco || '#ef4444'}
          />
        )}
        {aba === 'fontes' && (
          <PainelFontes aoAtualizar={setFontes} />
        )}
        {aba === 'postar' && (
          <PainelPostar produtos={produtos} empresa={empresa} nomeProjeto={nomeProjeto} />
        )}
        {aba === 'encarte' && (
          <PainelEncarte
            nomeProjeto={nomeProjeto}
            setNomeProjeto={setNomeProjeto}
            observacoes={observacoes}
            setObservacoes={setObservacoes}
            categoria={categoria}
            setCategoria={setCategoria}
          />
        )}
      </div>

      <ConfigBar configs={configs} aoMudar={setConfigs} />

      <div className="canvas-area" ref={containerRef}>
        <div className="canvas-wrapper">
          <canvas ref={canvasRef} />
        </div>
        {/* Toolbar info estilo Pulse — pill com Grade / Página / Zoom + ícones SVG */}
        <div className="canvas-toolbar">
          {/* Grade */}
          <div className="ct-chip" title={layoutAtual?.nome || 'Grade automática'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span>
              Grade {layoutAtual
                ? (layoutAtual.cols && layoutAtual.rows
                    ? `${layoutAtual.cols}×${layoutAtual.rows}`
                    : layoutAtual.nome?.split(' ')[0] || layoutAtual.quantidade + ' itens')
                : 'Auto'}
            </span>
          </div>

          {/* Página (com prev/next inline) */}
          <div className="ct-chip ct-chip-page">
            <button
              className="ct-arrow"
              onClick={() => setPaginaAtual(p => Math.max(0, p - 1))}
              disabled={paginaAtual === 0}
              title="Página anterior"
              aria-label="Página anterior"
            >‹</button>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
            </svg>
            <span>Página <b>{paginaAtual + 1}</b> de {totalPaginas}</span>
            <button
              className="ct-arrow"
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas - 1, p + 1))}
              disabled={paginaAtual >= totalPaginas - 1}
              title="Próxima página"
              aria-label="Próxima página"
            >›</button>
          </div>

          {/* Zoom */}
          <div className="ct-chip" title="Zoom do canvas">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
            </svg>
            <span>{configs.zoom === 'auto' ? 'Auto' : configs.zoom}</span>
          </div>
        </div>

        {/* Barra de ações: Salvar / PNG / Exportar PDF (movido da Topbar pra cá) */}
        <div className="canvas-acoes">
          <button className="ca-btn ca-salvar" onClick={salvar}>
            💾 Salvar
          </button>
          <button className="ca-btn ca-png" onClick={exportarPng}>
            🖼️ PNG
          </button>
          <button className="ca-btn ca-pdf" onClick={exportarPdf}>
            📄 Exportar PDF
          </button>
        </div>
      </div>

      {/* Menu flutuante de ações no hover do produto */}
      {hoverProduto && produtos[hoverProduto.idx] && (
        <OverlayProduto
          posicao={{ x: hoverProduto.x, y: hoverProduto.y }}
          produto={produtos[hoverProduto.idx]}
          idx={hoverProduto.idx}
          aoMudarProduto={editarProduto}
          aoAbrirEditor={(idx) => setModalEditar({ aberto: true, foco: idx })}
          aoAbrirCorFundo={(idx) => { setModalCorFundoIdx(idx); setHoverProduto(null); }}
          aoAbrirEtiqueta={(idx) => { setModalEtiquetaIdx(idx); setHoverProduto(null); }}
          {...overlayHandlers}
        />
      )}

      {/* Modal grande de cor de fundo */}
      {modalCorFundoIdx !== null && produtos[modalCorFundoIdx] && (
        <ModalCorFundo
          produto={produtos[modalCorFundoIdx]}
          idx={modalCorFundoIdx}
          produtos={produtos}
          aoMudar={editarProduto}
          aoMudarMultiplos={editarMultiplosProdutos}
          aoFechar={() => setModalCorFundoIdx(null)}
        />
      )}

      {/* Modal grande de etiqueta (balão de oferta) */}
      {modalEtiquetaIdx !== null && produtos[modalEtiquetaIdx] && (
        <ModalEtiqueta
          produto={produtos[modalEtiquetaIdx]}
          idx={modalEtiquetaIdx}
          configs={configs}
          // Índices dos produtos que estão em boxes marcados como destaque na grade atual.
          // Sem isso o "Aplicar em destaques" assumia índices 0,1 (errado pra muitas grades).
          destaqueIndices={(() => {
            const layout = LAYOUTS_NOMEADOS.find(l => l.id === configs.grade);
            if (!layout?.boxes) return [];
            return layout.boxes.map((b, i) => b.destaque === true ? i : -1).filter(i => i >= 0);
          })()}
          aoMudar={editarProduto}
          aoMudarMultiplos={editarMultiplosProdutos}
          aoMudarConfigs={setConfigs}
          aoFechar={() => setModalEtiquetaIdx(null)}
        />
      )}

      {modalEditar?.aberto && (
        <ModalEditarProdutos
          produtos={produtos}
          aoFechar={() => setModalEditar(false)}
          aoMudar={editarProduto}
          aoRemover={removerProduto}
          aoRemoverTodos={removerTodos}
          aoTrocarImagem={trocarImagem}
          aoReordenar={reordenarProduto}
        />
      )}

      <ModalMinhasCampanhas
        aberto={modalCampanhas}
        aoFechar={() => setModalCampanhas(false)}
        aoCarregarProjeto={carregarProjeto}
        aoCriarNovo={criarNovo}
      />

      <ModalAuth
        aberto={modalAuth.aberto}
        modoInicial={modalAuth.modo}
        aoFechar={() => setModalAuth({ aberto: false, modo: 'login' })}
        signup={async (dados) => {
          const user = await auth.signup(dados);
          // Logo após signup, abre modal de interesses (modo welcome)
          setModalInteresses({ aberto: true, signup: true });
          return user;
        }}
        login={auth.login}
        esqueciSenha={auth.esqueciSenha}
        resetarSenha={auth.resetarSenha}
      />

      <ModalMeusInteresses
        aberto={modalInteresses.aberto}
        aoFechar={() => setModalInteresses({ aberto: false, signup: false })}
        fetchAuth={auth.fetchAuth}
        modoSignup={modalInteresses.signup}
      />

      <ModalContaUsuario
        aberto={modalConta.aberto}
        abaInicial={modalConta.aba}
        aoFechar={() => setModalConta({ aberto: false, aba: 'perfil' })}
        user={auth.user}
        fetchAuth={auth.fetchAuth}
        aoAtualizarUser={(novoUser) => { auth.refresh(); }}
      />

      <ModalPlanos
        aberto={modalPlanos}
        aoFechar={() => setModalPlanos(false)}
        user={auth.user}
        planoAtualSlug={planoAtualSlug}
        aoAssinarSemConta={(slug) => {
          // Deslogado: fecha planos, abre cadastro
          setModalPlanos(false);
          setModalAuth({ aberto: true, modo: 'signup' });
        }}
        aoTrocarPlano={(slug, ciclo) => {
          // Logado: Fase 2 vai redirecionar pra Stripe Checkout
          alert(`Você clicou no plano "${slug}" (${ciclo}).\n\nIntegração Stripe vem na Fase 2 — em breve!`);
        }}
      />

      <PainelAdmin
        aberto={modalAdmin}
        aoFechar={() => setModalAdmin(false)}
        fetchAuth={auth.fetchAuth}
        user={auth.user}
      />

      <ModalPreviewLayouts
        aberto={modalPreviewLayouts}
        aoFechar={() => setModalPreviewLayouts(false)}
      />

    </div>
  );
}
