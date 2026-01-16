// Verificar todos os pacientes no banco
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_pJyUdpP9cYCR@ep-silent-forest-a5ew3t4h.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Buscando TODOS os pacientes...\n');

    const result = await pool.query(`
      SELECT id, name, cpf, email, tenant_id, ghl_contact_id, created_at
      FROM luna.patients 
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`📊 Total encontrado: ${result.rows.length}\n`);
    console.table(result.rows);

    console.log('\n🔍 Procurando Leonardo especificamente...\n');
    
    const leonardo = await pool.query(`
      SELECT id, name, cpf, email, tenant_id, ghl_contact_id
      FROM luna.patients 
      WHERE name ILIKE '%leonardo%' 
         OR cpf LIKE '%023753%'
         OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv'
    `);

    if (leonardo.rows.length > 0) {
      console.log('✅ Leonardo encontrado:');
      console.table(leonardo.rows);
    } else {
      console.log('❌ Leonardo NÃO encontrado no banco!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

main();
