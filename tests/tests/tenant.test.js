/**
 * Tenant Isolation Tests
 * Verifica isolamento multi-tenant no Sistema Luna
 */

const axios = require('axios');
const { Client } = require('pg');

const LUNACORE_URL = 'http://localhost:8080';

const DB_CONFIG = {
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'lunadb',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  port: Number(process.env.PGPORT || 5432)
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

let testsPassed = 0;
let testsFailed = 0;

// Store tenant data
const tenant1 = {};
const tenant2 = {};

async function test(name, fn) {
  try {
    log(`\n→ Testing: ${name}`, 'cyan');
    await fn();
    testsPassed++;
    log(`  ✓ PASSED`, 'green');
  } catch (error) {
    testsFailed++;
    log(`  ✗ FAILED: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`    Response: ${JSON.stringify(error.response.data)}`, 'red');
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  return JSON.parse(Buffer.from(parts[1], 'base64').toString());
}

async function runTests() {
  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║    TENANT ISOLATION TESTS              ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');

  const timestamp = Date.now();

  // Test 1: Create Tenant 1
  await test('Create Tenant 1', async () => {
    const response = await axios.post(`${LUNACORE_URL}/auth/first-admin`, {
      companyName: `Tenant1_${timestamp}`,
      ownerName: 'Owner One',
      email: `tenant1_${timestamp}@test.com`,
      password: 'Test@12345'
    });

    assert(response.status === 201, 'Expected status 201');
    assert(response.data.token, 'Expected token');
    assert(response.data.tenantId, 'Expected tenantId');

    tenant1.id = response.data.tenantId;
    tenant1.token = response.data.token;
    tenant1.email = `tenant1_${timestamp}@test.com`;
    
    const decoded = decodeJWT(tenant1.token);
    tenant1.userId = decoded.sub;

    log(`    Tenant 1 ID: ${tenant1.id}`, 'blue');
    log(`    User 1 ID: ${tenant1.userId}`, 'blue');
  });

  // Test 2: Create Tenant 2
  await test('Create Tenant 2', async () => {
    const response = await axios.post(`${LUNACORE_URL}/auth/first-admin`, {
      companyName: `Tenant2_${timestamp}`,
      ownerName: 'Owner Two',
      email: `tenant2_${timestamp}@test.com`,
      password: 'Test@12345'
    });

    assert(response.status === 201, 'Expected status 201');
    assert(response.data.token, 'Expected token');
    assert(response.data.tenantId, 'Expected tenantId');

    tenant2.id = response.data.tenantId;
    tenant2.token = response.data.token;
    tenant2.email = `tenant2_${timestamp}@test.com`;
    
    const decoded = decodeJWT(tenant2.token);
    tenant2.userId = decoded.sub;

    log(`    Tenant 2 ID: ${tenant2.id}`, 'blue');
    log(`    User 2 ID: ${tenant2.userId}`, 'blue');
  });

  // Test 3: Verify tenants have different IDs
  await test('Verify tenants have unique IDs', async () => {
    assert(tenant1.id !== tenant2.id, 'Tenant IDs should be different');
    log(`    Tenant 1: ${tenant1.id}`, 'blue');
    log(`    Tenant 2: ${tenant2.id}`, 'blue');
  });

  // Test 4: Verify tokens have different tenantIds
  await test('Verify tokens contain correct tenantIds', async () => {
    const decoded1 = decodeJWT(tenant1.token);
    const decoded2 = decodeJWT(tenant2.token);

    assert(decoded1.tenantId === tenant1.id, 'Token 1 should have correct tenantId');
    assert(decoded2.tenantId === tenant2.id, 'Token 2 should have correct tenantId');
    assert(decoded1.tenantId !== decoded2.tenantId, 'Tokens should have different tenantIds');
    
    log(`    Token 1 tenantId: ${decoded1.tenantId}`, 'blue');
    log(`    Token 2 tenantId: ${decoded2.tenantId}`, 'blue');
  });

  // Test 5: Database-level tenant isolation
  await test('Database: Verify tenant isolation in database', async () => {
    const client = new Client(DB_CONFIG);
    await client.connect();

    try {
      // Query users for tenant 1
      const result1 = await client.query(
        `SELECT id, name, email FROM luna.users WHERE tenant_id = $1`,
        [tenant1.id]
      );

      // Query users for tenant 2
      const result2 = await client.query(
        `SELECT id, name, email FROM luna.users WHERE tenant_id = $1`,
        [tenant2.id]
      );

      assert(result1.rows.length > 0, 'Tenant 1 should have users');
      assert(result2.rows.length > 0, 'Tenant 2 should have users');

      // Verify no overlap
      const tenant1UserIds = result1.rows.map(r => r.id);
      const tenant2UserIds = result2.rows.map(r => r.id);
      
      const overlap = tenant1UserIds.filter(id => tenant2UserIds.includes(id));
      assert(overlap.length === 0, 'Tenants should not share users');

      log(`    Tenant 1 users: ${result1.rows.length}`, 'blue');
      log(`    Tenant 2 users: ${result2.rows.length}`, 'blue');
      log(`    No user overlap confirmed`, 'blue');
    } finally {
      await client.end();
    }
  });

  // Test 6: API-level isolation - Tenant 1 token cannot access Tenant 2 data
  await test('API: Tenant 1 token returns only Tenant 1 data', async () => {
    const response = await axios.get(`${LUNACORE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${tenant1.token}` }
    });

    assert(response.status === 200, 'Expected status 200');
    assert(response.data.email === tenant1.email, 'Should return Tenant 1 user');
    assert(response.data.email !== tenant2.email, 'Should not return Tenant 2 user');
    
    log(`    Returned email: ${response.data.email}`, 'blue');
    log(`    Isolation confirmed`, 'blue');
  });

  // Test 7: API-level isolation - Tenant 2 token cannot access Tenant 1 data
  await test('API: Tenant 2 token returns only Tenant 2 data', async () => {
    const response = await axios.get(`${LUNACORE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${tenant2.token}` }
    });

    assert(response.status === 200, 'Expected status 200');
    assert(response.data.email === tenant2.email, 'Should return Tenant 2 user');
    assert(response.data.email !== tenant1.email, 'Should not return Tenant 1 user');
    
    log(`    Returned email: ${response.data.email}`, 'blue');
    log(`    Isolation confirmed`, 'blue');
  });

  // Test 8: Database-level license isolation
  await test('Database: Verify license isolation', async () => {
    const client = new Client(DB_CONFIG);
    await client.connect();

    try {
      // Query licenses for both tenants
      const result1 = await client.query(
        `SELECT id, license_key FROM luna.licenses WHERE tenant_id = $1`,
        [tenant1.id]
      );

      const result2 = await client.query(
        `SELECT id, license_key FROM luna.licenses WHERE tenant_id = $1`,
        [tenant2.id]
      );

      assert(result1.rows.length > 0, 'Tenant 1 should have licenses');
      assert(result2.rows.length > 0, 'Tenant 2 should have licenses');

      // Verify different license keys
      const key1 = result1.rows[0].license_key;
      const key2 = result2.rows[0].license_key;
      
      assert(key1 !== key2, 'Tenants should have different license keys');

      log(`    Tenant 1 license: ${key1.substring(0, 20)}...`, 'blue');
      log(`    Tenant 2 license: ${key2.substring(0, 20)}...`, 'blue');
      log(`    License isolation confirmed`, 'blue');
    } finally {
      await client.end();
    }
  });

  // Test 9: Database-level module isolation
  await test('Database: Verify module isolation', async () => {
    const client = new Client(DB_CONFIG);
    await client.connect();

    try {
      // Get license IDs
      const licenseResult1 = await client.query(
        `SELECT id FROM luna.licenses WHERE tenant_id = $1 LIMIT 1`,
        [tenant1.id]
      );
      const licenseResult2 = await client.query(
        `SELECT id FROM luna.licenses WHERE tenant_id = $1 LIMIT 1`,
        [tenant2.id]
      );

      const license1Id = licenseResult1.rows[0].id;
      const license2Id = licenseResult2.rows[0].id;

      // Query modules for both licenses
      const modules1 = await client.query(
        `SELECT module_code, enabled FROM luna.license_modules WHERE license_id = $1`,
        [license1Id]
      );
      const modules2 = await client.query(
        `SELECT module_code, enabled FROM luna.license_modules WHERE license_id = $1`,
        [license2Id]
      );

      assert(modules1.rows.length > 0, 'Tenant 1 should have modules');
      assert(modules2.rows.length > 0, 'Tenant 2 should have modules');

      // Verify both have TOTEM and LUNAPAY
      const tenant1Modules = modules1.rows.map(m => m.module_code);
      const tenant2Modules = modules2.rows.map(m => m.module_code);

      assert(tenant1Modules.includes('TOTEM'), 'Tenant 1 should have TOTEM');
      assert(tenant1Modules.includes('LUNAPAY'), 'Tenant 1 should have LUNAPAY');
      assert(tenant2Modules.includes('TOTEM'), 'Tenant 2 should have TOTEM');
      assert(tenant2Modules.includes('LUNAPAY'), 'Tenant 2 should have LUNAPAY');

      log(`    Tenant 1 modules: ${tenant1Modules.join(', ')}`, 'blue');
      log(`    Tenant 2 modules: ${tenant2Modules.join(', ')}`, 'blue');
      log(`    Module isolation confirmed`, 'blue');
    } finally {
      await client.end();
    }
  });

  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log(`Total: ${testsPassed + testsFailed} | Passed: ${testsPassed} | Failed: ${testsFailed}`, 'white');
  
  if (testsFailed === 0) {
    log('✓ ALL TENANT ISOLATION TESTS PASSED', 'green');
    process.exit(0);
  } else {
    log('✗ SOME TESTS FAILED', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log(`\n✗ Test runner error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
