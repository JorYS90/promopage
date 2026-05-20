import { useState, useEffect } from 'react';
import {
  mascararTelefone, mascararDocumento,
  validarTelefone, validarDocumento,
} from './documento.js';

// Modal de autenticação. 3 modos alternáveis via tab interno:
//   - login: email + senha
//   - signup: nome + email + senha + empresa + telefone + CPF/CNPJ (obrigatórios)
//   - forgot: email (envia token de reset)
//   - reset: token + nova senha (após receber email)

export default function ModalAuth({
  aberto, modoInicial = 'login', aoFechar,
  signup, login, esqueciSenha, resetarSenha,
}) {
  const [modo, setModo] = useState(modoInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Form state — um único objeto pra todos os modos
  const [form, setForm] = useState({
    email: '', senha: '', nome: '', empresa: '', telefone: '', documento: '',
    novaSenha: '', token: '',
  });

  // Resetar form/mensagens ao trocar de modo ou abrir/fechar
  useEffect(() => {
    setModo(modoInicial);
    setErro(''); setSucesso('');
  }, [aberto, modoInicial]);

  const atualizar = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const trocarModo = (novo) => {
    setModo(novo); setErro(''); setSucesso('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      await login({ email: form.email.trim(), senha: form.senha });
      aoFechar();
    } catch (err) {
      setErro(err.message || 'Erro ao entrar');
    } finally { setCarregando(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      if (form.senha.length < 8) throw new Error('Senha precisa ter pelo menos 8 caracteres');
      if (!validarTelefone(form.telefone)) throw new Error('Informe um telefone válido com DDD, ex: (11) 99999-9999');
      if (!validarDocumento(form.documento)) throw new Error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido');
      await signup({
        email: form.email.trim(),
        senha: form.senha,
        nome: form.nome.trim(),
        empresa: form.empresa.trim() || null,
        telefone: form.telefone.trim(),
        documento: form.documento.trim(),
      });
      aoFechar();
    } catch (err) {
      setErro(err.message || 'Erro ao cadastrar');
    } finally { setCarregando(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setErro(''); setSucesso(''); setCarregando(true);
    try {
      const data = await esqueciSenha(form.email.trim());
      let msg = 'Se o email existir, você receberá um link de recuperação em alguns minutos.';
      if (data._dev_token) {
        msg = `[MODO DEV] Token gerado: ${data._dev_token}\n\nCopie e cole na próxima tela.`;
        // Já preenche o token e troca pra tela de reset
        atualizar('token', data._dev_token);
        setSucesso(msg);
        setTimeout(() => trocarModo('reset'), 100);
        return;
      }
      setSucesso(msg);
    } catch (err) {
      setErro(err.message || 'Erro');
    } finally { setCarregando(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setErro(''); setSucesso(''); setCarregando(true);
    try {
      if (form.novaSenha.length < 8) throw new Error('Senha precisa ter pelo menos 8 caracteres');
      await resetarSenha({ token: form.token.trim(), novaSenha: form.novaSenha });
      setSucesso('Senha alterada! Faça login com a nova senha.');
      setTimeout(() => trocarModo('login'), 1500);
    } catch (err) {
      setErro(err.message || 'Erro');
    } finally { setCarregando(false); }
  };

  if (!aberto) return null;

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal modal-auth" onClick={e => e.stopPropagation()}>
        <button className="btn-fechar-x" onClick={aoFechar} aria-label="Fechar">✕</button>

        <div className="ma-header">
          <div className="ma-logo">🎯</div>
          <h2 className="ma-titulo">
            {modo === 'login' && 'Entrar no PromoPage'}
            {modo === 'signup' && 'Criar sua conta'}
            {modo === 'forgot' && 'Recuperar senha'}
            {modo === 'reset' && 'Definir nova senha'}
          </h2>
          <p className="ma-subtitulo">
            {modo === 'login' && 'Acesse sua conta pra criar e gerenciar campanhas.'}
            {modo === 'signup' && 'Comece grátis. Sem cartão de crédito agora.'}
            {modo === 'forgot' && 'Digite seu email e enviaremos um link de recuperação.'}
            {modo === 'reset' && 'Use o token recebido por email pra criar uma senha nova.'}
          </p>
        </div>

        {erro && <div className="ma-erro">⚠ {erro}</div>}
        {sucesso && <div className="ma-sucesso">✓ {sucesso}</div>}

        {/* === LOGIN === */}
        {modo === 'login' && (
          <form onSubmit={handleLogin} className="ma-form">
            <label>
              <span>Email</span>
              <input type="email" required autoFocus
                value={form.email} onChange={e => atualizar('email', e.target.value)}
                placeholder="seu@email.com" />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" required
                value={form.senha} onChange={e => atualizar('senha', e.target.value)}
                placeholder="••••••••" />
            </label>
            <button type="submit" className="ma-btn-primary" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
            <div className="ma-links">
              <button type="button" className="ma-link" onClick={() => trocarModo('forgot')}>
                Esqueci minha senha
              </button>
              <span className="ma-separator">·</span>
              <button type="button" className="ma-link" onClick={() => trocarModo('signup')}>
                Criar conta grátis
              </button>
            </div>
          </form>
        )}

        {/* === SIGNUP === */}
        {modo === 'signup' && (
          <form onSubmit={handleSignup} className="ma-form">
            <label>
              <span>Nome completo *</span>
              <input type="text" required autoFocus
                value={form.nome} onChange={e => atualizar('nome', e.target.value)}
                placeholder="João da Silva" maxLength={120} />
            </label>
            <label>
              <span>Email *</span>
              <input type="email" required
                value={form.email} onChange={e => atualizar('email', e.target.value)}
                placeholder="seu@email.com" />
            </label>
            <label>
              <span>Senha * <small>(mín. 8 caracteres)</small></span>
              <input type="password" required minLength={8}
                value={form.senha} onChange={e => atualizar('senha', e.target.value)}
                placeholder="••••••••" />
            </label>
            <div className="ma-row">
              <label>
                <span>Empresa</span>
                <input type="text"
                  value={form.empresa} onChange={e => atualizar('empresa', e.target.value)}
                  placeholder="Nome do mercado" maxLength={120} />
              </label>
              <label>
                <span>Telefone *</span>
                <input type="tel" required inputMode="numeric"
                  value={form.telefone} onChange={e => atualizar('telefone', mascararTelefone(e.target.value))}
                  placeholder="(11) 99999-9999" maxLength={16} />
              </label>
            </div>
            <label>
              <span>CPF / CNPJ *</span>
              <input type="text" required inputMode="numeric"
                value={form.documento} onChange={e => atualizar('documento', mascararDocumento(e.target.value))}
                placeholder="000.000.000-00" maxLength={18} />
            </label>
            <button type="submit" className="ma-btn-primary" disabled={carregando}>
              {carregando ? 'Criando...' : 'Criar conta grátis'}
            </button>
            <div className="ma-links">
              <span>Já tem conta?</span>
              <button type="button" className="ma-link" onClick={() => trocarModo('login')}>
                Entrar
              </button>
            </div>
            <p className="ma-disclaimer">
              Ao criar sua conta, você aceita nossos Termos de Uso e Política de Privacidade.
            </p>
          </form>
        )}

        {/* === FORGOT PASSWORD === */}
        {modo === 'forgot' && (
          <form onSubmit={handleForgot} className="ma-form">
            <label>
              <span>Email da sua conta</span>
              <input type="email" required autoFocus
                value={form.email} onChange={e => atualizar('email', e.target.value)}
                placeholder="seu@email.com" />
            </label>
            <button type="submit" className="ma-btn-primary" disabled={carregando}>
              {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
            <div className="ma-links">
              <button type="button" className="ma-link" onClick={() => trocarModo('login')}>
                ← Voltar pro login
              </button>
            </div>
          </form>
        )}

        {/* === RESET PASSWORD === */}
        {modo === 'reset' && (
          <form onSubmit={handleReset} className="ma-form">
            <label>
              <span>Token recebido por email</span>
              <input type="text" required
                value={form.token} onChange={e => atualizar('token', e.target.value)}
                placeholder="Cole o token aqui" />
            </label>
            <label>
              <span>Nova senha <small>(mín. 8 caracteres)</small></span>
              <input type="password" required minLength={8}
                value={form.novaSenha} onChange={e => atualizar('novaSenha', e.target.value)}
                placeholder="••••••••" />
            </label>
            <button type="submit" className="ma-btn-primary" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Definir nova senha'}
            </button>
            <div className="ma-links">
              <button type="button" className="ma-link" onClick={() => trocarModo('login')}>
                ← Voltar pro login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
