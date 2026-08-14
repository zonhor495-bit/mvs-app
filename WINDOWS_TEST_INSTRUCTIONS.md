# Windows Test Instructions — MVS v1.1.8

## Preparation

1. **Download installer:**
   - Navigate to: https://github.com/yourusername/carwin/releases/tag/v1.1.8
   - Download: `MVSSetup.exe` (84 MB)

2. **System requirements:**
   - Windows 10 or later
   - Administrative privileges recommended
   - ~300 MB free disk space

## Installation

1. **Run installer:**
   ```
   Double-click MVSSetup.exe
   ```

2. **Follow installation wizard:**
   - Accept license
   - Choose install location (default: `C:\Users\[UserName]\AppData\Local\Programs\MVS`)
   - Wait for file extraction
   - Application should auto-launch after completion

## Testing

### Phase 1: Startup Verification

1. **Check for errors:**
   - Watch console/error messages during startup
   - Look for any popup dialogs with error codes
   - **Expected:** Clean startup, login screen appears
   - **NOT Expected:** `ERR_REQUIRE_ESM`, `SyntaxError`, or module loading errors

2. **Verify startup log:**
   ```
   Open: %APPDATA%\MVS\startup.log
   Path: C:\Users\[UserName]\AppData\Roaming\MVS\startup.log
   ```
   
   Expected log content:
   ```
   ================================================================================
   STARTUP LOG - 2026-08-13T...
   ================================================================================
   [2026-08-13T...] App Version: 1.1.8
   [2026-08-13T...] isDev: false, isPackaged: true
   [2026-08-13T...] Main window created
   ...
   ```
   
   **If you see `ERR_REQUIRE_ESM`:**
   - Copy entire log content
   - Provide to development team

### Phase 2: Functional Testing

1. **Authentication:**
   - [ ] Login with default admin password (if set)
   - [ ] Verify role-based access (admin vs manager)
   - [ ] Check that only expected roles appear

2. **Services:**
   - [ ] Add a new service (e.g., "Полировка")
   - [ ] Verify price matrix created for all car types
   - [ ] Edit and delete service
   - [ ] Confirm no duplicate role flows or inconsistencies

3. **Employees/Washers:**
   - [ ] Add new washer
   - [ ] Edit daily rate (washer percent)
   - [ ] Verify percentage field accepts 0-100 range
   - [ ] Delete washer

4. **Settings:**
   - [ ] Update role password (admin/manager)
   - [ ] Verify both password fields required
   - [ ] Confirm settings persist after restart

### Phase 3: Runtime Diagnostics

If any issues occur:

1. **Collect error logs:**
   ```
   Location: %APPDATA%\MVS\startup.log
   ```

2. **Collect app.asar info:**
   ```
   Location: %LOCALAPPDATA%\Programs\MVS\resources\app.asar\package.json
   ```
   (Extract using 7-Zip or asar tool)

3. **Screenshot errors:**
   - Capture any error dialogs
   - Include console output if app-console visible

4. **Report structure:**
   ```
   - Exact error message
   - Full stack trace (if available)
   - startup.log (first and last 50 lines)
   - app.asar/package.json content
   - Node.js version (if obtainable)
   - Windows version
   ```

## Success Criteria

✅ **Test Passed:**
- App launches without ERR_REQUIRE_ESM
- startup.log shows clean initialization
- All role/auth flows work correctly
- Services and washers can be added/edited
- Settings save and persist

❌ **Test Failed:**
- Any error dialog during startup
- ERR_REQUIRE_ESM in logs or console
- Role flows bypass or inconsistent access
- Data operations fail silently

## Rollback

If v1.1.8 is unstable, uninstall and reinstall previous version:

```
Control Panel → Programs → Programs and Features
→ Find "MVS" → Uninstall
→ Download v1.1.6 from Releases
→ Run MVSSetup.exe (v1.1.6)
```

---

**Build Date:** August 13, 2026  
**Commit:** 434cf1c  
**Tag:** v1.1.8
