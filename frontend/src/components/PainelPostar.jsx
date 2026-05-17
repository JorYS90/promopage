import { useMemo, useState } from 'react';

// Painel "Postar nas Redes Sociais" — gera texto acessível #PraCegoVer
// a partir dos produtos do encarte. Cada produto vira uma linha com play
// (text-to-speech via Web Speech API).
//
// Inspirado em qrofertas.com: facilita o lojista postar a oferta em
// formato texto no Instagram/WhatsApp, com acessibilidade pra leitores de tela.

// Formata um produto: "Coxinha da Asa R$ 9,99 Kilo"
function formatarProduto(p) {
  const nome = (p.nome || '').trim();
  const preco = (p.preco || '').replace(',', ',');
  const unidade = unidadePorExtenso(p.unidadeAbrev);
  if (!preco) return nome;
  return `${nome} R$ ${preco}${unidade ? ' ' + unidade : ''}`;
}

// Converte abreviação (KG, UN, etc.) pra extenso (pra leitor de tela falar certo)
function unidadePorExtenso(abrev) {
  if (!abrev) return '';
  const map = {
    KG: 'Kilo', G: 'Grama', GR: 'Grama',
    L: 'Litro', LT: 'Litro', ML: 'Mililitro',
    UN: 'Unidade', UND: 'Unidade', PC: 'Pacote', PCT: 'Pacote',
    CX: 'Caixa', DZ: 'Dúzia', BDJ: 'Bandeja',
  };
  return map[abrev.toUpperCase()] || abrev;
}

// Lê em voz alta (Web Speech API — Chrome/Edge/Safari)
function falar(texto) {
  if (!('speechSynthesis' in window)) {
    alert('Seu navegador não suporta leitura de voz.');
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export default function PainelPostar({ produtos = [], empresa }) {
  const [copiado, setCopiado] = useState(false);

  const linhas = useMemo(
    () => produtos.filter(p => p && p.nome).map(formatarProduto),
    [produtos]
  );

  // Handle do empresa (Instagram-like)
  const handleEmpresa = useMemo(() => {
    if (!empresa?.nome) return '@promopage';
    const limpo = empresa.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
    return '@' + (limpo || 'promopage');
  }, [empresa]);

  // Texto COMPLETO formatado pra copiar (estilo qrofertas exato)
  const textoCompleto = useMemo(() => {
    const partes = [];
    partes.push('🎉 Ofertas Imperdíveis 🎉');
    partes.push('');
    linhas.forEach(l => partes.push('▶ ' + l));
    partes.push('');
    partes.push('⭐ ATENÇÃO NOS VALORES VALIDOS NO COMBO ⭐');
    partes.push(`Feito com ❤ ${handleEmpresa} #promopage`);
    partes.push('');
    partes.push('#Ofertas #Encartes #Acessibilidade #promopage');
    return partes.join('\n');
  }, [linhas, handleEmpresa]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textoCompleto;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
      catch { alert('Não foi possível copiar. Selecione manualmente.'); }
      ta.remove();
    }
  };

  const falarTudo = () => {
    if (linhas.length === 0) return;
    falar('Ofertas imperdíveis. ' + linhas.join('. ') + '. Atenção nos valores válidos no combo.');
  };

  return (
    <div className="painel painel-postar">
      <h3 className="pp-titulo">Texto para postar nas Redes Sociais</h3>
      <p className="pp-intro">
        Nos preocupamos com a acessibilidade, e todos os seus clientes tem direito a suas
        ofertas. Preparamos um texto com base nas suas ofertas, copie e use tornando suas
        ofertas acessíveis a qualquer um.{' '}
        <a
          className="pp-link"
          href="https://pt.wikipedia.org/wiki/Audiodescri%C3%A7%C3%A3o"
          target="_blank"
          rel="noopener noreferrer"
        >
          #PraCegoVer Saiba mais
        </a>
      </p>

      <div className="pp-secao-titulo">Para Cego Ver</div>

      {/* Bloco principal — fundo cinza-escuro, conteúdo branco */}
      <div className="pp-bloco">
        <div className="pp-header">🎉 Ofertas Imperdíveis 🎉</div>

        {linhas.length === 0 ? (
          <div className="pp-vazio">Adicione produtos no encarte pra gerar o texto.</div>
        ) : (
          <ul className="pp-lista">
            {linhas.map((linha, i) => (
              <li key={i}>
                <button
                  className="pp-play"
                  onClick={() => falar(linha)}
                  title="Ouvir essa oferta"
                  aria-label={`Ouvir: ${linha}`}
                >
                  ▶
                </button>
                <span className="pp-linha-texto">{linha}</span>
              </li>
            ))}
          </ul>
        )}

        {linhas.length > 0 && (
          <>
            <div className="pp-atencao">⭐ ATENÇÃO NOS VALORES VALIDOS NO COMBO ⭐</div>
            <div className="pp-footer">
              Feito com <span className="pp-coracao">❤</span> {handleEmpresa} <span className="pp-hash">#promopage</span>
            </div>
            <div className="pp-hashtags">
              <span>#Ofertas</span>
              <span>#Encartes</span>
              <span>#Acessibilidade</span>
              <span>#promopage</span>
            </div>
          </>
        )}
      </div>

      {/* Ações */}
      {linhas.length > 0 && (
        <div className="pp-acoes">
          <button className={`pp-btn-copiar ${copiado ? 'copiado' : ''}`} onClick={copiar}>
            {copiado ? '✓ Copiado!' : '📋 Copiar texto'}
          </button>
          <button className="pp-btn-ouvir" onClick={falarTudo} title="Ouvir todas as ofertas">
            🔊
          </button>
        </div>
      )}
    </div>
  );
}
