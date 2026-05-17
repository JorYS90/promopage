# 🔧 Manutenção PromoPage

Guia de operação contínua. Tudo que você precisa saber pra rodar o site no dia-a-dia depois que estiver hospedado.

> 💡 **Quase tudo aqui pode ser feito pelo Claude Code.** É só pedir "muda X", "investiga bug Y", "deploy a última versão". Esse arquivo é referência caso queira fazer manual.

---

## 🚀 Deploy de mudanças

### Cenário comum: mexi no código, quero subir
```bash
./deploy.sh "feat: nova grade de 24 produtos"
```
Faz: commit + push + pull no VPS + rebuild + healthcheck.

### Sem mensagem (auto)
```bash
./deploy.sh
```
Usa `deploy: 2026-05-16 14:32` como commit msg.

### Deploy manual (sem o script)
```bash
git add . && git commit -m "msg" && git push
ssh promopage@SEU.IP "cd promopage && git pull && docker compose up -d --build"
```

---

## 🔍 Diagnóstico

### Site fora do ar?
```bash
# 1. Healthcheck externo
curl https://seudominio.com.br/api/health

# 2. Conecta no VPS
ssh promopage@SEU.IP

# 3. Ver containers
docker compose ps
# STATUS deve mostrar "Up"; se "Exited" ou "Restarting", tem problema

# 4. Logs do backend
docker compose logs --tail=200 api

# 5. Logs do nginx
docker compose logs --tail=200 web

# 6. Espaço em disco (cheio = bug)
df -h

# 7. Memória
free -h
```

### Erro 500 em alguma rota
```bash
ssh promopage@SEU.IP
docker compose logs -f api    # acompanha em tempo real, reproduz o erro
```

### Site lento
```bash
ssh promopage@SEU.IP
htop                           # processos pesados (Q pra sair)
docker stats                   # uso de CPU/RAM por container
```

---

## 💾 Backup

### Backup automático (já configurado)
- Container `backup` roda todo dia às **03:00** UTC.
- Mantém os **14 mais recentes** em `/var/lib/docker/volumes/encarte-builder_api_backups/_data`.

### Backup manual antes de mudança crítica
```bash
ssh promopage@SEU.IP "cd promopage && docker compose exec api npm run backup"
```

### Baixar backup pro seu PC
```bash
scp promopage@SEU.IP:/var/lib/docker/volumes/encarte-builder_api_backups/_data/saas-*.db ./
```

### Restaurar backup
```bash
ssh promopage@SEU.IP
cd promopage
docker compose stop api
# COPIA o backup escolhido por cima do banco atual
docker run --rm -v encarte-builder_api_data:/data -v encarte-builder_api_backups:/backup alpine \
  sh -c "cp /backup/saas-AAAA-MM-DD.db /data/saas.db"
docker compose start api
```

⚠️ **Sempre teste em ambiente de staging antes de restaurar em prod.**

---

## 🔄 Operações rotineiras

| Tarefa | Comando |
|---|---|
| Reiniciar backend | `ssh promopage@IP "cd promopage && docker compose restart api"` |
| Reiniciar tudo | `ssh promopage@IP "cd promopage && docker compose restart"` |
| Parar tudo | `ssh promopage@IP "cd promopage && docker compose down"` |
| Subir novamente | `ssh promopage@IP "cd promopage && docker compose up -d"` |
| Rebuild forçado | `ssh promopage@IP "cd promopage && docker compose up -d --build --force-recreate"` |
| Ver consumo | `ssh promopage@IP "docker stats --no-stream"` |
| Acessar SQLite | `ssh promopage@IP "cd promopage && docker compose exec api sqlite3 /app/data/saas.db"` |

---

## 🆘 Rollback (algo deu errado, voltar versão anterior)

```bash
# No VPS
ssh promopage@SEU.IP
cd promopage

# Ver commits recentes
git log --oneline -10

# Volta pro commit anterior
git reset --hard HEAD~1

# Reconstrói
docker compose up -d --build
```

Ou se preferir voltar pra um commit específico:
```bash
git reset --hard abc1234
docker compose up -d --build
```

---

## 🔒 Manutenção de segurança (mensal)

### Atualizar SO do servidor
```bash
ssh promopage@SEU.IP
sudo apt update && sudo apt upgrade -y
sudo reboot                    # se atualizou o kernel
```

### Renovar SSL
Caddy faz **automático** (cada 60 dias). Pra verificar:
```bash
ssh promopage@SEU.IP "sudo systemctl status caddy"
```

### Ver tentativas de invasão
```bash
ssh promopage@SEU.IP "sudo fail2ban-client status sshd"
```

---

## 📊 Logs persistentes

Logs em `/app/logs` (volume `api_logs`) — preservados entre restarts.

Pra inspecionar:
```bash
ssh promopage@SEU.IP
docker compose exec api ls -la /app/logs
docker compose exec api tail -100 /app/logs/access.log
```

---

## 🌐 Quando trocar de domínio

1. Edita `backend/.env`:
   ```env
   CORS_ORIGIN=https://novodominio.com.br,https://www.novodominio.com.br
   ```
2. Edita `/etc/caddy/Caddyfile` (no VPS, como root):
   ```caddy
   novodominio.com.br, www.novodominio.com.br {
       reverse_proxy localhost:80
   }
   ```
3. Reload:
   ```bash
   sudo systemctl reload caddy
   docker compose restart api
   ```

---

## 💡 Atalhos com Claude Code

Quando rodando Claude Code nesse projeto, você pode pedir:

- _"deploy a última mudança"_ → roda `./deploy.sh`
- _"ver logs do backend"_ → SSH + `docker compose logs api`
- _"o site tá no ar?"_ → curl no healthcheck
- _"backup agora"_ → ssh + npm run backup
- _"rollback pro commit anterior"_ → ssh + git reset
- _"adiciona novo tema"_ → eu edito local + deploy

Claude Code já tem permissão pra rodar SSH/git/docker (ver `.claude/settings.json`).
