#!/bin/bash
# =====================================================================
# PromoPage — Bootstrap de VPS Ubuntu (rodar 1x na primeira conexão)
# =====================================================================
# Como usar:
#   1. Conecta no VPS recém-criado como root:
#        ssh root@SEU.IP.DO.VPS
#   2. Cola o conteúdo desse script OU faz:
#        curl -O https://raw.githubusercontent.com/JorYS90/promopage/main/setup-vps.sh
#        chmod +x setup-vps.sh
#        ./setup-vps.sh
#   3. Segue as instruções no final pra configurar SSH key e clonar o repo.
# =====================================================================
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}✗ Rode como root: sudo $0${NC}"
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-promopage}"
SSH_PUB_KEY="${SSH_PUB_KEY:-}"  # opcional: passa via env pra autoconfigurar

# --- Detecta a porta REAL do SSH (evita lockout em VPS com porta custom) ---
# Ordem: env SSH_PORT > sshd -T (config efetiva) > /etc/ssh/sshd_config > falha
SSH_PORT="${SSH_PORT:-}"
if [ -z "$SSH_PORT" ]; then
  SSH_PORT=$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')
  if [ -z "$SSH_PORT" ]; then
    SSH_PORT=$(awk '/^[[:space:]]*Port[[:space:]]+[0-9]+/{print $2; exit}' /etc/ssh/sshd_config 2>/dev/null)
  fi
fi
if [ -z "$SSH_PORT" ]; then
  echo -e "${RED}✗ Não consegui detectar a porta do SSH. Rode com: SSH_PORT=22022 $0${NC}"
  exit 1
fi
echo -e "${YELLOW}⚠ SSH detectado na porta ${SSH_PORT} — UFW vai liberar ESSA porta (não a 22)${NC}"

echo -e "${CYAN}━━━ 1. Atualizando sistema ━━━${NC}"
apt update -y && apt upgrade -y

echo -e "${CYAN}━━━ 2. Instalando essenciais ━━━${NC}"
apt install -y curl git ufw fail2ban htop ca-certificates gnupg lsb-release

echo -e "${CYAN}━━━ 3. Instalando Docker ━━━${NC}"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo -e "${CYAN}━━━ 4. Criando usuário ${DEPLOY_USER} ━━━${NC}"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
fi

if [ -n "$SSH_PUB_KEY" ]; then
  mkdir -p "/home/${DEPLOY_USER}/.ssh"
  echo "$SSH_PUB_KEY" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  chmod 700 "/home/${DEPLOY_USER}/.ssh"
  chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
  echo -e "${GREEN}✓ Chave SSH adicionada${NC}"
fi

echo -e "${CYAN}━━━ 5. Firewall (UFW) — liberando porta SSH ${SSH_PORT} ━━━${NC}"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow ${SSH_PORT}/tcp comment "SSH (port ${SSH_PORT})"
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status numbered

echo -e "${CYAN}━━━ 6. SSH hardening ━━━${NC}"
# Desabilita login com senha (só chave) — só faz se SSH_PUB_KEY foi setada
if [ -n "$SSH_PUB_KEY" ]; then
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  systemctl restart ssh
  echo -e "${YELLOW}⚠ Login root e senha DESABILITADOS — só SSH key daqui pra frente${NC}"
fi

echo -e "${CYAN}━━━ 7. Fail2ban (proteção contra brute force) ━━━${NC}"
systemctl enable --now fail2ban

echo -e "${CYAN}━━━ 8. Caddy (HTTPS automático) ━━━${NC}"
if ! command -v caddy >/dev/null 2>&1; then
  apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt update -y
  apt install -y caddy
fi

echo
echo -e "${GREEN}━━━ Bootstrap concluído! ━━━${NC}"
echo
echo -e "${YELLOW}Próximos passos:${NC}"
echo
echo "1) Como usuário ${DEPLOY_USER}, clona o repo:"
echo "   su - ${DEPLOY_USER}"
echo "   git clone https://github.com/JorYS90/promopage.git promopage"
echo "   cd promopage"
echo
echo "2) Configura o .env do backend:"
echo "   cp backend/.env.example backend/.env"
echo "   nano backend/.env"
echo "   # → Gera JWT_SECRET forte:"
echo "   docker run --rm node:20-slim node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
echo "   # → Setar NODE_ENV=production, CORS_ORIGIN=https://seudominio.com.br, SECURE_COOKIES=true"
echo
echo "3) Configura Caddy pra HTTPS (root):"
echo "   nano /etc/caddy/Caddyfile"
echo "   # Cole (o container web escuta na 8080 pra Caddy poder ficar com 80/443):"
echo "   seudominio.com.br, www.seudominio.com.br {"
echo "       reverse_proxy localhost:8080"
echo "   }"
echo "   systemctl reload caddy"
echo
echo "4) Sobe o site (como ${DEPLOY_USER}):"
echo "   cd /home/${DEPLOY_USER}/promopage"
echo "   docker compose up -d --build"
echo
echo "5) No SEU PC, configura .env.deploy e usa ./deploy.sh pra próximas atualizações."
