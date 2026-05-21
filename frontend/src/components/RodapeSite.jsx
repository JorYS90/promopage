import LogoPromoPage from './LogoPromoPage.jsx';

// Rodapé institucional do site (estilo landing page) — usado na página de
// Recursos e Planos. Centraliza redes sociais, links legais e dados da empresa.
//
// ⚠️ PREENCHER COM OS DADOS REAIS DO PROMOPAGE. Os valores abaixo são
// placeholders — troque CNPJ, telefone, endereço e links das redes sociais
// pelos dados oficiais. Tudo num só objeto pra facilitar a edição.
const INFO = {
  instagram: 'https://instagram.com/promopage',
  facebook: 'https://facebook.com/promopage',
  whatsapp: 'https://wa.me/5500000000000',
  termosUrl: '#',
  privacidadeUrl: '#',
  anuncieUrl: '#',
  cnpj: '00.000.000/0001-00',
  telefone: '+55 (00) 0000-0000',
  endereco: 'Rua Exemplo, 000 - Bairro, Cidade - UF, CEP 00000-000',
  anoInicio: 2026,
};

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

export default function RodapeSite() {
  const anoAtual = new Date().getFullYear();
  const anos = INFO.anoInicio && INFO.anoInicio < anoAtual
    ? `${INFO.anoInicio} - ${anoAtual}`
    : `${anoAtual}`;
  return (
    <footer className="rodape-site">
      <div className="rs-links">
        <a href={INFO.instagram} target="_blank" rel="noopener noreferrer"><IconeInstagram /> Siga no Instagram</a>
        <a href={INFO.facebook} target="_blank" rel="noopener noreferrer"><IconeFacebook /> Siga no Facebook</a>
        <a href={INFO.whatsapp} target="_blank" rel="noopener noreferrer"><IconeWhatsapp /> Chame no Whatsapp</a>
        <a href={INFO.termosUrl}>Termos de Uso</a>
        <a href={INFO.privacidadeUrl}>Política de Privacidade</a>
        <a href={INFO.anuncieUrl}>Quer Anunciar?</a>
      </div>
      <div className="rs-legal">CNPJ: {INFO.cnpj} | Telefone: {INFO.telefone}</div>
      <div className="rs-legal">Endereço: {INFO.endereco}</div>
      <div className="rs-copy">© Todos os Direitos Reservados {anos}</div>
      <div className="rs-logo"><LogoPromoPage size={36} /></div>
    </footer>
  );
}
