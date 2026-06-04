// Wrapper de chamada à OpenAI Chat Completions API.
//
// Modo dev (sem OPENAI_API_KEY): não chama API, retorna um fallback offline
// gerado por template — pra que o feature funcione localmente sem custo.
//
// Modo prod: requer OPENAI_API_KEY no .env. Modelo padrão gpt-4o-mini
// (rápido + barato, suficiente pra legenda de Instagram).

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '15000', 10);

function temApiKey() {
  return !!OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-');
}

// Chama Chat Completions. Retorna a string da resposta ou lança erro.
async function chatCompletion({ system, user, temperature = 0.7, maxTokens = 400 }) {
  if (!temApiKey()) {
    throw new Error('OPENAI_API_KEY ausente no .env — IA desabilitada.');
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const out = json?.choices?.[0]?.message?.content || '';
    return out.trim();
  } finally {
    clearTimeout(timer);
  }
}

// === Geração de legenda pra Instagram a partir do encarte ===

// Constrói o prompt do sistema — define tom, formato, restrições.
function promptSistemaLegenda() {
  return `Você é um copywriter especialista em redes sociais brasileiras,
focado em pequenos comércios (mercados, padarias, açougues, lojas de moda, etc).
Sua tarefa é gerar UMA legenda pronta pra Instagram/Facebook de um encarte de ofertas.

Regras:
- Máximo 220 caracteres (sem hashtags)
- 1 emoji forte no começo (🔥/🛒/✨/💥) + 2-3 emojis no corpo
- Linguagem direta, calorosa, brasileira ("aproveite", "garanta já", "imperdível")
- Call-to-action no final: "Venha hoje", "Corre pra loja", "Estoque limitado"
- Inclua 5-8 hashtags relevantes ao segmento na ÚLTIMA linha
- NUNCA invente preços que não foram passados
- Se a campanha tem datas (validade), mencione brevemente

Formato de resposta: APENAS a legenda final, pronta pra copiar e colar.
Sem aspas, sem "Aqui está:" — APENAS o texto.`;
}

// Monta o prompt do user com os produtos + empresa + datas
function promptUsuarioLegenda({ produtos = [], empresa = {}, datas = {}, segmento = '' }) {
  const linhasProdutos = produtos
    .filter(p => p && p.nome)
    .slice(0, 12) // limita pra controlar tokens
    .map(p => {
      const preco = p.preco ? `R$ ${p.preco}` : '';
      const precoDe = p.precoDe ? ` (de R$ ${p.precoDe})` : '';
      const unidade = p.unidadeAbrev ? ` / ${p.unidadeAbrev}` : '';
      return `- ${p.nome}${unidade ? unidade : ''} ${preco}${precoDe}`.trim();
    });
  const partes = [];
  partes.push(`Nome da loja: ${empresa.nome || 'Loja'}`);
  if (empresa.endereco) partes.push(`Endereço: ${empresa.endereco}`);
  if (segmento) partes.push(`Segmento da loja: ${segmento}`);
  if (datas.dataInicio || datas.dataFinal) {
    const periodo = [datas.dataInicio, datas.dataFinal].filter(Boolean).map(formatarDataBR).join(' a ');
    partes.push(`Validade da oferta: ${periodo}`);
  }
  partes.push('');
  partes.push('Produtos em oferta:');
  partes.push(linhasProdutos.length ? linhasProdutos.join('\n') : '(nenhum produto)');
  partes.push('');
  partes.push('Gere a legenda agora.');
  return partes.join('\n');
}

function formatarDataBR(iso) {
  // "2026-06-04" -> "04/06"
  if (!iso || iso.length < 10) return iso || '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// Fallback offline: monta legenda por template quando não tem API key
// (usado em dev local e como safety-net se OpenAI falhar).
function legendaOffline({ produtos = [], empresa = {}, datas = {} }) {
  const validos = produtos.filter(p => p && p.nome).slice(0, 5);
  const nomeLoja = empresa.nome || 'nossa loja';

  if (validos.length === 0) {
    return `🛒 Não perca as ofertas da semana na ${nomeLoja}!\n` +
           `Venha conferir, estoque limitado. ✨\n\n` +
           `#ofertas #promocao #${slug(nomeLoja)} #encarte #promopage`;
  }

  const topo = validos.slice(0, 3).map(p => {
    const preco = p.preco ? ` por R$ ${p.preco}` : '';
    return `▶ ${p.nome}${preco}`;
  }).join('\n');

  let validade = '';
  if (datas?.dataInicio || datas?.dataFinal) {
    const periodo = [datas.dataInicio, datas.dataFinal].filter(Boolean).map(formatarDataBR).join(' a ');
    validade = `📅 Válido de ${periodo}\n`;
  }

  return `🔥 OFERTAS IMPERDÍVEIS na ${nomeLoja}! 🔥\n\n` +
         `${topo}\n\n` +
         `${validade}` +
         `Corre pra loja — estoque limitado! ✨\n\n` +
         `#ofertas #promocao #${slug(nomeLoja)} #encarte #encartedigital #promopage`;
}

function slug(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// API principal: gera legenda. Tenta OpenAI; cai pro template se falhar.
async function gerarLegendaInstagram({ produtos, empresa, datas, segmento }) {
  if (!temApiKey()) {
    return {
      legenda: legendaOffline({ produtos, empresa, datas }),
      fonte: 'template-offline',
      aviso: 'OPENAI_API_KEY não configurada no .env — usando template offline. Configure a chave no servidor pra ativar IA real.',
    };
  }
  try {
    const legenda = await chatCompletion({
      system: promptSistemaLegenda(),
      user: promptUsuarioLegenda({ produtos, empresa, datas, segmento }),
      temperature: 0.8,
      maxTokens: 350,
    });
    return { legenda, fonte: `openai:${OPENAI_MODEL}` };
  } catch (e) {
    console.error('[openai] falhou, caindo pro template:', e.message);
    return {
      legenda: legendaOffline({ produtos, empresa, datas }),
      fonte: 'template-fallback',
      aviso: `IA indisponível agora (${e.message}). Usando template.`,
    };
  }
}

module.exports = { gerarLegendaInstagram, temApiKey };
