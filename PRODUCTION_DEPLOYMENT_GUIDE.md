# 📋 PRODUCTION DEPLOYMENT INSTRUCTIONS

## For Real-World Windows Deployment

---

## 1️⃣ Prepare Production Backend Server

### Option A: Using tools/auth-server (Included in Repository)

The authentication backend is included in this repository.

**Steps:**
```bash
# 1. Navigate to auth server
cd tools/auth-server

# 2. Install dependencies
npm install

# 3. Configure .env
# Create .env file with:
JWT_SECRET=your-secure-random-secret-here
PORT=4000
DB_FILE=./data/auth.db
TOKEN_EXPIRY=7d

# 4. Start server
npm start
# Server runs on http://localhost:4000

# 5. Verify server health
curl http://localhost:4000/health
# Should return: {"ok": true}
```

**Database:**
- SQLite file automatically created at `./data/auth.db`
- Contains users table with:
  - id (UUID)
  - username (unique)
  - password_hash (argon2)
  - name (display name)
  - created_at, updated_at (timestamps)

**API Endpoints:**
```
POST   /api/register   — Register new user
POST   /api/login      — Login user
GET    /api/me         — Get current user (requires Bearer token)
DELETE /api/me         — Delete user account (requires Bearer token)
```

---

## 2️⃣ Configure App for Production Backend

### Step 1: Edit `.env.production`

**File:** `.env.production`

**Update the URL to your production backend:**
```
# Before (local testing):
VITE_AUTH_SERVER_URL=http://localhost:4000

# After (production):
VITE_AUTH_SERVER_URL=https://auth.yourdomain.com:4000
# or
VITE_AUTH_SERVER_URL=https://192.168.1.100:4000
```

**Notes:**
- Use `https://` for production (requires SSL certificate)
- Use full domain name or IP address
- Include port if non-standard
- No trailing slash

### Step 2: Rebuild Windows Installer

```bash
# From project root
npm run build

# Output: build/win/MVSSetup.exe
# This installer now contains your production backend URL
```

**Verification:**
- Check that `MVSSetup.exe` was created (should be ~84 MB)
- The backend URL is now embedded in the build

---

## 3️⃣ Deploy to Windows Clients

### Option A: Manual Installation
1. Copy `build/win/MVSSetup.exe` to Windows machine
2. Run installer
3. App starts with production backend URL already configured
4. User sees login form

### Option B: Automated Deployment
- Use Group Policy (for corporate environments)
- Use managed software center
- Include in Windows imaging pipeline

---

## 4️⃣ User Experience After Deployment

### First-Time User
```
1. User installs MVSSetup.exe
   ↓
2. App starts
   • Backend URL loaded from build configuration
   • No manual setup required
   ↓
3. Login form appears
   • User clicks "Создать новый аккаунт"
   ↓
4. Registration
   • User enters username, password, name
   • Credentials sent to backend server
   • Account created in SQLite database
   ↓
5. User logged in
   • Auth token stored locally
   • Full app access granted
```

### Returning User (After Reinstall)
```
1. User reinstalls MVSSetup.exe
   ↓
2. App starts with clean local data
   • But backend URL still configured
   ↓
3. Login form appears
   ↓
4. User enters original credentials
   ↓
5. Backend verifies against database
   ↓
6. Account fully recovered
   • All previous data from server
```

### Account Deletion
```
Settings → System Tab → Dangerous Zone → "Delete Account" button
   ↓
Confirmation dialog
   ↓
Backend DELETE /api/me removes account permanently
   ↓
User logged out, app cleared
```

---

## 5️⃣ Security Best Practices

### Server-Side
- [x] **Password Hashing:** Argon2 (memory-hard, salted)
- [x] **Token Security:** JWT with 7-day expiry
- [x] **Secret Key:** Use long random string for JWT_SECRET
- [x] **Database:** SQLite with file-based persistence
- [x] **HTTPS:** Use SSL/TLS certificate for production

### Configuration
```bash
# Use strong JWT secret (minimum 32 characters):
JWT_SECRET=aB3cDeFgHiJkLmNoPqRsTuVwXyZ0123456789!@#$%^&*

# Set appropriate token expiry:
TOKEN_EXPIRY=7d

# Use dedicated database file:
DB_FILE=/var/lib/mvs/auth.db
```

### Client-Side
- [x] Passwords hashed before sending to server
- [x] Tokens stored in localStorage with authToken field
- [x] HTTPS enforces encrypted communication
- [x] No credentials stored in plaintext

---

## 6️⃣ Troubleshooting

### Issue: "Remote auth not configured" on first launch

**Solution:**
```
1. Check .env.production exists in project root
2. Rebuild app: npm run build
3. Use new MVSSetup.exe
4. Backend URL will be embedded
```

### Issue: "Cannot connect to server" during login

**Check:**
```bash
# Verify backend is running:
curl https://your-backend-url:4000/health

# Check network connectivity:
ping your-backend-url

# Verify firewall allows port 4000
# Check SSL certificate validity (if using HTTPS)
```

### Issue: Account lost after uninstall-reinstall

**This should NOT happen because:**
- Backend URL is pre-configured
- Account is stored on server (not app data)
- Login form appears after reinstall
- User can login with original credentials

**If account recovery fails:**
1. Verify backend URL in .env.production
2. Verify backend server is running
3. Check network connectivity
4. Verify account exists in SQLite database:
   ```bash
   sqlite3 data/auth.db ".schema users"
   sqlite3 data/auth.db "SELECT username FROM users"
   ```

### Issue: "Неверный логин или пароль" (Invalid credentials)

**Check:**
1. Username spelling (case-insensitive on server)
2. Password is correct
3. Account exists in database:
   ```bash
   sqlite3 data/auth.db "SELECT username FROM users WHERE username='testuser';"
   ```
4. Backend server logs for errors

---

## 7️⃣ Monitoring & Maintenance

### Server Health
```bash
# Check running process
ps aux | grep "node.*auth-server"

# Check database size
ls -lh data/auth.db

# Monitor system resources
top   # Linux/Mac
tasklist   # Windows
```

### Database Backup
```bash
# Daily backup
cp data/auth.db data/auth.db.backup.$(date +%Y%m%d)

# Keep last 30 days
find data -name "auth.db.backup.*" -mtime +30 -delete
```

### Log Monitoring
```bash
# Server logs (if using pm2):
pm2 logs mvs-auth-server

# Or check application error logs
tail -f app.log
```

---

## 8️⃣ Production Deployment Checklist

- [ ] Backend server deployed and running
- [ ] SSL/TLS certificate installed (for HTTPS)
- [ ] JWT_SECRET set to strong random value
- [ ] `.env.production` updated with real backend URL
- [ ] App rebuilt with `npm run build`
- [ ] `MVSSetup.exe` tested on staging Windows machine
- [ ] User registration → login → logout → relogin works
- [ ] App uninstall → reinstall → login works
- [ ] Backend database backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Documentation shared with users/IT team

---

## 9️⃣ Rollback Plan

If issues occur after deployment:

### Immediate Rollback
```bash
# Stop new backend
systemctl stop mvs-auth-server

# Restore previous version
cp /backups/auth-server.v1.1.6 /opt/mvs-auth-server

# Restart
systemctl start mvs-auth-server
```

### Downgrade App
```bash
# Users can uninstall current version and install previous
# Account data is on server - will be recovered after login

# Or:
# Provide previous MVSSetup.exe
# Keep backend URL compatible across versions
```

---

## 🔟 Support & Questions

### For Users:
- "How do I create an account?" → Use login form, click "Create account"
- "Can I reinstall the app?" → Yes, your account will recover
- "Will my data be deleted if I uninstall?" → No, only reinstall the app

### For IT/Admins:
- Backend logs location: Check .env configuration
- Database location: Check DB_FILE in .env (default: ./data/auth.db)
- Port configuration: Check PORT in .env (default: 4000)
- Token expiry: Check TOKEN_EXPIRY in .env (default: 7d)

---

**Last Updated:** $(date)
**Status:** Production Ready
**Version:** 1.1.7
