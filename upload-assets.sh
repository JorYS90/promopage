#!/bin/bash
# =====================================================================
# PromoPage — Sincronização de assets (uploads) com a VPS
# =====================================================================
# Por que esse script existe:
#   backend/uploads/ contém ~2.7GB de imagens (templates, produtos).
#   É grande demais pro Git (.gitignore exclui), então precisa ir
#   pra VPS por outro caminho. Esse script faz:
#     1. tar gzip dos uploads locais
#     2. scp pra VPS
#     3. ssh + docker run que extrai dentro do volume promopage_api_uploads
#
# Idempotente: usa `cp -n` (no clobber) — arquivos já no volume não
# são sobrescritos. Seguro rodar várias vezes.
#
# Uso:
#   ./upload-assets.sh
#
# Pré-requisitos:
#   1. .env.deploy configurado (mesmo do deploy.sh)
#   2. SSH key autorizada no VPS
#   3. docker compose up -d JÁ rodou na VPS (cria o volume)
# =====================================================================
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/.env.deploy" ]; then
  echo -e "${RED}✗ Falta .env.deploy${NC}"
  echo "  cp .env.deploy.example .env.deploy && nano .env.deploy"
  exit 1
fi
set -a; source "$SCRIPT_DIR/.env.deploy"; set +a

: "${VPS_HOST:?VPS_HOST não definido em .env.deploy}"
: "${VPS_USER:?VPS_USER não definido em .env.deploy}"
VPS_SSH_PORT="${VPS_SSH_PORT:-22}"

SSH="ssh -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST}"
SCP="scp -P ${VPS_SSH_PORT}"

cd "$SCRIPT_DIR/backend"
if [ ! -d uploads ]; then
  echo -e "${RED}✗ backend/uploads não existe${NC}"
  exit 1
fi

SIZE=$(du -sh uploads | cut -f1)
COUNT=$(find uploads -type f | wc -l)
echo -e "${CYAN}━━━ Upload de assets ━━━${NC}"
echo "  Origem:  $(pwd)/uploads (${COUNT} arquivos, ${SIZE})"
echo "  Destino: ${VPS_USER}@${VPS_HOST}:promopage_api_uploads (volume Docker)"
echo

# --- 1) Testa SSH ---
echo -e "${CYAN}→ Testando SSH...${NC}"
if ! $SSH "echo ok" >/dev/null 2>&1; then
  echo -e "${RED}✗ SSH falhou${NC}"
  exit 1
fi

# --- 2) Verifica que o volume já existe (docker compose up rodou) ---
if ! $SSH "docker volume inspect promopage_api_uploads >/dev/null 2>&1"; then
  echo -e "${RED}✗ Volume promopage_api_uploads não existe na VPS${NC}"
  echo "  Rode 'docker compose up -d' na VPS primeiro pra criar o volume."
  exit 1
fi
echo -e "${GREEN}✓ SSH e volume OK${NC}"

# --- 3) Tarball local ---
TARBALL="/tmp/promopage-assets-$(date +%Y%m%d-%H%M%S).tar.gz"
echo -e "${CYAN}→ Compactando uploads/ ...${NC}"
tar czf "$TARBALL" uploads/
LOCAL_SIZE=$(du -sh "$TARBALL" | cut -f1)
echo -e "${GREEN}✓ Tarball: $LOCAL_SIZE${NC}"

# --- 4) Transfere ---
REMOTE_TAR="/tmp/promopage-assets.tar.gz"
echo -e "${CYAN}→ Enviando pra VPS (pode demorar)...${NC}"
$SCP "$TARBALL" "${VPS_USER}@${VPS_HOST}:${REMOTE_TAR}"
echo -e "${GREEN}✓ Transferido${NC}"

# --- 5) Extrai dentro do volume Docker ---
echo -e "${CYAN}→ Extraindo no volume Docker...${NC}"
$SSH bash <<REMOTE
set -e
mkdir -p /tmp/promopage-assets-extract
tar xzf ${REMOTE_TAR} -C /tmp/promopage-assets-extract
# cp -n = no clobber: não sobrescreve arquivos que o volume já tem
# (preserva uploads feitos por usuários na VPS entre execuções).
docker run --rm \
  -v promopage_api_uploads:/dst \
  -v /tmp/promopage-assets-extract/uploads:/src \
  alpine sh -c 'cp -rn /src/. /dst/ && chown -R 1001:1001 /dst'
rm -rf /tmp/promopage-assets-extract ${REMOTE_TAR}
echo "[VPS] extração concluída"
REMOTE

# --- 6) Cleanup local ---
rm "$TARBALL"

echo
echo -e "${GREEN}━━━ ✓ Assets sincronizados ━━━${NC}"
echo -e "${YELLOW}Verifica:${NC} ssh -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST} \\"
echo "          'docker run --rm -v promopage_api_uploads:/u alpine ls /u | wc -l'"
