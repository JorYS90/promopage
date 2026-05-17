// Hook de autenticação. Gerencia user atual + access token + funções
// signup/login/logout/refresh. Persiste o user em localStorage pra não perder
// no F5 (token é validado contra o backend ao montar).
//
// NÃO PERSISTE o access token em localStorage — seria vulnerável a XSS.
// Em vez disso, mantém só em memória React state, e usa o refresh cookie
// httpOnly pra renovar quando necessário (chamada /api/auth/refresh).
//
// Uso:
//   const { user, signup, login, logout, loading } = useAuth();

import { useEffect, useState, useCallback, useRef } from 'react';

const STORAGE_USER = 'encarte:user-cache';  // cache pra UI inicial; backend ainda valida via /me

// Pega user cacheado pra UI mostrar IMEDIATAMENTE no F5 (sem flash de "deslogado")
function lerUserCache() {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function gravarUserCache(user) {
  try {
    if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_USER);
  } catch {}
}

export function useAuth() {
  const [user, setUser] = useState(lerUserCache);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef(false);

  // Tenta renovar o access token via refresh cookie. Se ok, atualiza user/token.
  // Roda no mount E quando o token expira (chamada manual via refresh()).
  const refresh = useCallback(async () => {
    if (refreshing.current) return null;
    refreshing.current = true;
    try {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',  // envia refresh_token cookie
      });
      if (!r.ok) throw new Error('refresh falhou');
      const data = await r.json();
      setUser(data.user);
      setAccessToken(data.accessToken);
      gravarUserCache(data.user);
      return data.accessToken;
    } catch {
      setUser(null);
      setAccessToken(null);
      gravarUserCache(null);
      return null;
    } finally {
      refreshing.current = false;
    }
  }, []);

  // Tenta renovar na primeira montagem (se tiver cookie válido, fica logado)
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signup = useCallback(async (dados) => {
    const r = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dados),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Erro HTTP ${r.status}`);
    setUser(data.user);
    setAccessToken(data.accessToken);
    gravarUserCache(data.user);
    return data.user;
  }, []);

  const login = useCallback(async ({ email, senha }) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, senha }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Erro HTTP ${r.status}`);
    setUser(data.user);
    setAccessToken(data.accessToken);
    gravarUserCache(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    setUser(null);
    setAccessToken(null);
    gravarUserCache(null);
  }, []);

  const esqueciSenha = useCallback(async (email) => {
    const r = await fetch('/api/auth/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro');
    return data;  // pode incluir _dev_token em dev
  }, []);

  const resetarSenha = useCallback(async ({ token, novaSenha }) => {
    const r = await fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, novaSenha }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro');
    return data;
  }, []);

  // Helper: faz fetch autenticado, renovando o token automaticamente em 401
  const fetchAuth = useCallback(async (url, options = {}) => {
    const tokenAtual = accessToken;
    const headers = {
      ...(options.headers || {}),
      ...(tokenAtual ? { 'Authorization': `Bearer ${tokenAtual}` } : {}),
    };
    let r = await fetch(url, { ...options, headers, credentials: 'include' });
    // Se token expirou (401), tenta renovar uma vez e retentar
    if (r.status === 401 && tokenAtual) {
      const novo = await refresh();
      if (novo) {
        r = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: { ...(options.headers || {}), 'Authorization': `Bearer ${novo}` },
        });
      }
    }
    return r;
  }, [accessToken, refresh]);

  return {
    user,
    accessToken,
    loading,
    signup,
    login,
    logout,
    esqueciSenha,
    resetarSenha,
    refresh,
    fetchAuth,
  };
}
