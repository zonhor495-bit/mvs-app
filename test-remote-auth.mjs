#!/usr/bin/env node
/**
 * Full end-to-end test script for remote auth with Render
 * Tests: register → verify session restore → logout → login
 */

const BASE_URL = 'https://mvs-app.onrender.com';
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  password: 'TestPass123!',
  name: 'Test User'
};

function log(label, data) {
  console.log(`\n[${'═'.repeat(60)}]`);
  console.log(`  ${label}`);
  console.log(`[${'═'.repeat(60)}]`);
  if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function hashPassword(plainPassword, salt = '') {
  const data = new TextEncoder().encode(`${salt}:${plainPassword}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function test() {
  log('TEST: Remote Auth with Render', `
Testing URL: ${BASE_URL}
Test User: ${TEST_USER.username}
Password: ${TEST_USER.password}
  `);

  let token = null;
  let userId = null;

  // Step 1: Register
  try {
    log('STEP 1: POST /api/register', `
Registering new user:
  - username: ${TEST_USER.username}
  - password: ${TEST_USER.password}
    `);

    const passwordHash = await hashPassword(TEST_USER.password);
    const registerRes = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        passwordHash,
        name: TEST_USER.name
      })
    });

    const registerData = await registerRes.json();
    log('Response from /api/register', registerData);

    if (!registerData.ok || !registerData.token) {
      throw new Error('Registration failed: ' + (registerData.error || 'unknown'));
    }

    token = registerData.token;
    userId = registerData.user.id;
    console.log(`✓ Registration successful!`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Token: ${token.substring(0, 20)}...`);
  } catch (e) {
    log('ERROR in Registration', e.message);
    process.exit(1);
  }

  // Step 2: Verify session - GET /api/me with token
  try {
    log('STEP 2: GET /api/me (Session Verification)', `
Using token to verify session was saved on server:
  Token: ${token.substring(0, 20)}...
    `);

    const meRes = await fetch(`${BASE_URL}/api/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const meData = await meRes.json();
    log('Response from /api/me', meData);

    if (!meData.ok) {
      throw new Error('Session verification failed: ' + (meData.error || 'unknown'));
    }

    console.log(`✓ Session verified!`);
    console.log(`  User: ${meData.user.username}`);
  } catch (e) {
    log('ERROR in Session Verification', e.message);
    process.exit(1);
  }

  // Step 3: Logout (simulate localStorage clear)
  try {
    log('STEP 3: Simulating Logout', `
Clearing token from "localStorage" (client-side simulation)
    `);
    token = null;
    console.log(`✓ Token cleared`);
  } catch (e) {
    log('ERROR in Logout', e.message);
    process.exit(1);
  }

  // Step 4: Login with same credentials
  try {
    log('STEP 4: POST /api/login (After Logout)', `
Logging in again with same credentials:
  - username: ${TEST_USER.username}
  - password: ${TEST_USER.password}
    `);

    const passwordHash = await hashPassword(TEST_USER.password);
    const loginRes = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        passwordHash
      })
    });

    const loginData = await loginRes.json();
    log('Response from /api/login', loginData);

    if (!loginData.ok || !loginData.token) {
      throw new Error('Login failed: ' + (loginData.error || 'unknown'));
    }

    token = loginData.token;
    console.log(`✓ Login successful!`);
    console.log(`  Token: ${token.substring(0, 20)}...`);
  } catch (e) {
    log('ERROR in Login', e.message);
    process.exit(1);
  }

  // Step 5: Verify new session
  try {
    log('STEP 5: GET /api/me (Verify New Session)', `
Using new token to verify session:
  Token: ${token.substring(0, 20)}...
    `);

    const meRes = await fetch(`${BASE_URL}/api/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const meData = await meRes.json();
    log('Response from /api/me', meData);

    if (!meData.ok) {
      throw new Error('Session verification failed: ' + (meData.error || 'unknown'));
    }

    console.log(`✓ New session verified!`);
    console.log(`  User: ${meData.user.username}`);
  } catch (e) {
    log('ERROR in New Session Verification', e.message);
    process.exit(1);
  }

  // Step 6: Delete account (cleanup)
  try {
    log('STEP 6: DELETE /api/me (Cleanup)', `
Deleting test account from server:
  Token: ${token.substring(0, 20)}...
    `);

    const deleteRes = await fetch(`${BASE_URL}/api/me`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const deleteData = await deleteRes.json();
    log('Response from DELETE /api/me', deleteData);

    if (!deleteData.ok) {
      throw new Error('Delete failed: ' + (deleteData.error || 'unknown'));
    }

    console.log(`✓ Account deleted!`);
  } catch (e) {
    log('ERROR in Account Deletion', e.message);
    process.exit(1);
  }

  log('✅ ALL TESTS PASSED', `
Summary:
  ✓ Registration with remote auth
  ✓ Session persistence verification
  ✓ Logout simulation
  ✓ Re-login with same credentials
  ✓ New session verification
  ✓ Account cleanup

The app is ready for production deployment!
  `);
}

test().catch(e => {
  log('FATAL ERROR', e.message);
  process.exit(1);
});
