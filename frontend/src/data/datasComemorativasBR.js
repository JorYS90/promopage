// Calendário de datas comemorativas BR com sugestões de campanha por nicho.
//
// Cada entrada:
//  - id: identificador estável (snake_case)
//  - nome: nome da data
//  - emoji: ícone visual
//  - mes: 1-12 (zero-indexed = mes-1 em Date)
//  - dia: número fixo OU função(ano) => Date pra datas variáveis (Páscoa, Mães, Pais, Black Friday, Carnaval)
//  - importancia: 'alta' (datas top de vendas), 'media', 'baixa' (datas de nicho)
//  - segmentos: array de segmentos onde faz sentido (vazio = serve pra todos)
//  - sugestao: texto curto sugerindo campanha
//
// Datas variáveis são calculadas em tempo de exibição (dia(ano) => Date).
// Quando dia é número, usamos new Date(ano, mes-1, dia).

// === Algoritmos pra datas variáveis ===

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
function paschalSunday(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Carnaval = 47 dias antes da Páscoa (Terça-feira de Carnaval)
function carnavalTerca(ano) {
  const p = paschalSunday(ano);
  const d = new Date(p);
  d.setDate(d.getDate() - 47);
  return d;
}

// Dia das Mães = 2º domingo de maio
function diaDasMaes(ano) {
  return enesimoDiaSemanaDoMes(ano, 5, 0, 2); // 0 = domingo
}

// Dia dos Pais = 2º domingo de agosto
function diaDosPais(ano) {
  return enesimoDiaSemanaDoMes(ano, 8, 0, 2);
}

// Dia das Noivas = última sexta-feira de maio
function diaDasNoivas(ano) {
  // último dia de maio: new Date(ano, 5, 0) -> dia 31 de maio (pois mês 5 = junho, 0 = dia anterior)
  const d = new Date(ano, 5, 0);
  // recua até encontrar sexta (5)
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
  return d;
}

// Black Friday = última sexta-feira de novembro
function blackFriday(ano) {
  const d = new Date(ano, 11, 0); // último dia de novembro (mês 11 = dezembro, dia 0 = dia anterior)
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
  return d;
}

// Cyber Monday = segunda após Black Friday
function cyberMonday(ano) {
  const bf = blackFriday(ano);
  const d = new Date(bf);
  d.setDate(d.getDate() + 3);
  return d;
}

// Helper: enésimo dia-da-semana do mês (ex: 2º domingo de maio)
// diaSemana: 0=dom, 1=seg, ..., 6=sáb
function enesimoDiaSemanaDoMes(ano, mes1baseado, diaSemana, ordinal) {
  const primeiro = new Date(ano, mes1baseado - 1, 1);
  const offset = (diaSemana - primeiro.getDay() + 7) % 7;
  return new Date(ano, mes1baseado - 1, 1 + offset + (ordinal - 1) * 7);
}

// === Lista de datas ===
// Mantida ordenada por mês pra facilitar edição manual.

export const DATAS_COMEMORATIVAS = [
  // === JANEIRO ===
  {
    id: 'ano_novo',
    nome: 'Ano Novo',
    emoji: '🎆',
    mes: 1, dia: 1,
    importancia: 'alta',
    segmentos: [],
    sugestao: 'Comece o ano com ofertas de produtos pra organização, fitness, planejamento.',
  },
  {
    id: 'liquida_janeiro',
    nome: 'Liquida de Janeiro',
    emoji: '🏷️',
    mes: 1, dia: 10,
    importancia: 'media',
    segmentos: ['moda', 'casa'],
    sugestao: 'Queima de estoque pós-Natal. Foco em descontos agressivos em moda e bazar.',
  },

  // === FEVEREIRO ===
  {
    id: 'carnaval',
    nome: 'Carnaval',
    emoji: '🎭',
    mes: 2, dia: (ano) => carnavalTerca(ano),
    importancia: 'alta',
    segmentos: ['bebidas', 'mercado', 'moda'],
    sugestao: 'Bebidas, salgadinhos, fantasias, repelentes. Combo "kit foliões".',
  },
  {
    id: 'dia_pizza',
    nome: 'Dia da Pizza',
    emoji: '🍕',
    mes: 2, dia: 10,
    importancia: 'baixa',
    segmentos: ['mercado', 'restaurante'],
    sugestao: 'Promoção em queijos, molhos, ingredientes de pizza caseira.',
  },
  {
    id: 'sao_valentim',
    nome: 'Dia de São Valentim (mundial)',
    emoji: '💝',
    mes: 2, dia: 14,
    importancia: 'baixa',
    segmentos: ['floricultura', 'restaurante'],
    sugestao: 'No Brasil é em junho — mas casais que seguem tradição internacional compram chocolates e flores.',
  },

  // === MARÇO ===
  {
    id: 'dia_mulher',
    nome: 'Dia Internacional da Mulher',
    emoji: '💐',
    mes: 3, dia: 8,
    importancia: 'alta',
    segmentos: ['cosmeticos', 'moda', 'floricultura'],
    sugestao: 'Cosméticos, perfumaria, flores, vinhos. Tom de respeito + descontos especiais.',
  },
  {
    id: 'dia_consumidor',
    nome: 'Dia do Consumidor',
    emoji: '🛒',
    mes: 3, dia: 15,
    importancia: 'alta',
    segmentos: [],
    sugestao: 'A "Black Friday do 1º semestre". Faça ofertas em destaque, monte combos.',
  },
  {
    id: 'dia_agua',
    nome: 'Dia Mundial da Água',
    emoji: '💧',
    mes: 3, dia: 22,
    importancia: 'baixa',
    segmentos: ['mercado'],
    sugestao: 'Água mineral, sucos naturais, produtos sustentáveis.',
  },

  // === ABRIL ===
  {
    id: 'pascoa',
    nome: 'Páscoa',
    emoji: '🐰',
    mes: 4, dia: (ano) => paschalSunday(ano),
    importancia: 'alta',
    segmentos: ['mercado', 'doceria'],
    sugestao: 'Chocolate, ovos de Páscoa, peixes, vinho. Campanha começa 3 semanas antes.',
  },
  {
    id: 'tiradentes',
    nome: 'Tiradentes',
    emoji: '🇧🇷',
    mes: 4, dia: 21,
    importancia: 'baixa',
    segmentos: [],
    sugestao: 'Feriado nacional — combos pra churrasco em casa ou kit viagem.',
  },

  // === MAIO ===
  {
    id: 'dia_trabalhador',
    nome: 'Dia do Trabalhador',
    emoji: '🔧',
    mes: 5, dia: 1,
    importancia: 'media',
    segmentos: [],
    sugestao: 'Ferramentas, EPIs, lanche pro almoço, cerveja. Cliente em casa o dia todo.',
  },
  {
    id: 'dia_maes',
    nome: 'Dia das Mães',
    emoji: '👩‍👧',
    mes: 5, dia: (ano) => diaDasMaes(ano),
    importancia: 'alta',
    segmentos: ['cosmeticos', 'moda', 'floricultura', 'doceria'],
    sugestao: 'A 2ª data de maior venda do ano (atrás só do Natal). Comece a campanha 3 semanas antes.',
  },
  {
    id: 'dia_noivas',
    nome: 'Dia das Noivas',
    emoji: '👰',
    mes: 5, dia: (ano) => diaDasNoivas(ano),
    importancia: 'baixa',
    segmentos: ['moda', 'floricultura'],
    sugestao: 'Vestidos, lingerie, decoração, doces de festa.',
  },

  // === JUNHO ===
  {
    id: 'festa_junina',
    nome: 'Festas Juninas (mês)',
    emoji: '🌽',
    mes: 6, dia: 13,
    importancia: 'alta',
    segmentos: ['mercado', 'bebidas'],
    sugestao: 'Quentão, vinho quente, paçoca, milho, pinhão, canjica. Campanha o mês inteiro.',
  },
  {
    id: 'santo_antonio',
    nome: 'Santo Antônio (casamenteiro)',
    emoji: '💒',
    mes: 6, dia: 13,
    importancia: 'baixa',
    segmentos: [],
    sugestao: 'Tema de "amor" — combo casais.',
  },
  {
    id: 'dia_namorados',
    nome: 'Dia dos Namorados',
    emoji: '❤️',
    mes: 6, dia: 12,
    importancia: 'alta',
    segmentos: ['cosmeticos', 'moda', 'floricultura', 'doceria', 'restaurante'],
    sugestao: 'Chocolate, vinho, perfume, jantar especial. 3ª data mais lucrativa do ano.',
  },
  {
    id: 'sao_joao',
    nome: 'São João',
    emoji: '🔥',
    mes: 6, dia: 24,
    importancia: 'media',
    segmentos: ['mercado', 'bebidas'],
    sugestao: 'Pico das festas juninas. Estoque pré-festa, descontos pós.',
  },

  // === JULHO ===
  {
    id: 'ferias_julho',
    nome: 'Férias de Julho',
    emoji: '🏖️',
    mes: 7, dia: 5,
    importancia: 'media',
    segmentos: ['mercado'],
    sugestao: 'Famílias em casa o dia todo. Lanches, sobremesas, produtos de viagem, snacks.',
  },
  {
    id: 'dia_amigo',
    nome: 'Dia do Amigo',
    emoji: '🤝',
    mes: 7, dia: 20,
    importancia: 'baixa',
    segmentos: ['doceria', 'restaurante', 'cosmeticos'],
    sugestao: 'Combos pra presentear amigos, kits de "happy hour".',
  },

  // === AGOSTO ===
  {
    id: 'dia_pais',
    nome: 'Dia dos Pais',
    emoji: '👨‍👦',
    mes: 8, dia: (ano) => diaDosPais(ano),
    importancia: 'alta',
    segmentos: ['mercado', 'bebidas', 'moda'],
    sugestao: '4ª data mais lucrativa. Cerveja, churrasco, ferramentas, perfume masculino.',
  },
  {
    id: 'dia_estudante',
    nome: 'Dia do Estudante',
    emoji: '📚',
    mes: 8, dia: 11,
    importancia: 'baixa',
    segmentos: ['papelaria', 'mercado'],
    sugestao: 'Material escolar, lanches, produtos de estudo.',
  },

  // === SETEMBRO ===
  {
    id: 'independencia',
    nome: 'Independência do Brasil',
    emoji: '🇧🇷',
    mes: 9, dia: 7,
    importancia: 'media',
    segmentos: ['mercado', 'bebidas'],
    sugestao: 'Feriado prolongado — combos pra churrasco, viagem.',
  },
  {
    id: 'dia_cliente',
    nome: 'Dia do Cliente',
    emoji: '🛍️',
    mes: 9, dia: 15,
    importancia: 'alta',
    segmentos: [],
    sugestao: 'Faça promoções relâmpago, descontos progressivos, brindes pra fidelizar.',
  },
  {
    id: 'primavera',
    nome: 'Início da Primavera',
    emoji: '🌸',
    mes: 9, dia: 22,
    importancia: 'baixa',
    segmentos: ['floricultura', 'cosmeticos', 'moda'],
    sugestao: 'Roupas leves, perfumaria floral, flores, jardinagem.',
  },

  // === OUTUBRO ===
  {
    id: 'dia_criancas',
    nome: 'Dia das Crianças',
    emoji: '🎈',
    mes: 10, dia: 12,
    importancia: 'alta',
    segmentos: ['mercado', 'brinquedos', 'doceria'],
    sugestao: 'Brinquedos, doces, lanches kids, produtos infantis. Campanha 3 semanas antes.',
  },
  {
    id: 'dia_professor',
    nome: 'Dia do Professor',
    emoji: '👩‍🏫',
    mes: 10, dia: 15,
    importancia: 'media',
    segmentos: ['floricultura', 'doceria', 'cosmeticos'],
    sugestao: 'Presentes pra professores: flores, chocolates, kits de presente.',
  },
  {
    id: 'halloween',
    nome: 'Halloween',
    emoji: '🎃',
    mes: 10, dia: 31,
    importancia: 'media',
    segmentos: ['doceria', 'mercado'],
    sugestao: 'Doces, fantasias, decoração temática. Cresce a cada ano no BR.',
  },

  // === NOVEMBRO ===
  {
    id: 'finados',
    nome: 'Finados',
    emoji: '🕯️',
    mes: 11, dia: 2,
    importancia: 'baixa',
    segmentos: ['floricultura'],
    sugestao: 'Pico de venda em floriculturas e velas.',
  },
  {
    id: 'proclamacao',
    nome: 'Proclamação da República',
    emoji: '🇧🇷',
    mes: 11, dia: 15,
    importancia: 'baixa',
    segmentos: [],
    sugestao: 'Feriado — combos churrasco, viagem.',
  },
  {
    id: 'black_friday',
    nome: 'Black Friday',
    emoji: '🖤',
    mes: 11, dia: (ano) => blackFriday(ano),
    importancia: 'alta',
    segmentos: [],
    sugestao: 'A maior data de vendas do segundo semestre. Comece teasing 2 semanas antes, prepare estoque.',
  },
  {
    id: 'cyber_monday',
    nome: 'Cyber Monday',
    emoji: '💻',
    mes: 11, dia: (ano) => cyberMonday(ano),
    importancia: 'media',
    segmentos: [],
    sugestao: 'Foco em descontos online + extensão Black Friday.',
  },

  // === DEZEMBRO ===
  {
    id: 'natal',
    nome: 'Natal',
    emoji: '🎄',
    mes: 12, dia: 25,
    importancia: 'alta',
    segmentos: [],
    sugestao: 'A maior data do ano. Ceia, presentes, decoração, panetone. Campanha começa 30/nov.',
  },
  {
    id: 'reveillon',
    nome: 'Réveillon',
    emoji: '🥂',
    mes: 12, dia: 31,
    importancia: 'alta',
    segmentos: ['bebidas', 'mercado'],
    sugestao: 'Espumante, vinho, lentilha, romã, kits de festa, comidas pra ceia.',
  },
];

// === Helpers de runtime ===

// Resolve a data efetiva pro ano dado (pra datas variáveis)
export function resolverData(entry, ano) {
  if (typeof entry.dia === 'function') return entry.dia(ano);
  return new Date(ano, entry.mes - 1, entry.dia);
}

// Retorna as próximas N datas a partir de hoje (ordenadas por proximidade)
export function proximasDatas(referencia = new Date(), limite = 8) {
  const ano = referencia.getFullYear();
  const itensComData = [];

  // Tenta no ano corrente; o que já passou vai pro ano que vem
  for (const entry of DATAS_COMEMORATIVAS) {
    let dataEfetiva = resolverData(entry, ano);
    if (dataEfetiva < referencia) {
      dataEfetiva = resolverData(entry, ano + 1);
    }
    itensComData.push({ ...entry, dataEfetiva });
  }

  itensComData.sort((a, b) => a.dataEfetiva - b.dataEfetiva);
  return itensComData.slice(0, limite);
}

// Filtra por segmento (se segmento === null, retorna tudo)
export function filtrarPorSegmento(itens, segmento) {
  if (!segmento) return itens;
  return itens.filter(i => i.segmentos.length === 0 || i.segmentos.includes(segmento));
}

// Dias entre hoje e a data
export function diasAte(data, referencia = new Date()) {
  const ms = data - referencia;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
