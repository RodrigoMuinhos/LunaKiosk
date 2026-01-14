# Sistema Luna - Test Suite

Complete integration test suite for the Luna System (LunaCore, TotemAPI, LunaPay).

## Prerequisites

- Node.js installed
- All 3 services running:
  - LunaCore: http://localhost:8080
  - TotemAPI: http://localhost:8081
  - LunaPay: http://localhost:8082
- PostgreSQL Neon database accessible

## Installation

```bash
cd tests
npm install
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Individual Test Suites

**Authentication Tests:**
```bash
npm run test:auth
```

**Tenant Isolation Tests:**
```bash
npm run test:tenant
```

**Module Authorization Tests:**
```bash
npm run test:modules
```

**End-to-End Integration Tests:**
```bash
npm run test:e2e
```

## Test Coverage

### 1. Authentication Tests (`auth.test.js`)
- ✅ Tenant creation via `/auth/first-admin`
- ✅ JWT token structure and claims validation
- ✅ Login with valid credentials
- ✅ Rejection of invalid passwords (401)
- ✅ Rejection of non-existent users (401)
- ✅ Protected endpoint access with valid token
- ✅ Rejection without token (401)
- ✅ Rejection with invalid token (401)

### 2. Tenant Isolation Tests (`tenant.test.js`)
- ✅ Create multiple tenants
- ✅ Verify unique tenant IDs
- ✅ Verify correct tenantIds in tokens
- ✅ Database-level user isolation
- ✅ API-level data isolation (Tenant A cannot see Tenant B)
- ✅ License isolation verification
- ✅ Module isolation verification

### 3. Module Authorization Tests (`modules.test.js`)
- ✅ Token contains TOTEM and LUNAPAY modules
- ✅ TotemAPI accepts token with TOTEM module
- ✅ LunaPay accepts token with LUNAPAY module
- ✅ TotemAPI rejects requests without token
- ✅ LunaPay rejects requests without token
- ✅ Cross-service token sharing (same token on all 3 services)

### 4. End-to-End Tests (`e2e.test.js`)
- ✅ **Phase 1:** Tenant creation and setup
- ✅ **Phase 2:** Doctor management (create, list)
- ✅ **Phase 3:** Patient management (create, upload video)
- ✅ **Phase 4:** Payment processing (create, list)
- ✅ **Phase 5:** Cross-service validation (isolation, token reuse)

## Test Output

Each test suite provides colored console output:
- 🟢 Green: Test passed
- 🔴 Red: Test failed
- 🟡 Yellow: Test section headers
- 🔵 Blue: Test details and data
- 🟦 Cyan: Test names and summary

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## CI/CD Integration

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: |
    cd tests
    npm install
    npm test
```

## Troubleshooting

### Services Not Running
If tests fail with connection errors:
1. Verify all 3 services are running
2. Check ports: 8080, 8081, 8082
3. Verify database connectivity

### Database Connection Issues
If tenant isolation tests fail:
1. Check Neon database credentials in `tenant.test.js`
2. Verify `luna` schema exists
3. Ensure tables are created (tenants, users, licenses, license_modules)

### Token Validation Failures
If module tests fail:
1. Verify JWT_SECRET is the same across all services
2. Check that AuthService creates modules by default
3. Verify JwtAuthenticationFilter in each service checks correct module

## Architecture

```
tests/
├── package.json          # Dependencies and scripts
├── test-runner.js        # Orchestrates all test suites
├── README.md            # This file
└── tests/
    ├── auth.test.js     # Authentication tests
    ├── tenant.test.js   # Tenant isolation tests
    ├── modules.test.js  # Module authorization tests
    └── e2e.test.js      # End-to-end integration tests
```

## Test Data

Tests create temporary data with timestamps to avoid conflicts:
- Email format: `testXXXX_<timestamp>@test.com`
- Company names: `TestCompany_<timestamp>`
- All test data is isolated per tenant

## Notes

- Tests are **non-destructive** (create new data, don't modify existing)
- Each test suite is **independent** (can run separately)
- Tests include both **positive and negative cases**
- Database queries verify **multi-tenant isolation**
- Cross-service tests validate **JWT token sharing**

## Support

For issues or questions:
1. Check test output for specific error messages
2. Verify service logs (LunaCore, TotemAPI, LunaPay)
3. Review API_DOCUMENTATION.md for endpoint details
4. Consult ONBOARDING_GUIDE.md for setup instructions
