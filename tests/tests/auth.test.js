/**
 * Authentication Tests
 * Testa fluxo completo de autenticação do Sistema Luna
 */

const axios = require('axios');
const crypto = require('crypto');

const LUNACORE_URL = 'http://localhost:8080';

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
let createdToken = null;
let createdTenantId = null;

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
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return payload;
}

async function runTests() {
  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║     AUTHENTICATION TESTS               ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');

  const testEmail = `testauth_${Date.now()}@test.com`;
  const testPassword = 'Test@12345';

  // Test 1: Create First Admin (Tenant)
  await test('POST /auth/first-admin - Create tenant', async () => {
    const response = await axios.post(`${LUNACORE_URL}/auth/first-admin`, {
      companyName: 'Test Auth Company',
      ownerName: 'Test Owner',
      email: testEmail,
      password: testPassword
    });

    assert(response.status === 201, 'Expected status 201');
    assert(response.data.token, 'Expected token in response');
    assert(response.data.tenantId, 'Expected tenantId in response');
    
    createdToken = response.data.token;
    createdTenantId = response.data.tenantId;
    
    log(`    Tenant ID: ${createdTenantId}`, 'blue');
  });

  // Test 2: Decode JWT and validate claims
  await test('JWT Token - Validate structure and claims', async () => {
    assert(createdToken, 'Token should exist from previous test');
    
    const decoded = decodeJWT(createdToken);
    
    assert(decoded.sub, 'Token should have "sub" claim (user ID)');
    assert(decoded.role, 'Token should have "role" claim');
    assert(decoded.tenantId, 'Token should have "tenantId" claim');
    assert(decoded.modules, 'Token should have "modules" claim');
    assert(Array.isArray(decoded.modules), 'Modules should be an array');
    assert(decoded.modules.includes('TOTEM'), 'Modules should include TOTEM');
    assert(decoded.modules.includes('LUNAPAY'), 'Modules should include LUNAPAY');
    assert(decoded.iat, 'Token should have "iat" claim (issued at)');
    assert(decoded.exp, 'Token should have "exp" claim (expiration)');
    
    // Check role is OWNER
    assert(decoded.role === 'OWNER', `Expected role OWNER, got ${decoded.role}`);
    
    // Check tenantId matches
    assert(decoded.tenantId === createdTenantId, 'Token tenantId should match response tenantId');
    
    log(`    User ID: ${decoded.sub}`, 'blue');
    log(`    Role: ${decoded.role}`, 'blue');
    log(`    Modules: ${decoded.modules.join(', ')}`, 'blue');
  });

  // Test 3: Login with valid credentials
  await test('POST /auth/login - Login with valid credentials', async () => {
    const response = await axios.post(`${LUNACORE_URL}/auth/login`, {
      email: testEmail,
      password: testPassword
    });

    assert(response.status === 200, 'Expected status 200');
    assert(response.data.token, 'Expected token in response');
    
    const decoded = decodeJWT(response.data.token);
    assert(decoded.tenantId === createdTenantId, 'Login token should have same tenantId');
    
    log(`    Login successful for tenant: ${decoded.tenantId}`, 'blue');
  });

  // Test 4: Login with invalid password
  await test('POST /auth/login - Reject invalid password (401)', async () => {
    try {
      await axios.post(`${LUNACORE_URL}/auth/login`, {
        email: testEmail,
        password: 'WrongPassword123!'
      });
      throw new Error('Should have rejected invalid password');
    } catch (error) {
      assert(error.response?.status === 401, `Expected 401, got ${error.response?.status}`);
      log(`    Correctly rejected with 401`, 'blue');
    }
  });

  // Test 5: Login with non-existent user
  await test('POST /auth/login - Reject non-existent user (401)', async () => {
    try {
      await axios.post(`${LUNACORE_URL}/auth/login`, {
        email: 'nonexistent@test.com',
        password: testPassword
      });
      throw new Error('Should have rejected non-existent user');
    } catch (error) {
      assert(error.response?.status === 401, `Expected 401, got ${error.response?.status}`);
      log(`    Correctly rejected with 401`, 'blue');
    }
  });

  // Test 6: Use token to access protected endpoint
  await test('GET /me - Access protected endpoint with valid token', async () => {
    const response = await axios.get(`${LUNACORE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${createdToken}`
      }
    });

    assert(response.status === 200, 'Expected status 200');
    assert(response.data.id, 'Expected user data with id');
    assert(response.data.email === testEmail, `Expected email ${testEmail}`);
    
    log(`    User ID: ${response.data.id}`, 'blue');
    log(`    Email: ${response.data.email}`, 'blue');
  });

  // Test 7: Access protected endpoint without token
  await test('GET /me - Reject access without token (401)', async () => {
    try {
      await axios.get(`${LUNACORE_URL}/me`);
      throw new Error('Should have rejected request without token');
    } catch (error) {
      assert(error.response?.status === 401, `Expected 401, got ${error.response?.status}`);
      log(`    Correctly rejected with 401`, 'blue');
    }
  });

  // Test 8: Access protected endpoint with invalid token
  await test('GET /me - Reject access with invalid token (401)', async () => {
    try {
      await axios.get(`${LUNACORE_URL}/me`, {
        headers: {
          'Authorization': 'Bearer invalid.token.here'
        }
      });
      throw new Error('Should have rejected invalid token');
    } catch (error) {
      assert(error.response?.status === 401, `Expected 401, got ${error.response?.status}`);
      log(`    Correctly rejected with 401`, 'blue');
    }
  });

  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log(`Total: ${testsPassed + testsFailed} | Passed: ${testsPassed} | Failed: ${testsFailed}`, 'white');
  
  if (testsFailed === 0) {
    log('✓ ALL AUTHENTICATION TESTS PASSED', 'green');
    process.exit(0);
  } else {
    log('✗ SOME TESTS FAILED', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log(`\n✗ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});
