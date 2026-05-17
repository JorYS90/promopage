import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/app.css';

// Força o title via JS — caso o browser tenha cacheado o título antigo do index.html
document.title = 'PromoPage — Criador profissional de encartes e promoções';
// Garante favicon atualizado também (sobreescreve qualquer cache)
const linkExistente = document.querySelector('link[rel="icon"]');
if (linkExistente) {
  linkExistente.href = '/topbar-promopage.png?v=' + Date.now();
} else {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = '/topbar-promopage.png?v=' + Date.now();
  document.head.appendChild(link);
}

// Fontes carregadas LOCALMENTE (não depende de Google Fonts)
import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/900.css';  // black weight pra preço impactante

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
