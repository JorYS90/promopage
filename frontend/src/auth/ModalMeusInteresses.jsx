import { useEffect, useState } from 'react';
import LogoPromoPage from '../components/LogoPromoPage.jsx';

// Modal "Meus Interesses" — usuário marca os segmentos da empresa dele.
// Os interesses são usados pra:
//   1. Recomendar temas (que combinam com categoria do segmento)
//   2. Filtros e ordenação na vitrine de temas
//   3. Analytics agregado (admin)
//
// Pode ser aberto de 2 lugares:
//   - Link "Meus Interesses" no header de Temas (usuário logado)
//   - Step opcional pós-cadastro (incentiva o usuário a marcar antes de usar)

// Lista de segmentos disponíveis (mesma do mercado SaaS de encartes)
const SEGMENTOS = [
  { id: 'todos',            nome: 'Todos os segmentos',        especial: true },
  { id: 'eventos',          nome: 'Eventos Regionais' },
  { id: 'supermercado',     nome: 'Supermercado' },
  { id: 'acougue',          nome: 'Açougue' },
  { id: 'hortifruti',       nome: 'Hortifrúti' },
  { id: 'farmacia',         nome: 'Farmácia' },
  { id: 'construcao',       nome: 'Material para Construção' },
  { id: 'bebidas',          nome: 'Distribuidora de Bebidas' },
  { id: 'autopecas',        nome: 'Autopeças' },
  { id: 'fastfood',         nome: 'Fast Food' },
  { id: 'academia',         nome: 'Academia' },
  { id: 'barbearia',        nome: 'Barbearia' },
  { id: 'escola',           nome: 'Escola' },
  { id: 'imobiliaria',      nome: 'Imobiliária' },
  { id: 'livraria',         nome: 'Livraria' },
  { id: 'sorvetes',         nome: 'Sorvetes' },
  { id: 'cosmeticos',       nome: 'Cosméticos' },
  { id: 'cimed',            nome: 'CIMED' },
  { id: 'esportivos',       nome: 'Artigos Esportivos' },
  { id: 'concessionaria-carros', nome: 'Concessionaria de Carros' },
  { id: 'concessionaria-motos',  nome: 'Concessionaria de Motos' },
  { id: 'baterias',         nome: 'Baterias Elétricas' },
  { id: 'moveis',           nome: 'Móveis e Eletro' },
  { id: 'motopecas',        nome: 'Moto Peças' },
  { id: 'bebes',            nome: 'Bebês' },
  { id: 'pisos',            nome: 'Pisos e Revestimentos' },
  { id: 'tintas',           nome: 'Tintas e Ferramentas' },
  { id: 'ferragens',        nome: 'Ferragens' },
  { id: 'tubos',            nome: 'Tubos e Conexões' },
  { id: 'maquinas',         nome: 'Maquinas e Ferramentas' },
  { id: 'calcados',         nome: 'Calçados' },
  { id: 'roupas',           nome: 'Roupas e Acessórios' },
  { id: 'oticas',           nome: 'Óticas' },
  { id: 'informatica',      nome: 'Informática' },
  { id: 'vinhos',           nome: 'Vinhos' },
  { id: 'comida-japonesa',  nome: 'Comida Japonesa' },
  { id: 'restaurante',      nome: 'Restaurante' },
  { id: 'hamburgueria',     nome: 'Hamburgueria' },
  { id: 'salgadaria',       nome: 'Salgadaria' },
  { id: 'agua-gas',         nome: 'Água e Gás' },
  { id: 'brinquedos',       nome: 'Brinquedos' },
  { id: 'floricultura',     nome: 'Floricultura e Jardim' },
  { id: 'frios',            nome: 'Frios e Laticínios' },
  { id: 'padaria',          nome: 'Padaria' },
  { id: 'papelaria',        nome: 'Papelaria' },
  { id: 'naturais',         nome: 'Produtos Naturais' },
  { id: 'piscina',          nome: 'Produtos para Piscina' },
  { id: 'agropecuaria',     nome: 'Agropecuária' },
  { id: 'petshop',          nome: 'Pet Shop' },
  { id: 'utilidades',       nome: 'Utilidades Domésticas' },
  { id: 'suplementos',      nome: 'Suplementos Alimentares' },
  { id: 'eletricos',        nome: 'Materiais Elétricos' },
];

export default function ModalMeusInteresses({
  aberto,
  aoFechar,
  fetchAuth,
  modoSignup = false,    // se true: estilo diferente (welcome)
  aoSalvar,              // callback opcional após salvar
}) {
  const [selecionados, setSelecionados] = useState(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Carrega interesses atuais do servidor ao abrir
  useEffect(() => {
    if (!aberto || !fetchAuth) return;
    setCarregando(true);
    fetchAuth('/api/users/me/interesses')
      .then(r => r.ok ? r.json() : { interesses: [] })
      .then(d => setSelecionados(new Set(d.interesses || [])))
      .catch(() => setSelecionados(new Set()))
      .finally(() => setCarregando(false));
  }, [aberto, fetchAuth]);

  const toggle = (id) => {
    setSelecionados(prev => {
      const novo = new Set(prev);
      // Lógica especial: clicar em "todos" seleciona ou limpa todos
      if (id === 'todos') {
        if (novo.has('todos')) {
          return new Set();
        }
        return new Set(SEGMENTOS.map(s => s.id));
      }
      if (novo.has(id)) {
        novo.delete(id);
        novo.delete('todos');
      } else {
        novo.add(id);
        // Se selecionou todos os não-todos, marca "todos" também
        const semTodos = SEGMENTOS.filter(s => s.id !== 'todos').map(s => s.id);
        if (semTodos.every(sId => novo.has(sId))) novo.add('todos');
      }
      return novo;
    });
  };

  const salvar = async () => {
    if (!fetchAuth) return;
    setSalvando(true);
    try {
      const lista = Array.from(selecionados);
      const r = await fetchAuth('/api/users/me/interesses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interesses: lista }),
      });
      if (!r.ok) throw new Error('Falha ao salvar');
      aoSalvar?.(lista);
      aoFechar();
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const pular = () => {
    aoSalvar?.([]);
    aoFechar();
  };

  if (!aberto) return null;

  const qtdSelecionados = selecionados.size - (selecionados.has('todos') ? 1 : 0);

  return (
    <div className="modal-overlay" onClick={modoSignup ? undefined : aoFechar}>
      <div className="modal modal-interesses" onClick={e => e.stopPropagation()}>
        {!modoSignup && (
          <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>
        )}

        <div className="mi-header">
          <div>
            <h2 className="mi-titulo">
              {modoSignup
                ? <>Bem-vindo ao PromoPage! 🎉</>
                : <>Selecione <b>tudo</b> que for do seu interesse.</>}
            </h2>
            <p className="mi-sub">
              {modoSignup
                ? <>Antes de começar, conta pra gente: quais segmentos sua empresa atua? Vamos recomendar os melhores temas pra você.</>
                : <>Quanto mais segmentos você selecionar, mais precisas serão as recomendações de temas para sua conta.</>}
            </p>
          </div>
          {!modoSignup && (
            <div className="mi-logo">
              <LogoPromoPage size={48} />
            </div>
          )}
        </div>

        <div className="mi-instruction">
          Selecione todos os <span className="mi-tag">segmentos</span>,{' '}
          <span className="mi-tag">categorias</span> ou{' '}
          <span className="mi-tag">linha de produtos</span> da sua empresa:
        </div>

        {carregando ? (
          <div className="mi-vazio">Carregando...</div>
        ) : (
          <div className="mi-grid">
            {SEGMENTOS.map(s => {
              const ativo = selecionados.has(s.id);
              return (
                <label key={s.id} className={`mi-segmento ${ativo ? 'ativo' : ''} ${s.especial ? 'especial' : ''}`}>
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="mi-check">
                    {ativo && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  <span className="mi-nome">{s.nome}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className="mi-footer">
          <div className="mi-contador">
            <b>{qtdSelecionados}</b> segmento{qtdSelecionados !== 1 ? 's' : ''} selecionado{qtdSelecionados !== 1 ? 's' : ''}
          </div>
          <div className="mi-acoes">
            {modoSignup && (
              <button className="mi-btn-pular" onClick={pular} disabled={salvando}>
                Pular por enquanto
              </button>
            )}
            <button
              className="mi-btn-salvar"
              onClick={salvar}
              disabled={salvando || carregando}
            >
              {salvando ? 'Salvando...' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
