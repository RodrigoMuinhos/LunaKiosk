/**
 * End-to-End Integration Tests
 * Testa fluxo completo do usuário através de todos os serviços
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const LUNACORE_URL = 'http://localhost:8080';
const TOTEMAPI_URL = 'http://localhost:8081';
const LUNAPAY_URL = 'http://localhost:8082';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

let testsPassed = 0;
let testsFailed = 0;

// Store created resources
const tenant = {};
const doctor = {};
const patient = {};
const payment = {};

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
  log('\n╔════════════════════════════════════════╗', 'magenta');
  log('║     END-TO-END INTEGRATION TESTS       ║', 'magenta');
  log('╚════════════════════════════════════════╝', 'magenta');

  const timestamp = Date.now();
  const testEmail = `e2e_${timestamp}@test.com`;

  // ========================================
  // PHASE 1: TENANT SETUP (LunaCore)
  // ========================================
  log('\n📋 PHASE 1: Tenant Setup', 'yellow');

  await test('1.1 Create tenant account', async () => {
    const response = await axios.post(`${LUNACORE_URL}/auth/first-admin`, {
      companyName: `E2E Company ${timestamp}`,
      ownerName: 'E2E Owner',
      email: testEmail,
      password: 'Test@12345'
    });

    assert(response.status === 201, 'Expected status 201');
    assert(response.data.token, 'Expected token');
    assert(response.data.tenantId, 'Expected tenantId');

    tenant.id = response.data.tenantId;
    tenant.token = response.data.token;
    tenant.email = testEmail;

    const decoded = decodeJWT(tenant.token);
    tenant.userId = decoded.sub;

    log(`    Tenant ID: ${tenant.id}`, 'blue');
    log(`    Owner ID: ${tenant.userId}`, 'blue');
    log(`    Token expires: ${new Date(decoded.exp * 1000).toLocaleString()}`, 'blue');
  });

  await test('1.2 Verify tenant has required modules', async () => {
    const decoded = decodeJWT(tenant.token);
    
    assert(decoded.modules.includes('TOTEM'), 'Should have TOTEM module');
    assert(decoded.modules.includes('LUNAPAY'), 'Should have LUNAPAY module');

    log(`    Modules: ${decoded.modules.join(', ')}`, 'blue');
  });

  // ========================================
  // PHASE 2: DOCTOR MANAGEMENT (TotemAPI)
  // ========================================
  log('\n👨‍⚕️ PHASE 2: Doctor Management', 'yellow');

  await test('2.1 Create doctor in TotemAPI', async () => {
    const response = await axios.post(`${TOTEMAPI_URL}/api/doctors`, {
      name: `Dr. E2E ${timestamp}`,
      specialty: 'Cardiologist',
      crm: `CRM${timestamp}`,
      email: `doctor_${timestamp}@clinic.com`,
      phone: '11999999999'
    }, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });

    assert(response.status === 200 || response.status === 201, 'Expected 200 or 201');
    assert(response.data.id, 'Expected doctor ID');

    doctor.id = response.data.id;
    doctor.name = response.data.name;

    log(`    Doctor ID: ${doctor.id}`, 'blue');
    log(`    Doctor Name: ${doctor.name}`, 'blue');
  });

  await test('2.2 List doctors (verify creation)', async () => {
    const response = await axios.get(`${TOTEMAPI_URL}/api/doctors`, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });

    assert(response.status === 200, 'Expected status 200');
    assert(Array.isArray(response.data), 'Expected array of doctors');
    
    const createdDoctor = response.data.find(d => d.id === doctor.id);
    assert(createdDoctor, 'Created doctor should be in list');

    log(`    Total doctors: ${response.data.length}`, 'blue');
    log(`    Created doctor found in list`, 'blue');
  });

  // ========================================
  // PHASE 3: PATIENT MANAGEMENT (TotemAPI)
  // ========================================
  log('\n🏥 PHASE 3: Patient Management', 'yellow');

  await test('3.1 Create patient in TotemAPI', async () => {
    const response = await axios.post(`${TOTEMAPI_URL}/api/patients`, {
      name: `Patient E2E ${timestamp}`,
      cpf: `${timestamp}`.padStart(11, '0'),
      email: `patient_${timestamp}@email.com`,
      phone: '11988888888',
      birthDate: '1990-01-01'
    }, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });

    assert(response.status === 200 || response.status === 201, 'Expected 200 or 201');
    assert(response.data.id, 'Expected patient ID');

    patient.id = response.data.id;
    patient.name = response.data.name;

    log(`    Patient ID: ${patient.id}`, 'blue');
    log(`    Patient Name: ${patient.name}`, 'blue');
  });

  await test('3.2 Upload patient video (if supported)', async () => {
    // This test is optional - depends on TotemAPI supporting video upload
    try {
      // Create a test file (1KB dummy file)
      const testFilePath = path.join(__dirname, 'test-video.txt');
      fs.writeFileSync(testFilePath, 'Test video content for E2E test');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFilePath));
      formData.append('patientId', patient.id);

      const response = await axios.post(
        `${TOTEMAPI_URL}/api/videos/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${tenant.token}`
          }
        }
      );

      // Clean up test file
      fs.unlinkSync(testFilePath);

      assert(response.status === 200 || response.status === 201, 'Expected 200 or 201');
      log(`    Video upload successful`, 'blue');
    } catch (error) {
      if (error.response?.status === 404) {
        log(`    Video upload endpoint not available (404) - skipping`, 'yellow');
      } else if (error.code === 'ENOENT') {
        log(`    Could not create test file - skipping`, 'yellow');
      } else {
        throw error;
      }
    }
  });

  // ========================================
  // PHASE 4: PAYMENT PROCESSING (LunaPay)
  // ========================================
  log('\n💳 PHASE 4: Payment Processing', 'yellow');

  await test('4.1 Create payment in LunaPay', async () => {
    const response = await axios.post(`${LUNAPAY_URL}/api/payments`, {
      patientId: patient.id,
      amount: 150.00,
      description: 'Consulta médica - E2E Test',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });

    assert(response.status === 200 || response.status === 201, 'Expected 200 or 201');
    assert(response.data.id, 'Expected payment ID');

    payment.id = response.data.id;
    payment.amount = response.data.amount;

    log(`    Payment ID: ${payment.id}`, 'blue');
    log(`    Amount: R$ ${payment.amount}`, 'blue');
  });

  await test('4.2 List payments (verify creation)', async () => {
    const response = await axios.get(`${LUNAPAY_URL}/api/payments`, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });

    assert(response.status === 200, 'Expected status 200');
    assert(Array.isArray(response.data), 'Expected array of payments');

    const createdPayment = response.data.find(p => p.id === payment.id);
    assert(createdPayment, 'Created payment should be in list');

    log(`    Total payments: ${response.data.length}`, 'blue');
    log(`    Created payment found in list`, 'blue');
  });

  // ========================================
  // PHASE 5: CROSS-SERVICE VALIDATION
  // ========================================
  log('\n🔄 PHASE 5: Cross-Service Validation', 'yellow');

  await test('5.1 Verify tenant isolation (create second tenant)', async () => {
    const tenant2Email = `e2e_tenant2_${timestamp}@test.com`;
    
    const response = await axios.post(`${LUNACORE_URL}/auth/first-admin`, {
      companyName: `E2E Company 2 ${timestamp}`,
      ownerName: 'E2E Owner 2',
      email: tenant2Email,
      password: 'Test@12345'
    });

    const tenant2Token = response.data.token;

    // Tenant 2 should not see Tenant 1's doctors
    const doctorsResponse = await axios.get(`${TOTEMAPI_URL}/api/doctors`, {
      headers: { 'Authorization': `Bearer ${tenant2Token}` }
    });

    const tenant2Doctors = doctorsResponse.data;
    const hasOurDoctor = tenant2Doctors.some(d => d.id === doctor.id);

    assert(!hasOurDoctor, 'Tenant 2 should not see Tenant 1 doctors');

    log(`    Tenant 2 created`, 'blue');
    log(`    Tenant isolation confirmed (no data leak)`, 'blue');
  });

  await test('5.2 Verify token reuse across all services', async () => {
    // Same token should work on all 3 services
    
    // LunaCore
    const coreResponse = await axios.get(`${LUNACORE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });
    assert(coreResponse.status === 200, 'LunaCore should accept token');

    // TotemAPI
    const totemResponse = await axios.get(`${TOTEMAPI_URL}/api/doctors`, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });
    assert(totemResponse.status === 200, 'TotemAPI should accept token');

    // LunaPay
    const payResponse = await axios.get(`${LUNAPAY_URL}/api/payments`, {
      headers: { 'Authorization': `Bearer ${tenant.token}` }
    });
    assert(payResponse.status === 200, 'LunaPay should accept token');

    log(`    ✓ LunaCore accepted token`, 'blue');
    log(`    ✓ TotemAPI accepted token`, 'blue');
    log(`    ✓ LunaPay accepted token`, 'blue');
  });

  await test('5.3 Complete user journey summary', async () => {
    // Verify all created resources exist
    assert(tenant.id, 'Tenant created');
    assert(doctor.id, 'Doctor created');
    assert(patient.id, 'Patient created');
    assert(payment.id, 'Payment created');

    log(`    ✓ Tenant: ${tenant.id}`, 'blue');
    log(`    ✓ Doctor: ${doctor.id}`, 'blue');
    log(`    ✓ Patient: ${patient.id}`, 'blue');
    log(`    ✓ Payment: ${payment.id}`, 'blue');
    log(`    Complete user journey validated`, 'blue');
  });

  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log(`Total: ${testsPassed + testsFailed} | Passed: ${testsPassed} | Failed: ${testsFailed}`, 'white');
  
  if (testsFailed === 0) {
    log('✓ ALL END-TO-END TESTS PASSED', 'green');
    log('\n🎉 COMPLETE SYSTEM INTEGRATION VALIDATED', 'magenta');
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
