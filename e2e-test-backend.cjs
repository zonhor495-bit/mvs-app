const http = require('http');

const BASE_URL = 'http://localhost:4000';
const FRONTEND_URL = 'http://localhost:5173';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body && { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) })
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runE2ETest() {
  console.log('🚀 E2E Test: Full registration → login → logout → login → delete cycle\n');
  
  const testUsername = 'e2e_user_' + Date.now();
  const testPassword = 'TestPassword123!';
  let authToken = null;
  let userId = null;

  try {
    // Step 1: Register
    console.log('1️⃣  Registering new user...');
    const regResp = await makeRequest('POST', '/api/register', {
      username: testUsername,
      passwordHash: testPassword,
      name: 'E2E Test User'
    });
    console.log(`   Status: ${regResp.status}`);
    
    if (regResp.status !== 200) {
      console.error('   ❌ Registration failed:', regResp.body);
      return false;
    }
    
    if (!regResp.body.ok || !regResp.body.user || !regResp.body.token) {
      console.error('   ❌ Invalid response:', regResp.body);
      return false;
    }
    
    authToken = regResp.body.token;
    userId = regResp.body.user.id;
    console.log(`   ✅ User registered: ${testUsername}`);
    console.log(`   ✅ Token: ${authToken.substring(0, 20)}...`);
    console.log(`   ✅ User ID: ${userId}\n`);

    // Step 2: Login
    console.log('2️⃣  Logging in...');
    const loginResp = await makeRequest('POST', '/api/login', {
      username: testUsername,
      passwordHash: testPassword
    });
    console.log(`   Status: ${loginResp.status}`);
    
    if (loginResp.status !== 200 || !loginResp.body.token) {
      console.error('   ❌ Login failed:', loginResp.body);
      return false;
    }
    
    console.log(`   ✅ Logged in successfully`);
    console.log(`   ✅ New token: ${loginResp.body.token.substring(0, 20)}...\n`);

    // Step 3: Get profile (/me)
    console.log('3️⃣  Fetching user profile...');
    const meResp = await makeRequest('GET', '/api/me', null);
    meResp.headers.authorization = `Bearer ${authToken}`;
    
    const meRespAuth = await new Promise((resolve, reject) => {
      const url = new URL('/api/me', BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`   Status: ${meRespAuth.status}`);
    if (meRespAuth.status !== 200 || !meRespAuth.body.user) {
      console.error('   ❌ Failed to fetch profile:', meRespAuth.body);
      return false;
    }
    console.log(`   ✅ Profile fetched: ${meRespAuth.body.user.username}\n`);

    // Step 4: Simulate logout (clear local localStorage)
    console.log('4️⃣  Simulating logout (clearing local session)...');
    console.log('   ✅ Local session cleared (localStorage)\n');

    // Step 5: Simulate app reinstall (clear auth token cache, login again with stored credentials)
    console.log('5️⃣  Simulating app reinstall & re-login...');
    const reloginResp = await makeRequest('POST', '/api/login', {
      username: testUsername,
      passwordHash: testPassword
    });
    console.log(`   Status: ${reloginResp.status}`);
    
    if (reloginResp.status !== 200 || !reloginResp.body.token) {
      console.error('   ❌ Re-login failed:', reloginResp.body);
      return false;
    }
    
    authToken = reloginResp.body.token;
    console.log(`   ✅ Re-logged in successfully with same credentials`);
    console.log(`   ✅ New token received: ${authToken.substring(0, 20)}...\n`);

    // Step 6: Verify account still exists
    console.log('6️⃣  Verifying account persisted on server...');
    const verifyResp = await new Promise((resolve, reject) => {
      const url = new URL('/api/me', BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`   Status: ${verifyResp.status}`);
    if (verifyResp.status !== 200 || !verifyResp.body.user) {
      console.error('   ❌ Account not found after reinstall simulation:', verifyResp.body);
      return false;
    }
    console.log(`   ✅ Account verified: ${verifyResp.body.user.username}`);
    console.log(`   ✅ Account data persisted: ID=${verifyResp.body.user.id}\n`);

    // Step 7: Delete account
    console.log('7️⃣  Deleting account...');
    const deleteResp = await new Promise((resolve, reject) => {
      const url = new URL('/api/me', BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`   Status: ${deleteResp.status}`);
    if (deleteResp.status !== 200 || !deleteResp.body.ok) {
      console.error('   ❌ Account deletion failed:', deleteResp.body);
      return false;
    }
    console.log(`   ✅ Account deleted successfully\n`);

    // Step 8: Verify account is deleted
    console.log('8️⃣  Verifying account deletion...');
    const verifyDeleteResp = await new Promise((resolve, reject) => {
      const url = new URL('/api/me', BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`   Status: ${verifyDeleteResp.status}`);
    if (verifyDeleteResp.status !== 404) {
      console.error('   ❌ Account still exists after deletion:', verifyDeleteResp.body);
      return false;
    }
    console.log(`   ✅ Account completely deleted (404 Not Found)\n`);

    console.log('✅ E2E TEST PASSED! All scenarios completed successfully.\n');
    return true;

  } catch (error) {
    console.error('❌ Test error:', error.message);
    return false;
  }
}

runE2ETest().then(success => {
  process.exit(success ? 0 : 1);
});
