#!/usr/bin/env node
/**
 * Script para criar usuário de serviço do TOTEM
 * Email: totem@lunavita.com.br
 * Password: totem123
 * Role: RECEPCAO (acesso limitado)
 */

require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Configuração do banco - pegar do ambiente ou hardcoded
const connectionString = process.env.NEON_TOTEMAPI_URL || process.env.SPRING_DATASOURCE_URL || 
  'postgresql://luna_owner:BEQOLMQwu8dn@ep-lingering-paper-adck7igg-pooler.us-west-2.aws.neon.tech/luna';

// Parse manual da connection string para evitar problemas com SSL
let config;
const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/([^\?]+)/);
if (match) {
  config = {
    user: match[1],
    password: match[2],
    host: match[3],
    database: match[4],
    ssl: { rejectUnauthorized: false },
    port: 5432
  };
} else {
  config = {
    connectionString,
    ssl: { rejectUnauthorized: false }
  };
}

const TOTEM_USER = {
  email: 'totem@lunavita.com.br',
  name: 'Usuário Totem',
  cpf: '00000000000', // CPF fictício
  password: 'totem123',
  role: 'RECEPCAO',
  tenantId: 'default'
};

async function main() {
  const client = new Client(config);
  
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado!');

    // Verificar se usuário já existe
    console.log(`\n🔍 Verificando usuário: ${TOTEM_USER.email}`);
    const checkQuery = 'SELECT id, email, role FROM luna.users WHERE email = $1';
    const checkResult = await client.query(checkQuery, [TOTEM_USER.email]);

    if (checkResult.rows.length > 0) {
      const existingUser = checkResult.rows[0];
      console.log('⚠️  Usuário já existe:');
      console.log(JSON.stringify(existingUser, null, 2));
      
      // Atualizar senha para garantir que está correta
      console.log('\n🔄 Atualizando senha...');
      const hashedPassword = await bcrypt.hash(TOTEM_USER.password, 10);
      const updateQuery = `
        UPDATE luna.users 
        SET password = $1, updated_at = NOW()
        WHERE email = $2
        RETURNING id, email, name, role
      `;
      const updateResult = await client.query(updateQuery, [hashedPassword, TOTEM_USER.email]);
      console.log('✅ Senha atualizada:');
      console.log(JSON.stringify(updateResult.rows[0], null, 2));
      
    } else {
      // Criar novo usuário
      console.log('➕ Criando novo usuário...');
      const hashedPassword = await bcrypt.hash(TOTEM_USER.password, 10);
      
      const insertQuery = `
        INSERT INTO luna.users (email, name, cpf, password, role, tenant_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, email, name, cpf, role, tenant_id, created_at
      `;
      
      const insertResult = await client.query(insertQuery, [
        TOTEM_USER.email,
        TOTEM_USER.name,
        TOTEM_USER.cpf,
        hashedPassword,
        TOTEM_USER.role,
        TOTEM_USER.tenantId
      ]);
      
      console.log('✅ Usuário criado com sucesso:');
      console.log(JSON.stringify(insertResult.rows[0], null, 2));
    }

    // Testar login
    console.log('\n🧪 Testando login...');
    const testQuery = 'SELECT id, email, name, role, password FROM luna.users WHERE email = $1';
    const testResult = await client.query(testQuery, [TOTEM_USER.email]);
    
    if (testResult.rows.length > 0) {
      const user = testResult.rows[0];
      const passwordMatch = await bcrypt.compare(TOTEM_USER.password, user.password);
      
      if (passwordMatch) {
        console.log('✅ Login validado com sucesso!');
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Password: ${TOTEM_USER.password}`);
      } else {
        console.log('❌ Senha não confere!');
        process.exit(1);
      }
    }

    // Mostrar credenciais finais
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║           CREDENCIAIS DO TOTEM CONFIGURADAS           ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📧 Email:    totem@lunavita.com.br');
    console.log('🔑 Password: totem123');
    console.log('👤 Role:     RECEPCAO');
    console.log('');
    console.log('✅ O TotemUI agora deve fazer auto-login com sucesso!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
