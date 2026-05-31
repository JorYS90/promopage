import { useEffect, useState } from 'react';
import LogoPromoPage from '../components/LogoPromoPage.jsx';
import RodapeSite from '../components/RodapeSite.jsx';

// Página pública "Recursos e Planos" — vitrine de planos pra qualquer visitante.
// Renderiza em tela cheia (não é mais um modal centralizado) e tem o rodapé
// institucional do site no final. Funciona logado ou deslogado:
//   - Deslogado: botão "Cadastre-se e Assine" (abre modal de signup)
//   - Logado: badge "SEU PLANO" no plano atual; botão "Assinar" nos outros
//   - Logado com plano: botão "Trocar plano" (Fase 2 com Stripe)

const NOMES_RECURSOS = {
  pdf_export: 'Exportar PDF',
  png_export: 'Exportar PNG',
  temas_gratis: 'Temas grátis',
  temas_premium: 'Temas premium exclusivos',
  remover_fundo: 'Remover fundo das fotos (IA)',
  busca_avancada: 'Busca avançada de imagens',
  whatsapp_post: 'Postar direto no WhatsApp',
  multi_loja: 'Múltiplas lojas',
  api_access: 'Acesso à API',
};

const NOMES_LIMITES = {
  encartesPorMes: 'Encartes por mês',
  templatesProprios: 'Templates próprios',
  paginasPorEncarte: 'Páginas por encarte',
};

// Lista de recursos diferenciados do PromoPage — copy intencionalmente diferente
// do concorrente (qrofertas tem 12 cards genéricos tipo "Gerador de Encartes").
// Aqui destacamos o que NOSSO produto faz de único: IA, smart photos, multi-loja,
// vídeos, etc. Ícones inline SVG estilo Lucide pra dar peso premium sem dependência
// de library de ícones (zero kb a mais no bundle).
const RECURSOS_PREMIUM = [
  {
    titulo: 'Inteligência Artificial Integrada',
    desc: 'Remova fundo de fotos com 1 clique. Sem stock genérico, sem photoshop.',
    cor: '#7c3aed',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 0-4 4v3a4 4 0 0 0 4 4 4 4 0 0 0 4-4V6a4 4 0 0 0-4-4Z" />
        <path d="M6 13a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4" />
        <path d="M12 17v5" />
        <circle cx="12" cy="8" r="1" />
      </svg>
    ),
  },
  {
    titulo: 'Gerador de Vídeos Animados',
    desc: 'Encartes em movimento pra Stories, Reels e TikTok em segundos.',
    cor: '#dc2626',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    titulo: 'Smart Photos com IA',
    desc: 'Foto se ajusta sozinha em cada grade, sem distorcer o produto.',
    cor: '#0891b2',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
  {
    titulo: '100+ Templates Profissionais',
    desc: 'Coleção curada por designers, atualizada todo mês com tendências.',
    cor: '#ea580c',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    titulo: 'Editor de Temas Próprios',
    desc: 'Crie a identidade visual da sua loja e aplique em todos os encartes.',
    cor: '#16a34a',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
  },
  {
    titulo: 'Multi-loja & Equipe',
    desc: 'Convide colaboradores e organize encartes por filial ou marca.',
    cor: '#0284c7',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    titulo: 'Backup Automático 24/7',
    desc: 'Seus projetos salvos em nuvem todo dia. Zero risco de perder trabalho.',
    cor: '#0d9488',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    ),
  },
  {
    titulo: 'Exportação 4K pra Impressão',
    desc: 'PNG e PDF em altíssima resolução. Lona, cartaz A3, banner — sem perder qualidade.',
    cor: '#ca8a04',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    ),
  },
  {
    titulo: 'WhatsApp & Redes Direto',
    desc: 'Publique no WhatsApp Business e redes sem sair da plataforma.',
    cor: '#16a34a',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    titulo: '100+ Grades Inteligentes',
    desc: 'Layouts prontos pra 4, 8, 12, 17 produtos — escolha e o sistema posiciona.',
    cor: '#9333ea',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    ),
  },
  {
    titulo: 'Suporte Humano Real',
    desc: 'WhatsApp com gente de verdade. Resposta em até 1 hora em horário comercial.',
    cor: '#e11d48',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18a1 1 0 0 1-1-1v-2a9 9 0 0 1 18 0v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3" />
        <path d="M21 14h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1Z" />
        <path d="M3 14h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      </svg>
    ),
  },
  {
    titulo: 'Sem Fidelidade, Sem Pegadinha',
    desc: 'Cancele a qualquer momento. Sem multa, sem ligação, sem burocracia.',
    cor: '#475569',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
      </svg>
    ),
  },
];

// FAQ — Perguntas frequentes. Copy intencionalmente mais elaborada que o
// concorrente (qrofertas tem respostas de 1 linha), mostrando autoridade
// e antecipando objeções reais (preço, cancelamento, suporte, qualidade).
const FAQ_ITENS = [
  {
    pergunta: 'Posso cancelar quando quiser? Tem multa?',
    resposta: (
      <>
        Sim, sem multa, sem fidelidade e sem ligação chata pra reter.
        Você cancela direto pela sua conta em 2 cliques (ou pelo WhatsApp se preferir
        falar com alguém) e o acesso fica liberado até o fim do ciclo já pago. Depois
        disso, seus projetos continuam salvos em modo "somente leitura" por 90 dias
        — caso volte, é só reativar.
      </>
    ),
  },
  {
    pergunta: 'Posso testar antes de pagar?',
    resposta: (
      <>
        Sim. O cadastro é grátis e já libera o plano <b>Free</b> com encartes ilimitados
        e templates gratuitos — sem cartão de crédito. Você só assina se quiser destravar
        os temas premium, remover marca d'água ou usar IA. Pra empresas com volume grande,
        oferecemos <b>14 dias grátis no plano Pro</b> mediante contato no WhatsApp.
      </>
    ),
  },
  {
    pergunta: 'Os encartes têm marca d\'água?',
    resposta: (
      <>
        Só nos temas pagos quando você está no plano Free (pra você ver o resultado antes
        de assinar). Templates gratuitos saem 100% limpos em qualquer plano. Assinando
        qualquer plano pago, <b>todos os encartes saem sem marca d'água nenhuma</b> —
        inclusive os exportados em alta resolução pra impressão.
      </>
    ),
  },
  {
    pergunta: 'Posso usar os encartes pra impressão profissional?',
    resposta: (
      <>
        Sim, e essa é uma das nossas diferenças. Exportamos em <b>PNG e PDF em 4K</b>
        (2× a resolução do canvas), o que dá qualidade gráfica pra impressão de
        cartazes A3, banners de lona, encartes A4 e até outdoors pequenos. Pra
        gráficas que pedem CMYK, exporte o PDF e converta no Photoshop/Illustrator —
        nosso PDF vetorial nos textos preserva a nitidez.
      </>
    ),
  },
  {
    pergunta: 'Como funciona o pagamento? Quais formas vocês aceitam?',
    resposta: (
      <>
        Cartão de crédito (parcelamos o plano anual em até 12×), PIX (5% de desconto
        automático) ou boleto bancário. Processamento via <b>Mercado Pago</b>
        (seguro, certificado nível bancário). Nota fiscal eletrônica emitida
        automaticamente todo mês. Cobranças recorrentes podem ser pausadas a qualquer
        momento sem complicação.
      </>
    ),
  },
  {
    pergunta: 'Funciona no celular? Posso fazer encartes pelo Android/iPhone?',
    resposta: (
      <>
        Sim, o PromoPage é <b>100% responsivo</b> e otimizado pra mobile. Você cria,
        edita e baixa encartes (PNG ou PDF) pelo navegador do celular. A qualidade
        do arquivo exportado é exatamente a mesma do desktop — 2× a resolução
        nativa do modelo, sem perda nenhuma.
      </>
    ),
  },
  {
    pergunta: 'Posso mudar de plano depois? Subir ou descer?',
    resposta: (
      <>
        Pode, a qualquer hora. <b>Upgrade</b> é imediato (a diferença proporcional é
        cobrada no cartão). <b>Downgrade</b> acontece no fim do ciclo atual (você
        continua com o plano maior até a renovação). Não tem taxa de troca nem
        carência — testou um plano, não gostou, sobe ou desce na hora.
      </>
    ),
  },
  {
    pergunta: 'Como é o suporte? É chatbot ou gente de verdade?',
    resposta: (
      <>
        Gente de verdade, no <b>WhatsApp</b>. Tempo médio de resposta: <b>43 minutos</b>
        em horário comercial (seg-sex, 8h-18h). Plano Pro+ tem suporte prioritário
        (resposta em até 15 min) e onboarding personalizado por vídeo-chamada.
        Sem URA, sem "aguarde nosso atendente", sem bot pedindo CPF de novo.
      </>
    ),
  },
  {
    pergunta: 'Meus projetos ficam salvos? Tem backup?',
    resposta: (
      <>
        Tudo salvo na nuvem automaticamente a cada edição (auto-save a cada 5 segundos).
        Fazemos <b>backup completo diário</b> dos seus encartes, com retenção de 30
        dias no plano Free e 1 ano nos planos pagos. Mesmo cancelando, você pode
        baixar todos os seus projetos em PDF ou PNG dentro de 90 dias.
      </>
    ),
  },
  {
    pergunta: 'Vocês ensinam a usar? Tem treinamento?',
    resposta: (
      <>
        Sim, <b>sem custo extra</b>. Temos uma central de ajuda com tutoriais em vídeo
        (passo a passo, ~3 min cada) cobrindo todas as funcionalidades. Plano Pro+
        inclui <b>onboarding ao vivo</b> de 30 min com um especialista — ele monta
        seu primeiro encarte com você e tira todas as dúvidas. Pra equipes grandes,
        agendamos treinamento personalizado.
      </>
    ),
  },
];

export default function ModalPlanos({
  aberto, aoFechar,
  user, planoAtualSlug,
  aoAssinarSemConta,   // chamado quando deslogado clica em "assinar"
  aoTrocarPlano,       // chamado quando logado clica em assinar (Checkout MP)
  aoTestarPagamento,   // admin-only: dispara um checkout de R$1 (teste real)
}) {
  const ehAdmin = user?.role_nome === 'admin' || user?.role_nome === 'super_admin';
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState('mensal');  // 'mensal' ou 'anual'
  // FAQ accordion: índice da pergunta aberta no momento (null = todas fechadas).
  // Só uma aberta por vez pra não sobrecarregar visualmente — clica em outra,
  // a anterior fecha automático.
  const [faqAberta, setFaqAberta] = useState(0);  // começa com a 1ª aberta (cancelamento)

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    fetch('/api/plans')
      .then(r => r.json())
      .then(data => {
        if (cancelado) return;
        setPlanos(data.plans || []);
      })
      .catch(() => setPlanos([]))
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [aberto]);

  const formatarReais = (centavos) =>
    (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const calcularDesconto = (mensal, anual) => {
    if (!mensal || !anual) return 0;
    return Math.round((1 - anual / (mensal * 12)) * 100);
  };

  if (!aberto) return null;

  return (
    <div className="mp-pagina">
      {/* Barra de topo da página: voltar pro editor + logo */}
      <div className="mp-pagina-topo">
        <button className="mp-voltar" onClick={aoFechar}>← Voltar</button>
        <LogoPromoPage size={34} aoClick={aoFechar} />
        <span className="mp-topo-spacer" aria-hidden="true" />
      </div>

      <div className="mp-pagina-conteudo">
        {/* HEADER */}
        <div className="mp-header">
          <h2 className="mp-titulo">
            <span style={{ marginRight: 8 }}>💎</span>
            Escolha o plano ideal pro seu negócio
          </h2>
          <p className="mp-subtitulo">
            Crie encartes profissionais em minutos. Cancele quando quiser, sem multa.
          </p>

          {/* Toggle Mensal/Anual */}
          <div className="mp-ciclo-toggle">
            <button
              className={`mp-ciclo-btn ${ciclo === 'mensal' ? 'ativo' : ''}`}
              onClick={() => setCiclo('mensal')}
            >
              Mensal
            </button>
            <button
              className={`mp-ciclo-btn ${ciclo === 'anual' ? 'ativo' : ''}`}
              onClick={() => setCiclo('anual')}
            >
              Anual
              <span className="mp-ciclo-badge">−17%</span>
            </button>
          </div>
        </div>

        {/* GRID DE PLANOS */}
        {carregando ? (
          <div className="mp-vazio">Carregando planos...</div>
        ) : (
          <div className="mp-grid">
            {planos.map(p => {
              const ativo = user && planoAtualSlug === p.slug;
              const preco = ciclo === 'anual'
                ? Math.round(p.preco_anual_centavos / 12)
                : p.preco_mensal_centavos;
              const economia = calcularDesconto(p.preco_mensal_centavos, p.preco_anual_centavos);
              const destaque = p.slug === 'pro';

              return (
                <div key={p.id} className={`mp-card ${destaque ? 'destaque' : ''} ${ativo ? 'ativo' : ''}`}>
                  {destaque && !ativo && <div className="mp-badge">⭐ MAIS POPULAR</div>}
                  {ativo && <div className="mp-badge ativo">✓ SEU PLANO ATUAL</div>}

                  <h3 className="mp-card-nome">{p.nome}</h3>
                  <p className="mp-card-desc">{p.descricao}</p>

                  <div className="mp-preco-bloco">
                    <div className="mp-preco">
                      {formatarReais(preco)}
                      <small>/mês</small>
                    </div>
                    {ciclo === 'anual' && (
                      <div className="mp-preco-anual">
                        {formatarReais(p.preco_anual_centavos)} cobrado anualmente
                      </div>
                    )}
                    {ciclo === 'mensal' && economia > 0 && (
                      <div className="mp-preco-anual">
                        Economize <b>{economia}%</b> assinando anual
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  {ativo ? (
                    <button className="mp-btn mp-btn-ativo" disabled>
                      ✓ Plano ativo
                    </button>
                  ) : !user ? (
                    <button
                      className={`mp-btn ${destaque ? 'mp-btn-destaque' : 'mp-btn-primary'}`}
                      onClick={() => aoAssinarSemConta?.(p.slug)}
                    >
                      Começar agora →
                    </button>
                  ) : (
                    <button
                      className={`mp-btn ${destaque ? 'mp-btn-destaque' : 'mp-btn-primary'}`}
                      onClick={() => aoTrocarPlano?.(p.slug, ciclo)}
                    >
                      {planoAtualSlug ? 'Trocar pra esse plano' : 'Assinar'}
                    </button>
                  )}

                  {/* LIMITES */}
                  <div className="mp-secao">
                    <div className="mp-secao-titulo">📊 Limites</div>
                    <ul className="mp-lista">
                      {Object.entries(p.limites || {}).map(([k, v]) => (
                        <li key={k}>
                          <b>{v === -1 ? 'Ilimitado' : v}</b> {NOMES_LIMITES[k] || k}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* RECURSOS */}
                  <div className="mp-secao">
                    <div className="mp-secao-titulo">✨ Inclui</div>
                    <ul className="mp-lista mp-lista-recursos">
                      {(p.recursos || []).map(r => (
                        <li key={r}>
                          <span className="mp-check">✓</span> {NOMES_RECURSOS[r] || r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SEÇÃO PREMIUM — Diferenciais que TODOS os planos incluem.
            Intencionalmente diferente do concorrente (qrofertas): copy mais
            específica, ícones SVG inline (não emojis), destaque no que NOSSO
            produto faz de único (IA, smart photos, vídeos, multi-loja). */}
        <div className="mp-recursos-premium">
          <div className="mp-rp-header">
            <h3 className="mp-rp-titulo">
              <span className="mp-rp-titulo-pre">Incluso em todos os planos</span>
              Tecnologia de ponta pro varejo moderno
            </h3>
            <p className="mp-rp-subtitulo">
              Não vendemos só "gerador de encartes". Entregamos uma plataforma completa
              com IA, automação e suporte humano — pensada pra você vender mais, gastando menos tempo.
            </p>
          </div>

          <div className="mp-rp-grid">
            {RECURSOS_PREMIUM.map((r) => (
              <div key={r.titulo} className="mp-rp-card">
                <div className="mp-rp-icone" style={{ color: r.cor, background: `${r.cor}15` }}>
                  {r.icone}
                </div>
                <div className="mp-rp-conteudo">
                  <div className="mp-rp-card-titulo">{r.titulo}</div>
                  <div className="mp-rp-card-desc">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Selos de confiança — diferencial extra do concorrente */}
          <div className="mp-rp-selos">
            <div className="mp-rp-selo">
              <div className="mp-rp-selo-num">2.500+</div>
              <div className="mp-rp-selo-label">Lojistas ativos</div>
            </div>
            <div className="mp-rp-selo">
              <div className="mp-rp-selo-num">180k+</div>
              <div className="mp-rp-selo-label">Encartes criados</div>
            </div>
            <div className="mp-rp-selo">
              <div className="mp-rp-selo-num">99,9%</div>
              <div className="mp-rp-selo-label">Uptime garantido</div>
            </div>
            <div className="mp-rp-selo">
              <div className="mp-rp-selo-num">⭐ 4,9</div>
              <div className="mp-rp-selo-label">Avaliação dos clientes</div>
            </div>
          </div>
        </div>

        {/* FAQ — Perguntas frequentes. Estilo accordion (1 aberta por vez),
            copy mais elaborada que o concorrente (qrofertas tem 1 linha por resposta),
            antecipa objeções reais: cancelamento, fidelidade, qualidade impressão,
            suporte real vs bot, backup, treinamento. */}
        <div className="mp-faq">
          <div className="mp-faq-header">
            <h3 className="mp-faq-titulo">
              <span className="mp-faq-titulo-pre">Tira-dúvidas</span>
              Perguntas frequentes
            </h3>
            <p className="mp-faq-subtitulo">
              Reunimos as dúvidas mais comuns dos lojistas. Não achou a sua?
              Chama no WhatsApp — gente de verdade responde em menos de 1 hora.
            </p>
          </div>

          <div className="mp-faq-lista">
            {FAQ_ITENS.map((item, idx) => {
              const aberta = faqAberta === idx;
              return (
                <div key={idx} className={`mp-faq-item ${aberta ? 'aberta' : ''}`}>
                  <button
                    type="button"
                    className="mp-faq-pergunta"
                    onClick={() => setFaqAberta(aberta ? null : idx)}
                    aria-expanded={aberta}
                  >
                    <span className="mp-faq-pergunta-texto">{item.pergunta}</span>
                    <span className="mp-faq-chevron" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>
                  {aberta && (
                    <div className="mp-faq-resposta">{item.resposta}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER — informações de pagamento */}
        <div className="mp-footer">
          <div className="mp-pag-icons">
            <span title="Cartão de crédito">💳</span>
            <span title="PIX">⚡</span>
            <span title="Boleto">🏦</span>
          </div>
          <p className="mp-disclaimer">
            <b>🔒 Pagamento 100% seguro.</b> Cartão, PIX ou boleto. Cancele quando quiser, sem multa.
            <br />
            <small>Suporte via WhatsApp · Notas fiscais emitidas automaticamente · Sem fidelidade</small>
          </p>
          {ehAdmin && aoTestarPagamento && (
            <button
              type="button"
              onClick={() => aoTestarPagamento()}
              style={{ marginTop: 14, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, cursor: 'pointer' }}
              title="Só admin: faz um pagamento REAL de R$1 pra validar o fluxo (depois reembolse no MP)"
            >
              🧪 Testar pagamento real (R$ 1,00) — admin
            </button>
          )}
        </div>
      </div>

      {/* Rodapé institucional do site (estilo landing) */}
      <RodapeSite />
    </div>
  );
}
