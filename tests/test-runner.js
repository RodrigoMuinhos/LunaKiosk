/**
 * Test Runner - Sistema Luna
 * Executa todos os testes de integração automaticamente
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

const tests = [
  { name: 'Authentication Tests', file: 'auth.test.js', critical: true },
  { name: 'Tenant Isolation Tests', file: 'tenant.test.js', critical: true },
  { name: 'Module Authorization Tests', file: 'modules.test.js', critical: true },
  { name: 'End-to-End Tests', file: 'e2e.test.js', critical: false }
];

async function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, 'tests', testFile);
    
    if (!fs.existsSync(testPath)) {
      log(`✗ Test file not found: ${testFile}`, 'red');
      resolve({ success: false, file: testFile, reason: 'File not found' });
      return;
    }
    
    const startTime = Date.now();
    const proc = spawn('node', [testPath], { shell: true });
    
    let output = '';
    let errors = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      errors += data.toString();
    });
    
    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        resolve({ 
          success: true, 
          file: testFile, 
          duration,
          output: output.trim()
        });
      } else {
        resolve({ 
          success: false, 
          file: testFile, 
          duration,
          error: errors.trim() || 'Test failed with non-zero exit code'
        });
      }
    });
  });
}

async function main() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   LUNA INTEGRATION TEST SUITE          ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    log(`\n[${tests.indexOf(test) + 1}/${tests.length}] Running: ${test.name}`, 'yellow');
    log(`File: ${test.file}`, 'blue');
    
    const result = await runTest(test.file);
    results.push({ ...result, ...test });
    
    if (result.success) {
      passed++;
      log(`✓ PASSED in ${result.duration}s`, 'green');
    } else {
      failed++;
      log(`✗ FAILED in ${result.duration || '?'}s`, 'red');
      if (result.error) {
        log(`  Error: ${result.error.substring(0, 200)}...`, 'red');
      }
      if (test.critical) {
        log('  ⚠️  CRITICAL TEST FAILED - Stopping execution', 'red');
        break;
      }
    }
  }
  
  // Summary
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║          TEST SUMMARY                  ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');
  
  log(`Total Tests: ${results.length}`, 'white');
  log(`✓ Passed: ${passed}`, 'green');
  log(`✗ Failed: ${failed}`, 'red');
  log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`, 'cyan');
  
  results.forEach((result) => {
    const icon = result.success ? '✓' : '✗';
    const color = result.success ? 'green' : 'red';
    const critical = result.critical ? ' [CRITICAL]' : '';
    log(`${icon} ${result.name}${critical} (${result.duration || '?'}s)`, color);
  });
  
  log('\n' + '='.repeat(50) + '\n', 'white');
  
  if (failed === 0) {
    log('🎉 ALL TESTS PASSED! System is healthy.', 'green');
    process.exit(0);
  } else {
    log('⚠️  SOME TESTS FAILED! Review output above.', 'red');
    process.exit(1);
  }
}

main();
