#!/bin/bash
# Suite de testes dos endpoints /api/users/me e /api/plans (perfil, assinatura, pagamentos).

set -e
BASE="http://localhost:4010"
PASS=0
FAIL=0

G='\033[0;32m'
R='\033[0;31m'
Y='\033[1;33m'
N='\033[0m'

passar() { PASS=$((PASS+1)); echo -e "${G}✓${N} $1"; }
falhar() { FAIL=$((FAIL+1)); echo -e "${R}✗${N} $1 — esperado=$2 recebido=$3"; }

EMAIL="usertest-$(date +%s)@encarte.com"
SENHA="senha12345"

echo -e "${Y}=== Testes /api/users e /api/plans ===${N}"
node -e "const db=require('./src/db/schema'); db.prepare('DELETE FROM rate_limits').run();" 2>/dev/null

# 0. Cria user pra testes
SIGNUP=$(curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\",\"nome\":\"User Test\",\"empresa\":\"Loja\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo "$SIGNUP" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

# 1. GET /api/plans — público (sem auth)
RESP=$(curl -s $BASE/api/plans)
COUNT=$(echo "$RESP" | grep -o '"slug":"[^"]*' | wc -l)
[ "$COUNT" -eq "3" ] && passar "GET /api/plans — lista 3 planos sem auth" || falhar "GET /api/plans" "3 planos" "$COUNT"

# 2. Plans estrutura completa (limites + recursos como objeto)
if echo "$RESP" | grep -q '"limites":{' && echo "$RESP" | grep -q '"recursos":\['; then
  passar "GET /api/plans — limites e recursos vêm como JSON parseado"
else
  falhar "GET /api/plans estrutura" "limites obj + recursos array" "(não encontrado)"
fi

# 3. GET /api/users/me — com token
RESP=$(curl -s $BASE/api/users/me -H "Authorization: Bearer $TOKEN")
if echo "$RESP" | grep -q "$EMAIL" && echo "$RESP" | grep -q '"subscription":null'; then
  passar "GET /api/users/me — retorna user + subscription:null (sem assinatura ainda)"
else
  falhar "GET /api/users/me" "user + subscription" "$RESP"
fi

# 4. GET /api/users/me — sem token → 401
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/users/me)
[ "$CODE" = "401" ] && passar "GET /api/users/me — sem token → 401" || falhar "/me sem auth" "401" "$CODE"

# 5. PUT /api/users/me — atualiza perfil
RESP=$(curl -s -X PUT $BASE/api/users/me -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Nome Atualizado","empresa":"Empresa Nova","telefone":"(11) 99999-9999","documento":"123.456.789-00"}')
if echo "$RESP" | grep -q "Nome Atualizado" && echo "$RESP" | grep -q "Empresa Nova"; then
  passar "PUT /api/users/me — perfil atualizado"
else
  falhar "PUT /api/users/me" "campos atualizados" "$RESP"
fi

# 6. PUT /api/users/me — validação Zod (nome curto)
RESP=$(curl -s -X PUT $BASE/api/users/me -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"X"}')
if echo "$RESP" | grep -q "inválidos\|inválido"; then
  passar "PUT /api/users/me — Zod bloqueia nome muito curto"
else
  falhar "PUT /api/users/me zod" "erro" "$RESP"
fi

# 7. PUT /api/users/me/password — senha atual ERRADA → 400
RESP=$(curl -s -X PUT $BASE/api/users/me/password -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"senhaAtual":"errada","novaSenha":"outraSenha123"}')
if echo "$RESP" | grep -q "incorreta"; then
  passar "PUT /me/password — senha atual errada → erro"
else
  falhar "/me/password senha errada" "erro" "$RESP"
fi

# 8. PUT /api/users/me/password — nova senha curta → 400
RESP=$(curl -s -X PUT $BASE/api/users/me/password -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"senhaAtual\":\"$SENHA\",\"novaSenha\":\"123\"}")
if echo "$RESP" | grep -q "inválidos\|caracteres"; then
  passar "PUT /me/password — Zod bloqueia nova senha curta"
else
  falhar "/me/password senha curta" "erro" "$RESP"
fi

# 9. PUT /api/users/me/password — sucesso
NOVA="novaSenha98765"
RESP=$(curl -s -X PUT $BASE/api/users/me/password -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"senhaAtual\":\"$SENHA\",\"novaSenha\":\"$NOVA\"}")
if echo "$RESP" | grep -q '"ok":true'; then
  passar "PUT /me/password — senha trocada (e outras sessões revogadas)"
else
  falhar "/me/password sucesso" "ok:true" "$RESP"
fi

# 10. Login com senha NOVA
RESP=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$NOVA\"}")
NEW_TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$NEW_TOKEN" ]; then
  passar "Login com senha NOVA funciona"
else
  falhar "Login senha nova" "accessToken" "$RESP"
fi

# 11. GET /api/users/me/subscription — sem assinatura
RESP=$(curl -s $BASE/api/users/me/subscription -H "Authorization: Bearer $NEW_TOKEN")
if echo "$RESP" | grep -q '"subscription":null'; then
  passar "GET /me/subscription — sem assinatura → null"
else
  falhar "/me/subscription" "null" "$RESP"
fi

# 12. Criar assinatura ATIVA via SQL (simula pagamento aprovado)
node -e "
const db=require('./src/db/schema');
const agora=new Date().toISOString();
const venc=new Date(Date.now()+30*86400000).toISOString();
db.prepare('INSERT INTO subscriptions (user_id, plan_id, status, ciclo, inicio, vencimento, criado_em, atualizado_em) VALUES (?, 2, ?, ?, ?, ?, ?, ?)').run($USER_ID, 'ativo', 'mensal', agora, venc, agora, agora);
" 2>/dev/null

RESP=$(curl -s $BASE/api/users/me/subscription -H "Authorization: Bearer $NEW_TOKEN")
if echo "$RESP" | grep -q '"plan_slug":"pro"' && echo "$RESP" | grep -q '"diasRestantes":'; then
  passar "GET /me/subscription — retorna plano Pro + dias restantes"
else
  falhar "/me/subscription com sub" "plan_slug + diasRestantes" "$RESP"
fi

# 13. GET /api/users/me/payments — vazio
RESP=$(curl -s $BASE/api/users/me/payments -H "Authorization: Bearer $NEW_TOKEN")
if echo "$RESP" | grep -q '"payments":\[\]' && echo "$RESP" | grep -q '"total":0'; then
  passar "GET /me/payments — sem pagamentos → []"
else
  falhar "/me/payments vazio" "[] total=0" "$RESP"
fi

# 14. Inserir pagamento via SQL e verificar listagem
node -e "
const db=require('./src/db/schema');
const agora=new Date().toISOString();
db.prepare('INSERT INTO payments (user_id, valor_centavos, metodo, status, gateway, pago_em, criado_em) VALUES (?, 6990, ?, ?, ?, ?, ?)').run($USER_ID, 'stripe_card', 'pago', 'stripe', agora, agora);
" 2>/dev/null

RESP=$(curl -s $BASE/api/users/me/payments -H "Authorization: Bearer $NEW_TOKEN")
if echo "$RESP" | grep -q '"valor_centavos":6990' && echo "$RESP" | grep -q '"total":1'; then
  passar "GET /me/payments — lista pagamentos do user"
else
  falhar "/me/payments com data" "valor 6990 + total 1" "$RESP"
fi

# 15. /api/users/me retorna lastPayment
RESP=$(curl -s $BASE/api/users/me -H "Authorization: Bearer $NEW_TOKEN")
if echo "$RESP" | grep -q '"lastPayment":{' && echo "$RESP" | grep -q '"valor_centavos":6990'; then
  passar "GET /me — inclui último pagamento"
else
  falhar "/me lastPayment" "pagamento" "$RESP"
fi

# 16. /api/users/me com sub retorna subscription parseado
if echo "$RESP" | grep -q '"plan_slug":"pro"' && echo "$RESP" | grep -q '"plan_limites":{'; then
  passar "GET /me — subscription com plan_limites como objeto JSON"
else
  falhar "/me sub parseado" "plan_slug + plan_limites obj" "$RESP"
fi

echo ""
echo -e "${Y}=== Resultado /api/users ===${N}"
echo -e "Passou: ${G}$PASS${N}"
echo -e "Falhou: ${R}$FAIL${N}"
node -e "const db=require('./src/db/schema'); db.prepare('DELETE FROM rate_limits').run();" 2>/dev/null

[ $FAIL -eq 0 ] && echo -e "${G}TODOS OS TESTES PASSARAM ✓${N}" || (echo -e "${R}ALGUM TESTE FALHOU ✗${N}"; exit 1)
