import { useEffect, useState } from 'react';

const STORAGE_KEY = 'encarte-builder:datas';

const DADOS_VAZIOS = {
  dataInicio: '',
  dataFinal: '',
  frasePromocional: '',
  mostrar: {
    datas: true,                     // mostra "Validade de DD/MM a DD/MM"
    enquantoDurarem: false,          // "Enquanto durarem os estoques"
    imagensIlustrativas: true,       // "*Imagens Meramente Ilustrativas"
    advertenciaMedicamento: false,   // disclaimer de medicamento
    frasePromocional: false,         // mostra a frase customizada
  },
};

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DADOS_VAZIOS;
    const obj = JSON.parse(raw);
    return {
      ...DADOS_VAZIOS,
      ...obj,
      mostrar: { ...DADOS_VAZIOS.mostrar, ...(obj.mostrar || {}) },
    };
  } catch {
    return DADOS_VAZIOS;
  }
}

const TOGGLES = [
  { key: 'datas',                  label: 'Mostrar datas' },
  { key: 'enquantoDurarem',        label: 'Enquanto durarem os estoques' },
  { key: 'imagensIlustrativas',    label: 'Imagens Meramente Ilustrativas' },
  { key: 'advertenciaMedicamento', label: 'Advertência Medicamento' },
  { key: 'frasePromocional',       label: 'Mostrar Frase Promocional' },
];

export default function PainelDatas({ aoAtualizar }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);

  useEffect(() => {
    const inicial = carregar();
    setDados(inicial);
    aoAtualizar?.(inicial);
  }, []);

  const salvar = (novo) => {
    setDados(novo);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(novo)); } catch {}
    aoAtualizar?.(novo);
  };

  const setCampo = (key, valor) => {
    salvar({ ...dados, [key]: valor });
  };

  const toggle = (key) => {
    salvar({
      ...dados,
      mostrar: { ...dados.mostrar, [key]: !dados.mostrar[key] },
    });
  };

  return (
    <div className="painel-datas">
      <div className="pd-header">
        <div>
          <h2 className="pd-titulo">Defina suas regras</h2>
          <p className="pd-sub">Escolha as datas do período da oferta e outras regras adicionais.</p>
        </div>
        <span
          className="pd-help"
          title="Configure datas do período de oferta e regras adicionais que aparecem no encarte."
        >?</span>
      </div>

      {/* Datas — agrupadas em card */}
      <div className="pd-card">
        <div className="pd-card-titulo">📅 Período da oferta</div>
        <div className="pd-row">
          <div className="pd-campo">
            <label>Data de Início</label>
            <input
              type="date"
              value={dados.dataInicio}
              onChange={(e) => setCampo('dataInicio', e.target.value)}
            />
          </div>
          <div className="pd-campo">
            <label>Data Final</label>
            <input
              type="date"
              value={dados.dataFinal}
              onChange={(e) => setCampo('dataFinal', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Toggles — cada um numa "linha-card" com hover */}
      <div className="pd-secao-titulo">⚙ Regras visíveis no encarte</div>
      <div className="pd-toggles">
        {TOGGLES.map(t => {
          const ativo = !!dados.mostrar[t.key];
          return (
            <button
              key={t.key}
              type="button"
              className={`pd-toggle-row ${ativo ? 'ativo' : ''}`}
              onClick={() => toggle(t.key)}
            >
              <span className="pd-toggle-label">{t.label}</span>
              <span className={`pd-switch ${ativo ? 'on' : ''}`}>
                <span className="pd-switch-knob" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Frase Promocional */}
      <div className="pd-secao-titulo">💬 Frase Promocional</div>
      <div className="pd-card">
        <div className="pd-campo">
          <textarea
            rows={3}
            value={dados.frasePromocional}
            onChange={(e) => setCampo('frasePromocional', e.target.value)}
            placeholder="Ex: Venha aproveitar nossa promoção de fim de mês!"
          />
          <div className="pd-campo-hint">
            Aparece no rodapé do encarte. Ative <b>Mostrar Frase Promocional</b> acima pra exibi-la.
          </div>
        </div>
      </div>
    </div>
  );
}
