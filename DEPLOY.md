# 🚀 Guia de Deploy — PromoPage

Guia passo-a-passo pra colocar o PromoPage no ar. Está dividido em 3 níveis:
**Local com Docker** (~5min) → **VPS produção** (~30min) → **Manutenção contínua**.

---

## 📦 1. Testar localmente com Docker (recomendado antes de subir)

Antes de pagar VPS, garante que tudo sobe direito no seu PC.

### Pré-requisitos
- Docker Desktop instalado
- ~2 GB de disco livre

### Passos

```bash
# 1. Configurar variáveis de ambiente
cp backend/.env.example backend/.env

# 2. Gerar JWT_SECRET forte
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# Cola a saída no backend/.env como JWT_SECRET=...

# 3. Editar backend/.env:
#    - NODE_ENV=production
#    - CORS_ORIGIN=http://localhost  (ou seu domínio)
#    - SECURE_COOKIES=false           (não tem HTTPS local)

# 4. Subir tudo
docker compose up -d --build

# 5. Ver logs
docker compose logs -f api
```

Acessa **http://localhost:8080** — frontend abre, API responde em `/api/health`.

Quando quiser parar: `docker compose down` (volumes ficam preservados).

---

## 🌐 2. Deploy em VPS de produção

### Opção A — Hetzner / DigitalOcean / Vultr (Linux com Docker)

**Custo:** ~$5–10/mês. Tempo: ~30min.

#### 2.1 Provisionar a máquina
- Crie uma VPS Ubuntu 24.04 LTS (mínimo 1 vCPU, 1GB RAM, 25GB SSD)
- Anote o IP público
- Configure SSH key (não use senha)

#### 2.2 Configurar o domínio
- No painel DNS do seu registrar (Registro.br, GoDaddy etc), aponte um A record:
  - `seudominio.com.br` → IP da VPS
  - `www.seudominio.com.br` → IP da VPS
- Espera ~5min pra DNS propagar (testa com `dig seudominio.com.br`)

#### 2.3 Instalar Docker na VPS

```bash
ssh root@SEU.IP.AQUI

# Atualiza pacotes
apt update && apt upgrade -y

# Instala Docker (script oficial)
curl -fsSL https://get.docker.com | sh

# Verifica
docker --version
docker compose version
```

#### 2.4 Clonar o projeto

```bash
# Cria usuário não-root pro app (segurança)
adduser promopage
usermod -aG docker promopage
su - promopage

# Clona o repo (use HTTPS pra clone público OU SSH se já tiver chave configurada)
git clone https://github.com/JorYS90/promopage.git
# git clone git@github.com:JorYS90/promopage.git   # via SSH
cd promopage
```

#### 2.5 Configurar `.env`

```bash
cp backend/.env.example backend/.env

# Gera secret forte
docker run --rm node:20-slim node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# Copia a saída

nano backend/.env
```

**Configure:**
```env
NODE_ENV=production
JWT_SECRET=COLE_AQUI_O_SECRET_GERADO
CORS_ORIGIN=https://seudominio.com.br,https://www.seudominio.com.br
SECURE_COOKIES=true
RATE_LIMIT_GLOBAL_MAX=300
RATE_LIMIT_AUTH_MAX=10
```

#### 2.6 Configurar HTTPS (Let's Encrypt + Caddy ou Nginx Proxy Manager)

**Forma mais simples — Caddy automatiza tudo:**

> ⚠️ **Importante:** o container `web` do docker-compose escuta na porta **8080** do host,
> deixando 80/443 livres pro Caddy fazer o reverse_proxy + HTTPS. Não troque essa porta.

Cria `Caddyfile` na raiz da VPS (troque o domínio pelo seu):
```caddy
seudominio.com.br, www.seudominio.com.br {
    reverse_proxy localhost:8080
}
```

Roda Caddy:
```bash
sudo apt install caddy
sudo mv Caddyfile /etc/caddy/
sudo systemctl reload caddy
```

Caddy obtém o certificado SSL automaticamente. Em 30 segundos seu site está em HTTPS.

#### 2.7 Subir os containers

```bash
docker compose up -d --build

# Acompanha
docker compose logs -f
```

Acessa **https://seudominio.com.br** ✓

#### 2.8 Sincronizar assets de template (uma vez, no primeiro deploy)

O `backend/uploads/` (imagens de templates pré-cadastrados) é grande demais pro Git
(~2.7GB com 4000+ imagens) e fica fora do repo. Pra subir essa primeira leva:

**No seu PC (não na VPS):**
```bash
./upload-assets.sh
```

O script lê `.env.deploy`, tar.gz dos uploads, scp pra VPS, e extrai dentro do volume
Docker `promopage_api_uploads`. É **idempotente** (usa `cp -n`): rode quantas vezes
quiser, não sobrescreve uploads novos feitos no painel.

> 💡 Long-term: pra deixar a VPS recriável sem precisar re-subir assets, considere
> migrar uploads pra S3/R2 (ver seção "Próximos passos"). Custo ~$0.50/mês.

---

### Opção B — Railway / Render (mais simples, mais caro)

1. Conecta seu GitHub no Railway
2. Cria um projeto, aponta pra pasta `backend/`
3. Adiciona variáveis de ambiente do `.env.example`
4. Adiciona um volume persistente em `/app/data`
5. Frontend separado no Vercel (build automático, grátis)

**Custo:** ~$15–25/mês mas zero configuração de servidor.

---

## 🛠️ 3. Manutenção & operação contínua

### 3.1 Atualizar o site após mudar código

```bash
ssh promopage@SEU.IP
cd promopage
git pull
docker compose up -d --build
```

Containers reiniciam com a nova versão, **sem perder dados** (volumes preservados).

### 3.2 Ver logs

```bash
docker compose logs -f api      # backend
docker compose logs -f web      # nginx
docker compose logs -f backup   # job de backup
```

### 3.3 Backup manual

```bash
docker compose exec api npm run backup
```

Backups ficam em `/var/lib/docker/volumes/promopage_api_backups/_data` — 14 últimos preservados.

### 3.4 Backup automático (já está rodando!)

O serviço `backup` no docker-compose roda **todo dia às 03:00** e mantém os 14 backups mais recentes.

**Pra robustez total**, copie pra cloud (S3/B2). Adiciona um cron na VPS:
```bash
crontab -e
# Cole:
0 4 * * * docker run --rm -v promopage_api_backups:/data -v ~/.config/rclone:/config/rclone rclone/rclone copy /data b2:meu-bucket-backups
```

### 3.5 Acessar o banco SQLite remotamente

```bash
ssh promopage@SEU.IP

# Abre shell no container e usa sqlite3
docker compose exec api sh
apk add sqlite      # se for alpine
sqlite3 /app/data/saas.db

# Comandos úteis:
.tables                    # lista tabelas
.schema users              # estrutura da tabela users
SELECT * FROM users;       # ver usuários
UPDATE users SET role_id=1 WHERE email='voce@email.com';  # virar super_admin
```

**OU** copia o `.db` pra sua máquina:
```bash
docker cp promopage-api:/app/data/saas.db ./saas-local.db
# Abre com DB Browser for SQLite (GUI gratuita): https://sqlitebrowser.org
```

### 3.6 Monitorar uptime (grátis)

- [UptimeRobot](https://uptimerobot.com) (50 monitores grátis)
  - URL: `https://seudominio.com.br/api/health`
  - Alerta no email se cair

---

## 🆘 Troubleshooting

### "Cannot connect to API"
- Confere CORS_ORIGIN no `.env` — precisa bater EXATO com o domínio (com `https://`).
- `docker compose logs api` mostra erros do backend.

### "JWT_SECRET ausente"
- Backend recusa subir em `NODE_ENV=production` sem secret válido (>32 chars).
- Edita `backend/.env` e roda `docker compose restart api`.

### "Cookies não chegam no backend"
- Em prod precisa `SECURE_COOKIES=true` + servir via HTTPS.
- Verifica se Caddy/Nginx está terminando SSL corretamente.

### "Banco tá lockado"
- WAL do SQLite resolve concorrência, mas se travar: `docker compose restart api`.
- Pra alta concorrência (10k+ usuários ativos/min), migre pra Postgres.

---

## 💰 Custo mensal estimado (MVP)

| Item | Custo |
|---|---|
| VPS Hetzner CX22 (2 vCPU, 4GB RAM) | €4,51 (~R$ 27) |
| Domínio .com.br (Registro.br) | R$ 40/ano |
| Cloudflare DNS + proxy | Grátis |
| Backup B2 (5 GB) | $0,50 |
| Email transacional (Resend, 100/dia) | Grátis |
| **Total** | **~R$ 30–35/mês** |

---

## 🎯 Próximos passos recomendados

Após estar no ar:
1. **Stripe / Mercado Pago** — cobrança real dos planos
2. **Resend / Brevo** — email de confirmação + reset de senha
3. **Migrar uploads pra S3/R2** — sem isso, perde imagens se servidor restaurar
4. **Sentry** — alertas de erro em produção (grátis até 5k erros/mês)
5. **Termos de uso + Política de privacidade** — exigido por LGPD pra cobrar

Cada um desses leva ~1 dia de trabalho. Posso te ajudar com qualquer um quando estiver pronto.
