#!/usr/bin/env node
/**
 * Backup do banco SQLite (saas.db) — usa a API nativa do better-sqlite3
 * (`db.backup()`) que é consistente mesmo com escritas concorrentes (WAL).
 *
 * Como usar:
 *   node scripts/backup-db.js                  # backup em ./backups/saas-YYYYMMDD-HHmm.db
 *   node scripts/backup-db.js /caminho/dest    # backup pro destino customizado
 *
 * Cron sugerido (Linux):
 *   0 3 * * *  cd /app/backend && node scripts/backup-db.js >> logs/backup.log 2>&1
 *
 * Retenção: mantém os últimos 14 backups locais. Antigos são removidos.
 * Pra prod robusto, sincronize ./backups com S3/B2/rclone num passo seguinte.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, '..', 'data', 'saas.db');
const BACKUP_DIR = process.argv[2] || path.join(__dirname, '..', 'backups');
const RETENCAO = 14;  // mantém últimos N backups

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Banco não existe: ${DB_FILE}`);
    process.exit(1);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const destino = path.join(BACKUP_DIR, `saas-${timestamp()}.db`);
  console.log(`→ Fazendo backup de ${DB_FILE}`);
  console.log(`  destino: ${destino}`);

  const db = new Database(DB_FILE, { readonly: false });
  // better-sqlite3 expõe db.backup(dest) que é uma cópia consistente do WAL.
  await db.backup(destino);
  db.close();

  const stat = fs.statSync(destino);
  console.log(`✓ Backup concluído: ${(stat.size / 1024).toFixed(1)} KB`);

  // Limpa backups antigos (mantém últimos RETENCAO)
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('saas-') && f.endsWith('.db'))
    .map(f => ({ nome: f, caminho: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  if (backups.length > RETENCAO) {
    const antigos = backups.slice(RETENCAO);
    for (const b of antigos) {
      fs.unlinkSync(b.caminho);
      console.log(`  ✕ removido (antigo): ${b.nome}`);
    }
  }

  console.log(`✓ ${Math.min(backups.length, RETENCAO)} backup(s) preservado(s) em ${BACKUP_DIR}`);
}

main().catch(err => {
  console.error('❌ Falha no backup:', err.message);
  process.exit(1);
});
