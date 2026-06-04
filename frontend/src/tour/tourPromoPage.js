// Tour interativo do PromoPage — Driver.js v1
//
// Mostra ~13 passos cobrindo o fluxo completo: do "abre a sidebar" até "exporta o PDF".
// Cada step destaca um elemento real do app com tooltip animado.
//
// Disparo:
//   - Botão 🎓 "Tour" no Topbar (a qualquer momento)
//   - Auto na 1ª vez do user (flag `pp_tour_v1_done:<userId>` em localStorage)
//
// Como adicionar passo novo: clone um item do TOUR_STEPS, ajuste o seletor
// (selector CSS) e o texto. Mantém under 15 steps pra não cansar o user.
//
// Driver.js docs: https://driverjs.com/

import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Versão do tour — incrementar quando mudar steps significativos
// (faz aparecer de novo pra quem já completou a versão anterior).
const TOUR_VERSION = 'v1';

function chaveLocalStorage(userId) {
  return `pp_tour_${TOUR_VERSION}_done:${userId || 'anon'}`;
}

// Helper pra trocar de aba ANTES de mostrar o tooltip dela.
// driverjs roda `onHighlightStarted` antes de pintar o spotlight — usamos
// pra forçar a sidebar a ir na aba certa, garantindo que o elemento existe.
function abrirAba(aba, ctx) {
  return () => {
    if (ctx?.setAba) ctx.setAba(aba);
    if (ctx?.setPainelAberto) ctx.setPainelAberto(true);
  };
}

function abrirCampanhas(ctx) {
  return () => {
    if (ctx?.aoAbrirCampanhas) ctx.aoAbrirCampanhas();
  };
}

function fecharCampanhas(ctx) {
  return () => {
    if (ctx?.aoFecharCampanhas) ctx.aoFecharCampanhas();
  };
}

// === Steps do tour ===
function steps(ctx) {
  return [
    {
      // Step 0 — boas-vindas (sem destaque)
      popover: {
        title: '👋 Bem-vindo ao PromoPage!',
        description:
          'Em 2 minutos eu mostro como criar seu primeiro encarte profissional. ' +
          'Você pode pular a qualquer momento clicando no <b>X</b>. Vamos lá?',
        align: 'center',
      },
    },
    {
      // Step 1 — Sidebar geral
      element: '.sidebar-icons',
      popover: {
        title: '🗂️ Suas ferramentas',
        description:
          'Aqui ficam os 9 painéis de configuração do encarte. ' +
          'Vou te apresentar cada um.',
        side: 'right',
        align: 'start',
      },
    },
    {
      // Step 2 — Produtos
      element: '[data-tour="aba-produtos"]',
      onHighlightStarted: abrirAba('produtos', ctx),
      popover: {
        title: '➕ Produtos',
        description:
          'Cole uma lista do WhatsApp ou Excel — a IA reconhece nome, preço, unidade. ' +
          'Cada produto recebe foto profissional automaticamente.<br><br>' +
          '<small>Ex: "Picanha kg R$ 49,90"</small>',
        side: 'right',
        align: 'start',
      },
    },
    {
      // Step 3 — Temas
      element: '[data-tour="aba-temas"]',
      onHighlightStarted: abrirAba('temas', ctx),
      popover: {
        title: '🎨 Temas prontos',
        description:
          'Mais de 25 temas profissionais por segmento (mercado, doceria, bebidas, moda). ' +
          'Favorita os que mais usa com o ♡.',
        side: 'right',
      },
    },
    {
      // Step 4 — Agenda
      element: '[data-tour="aba-agenda"]',
      onHighlightStarted: abrirAba('agenda', ctx),
      popover: {
        title: '🗓️ Agenda de Marketing',
        description:
          'Calendário com as datas comemorativas mais lucrativas do ano (Dia das Mães, ' +
          'Black Friday, Natal). Cada data tem sugestão de campanha e botão pra ' +
          'criar encarte com 1 clique.',
        side: 'right',
      },
    },
    {
      // Step 5 — Datas
      element: '[data-tour="aba-datas"]',
      onHighlightStarted: abrirAba('datas', ctx),
      popover: {
        title: '📅 Validade da oferta',
        description:
          'Define o período da oferta ("Válido de X a Y") + regras visíveis ' +
          'no encarte (imagens ilustrativas, frase promocional, etc).',
        side: 'right',
      },
    },
    {
      // Step 6 — Logo
      element: '[data-tour="aba-logo"]',
      onHighlightStarted: abrirAba('logo', ctx),
      popover: {
        title: '© Sua logo',
        description:
          'Upload da logo da sua loja. Aparece em todos os encartes com ' +
          'borda colorida na cor do tema.',
        side: 'right',
      },
    },
    {
      // Step 7 — Empresa
      element: '[data-tour="aba-empresa"]',
      onHighlightStarted: abrirAba('empresa', ctx),
      popover: {
        title: '🏪 Dados da empresa',
        description:
          'Nome, endereço, telefone, WhatsApp — aparecem no rodapé do encarte. ' +
          'Preenche uma vez e fica salvo na sua conta.',
        side: 'right',
      },
    },
    {
      // Step 8 — Postar
      element: '[data-tour="aba-postar"]',
      onHighlightStarted: abrirAba('postar', ctx),
      popover: {
        title: '💡 Postar nas redes sociais',
        description:
          'Gera texto acessível (#PraCegoVer) e <b>legenda otimizada pra Instagram com IA</b>. ' +
          'Copia e cola direto na sua publicação.',
        side: 'right',
      },
    },
    {
      // Step 9 — Encarte
      element: '[data-tour="aba-encarte"]',
      onHighlightStarted: abrirAba('encarte', ctx),
      popover: {
        title: '✏️ Identificação do encarte',
        description:
          'Dá nome ao seu projeto e adiciona observações pra organizar nas Minhas Campanhas.',
        side: 'right',
      },
    },
    {
      // Step 10 — ConfigBar (formato/zoom)
      element: '.configbar',
      onHighlightStarted: abrirAba('produtos', ctx),
      popover: {
        title: '📐 Formato e zoom',
        description:
          'Escolhe o formato (Facebook quadrado, Stories, A4, TV horizontal, Cartaz, Reels). ' +
          'O encarte se ajusta automaticamente.',
        side: 'top',
      },
    },
    {
      // Step 11 — Exportar
      element: '.canvas-acoes',
      popover: {
        title: '💾 Salvar e exportar',
        description:
          '<b>Salvar:</b> guarda na sua conta pra editar depois.<br>' +
          '<b>PNG:</b> imagem pronta pra Instagram/WhatsApp.<br>' +
          '<b>PDF:</b> arquivo profissional pra impressão.',
        side: 'top',
        align: 'end',
      },
    },
    {
      // Step 12 — Minhas Campanhas
      element: '[data-tour="campanhas"]',
      popover: {
        title: '📁 Minhas Campanhas',
        description:
          'Todos os encartes que você já criou ficam aqui — pode reabrir, ' +
          'duplicar ou exportar de novo.',
        side: 'bottom',
      },
    },
    {
      // Step 13 — Fim
      popover: {
        title: '🎉 Pronto!',
        description:
          'Agora é só começar. Se travar em algo, clica no botão <b>🎓 Tour</b> ' +
          'no topo pra rever este passo a passo, ou use a <b>Central de Atendimento</b>.<br><br>' +
          'Bons encartes! 🚀',
        align: 'center',
      },
    },
  ];
}

// === API pública do módulo ===

let driverObj = null;

export function iniciarTour(ctx = {}) {
  // Fecha tour anterior se ainda tiver aberto (evita duplicação)
  if (driverObj) { try { driverObj.destroy(); } catch {} driverObj = null; }

  driverObj = driver({
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Próximo →',
    prevBtnText: '← Anterior',
    doneBtnText: 'Concluir 🎉',
    overlayOpacity: 0.65,
    stagePadding: 6,
    stageRadius: 8,
    steps: steps(ctx),
    onDestroyed: () => {
      // Marca como visto (só dispara o auto-tour 1 vez por user)
      try {
        localStorage.setItem(chaveLocalStorage(ctx.userId), '1');
      } catch {}
      // Fecha modais que o tour possa ter aberto
      if (ctx.aoFecharCampanhas) ctx.aoFecharCampanhas();
      driverObj = null;
    },
  });
  driverObj.drive();
}

// Checa se já mostrou tour pra esse user. Retorna true se NUNCA viu.
export function deveMostrarTourAutomatico(userId) {
  try {
    return localStorage.getItem(chaveLocalStorage(userId)) !== '1';
  } catch {
    return false;
  }
}

// Marca tour como concluído sem mostrar (ex: user clica "pular tour" no signup)
export function marcarTourComoVisto(userId) {
  try { localStorage.setItem(chaveLocalStorage(userId), '1'); } catch {}
}
