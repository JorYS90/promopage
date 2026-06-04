import { useMemo, useState } from 'react';
import {
  DATAS_COMEMORATIVAS,
  proximasDatas,
  filtrarPorSegmento,
  resolverData,
  diasAte,
} from '../data/datasComemorativasBR.js';

// Painel "Agenda de Marketing" — calendário de datas comemorativas BR com
// sugestões automáticas de campanha. Inspirado no qrofertas (eles têm
// "Agenda de Marketing integrada").
//
// Funcionalidades:
//  - Lista as próximas 8 datas a partir de hoje
//  - Filtro por importância (alta/media/baixa) — destaca o que mais vende
//  - Filtro por segmento (mercado, doceria, etc) — relevante por nicho
//  - Visão "Ano inteiro" agrupada por mês
//  - Botão "Criar encarte" abre tab Produtos e pré-preenche fraseDeAcolhida
//    no localStorage (pega via PainelDatas)
//
// Não persiste nada — leitura pura da lista estática.

const SEGMENTOS = [
  { value: '',             label: 'Todos os segmentos' },
  { value: 'mercado',      label: 'Mercado / Supermercado' },
  { value: 'doceria',      label: 'Doceria / Padaria' },
  { value: 'bebidas',      label: 'Bebidas / Adega' },
  { value: 'restaurante',  label: 'Restaurante' },
  { value: 'cosmeticos',   label: 'Cosméticos / Beleza' },
  { value: 'moda',         label: 'Moda / Vestuário' },
  { value: 'floricultura', label: 'Floricultura' },
  { value: 'brinquedos',   label: 'Brinquedos' },
  { value: 'casa',         label: 'Casa / Bazar' },
  { value: 'papelaria',    label: 'Papelaria' },
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatarData(d) {
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

function formatarDataCompleta(d) {
  return `${formatarData(d)}/${d.getFullYear()}`;
}

function badgeImportancia(imp) {
  if (imp === 'alta') return { label: '🔥 Alta venda', cor: '#ef4444' };
  if (imp === 'media') return { label: '⭐ Boa oportunidade', cor: '#f59e0b' };
  return { label: '💡 Nicho', cor: '#6b7280' };
}

// Sugestão de quando começar a campanha baseado na importância
function quandoComecar(imp, diasFalta) {
  if (imp === 'alta' && diasFalta > 21) return { antes: 21, texto: 'Comece em 3 semanas' };
  if (imp === 'alta' && diasFalta > 14) return { antes: 14, texto: 'Começa agora (2 semanas antes)' };
  if (imp === 'alta' && diasFalta > 7) return { antes: 7, texto: '⚠️ Atrasado — comece já' };
  if (imp === 'media' && diasFalta > 10) return { antes: 10, texto: 'Comece em 10 dias' };
  if (imp === 'media' && diasFalta > 5) return { antes: 5, texto: 'Comece agora' };
  if (diasFalta > 3) return { antes: 3, texto: 'Comece em 3 dias' };
  return { antes: 0, texto: '🚀 Última hora' };
}

export default function PainelAgenda({ aoCriarEncarte, aoTrocarAba }) {
  const [segmento, setSegmento] = useState('');
  const [visao, setVisao] = useState('proximas'); // 'proximas' | 'ano'
  const [importanciaMin, setImportanciaMin] = useState('todas'); // 'todas' | 'alta' | 'media'

  const hoje = useMemo(() => {
    // Zera horas pra cálculos consistentes
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const anoAtual = hoje.getFullYear();

  // Lista de próximas datas (8) — filtradas por segmento
  const proximas = useMemo(() => {
    let lista = proximasDatas(hoje, 30);
    lista = filtrarPorSegmento(lista, segmento);
    if (importanciaMin === 'alta') lista = lista.filter(i => i.importancia === 'alta');
    else if (importanciaMin === 'media') lista = lista.filter(i => i.importancia !== 'baixa');
    return lista.slice(0, 8);
  }, [hoje, segmento, importanciaMin]);

  // Lista de TODAS as datas no ano corrente, agrupadas por mês
  const ano = useMemo(() => {
    const grupos = MESES.map((nomeMes, idx) => ({
      mes: idx + 1,
      nome: nomeMes,
      datas: [],
    }));
    let todas = DATAS_COMEMORATIVAS.map(entry => ({
      ...entry,
      dataEfetiva: resolverData(entry, anoAtual),
    }));
    todas = filtrarPorSegmento(todas, segmento);
    if (importanciaMin === 'alta') todas = todas.filter(i => i.importancia === 'alta');
    else if (importanciaMin === 'media') todas = todas.filter(i => i.importancia !== 'baixa');

    for (const item of todas) {
      grupos[item.dataEfetiva.getMonth()].datas.push(item);
    }
    // Ordena cada mês por dia
    for (const g of grupos) g.datas.sort((a, b) => a.dataEfetiva - b.dataEfetiva);
    return grupos;
  }, [anoAtual, segmento, importanciaMin]);

  const handleCriarEncarte = (item) => {
    // Notifica App.jsx pra trocar pra aba "produtos" e armazenar contexto
    // (sugestão de tema, datas pré-preenchidas, etc).
    if (aoCriarEncarte) aoCriarEncarte(item);
    if (aoTrocarAba) aoTrocarAba('produtos');
  };

  return (
    <div className="painel painel-agenda">
      <div className="pa-header">
        <div>
          <h2 className="pa-titulo">📅 Agenda de Marketing</h2>
          <p className="pa-sub">
            Calendário de datas comemorativas brasileiras com sugestões automáticas de campanha.
            Nunca mais perca uma data lucrativa.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="pa-filtros">
        <div className="pa-filtro">
          <label>Visão</label>
          <div className="pa-tabs">
            <button
              type="button"
              className={visao === 'proximas' ? 'ativo' : ''}
              onClick={() => setVisao('proximas')}
            >
              ⏰ Próximas datas
            </button>
            <button
              type="button"
              className={visao === 'ano' ? 'ativo' : ''}
              onClick={() => setVisao('ano')}
            >
              📆 Ano todo ({anoAtual})
            </button>
          </div>
        </div>

        <div className="pa-filtro">
          <label htmlFor="pa-segmento">Segmento</label>
          <select
            id="pa-segmento"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
          >
            {SEGMENTOS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="pa-filtro">
          <label htmlFor="pa-importancia">Mostrar</label>
          <select
            id="pa-importancia"
            value={importanciaMin}
            onChange={(e) => setImportanciaMin(e.target.value)}
          >
            <option value="todas">Todas as datas</option>
            <option value="media">Médias e altas</option>
            <option value="alta">🔥 Só as de alta venda</option>
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      {visao === 'proximas' ? (
        <ListaProximas
          itens={proximas}
          hoje={hoje}
          aoCriar={handleCriarEncarte}
        />
      ) : (
        <ListaAno
          grupos={ano}
          hoje={hoje}
          aoCriar={handleCriarEncarte}
        />
      )}

      <div className="pa-footer">
        <small>
          💡 Dica: comece a campanha das datas <b>alta venda</b> com pelo menos
          3 semanas de antecedência. Compre estoque, planeje promoções e divulgue
          de forma escalonada.
        </small>
      </div>
    </div>
  );
}

// === Subcomponentes ===

function CardData({ item, hoje, aoCriar }) {
  const diasFalta = diasAte(item.dataEfetiva, hoje);
  const badge = badgeImportancia(item.importancia);
  const passou = diasFalta < 0;
  const inicio = quandoComecar(item.importancia, diasFalta);

  return (
    <div className={`pa-card ${item.importancia} ${passou ? 'passou' : ''}`}>
      <div className="pa-card-icone">{item.emoji}</div>
      <div className="pa-card-corpo">
        <div className="pa-card-titulo-linha">
          <h3>{item.nome}</h3>
          <span className="pa-badge" style={{ background: badge.cor }}>{badge.label}</span>
        </div>
        <div className="pa-card-data">
          <span className="pa-card-data-num">{formatarDataCompleta(item.dataEfetiva)}</span>
          {!passou && diasFalta > 0 && (
            <span className="pa-card-data-faltam">
              {diasFalta === 1 ? 'amanhã' : `faltam ${diasFalta} dias`}
            </span>
          )}
          {diasFalta === 0 && <span className="pa-card-data-hoje">🎉 hoje!</span>}
          {passou && <span className="pa-card-data-passou">já passou</span>}
        </div>
        <p className="pa-card-sugestao">{item.sugestao}</p>
        {!passou && diasFalta >= 0 && (
          <div className="pa-card-acao">
            <span className="pa-card-inicio">⏰ {inicio.texto}</span>
            <button
              type="button"
              className="pa-card-btn"
              onClick={() => aoCriar(item)}
            >
              Criar encarte
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListaProximas({ itens, hoje, aoCriar }) {
  if (!itens.length) {
    return (
      <div className="pa-vazio">
        Nenhuma data encontrada com esses filtros. Ajuste o segmento ou a importância.
      </div>
    );
  }
  return (
    <div className="pa-lista">
      {itens.map(item => (
        <CardData key={item.id} item={item} hoje={hoje} aoCriar={aoCriar} />
      ))}
    </div>
  );
}

function ListaAno({ grupos, hoje, aoCriar }) {
  const mesAtual = hoje.getMonth();
  return (
    <div className="pa-ano">
      {grupos.map(g => {
        const ehMesAtual = g.mes === mesAtual + 1;
        if (g.datas.length === 0) return null;
        return (
          <section key={g.mes} className={`pa-mes ${ehMesAtual ? 'atual' : ''}`}>
            <h3 className="pa-mes-titulo">
              {g.nome} {ehMesAtual && <span className="pa-mes-tag">mês atual</span>}
            </h3>
            <div className="pa-lista">
              {g.datas.map(item => (
                <CardData key={item.id} item={item} hoje={hoje} aoCriar={aoCriar} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
