import { useState, useRef, useEffect } from 'react';

// Botão de auth na topbar.
//   - Quando deslogado: mostra "Entrar" + "Cadastre-se" (cores diferentes)
//   - Quando logado: avatar com inicial + dropdown (Meu perfil, Assinatura, Sair)
//
// Recebe: user, aoLogin, aoSignup, aoLogout

export default function BotaoAuthTopbar({ user, aoLogin, aoSignup, aoLogout, aoAbrirConta, aoAbrirAdmin }) {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!dropdownAberto) return;
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [dropdownAberto]);

  // === DESLOGADO ===
  if (!user) {
    return (
      <div className="auth-topbar">
        <button className="auth-btn auth-btn-login" onClick={aoLogin}>
          Entrar
        </button>
        <button className="auth-btn auth-btn-signup" onClick={aoSignup}>
          Cadastre-se
        </button>
      </div>
    );
  }

  // === LOGADO ===
  const inicial = (user.nome || user.email || '?').trim()[0]?.toUpperCase() || '?';
  const primeiroNome = (user.nome || user.email).split(/[\s@]/)[0];

  return (
    <div className="auth-topbar logado" ref={dropdownRef}>
      <button
        className="auth-avatar-btn"
        onClick={() => setDropdownAberto(v => !v)}
        title={`Conectado como ${user.email}`}
      >
        <span className="auth-avatar">{inicial}</span>
        <span className="auth-nome">{primeiroNome}</span>
        <span className="auth-chevron">▾</span>
      </button>

      {dropdownAberto && (
        <div className="auth-dropdown">
          <div className="auth-dd-header">
            <div className="auth-dd-nome">{user.nome}</div>
            <div className="auth-dd-email">{user.email}</div>
            <div className="auth-dd-role">
              {user.role_nome === 'cliente' ? '👤 Cliente' :
               user.role_nome === 'admin' ? '🛡 Administrador' :
               user.role_nome === 'super_admin' ? '⚡ Super Admin' :
               user.role_nome === 'moderador' ? '🔧 Moderador' :
               user.role_nome}
            </div>
          </div>

          <div className="auth-dd-sep" />

          <button className="auth-dd-item" onClick={() => { setDropdownAberto(false); aoAbrirConta?.('perfil'); }}>
            <span>👤</span> Meu Perfil
          </button>
          <button className="auth-dd-item" onClick={() => { setDropdownAberto(false); aoAbrirConta?.('assinatura'); }}>
            <span>💳</span> Minha Assinatura
          </button>
          <button className="auth-dd-item" onClick={() => { setDropdownAberto(false); aoAbrirConta?.('pagamentos'); }}>
            <span>📊</span> Histórico de Pagamentos
          </button>

          {/* Link de admin: visível só pra admin/super_admin */}
          {(user.role_nome === 'admin' || user.role_nome === 'super_admin') && (
            <>
              <div className="auth-dd-sep" />
              <button
                className="auth-dd-item auth-dd-item-admin"
                onClick={() => { setDropdownAberto(false); aoAbrirAdmin?.(); }}
              >
                <span>⚡</span> Painel Admin
              </button>
            </>
          )}

          <div className="auth-dd-sep" />

          <button
            className="auth-dd-item auth-dd-item-danger"
            onClick={() => { setDropdownAberto(false); aoLogout(); }}
          >
            <span>🚪</span> Sair
          </button>
        </div>
      )}
    </div>
  );
}
