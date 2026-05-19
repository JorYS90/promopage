import { useEffect, useState } from 'react';
import ModalFormasPagamento from './ModalFormasPagamento.jsx';
import { obterFormaPagamento } from './formas-pagamento.js';

// Lista de campos exibíveis no encarte. `key` é a chave no objeto da empresa,
// `placeholder` é o texto-fantasma do input quando vazio.
// Campos com `subCampos` mostram MÚLTIPLOS inputs ao expandir (ex: legendas separadas
// pra Whatsapp e Telefone).
const CAMPOS = [
  { key: 'telefone',         label: 'Mostrar Telefone',                placeholder: '(11) 99999-9999' },
  { key: 'whatsapp',         label: 'Mostrar Whatsapp',                placeholder: '(11) 99999-9999' },
  { key: 'legendaTelefones', label: 'Legenda dos telefones',
    subCampos: [
      { key: 'legendaWhatsapp', placeholder: 'Ex: Delivery (Whatsapp)' },
      { key: 'legendaTelefone', placeholder: 'Ex: Delivery (Telefone)' },
    ] },
  { key: 'nome',             label: 'Mostrar Nome da Empresa',         placeholder: 'Ex: Supermercado Bom Preço' },
  { key: 'slogan',           label: 'Mostrar Slogan',                  placeholder: 'Ex: O melhor preço da cidade' },
  { key: 'formasPagamento',  label: 'Mostrar Formas de pagamento',     tipo: 'lista-pagamento' },
  { key: 'obsPagamento',     label: 'Mostrar observação de pagamento', placeholder: 'Ex: Parcelamos em até 6× sem juros' },
  { key: 'endereco',         label: 'Mostrar endereço',                placeholder: 'Ex: Rua das Flores, 123 - Centro' },
  { key: 'instagram',        label: 'Mostrar Instagram',               placeholder: '@suaempresa' },
  { key: 'facebook',         label: 'Mostrar Facebook',                placeholder: 'facebook.com/suaempresa' },
  { key: 'website',          label: 'Mostrar Website',                 placeholder: 'www.suaempresa.com.br' },
];

// Chave isolada por user (2026-05-19) — cada conta tem dados próprios da empresa
const storageKey = (userId) => `encarte-builder:empresa:${userId || 'anon'}`;

const DADOS_VAZIOS = {
  // Valores
  telefone: '', whatsapp: '',
  legendaTelefone: '', legendaWhatsapp: '',
  nome: '', slogan: '',
  formasPagamento: [],   // array de IDs (cartao-credito, pix, etc)
  obsPagamento: '',
  endereco: '',
  instagram: '', facebook: '', website: '',
  // Toggles de visibilidade (todos off por padrão)
  mostrar: {
    telefone: false, whatsapp: false, legendaTelefones: false,
    nome: false, slogan: false,
    formasPagamento: false, obsPagamento: false,
    endereco: false,
    instagram: false, facebook: false, website: false,
  },
};

function carregar(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DADOS_VAZIOS;
    const obj = JSON.parse(raw);
    return { ...DADOS_VAZIOS, ...obj, mostrar: { ...DADOS_VAZIOS.mostrar, ...(obj.mostrar || {}) } };
  } catch {
    return DADOS_VAZIOS;
  }
}

export default function PainelEmpresa({ aoAtualizar, userId }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);
  // Quais campos estão com o input expandido pra edição (clicou no lápis)
  const [editando, setEditando] = useState({});
  // Modal de formas de pagamento aberto?
  const [modalPagamento, setModalPagamento] = useState(false);

  // Carrega do localStorage no mount (e recarrega quando user muda)
  useEffect(() => {
    const inicial = carregar(userId);
    setDados(inicial);
    aoAtualizar?.(inicial);
  }, [userId]);

  // Persiste e notifica o pai sempre que `dados` muda
  const salvar = (novo) => {
    setDados(novo);
    try { localStorage.setItem(storageKey(userId), JSON.stringify(novo)); } catch {}
    aoAtualizar?.(novo);
  };

  const toggle = (key) => {
    salvar({
      ...dados,
      mostrar: { ...dados.mostrar, [key]: !dados.mostrar[key] },
    });
  };

  const setValor = (key, valor) => {
    salvar({ ...dados, [key]: valor });
  };

  const toggleEdicao = (key) => {
    // Caso especial: formasPagamento abre um modal em vez de input inline
    if (key === 'formasPagamento') {
      setModalPagamento(true);
      return;
    }
    setEditando(e => ({ ...e, [key]: !e[key] }));
  };

  return (
    <div className="painel-empresa">
      <div className="pe2-header">
        <div>
          <h2 className="pe2-titulo">Dados da Empresa</h2>
          <p className="pe2-sub">
            Para mostrar informações adicionais da empresa, preencha os dados em{' '}
            <span className="pe2-link">minha empresa</span>.
          </p>
        </div>
        <span
          className="pe2-help"
          title="Toggle ativa o campo no encarte. O lápis abre o campo pra editar o valor."
        >?</span>
      </div>

      <div className="pe2-lista">
        {CAMPOS.map(campo => {
          const ativo = !!dados.mostrar[campo.key];
          const aberto = !!editando[campo.key];
          const temSubCampos = Array.isArray(campo.subCampos) && campo.subCampos.length > 0;
          const ehListaPagamento = campo.tipo === 'lista-pagamento';
          const valor = dados[campo.key] || '';
          // Preview consolidado
          let previewTexto = '';
          if (ehListaPagamento) {
            const ids = Array.isArray(dados.formasPagamento) ? dados.formasPagamento : [];
            previewTexto = ids.length ? `${ids.length} forma(s) selecionada(s)` : '';
          } else if (temSubCampos) {
            previewTexto = campo.subCampos.map(s => dados[s.key]).filter(Boolean).join(' | ');
          } else {
            previewTexto = valor;
          }
          return (
            <div key={campo.key} className={`pe2-card ${ativo ? 'ativo' : ''}`}>
              <div className="pe2-linha">
                <button
                  type="button"
                  className={`pd-switch ${ativo ? 'on' : ''}`}
                  onClick={() => toggle(campo.key)}
                  title={ativo ? 'Ocultar' : 'Mostrar'}
                >
                  <span className="pd-switch-knob" />
                </button>
                <span className="pe2-label">{campo.label}</span>
                <button
                  type="button"
                  className={`pe2-edit ${aberto ? 'em-edicao' : ''}`}
                  onClick={() => toggleEdicao(campo.key)}
                  title={aberto ? 'Confirmar' : 'Editar valor'}
                  aria-label="Editar"
                >
                  {aberto ? '✓' : '✏️'}
                </button>
              </div>
              {aberto && temSubCampos && (
                <div className="pe2-input-wrap">
                  {campo.subCampos.map((sc, i) => (
                    <input
                      key={sc.key}
                      type="text"
                      placeholder={sc.placeholder}
                      value={dados[sc.key] || ''}
                      onChange={(e) => setValor(sc.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          toggleEdicao(campo.key);
                        }
                      }}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              )}
              {aberto && !temSubCampos && (
                <div className="pe2-input-wrap">
                  <input
                    type="text"
                    placeholder={campo.placeholder}
                    value={valor}
                    onChange={(e) => setValor(campo.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        toggleEdicao(campo.key);
                      }
                    }}
                    autoFocus
                  />
                </div>
              )}
              {!aberto && previewTexto && !ehListaPagamento && (
                <div className="pe2-preview" onClick={() => toggleEdicao(campo.key)}>
                  {previewTexto}
                </div>
              )}
              {ehListaPagamento && Array.isArray(dados.formasPagamento) && dados.formasPagamento.length > 0 && (
                <div className="pe2-formas-mini" onClick={() => toggleEdicao(campo.key)}>
                  {dados.formasPagamento.slice(0, 8).map(id => {
                    const f = obterFormaPagamento(id);
                    if (!f) return null;
                    return (
                      <span
                        key={id}
                        className="forma-mini"
                        style={{ background: f.cor }}
                        title={f.label}
                      >
                        {f.textoIcone}
                      </span>
                    );
                  })}
                  {dados.formasPagamento.length > 8 && (
                    <span className="forma-mini-mais">+{dados.formasPagamento.length - 8}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalPagamento && (
        <ModalFormasPagamento
          selecionadasIniciais={dados.formasPagamento || []}
          aoFechar={() => setModalPagamento(false)}
          aoSalvar={(ids) => salvar({ ...dados, formasPagamento: ids })}
        />
      )}
    </div>
  );
}
