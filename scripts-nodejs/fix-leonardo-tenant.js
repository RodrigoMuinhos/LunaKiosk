// Corrigir tenantId do paciente Leonardo (de "default" para "totemlunavita")
const { Pool } = require('pg');

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_L0GZcyXNWGNJ@ep-silent-forest-a5ew3t4h.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const pool = new Pool({
    connectionString: NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Verificando paciente Leonardo...\n');

    // Verificar antes
    const before = await pool.query(`
      SELECT id, name, cpf, email, tenant_id, ghl_contact_id 
      FROM luna.patients 
      WHERE cpf = '02375330307' OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv'
    `);

    if (before.rows.length === 0) {
      console.log('❌ Paciente Leonardo não encontrado!');
      return;
    }

    console.log('📋 Estado ANTES:');
    console.table(before.rows);

    const currentTenantId = before.rows[0].tenant_id;

    if (currentTenantId === 'totemlunavita') {
      console.log('\n✅ Paciente já está com tenant_id correto: "totemlunavita"');
      return;
    }

    // Atualizar
    console.log(`\n🔧 Atualizando tenant_id de "${currentTenantId}" → "totemlunavita"...\n`);
    
    const result = await pool.query(`
      UPDATE luna.patients 
      SET tenant_id = 'totemlunavita'
      WHERE cpf = '02375330307' 
         OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv'
      RETURNING id, name, cpf, email, tenant_id, ghl_contact_id
    `);

    console.log('📋 Estado DEPOIS:');
    console.table(result.rows);

    console.log('\n✅ Paciente atualizado com sucesso!');
    console.log('\n💡 Agora o paciente Leonardo deve aparecer na interface do admin.');

  } catch (error) {
    console.error('❌ Erro ao atualizar paciente:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
