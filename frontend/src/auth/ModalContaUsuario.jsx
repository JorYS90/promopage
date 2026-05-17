import { useState, useEffect } from 'react';

// Modal de conta do usuário logado. 3 abas internas:
//   - perfil       — editar nome, empresa, telefone, doc, trocar senha
//   - assinatura   — plano atual, status, vencimento, upgrade
//   - pagamentos   — histórico
//
// Recebe a aba inicial via prop `abaInicial`.

export default function ModalContaUsuario({
  aberto, abaInicial = 'perfil', aoFechar, user, fetchAuth, aoAtualizarUser,
}) {
  const [aba, setAba] = useState(abaInicial);

  useEffect(() => { if (aberto) setAba(abaInicial); }, [aberto, abaInicial]);

  if (!aberto) return null;

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-conta" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        <div className="mc-tabs">
          <button
            className={`mc-tab ${aba === 'perfil' ? 'ativo' : ''}`}
            onClick={() => setAba('perfil')}
          >
            👤 Meu Perfil
          </button>
          <button
            className={`mc-tab ${aba === 'assinatura' ? 'ativo' : ''}`}
            onClick={() => setAba('assinatura')}
          >
            💳 Minha Assinatura
          </button>
          <button
            className={`mc-tab ${aba === 'pagamentos' ? 'ativo' : ''}`}
            onClick={() => setAba('pagamentos')}
          >
            📊 Histórico
          </button>
        </div>

        <div className="mc-content">
          {aba === 'perfil' && (
            <AbaPerfil user={user} fetchAuth={fetchAuth} aoAtualizarUser={aoAtualizarUser} />
          )}
          {aba === 'assinatura' && (
            <AbaAssinatura fetchAuth={fetchAuth} />
          )}
          {aba === 'pagamentos' && (
            <AbaPagamentos fetchAuth={fetchAuth} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// === ABA: PERFIL ===
// ============================================================
function AbaPerfil({ user, fetchAuth, aoAtualizarUser }) {
  const [form, setForm] = useState({
    nome: user?.nome || '',
    empresa: user?.empresa || '',
    telefone: user?.telefone || '',
    documento: user?.documento || '',
  });
  const [senhas, setSenhas] = useState({ atual: '', nova: '' });
  const [salvando, setSalvando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [msg, setMsg] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    setForm({
      nome: user?.nome || '',
      empresa: user?.empresa || '',
      telefone: user?.telefone || '',
      documento: user?.documento || '',
    });
  }, [user]);

  const salvarPerfil = async (e) => {
    e.preventDefault();
    setSalvando(true); setMsg({ tipo: '', texto: '' });
    try {
      const r = await fetchAuth('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro');
      aoAtualizarUser?.(data.user);
      setMsg({ tipo: 'sucesso', texto: 'Perfil atualizado!' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally { setSalvando(false); }
  };

  const trocarSenha = async (e) => {
    e.preventDefault();
    setTrocandoSenha(true); setMsg({ tipo: '', texto: '' });
    try {
      if (senhas.nova.length < 8) throw new Error('Nova senha precisa ter pelo menos 8 caracteres');
      const r = await fetchAuth('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual: senhas.atual, novaSenha: senhas.nova }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro');
      setSenhas({ atual: '', nova: '' });
      setMsg({ tipo: 'sucesso', texto: data.message || 'Senha alterada!' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally { setTrocandoSenha(false); }
  };

  return (
    <div className="mc-aba">
      <h3 className="mc-aba-titulo">Dados pessoais</h3>
      <p className="mc-aba-sub">Mantenha seus dados atualizados pra emissão de notas fiscais e comunicação.</p>

      {msg.texto && (
        <div className={`mc-msg ${msg.tipo === 'erro' ? 'erro' : 'sucesso'}`}>
          {msg.tipo === 'erro' ? '⚠' : '✓'} {msg.texto}
        </div>
      )}

      <form onSubmit={salvarPerfil} className="mc-form">
        <div className="mc-row">
          <label>
            <span>Email <small>(não editável)</small></span>
            <input type="email" value={user?.email || ''} disabled />
          </label>
          <label>
            <span>Role</span>
            <input type="text" value={user?.role_nome || 'cliente'} disabled />
          </label>
        </div>
        <label>
          <span>Nome completo *</span>
          <input type="text" required maxLength={120}
            value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
        </label>
        <label>
          <span>Empresa</span>
          <input type="text" maxLength={120}
            value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} />
        </label>
        <div className="mc-row">
          <label>
            <span>Telefone</span>
            <input type="tel" maxLength={30} placeholder="(11) 99999-9999"
              value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
          </label>
          <label>
            <span>CPF / CNPJ</span>
            <input type="text" maxLength={20}
              value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} />
          </label>
        </div>
        <button type="submit" className="mc-btn-primary" disabled={salvando}>
          {salvando ? 'Salvando...' : '💾 Salvar perfil'}
        </button>
      </form>

      <hr className="mc-sep" />

      <h3 className="mc-aba-titulo">Trocar senha</h3>
      <p className="mc-aba-sub">Use uma senha forte. Trocar a senha encerra suas outras sessões.</p>
      <form onSubmit={trocarSenha} className="mc-form">
        <label>
          <span>Senha atual</span>
          <input type="password" required
            value={senhas.atual} onChange={e => setSenhas(p => ({ ...p, atual: e.target.value }))} />
        </label>
        <label>
          <span>Nova senha <small>(mín. 8 caracteres)</small></span>
          <input type="password" required minLength={8}
            value={senhas.nova} onChange={e => setSenhas(p => ({ ...p, nova: e.target.value }))} />
        </label>
        <button type="submit" className="mc-btn-secondary" disabled={trocandoSenha}>
          {trocandoSenha ? 'Trocando...' : '🔐 Trocar senha'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// === ABA: ASSINATURA ===
// ============================================================
function AbaAssinatura({ fetchAuth }) {
  const [sub, setSub] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [rSub, rPlanos] = await Promise.all([
          fetchAuth('/api/users/me/subscription'),
          fetch('/api/plans'),
        ]);
        const subData = await rSub.json();
        const planosData = await rPlanos.json();
        if (cancelado) return;
        setSub(subData.subscription);
        setPlanos(planosData.plans || []);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [fetchAuth]);

  const formatarReais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatarData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

  if (carregando) return <div className="mc-aba"><div className="mc-vazio">Carregando...</div></div>;

  return (
    <div className="mc-aba">
      <h3 className="mc-aba-titulo">Minha assinatura</h3>

      {sub ? (
        <div className="mc-card-assinatura">
          <div className="mc-card-header">
            <div>
              <div className="mc-card-plan-nome">{sub.plan_nome}</div>
              <div className="mc-card-plan-status">
                {sub.status === 'ativo' ? <span className="status-ativo">● ATIVA</span> :
                 sub.status === 'trial' ? <span className="status-trial">● TRIAL</span> :
                 sub.status === 'pendente' ? <span className="status-pendente">● PENDENTE</span> :
                 <span className="status-expirada">● {sub.status?.toUpperCase()}</span>}
              </div>
            </div>
            <div className="mc-card-valor">
              {formatarReais(sub.ciclo === 'anual' ? sub.preco_anual_centavos : sub.preco_mensal_centavos)}
              <small>/{sub.ciclo === 'anual' ? 'ano' : 'mês'}</small>
            </div>
          </div>
          <div className="mc-card-info">
            <div><b>Próximo vencimento:</b> {formatarData(sub.vencimento)} ({sub.diasRestantes} dia{sub.diasRestantes !== 1 ? 's' : ''})</div>
            <div><b>Início da assinatura:</b> {formatarData(sub.inicio)}</div>
          </div>
        </div>
      ) : (
        <div className="mc-sem-assinatura">
          <div className="mc-sem-icon">🆓</div>
          <h4>Você não tem assinatura ativa</h4>
          <p>Escolha um plano abaixo pra liberar todos os recursos do PromoPage.</p>
        </div>
      )}

      <h3 className="mc-aba-titulo" style={{ marginTop: 24 }}>Planos disponíveis</h3>
      <div className="mc-planos-grid">
        {planos.map(p => {
          const ativo = sub?.plan_slug === p.slug;
          return (
            <div key={p.id} className={`mc-plano ${ativo ? 'ativo' : ''} ${p.slug === 'pro' ? 'destaque' : ''}`}>
              {p.slug === 'pro' && <div className="mc-plano-badge">⭐ MAIS POPULAR</div>}
              {ativo && <div className="mc-plano-badge ativo">✓ SEU PLANO</div>}
              <h4 className="mc-plano-nome">{p.nome}</h4>
              <div className="mc-plano-preco">
                {formatarReais(p.preco_mensal_centavos)}<small>/mês</small>
              </div>
              <div className="mc-plano-anual">
                ou {formatarReais(p.preco_anual_centavos)}/ano
                <span className="mc-plano-desconto">
                  (-{Math.round((1 - p.preco_anual_centavos / (p.preco_mensal_centavos * 12)) * 100)}%)
                </span>
              </div>
              <div className="mc-plano-desc">{p.descricao}</div>
              <ul className="mc-plano-recursos">
                {(p.recursos || []).map(r => (
                  <li key={r}>✓ {nomesRecursos[r] || r}</li>
                ))}
              </ul>
              <div className="mc-plano-limites">
                <div><b>Encartes/mês:</b> {p.limites?.encartesPorMes === -1 ? 'Ilimitado' : p.limites?.encartesPorMes}</div>
                <div><b>Templates próprios:</b> {p.limites?.templatesProprios === -1 ? 'Ilimitado' : p.limites?.templatesProprios}</div>
              </div>
              {!ativo && (
                <button
                  className="mc-btn-primary mc-plano-btn"
                  onClick={() => alert('Pagamento via Stripe — em breve! (Fase 2)')}
                >
                  Assinar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nomesRecursos = {
  pdf_export: 'Exportar PDF',
  png_export: 'Exportar PNG',
  temas_gratis: 'Temas grátis',
  temas_premium: 'Temas premium',
  remover_fundo: 'Remover fundo das fotos (IA)',
  busca_avancada: 'Busca avançada de imagens',
  whatsapp_post: 'Postar no WhatsApp',
  multi_loja: 'Múltiplas lojas',
  api_access: 'Acesso à API',
};

// ============================================================
// === ABA: PAGAMENTOS ===
// ============================================================
function AbaPagamentos({ fetchAuth }) {
  const [pagamentos, setPagamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetchAuth('/api/users/me/payments');
        const data = await r.json();
        if (!cancelado) setPagamentos(data.payments || []);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [fetchAuth]);

  const formatarReais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatarData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '—';

  if (carregando) return <div className="mc-aba"><div className="mc-vazio">Carregando...</div></div>;

  return (
    <div className="mc-aba">
      <h3 className="mc-aba-titulo">Histórico de pagamentos</h3>
      <p className="mc-aba-sub">Todas as suas faturas e cobranças. Clique pra ver detalhes ou baixar.</p>

      {pagamentos.length === 0 ? (
        <div className="mc-vazio">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div>Nenhum pagamento registrado ainda.</div>
          <small style={{ color: '#9ca3af', marginTop: 4 }}>
            Quando você assinar um plano, suas faturas aparecerão aqui.
          </small>
        </div>
      ) : (
        <table className="mc-tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor</th>
              <th>Método</th>
              <th>Gateway</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pagamentos.map(p => (
              <tr key={p.id}>
                <td>{formatarData(p.pago_em || p.criado_em)}</td>
                <td>{formatarReais(p.valor_centavos)}</td>
                <td>{p.metodo}</td>
                <td>{p.gateway}</td>
                <td>
                  <span className={`mc-status mc-status-${p.status}`}>
                    {p.status === 'pago' ? '✓ Pago' :
                     p.status === 'pendente' ? '⏳ Pendente' :
                     p.status === 'falhou' ? '✗ Falhou' :
                     p.status === 'reembolsado' ? '↩ Reembolsado' : p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
