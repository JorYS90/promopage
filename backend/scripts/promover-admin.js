#!/usr/bin/env node
// Promove um usuário a super_admin via CLI.
// Uso: node scripts/promover-admin.js <email>
//
// Exemplo:
//   node scripts/promover-admin.js guadagnin_jp@hotmail.com
//
// Roles disponíveis: super_admin (1), admin (2), moderador (3), cliente (4)
// Por padrão, promove a super_admin. Pra outro role:
//   node scripts/promover-admin.js email@x.com admin

const path = require('path');
const db = require(path.join(__dirname, '..', 'src', 'db', 'schema'));

const email = process.argv[2];
const roleArg = process.argv[3] || 'super_admin';

if (!email) {
  console.error('Uso: node scripts/promover-admin.js <email> [role]');
  console.error('  role: super_admin (default), admin, moderador, cliente');
  process.exit(1);
}

// Mapeamento role nome → id
const ROLES = { super_admin: 1, admin: 2, moderador: 3, cliente: 4 };
const roleId = ROLES[roleArg];
if (!roleId) {
  console.error(`Role inválido: ${roleArg}`);
  console.error('Roles válidos:', Object.keys(ROLES).join(', '));
  process.exit(1);
}

const user = db.prepare('SELECT id, email, nome, role_id FROM users WHERE email = ?').get(email.toLowerCase());
if (!user) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}

const roleAtual = db.prepare('SELECT nome FROM roles WHERE id = ?').get(user.role_id);
const novoRole = db.prepare('SELECT nome FROM roles WHERE id = ?').get(roleId);

console.log(`User encontrado: #${user.id} ${user.nome} (${user.email})`);
console.log(`Role atual: ${roleAtual?.nome}`);
console.log(`Promovendo pra: ${novoRole?.nome}`);

db.prepare('UPDATE users SET role_id = ?, atualizado_em = ? WHERE id = ?')
  .run(roleId, new Date().toISOString(), user.id);

// Audit log
db.prepare(`
  INSERT INTO audit_logs (user_id, actor_id, acao, recurso, dados, criado_em)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  user.id, user.id, 'user.role_changed_cli', `user:${user.id}`,
  JSON.stringify({ de: roleAtual?.nome, para: novoRole?.nome, via: 'CLI' }),
  new Date().toISOString(),
);

// IMPORTANTE: revogar sessões existentes pra forçar re-login com novas permissões
const revogadas = db.prepare(`
  UPDATE sessions SET revogada_em = ? WHERE user_id = ? AND revogada_em IS NULL
`).run(new Date().toISOString(), user.id);

console.log(`✓ Role atualizado pra ${novoRole?.nome}`);
console.log(`✓ ${revogadas.changes} sessão(ões) revogada(s) — usuário precisa fazer LOGIN de novo pra refletir o novo role`);
