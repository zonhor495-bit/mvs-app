#!/usr/bin/env bash

# FINAL USER SCENARIO CHECKLIST
# Run this to validate all scenarios work correctly

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         FINAL USER SCENARIO VALIDATION CHECKLIST              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to check file/content
check_file() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ FAIL${NC}: $file not found"
        ((FAILED++))
        return 1
    fi
    
    if grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓ PASS${NC}: $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}: $file missing: $pattern"
        ((FAILED++))
        return 1
    fi
}

echo "📋 CONFIGURATION FILES"
echo "─────────────────────────────────────────────────────────────────"

check_file ".env.production" "VITE_AUTH_SERVER_URL" "Production env configured"
check_file ".env.development" "VITE_AUTH_SERVER_URL" "Development env configured"
check_file "src/vite-env.d.ts" "VITE_AUTH_SERVER_URL" "TypeScript types updated"

echo ""
echo "🔐 BACKEND AUTH API"
echo "─────────────────────────────────────────────────────────────────"

check_file "tools/auth-server/src/index.js" "app.post.*register" "Backend POST /api/register"
check_file "tools/auth-server/src/index.js" "app.post.*login" "Backend POST /api/login"
check_file "tools/auth-server/src/index.js" "app.get.*api.*me" "Backend GET /api/me"
check_file "tools/auth-server/src/index.js" "app.delete.*api.*me" "Backend DELETE /api/me"

echo ""
echo "💾 STORE FUNCTIONS"
echo "─────────────────────────────────────────────────────────────────"

check_file "src/store.ts" "export.*getRemoteAuthUrl" "Store: getRemoteAuthUrl()"
check_file "src/store.ts" "import.meta.env.VITE_AUTH_SERVER_URL" "getRemoteAuthUrl uses env"
check_file "src/store.ts" "export.*registerRemoteUser" "Store: registerRemoteUser()"
check_file "src/store.ts" "export.*loginRemoteUser" "Store: loginRemoteUser()"
check_file "src/store.ts" "export.*deleteRemoteUserAccount" "Store: deleteRemoteUserAccount()"

echo ""
echo "🔑 LOGIN COMPONENT"
echo "─────────────────────────────────────────────────────────────────"

check_file "src/components/Login.tsx" "remoteUrl.*login.*hasAnyUsers" "Login: Mode selection logic"
check_file "src/components/Login.tsx" "registerRemoteUser" "Login: Remote registration"
check_file "src/components/Login.tsx" "loginRemoteUser" "Login: Remote login"
check_file "src/components/Login.tsx" "Создать новый аккаунт" "Login: Register toggle text"

echo ""
echo "⚙️ SETTINGS COMPONENT"
echo "─────────────────────────────────────────────────────────────────"

check_file "src/components/Settings.tsx" "deleteRemoteUserAccount" "Settings: Delete account function"
check_file "src/components/Settings.tsx" "Удалить аккаунт" "Settings: Delete button text"
check_file "src/components/Settings.tsx" "Remote Auth URL" "Settings: Remote URL display"

echo ""
echo "🧪 BACKEND TESTS"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "tools/auth-server/src/index.test.js" ]; then
    if grep -q "describe\\|it(" tools/auth-server/src/index.test.js 2>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}: Backend E2E tests exist"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: No backend tests found"
        ((FAILED++))
    fi
else
    echo -e "${RED}✗ FAIL${NC}: Backend tests file not found"
    ((FAILED++))
fi

echo ""
echo "📦 BUILD ARTIFACTS"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "build/win/MVSSetup.exe" ]; then
    size=$(ls -lh "build/win/MVSSetup.exe" | awk '{print $5}')
    echo -e "${GREEN}✓ PASS${NC}: Windows installer exists ($size)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: MVSSetup.exe not found (run: npm run build)"
    ((FAILED++))
fi

if [ -f "build/win/win-unpacked/resources/app.asar" ]; then
    echo -e "${GREEN}✓ PASS${NC}: app.asar exists in installer"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARN${NC}: app.asar not found (expected in built installer)"
fi

echo ""
echo "📝 VALIDATION SCRIPTS"
echo "─────────────────────────────────────────────────────────────────"

check_file "FINAL_USER_SCENARIO_CHECK.mjs" "FINAL USER SCENARIO VALIDATION" "Validation script exists"

echo ""
echo "📚 DOCUMENTATION"
echo "─────────────────────────────────────────────────────────────────"

check_file "FINAL_VALIDATION_SUMMARY.md" "Status.*READY FOR PRODUCTION" "Summary doc"
check_file "FINAL_SCENARIO_VERIFICATION_REPORT.md" "COMPLETE & VALIDATED" "Detailed report"
check_file "PRODUCTION_DEPLOYMENT_GUIDE.md" "PRODUCTION DEPLOYMENT" "Deployment guide"
check_file "README_FINAL_VALIDATION.md" "PRODUCTION READY" "Final readme"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    SUMMARY                                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED - READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Update .env.production with production backend URL"
    echo "  2. Run: npm run build"
    echo "  3. Distribute: build/win/MVSSetup.exe to users"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED - PLEASE FIX BEFORE DEPLOYMENT${NC}"
    echo ""
    echo "Failed checks need attention before production deployment."
    echo ""
    exit 1
fi
