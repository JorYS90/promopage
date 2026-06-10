#!/bin/bash
# =====================================================================
# PromoPage — Deploy automatizado
# =====================================================================
# Uso:
#   ./deploy.sh "mensagem do commit"
#   ./deploy.sh                       # tenta extrair mensagem do git diff
#
# Pré-requisitos:
#   1. .env.deploy criado (copia de .env.deploy.example e edita)
#   2. Chave SSH configurada (ssh-copy-id pro VPS)
#   3. Repo git inicializado e remote configurado
#
# O que faz (em ordem):
#   1. Verifica .env.deploy (VPS_HOST, VPS_USER, VPS_PATH, HEALTH_URL)
#   2. Verifica conexão SSH
#   3. Commita mudanças locais (se houver) e faz push
#   4. SSH no VPS: git pull + docker compose up -d --build
#   5. Espera healthcheck responder
#   6. Mostra status final
# =====================================================================

set -e  # para no primeiro erro
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# --- carrega config do .env.deploy ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/.env.deploy" ]; then
  echo -e "${RED}✗ Falta .env.deploy${NC}"
  echo "  Copia o exemplo e preenche:"
  echo "    cp .env.deploy.example .env.deploy"
  echo "    nano .env.deploy"
  exit 1
fi
set -a; source "$SCRIPT_DIR/.env.deploy"; set +a

: "${VPS_HOST:?VPS_HOST não definido em .env.deploy}"
: "${VPS_USER:?VPS_USER não definido em .env.deploy}"
: "${VPS_PATH:?VPS_PATH não definido em .env.deploy}"
: "${HEALTH_URL:?HEALTH_URL não definido em .env.deploy}"
VPS_SSH_PORT="${VPS_SSH_PORT:-22}"

SSH="ssh -o ConnectTimeout=10 -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST}"

# --- 1) testa SSH ---
echo -e "${CYAN}→ Testando SSH em ${VPS_USER}@${VPS_HOST}...${NC}"
if ! $SSH "echo ok" >/dev/null 2>&1; then
  echo -e "${RED}✗ SSH falhou.${NC} Verifica:"
  echo "  - VPS_HOST/VPS_USER/VPS_SSH_PORT no .env.deploy"
  echo "  - ssh-copy-id -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST} (chave autorizada?)"
  exit 1
fi
echo -e "${GREEN}✓ SSH ok${NC}"

# --- 2) verifica git ---
cd "$SCRIPT_DIR"
if [ ! -d .git ]; then
  echo -e "${RED}✗ Não é um repo git.${NC} Rode primeiro:"
  echo "  git init && git add . && git commit -m 'initial' && git remote add origin <URL>"
  exit 1
fi

# --- 3) push pro origin (NÃO commitar automaticamente — perigoso) ---
#
# O script ANTES fazia `git add -A` automático, o que pegou backups de banco
# (.db.bak-*) e pastas de backup gigantes (uploads.bak-*) por engano em
# 10/06/2026, causando força push de cleanup. Agora exigimos commit manual:
# se houver mudanças, paramos e pedimos pro dev commitar com escopo certo.
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}✗ Há mudanças não-commitadas. Commit manual antes de rodar deploy.${NC}"
  echo "  Veja o que mudou:  git status"
  echo "  Stage seletivo:    git add <arquivo1> <arquivo2>"
  echo "  Commit:            git commit -m 'sua mensagem'"
  exit 1
fi

echo -e "${CYAN}→ Push pro origin...${NC}"
git push

# --- 4) deploy remoto ---
echo -e "${CYAN}→ Deploy no VPS (${VPS_PATH})...${NC}"
$SSH "set -e
  cd ${VPS_PATH}
  echo '[VPS] pulling...'
  git pull --ff-only
  echo '[VPS] rebuilding containers...'
  docker compose up -d --build
  echo '[VPS] limpando imagens antigas...'
  docker image prune -f >/dev/null
"

# --- 5) healthcheck ---
echo -e "${CYAN}→ Verificando saúde (${HEALTH_URL})...${NC}"
for i in {1..20}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
  if [ "$CODE" = "200" ]; then
    echo -e "${GREEN}✓ Site online (HTTP 200)${NC}"
    break
  fi
  if [ $i -eq 20 ]; then
    echo -e "${RED}✗ Healthcheck falhou (último HTTP=${CODE}).${NC}"
    echo "  Ver logs:"
    echo "    ssh -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST} 'cd ${VPS_PATH} && docker compose logs --tail=100 api'"
    exit 1
  fi
  sleep 2
done

# --- 6) status final ---
echo
echo -e "${GREEN}━━━ Deploy concluído ━━━${NC}"
$SSH "cd ${VPS_PATH} && docker compose ps"
echo
echo -e "${YELLOW}Logs ao vivo:${NC} ssh -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST} 'cd ${VPS_PATH} && docker compose logs -f'"
