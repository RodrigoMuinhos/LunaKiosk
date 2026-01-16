#!/usr/bin/env node
/**
 * Script SIMPLIFICADO para criar usuário de serviço do TOTEM
 * USAGE: node criar-usuario-totem-simples.js
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Credentials - AJUSTE AQUI se necessário
const DB_CONFIG = {
  user: 'neondb_owner',
  password: 'npg_8ILmFPEdxr5J',
  host: 'ep-lingering-paper-adck7igg-pooler.c-2.us-east-1.aws.neon.tech',
  database: 'neondb',
  port: 5432,
  ssl: { rejectUnauthorized: false }
};

const TOTEM_USER = {
  email: 'totem@lunavita.com.br',
  name: 'Usuário Totem',
  cpf: '00000000000',
  password: 'totem123',
  role: 'RECEPCAO',
  tenantId: 'default'
};

async function main() {
  const client = new Client(DB_CONFIG);
  
  try {
    console.log('🔌 Conectando ao banco...');
    await client.connect();
    console.log('✅ Conectado!');

    // Set schema
    await client.query('SET search_path TO luna');

    // Hash da senha
    console.log('\n🔐 Gerando hash da senha...');
    const hashedPassword = await bcrypt.hash(TOTEM_USER.password, 10);
    console.log(`Hash: ${hashedPassword.substring(0, 20)}...`);

    // Deletar usuário existente
    console.log(`\n🗑️  Removendo usuário existente (se houver)...`);
    await client.query('DELETE FROM luna.totem_users WHERE email = $1', [TOTEM_USER.email]);

    // Criar novo usuário
    console.log('➕ Criando novo usuário...');
    const insertQuery = `
      INSERT INTO luna.totem_users (email, password_hash, role, cpf, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, email, role, cpf, created_at
    `;
    
    const result = await client.query(insertQuery, [
      TOTEM_USER.email,
      hashedPassword,
      TOTEM_USER.role,
      TOTEM_USER.cpf
    ]);

    console.log('✅ Usuário criado:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    // Testar senha
    console.log('\n🧪 Testando senha...');
    const testQuery = 'SELECT password_hash FROM luna.totem_users WHERE email = $1';
    const testResult = await client.query(testQuery, [TOTEM_USER.email]);
    const passwordMatch = await bcrypt.compare(TOTEM_USER.password, testResult.rows[0].password_hash);
    
    if (passwordMatch) {
      console.log('✅ Senha verificada com sucesso!');
    } else {
      console.log('❌ ERRO: Senha não confere!');
      process.exit(1);
    }

    // Resultado final
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║           CREDENCIAIS DO TOTEM CONFIGURADAS           ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📧 Email:    totem@lunavita.com.br');
    console.log('🔑 Password: totem123');
    console.log('👤 Role:     RECEPCAO');
    console.log('');
    console.log('✅ TotemUI deve fazer auto-login agora!');
    console.log('');
    console.log('Para testar:');
    console.log('  1. http://localhost:3000');
    console.log('  2. Abrir DevTools (F12)');
    console.log('  3. Procurar por [TOTEM AUTO-LOGIN] nos logs');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Dica: Verifique a URL do banco de dados');
    } else if (error.code === '28P01') {
      console.error('\n💡 Dica: Senha incorreta. Ajuste DB_CONFIG.password no script');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
