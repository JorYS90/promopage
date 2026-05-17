#!/bin/bash
# Suite de testes do sistema de auth SaaS.
# Testa: signup, login, refresh, /me, logout, password reset, rate limit, suspensão.
# Roda contra http://localhost:4010 (backend rodando).

set -e
BASE="http://localhost:4010"
PASS=0
FAIL=0
RESULTS=""

# Cores ANSI
G='\033[0;32m'  # verde
R='\033[0;31m'  # vermelho
Y='\033[1;33m'  # amarelo
N='\033[0m'     # reset

passar() { PASS=$((PASS+1)); echo -e "${G}✓${N} $1"; RESULTS="$RESULTS\n${G}✓${N} $1"; }
falhar() { FAIL=$((FAIL+1)); echo -e "${R}✗${N} $1 (esperado: $2, recebido: $3)"; RESULTS="$RESULTS\n${R}✗${N} $1 — esperado=$2 recebido=$3"; }

# Email único pra cada execução (timestamp)
EMAIL="teste-$(date +%s)@encarte.com"
SENHA="senha12345"

echo -e "${Y}=== Iniciando suite de testes ===${N}"
echo "Email do teste: $EMAIL"
echo ""

# === LIMPEZA prévia ===
node -e "const db=require('./src/db/schema'); db.prepare('DELETE FROM rate_limits').run(); db.prepare(\"DELETE FROM users WHERE email LIKE 'teste-%'\").run();" 2>/dev/null
sleep 0.5

# ============ 1. HEALTH ============
RESP=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/health)
[ "$RESP" = "200" ] && passar "GET /api/health" || falhar "GET /api/health" "200" "$RESP"

# ============ 2. SIGNUP — sucesso ============
RESP=$(curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"Teste\",\"empresa\":\"Empresa Teste\"}")
USER_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
ACCESS_TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$USER_ID" ] && [ -n "$ACCESS_TOKEN" ]; then
  passar "POST /api/auth/signup — user criado (id=$USER_ID, token recebido)"
else
  falhar "POST /api/auth/signup" "user+token" "$RESP"
fi

# ============ 3. SIGNUP — email duplicado ============
RESP=$(curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"Outro\"}")
if echo "$RESP" | grep -q "já cadastrado"; then
  passar "POST /api/auth/signup — bloqueia email duplicado"
else
  falhar "POST /api/auth/signup duplicado" "erro 'já cadastrado'" "$RESP"
fi

# ============ 4. SIGNUP — validação Zod (email inválido) ============
RESP=$(curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d '{"email":"nao-eh-email","senha":"senha12345","nome":"X"}')
if echo "$RESP" | grep -q "Dados inválidos\|inválido"; then
  passar "POST /api/auth/signup — Zod bloqueia email inválido"
else
  falhar "POST /api/auth/signup zod" "erro de validação" "$RESP"
fi

# ============ 5. SIGNUP — senha curta ============
RESP=$(curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","senha":"123","nome":"X"}')
if echo "$RESP" | grep -q "Dados inválidos\|Mínimo\|caracteres"; then
  passar "POST /api/auth/signup — Zod bloqueia senha curta"
else
  falhar "POST /api/auth/signup senha curta" "erro de validação" "$RESP"
fi

# ============ 6. LOGIN — sucesso ============
LOGIN_EMAIL="teste-login-$(date +%s)@encarte.com"
curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"LoginTeste\"}" > /dev/null
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"senha\":\"$SENHA\"}")
LOGIN_TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$LOGIN_TOKEN" ]; then
  passar "POST /api/auth/login — credenciais válidas → token + cookie"
else
  falhar "POST /api/auth/login" "accessToken" "$RESP"
fi

# Verifica que cookie de refresh foi setado
if grep -q "refresh_token" /tmp/cookies.txt 2>/dev/null; then
  passar "POST /api/auth/login — refresh_token cookie httpOnly definido"
else
  falhar "POST /api/auth/login cookie" "refresh_token cookie" "(não encontrado)"
fi

# ============ 7. LOGIN — senha errada ============
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"senha\":\"errada\"}")
if echo "$RESP" | grep -q "incorretos"; then
  passar "POST /api/auth/login — senha errada → erro"
else
  falhar "POST /api/auth/login senha errada" "erro" "$RESP"
fi

# ============ 8. LOGIN — email inexistente (não vaza se existe ou não) ============
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"nao-existe@nope.com","senha":"qualquer"}')
if echo "$RESP" | grep -q "incorretos"; then
  passar "POST /api/auth/login — email inexistente retorna msg genérica (anti enumeration)"
else
  falhar "POST /api/auth/login user enum" "msg genérica" "$RESP"
fi

# ============ 9. /me — com token válido ============
RESP=$(curl -s $BASE/api/auth/me -H "Authorization: Bearer $LOGIN_TOKEN")
if echo "$RESP" | grep -q "$LOGIN_EMAIL"; then
  passar "GET /api/auth/me — token válido → user data"
else
  falhar "GET /api/auth/me valid" "user data" "$RESP"
fi

# ============ 10. /me — SEM token ============
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/me)
[ "$CODE" = "401" ] && passar "GET /api/auth/me — sem token → 401" || falhar "GET /api/auth/me sem token" "401" "$CODE"

# ============ 11. /me — token inválido ============
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/me -H "Authorization: Bearer token-falso-aqui")
[ "$CODE" = "401" ] && passar "GET /api/auth/me — token inválido → 401" || falhar "GET /api/auth/me token invalido" "401" "$CODE"

# ============ 12. REFRESH — com cookie válido ============
RESP=$(curl -s -X POST $BASE/api/auth/refresh -b /tmp/cookies.txt -c /tmp/cookies.txt)
NEW_TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "$LOGIN_TOKEN" ]; then
  passar "POST /api/auth/refresh — refresh token rotacionado, novo access token gerado"
else
  falhar "POST /api/auth/refresh" "novo token diferente" "(token igual ou ausente)"
fi

# ============ 13. REFRESH — refresh token antigo (rotacionado) deve falhar ============
RESP=$(curl -s -X POST $BASE/api/auth/refresh -H "Content-Type: application/json" \
  -d '{"refreshToken":"token-antigo-nao-existe-no-db"}')
if echo "$RESP" | grep -q "inválida\|inválido"; then
  passar "POST /api/auth/refresh — refresh token inválido → erro"
else
  falhar "POST /api/auth/refresh invalido" "erro" "$RESP"
fi

# ============ 14. LOGOUT — revoga sessão atual ============
RESP=$(curl -s -X POST $BASE/api/auth/logout -b /tmp/cookies.txt -c /tmp/cookies.txt)
if echo "$RESP" | grep -q '"ok":true'; then
  passar "POST /api/auth/logout — sessão revogada"
else
  falhar "POST /api/auth/logout" "ok:true" "$RESP"
fi

# Após logout, refresh deve falhar (cookie já foi revogado)
RESP=$(curl -s -X POST $BASE/api/auth/refresh -b /tmp/cookies.txt)
if echo "$RESP" | grep -q "revogada\|inválida"; then
  passar "POST /api/auth/refresh — após logout, refresh falha (sessão revogada)"
else
  # Cookie pode ter sido limpo, então 401 também é válido
  if echo "$RESP" | grep -q "ausente"; then
    passar "POST /api/auth/refresh — após logout, cookie limpo (refresh ausente)"
  else
    falhar "POST /api/auth/refresh pós-logout" "erro" "$RESP"
  fi
fi

# ============ 15. PASSWORD FORGOT — gera token (dev mode retorna no response) ============
RESET_EMAIL="teste-reset-$(date +%s)@encarte.com"
curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$RESET_EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"Reset\"}" > /dev/null
RESP=$(curl -s -X POST $BASE/api/auth/password/forgot -H "Content-Type: application/json" \
  -d "{\"email\":\"$RESET_EMAIL\"}")
RESET_TOKEN=$(echo "$RESP" | grep -o '"_dev_token":"[^"]*' | cut -d'"' -f4)
if [ -n "$RESET_TOKEN" ]; then
  passar "POST /api/auth/password/forgot — token gerado (modo DEV)"
else
  falhar "POST /api/auth/password/forgot" "_dev_token" "$RESP"
fi

# ============ 16. PASSWORD FORGOT — email inexistente NÃO vaza ============
RESP=$(curl -s -X POST $BASE/api/auth/password/forgot -H "Content-Type: application/json" \
  -d '{"email":"nao-existe@nope.com"}')
if echo "$RESP" | grep -q '"ok":true' && ! echo "$RESP" | grep -q "_dev_token"; then
  passar "POST /api/auth/password/forgot — email inexistente retorna ok:true (anti enumeration)"
else
  falhar "POST /api/auth/password/forgot user enum" "ok:true sem token" "$RESP"
fi

# ============ 17. PASSWORD RESET — aplica nova senha ============
NOVA_SENHA="novaSenha12345"
RESP=$(curl -s -X POST $BASE/api/auth/password/reset -H "Content-Type: application/json" \
  -d "{\"token\":\"$RESET_TOKEN\",\"novaSenha\":\"$NOVA_SENHA\"}")
if echo "$RESP" | grep -q '"ok":true'; then
  passar "POST /api/auth/password/reset — nova senha aplicada"
else
  falhar "POST /api/auth/password/reset" "ok:true" "$RESP"
fi

# ============ 18. PASSWORD RESET — token reutilizado falha ============
RESP=$(curl -s -X POST $BASE/api/auth/password/reset -H "Content-Type: application/json" \
  -d "{\"token\":\"$RESET_TOKEN\",\"novaSenha\":\"outraSenha12345\"}")
if echo "$RESP" | grep -q "usado\|inválido"; then
  passar "POST /api/auth/password/reset — token reutilizado bloqueado"
else
  falhar "POST /api/auth/password/reset reuse" "erro" "$RESP"
fi

# ============ 19. LOGIN com SENHA NOVA — confirma que reset funcionou ============
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$RESET_EMAIL\",\"senha\":\"$NOVA_SENHA\"}")
if echo "$RESP" | grep -q "accessToken"; then
  passar "POST /api/auth/login — login com senha NOVA funciona"
else
  falhar "POST /api/auth/login senha nova" "accessToken" "$RESP"
fi

# ============ 20. RATE LIMIT — 5 tentativas erradas + 6ª bloqueia ============
node -e "const db=require('./src/db/schema'); db.prepare('DELETE FROM rate_limits').run();" 2>/dev/null
RATE_EMAIL="teste-rate-$(date +%s)@encarte.com"
curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$RATE_EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"Rate\"}" > /dev/null

for i in 1 2 3 4 5; do
  curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
    -d "{\"email\":\"$RATE_EMAIL\",\"senha\":\"errada\"}" > /dev/null
done
# 6ª tentativa: deve estar bloqueado
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$RATE_EMAIL\",\"senha\":\"errada\"}")
if echo "$RESP" | grep -q "Muitas tentativas"; then
  passar "Rate limit — 6ª tentativa bloqueada após 5 falhas"
else
  falhar "Rate limit" "bloqueio" "$RESP"
fi

# Mesmo com SENHA CORRETA, deve estar bloqueado
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$RATE_EMAIL\",\"senha\":\"$SENHA\"}")
if echo "$RESP" | grep -q "Muitas tentativas"; then
  passar "Rate limit — bloqueia mesmo com senha CORRETA durante o período"
else
  falhar "Rate limit ativo" "bloqueio" "$RESP"
fi

# ============ 21. USUÁRIO SUSPENSO não consegue logar ============
node -e "const db=require('./src/db/schema'); db.prepare('DELETE FROM rate_limits').run();" 2>/dev/null
SUSP_EMAIL="teste-susp-$(date +%s)@encarte.com"
curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$SUSP_EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"Susp\"}" > /dev/null

# Suspende via SQL direto
node -e "const db=require('./src/db/schema'); db.prepare(\"UPDATE users SET ativo=0, motivo_suspensao='Pagamento atrasado' WHERE email=?\").run('$SUSP_EMAIL');" 2>/dev/null

RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$SUSP_EMAIL\",\"senha\":\"$SENHA\"}")
if echo "$RESP" | grep -q "suspensa"; then
  passar "Login — usuário suspenso bloqueado"
else
  falhar "Login suspenso" "erro de suspensão" "$RESP"
fi

# ============ 22. AUDIT LOG — registra ações ============
COUNT=$(node -e "const db=require('./src/db/schema'); console.log(db.prepare(\"SELECT COUNT(*) as c FROM audit_logs WHERE acao IN ('user.signup','login.success','login.failed','password.changed')\").get().c);" 2>/dev/null | tail -1)
if [ "$COUNT" -gt "0" ]; then
  passar "Audit log — $COUNT eventos registrados (signup, login, password change)"
else
  falhar "Audit log" ">0 eventos" "$COUNT"
fi

# ============ 23. PLANOS — seeds default presentes ============
COUNT=$(node -e "const db=require('./src/db/schema'); console.log(db.prepare('SELECT COUNT(*) as c FROM plans WHERE ativo=1').get().c);" 2>/dev/null | tail -1)
if [ "$COUNT" -eq "3" ]; then
  passar "Plans — 3 planos default presentes (basico/pro/premium)"
else
  falhar "Plans seed" "3 planos" "$COUNT"
fi

# ============ 24. ROLES — seeds default presentes ============
COUNT=$(node -e "const db=require('./src/db/schema'); console.log(db.prepare('SELECT COUNT(*) as c FROM roles').get().c);" 2>/dev/null | tail -1)
if [ "$COUNT" -eq "4" ]; then
  passar "Roles — 4 roles default presentes (super_admin/admin/moderador/cliente)"
else
  falhar "Roles seed" "4 roles" "$COUNT"
fi

# ============ RESULTADO FINAL ============
echo ""
echo -e "${Y}=== Resultado ===${N}"
echo -e "Passou: ${G}$PASS${N}"
echo -e "Falhou: ${R}$FAIL${N}"
TOTAL=$((PASS + FAIL))
echo "Total: $TOTAL"

# Limpa rate limits após os testes pra não atrapalhar uso manual
node -e "const db=require('./src/db/schema'); db.prepare('DELETE FROM rate_limits').run();" 2>/dev/null

if [ $FAIL -eq 0 ]; then
  echo -e "${G}TODOS OS TESTES PASSARAM ✓${N}"
  exit 0
else
  echo -e "${R}ALGUM TESTE FALHOU ✗${N}"
  exit 1
fi
