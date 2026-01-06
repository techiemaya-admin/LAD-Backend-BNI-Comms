# Follow-Up Call System - Testing Guide

## Test Suite Overview

Comprehensive test coverage for the follow-up call scheduling and execution system.

## Test Files

### 1. Unit Tests

#### `followUpScheduler.test.js`
Tests scheduling logic and Cloud Tasks integration:
- ✅ Schedule follow-up call successfully
- ✅ Generate deterministic idempotency keys
- ✅ Skip scheduling for non-qualifying booking types
- ✅ Handle Cloud Tasks disabled scenario
- ✅ Schedule immediately for past dates
- ✅ Handle Cloud Tasks API errors
- ✅ Validate required parameters
- ✅ Handle duplicate tasks (idempotency)
- ✅ Cancel scheduled tasks
- ✅ Prevent cancellation of executed tasks

#### `followUpExecution.test.js`
Tests execution logic and transaction safety:
- ✅ Execute follow-up call successfully
- ✅ Enforce idempotency - reject duplicates
- ✅ Enforce idempotency - detect key mismatch
- ✅ Rollback transaction on voice agent failure
- ✅ Fail if lead phone number missing
- ✅ Fail if booking not found
- ✅ Validate required parameters
- ✅ Handle database connection errors
- ✅ Release client on errors

#### `bookingsController.test.js`
Tests API endpoints and authentication:
- ✅ Reject requests without Cloud Tasks headers
- ✅ Accept requests with valid Cloud Tasks headers
- ✅ Require taskname header
- ✅ Require queuename header
- ✅ Handle execution errors
- ✅ Validate required fields
- ✅ Cancel follow-up calls
- ✅ Handle cancellation errors

### 2. Integration Tests

#### `integration.test.js`
End-to-end workflow testing:
- ✅ Complete workflow: schedule → execute → verify idempotency
- ✅ Cancellation workflow
- ✅ Execution failure with missing phone number
- ✅ Database state verification at each step
- ✅ Voice agent interaction verification

## Running Tests

### Install Dependencies
```bash
cd /Users/naveenreddy/Desktop/AI-Maya/LAD/backend
npm install --save-dev jest supertest @types/jest
```

### Configure Jest
Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest --testPathPattern=features/deals-pipeline/tests",
    "test:watch": "jest --watch --testPathPattern=features/deals-pipeline/tests",
    "test:coverage": "jest --coverage --testPathPattern=features/deals-pipeline/tests",
    "test:integration": "jest --testPathPattern=features/deals-pipeline/tests/integration.test.js"
  },
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterEnv": ["<rootDir>/features/deals-pipeline/tests/setup.js"],
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "features/deals-pipeline/**/*.js",
      "!features/deals-pipeline/tests/**",
      "!features/deals-pipeline/index.js"
    ],
    "testMatch": [
      "**/tests/**/*.test.js"
    ],
    "verbose": true
  }
}
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- followUpScheduler.test.js
```

### Run With Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

## Test Database Setup

For integration tests, set up a test database:

```bash
# Create test database
psql -U postgres -c "CREATE DATABASE lad_test;"

# Run migrations
psql -U postgres -d lad_test -f backend/migrations/deals-pipeline/001_add_followup_task_columns.sql
```

### Environment Variables for Testing
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=lad_test
export DB_USER=test_user
export DB_PASSWORD=test_pass
export GCP_PROJECT_ID=test-project
export GCP_LOCATION=us-central1
export FOLLOWUP_QUEUE_NAME=follow-up-calls-test
```

## Manual Testing

### 1. Schedule Follow-Up Call

```bash
curl -X POST http://localhost:3004/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 734cd516-e252-4728-9c52-4663ee552653" \
  -d '{
    "leadId": "your-lead-id",
    "assignedUserId": "your-user-id",
    "bookingDateTime": "2026-01-10T10:00:00Z",
    "bookingType": "follow_up"
  }'
```

### 2. Verify Task Scheduled

Check database:
```sql
SELECT 
  id, 
  task_name, 
  task_status, 
  idempotency_key,
  booking_date_time,
  executed_at
FROM lad_dev.lead_bookings 
WHERE id = 'booking-id';
```

### 3. Verify Cloud Tasks

```bash
gcloud tasks list --queue=follow-up-calls --location=us-central1
```

### 4. Cancel Follow-Up

```bash
curl -X POST http://localhost:3004/api/bookings/booking-id/cancel-followup \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 734cd516-e252-4728-9c52-4663ee552653"
```

### 5. Test Execution (simulate Cloud Tasks)

```bash
curl -X POST http://localhost:3004/api/bookings/execute-followup \
  -H "Content-Type: application/json" \
  -H "x-cloudtasks-taskname: projects/test/tasks/task-123" \
  -H "x-cloudtasks-queuename: follow-up-calls" \
  -d '{
    "tenantId": "734cd516-e252-4728-9c52-4663ee552653",
    "bookingId": "booking-id",
    "idempotencyKey": "followup_tenant_booking_timestamp"
  }'
```

## Testing Checklist

### Unit Tests
- [ ] All scheduler service tests pass
- [ ] All execution service tests pass
- [ ] All controller tests pass
- [ ] Code coverage > 80%

### Integration Tests
- [ ] End-to-end workflow completes successfully
- [ ] Idempotency is enforced correctly
- [ ] Cancellation works as expected
- [ ] Error handling works properly

### Manual Tests
- [ ] Can schedule follow-up call via API
- [ ] Task appears in Cloud Tasks queue
- [ ] Database records task correctly
- [ ] Execution endpoint rejects unauthorized requests
- [ ] Execution endpoint accepts Cloud Tasks requests
- [ ] Voice agent is called with correct parameters
- [ ] Duplicate execution is prevented
- [ ] Cancellation removes task from queue

## Monitoring Test Results

### Check Test Coverage
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### View Test Results
Tests output detailed results including:
- Total tests run
- Passed/failed count
- Execution time
- Coverage metrics

### CI/CD Integration

Add to `.github/workflows/test.yml`:
```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Troubleshooting

### Mock Issues
If mocks aren't working:
```bash
# Clear Jest cache
npx jest --clearCache
```

### Database Connection Issues
For integration tests:
- Ensure test database exists
- Check connection credentials
- Run migrations on test database

### Timeout Errors
Increase timeout in specific tests:
```javascript
test('long running test', async () => {
  // test code
}, 30000); // 30 second timeout
```

## Next Steps

1. **Run all tests**: `npm test`
2. **Check coverage**: `npm run test:coverage`
3. **Fix any failures**
4. **Add CI/CD pipeline**
5. **Set up test database**
6. **Run integration tests**
7. **Monitor production with real data**
