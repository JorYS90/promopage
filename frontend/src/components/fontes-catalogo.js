// Catálogo de fontes Google curadas pra encartes de varejo.
// Cada fonte: { id (matches CSS family), nome (display), peso, estilo (categoria),
//               url (Google Fonts CSS pra carregar dinamicamente).
// Estilos: 'condensada' | 'bold' | 'redonda' | 'serif' | 'script' | 'mono'
//
// Os pesos são apenas a faixa principal usada no preview — o CSS @import carrega
// múltiplos pesos. Ao aplicar a fonte, usamos o peso default.
export const FONTES = [
  // === Bold/Display (ideal pra título de produto) ===
  { id: 'Anton',                nome: 'Anton',                peso: 400, estilo: 'condensada' },
  { id: 'Bebas Neue',           nome: 'Bebas Neue',           peso: 400, estilo: 'condensada' },
  { id: 'Oswald',               nome: 'Oswald',               peso: 700, estilo: 'condensada' },
  { id: 'Fira Sans Condensed',  nome: 'Fira Sans Condensed',  peso: 900, estilo: 'condensada' },
  { id: 'Archivo Black',        nome: 'Archivo Black',        peso: 900, estilo: 'bold' },
  { id: 'Bowlby One',           nome: 'Bowlby One',           peso: 400, estilo: 'bold' },
  { id: 'Black Ops One',        nome: 'Black Ops One',        peso: 400, estilo: 'bold' },
  { id: 'Big Shoulders Display',nome: 'Big Shoulders Display',peso: 900, estilo: 'condensada' },
  { id: 'Bungee',               nome: 'Bungee',               peso: 400, estilo: 'bold' },
  { id: 'Permanent Marker',     nome: 'Permanent Marker',     peso: 400, estilo: 'script' },

  // === Sans-serif modernas (versáteis) ===
  { id: 'Open Sans',            nome: 'Open Sans',            peso: 800, estilo: 'redonda' },
  { id: 'Roboto',               nome: 'Roboto',               peso: 900, estilo: 'redonda' },
  { id: 'Poppins',              nome: 'Poppins',              peso: 800, estilo: 'redonda' },
  { id: 'Montserrat',           nome: 'Montserrat',           peso: 800, estilo: 'redonda' },
  { id: 'Inter',                nome: 'Inter',                peso: 800, estilo: 'redonda' },
  { id: 'DM Sans',              nome: 'DM Sans',              peso: 700, estilo: 'redonda' },
  { id: 'Plus Jakarta Sans',    nome: 'Plus Jakarta Sans',    peso: 800, estilo: 'redonda' },
  { id: 'Nunito',               nome: 'Nunito',               peso: 900, estilo: 'redonda' },
  { id: 'Lato',                 nome: 'Lato',                 peso: 900, estilo: 'redonda' },
  { id: 'Work Sans',            nome: 'Work Sans',            peso: 800, estilo: 'redonda' },

  // === Rounded / amigáveis ===
  { id: 'M PLUS Rounded 1c',    nome: 'M PLUS Rounded 1c',    peso: 900, estilo: 'redonda' },
  { id: 'Comfortaa',            nome: 'Comfortaa',            peso: 700, estilo: 'redonda' },
  { id: 'Quicksand',            nome: 'Quicksand',            peso: 700, estilo: 'redonda' },
  { id: 'Baloo 2',              nome: 'Baloo 2',              peso: 800, estilo: 'redonda' },
  { id: 'Fredoka',              nome: 'Fredoka',              peso: 700, estilo: 'redonda' },

  // === Serif (clássicas, premium) ===
  { id: 'Playfair Display',     nome: 'Playfair Display',     peso: 900, estilo: 'serif' },
  { id: 'Merriweather',         nome: 'Merriweather',         peso: 900, estilo: 'serif' },
  { id: 'Lora',                 nome: 'Lora',                 peso: 700, estilo: 'serif' },

  // === Script / decorativas ===
  { id: 'Pacifico',             nome: 'Pacifico',             peso: 400, estilo: 'script' },
  { id: 'Lobster',              nome: 'Lobster',              peso: 400, estilo: 'script' },
  { id: 'Caveat',               nome: 'Caveat',               peso: 700, estilo: 'script' },
  { id: 'Dancing Script',       nome: 'Dancing Script',       peso: 700, estilo: 'script' },

  // === Monospace ===
  { id: 'JetBrains Mono',       nome: 'JetBrains Mono',       peso: 800, estilo: 'mono' },
  { id: 'Space Mono',           nome: 'Space Mono',           peso: 700, estilo: 'mono' },
];

// IDs dos targets de fonte (onde aplicar). Cada um corresponde a uma categoria
// de texto no encarte.
export const FONTE_TARGETS = [
  { key: 'nome',   label: 'Título do produto',     padrao: 'Anton' },
  { key: 'preco',  label: 'Etiqueta de preço',     padrao: 'Helvetica Neue' },
  { key: 'frase',  label: 'Mensagem promocional',  padrao: 'Arial' },
  { key: 'rodape', label: 'Textos do rodapé',      padrao: 'Arial' },
];

// Carrega uma fonte do Google Fonts dinamicamente. Adiciona um <link> no head
// se ainda não existir. Aceita um array de IDs.
const FONTES_CARREGADAS = new Set();
export function carregarFontesGoogle(ids) {
  const novas = ids.filter(id => !FONTES_CARREGADAS.has(id));
  if (novas.length === 0) return;
  // Constroi URL do Google Fonts (suporta múltiplas fontes em uma chamada)
  // ?family=Anton&family=Roboto:wght@400;700;900&display=swap
  const families = novas.map(id => {
    // Remove espaços e formata pra Google Fonts URL
    const fam = id.replace(/ /g, '+');
    return `family=${fam}:wght@400;500;600;700;800;900`;
  }).join('&');
  const url = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
  novas.forEach(id => FONTES_CARREGADAS.add(id));
}

// Carrega TODAS as fontes do catálogo de uma vez (pro painel de seleção)
export function carregarTodasFontes() {
  carregarFontesGoogle(FONTES.map(f => f.id));
}
