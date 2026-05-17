import { useEffect, useState } from 'react';

// Painel administrativo. Modal grande com 5 abas:
//   - Dashboard: stats gerais (users, MRR, inadimplentes, top planos)
//   - Usuários: tabela paginada com busca, suspensão, change plan
//   - Assinaturas: lista filtrável por status
//   - Pagamentos: histórico geral
//   - Logs: audit log paginado
//
// Visível só pra users com role admin ou super_admin.

const formatarReais = (centavos) =>
  ((centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '—';
const formatarSomenteData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export default function PainelAdmin({ aberto, aoFechar, fetchAuth, user }) {
  const [aba, setAba] = useState('dashboard');

  if (!aberto) return null;

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-admin" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        <div className="adm-sidebar">
          <div className="adm-brand">
            <div className="adm-brand-icon">⚡</div>
            <div>
              <div className="adm-brand-titulo">Painel Admin</div>
              <div className="adm-brand-user">{user?.nome || user?.email}</div>
              <div className="adm-brand-role">{user?.role_nome}</div>
            </div>
          </div>

          <button className={`adm-nav ${aba === 'dashboard' ? 'ativa' : ''}`} onClick={() => setAba('dashboard')}>
            📊 Dashboard
          </button>
          <button className={`adm-nav ${aba === 'users' ? 'ativa' : ''}`} onClick={() => setAba('users')}>
            👥 Usuários
          </button>
          <button className={`adm-nav ${aba === 'subs' ? 'ativa' : ''}`} onClick={() => setAba('subs')}>
            💳 Assinaturas
          </button>
          <button className={`adm-nav ${aba === 'payments' ? 'ativa' : ''}`} onClick={() => setAba('payments')}>
            💰 Pagamentos
          </button>
          <button className={`adm-nav ${aba === 'logs' ? 'ativa' : ''}`} onClick={() => setAba('logs')}>
            📜 Audit Logs
          </button>
        </div>

        <div className="adm-content">
          {aba === 'dashboard' && <AbaDashboard fetchAuth={fetchAuth} />}
          {aba === 'users' && <AbaUsers fetchAuth={fetchAuth} adminUser={user} />}
          {aba === 'subs' && <AbaSubscriptions fetchAuth={fetchAuth} />}
          {aba === 'payments' && <AbaPayments fetchAuth={fetchAuth} />}
          {aba === 'logs' && <AbaLogs fetchAuth={fetchAuth} />}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// === ABA: DASHBOARD ===
// ===================================================================
function AbaDashboard({ fetchAuth }) {
  const [stats, setStats] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetchAuth('/api/admin/stats')
      .then(r => r.json())
      .then(setStats)
      .finally(() => setCarregando(false));
  }, [fetchAuth]);

  if (carregando) return <div className="adm-loading">Carregando estatísticas...</div>;
  if (!stats) return <div className="adm-loading">Erro ao carregar</div>;

  return (
    <div>
      <h2 className="adm-titulo">📊 Dashboard</h2>

      <div className="adm-cards-stats">
        <div className="adm-stat-card">
          <div className="adm-stat-icon">👥</div>
          <div className="adm-stat-num">{stats.users.total}</div>
          <div className="adm-stat-label">Usuários totais</div>
          <div className="adm-stat-sub">+{stats.users.novosUlt30d} últimos 30 dias</div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon">✅</div>
          <div className="adm-stat-num">{stats.users.active}</div>
          <div className="adm-stat-label">Usuários ativos</div>
          <div className="adm-stat-sub">{stats.users.suspended} suspensos</div>
        </div>
        <div className="adm-stat-card destaque">
          <div className="adm-stat-icon">💰</div>
          <div className="adm-stat-num">{formatarReais(stats.financial.mrr_centavos)}</div>
          <div className="adm-stat-label">MRR (Receita Mensal Recorrente)</div>
          <div className="adm-stat-sub">{stats.subscriptions.active} assinaturas ativas</div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon">📈</div>
          <div className="adm-stat-num">{formatarReais(stats.financial.receita_ult30d_centavos)}</div>
          <div className="adm-stat-label">Receita últimos 30 dias</div>
        </div>
        <div className="adm-stat-card alerta">
          <div className="adm-stat-icon">⚠</div>
          <div className="adm-stat-num">{stats.subscriptions.inadimplentes}</div>
          <div className="adm-stat-label">Inadimplentes</div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon">📦</div>
          <div className="adm-stat-num">{stats.subscriptions.expired}</div>
          <div className="adm-stat-label">Assinaturas inativas</div>
        </div>
      </div>

      <h3 className="adm-subtitulo">Distribuição por plano</h3>
      <table className="adm-tabela">
        <thead>
          <tr><th>Plano</th><th>Slug</th><th>Assinantes</th></tr>
        </thead>
        <tbody>
          {stats.planos_top.map(p => (
            <tr key={p.slug}>
              <td><b>{p.nome}</b></td>
              <td><code>{p.slug}</code></td>
              <td>{p.assinantes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===================================================================
// === ABA: USUÁRIOS ===
// ===================================================================
function AbaUsers({ fetchAuth, adminUser }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [userDetalhe, setUserDetalhe] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (busca) params.set('q', busca);
    if (filtroAtivo) params.set('ativo', filtroAtivo);
    if (filtroRole) params.set('role', filtroRole);
    const r = await fetchAuth('/api/admin/users?' + params);
    const data = await r.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

  const suspender = async (id, nome) => {
    const motivo = prompt(`Motivo da suspensão de "${nome}"?`, 'Pagamento atrasado');
    if (motivo === null) return;
    const r = await fetchAuth(`/api/admin/users/${id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    });
    if (r.ok) carregar();
    else alert('Erro: ' + (await r.json()).error);
  };

  const reativar = async (id) => {
    const r = await fetchAuth(`/api/admin/users/${id}/reactivate`, { method: 'POST' });
    if (r.ok) carregar();
    else alert('Erro: ' + (await r.json()).error);
  };

  return (
    <div>
      <h2 className="adm-titulo">👥 Usuários <span className="adm-count">({total})</span></h2>

      <div className="adm-filtros">
        <input
          className="adm-busca"
          placeholder="🔍 Buscar por nome, email, empresa ou CPF/CNPJ..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && carregar()}
        />
        <select value={filtroAtivo} onChange={e => { setFiltroAtivo(e.target.value); setTimeout(carregar, 0); }}>
          <option value="">Todos status</option>
          <option value="1">Ativos</option>
          <option value="0">Suspensos</option>
        </select>
        <select value={filtroRole} onChange={e => { setFiltroRole(e.target.value); setTimeout(carregar, 0); }}>
          <option value="">Todas roles</option>
          <option value="cliente">Cliente</option>
          <option value="moderador">Moderador</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <button className="adm-btn-filtro" onClick={carregar}>Filtrar</button>
      </div>

      {carregando ? (
        <div className="adm-loading">Carregando...</div>
      ) : (
        <table className="adm-tabela adm-tabela-compacta">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome / Empresa</th>
              <th>Email</th>
              <th>Role</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Criado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan="8" className="adm-vazio">Nenhum usuário encontrado</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className={u.ativo ? '' : 'suspenso'}>
                <td>#{u.id}</td>
                <td>
                  <div><b>{u.nome}</b></div>
                  {u.empresa && <small>{u.empresa}</small>}
                </td>
                <td>{u.email}</td>
                <td><span className={`adm-role adm-role-${u.role_nome}`}>{u.role_nome}</span></td>
                <td>{u.plan_slug ? <code>{u.plan_slug}</code> : <small>—</small>}</td>
                <td>
                  {u.ativo ? (
                    <span className="adm-status-ok">● Ativo</span>
                  ) : (
                    <span className="adm-status-suspenso" title={u.motivo_suspensao}>● Suspenso</span>
                  )}
                </td>
                <td><small>{formatarSomenteData(u.criado_em)}</small></td>
                <td className="adm-acoes">
                  <button onClick={() => setUserDetalhe(u.id)} title="Ver detalhes">👁</button>
                  {u.ativo ? (
                    <button onClick={() => suspender(u.id, u.nome)} title="Suspender" disabled={u.id === adminUser?.id}>🚫</button>
                  ) : (
                    <button onClick={() => reativar(u.id)} title="Reativar">✓</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {userDetalhe && (
        <ModalUserDetalhe
          id={userDetalhe}
          fetchAuth={fetchAuth}
          aoFechar={() => setUserDetalhe(null)}
          aoRecarregar={carregar}
        />
      )}
    </div>
  );
}

// === Modal de detalhe de user (dentro do admin) ===
function ModalUserDetalhe({ id, fetchAuth, aoFechar, aoRecarregar }) {
  const [dados, setDados] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [planoEscolhido, setPlanoEscolhido] = useState('');
  const [dias, setDias] = useState(30);

  useEffect(() => {
    fetchAuth(`/api/admin/users/${id}`).then(r => r.json()).then(setDados);
    fetchAuth('/api/admin/plans').then(r => r.json()).then(d => setPlanos(d.plans || []));
  }, [id, fetchAuth]);

  const trocarPlano = async () => {
    if (!planoEscolhido) return;
    const r = await fetchAuth(`/api/admin/users/${id}/change-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: parseInt(planoEscolhido), diasValidade: dias, status: 'ativo' }),
    });
    if (r.ok) {
      alert('Plano alterado!');
      fetchAuth(`/api/admin/users/${id}`).then(r => r.json()).then(setDados);
      aoRecarregar?.();
    } else {
      alert('Erro: ' + (await r.json()).error);
    }
  };

  if (!dados) return null;

  return (
    <div className="modal-overlay" onClick={aoFechar} style={{ zIndex: 200 }}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>
        <h2 style={{ marginTop: 0 }}>{dados.user.nome}</h2>
        <p style={{ color: '#6b7280', marginTop: -8 }}>
          {dados.user.email} · #{dados.user.id} · {dados.user.role_nome}
        </p>

        <h3 style={{ marginTop: 24 }}>Forçar mudança de plano</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={planoEscolhido} onChange={e => setPlanoEscolhido(e.target.value)} style={{ flex: 1, padding: 8 }}>
            <option value="">— Selecione um plano —</option>
            {planos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.slug}) — {formatarReais(p.preco_mensal_centavos)}/mês
              </option>
            ))}
          </select>
          <input
            type="number" value={dias} onChange={e => setDias(parseInt(e.target.value) || 30)}
            style={{ width: 80, padding: 8 }} title="Dias de validade"
          />
          <button className="mp-btn-primary" onClick={trocarPlano}>Aplicar</button>
        </div>

        <h3 style={{ marginTop: 24 }}>Assinaturas ({dados.subscriptions.length})</h3>
        <table className="adm-tabela adm-tabela-compacta">
          <thead><tr><th>ID</th><th>Plano</th><th>Status</th><th>Ciclo</th><th>Início</th><th>Vencimento</th></tr></thead>
          <tbody>
            {dados.subscriptions.map(s => (
              <tr key={s.id}>
                <td>#{s.id}</td><td>{s.plan_nome}</td><td>{s.status}</td>
                <td>{s.ciclo}</td><td>{formatarSomenteData(s.inicio)}</td>
                <td>{formatarSomenteData(s.vencimento)}</td>
              </tr>
            ))}
            {dados.subscriptions.length === 0 && <tr><td colSpan="6" className="adm-vazio">Sem assinaturas</td></tr>}
          </tbody>
        </table>

        <h3 style={{ marginTop: 24 }}>Pagamentos ({dados.payments.length})</h3>
        <table className="adm-tabela adm-tabela-compacta">
          <thead><tr><th>Data</th><th>Valor</th><th>Status</th><th>Gateway</th></tr></thead>
          <tbody>
            {dados.payments.map(p => (
              <tr key={p.id}>
                <td>{formatarData(p.criado_em)}</td>
                <td>{formatarReais(p.valor_centavos)}</td>
                <td>{p.status}</td><td>{p.gateway}</td>
              </tr>
            ))}
            {dados.payments.length === 0 && <tr><td colSpan="4" className="adm-vazio">Sem pagamentos</td></tr>}
          </tbody>
        </table>

        <h3 style={{ marginTop: 24 }}>Últimas ações ({dados.auditLogs.length})</h3>
        <table className="adm-tabela adm-tabela-compacta">
          <thead><tr><th>Data</th><th>Ação</th><th>IP</th></tr></thead>
          <tbody>
            {dados.auditLogs.map(l => (
              <tr key={l.id}>
                <td><small>{formatarData(l.criado_em)}</small></td>
                <td><code>{l.acao}</code></td>
                <td><small>{l.ip || '—'}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================================================================
// === ABA: ASSINATURAS ===
// ===================================================================
function AbaSubscriptions({ fetchAuth }) {
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filtro) params.set('status', filtro);
    fetchAuth('/api/admin/subscriptions?' + params)
      .then(r => r.json())
      .then(d => { setSubs(d.subscriptions || []); setTotal(d.total || 0); });
  }, [fetchAuth, filtro]);

  return (
    <div>
      <h2 className="adm-titulo">💳 Assinaturas <span className="adm-count">({total})</span></h2>
      <div className="adm-filtros">
        <select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todas</option>
          <option value="ativo">Ativas</option>
          <option value="trial">Trial</option>
          <option value="pendente">Pendentes</option>
          <option value="cancelado">Canceladas</option>
          <option value="expirado">Expiradas</option>
          <option value="suspenso">Suspensas</option>
        </select>
      </div>
      <table className="adm-tabela adm-tabela-compacta">
        <thead>
          <tr><th>ID</th><th>Usuário</th><th>Plano</th><th>Status</th><th>Ciclo</th><th>Vencimento</th><th>Valor</th></tr>
        </thead>
        <tbody>
          {subs.length === 0 && <tr><td colSpan="7" className="adm-vazio">Nenhuma assinatura</td></tr>}
          {subs.map(s => (
            <tr key={s.id}>
              <td>#{s.id}</td>
              <td>{s.user_nome}<br /><small>{s.email}</small></td>
              <td><b>{s.plan_nome}</b><br /><small>{s.plan_slug}</small></td>
              <td><span className={`adm-status-${s.status}`}>{s.status}</span></td>
              <td>{s.ciclo}</td>
              <td>{formatarSomenteData(s.vencimento)}</td>
              <td>{formatarReais(s.preco_mensal_centavos)}/mês</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===================================================================
// === ABA: PAGAMENTOS ===
// ===================================================================
function AbaPayments({ fetchAuth }) {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPago, setTotalPago] = useState(0);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filtro) params.set('status', filtro);
    fetchAuth('/api/admin/payments?' + params)
      .then(r => r.json())
      .then(d => {
        setPayments(d.payments || []);
        setTotal(d.total || 0);
        setTotalPago(d.totalCentsPagos || 0);
      });
  }, [fetchAuth, filtro]);

  return (
    <div>
      <h2 className="adm-titulo">💰 Pagamentos <span className="adm-count">({total})</span></h2>
      <p className="adm-resumo">
        Total pago (com filtros): <b>{formatarReais(totalPago)}</b>
      </p>
      <div className="adm-filtros">
        <select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todos</option>
          <option value="pago">Pagos</option>
          <option value="pendente">Pendentes</option>
          <option value="falhou">Falhados</option>
          <option value="reembolsado">Reembolsados</option>
        </select>
      </div>
      <table className="adm-tabela adm-tabela-compacta">
        <thead>
          <tr><th>ID</th><th>Usuário</th><th>Valor</th><th>Método</th><th>Gateway</th><th>Status</th><th>Data</th></tr>
        </thead>
        <tbody>
          {payments.length === 0 && <tr><td colSpan="7" className="adm-vazio">Nenhum pagamento</td></tr>}
          {payments.map(p => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{p.user_nome}<br /><small>{p.email}</small></td>
              <td><b>{formatarReais(p.valor_centavos)}</b></td>
              <td>{p.metodo}</td>
              <td>{p.gateway}</td>
              <td><span className={`adm-status-${p.status}`}>{p.status}</span></td>
              <td><small>{formatarData(p.pago_em || p.criado_em)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===================================================================
// === ABA: AUDIT LOGS ===
// ===================================================================
function AbaLogs({ fetchAuth }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAuth('/api/admin/audit-logs')
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setTotal(d.total || 0); });
  }, [fetchAuth]);

  return (
    <div>
      <h2 className="adm-titulo">📜 Audit Logs <span className="adm-count">({total})</span></h2>
      <p className="adm-resumo">Histórico de TODAS as ações sensíveis do sistema.</p>
      <table className="adm-tabela adm-tabela-compacta">
        <thead>
          <tr><th>Data</th><th>Ação</th><th>User</th><th>Actor</th><th>Recurso</th><th>IP</th></tr>
        </thead>
        <tbody>
          {logs.length === 0 && <tr><td colSpan="6" className="adm-vazio">Nenhum log</td></tr>}
          {logs.map(l => (
            <tr key={l.id}>
              <td><small>{formatarData(l.criado_em)}</small></td>
              <td><code>{l.acao}</code></td>
              <td><small>{l.user_email || '—'}</small></td>
              <td><small>{l.actor_email || '—'}</small></td>
              <td><small>{l.recurso || '—'}</small></td>
              <td><small>{l.ip || '—'}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
