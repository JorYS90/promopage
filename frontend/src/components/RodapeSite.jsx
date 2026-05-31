import LogoPromoPage from './LogoPromoPage.jsx';

// Rodapé institucional do site (estilo landing page) — usado na página de
// Recursos e Planos. Renderiza só os itens que estiverem PREENCHIDOS:
// deixe '' (string vazia) pra desativar uma rede social, link legal ou telefone.
const INFO = {
  // Redes sociais e links legais — vazios = desativados (não aparecem)
  instagram: '',
  facebook: '',
  whatsapp: '',
  termosUrl: '',
  privacidadeUrl: '',
  anuncieUrl: '',
  // Dados da empresa
  cnpj: '59.885.670/0001-85',
  telefone: '',  // desativado por enquanto
  endereco: 'Rua Amália Tonon Minatti, 78 — Cafezal, Londrina - PR, CEP 86.045-210',
  anoInicio: 2026,
};

// Texto "Quem somos nós". Cada linha vira um parágrafo (split por \n).
const QUEM_SOMOS = `A Promopage nasceu para transformar a forma como o comércio divulga suas ofertas. Sabemos que criar encartes profissionais muitas vezes exige tempo, investimento alto com agências e um processo cansativo de edição e atualização. Por isso, desenvolvemos uma plataforma tecnológica, moderna e intuitiva, capaz de facilitar o marketing de qualquer empresa.
Nossa missão é permitir que qualquer negócio crie encartes de alto nível com praticidade, rapidez e qualidade profissional. Com a Promopage, empresas de todos os segmentos conseguem produzir materiais visualmente impactantes através de criação automática de encartes, edição fácil, templates prontos e exportação para impressão.
Acreditamos que toda empresa merece divulgar seus produtos de forma profissional, com identidade visual forte e comunicação que realmente chama atenção. Mais do que criar artes, queremos ajudar comerciantes a economizar tempo, fortalecer sua marca e vender mais.
A Promopage foi criada para simplificar processos, padronizar campanhas e levar tecnologia ao dia a dia do comércio, tornando o design profissional acessível para todos.`;

const IconeInstagram = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const IconeFacebook = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
  </svg>
);
const IconeWhatsapp = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4c0-.1-.5-1.3-.7-1.7s-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A2.8 2.8 0 0 0 5 9.3c0 1.6 1.2 3.2 1.3 3.4s2.3 3.6 5.6 5c.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1z" />
  </svg>
);

// Props opcionais:
//   aoAbrirPrivacidade — se passado, "Política de Privacidade" vira botão
//                        que abre modal interno (em vez de link externo).
//   aoAbrirTermos      — idem pra "Termos de Uso".
export default function RodapeSite({ aoAbrirPrivacidade, aoAbrirTermos } = {}) {
  const anoAtual = new Date().getFullYear();
  const anos = INFO.anoInicio && INFO.anoInicio < anoAtual
    ? `${INFO.anoInicio} - ${anoAtual}`
    : `${anoAtual}`;

  const quemSomos = QUEM_SOMOS.trim();
  // Items podem ter `href` (link externo) OU `onClick` (callback pra modal interno).
  // Privacidade/Termos preferem callback se disponível (sempre habilitados quando
  // a página passa o handler — não dependem mais do INFO.*Url estar preenchido).
  const links = [
    INFO.instagram && { href: INFO.instagram, externo: true, icone: <IconeInstagram />, label: 'Siga no Instagram' },
    INFO.facebook && { href: INFO.facebook, externo: true, icone: <IconeFacebook />, label: 'Siga no Facebook' },
    INFO.whatsapp && { href: INFO.whatsapp, externo: true, icone: <IconeWhatsapp />, label: 'Chame no Whatsapp' },
    (aoAbrirTermos || INFO.termosUrl) && {
      href: aoAbrirTermos ? null : INFO.termosUrl,
      onClick: aoAbrirTermos,
      label: 'Termos de Uso',
    },
    (aoAbrirPrivacidade || INFO.privacidadeUrl) && {
      href: aoAbrirPrivacidade ? null : INFO.privacidadeUrl,
      onClick: aoAbrirPrivacidade,
      label: 'Política de Privacidade',
    },
    INFO.anuncieUrl && { href: INFO.anuncieUrl, label: 'Quer Anunciar?' },
  ].filter(Boolean);

  return (
    <footer className="rodape-site">
      {quemSomos && (
        <div className="rs-quem-somos">
          <h3>Quem somos nós</h3>
          {quemSomos.split('\n').filter(p => p.trim()).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="rs-links">
          {links.map((l, i) => (
            l.onClick ? (
              <button
                key={i}
                type="button"
                className="rs-link-btn"
                onClick={l.onClick}
              >
                {l.icone}{l.icone ? ' ' : ''}{l.label}
              </button>
            ) : (
              <a
                key={i}
                href={l.href}
                {...(l.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {l.icone}{l.icone ? ' ' : ''}{l.label}
              </a>
            )
          ))}
        </div>
      )}

      <div className="rs-legal">
        CNPJ: {INFO.cnpj}{INFO.telefone ? ` | Telefone: ${INFO.telefone}` : ''}
      </div>
      {INFO.endereco && <div className="rs-legal">Endereço: {INFO.endereco}</div>}
      <div className="rs-copy">© Todos os Direitos Reservados {anos}</div>
      <div className="rs-logo"><LogoPromoPage size={36} /></div>
    </footer>
  );
}
