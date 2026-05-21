import { useState } from 'react';

// Formulário de SOLICITAÇÃO DE TEMA. O usuário descreve o tema que quer e
// envia — o backend manda um e-mail pro admin (POST /api/solicitacoes-tema).
// Funciona logado (usa email/nome da conta) ou deslogado (pede email/nome).
export default function ModalSolicitarTema({ aberto, aoFechar, user, fetchAuth }) {
  const [tipoTema, setTipoTema] = useState('');
  const [segmento, setSegmento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  if (!aberto) return null;

  const logado = !!user?.email;
  const http = fetchAuth || ((url, opts) => fetch(url, opts));

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!tipoTema.trim()) { setErro('Diz qual tema você quer.'); return; }
    if (!logado && !email.trim()) { setErro('Informe um e-mail pra contato.'); return; }
    setEnviando(true);
    try {
      const r = await http('/api/solicitacoes-tema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoTema, segmento, descricao,
          email: logado ? undefined : email.trim(),
          nome: logado ? undefined : nome.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Falha ao enviar');
      setSucesso(true);
    } catch (err) {
      setErro(err.message || 'Erro ao enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-solicitar-tema" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        {sucesso ? (
          <div className="st-sucesso">
            <div className="st-sucesso-icon">✅</div>
            <h2>Solicitação enviada!</h2>
            <p>Recebemos seu pedido. Vamos analisar e, se rolar, o tema entra na plataforma. Obrigado! 🎨</p>
            <button type="button" className="ma-btn-primary" onClick={aoFechar}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="ma-form st-form">
            <h2 style={{ margin: '0 0 4px', color: '#0a1428' }}>Solicitar um tema</h2>
            <p className="st-sub">Não achou o tema que queria? Descreve aqui que a gente recebe seu pedido.</p>

            {erro && <div className="ma-erro">⚠ {erro}</div>}

            <label>
              <span>Qual tema você quer? *</span>
              <input
                type="text" required autoFocus maxLength={200}
                value={tipoTema} onChange={e => setTipoTema(e.target.value)}
                placeholder="Ex: Dia das Crianças, Festa Junina, Açougue Premium"
              />
            </label>
            <label>
              <span>Segmento</span>
              <input
                type="text" maxLength={120}
                value={segmento} onChange={e => setSegmento(e.target.value)}
                placeholder="Ex: Mercado, Açougue, Padaria, Pizzaria"
              />
            </label>
            <label>
              <span>Detalhes (cores, estilo, ocasião…)</span>
              <textarea
                rows={4} maxLength={2000} className="st-textarea"
                value={descricao} onChange={e => setDescricao(e.target.value)}
                placeholder="Conta como você imagina o tema: cores, vibe, datas…"
              />
            </label>

            {!logado && (
              <>
                <label>
                  <span>Seu nome</span>
                  <input type="text" maxLength={160} value={nome} onChange={e => setNome(e.target.value)} placeholder="Como te chamamos" />
                </label>
                <label>
                  <span>Seu e-mail *</span>
                  <input type="email" required maxLength={160} value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                </label>
              </>
            )}

            <button type="submit" className="ma-btn-primary" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitação'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
